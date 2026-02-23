import { JobType as DbJobType } from '@repo/db/schema';
import type {
  JobId,
  JobStatus as DbJobStatus,
} from '@repo/db/schema';

export type JobStatus = DbJobStatus;

export const QueueJobType = DbJobType;

export type JobType = (typeof QueueJobType)[keyof typeof QueueJobType];
export type JobSortOrder = 'asc' | 'desc';

export interface ProcessAiRunPayload {
  readonly userId: string;
  readonly prompt: string;
  readonly threadId?: string | null;
}

export interface ProcessAiRunResult {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly nextActions: readonly string[];
}

export type QueueJobMap = {
  readonly [QueueJobType.PROCESS_AI_RUN]: {
    readonly payload: ProcessAiRunPayload;
    readonly result: ProcessAiRunResult;
  };
};

type MissingQueueJobMapEntries = Exclude<JobType, keyof QueueJobMap>;
type ExtraQueueJobMapEntries = Exclude<keyof QueueJobMap, JobType>;

type Assert<T extends true> = T;

export type QueueJobMapCoversAllJobTypes = Assert<
  MissingQueueJobMapEntries extends never ? true : false
>;
export type QueueJobMapHasNoExtraJobTypes = Assert<
  ExtraQueueJobMapEntries extends never ? true : false
>;

export type JobPayload<TType extends JobType> = QueueJobMap[TType]['payload'];
export type JobResult<TType extends JobType> = QueueJobMap[TType]['result'];

export interface GetJobsByUserOptions<TType extends JobType = JobType> {
  readonly type?: TType;
  readonly limit?: number;
  readonly sortByCreatedAt?: JobSortOrder;
}

export interface Job<
  TPayload = unknown,
  TResult = unknown,
  TType extends JobType = JobType,
> {
  readonly id: JobId;
  readonly type: TType;
  readonly status: JobStatus;
  readonly payload: TPayload;
  readonly result: TResult | null;
  readonly error: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export type TypedJob<TType extends JobType> = Job<
  JobPayload<TType>,
  JobResult<TType>,
  TType
>;

export interface StaleJobSweepResult {
  readonly checkedCount: number;
  readonly affectedCount: number;
  readonly jobs: readonly Job[];
}
