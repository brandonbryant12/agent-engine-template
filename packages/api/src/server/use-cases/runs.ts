import {
  Queue,
  QueueJobType,
  formatError,
  type TypedJob,
} from '@repo/queue';
import { Effect, Schema } from 'effect';
import type { User } from '@repo/auth/policy';
import {
  RunResultSchema,
  type CreateRunInput,
  type RunOutput,
  type RunResult,
} from '../../contracts/runs';
import { SSEPublisher } from '../sse-publisher-service';

type RunJob = TypedJob<typeof QueueJobType.PROCESS_AI_RUN>;

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
const INVALID_COMPLETED_RUN_RESULT_ERROR =
  'Run completed with invalid result payload';
const CREATE_RUN_SOURCE_PATH =
  'packages/api/src/server/use-cases/runs.ts:createRunUseCase';
const LIST_RUNS_SOURCE_PATH =
  'packages/api/src/server/use-cases/runs.ts:listRunsUseCase';

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

type RunResultDecodeOutcome = {
  readonly result: RunResult | null;
  readonly parseErrorSummary: string | null;
};

const toParseErrorSummary = (error: unknown): string => {
  const message = formatError(error);
  const firstLine = message.split('\n')[0]?.trim();
  return firstLine && firstLine.length > 0
    ? firstLine
    : 'invalid run result payload';
};

const decodeRunResultOutcome = (value: unknown): RunResultDecodeOutcome => {
  if (value == null) {
    return {
      result: null,
      parseErrorSummary: 'missing result payload',
    };
  }

  try {
    return {
      result: decodeRunResult(value),
      parseErrorSummary: null,
    };
  } catch (error) {
    return {
      result: null,
      parseErrorSummary: toParseErrorSummary(error),
    };
  }
};

const logRunResultDecodeFailure = (
  jobId: string,
  sourcePath: string,
  parseErrorSummary: string,
) =>
  Effect.logWarning('run.result.decode_failed').pipe(
    Effect.annotateLogs('queue.job.id', jobId),
    Effect.annotateLogs('source.path', sourcePath),
    Effect.annotateLogs('parse.error.summary', parseErrorSummary),
  );

const toRunOutput = (
  job: RunJob,
  sourcePath: string,
): Effect.Effect<RunOutput, never> =>
  Effect.gen(function* () {
    const decoded = decodeRunResultOutcome(job.result as unknown);
    const isCompletedRunWithInvalidResult =
      job.status === 'completed' && decoded.result === null;
    const hasMalformedResult =
      job.result != null && decoded.parseErrorSummary !== null;
    const shouldLogDecodeFailure =
      decoded.parseErrorSummary !== null &&
      (isCompletedRunWithInvalidResult || hasMalformedResult);

    if (shouldLogDecodeFailure) {
      yield* logRunResultDecodeFailure(
        job.id,
        sourcePath,
        decoded.parseErrorSummary,
      );
    }

    return {
      id: job.id,
      status: job.status,
      prompt: toOptionalString(job.payload?.prompt) ?? '',
      threadId: toOptionalString(job.payload?.threadId),
      result: decoded.result,
      error:
        job.error ??
        (isCompletedRunWithInvalidResult
          ? INVALID_COMPLETED_RUN_RESULT_ERROR
          : null),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  });

export const createRunUseCase = ({ user, input }: CreateRunUseCaseInput) =>
  Effect.gen(function* () {
    const queue = yield* Queue;
    const publisher = yield* SSEPublisher;

    const created = yield* queue.enqueue(
      QueueJobType.PROCESS_AI_RUN,
      {
        prompt: input.prompt,
        threadId: input.threadId ?? null,
        userId: user.id,
      },
      user.id,
    );

    const run = yield* toRunOutput(
      created,
      CREATE_RUN_SOURCE_PATH,
    );

    yield* publisher.publish(user.id, {
      type: 'run_queued',
      runId: run.id,
      prompt: run.prompt,
      threadId: run.threadId,
      timestamp: new Date().toISOString(),
    });

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

    return yield* Effect.forEach(jobs, (job) =>
      toRunOutput(job, LIST_RUNS_SOURCE_PATH),
    );
  });
