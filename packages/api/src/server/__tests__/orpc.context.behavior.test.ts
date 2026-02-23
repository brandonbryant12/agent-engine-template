import { PolicyError } from '@repo/auth';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerRuntime } from '../runtime';
import type { AuthInstance } from '@repo/auth/server';
import { createORPCContext } from '../orpc';

const getSessionWithRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@repo/auth/server', async () => {
  const actual = await vi.importActual('@repo/auth/server');

  return {
    ...actual,
    getSessionWithRole: getSessionWithRoleMock,
  };
});

const testRuntime = {
  runPromise: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.runPromise(effect),
} as unknown as ServerRuntime;

describe('createORPCContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getSessionWithRoleMock.mockReset();
  });

  it('returns null session and user for unauthenticated requests', async () => {
    getSessionWithRoleMock.mockReturnValueOnce(Effect.succeed(null));

    const context = await createORPCContext({
      auth: {} as AuthInstance,
      runtime: testRuntime,
      headers: new Headers(),
      requestId: 'req-unauthenticated',
    });

    expect(context.session).toBeNull();
    expect(context.user).toBeNull();
    expect(context.requestId).toBe('req-unauthenticated');
  });

  it('returns session and user for authenticated requests', async () => {
    const authResult = {
      session: {
        id: 'session_1',
        userId: 'user_1',
        expiresAt: new Date('2026-02-23T00:00:00.000Z'),
        createdAt: new Date('2026-02-23T00:00:00.000Z'),
        updatedAt: new Date('2026-02-23T00:00:00.000Z'),
        token: 'token_1',
      },
      user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'Example User',
        role: 'user' as const,
      },
    };
    getSessionWithRoleMock.mockReturnValueOnce(Effect.succeed(authResult));

    const context = await createORPCContext({
      auth: {} as AuthInstance,
      runtime: testRuntime,
      headers: new Headers(),
      requestId: 'req-authenticated',
    });

    expect(context.session).toEqual(authResult.session);
    expect(context.user).toEqual(authResult.user);
    expect(context.requestId).toBe('req-authenticated');
  });

  it('rethrows policy failures and logs request correlation + failure class', async () => {
    const policyError = new PolicyError({
      message: 'role lookup failed',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionWithRoleMock.mockReturnValueOnce(Effect.fail(policyError));

    await expect(
      createORPCContext({
        auth: {} as AuthInstance,
        runtime: testRuntime,
        headers: new Headers(),
        requestId: 'req-policy-failure',
      }),
    ).rejects.toThrow('role lookup failed');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[AUTH_CONTEXT][requestId:req-policy-failure][failure:PolicyError]',
      ),
      policyError,
    );
  });
});
