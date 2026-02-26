import { type User } from '@repo/auth';
import {
  Queue,
  QueueError,
  QueueJobType,
  type JobPayload,
  type JobResult,
  type QueueService,
  type TypedJob,
} from '@repo/queue';
import { Effect, Layer } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SSEPublisher,
  type SSEPublisherService,
} from '../../sse-publisher-service';
import { createRunUseCase, listRunsUseCase } from '../runs';

const TEST_USER: User = {
  id: 'user_test',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

const UNAUTHORIZED_ROLE_USER = {
  ...TEST_USER,
  role: 'viewer' as unknown as User['role'],
};

type RunJob = TypedJob<typeof QueueJobType.PROCESS_AI_RUN>;
type RunPayload = JobPayload<typeof QueueJobType.PROCESS_AI_RUN>;
type RunResult = JobResult<typeof QueueJobType.PROCESS_AI_RUN>;

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

const createMockPublisherService = (
  overrides: Partial<SSEPublisherService> = {},
): SSEPublisherService => ({
  publish: () => Effect.succeed(undefined),
  ...overrides,
});

const createJob = (overrides: Partial<RunJob> = {}): RunJob => ({
  id: 'job_test' as RunJob['id'],
  type: QueueJobType.PROCESS_AI_RUN,
  status: 'pending',
  payload: {
    prompt: 'default prompt',
    userId: TEST_USER.id,
    threadId: null,
  },
  result: null as RunResult | null,
  error: null,
  createdBy: TEST_USER.id,
  createdAt: new Date('2026-02-23T00:00:00.000Z'),
  updatedAt: new Date('2026-02-23T00:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

const withQueueAndPublisher = (
  queue: QueueService,
  publisher: SSEPublisherService = createMockPublisherService(),
) =>
  Effect.provide(
    Layer.mergeAll(
      Layer.succeed(Queue, queue),
      Layer.succeed(SSEPublisher, publisher),
    ),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runs use-cases', () => {
  it('scopes create run to the authenticated user and publishes queue event', async () => {
    let enqueueType: string | undefined;
    let enqueuePayload: unknown;
    let enqueueUserId: string | undefined;

    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([])) as QueueService['getJobsByUser'],
      enqueue: ((type, payload, userId) => {
        enqueueType = type;
        enqueuePayload = payload;
        enqueueUserId = userId;
        return Effect.succeed(
          createJob({ payload: payload as RunPayload }),
        ) as ReturnType<QueueService['enqueue']>;
      }) as QueueService['enqueue'],
    });

    const publish = vi.fn<SSEPublisherService['publish']>(() =>
      Effect.succeed(undefined),
    );
    const publisher = createMockPublisherService({ publish });

    const result = await Effect.runPromise(
      createRunUseCase({
        user: TEST_USER,
        input: {
          prompt: 'Plan quarterly roadmap',
          threadId: 'thread_123',
        },
      }).pipe(withQueueAndPublisher(queue, publisher)),
    );

    expect(enqueueType).toBe(QueueJobType.PROCESS_AI_RUN);
    expect(enqueueUserId).toBe(TEST_USER.id);
    expect(enqueuePayload).toEqual({
      prompt: 'Plan quarterly roadmap',
      threadId: 'thread_123',
      userId: TEST_USER.id,
      idempotencyKey: expect.any(String),
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      TEST_USER.id,
      expect.objectContaining({
        type: 'run_queued',
        runId: 'job_test',
        prompt: 'Plan quarterly roadmap',
        threadId: 'thread_123',
      }),
    );
    expect(result.prompt).toBe('Plan quarterly roadmap');
    expect(result.threadId).toBe('thread_123');
  });

  it('preserves typed queue errors for create run failures', async () => {
    const queueError = new QueueError({ message: 'queue unavailable' });
    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([])) as QueueService['getJobsByUser'],
      enqueue: () => Effect.fail(queueError),
    });

    const error = await Effect.runPromise(
      Effect.flip(
        createRunUseCase({
          user: TEST_USER,
          input: {
            prompt: 'Plan quarterly roadmap',
          },
        }).pipe(withQueueAndPublisher(queue)),
      ),
    );

    expect(error._tag).toBe('QueueError');
    expect(error.message).toBe('queue unavailable');
  });

  it('fails create run with typed forbidden error for unauthorized roles', async () => {
    let enqueueCalls = 0;

    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([])) as QueueService['getJobsByUser'],
      enqueue: ((type, payload, userId) => {
        enqueueCalls += 1;
        return Effect.succeed(
          createJob({ type, payload: payload as RunPayload, createdBy: userId }),
        ) as ReturnType<QueueService['enqueue']>;
      }) as QueueService['enqueue'],
    });

    const error = await Effect.runPromise(
      Effect.flip(
        createRunUseCase({
          user: UNAUTHORIZED_ROLE_USER,
          input: {
            prompt: 'Plan quarterly roadmap',
          },
        }).pipe(withQueueAndPublisher(queue)),
      ),
    );

    expect(error._tag).toBe('ForbiddenError');
    expect(error.message).toContain('Requires user or admin role');
    expect(enqueueCalls).toBe(0);
  });

  it('returns the existing run for idempotent retries without enqueueing a duplicate', async () => {
    let enqueueCalls = 0;
    const existing = createJob({
      id: 'job_existing' as RunJob['id'],
      payload: {
        prompt: 'Plan quarterly roadmap',
        threadId: 'thread_123',
        userId: TEST_USER.id,
        idempotencyKey: `${TEST_USER.id}:Plan quarterly roadmap:thread_123`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([existing])) as QueueService['getJobsByUser'],
      enqueue: ((type, payload, userId) => {
        enqueueCalls += 1;
        return Effect.succeed(
          createJob({ type, payload: payload as RunPayload, createdBy: userId }),
        ) as ReturnType<QueueService['enqueue']>;
      }) as QueueService['enqueue'],
    });

    const publish = vi.fn<SSEPublisherService['publish']>(() =>
      Effect.succeed(undefined),
    );

    const result = await Effect.runPromise(
      createRunUseCase({
        user: TEST_USER,
        input: {
          prompt: 'Plan quarterly roadmap',
          threadId: 'thread_123',
        },
      }).pipe(withQueueAndPublisher(queue, createMockPublisherService({ publish }))),
    );

    expect(result.id).toBe('job_existing');
    expect(enqueueCalls).toBe(0);
  });

  it('does not fail create run when publish throws after durable enqueue', async () => {
    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([])) as QueueService['getJobsByUser'],
      enqueue: ((type, payload, userId) =>
        Effect.succeed(
          createJob({ type, payload: payload as RunPayload, createdBy: userId }),
        )) as QueueService['enqueue'],
    });

    const publisher = createMockPublisherService({
      publish: () =>
        Effect.die(new Error('transient publish failure')),
    });

    const result = await Effect.runPromise(
      createRunUseCase({
        user: TEST_USER,
        input: {
          prompt: 'Plan quarterly roadmap',
          threadId: 'thread_123',
        },
      }).pipe(withQueueAndPublisher(queue, publisher)),
    );

    expect(result.id).toBe('job_test');
    expect(result.prompt).toBe('Plan quarterly roadmap');
  });

  it('scopes list runs to user ownership and delegates order + limit to queue', async () => {
    let listUserId: string | undefined;
    let listOptions: Parameters<QueueService['getJobsByUser']>[1] | undefined;

    const queue = createMockQueueService({
      getJobsByUser: ((userId, options) => {
        listUserId = userId;
        listOptions = options;

        return Effect.succeed([
          createJob({
            id: 'job_new' as RunJob['id'],
            payload: {
              prompt: 'newer',
              userId: TEST_USER.id,
              threadId: null,
            },
            createdAt: new Date('2026-02-22T00:00:00.000Z'),
            updatedAt: new Date('2026-02-22T00:00:00.000Z'),
          }),
        ]) as ReturnType<QueueService['getJobsByUser']>;
      }) as QueueService['getJobsByUser'],
    });

    const runs = await Effect.runPromise(
      listRunsUseCase({
        user: TEST_USER,
        input: { limit: 1 },
      }).pipe(withQueueAndPublisher(queue)),
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

  it('surfaces deterministic error for completed runs with invalid result payload', async () => {
    const queue = createMockQueueService({
      getJobsByUser: (() =>
        Effect.succeed([
          createJob({
            id: 'job_invalid_result' as RunJob['id'],
            status: 'completed',
            result: {
              not: 'a-run-result',
            } as unknown as RunResult,
            error: null,
          }),
        ])) as QueueService['getJobsByUser'],
    });

    const runs = await Effect.runPromise(
      listRunsUseCase({
        user: TEST_USER,
        input: {},
      }).pipe(withQueueAndPublisher(queue)),
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.result).toBeNull();
    expect(runs[0]?.error).toBe('Run completed with invalid result payload');
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
        }).pipe(withQueueAndPublisher(queue)),
      ),
    );

    expect(error._tag).toBe('QueueError');
    expect(error.message).toBe('query failed');
  });

  it('fails list runs with typed forbidden error for unauthorized roles', async () => {
    let listCalls = 0;

    const queue = createMockQueueService({
      getJobsByUser: ((userId, _options) => {
        listCalls += 1;
        return Effect.succeed([
          createJob({ id: 'job_1' as RunJob['id'], createdBy: userId }),
        ]) as ReturnType<QueueService['getJobsByUser']>;
      }) as QueueService['getJobsByUser'],
    });

    const error = await Effect.runPromise(
      Effect.flip(
        listRunsUseCase({
          user: UNAUTHORIZED_ROLE_USER,
          input: { limit: 1 },
        }).pipe(withQueueAndPublisher(queue)),
      ),
    );

    expect(error._tag).toBe('ForbiddenError');
    expect(error.message).toContain('Requires user or admin role');
    expect(listCalls).toBe(0);
  });
});
