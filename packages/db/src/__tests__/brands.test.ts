import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { JobIdSchema, generateJobId } from '../schemas/brands';

describe('brand schemas', () => {
  it('generates job ids with expected prefix and length', () => {
    const id = generateJobId();
    expect(id.startsWith('job_')).toBe(true);
    expect(id).toHaveLength(20);
  });

  it('validates job ids against brand schema', () => {
    const decode = Schema.decodeUnknownSync(JobIdSchema);
    expect(decode('job_0123456789abcdef')).toBe('job_0123456789abcdef');
    expect(() => decode('pod_0123456789abcdef')).toThrow();
  });
});
