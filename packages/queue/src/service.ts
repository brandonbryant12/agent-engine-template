import { Context } from 'effect';
import type {
  QueueError,
  JobNotFoundError,
  JobProcessingError,
} from './errors';
import type {
  GetJobsByUserOptions,
  Job,
  JobPayload,
  JobType,
  JobStatus,
  StaleJobSweepResult,
  TypedJob,
} from './types';
import type { JobId } from '@repo/db/schema';
import type { Effect } from 'effect';

export interface EnqueueOptions {
  readonly idempotencyKey?: string | null;
}

export interface QueueService {
  readonly enqueue: <TType extends JobType>(
    type: TType,
    payload: JobPayload<TType>,
    userId: string,
    options?: EnqueueOptions,
  ) => Effect.Effect<TypedJob<TType>, QueueError>;

  readonly getJob: (
    jobId: JobId,
  ) => Effect.Effect<Job, QueueError | JobNotFoundError>;

  readonly getJobsByUser: <TType extends JobType = JobType>(
    userId: string,
    options?: GetJobsByUserOptions<TType>,
  ) => Effect.Effect<TypedJob<TType>[], QueueError>;

  readonly updateJobStatus: (
    jobId: JobId,
    status: JobStatus,
    result?: unknown,
    error?: string,
  ) => Effect.Effect<Job, QueueError | JobNotFoundError>;

  /**
   * Claims one pending job and runs the handler.
   * Handler failures are persisted as FAILED job status and returned as updated rows.
   */
  readonly processNextJob: <TType extends JobType, R = never>(
    type: TType,
    handler: (
      job: TypedJob<TType>,
    ) => Effect.Effect<unknown, JobProcessingError, R>,
  ) => Effect.Effect<
    TypedJob<TType> | null,
    QueueError | JobNotFoundError,
    R
  >;

  readonly processJobById: <R = never>(
    jobId: JobId,
    handler: (job: Job) => Effect.Effect<unknown, JobProcessingError, R>,
  ) => Effect.Effect<
    Job,
    QueueError | JobProcessingError | JobNotFoundError,
    R
  >;

  readonly claimNextJob: <TType extends JobType>(
    type: TType,
  ) => Effect.Effect<TypedJob<TType> | null, QueueError>;

  readonly deleteJob: (
    jobId: JobId,
  ) => Effect.Effect<void, QueueError | JobNotFoundError>;

  readonly failStaleJobs: (
    maxAgeMs: number,
  ) => Effect.Effect<StaleJobSweepResult, QueueError>;
}

export class Queue extends Context.Tag('@repo/queue/Queue')<
  Queue,
  QueueService
>() {}
