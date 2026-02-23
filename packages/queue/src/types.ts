import type {
  JobId,
  JobStatus as DbJobStatus,
} from '@repo/db/schema';

export type JobStatus = DbJobStatus;

export const QueueJobType = {
  PROCESS_AI_RUN: 'process-ai-run',
} as const;

export type JobType = (typeof QueueJobType)[keyof typeof QueueJobType];

export interface Job<TPayload = unknown, TResult = unknown> {
  readonly id: JobId;
  readonly type: JobType;
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
