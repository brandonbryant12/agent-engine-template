import { Queue, QueueJobType, type Job } from '@repo/queue';
import { Effect, Schema } from 'effect';
import type { User } from '@repo/auth/policy';
import {
  RunResultSchema,
  type CreateRunInput,
  type RunOutput,
  type RunResult,
} from '../../contracts/runs';
import { ssePublisher } from '../publisher';

type RunPayload = {
  prompt?: unknown;
  threadId?: unknown;
};

type ListRunsInput = {
  readonly limit?: number;
};

export interface CreateRunUseCaseInput {
  readonly user: User;
  readonly input: CreateRunInput;
}

export interface ListRunsUseCaseInput {
  readonly user: User;
  readonly input: ListRunsInput;
}

const decodeRunResult = Schema.decodeUnknownSync(RunResultSchema);

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const toRunResult = (value: unknown): RunResult | null => {
  if (value == null) return null;

  try {
    return decodeRunResult(value);
  } catch {
    return null;
  }
};

const toRunOutput = (job: Job<RunPayload>): RunOutput => ({
  id: job.id,
  status: job.status,
  prompt: toOptionalString(job.payload?.prompt) ?? '',
  threadId: toOptionalString(job.payload?.threadId),
  result: toRunResult(job.result),
  error: job.error,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
  startedAt: job.startedAt?.toISOString() ?? null,
  completedAt: job.completedAt?.toISOString() ?? null,
});

export const createRunUseCase = ({ user, input }: CreateRunUseCaseInput) =>
  Effect.gen(function* () {
    const queue = yield* Queue;

    const created = yield* queue.enqueue(
      QueueJobType.PROCESS_AI_RUN,
      {
        prompt: input.prompt,
        threadId: input.threadId ?? null,
        userId: user.id,
      },
      user.id,
    );

    const run = toRunOutput(created as Job<RunPayload>);

    yield* Effect.sync(() =>
      ssePublisher.publish(user.id, {
        type: 'run_queued',
        runId: run.id,
        prompt: run.prompt,
        threadId: run.threadId,
        timestamp: new Date().toISOString(),
      }),
    );

    return run;
  });

export const listRunsUseCase = ({ user, input }: ListRunsUseCaseInput) =>
  Effect.gen(function* () {
    const queue = yield* Queue;
    const jobs = yield* queue.getJobsByUser(user.id, {
      type: QueueJobType.PROCESS_AI_RUN,
      limit: input.limit,
      sortByCreatedAt: 'desc',
    });

    return jobs.map((job) => toRunOutput(job as Job<RunPayload>));
  });
