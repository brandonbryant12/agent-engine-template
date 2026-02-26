import { LLM } from '@repo/ai';
import { type RunResult, RunResultSchema } from '@repo/api/contracts';
import { JobStatus, JobType } from '@repo/db/schema';
import {
  JobProcessingError,
  Queue,
  formatError,
  type Job,
  type JobType as QueueJobType,
} from '@repo/queue';
import { Effect, Schema } from 'effect';
import {
  createWorker,
  type BaseWorkerConfig,
  type Worker,
} from './base-worker';
import {
  STALE_CHECK_EVERY_N_POLLS,
  STALE_JOB_MAX_AGE_MS,
} from './constants';
import {
  emitRunCompleted,
  emitRunFailed,
  emitRunProgress,
  emitRunStarted,
  type PublishEvent,
} from './events';

export interface UnifiedWorkerConfig extends BaseWorkerConfig {
  publishEvent?: PublishEvent;
}

type RunJobPayload = {
  userId?: unknown;
  prompt?: unknown;
  threadId?: unknown;
};

const JOB_TYPES: QueueJobType[] = [JobType.PROCESS_AI_RUN];

const decodeRunResult = Schema.decodeUnknownSync(RunResultSchema);
export const INVALID_COMPLETED_RUN_RESULT_ERROR =
  'Run completed with invalid result payload';
const RUN_RESULT_DECODE_SOURCE_PATH =
  'apps/worker/src/unified-worker.ts:onJobComplete';
const STALE_REAPER_SOURCE_PATH =
  'apps/worker/src/unified-worker.ts:onPollCycle';

const toParseErrorSummary = (error: unknown): string => {
  const message = formatError(error);
  const firstLine = message.split('\n')[0]?.trim();
  return firstLine && firstLine.length > 0
    ? firstLine
    : 'invalid run result payload';
};

const runSystemPrompt = `You are an async background AI assistant.

Given a user prompt, produce concise execution output with:
- A short title
- A direct summary
- Key points as actionable bullets
- Next actions as concrete follow-ups

Keep language practical and implementation-focused.`;

const toProcessingError = (jobId: string, error: unknown) =>
  error instanceof JobProcessingError
    ? error
    : new JobProcessingError({
        jobId,
        message: formatError(error),
        cause: error,
      });

const decodePayload = (
  job: Job<RunJobPayload>,
): Effect.Effect<
  { userId: string; prompt: string; threadId: string | null },
  JobProcessingError
> => {
  const userId =
    typeof job.payload?.userId === 'string' && job.payload.userId.length > 0
      ? job.payload.userId
      : job.createdBy;

  const prompt =
    typeof job.payload?.prompt === 'string' ? job.payload.prompt.trim() : '';

  if (prompt.length === 0) {
    return Effect.fail(
      new JobProcessingError({
        jobId: job.id,
        message: 'Run prompt is required',
      }),
    );
  }

  const threadId =
    typeof job.payload?.threadId === 'string' &&
    job.payload.threadId.trim().length > 0
      ? job.payload.threadId
      : null;

  return Effect.succeed({ userId, prompt, threadId });
};

type ParsedRunResult = {
  readonly result: RunResult | null;
  readonly parseErrorSummary: string | null;
};

const parseRunResult = (value: unknown): ParsedRunResult => {
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

const logRunResultDecodeFailure = (jobId: string, parseErrorSummary: string) =>
  Effect.logWarning('run.result.decode_failed').pipe(
    Effect.annotateLogs('queue.job.id', jobId),
    Effect.annotateLogs('source.path', RUN_RESULT_DECODE_SOURCE_PATH),
    Effect.annotateLogs('parse.error.summary', parseErrorSummary),
  );

export const handleCompletedRun = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  job: Job<RunJobPayload>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const parsed = parseRunResult(job.result);
    const runResult = parsed.result;

    if (runResult) {
      yield* Effect.sync(() =>
        emitRunCompleted(publishEvent, userId, job.id, runResult),
      );
      return;
    }

    if (parsed.parseErrorSummary) {
      yield* logRunResultDecodeFailure(job.id, parsed.parseErrorSummary);
    }

    yield* Effect.sync(() =>
      emitRunFailed(
        publishEvent,
        userId,
        job.id,
        INVALID_COMPLETED_RUN_RESULT_ERROR,
      ),
    );
  });

const shouldRunStaleCheck = (pollCount: number, checkEveryNPolls: number) =>
  pollCount > 0 && pollCount % checkEveryNPolls === 0;

