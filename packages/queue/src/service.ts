import { Context } from 'effect';
import type {
  QueueError,
  JobNotFoundError,
  JobProcessingError,
} from './errors';
import type { Job, JobType, JobStatus } from './types';
import type { JobId } from '@repo/db/schema';
import type { Effect } from 'effect';

export interface QueueService {
  readonly enqueue: (
    type: JobType,
    payload: unknown,
    userId: string,
  ) => Effect.Effect<Job, QueueError>;

  readonly getJob: (
    jobId: JobId,
  ) => Effect.Effect<Job, QueueError | JobNotFoundError>;

  readonly getJobsByUser: (
    userId: string,
    type?: JobType,
  ) => Effect.Effect<Job[], QueueError>;

  readonly updateJobStatus: (
    jobId: JobId,
    status: JobStatus,
    result?: unknown,
    error?: string,
  ) => Effect.Effect<Job, QueueError | JobNotFoundError>;

  readonly processNextJob: <R = never>(
    type: JobType,
    handler: (job: Job) => Effect.Effect<unknown, JobProcessingError, R>,
  ) => Effect.Effect<
    Job | null,
    QueueError | JobProcessingError | JobNotFoundError,
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

  readonly claimNextJob: (
    type: JobType,
  ) => Effect.Effect<Job | null, QueueError>;

  readonly deleteJob: (
    jobId: JobId,
  ) => Effect.Effect<void, QueueError | JobNotFoundError>;

  readonly failStaleJobs: (
    maxAgeMs: number,
  ) => Effect.Effect<Job[], QueueError>;
}

export class Queue extends Context.Tag('@repo/queue/Queue')<
  Queue,
  QueueService
>() {}
