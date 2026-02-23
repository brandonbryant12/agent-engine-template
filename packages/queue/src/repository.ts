import { eq, and, asc, sql } from '@repo/db';
import { Db, withDb } from '@repo/db/effect';
import { job, JobStatus } from '@repo/db/schema';
import { Effect, Layer } from 'effect';
import type { Job, JobType } from './types';
import type { DatabaseInstance } from '@repo/db/client';
import { QueueError, JobNotFoundError, JobProcessingError } from './errors';
import { Queue, type QueueService } from './service';

type JobRow = typeof job.$inferSelect;

const mapRowToJob = (row: JobRow): Job => ({
  ...row,
  type: row.type as JobType,
  payload: row.payload ?? {},
});

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

  /** Run handler then mark completed or failed. Assumes job is already PROCESSING. */
  const runHandler = <R>(
    claimed: Job,
    handler: (job: Job) => Effect.Effect<unknown, JobProcessingError, R>,
  ) =>
    handler(claimed).pipe(
      Effect.flatMap((result) =>
        updateJobStatus(claimed.id, JobStatus.COMPLETED, result),
      ),
      Effect.catchAll((err) =>
        updateJobStatus(
          claimed.id,
          JobStatus.FAILED,
          undefined,
          err instanceof JobProcessingError ? err.message : String(err),
        ),
      ),
      Effect.catchAllDefect((defect) =>
        updateJobStatus(
          claimed.id,
          JobStatus.FAILED,
          undefined,
          `Unexpected defect: ${defect instanceof Error ? defect.message : String(defect)}`,
        ),
      ),
    );

  const enqueue: QueueService['enqueue'] = (type, payload, userId) =>
    runQuery(
      'enqueue',
      async (db) => {
        const [row] = await db
          .insert(job)
          .values({
            type,
            payload: payload as Record<string, unknown>,
            createdBy: userId,
          })
          .returning();

        if (!row) throw new Error('Failed to insert job');

        return mapRowToJob(row);
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

  const getJobsByUser: QueueService['getJobsByUser'] = (userId, type) =>
    runQuery(
      'getJobsByUser',
      async (db) => {
        const conditions = [eq(job.createdBy, userId)];
        if (type) conditions.push(eq(job.type, type));

        const rows = await db
          .select()
          .from(job)
          .where(and(...conditions))
          .orderBy(asc(job.createdAt));

        return rows.map(mapRowToJob);
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

  const claimNextJob = (type: JobType): Effect.Effect<Job | null, QueueError> =>
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
        return row ? mapRowToJob(row as JobRow) : null;
      },
      'Failed to claim next job',
    ).pipe(
      Effect.tap(() => Effect.annotateCurrentSpan('queue.job.type', type)),
    );

  const processNextJob: QueueService['processNextJob'] = (type, handler) =>
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
          Effect.flatMap((updatedJob) => runHandler(updatedJob, handler)),
        );
      }),
    );

  const failStaleJobs: QueueService['failStaleJobs'] = (maxAgeMs) =>
    runQuery(
      'failStaleJobs',
      async (db) => {
        const intervalSeconds = Math.floor(maxAgeMs / 1000);
        const result = await db.execute(sql`
          UPDATE ${job}
          SET "status" = ${JobStatus.FAILED},
              "error" = ${'Job timed out: worker did not complete within ' + intervalSeconds + 's'},
              "completedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE ${job.status} = ${JobStatus.PROCESSING}
            AND ${job.startedAt} < NOW() - INTERVAL '${sql.raw(String(intervalSeconds))} seconds'
          RETURNING *
        `);

        return (result.rows as JobRow[]).map(mapRowToJob);
      },
      'Failed to fail stale jobs',
    ).pipe(
      Effect.tap((jobs) =>
        Effect.annotateCurrentSpan('queue.stale_jobs.count', jobs.length),
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
