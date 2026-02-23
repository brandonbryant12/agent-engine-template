import { JobStatus, JobType } from '@repo/db/schema';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult, SSEEvent } from '@repo/api/contracts';
import type { Job } from '@repo/queue';
import {
  handleCompletedRun,
  INVALID_COMPLETED_RUN_RESULT_ERROR,
} from '../unified-worker';

type RunJobPayload = {
  userId?: unknown;
  prompt?: unknown;
  threadId?: unknown;
};

const createJob = (
  overrides: Partial<Job<RunJobPayload>> = {},
): Job<RunJobPayload> => ({
  id: 'job_test' as Job['id'],
  type: JobType.PROCESS_AI_RUN,
  status: JobStatus.COMPLETED,
  payload: {
    userId: 'user_test',
    prompt: 'Plan project',
    threadId: null,
  },
  result: null,
  error: null,
  createdBy: 'user_test',
  createdAt: new Date('2026-02-23T00:00:00.000Z'),
  updatedAt: new Date('2026-02-23T00:00:00.000Z'),
  startedAt: new Date('2026-02-23T00:00:01.000Z'),
  completedAt: new Date('2026-02-23T00:00:02.000Z'),
  ...overrides,
});

describe('handleCompletedRun', () => {
  it('emits run_completed for valid run results', () => {
    const publishEvent = vi.fn<(userId: string, event: SSEEvent) => void>();
    const result: RunResult = {
      title: 'Title',
      summary: 'Summary',
      keyPoints: ['A', 'B'],
      nextActions: ['C'],
    };

    handleCompletedRun(
      publishEvent,
      'user_test',
      createJob({
        result,
      }),
    );

    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith(
      'user_test',
      expect.objectContaining({
        type: 'run_completed',
        runId: 'job_test',
        result,
      }),
    );
  });

  it('emits run_failed for completed jobs with invalid result payload', () => {
    const publishEvent = vi.fn<(userId: string, event: SSEEvent) => void>();

    handleCompletedRun(
      publishEvent,
      'user_test',
      createJob({
        result: { nope: 'invalid' },
      }),
    );

    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith(
      'user_test',
      expect.objectContaining({
        type: 'run_failed',
        runId: 'job_test',
        error: INVALID_COMPLETED_RUN_RESULT_ERROR,
      }),
    );
  });
});
