import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MIN_PAGE_LIMIT,
  OffsetQueryParams,
  SimpleCursorQueryParams,
  createPaginatedResponse,
  createOffsetPaginatedResponse,
} from '../schemas/pagination';

describe('pagination constants', () => {
  it('has correct default values', () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(25);
    expect(MAX_PAGE_LIMIT).toBe(100);
    expect(MIN_PAGE_LIMIT).toBe(1);
  });
});

describe('OffsetQueryParams', () => {
  const decode = Schema.decodeUnknownSync(OffsetQueryParams);

  it('provides defaults when no values given', () => {
    const result = decode({});
    expect(result.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(result.offset).toBe(0);
  });

  it('accepts valid limit and offset', () => {
    const result = decode({ limit: 10, offset: 50 });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(50);
  });

  it('rejects limit below minimum', () => {
    expect(() => decode({ limit: 0 })).toThrow();
  });

  it('rejects limit above maximum', () => {
    expect(() => decode({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => decode({ offset: -1 })).toThrow();
  });

  it('rejects non-integer limit', () => {
    expect(() => decode({ limit: 5.5 })).toThrow();
  });
});

describe('SimpleCursorQueryParams', () => {
  const decode = Schema.decodeUnknownSync(SimpleCursorQueryParams);

  it('provides defaults when no values given', () => {
    const result = decode({});
    expect(result.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(result.afterCursor).toBeUndefined();
    expect(result.beforeCursor).toBeUndefined();
  });

  it('accepts cursor values', () => {
    const result = decode({
      limit: 10,
      afterCursor: 'pod_abc123',
      beforeCursor: 'pod_xyz789',
    });
    expect(result.limit).toBe(10);
    expect(result.afterCursor).toBe('pod_abc123');
    expect(result.beforeCursor).toBe('pod_xyz789');
  });
});

describe('createPaginatedResponse', () => {
  it('returns hasMore=false when data fits within limit', () => {
    const data = [{ id: 'a' }, { id: 'b' }];
    const result = createPaginatedResponse(data, 5, (item) => item.id);
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns hasMore=true and trims data when data exceeds limit', () => {
    const data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = createPaginatedResponse(data, 2, (item) => item.id);
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('b');
  });

  it('returns hasMore=false when data length equals limit', () => {
    const data = [{ id: 'a' }, { id: 'b' }];
    const result = createPaginatedResponse(data, 2, (item) => item.id);
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it('handles empty data', () => {
    const result = createPaginatedResponse(
      [],
      10,
      (item: { id: string }) => item.id,
    );
    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe('createOffsetPaginatedResponse', () => {
  it('returns hasMore=true when more items exist beyond current page', () => {
    const result = createOffsetPaginatedResponse(
      [{ id: 'a' }, { id: 'b' }],
      10,
      0,
    );
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore=false when current page reaches end', () => {
    const result = createOffsetPaginatedResponse(
      [{ id: 'a' }, { id: 'b' }],
      2,
      0,
    );
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('accounts for offset when calculating hasMore', () => {
    const result = createOffsetPaginatedResponse([{ id: 'c' }], 3, 2);
    expect(result.hasMore).toBe(false);
  });

  it('handles empty data with total=0', () => {
    const result = createOffsetPaginatedResponse([], 0, 0);
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
