import { mergeCurrentContext, middlewareOutputFn } from '@orpc/server';
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
import type { AuthenticatedORPCContext, ORPCContext } from '../../orpc';
import type { ServerRuntime } from '../../runtime';
import type { AnyProcedure } from '@orpc/server';
import type { User } from '@repo/auth/policy';
import runsContract from '../../../contracts/runs';
import {
  SSEPublisher,
  type SSEPublisherService,
} from '../../sse-publisher-service';
import runsRouter from '../runs';
import {
  createMockContext,
  createMockErrors,
  createTestServerRuntime,
} from './helpers';

const TEST_USER: User = {
  id: 'user_test',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

const BASE_TIMESTAMP = new Date('2026-02-23T00:00:00.000Z');

type RunJob = TypedJob<typeof QueueJobType.PROCESS_AI_RUN>;
type RunPayload = JobPayload<typeof QueueJobType.PROCESS_AI_RUN>;
type RunResult = JobResult<typeof QueueJobType.PROCESS_AI_RUN>;
type ProcedureContext = ORPCContext | AuthenticatedORPCContext;

type ProcedureWithOutputSchema = {
  '~orpc': {
    outputSchema: {
      '~standard': {
        validate: (value: unknown) => Promise<{ issues?: unknown }>;
      };
    };
  };
};

type FiberFailureDefect = {
  code?: string;
  status?: number;
  message?: string;
};

type SerializedFiberFailure = {
  cause?: {
    _tag?: string;
    defect?: FiberFailureDefect;
  };
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
  createdAt: BASE_TIMESTAMP,
  updatedAt: BASE_TIMESTAMP,
  startedAt: null,
  completedAt: null,
  ...overrides,
});

const createRuntime = (
  queue: QueueService,
  publisher: SSEPublisherService = createMockPublisherService(),
): ServerRuntime =>
  createTestServerRuntime(
    Layer.mergeAll(
      Layer.succeed(Queue, queue),
      Layer.succeed(SSEPublisher, publisher),
    ),
  );

const invokeProcedure = async <TInput, TOutput>({
  procedure,
  path,
  context,
  input,
}: {
  procedure: AnyProcedure;
  path: readonly string[];
  context: ProcedureContext;
  input: TInput;
}): Promise<TOutput> => {
  const errors =
    createMockErrors() as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
  const middlewares = procedure['~orpc'].middlewares;

  const execute = async (
    index: number,
    currentContext: ProcedureContext,
  ): Promise<TOutput> => {
    const middleware = middlewares[index] as
      | ((
          options: {
            context: ProcedureContext;
            path: readonly string[];
            procedure: AnyProcedure;
            lastEventId: string | undefined;
            errors: Record<string, (...args: unknown[]) => unknown>;
            next: (...args: unknown[]) => Promise<{
              output: TOutput;
              context: Record<string, unknown>;
            }>;
          },
          input: TInput,
          output: typeof middlewareOutputFn,
        ) => Promise<{ output: TOutput }> | { output: TOutput })
      | undefined;

    if (!middleware) {
      return (procedure['~orpc'].handler as (options: {
        context: ProcedureContext;
        input: TInput;
        errors: Record<string, (...args: unknown[]) => unknown>;
        path: readonly string[];
        procedure: AnyProcedure;
        lastEventId: string | undefined;
      }) => Promise<TOutput>)({
        context: currentContext,
        input,
        errors,
        path,
        procedure,
        lastEventId: undefined,
      });
    }

    const result = await middleware(
      {
        context: currentContext,
        path,
        procedure,
        lastEventId: undefined,
        errors,
        next: async (...[nextOptions]) => {
          const nextContext =
            (
              nextOptions as
                | { context?: Record<string, unknown> }
                | undefined
            )?.context ?? {};
          return {
            output: await execute(
              index + 1,
              mergeCurrentContext(
                currentContext,
                nextContext,
              ) as unknown as ProcedureContext,
            ),
            context: nextContext,
          };
        },
      },
      input,
      middlewareOutputFn,
    );

    return result.output as TOutput;
  };

  return execute(0, context);
};

