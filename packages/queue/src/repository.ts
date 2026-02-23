import { eq, and, asc, desc, sql } from '@repo/db';
import { Db, withDb } from '@repo/db/effect';
import { job, JobStatus } from '@repo/db/schema';
import { Effect, Layer } from 'effect';
import type {
  GetJobsByUserOptions,
  Job,
  JobPayload,
  JobResult,
  JobType,
  StaleJobSweepResult,
  TypedJob,
} from './types';
import type { DatabaseInstance } from '@repo/db/client';
import { QueueError, JobNotFoundError, JobProcessingError } from './errors';
import { Queue, type QueueService } from './service';

type JobRow = typeof job.$inferSelect;
type CountRow = { count: number | string };

const mapRowToJob = <TType extends JobType = JobType>(
  row: JobRow,
): TypedJob<TType> => ({
  ...row,
  type: row.type as TType,
  payload: (row.payload ?? {}) as unknown as JobPayload<TType>,
  result: (row.result ?? null) as JobResult<TType> | null,
});

const intervalSecondsFromMs = (maxAgeMs: number): number =>
  Math.max(1, Math.floor(maxAgeMs / 1000));

export const toStaleJobTimeoutError = (maxAgeMs: number): string =>
  `Job timed out: worker did not complete within ${intervalSecondsFromMs(maxAgeMs)}s`;

