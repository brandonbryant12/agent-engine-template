import { describe, it, expect } from 'vitest';
import { Storage } from '../service';

describe('Storage service', () => {
  it('has the correct tag identifier', () => {
    expect(Storage.key).toBe('@repo/storage/Storage');
  });
});
