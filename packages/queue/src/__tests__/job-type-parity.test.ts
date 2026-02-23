import { JobType } from '@repo/db/schema';
import { describe, expect, it } from 'vitest';
import {
  QueueJobType,
  type QueueJobMapCoversAllJobTypes,
  type QueueJobMapHasNoExtraJobTypes,
} from '../types';

describe('queue job-type parity', () => {
  it('reuses db job-type constants', () => {
    expect(QueueJobType).toBe(JobType);
  });

  it('keeps queue and db job-type values aligned', () => {
    expect(Object.values(QueueJobType)).toEqual(Object.values(JobType));
  });

  it('enforces typed queue map coverage for all job types', () => {
    const coversAll: QueueJobMapCoversAllJobTypes = true;
    const hasNoExtra: QueueJobMapHasNoExtraJobTypes = true;

    expect(coversAll).toBe(true);
    expect(hasNoExtra).toBe(true);
  });
});
