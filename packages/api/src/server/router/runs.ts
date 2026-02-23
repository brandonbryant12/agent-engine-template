import { JobType } from '@repo/db/schema';
import { Queue, type Job } from '@repo/queue';
import { Effect, Schema } from 'effect';
import {
  RunResultSchema,
  type RunOutput,
  type RunResult,
} from '../../contracts/runs';
import { handleEffectWithProtocol } from '../effect-handler';
import { protectedProcedure } from '../orpc';
import { ssePublisher } from '../publisher';

type RunPayload = {
  prompt?: unknown;
  threadId?: unknown;
};

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

const runsRouter = {
  create: protectedProcedure.runs.create.handler(
    async ({ context, input, errors }) =>
      handleEffectWithProtocol(
        context.runtime,
        context.user,
        Effect.gen(function* () {
          const queue = yield* Queue;

          const created = yield* queue.enqueue(
            JobType.PROCESS_AI_RUN,
            {
              prompt: input.prompt,
              threadId: input.threadId ?? null,
              userId: context.user.id,
            },
            context.user.id,
          );

          const run = toRunOutput(created as Job<RunPayload>);

          yield* Effect.sync(() =>
            ssePublisher.publish(context.user.id, {
              type: 'run_queued',
              runId: run.id,
              prompt: run.prompt,
              threadId: run.threadId,
              timestamp: new Date().toISOString(),
            }),
          );

          return run;
        }),
        errors,
        {
          requestId: context.requestId,
          span: 'api.runs.create',
        },
      ),
  ),

  list: protectedProcedure.runs.list.handler(async ({ context, input, errors }) =>
    handleEffectWithProtocol(
      context.runtime,
      context.user,
      Effect.gen(function* () {
        const queue = yield* Queue;
        const jobs = yield* queue.getJobsByUser(
          context.user.id,
          JobType.PROCESS_AI_RUN,
        );
        const runs = jobs
          .map((job) => toRunOutput(job as Job<RunPayload>))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return input.limit ? runs.slice(0, input.limit) : runs;
      }),
      errors,
      {
        requestId: context.requestId,
        span: 'api.runs.list',
      },
    ),
  ),
};

export default runsRouter;