export const createStaleJobReaper = (
  maxAgeMs = STALE_JOB_MAX_AGE_MS,
  checkEveryNPolls = STALE_CHECK_EVERY_N_POLLS,
) =>
  (pollCount: number) =>
    shouldRunStaleCheck(pollCount, checkEveryNPolls)
      ? Effect.gen(function* () {
          const queue = yield* Queue;
          const sweep = yield* queue.failStaleJobs(maxAgeMs).pipe(
            Effect.catchAll((error) =>
              Effect.logError('worker.stale_job_reaper.failed').pipe(
                Effect.annotateLogs('source.path', STALE_REAPER_SOURCE_PATH),
                Effect.annotateLogs('worker.poll.count', pollCount),
                Effect.annotateLogs('queue.stale_jobs.max_age_ms', maxAgeMs),
                Effect.annotateLogs(
                  'queue.stale_jobs.check_every_n_polls',
                  checkEveryNPolls,
                ),
                Effect.annotateLogs('error.message', formatError(error)),
                Effect.as(null),
              ),
            ),
          );

          if (!sweep) {
            return;
          }

          yield* Effect.logInfo('worker.stale_job_reaper.completed').pipe(
            Effect.annotateLogs('source.path', STALE_REAPER_SOURCE_PATH),
            Effect.annotateLogs('worker.poll.count', pollCount),
            Effect.annotateLogs('queue.stale_jobs.max_age_ms', maxAgeMs),
            Effect.annotateLogs(
              'queue.stale_jobs.check_every_n_polls',
              checkEveryNPolls,
            ),
            Effect.annotateLogs(
              'queue.stale_jobs.checked_count',
              sweep.checkedCount,
            ),
            Effect.annotateLogs(
              'queue.stale_jobs.affected_count',
              sweep.affectedCount,
            ),
          );
        })
      : Effect.void;

const processAiRunJob = (
  job: Job<RunJobPayload>,
  publishEvent: PublishEvent | undefined,
) =>
  Effect.gen(function* () {
    const payload = yield* decodePayload(job);

    yield* Effect.sync(() => {
      emitRunStarted(publishEvent, payload.userId, job.id);
      emitRunProgress(
        publishEvent,
        payload.userId,
        job.id,
        'planning',
        20,
        'Preparing run context',
      );
    });

    const llm = yield* LLM;

    yield* Effect.sync(() =>
      emitRunProgress(
        publishEvent,
        payload.userId,
        job.id,
        'generating',
        60,
        'Generating structured output',
      ),
    );

    const generation = yield* llm.generate({
      system: runSystemPrompt,
      prompt: payload.prompt,
      schema: RunResultSchema,
      maxTokens: 900,
      temperature: 0.35,
    });

    yield* Effect.sync(() =>
      emitRunProgress(
        publishEvent,
        payload.userId,
        job.id,
        'finalizing',
        90,
        'Finalizing run result',
      ),
    );

    return generation.object;
  }).pipe(Effect.mapError((error) => toProcessingError(job.id, error)));

export function createUnifiedWorker(config: UnifiedWorkerConfig): Worker {
  const processJob = (job: Job<RunJobPayload>) => {
    if (job.type !== JobType.PROCESS_AI_RUN) {
      return Effect.fail(
        new JobProcessingError({
          jobId: job.id,
          message: `Unsupported job type: ${job.type}`,
        }),
      );
    }

    return processAiRunJob(job, config.publishEvent);
  };

  const onStart = () =>
    Effect.logInfo(
      `UnifiedWorker started. Registered job types: ${JOB_TYPES.join(', ')}`,
    );

  const onJobComplete = (job: Job<RunJobPayload>) => {
    if (job.type !== JobType.PROCESS_AI_RUN) return Effect.void;

    const userId =
      typeof job.payload?.userId === 'string' && job.payload.userId.length > 0
        ? job.payload.userId
        : job.createdBy;

    if (job.status === JobStatus.COMPLETED) {
      return handleCompletedRun(config.publishEvent, userId, job);
    }

    if (job.status === JobStatus.FAILED) {
      return Effect.sync(() =>
        emitRunFailed(
          config.publishEvent,
          userId,
          job.id,
          job.error ?? 'Run failed',
        ),
      );
    }

    return Effect.void;
  };

  return createWorker({
    name: 'UnifiedWorker',
    jobTypes: JOB_TYPES,
    config,
    processJob,
    onStart,
    onPollCycle: createStaleJobReaper(),
    onJobComplete,
  });
}
