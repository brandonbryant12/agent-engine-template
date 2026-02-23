import { Effect, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import type { JobId } from '../schemas/brands';
import {
  JobStatus,
  JobStatusSchema,
  JobType,
  ProcessAiRunResultSchema,
  serializeJob,
  serializeJobEffect,
} from '../schemas/jobs';

describe('jobs schema', () => {
  it('exposes expected JobStatus constants', () => {
    expect(JobStatus.PENDING).toBe('pending');
    expect(JobStatus.PROCESSING).toBe('processing');
    expect(JobStatus.COMPLETED).toBe('completed');
    expect(JobStatus.FAILED).toBe('failed');
  });

  it('exposes expected JobType constants', () => {
    expect(JobType.PROCESS_AI_RUN).toBe('process-ai-run');
  });

  it('validates job status values', () => {
    const decode = Schema.decodeUnknownSync(JobStatusSchema);
    expect(decode('pending')).toBe('pending');
    expect(() => decode('queued')).toThrow();
  });

  it('validates process-ai-run result shape', () => {
    const decode = Schema.decodeUnknownSync(ProcessAiRunResultSchema);
    expect(
      decode({
        title: 'Result',
        summary: 'Summary',
        keyPoints: ['A', 'B'],
        nextActions: ['Do X'],
      }),
    ).toEqual({
      title: 'Result',
      summary: 'Summary',
      keyPoints: ['A', 'B'],
      nextActions: ['Do X'],
    });
  });

  it('serializes jobs consistently (sync + effect)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const row = {
      id: 'job_0123456789abcdef' as JobId,
      type: JobType.PROCESS_AI_RUN,
      status: JobStatus.COMPLETED,
      result: {
        title: 'T',
        summary: 'S',
        keyPoints: ['K'],
        nextActions: ['N'],
      },
      error: null,
      createdBy: 'user_1',
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: now,
    };

    const syncResult = serializeJob(row);
    const effectResult = await Effect.runPromise(serializeJobEffect(row));

    expect(effectResult).toEqual(syncResult);
    expect(syncResult.createdAt).toBe(now.toISOString());
    expect(syncResult.id).toBe('job_0123456789abcdef');
  });
});
