import { Effect, Layer } from 'effect';
import { describe, it, expect } from 'vitest';
import type { JobProcessingError } from '../errors';
import { Queue, type QueueService } from '../service';

type ProcessNextJobError = Effect.Effect.Error<
  ReturnType<QueueService['processNextJob']>
>;

const assertNoProcessingErrorLeak = <
  T extends Extract<ProcessNextJobError, JobProcessingError> extends never
    ? true
    : false,
>(
  value: T,
) => value;

assertNoProcessingErrorLeak(true);

describe('Queue service', () => {
  it('has the correct tag identifier', () => {
    expect(Queue.key).toBe('@repo/queue/Queue');
  });

  it('can be provided via Layer.succeed with a mock implementation', () => {
    // Verifies the Context.Tag can be used in Effect's DI system.
    // This catches breaking changes to the Tag definition.
    const mockService: QueueService = {
      enqueue: () => Effect.die('not implemented'),
      getJob: () => Effect.die('not implemented'),
      getJobsByUser: () => Effect.die('not implemented'),
      updateJobStatus: () => Effect.die('not implemented'),
      processNextJob: () => Effect.die('not implemented'),
      processJobById: () => Effect.die('not implemented'),
      claimNextJob: () => Effect.die('not implemented'),
      deleteJob: () => Effect.die('not implemented'),
      failStaleJobs: () => Effect.die('not implemented'),
    };

    const layer = Layer.succeed(Queue, mockService);

    // If we can build a program that resolves the Queue tag, the DI wiring works
    const program = Effect.gen(function* () {
      const queue = yield* Queue;
      return queue;
    }).pipe(Effect.provide(layer));

    return Effect.runPromise(program).then((resolved) => {
      expect(resolved).toBe(mockService);
    });
  });
});
