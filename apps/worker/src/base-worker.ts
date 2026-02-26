import {
  createServerRuntime,
  type StorageConfig,
  type ServerRuntime,
  type SharedServices,
} from '@repo/api/server';
import { Role, type User } from '@repo/auth/policy';
import { createDb } from '@repo/db/client';
import { JobStatus, type JobId } from '@repo/db/schema';
import {
  Queue,
  JobProcessingError,
  formatError,
  type QueueService,
  type Job,
  type JobType,
} from '@repo/queue';
import { Deferred, Effect, Exit, Fiber, Ref, Schedule, Scope } from 'effect';
import type { CloseableScope, Scope as ScopeType } from 'effect/Scope';
import { WORKER_DEFAULTS, MAX_CONCURRENT_JOBS } from './constants';

export interface BaseWorkerConfig {
  pollInterval?: number;
  maxConsecutiveErrors?: number;
  maxConcurrent?: number;
  runtime?: ServerRuntime;
  databaseUrl?: string;
  geminiApiKey?: string;
  storageConfig?: StorageConfig;
  useMockAI?: boolean;
}

export interface Worker {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  processJobById: (jobId: string) => Promise<void>;
  runtime: ServerRuntime;
}

export const makeJobUser = (userId: string): User => ({
  id: userId,
  email: '',
  name: 'Worker',
  role: Role.USER,
});

export const createRetrySchedule = (
  pollInterval: number,
  maxConsecutiveErrors: number,
) =>
  Schedule.exponential(pollInterval, 2).pipe(
    Schedule.union(Schedule.spaced(WORKER_DEFAULTS.BACKOFF_CAP_MS)),
    Schedule.intersect(Schedule.recurs(maxConsecutiveErrors - 1)),
  );

const errorStack = (error: unknown): string =>
  error instanceof Error && error.stack ? error.stack : '';

export const wrapJobError = (
  jobId: string,
  error: unknown,
): JobProcessingError =>
  error instanceof JobProcessingError
    ? error
    : new JobProcessingError({
        jobId,
        message: `Unexpected error: ${formatError(error)}`,
        cause: error,
      });

const createWorkerRuntime = (
  name: string,
  config: BaseWorkerConfig,
): ServerRuntime => {
  if (config.runtime) {
    return config.runtime;
  }

  if (!config.databaseUrl || !config.storageConfig) {
    throw new Error(
      `[${name}] Either 'runtime' or 'databaseUrl' and 'storageConfig' must be provided`,
    );
  }

  if (!config.useMockAI && !config.geminiApiKey) {
    throw new Error(
      `[${name}] 'geminiApiKey' is required when useMockAI=false`,
    );
  }

  const db = createDb({ databaseUrl: config.databaseUrl });
  const runtime = createServerRuntime({
    db,
    storageConfig: config.storageConfig,
    useMockAI: config.useMockAI,
    geminiApiKey: config.geminiApiKey,
  });

  if (config.useMockAI) {
    console.warn(`[${name}] Using mock AI layers for testing`);
  }

  return runtime;
};

/**
 * Log an error or defect with its stack trace, then return null.
 * Used to swallow claim-time failures so the poll loop continues.
 */
const logAndSwallow = (label: string, error: unknown) =>
  Effect.logError(`${label}: ${formatError(error)}`).pipe(
    Effect.annotateLogs('stack', errorStack(error)),
    Effect.map(() => null),
  );

/**
 * Handle a job failure (error or defect) by marking it failed and notifying.
 * Shared between `catchAll` and `catchAllDefect` in the forked job pipeline.
 */
const handleJobFailure = <TPayload, R extends SharedServices>(
  queue: QueueService,
  job: Job,
  errorMessage: string,
  onJobComplete:
    | ((job: Job<TPayload>) => Effect.Effect<void, never, R>)
    | undefined,
) =>
  queue.updateJobStatus(job.id, JobStatus.FAILED, undefined, errorMessage).pipe(
    Effect.tap((result) =>
      Effect.logError(
        `Job ${result.type} ${result.id} failed: ${result.error ?? 'unknown error'}`,
      ),
    ),
    Effect.tap((result) =>
      onJobComplete ? onJobComplete(result as Job<TPayload>) : Effect.void,
    ),
    Effect.catchAll((updateErr) =>
      Effect.logError(
        `Failed to update job ${job.id} status to failed: ${formatError(updateErr)}`,
      ),
    ),
  );

export interface CreateWorkerOptions<
  TPayload,
  R extends SharedServices = SharedServices,
> {
  name: string;
  jobTypes: JobType[];
  config: BaseWorkerConfig;
  processJob: (
    job: Job<TPayload>,
  ) => Effect.Effect<unknown, JobProcessingError, R>;
  onJobComplete?: (
    job: Job<TPayload>,
  ) => Effect.Effect<void, never, R>;
  onPollCycle?: (
    pollCount: number,
  ) => Effect.Effect<void, never, SharedServices>;
  onStart?: () => Effect.Effect<void, never, SharedServices>;
}