const makeQueueService = Effect.gen(function* () {
  const { db } = yield* Db;

  const runQuery = <A>(
    name: string,
    fn: (db: DatabaseInstance) => Promise<A>,
    errorMessage: string,
  ): Effect.Effect<A, QueueError> =>
    withDb(`queue.${name}`, fn).pipe(
      Effect.provideService(Db, { db }),
      Effect.mapError(
        (cause) =>
          new QueueError({
            message: `${errorMessage}: ${cause.message}`,
            cause,
          }),
      ),
      Effect.withSpan(`queue.${name}`, {
        attributes: { 'queue.system': 'database' },
      }),
    );

  const castTypedJob = <TType extends JobType>(updated: Job): TypedJob<TType> =>
    updated as TypedJob<TType>;

  /** Run handler then mark completed or failed. Assumes job is already PROCESSING. */
  const runHandler = <TType extends JobType, R>(
    claimed: TypedJob<TType>,
    handler: (
      job: TypedJob<TType>,
    ) => Effect.Effect<unknown, JobProcessingError, R>,
  ) =>
    handler(claimed).pipe(
      Effect.flatMap((result) =>
        updateJobStatus(claimed.id, JobStatus.COMPLETED, result).pipe(
          Effect.map(castTypedJob<TType>),
        ),
      ),
      Effect.catchAll((err) =>
        updateJobStatus(
          claimed.id,
          JobStatus.FAILED,
          undefined,
          err instanceof JobProcessingError ? err.message : String(err),
        ).pipe(Effect.map(castTypedJob<TType>)),
      ),
      Effect.catchAllDefect((defect) =>
        updateJobStatus(
          claimed.id,
          JobStatus.FAILED,
          undefined,
          `Unexpected defect: ${defect instanceof Error ? defect.message : String(defect)}`,
        ).pipe(Effect.map(castTypedJob<TType>)),
      ),
    );

  const enqueue = <TType extends JobType>(
    type: TType,
    payload: JobPayload<TType>,
    userId: string,
  ): Effect.Effect<TypedJob<TType>, QueueError> =>
    runQuery(
      'enqueue',
      async (db) => {
        const [row] = await db
          .insert(job)
          .values({
            type,
            payload: payload as unknown as Record<string, unknown>,
            createdBy: userId,
          })
          .returning();

        if (!row) throw new Error('Failed to insert job');

        return mapRowToJob<TType>(row);
      },
      'Failed to enqueue job',
    ).pipe(
      Effect.tap((j) =>
        Effect.annotateCurrentSpan({
          'queue.job.id': j.id,
          'queue.job.type': type,
          'queue.user.id': userId,
        }),
      ),
    );

  const getJob: QueueService['getJob'] = (jobId) =>
    runQuery(
      'getJob',
      async (db) => {
        const [row] = await db
          .select()
          .from(job)
          .where(eq(job.id, jobId))
          .limit(1);
        return row;
      },
      'Failed to get job',
    ).pipe(
      Effect.tap(() => Effect.annotateCurrentSpan('queue.job.id', jobId)),
      Effect.flatMap((row) =>
        row
          ? Effect.succeed(mapRowToJob(row))
          : Effect.fail(new JobNotFoundError({ jobId })),
      ),
    );

  const getJobsByUser = <TType extends JobType = JobType>(
    userId: string,
    options?: GetJobsByUserOptions<TType>,
  ): Effect.Effect<TypedJob<TType>[], QueueError> =>
    runQuery(
      'getJobsByUser',
      async (db) => {
        const {
          type,
          limit,
          sortByCreatedAt = 'asc' as const,
        } = options ?? {};
        const conditions = [eq(job.createdBy, userId)];
        if (type) conditions.push(eq(job.type, type));

        const orderedQuery = db
          .select()
          .from(job)
          .where(and(...conditions))
          .orderBy(
            sortByCreatedAt === 'desc' ? desc(job.createdAt) : asc(job.createdAt),
          );

        const rows =
          typeof limit === 'number'
            ? await orderedQuery.limit(limit)
            : await orderedQuery;

        return rows.map((row) => mapRowToJob<TType>(row));
      },
      'Failed to get jobs',
    ).pipe(
      Effect.tap(() => Effect.annotateCurrentSpan('queue.user.id', userId)),
    );

  const updateJobStatus: QueueService['updateJobStatus'] = (
    jobId,
    status,
    result,
    error,
  ) =>
    runQuery(
      'updateJobStatus',
      async (db) => {
        const updates: Record<string, unknown> = {
          status,
          updatedAt: new Date(),
        };

        if (status === JobStatus.PROCESSING) {
          updates.startedAt = new Date();
        }
        if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
          updates.completedAt = new Date();
        }
        if (result !== undefined) {
          updates.result = result as Record<string, unknown>;
        }
        if (error !== undefined) {
          updates.error = error;
        }

        const [row] = await db
          .update(job)
          .set(updates)
          .where(eq(job.id, jobId))
          .returning();

        return row;
      },
      'Failed to update job',
    ).pipe(
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          'queue.job.id': jobId,
          'queue.job.status': status,
        }),
      ),
      Effect.flatMap((row) =>
        row
          ? Effect.succeed(mapRowToJob(row))
          : Effect.fail(new JobNotFoundError({ jobId })),
      ),
    );

  const claimNextJob = <TType extends JobType>(
    type: TType,
  ): Effect.Effect<TypedJob<TType> | null, QueueError> =>
    runQuery(
      'claimNextJob',
      async (db) => {
        const result = await db.execute(sql`
          UPDATE ${job}
          SET "status" = ${JobStatus.PROCESSING},
              "startedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE ${job.id} = (
            SELECT ${job.id} FROM ${job}
            WHERE ${job.type} = ${type}
              AND ${job.status} = ${JobStatus.PENDING}
            ORDER BY ${job.createdAt} ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING *
        `);

        const row = result.rows[0];
        return row ? mapRowToJob<TType>(row as JobRow) : null;
      },
      'Failed to claim next job',
    ).pipe(
      Effect.tap(() => Effect.annotateCurrentSpan('queue.job.type', type)),
    );

  const processNextJob = <TType extends JobType, R = never>(
    type: TType,
    handler: (
      job: TypedJob<TType>,
    ) => Effect.Effect<unknown, JobProcessingError, R>,
  ): Effect.Effect<
    TypedJob<TType> | null,
    QueueError | JobProcessingError | JobNotFoundError,
    R
  > =>
    claimNextJob(type).pipe(
      Effect.flatMap((claimed) =>
        claimed ? runHandler(claimed, handler) : Effect.succeed(null),
      ),
    );

  const processJobById: QueueService['processJobById'] = (jobId, handler) =>
    getJob(jobId).pipe(
      Effect.flatMap((jobData) => {
        if (jobData.status !== JobStatus.PENDING)
          return Effect.succeed(jobData);
        return updateJobStatus(jobData.id, JobStatus.PROCESSING).pipe(
          Effect.flatMap((updatedJob) =>
            runHandler(
              updatedJob as TypedJob<JobType>,
              handler as (
                job: TypedJob<JobType>,
              ) => Effect.Effect<unknown, JobProcessingError>,
            ),
          ),
          Effect.map((updatedJob) => updatedJob as Job),
        );
      }),
    );

  const failStaleJobs = (
    maxAgeMs: number,
  ): Effect.Effect<StaleJobSweepResult, QueueError> =>
    runQuery(
      'failStaleJobs',
      async (db) => {
        const intervalSeconds = intervalSecondsFromMs(maxAgeMs);
        const timeoutError = toStaleJobTimeoutError(maxAgeMs);
        const staleCondition = sql`${job.status} = ${JobStatus.PROCESSING}
          AND ${job.startedAt} < NOW() - INTERVAL '${sql.raw(String(intervalSeconds))} seconds'`;

        const countResult = await db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM ${job}
          WHERE ${staleCondition}
        `);

        const checkedCount = Number(
          (countResult.rows[0] as CountRow | undefined)?.count ?? 0,
        );

        const result = await db.execute(sql`
          UPDATE ${job}
          SET "status" = ${JobStatus.FAILED},
              "error" = ${timeoutError},
              "completedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE ${staleCondition}
          RETURNING *
        `);

        const jobs = (result.rows as JobRow[]).map((row) => mapRowToJob(row));

        return {
          checkedCount,
          affectedCount: jobs.length,
          jobs,
        } satisfies StaleJobSweepResult;
      },
      'Failed to fail stale jobs',
    ).pipe(
      Effect.tap((sweep) =>
        Effect.annotateCurrentSpan({
          'queue.stale_jobs.checked_count': sweep.checkedCount,
          'queue.stale_jobs.affected_count': sweep.affectedCount,
        }),
      ),
    );

  const deleteJob: QueueService['deleteJob'] = (jobId) =>
    runQuery(
      'deleteJob',
      async (db) => {
        const result = await db
          .delete(job)
          .where(eq(job.id, jobId))
          .returning({ id: job.id });

        return result.length > 0;
      },
      'Failed to delete job',
    ).pipe(
      Effect.tap(() => Effect.annotateCurrentSpan('queue.job.id', jobId)),
      Effect.flatMap((deleted) =>
        deleted ? Effect.void : Effect.fail(new JobNotFoundError({ jobId })),
      ),
    );

  return {
    enqueue,
    getJob,
    getJobsByUser,
    updateJobStatus,
    claimNextJob,
    processNextJob,
    processJobById,
    deleteJob,
    failStaleJobs,
  } satisfies QueueService;
});

export const QueueLive: Layer.Layer<Queue, never, Db> = Layer.effect(
  Queue,
  makeQueueService,
);
