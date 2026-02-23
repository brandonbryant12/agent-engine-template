import { LLM } from '@repo/ai';
import { type RunResult, RunResultSchema } from '@repo/api/contracts';
import { JobStatus, JobType } from '@repo/db/schema';
import {
  JobProcessingError,
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

const logRunResultDecodeFailure = (jobId: string, parseErrorSummary: string) => {
  Effect.runSync(
    Effect.logWarning('run.result.decode_failed').pipe(
      Effect.annotateLogs('queue.job.id', jobId),
      Effect.annotateLogs('source.path', RUN_RESULT_DECODE_SOURCE_PATH),
      Effect.annotateLogs('parse.error.summary', parseErrorSummary),
    ),
  );
};

export const handleCompletedRun = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  job: Job<RunJobPayload>,
): void => {
  const parsed = parseRunResult(job.result);

  if (parsed.result) {
    emitRunCompleted(publishEvent, userId, job.id, parsed.result);
    return;
  }

  if (parsed.parseErrorSummary) {
    logRunResultDecodeFailure(job.id, parsed.parseErrorSummary);
  }

  emitRunFailed(publishEvent, userId, job.id, INVALID_COMPLETED_RUN_RESULT_ERROR);
};

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
    if (job.type !== JobType.PROCESS_AI_RUN) return;

    const userId =
      typeof job.payload?.userId === 'string' && job.payload.userId.length > 0
        ? job.payload.userId
        : job.createdBy;

    if (job.status === JobStatus.COMPLETED) {
      handleCompletedRun(config.publishEvent, userId, job);
      return;
    }

    if (job.status === JobStatus.FAILED) {
      emitRunFailed(
        config.publishEvent,
        userId,
        job.id,
        job.error ?? 'Run failed',
      );
    }
  };

  return createWorker({
    name: 'UnifiedWorker',
    jobTypes: JOB_TYPES,
    config,
    processJob,
    onStart,
    onJobComplete,
  });
}
