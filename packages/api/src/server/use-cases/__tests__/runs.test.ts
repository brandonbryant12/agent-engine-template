import {
  Queue,
  QueueError,
  QueueJobType,
  type Job,
  type QueueService,
} from '@repo/queue';
import { Effect, Layer } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@repo/auth/policy';
import { ssePublisher } from '../../publisher';
import { createRunUseCase, listRunsUseCase } from '../runs';

const TEST_USER: User = {
  id: 'user_test',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

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

const createJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job_test' as Job['id'],
  type: QueueJobType.PROCESS_AI_RUN,
  status: 'pending',
  payload: {},
  result: null,
  error: null,
  createdBy: TEST_USER.id,
  createdAt: new Date('2026-02-23T00:00:00.000Z'),
  updatedAt: new Date('2026-02-23T00:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

const withQueue = (queue: QueueService) => Effect.provide(Layer.succeed(Queue, queue));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runs use-cases', () => {
  it('scopes create run to the authenticated user and publishes queue event', async () => {
    let enqueueType: string | undefined;
    let enqueuePayload: unknown;
    let enqueueUserId: string | undefined;

    const queue = createMockQueueService({
      enqueue: (type, payload, userId) => {
        enqueueType = type;
        enqueuePayload = payload;
        enqueueUserId = userId;
        return Effect.succeed(createJob({ payload }));
      },
    });

    const publishSpy = vi
      .spyOn(ssePublisher, 'publish')
      .mockImplementation(() => undefined);

    const result = await Effect.runPromise(
      createRunUseCase({
        user: TEST_USER,
        input: {
          prompt: 'Plan quarterly roadmap',
          threadId: 'thread_123',
        },
      }).pipe(withQueue(queue)),
    );

    expect(enqueueType).toBe(QueueJobType.PROCESS_AI_RUN);
    expect(enqueueUserId).toBe(TEST_USER.id);
    expect(enqueuePayload).toEqual({
      prompt: 'Plan quarterly roadmap',
      threadId: 'thread_123',
      userId: TEST_USER.id,
    });
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(result.prompt).toBe('Plan quarterly roadmap');
    expect(result.threadId).toBe('thread_123');
  });

  it('preserves typed queue errors for create run failures', async () => {
    const queueError = new QueueError({ message: 'queue unavailable' });
    const queue = createMockQueueService({
      enqueue: () => Effect.fail(queueError),
    });

    const error = await Effect.runPromise(
      Effect.flip(
        createRunUseCase({
          user: TEST_USER,
          input: {
            prompt: 'Plan quarterly roadmap',
          },
        }).pipe(withQueue(queue)),
      ),
    );

    expect(error._tag).toBe('QueueError');
    expect(error.message).toBe('queue unavailable');
  });

  it('scopes list runs to user ownership and delegates order + limit to queue', async () => {
    let listUserId: string | undefined;
    let listOptions: Parameters<QueueService['getJobsByUser']>[1] | undefined;

    const queue = createMockQueueService({
      getJobsByUser: (userId, options) => {
        listUserId = userId;
        listOptions = options;

        return Effect.succeed([
          createJob({
            id: 'job_new' as Job['id'],
            payload: { prompt: 'newer' },
            createdAt: new Date('2026-02-22T00:00:00.000Z'),
            updatedAt: new Date('2026-02-22T00:00:00.000Z'),
          }),
        ]);
      },
    });

    const runs = await Effect.runPromise(
      listRunsUseCase({
        user: TEST_USER,
        input: { limit: 1 },
      }).pipe(withQueue(queue)),
    );

    expect(listUserId).toBe(TEST_USER.id);
    expect(listOptions).toEqual({
      type: QueueJobType.PROCESS_AI_RUN,
      limit: 1,
      sortByCreatedAt: 'desc',
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe('job_new');
  });

  it('preserves typed queue errors for list run failures', async () => {
    const queueError = new QueueError({ message: 'query failed' });
    const queue = createMockQueueService({
      getJobsByUser: () => Effect.fail(queueError),
    });

    const error = await Effect.runPromise(
      Effect.flip(
        listRunsUseCase({
          user: TEST_USER,
          input: {},
        }).pipe(withQueue(queue)),
      ),
    );

    expect(error._tag).toBe('QueueError');
    expect(error.message).toBe('query failed');
  });
});
