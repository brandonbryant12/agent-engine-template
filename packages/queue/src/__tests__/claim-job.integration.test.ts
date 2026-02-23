import { eq } from '@repo/db';
import { createDb, type DatabaseInstance } from '@repo/db/client';
import { Db } from '@repo/db/effect';
import { job, JobStatus, JobType } from '@repo/db/schema';
import { user } from '@repo/db/schema';
import { Effect, Layer } from 'effect';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { JobProcessingError } from '../errors';
import { QueueLive } from '../repository';
import { Queue } from '../service';

/**
 * Integration tests for the queue's atomic job claiming mechanism.
 *
 * These tests verify that processNextJob uses FOR UPDATE SKIP LOCKED
 * to prevent duplicate job processing with concurrent workers.
 *
 * Requires: SERVER_POSTGRES_URL env var pointing to a running Postgres instance
 * with the schema pushed via `pnpm db:push`.
 */
const POSTGRES_URL = process.env.SERVER_POSTGRES_URL;

describe.skipIf(!POSTGRES_URL)('Queue atomic job claim (integration)', () => {
  let db: DatabaseInstance;
  let testUserId: string;

  const testLayer = Layer.effect(
    Db,
    Effect.sync(() => ({ db })),
  );

  const queueLayer = QueueLive.pipe(Layer.provide(testLayer));

  const runEffect = <A, E>(effect: Effect.Effect<A, E, Queue>) =>
    Effect.runPromise(effect.pipe(Effect.provide(queueLayer)));

  beforeAll(async () => {
    db = createDb({ databaseUrl: POSTGRES_URL });

    // Create a test user for the foreign key constraint
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, 'queue-test@test.com'))
      .limit(1);

    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const [created] = await db
        .insert(user)
        .values({
          id: 'queue-test-user-' + Date.now(),
          name: 'Queue Test User',
          email: 'queue-test@test.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      testUserId = created!.id;
    }
  });

  afterEach(async () => {
    // Clean up test jobs
    await db.delete(job).where(eq(job.createdBy, testUserId));
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(user).where(eq(user.email, 'queue-test@test.com'));
    await db.$client.end();
  });

  it('claims and processes a single pending job', async () => {
    // Enqueue a job
    const enqueued = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { test: true }, testUserId),
      ),
    );

    expect(enqueued.status).toBe(JobStatus.PENDING);

    // Process it
    const result = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.processNextJob(JobType.PROCESS_AI_RUN, (j) =>
          Effect.succeed({ processed: j.id }),
        ),
      ),
    );

    expect(result).not.toBeNull();
    expect(result!.status).toBe(JobStatus.COMPLETED);
  });

  it('returns null when no pending jobs exist', async () => {
    const result = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.processNextJob(JobType.PROCESS_AI_RUN, () =>
          Effect.succeed({ done: true }),
        ),
      ),
    );

    expect(result).toBeNull();
  });

  it('marks job as FAILED when handler throws JobProcessingError', async () => {
    await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { fail: true }, testUserId),
      ),
    );

    const result = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.processNextJob(JobType.PROCESS_AI_RUN, (j) =>
          Effect.fail(
            new JobProcessingError({
              jobId: j.id,
              message: 'intentional test failure',
            }),
          ),
        ),
      ),
    );

    expect(result).not.toBeNull();
    expect(result!.status).toBe(JobStatus.FAILED);
    expect(result!.error).toBe('intentional test failure');
  });

  it('processes jobs in FIFO order', async () => {
    // Enqueue two jobs with slight delay for ordering
    const first = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { order: 1 }, testUserId),
      ),
    );

    // Small delay to ensure different created_at timestamps
    await new Promise((r) => setTimeout(r, 10));

    await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { order: 2 }, testUserId),
      ),
    );

    // Process first job
    const processed = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.processNextJob(JobType.PROCESS_AI_RUN, (j) =>
          Effect.succeed({ id: j.id }),
        ),
      ),
    );

    expect(processed!.id).toBe(first.id);
  });

  it('lists jobs using explicit descending order and limit', async () => {
    await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { order: 1 }, testUserId),
      ),
    );

    await new Promise((r) => setTimeout(r, 10));

    const second = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { order: 2 }, testUserId),
      ),
    );

    await new Promise((r) => setTimeout(r, 10));

    const third = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { order: 3 }, testUserId),
      ),
    );

    const listed = await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.getJobsByUser(testUserId, {
          type: JobType.PROCESS_AI_RUN,
          sortByCreatedAt: 'desc',
          limit: 2,
        }),
      ),
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]!.id).toBe(third.id);
    expect(listed[1]!.id).toBe(second.id);
  });

  it('concurrent claims do not process the same job twice', async () => {
    // Enqueue a single job
    await runEffect(
      Effect.flatMap(Queue, (q) =>
        q.enqueue(JobType.PROCESS_AI_RUN, { concurrent: true }, testUserId),
      ),
    );

    // Race two processNextJob calls
    const [result1, result2] = await Promise.all([
      runEffect(
        Effect.flatMap(Queue, (q) =>
          q.processNextJob(JobType.PROCESS_AI_RUN, (j) =>
            Effect.succeed({ worker: 'A', jobId: j.id }),
          ),
        ),
      ),
      runEffect(
        Effect.flatMap(Queue, (q) =>
          q.processNextJob(JobType.PROCESS_AI_RUN, (j) =>
            Effect.succeed({ worker: 'B', jobId: j.id }),
          ),
        ),
      ),
    ]);

    // Exactly one should get the job, the other should get null
    const claimed = [result1, result2].filter((r) => r !== null);
    const missed = [result1, result2].filter((r) => r === null);

    expect(claimed).toHaveLength(1);
    expect(missed).toHaveLength(1);
    expect(claimed[0]!.status).toBe(JobStatus.COMPLETED);
  });
});