const expectMatchesContractOutput = async (
  procedure: ProcedureWithOutputSchema,
  value: unknown,
) => {
  const validation = await procedure['~orpc'].outputSchema['~standard'].validate(
    value,
  );
  expect(validation.issues).toBeUndefined();
};

const extractFiberFailureDefect = (
  error: unknown,
): FiberFailureDefect | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  const parsed = JSON.parse(JSON.stringify(error)) as SerializedFiberFailure;
  if (parsed.cause?._tag !== 'Die') {
    return null;
  }

  return parsed.cause.defect ?? null;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runs router behavior', () => {
  describe('runs.create', () => {
    it('returns contract-shaped output and publishes queued run event', async () => {
      let enqueueType: string | undefined;
      let enqueuePayload: unknown;
      let enqueueUserId: string | undefined;
      let enqueueOptions: Parameters<QueueService['enqueue']>[3] | undefined;

      const queue = createMockQueueService({
        getJobsByUser: (() =>
          Effect.succeed([])) as QueueService['getJobsByUser'],
        enqueue: ((type, payload, userId, options) => {
          enqueueType = type;
          enqueuePayload = payload;
          enqueueUserId = userId;
          enqueueOptions = options;

          return Effect.succeed(
            createJob({ payload: payload as RunPayload }),
          ) as ReturnType<QueueService['enqueue']>;
        }) as QueueService['enqueue'],
      });

      const publish = vi.fn<SSEPublisherService['publish']>(() =>
        Effect.succeed(undefined),
      );

      const runtime = createRuntime(
        queue,
        createMockPublisherService({ publish }),
      );

      const created = await invokeProcedure<
        { prompt: string; idempotencyKey?: string; threadId?: string | null },
        Awaited<ReturnType<typeof runsRouter.create['~orpc']['handler']>>
      >({
        procedure: runsRouter.create,
        path: ['runs', 'create'],
        context: createMockContext(runtime, TEST_USER),
        input: {
          prompt: 'Plan quarterly roadmap',
          idempotencyKey: 'idempotency-key-123',
          threadId: 'thread_123',
        },
      });

      expect(enqueueType).toBe(QueueJobType.PROCESS_AI_RUN);
      expect(enqueuePayload).toEqual({
        prompt: 'Plan quarterly roadmap',
        threadId: 'thread_123',
        userId: TEST_USER.id,
        idempotencyKey: expect.any(String),
      });
      expect(enqueueOptions).toEqual({ idempotencyKey: 'idempotency-key-123' });
      expect(enqueueUserId).toBe(TEST_USER.id);
      await vi.waitFor(() => {
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
      });
      expect(created).toEqual({
        id: 'job_test',
        status: 'pending',
        prompt: 'Plan quarterly roadmap',
        threadId: 'thread_123',
        result: null,
        error: null,
        createdAt: BASE_TIMESTAMP.toISOString(),
        updatedAt: BASE_TIMESTAMP.toISOString(),
        startedAt: null,
        completedAt: null,
      });

      await expectMatchesContractOutput(
        runsContract.create as unknown as ProcedureWithOutputSchema,
        created,
      );
    });

    it('maps queue failure to protocol-aware INTERNAL_ERROR response shape', async () => {
      const runtime = createRuntime(
        createMockQueueService({
          getJobsByUser: (() =>
            Effect.succeed([])) as QueueService['getJobsByUser'],
          enqueue: () =>
            Effect.fail(new QueueError({ message: 'queue unavailable' })),
        }),
      );

      const error = await invokeProcedure<
        { prompt: string; idempotencyKey?: string; threadId?: string | null },
        never
      >({
        procedure: runsRouter.create,
        path: ['runs', 'create'],
        context: createMockContext(runtime, TEST_USER),
        input: { prompt: 'Plan quarterly roadmap' },
      }).catch((caught) => caught);

      const defect = extractFiberFailureDefect(error);
      expect(defect).not.toBeNull();
      expect(defect).toMatchObject({
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Job queue operation failed',
      });
    });

    it('returns success when queued-event publish fails after enqueue', async () => {
      const runtime = createRuntime(
        createMockQueueService({
          enqueue: ((type, payload, userId) =>
            Effect.succeed(
              createJob({
                type,
                payload: payload as RunPayload,
                createdBy: userId,
              }),
            )) as QueueService['enqueue'],
        }),
        createMockPublisherService({
          publish: () => Effect.fail(new Error('sse unavailable')),
        }),
      );

      const created = await invokeProcedure<
        { prompt: string; idempotencyKey?: string; threadId?: string | null },
        Awaited<ReturnType<typeof runsRouter.create['~orpc']['handler']>>
      >({
        procedure: runsRouter.create,
        path: ['runs', 'create'],
        context: createMockContext(runtime, TEST_USER),
        input: {
          prompt: 'Plan quarterly roadmap',
          idempotencyKey: 'idempotency-key-123',
        },
      });

      expect(created.id).toBe('job_test');
      expect(created.prompt).toBe('Plan quarterly roadmap');
      await expectMatchesContractOutput(
        runsContract.create as unknown as ProcedureWithOutputSchema,
        created,
      );
    });

    it('rejects unauthenticated context before handler execution', async () => {
      const runtime = createRuntime(createMockQueueService());

      try {
        await invokeProcedure<
          { prompt: string; idempotencyKey?: string; threadId?: string | null },
          never
        >({
          procedure: runsRouter.create,
          path: ['runs', 'create'],
          context: createMockContext(runtime, null),
          input: { prompt: 'Plan quarterly roadmap' },
        });
        throw new Error(
          'Expected runs.create to reject unauthenticated requests',
        );
      } catch (error) {
        expect(error).toMatchObject({
          code: 'UNAUTHORIZED',
          status: 401,
          message: 'Missing user session. Please log in!',
        });
      }
    });
  });

  describe('runs.list', () => {
    it('returns contract-shaped list output scoped to authenticated user', async () => {
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
            }),
          ]) as ReturnType<QueueService['getJobsByUser']>;
        }) as QueueService['getJobsByUser'],
      });

      const runtime = createRuntime(queue);

      const listed = await invokeProcedure<
        { limit?: number },
        Awaited<ReturnType<typeof runsRouter.list['~orpc']['handler']>>
      >({
        procedure: runsRouter.list,
        path: ['runs', 'list'],
        context: createMockContext(runtime, TEST_USER),
        input: { limit: 1 },
      });

      expect(listUserId).toBe(TEST_USER.id);
      expect(listOptions).toEqual({
        type: QueueJobType.PROCESS_AI_RUN,
        limit: 1,
        sortByCreatedAt: 'desc',
      });
      expect(listed).toEqual([
        {
          id: 'job_new',
          status: 'pending',
          prompt: 'newer',
          threadId: null,
          result: null,
          error: null,
          createdAt: BASE_TIMESTAMP.toISOString(),
          updatedAt: BASE_TIMESTAMP.toISOString(),
          startedAt: null,
          completedAt: null,
        },
      ]);

      await expectMatchesContractOutput(
        runsContract.list as unknown as ProcedureWithOutputSchema,
        listed,
      );
    });

    it('maps list queue failures to protocol-aware INTERNAL_ERROR response shape', async () => {
      const runtime = createRuntime(
        createMockQueueService({
          getJobsByUser: () =>
            Effect.fail(new QueueError({ message: 'query failed' })),
        }),
      );

      const error = await invokeProcedure<{ limit?: number }, never>({
        procedure: runsRouter.list,
        path: ['runs', 'list'],
        context: createMockContext(runtime, TEST_USER),
        input: {},
      }).catch((caught) => caught);

      const defect = extractFiberFailureDefect(error);
      expect(defect).not.toBeNull();
      expect(defect).toMatchObject({
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Job queue operation failed',
      });
    });

    it('rejects unauthenticated context before list handler execution', async () => {
      const runtime = createRuntime(createMockQueueService());

      try {
        await invokeProcedure<{ limit?: number }, never>({
          procedure: runsRouter.list,
          path: ['runs', 'list'],
          context: createMockContext(runtime, null),
          input: {},
        });
        throw new Error(
          'Expected runs.list to reject unauthenticated requests',
        );
      } catch (error) {
        expect(error).toMatchObject({
          code: 'UNAUTHORIZED',
          status: 401,
          message: 'Missing user session. Please log in!',
        });
      }
    });
  });
});
