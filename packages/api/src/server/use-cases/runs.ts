import {
  ForbiddenError,
  Role,
  type User,
  withCurrentUser,
} from '@repo/auth';
import {
  Queue,
  QueueJobType,
  formatError,
  type JobPayload,
  type TypedJob,
} from '@repo/queue';
import { Cause, Effect, Schedule, Schema } from 'effect';
import {
  RunResultSchema,
  type CreateRunInput,
  type RunOutput,
  type RunResult,
} from '../../contracts/runs';
import {
  SSEPublisher,
  type SSEPublisherService,
} from '../sse-publisher-service';

type RunJob = TypedJob<typeof QueueJobType.PROCESS_AI_RUN>;
type RunPayload = JobPayload<typeof QueueJobType.PROCESS_AI_RUN>;

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
const AUTHORIZATION_SOURCE_PATH =
  'packages/api/src/server/use-cases/runs.ts:authorizeRunUseCaseUser';
const RUN_PUBLISH_SOURCE_PATH =
  'packages/api/src/server/use-cases/runs.ts:publishQueuedRunEvent';
const RUN_CREATE_IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;
const RUN_CREATE_IDEMPOTENCY_RECENT_LIMIT = 25;
const RUN_CREATE_EVENT_PUBLISH_RETRY_SCHEDULE = Schedule.intersect(
  Schedule.exponential('100 millis'),
  Schedule.recurs(3),
);

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const normalizePrompt = (value: string): string => value.trim();
const normalizeThreadId = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toCreateRunIdempotencyKey = (
  userId: string,
  prompt: string,
  threadId: string | null,
): string => `${userId}:${prompt}:${threadId ?? ''}`;

const isRetryableRunStatus = (status: RunJob['status']): boolean =>
  status === 'pending' || status === 'processing' || status === 'completed';

const isRunInsideIdempotencyWindow = (
  createdAt: Date,
  nowMs: number,
): boolean => nowMs - createdAt.getTime() <= RUN_CREATE_IDEMPOTENCY_WINDOW_MS;

const payloadMatchesIdempotencyKey = (
  payload: RunPayload,
  idempotencyKey: string,
): boolean => payload.idempotencyKey === idempotencyKey;

const payloadMatchesLegacyCreateInputs = (
  payload: RunPayload,
  prompt: string,
  threadId: string | null,
): boolean =>
  normalizePrompt(payload.prompt) === prompt &&
  normalizeThreadId(payload.threadId) === threadId;

const findIdempotentRun = (
  runs: readonly RunJob[],
  nowMs: number,
  idempotencyKey: string,
  prompt: string,
  threadId: string | null,
): RunJob | null =>
  runs.find((run) => {
    if (!isRetryableRunStatus(run.status)) return false;
    if (!isRunInsideIdempotencyWindow(run.createdAt, nowMs)) return false;

    const payload = run.payload as RunPayload;
    return (
      payloadMatchesIdempotencyKey(payload, idempotencyKey) ||
      payloadMatchesLegacyCreateInputs(payload, prompt, threadId)
    );
  }) ?? null;

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

const publishQueuedRunEvent = ({
  publisher,
  userId,
  runId,
  prompt,
  threadId,
}: {
  readonly publisher: SSEPublisherService;
  readonly userId: string;
  readonly runId: string;
  readonly prompt: string;
  readonly threadId: string | null;
}) =>
  Effect.gen(function* () {
    const publishWithRetry = publisher
      .publish(userId, {
        type: 'run_queued',
        runId,
        prompt,
        threadId,
        timestamp: new Date().toISOString(),
      })
      .pipe(
        Effect.catchAllCause((cause) => Effect.fail(cause)),
        Effect.tapError((cause) =>
          Effect.logWarning('runs.create.publish_retry').pipe(
            Effect.annotateLogs('source.path', RUN_PUBLISH_SOURCE_PATH),
            Effect.annotateLogs('enduser.id', userId),
            Effect.annotateLogs('queue.job.id', runId),
            Effect.annotateLogs('error.cause', Cause.pretty(cause)),
          ),
        ),
        Effect.retry(RUN_CREATE_EVENT_PUBLISH_RETRY_SCHEDULE),
        Effect.catchAll((cause) =>
          Effect.logWarning('runs.create.publish_failed').pipe(
            Effect.annotateLogs('source.path', RUN_PUBLISH_SOURCE_PATH),
            Effect.annotateLogs('enduser.id', userId),
            Effect.annotateLogs('queue.job.id', runId),
            Effect.annotateLogs('error.cause', Cause.pretty(cause)),
          ),
        ),
      );

    yield* Effect.forkDaemon(publishWithRetry);
  });

const authorizeRunUseCaseUser = (user: User): Effect.Effect<void, ForbiddenError> =>
  withCurrentUser(user)(
    Effect.gen(function* () {
      if (user.role !== Role.USER && user.role !== Role.ADMIN) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: 'Requires user or admin role',
          }),
        );
      }

      return;
    }),
  ).pipe(Effect.withSpan('runs.authorizeUser'));

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
    yield* authorizeRunUseCaseUser(user).pipe(
      Effect.annotateLogs('source.path', AUTHORIZATION_SOURCE_PATH),
    );

    const queue = yield* Queue;
    const publisher = yield* SSEPublisher;
    const normalizedPrompt = normalizePrompt(input.prompt);
    const normalizedThreadId = normalizeThreadId(input.threadId ?? null);
    const idempotencyKey = toCreateRunIdempotencyKey(
      user.id,
      normalizedPrompt,
      normalizedThreadId,
    );
    const nowMs = Date.now();
    const recentRuns = yield* queue
      .getJobsByUser(user.id, {
        type: QueueJobType.PROCESS_AI_RUN,
        sortByCreatedAt: 'desc',
        limit: RUN_CREATE_IDEMPOTENCY_RECENT_LIMIT,
      })
      .pipe(
        Effect.catchAll(() => Effect.succeed([] as RunJob[])),
        Effect.catchAllCause(() => Effect.succeed([] as RunJob[])),
      );
    const existingRun = findIdempotentRun(
      recentRuns,
      nowMs,
      idempotencyKey,
      normalizedPrompt,
      normalizedThreadId,
    );

    if (existingRun) {
      return yield* toRunOutput(existingRun, CREATE_RUN_SOURCE_PATH);
    }

    const created = yield* queue.enqueue(
      QueueJobType.PROCESS_AI_RUN,
      {
        prompt: normalizedPrompt,
        threadId: normalizedThreadId,
        userId: user.id,
        idempotencyKey,
      },
      user.id,
      {
        idempotencyKey: input.idempotencyKey,
      },
    );

    const run = yield* toRunOutput(
      created,
      CREATE_RUN_SOURCE_PATH,
    );

    yield* publishQueuedRunEvent({
      publisher,
      userId: user.id,
      runId: run.id,
      prompt: run.prompt,
      threadId: run.threadId,
    });

    return run;
  });

export const listRunsUseCase = ({ user, input }: ListRunsUseCaseInput) =>
  Effect.gen(function* () {
    yield* authorizeRunUseCaseUser(user).pipe(
      Effect.annotateLogs('source.path', AUTHORIZATION_SOURCE_PATH),
    );

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
