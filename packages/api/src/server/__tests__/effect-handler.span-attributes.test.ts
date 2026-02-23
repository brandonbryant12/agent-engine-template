import { describe, expect, it } from 'vitest';
import type { User } from '@repo/auth/policy';
import {
  buildHandlerSpanAttributes,
  ENDUSER_ID_SPAN_ATTRIBUTE,
} from '../effect-handler';

const TEST_USER: User = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'Example User',
  role: 'user',
};

describe('buildHandlerSpanAttributes', () => {
  it('adds request.id and enduser.id for authenticated requests', () => {
    const attributes = buildHandlerSpanAttributes({
      attributes: { 'api.route': 'runs.list' },
      requestId: 'req-auth',
      user: TEST_USER,
    });

    expect(attributes).toEqual({
      'api.route': 'runs.list',
      'request.id': 'req-auth',
      [ENDUSER_ID_SPAN_ATTRIBUTE]: TEST_USER.id,
    });
  });

  it('omits enduser.id for unauthenticated requests', () => {
    const attributes = buildHandlerSpanAttributes({
      requestId: 'req-public',
      user: null,
    });

    expect(attributes).toEqual({
      'request.id': 'req-public',
    });
    expect(attributes).not.toHaveProperty(ENDUSER_ID_SPAN_ATTRIBUTE);
  });

  it('preserves custom attributes when request and user are absent', () => {
    const attributes = buildHandlerSpanAttributes({
      attributes: { 'run.limit': 20 },
      user: null,
    });

    expect(attributes).toEqual({
      'run.limit': 20,
    });
  });
});