export const createWorker = <
  TPayload extends { userId: string },
  R extends SharedServices = SharedServices,
>(
  options: CreateWorkerOptions<TPayload, R>,
): Worker => {
  const {
    name,
    jobTypes,
    config,
    processJob,
    onJobComplete,
    onPollCycle,
    onStart,
  } = options;
  const pollInterval = config.pollInterval ?? WORKER_DEFAULTS.POLL_INTERVAL_MS;
  const maxConsecutiveErrors =
    config.maxConsecutiveErrors ?? WORKER_DEFAULTS.MAX_CONSECUTIVE_ERRORS;
  const maxConcurrent = config.maxConcurrent ?? MAX_CONCURRENT_JOBS;

  const runtime = createWorkerRuntime(name, config);

  const IDLE_SUMMARY_INTERVAL = Math.max(1, Math.round(60_000 / pollInterval));

  let shutdownDeferred: Deferred.Deferred<void> | null = null;
  let loopFiber: Fiber.RuntimeFiber<void, unknown> | null = null;
  let activeJobsRef: Ref.Ref<number> | null = null;
  let jobScopeRef: CloseableScope | null = null;

  const claimNextJobSafely = (queue: QueueService, jobType: JobType) =>
    queue.claimNextJob(jobType).pipe(
      Effect.catchAll((err) => logAndSwallow(`Error claiming ${jobType}`, err)),
      Effect.catchAllDefect((defect) =>
        logAndSwallow(`Defect claiming ${jobType}`, defect),
      ),
    );

  const notifyJobComplete = (job: Job) =>
    onJobComplete ? onJobComplete(job as Job<TPayload>) : Effect.void;

  const closeJobScope = (scope: CloseableScope) =>
    Effect.sync(() => {
      if (jobScopeRef !== scope) return false;
      jobScopeRef = null;
      return true;
    }).pipe(
      Effect.flatMap((shouldClose) =>
        shouldClose ? Scope.close(scope, Exit.succeed(undefined)) : Effect.void,
      ),
    );

  const forkJobProcessing = (
    queue: QueueService,
    job: Job,
    activeJobs: Ref.Ref<number>,
    jobScope: ScopeType,
  ) =>
    Effect.forkIn(jobScope)(
      processJob(job as Job<TPayload>).pipe(
        Effect.flatMap((result) =>
          queue.updateJobStatus(job.id, JobStatus.COMPLETED, result),
        ),
        Effect.tap((result) =>
          Effect.logInfo(
            `Finished processing ${result.type} job ${result.id}, status: ${result.status}`,
          ),
        ),
        Effect.tap(notifyJobComplete),
        Effect.catchAll((err) =>
          handleJobFailure<TPayload, R>(
            queue,
            job,
            formatError(err),
            onJobComplete,
          ),
        ),
        Effect.catchAllDefect((defect) =>
          handleJobFailure<TPayload, R>(
            queue,
            job,
            `Unexpected defect: ${formatError(defect)}`,
            onJobComplete,
          ),
        ),
        Effect.ensuring(Ref.update(activeJobs, (n) => n - 1)),
        Effect.annotateLogs('worker', name),
        Effect.annotateLogs('job.id', job.id),
        Effect.annotateLogs('job.type', job.type),
      ),
    );

  const pollOnce = (
    idleCount: Ref.Ref<number>,
    activeJobs: Ref.Ref<number>,
    jobScope: ScopeType,
  ) =>
    Effect.gen(function* () {
      const queue = yield* Queue;
      const activeCount = yield* Ref.get(activeJobs);
      const capacity = maxConcurrent - activeCount;

      if (capacity <= 0) {
        yield* Effect.logDebug(
          `At capacity (${activeCount}/${maxConcurrent}), skipping poll`,
        );
        return null;
      }

      let claimed = 0;

      for (const jobType of jobTypes) {
        if (claimed >= capacity) break;

        const job = yield* claimNextJobSafely(queue, jobType);

        if (!job) continue;

        claimed++;
        yield* Ref.update(activeJobs, (n) => n + 1);
        yield* Ref.set(idleCount, 0);

        yield* forkJobProcessing(queue, job, activeJobs, jobScope);

        yield* Effect.logInfo(
          `Forked ${job.type} job ${job.id} (active: ${activeCount + claimed}/${maxConcurrent})`,
        );
      }

      if (claimed === 0) {
        const count = yield* Ref.updateAndGet(idleCount, (n) => n + 1);
        if (count % IDLE_SUMMARY_INTERVAL === 0) {
          yield* Effect.logInfo(
            `Idle for ${Math.round((count * pollInterval) / 1000)}s, no pending jobs`,
          );
        } else {
          yield* Effect.logDebug('No pending jobs found');
        }
      }

      return null;
    }).pipe(Effect.annotateLogs('worker', name));

  const start = async () => {
    const retrySchedule = createRetrySchedule(
      pollInterval,
      maxConsecutiveErrors,
    );

    const loop = Effect.scoped(
      Effect.gen(function* () {
        const idleCount = yield* Ref.make(0);
        const pollCount = yield* Ref.make(0);
        const activeJobs = yield* Ref.make(0);
        activeJobsRef = activeJobs;
        const jobScope = yield* Scope.make();
        jobScopeRef = jobScope;
        yield* Effect.addFinalizer(() => closeJobScope(jobScope));
        const stopSignal = yield* Deferred.make<void>();
        shutdownDeferred = stopSignal;

        yield* Effect.logInfo(
          `Starting ${name}, polling every ${pollInterval}ms`,
        );

        if (onStart) {
          yield* onStart();
        }

        yield* Effect.gen(function* () {
          yield* pollOnce(idleCount, activeJobs, jobScope).pipe(
            Effect.catchAllDefect((defect) =>
              Effect.logError(
                `${name} caught defect during poll: ${formatError(defect)}`,
              ),
            ),
          );

          const count = yield* Ref.updateAndGet(pollCount, (n) => n + 1);
          if (onPollCycle) {
            yield* onPollCycle(count);
          }
        }).pipe(
          Effect.tap(() =>
            Effect.raceFirst(
              Effect.sleep(pollInterval),
              Deferred.await(stopSignal),
            ),
          ),
          Effect.tap(() =>
            Deferred.isDone(stopSignal).pipe(
              Effect.flatMap((done) =>
                done
                  ? Effect.logInfo(`${name} received stop signal, exiting`).pipe(
                      Effect.flatMap(() => Effect.interrupt),
                    )
                  : Effect.void,
              ),
            ),
          ),
          Effect.forever,
        );
      }),
    ).pipe(
      Effect.annotateLogs('worker', name),
      Effect.tapError((error) =>
        Effect.logWarning(`${name} error, will retry...`).pipe(
          Effect.annotateLogs('error', String(error)),
        ),
      ),
      Effect.retry({
        schedule: retrySchedule,
        while: () => true,
      }),
      Effect.tapError((error) =>
        Effect.logError(
          `Too many consecutive errors (${maxConsecutiveErrors}), shutting down`,
        ).pipe(Effect.annotateLogs('error', String(error))),
      ),
    );

    const fiber = await runtime
      .runPromise(
        Effect.fork(loop).pipe(
          Effect.tap((f) =>
            Effect.sync(() => {
              loopFiber = f;
            }),
          ),
        ),
      )
      .catch((err) => {
        console.error(`[${name}] Failed to fork poll loop:`, err);
        throw err;
      });

    await runtime.runPromise(Fiber.join(fiber)).catch(() => {
      // Interruption is expected during shutdown
    });
  };

  const DRAIN_POLL_MS = 500;
  const DRAIN_TIMEOUT_MS = 30_000;

  const drainActiveJobs = (ref: Ref.Ref<number>) =>
    Effect.gen(function* () {
      const startMs = Date.now();
      let active = yield* Ref.get(ref);
      while (active > 0) {
        if (Date.now() - startMs > DRAIN_TIMEOUT_MS) {
          yield* Effect.logWarning(
            `Drain timeout after ${DRAIN_TIMEOUT_MS}ms, ${active} jobs still running`,
          );
          break;
        }
        yield* Effect.logInfo(`Draining: ${active} active job(s), waiting...`);
        yield* Effect.sleep(DRAIN_POLL_MS);
        active = yield* Ref.get(ref);
      }
      if (active === 0) {
        yield* Effect.logInfo('All active jobs drained');
      }
    }).pipe(Effect.annotateLogs('worker', name));

  const stop = async () => {
    if (shutdownDeferred) {
      await runtime.runPromise(
        Deferred.complete(shutdownDeferred, Effect.void),
      );
    }
    if (loopFiber) {
      await runtime.runPromise(Fiber.interrupt(loopFiber)).catch(() => {
        // Expected — interruption resolves with Exit.interrupt
      });
    }

    if (jobScopeRef) {
      await runtime.runPromise(closeJobScope(jobScopeRef)).catch(() => {
        // Best-effort: scope closure interrupts in-flight job fibers
      });
    }

    // Drain active jobs after interrupting job scope
    if (activeJobsRef) {
      await runtime.runPromise(drainActiveJobs(activeJobsRef)).catch(() => {
        // Best-effort drain — force timer in worker.ts is the backstop
      });
    }
  };

  const processJobById = async (jobId: string) => {
    const effect = Effect.gen(function* () {
      const queue = yield* Queue;
      const job = yield* queue.getJob(jobId as JobId);
      return yield* processJob(job as Job<TPayload>);
    });

    await runtime.runPromise(effect);
  };

  return {
    start,
    stop,
    processJobById,
    runtime,
  };
};
