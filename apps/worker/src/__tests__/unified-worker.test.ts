import { JobStatus, JobType } from '@repo/db/schema';
import { Queue, QueueError, type Job, type QueueService } from '@repo/queue';
import { Effect, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult, SSEEvent } from '@repo/api/contracts';
import {
  STALE_CHECK_EVERY_N_POLLS,
  STALE_JOB_MAX_AGE_MS,
} from '../constants';
import {
  createStaleJobReaper,
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

const createMockQueueService = (
  overrides: Partial<QueueService> = {},
): QueueService => ({
  enqueue: () => Effect.die('enqueue not mocked'),
  getJob: () => Effect.die('getJob not mocked'),
  getJobsByUser: () => Effect.die('getJobsByUser not mocked'),
  updateJobStatus: () => Effect.die('updateJobStatus not mocked'),
  processNextJob: () => Effect.die('processNextJob not mocked'),
  processJobById: () => Effect.die('processJobById not mocked'),
  claimNextJob: () => Effect.die('claimNextJob not mocked'),
  deleteJob: () => Effect.die('deleteJob not mocked'),
  failStaleJobs: () => Effect.die('failStaleJobs not mocked'),
  ...overrides,
});

const withQueue = (queue: QueueService) =>
  Effect.provide(Layer.succeed(Queue, queue));

describe('handleCompletedRun', () => {
  it('emits run_completed for valid run results', async () => {
    const publishEvent = vi.fn<(userId: string, event: SSEEvent) => void>();
    const result: RunResult = {
      title: 'Title',
      summary: 'Summary',
      keyPoints: ['A', 'B'],
      nextActions: ['C'],
    };

    await Effect.runPromise(
      handleCompletedRun(
        publishEvent,
        'user_test',
        createJob({
          result,
        }),
      ),
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

  it('emits run_failed for completed jobs with invalid result payload', async () => {
    const publishEvent = vi.fn<(userId: string, event: SSEEvent) => void>();

    await Effect.runPromise(
      handleCompletedRun(
        publishEvent,
        'user_test',
        createJob({
          result: { nope: 'invalid' },
        }),
      ),
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

describe('createStaleJobReaper', () => {
  it('skips stale checks before the configured poll cadence', async () => {
    let failStaleJobsCalls = 0;
    const queue = createMockQueueService({
      failStaleJobs: () => {
        failStaleJobsCalls += 1;
        return Effect.succeed({
          checkedCount: 0,
          affectedCount: 0,
          jobs: [],
        });
      },
    });

    await Effect.runPromise(
      createStaleJobReaper()(STALE_CHECK_EVERY_N_POLLS - 1).pipe(withQueue(queue)),
    );

    expect(failStaleJobsCalls).toBe(0);
  });

  it('runs stale checks on cadence using default max-age configuration', async () => {
    let receivedMaxAgeMs: number | null = null;
    const queue = createMockQueueService({
      failStaleJobs: (maxAgeMs) => {
        receivedMaxAgeMs = maxAgeMs;
        return Effect.succeed({
          checkedCount: 2,
          affectedCount: 1,
          jobs: [
            createJob({
              status: JobStatus.FAILED,
              error: 'Job timed out: worker did not complete within 3600s',
            }),
          ],
        });
      },
    });

    await Effect.runPromise(
      createStaleJobReaper()(STALE_CHECK_EVERY_N_POLLS).pipe(withQueue(queue)),
    );

    expect(receivedMaxAgeMs).toBe(STALE_JOB_MAX_AGE_MS);
  });

  it('swallows queue failures so worker polling can continue', async () => {
    let failStaleJobsCalls = 0;
    const queue = createMockQueueService({
      failStaleJobs: () => {
        failStaleJobsCalls += 1;
        return Effect.fail(new QueueError({ message: 'queue unavailable' }));
      },
    });

    await expect(
      Effect.runPromise(
        createStaleJobReaper()(STALE_CHECK_EVERY_N_POLLS).pipe(withQueue(queue)),
      ),
    ).resolves.toBeUndefined();

    expect(failStaleJobsCalls).toBe(1);
  });
});
