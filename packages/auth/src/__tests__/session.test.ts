import { Effect, Layer } from 'effect';
import { describe, it, expect, vi } from 'vitest';
import type { UnauthorizedError } from '../errors';
import type { AuthInstance } from '../server/auth';
import { Policy, type PolicyService } from '../policy/service';
import { Role } from '../policy/types';
import {
  getSession,
  getSessionWithRole,
  requireSession,
} from '../server/session';

// Mock auth instance factory
const createMockAuth = (
  session: { user: { id: string; email: string; name: string } } | null,
): AuthInstance =>
  ({
    api: {
      getSession: vi.fn().mockResolvedValue(session),
    },
    $Infer: {} as AuthInstance['$Infer'],
    handler: vi.fn(),
  }) as unknown as AuthInstance;

// Mock policy service
const createMockPolicy = (
  roleMap: Record<string, Role> = {},
): PolicyService => ({
  getUserRole: (userId) => Effect.succeed(roleMap[userId] ?? Role.USER),
});

describe('getSession', () => {
  it('should return session when authenticated', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    };
    const auth = createMockAuth(mockSession);
    const headers = new Headers();

    const result = await Effect.runPromise(getSession(auth, headers));

    expect(result).toEqual(mockSession);
  });

  it('should return null when not authenticated', async () => {
    const auth = createMockAuth(null);
    const headers = new Headers();

    const result = await Effect.runPromise(getSession(auth, headers));

    expect(result).toBeNull();
  });

  it('should return null when auth throws an error', async () => {
    const auth = {
      api: {
        getSession: vi.fn().mockRejectedValue(new Error('Auth error')),
      },
    } as unknown as AuthInstance;
    const headers = new Headers();

    const result = await Effect.runPromise(getSession(auth, headers));

    expect(result).toBeNull();
  });
});

describe('getSessionWithRole', () => {
  it('should return session with user role from database', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    };
    const auth = createMockAuth(mockSession);
    const headers = new Headers();
    const policyLayer = Layer.succeed(
      Policy,
      createMockPolicy({ 'user-1': Role.ADMIN }),
    );

    const result = await Effect.runPromise(
      getSessionWithRole(auth, headers).pipe(Effect.provide(policyLayer)),
    );

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe('user-1');
    expect(result?.user.role).toBe(Role.ADMIN);
  });

  it('should return null when not authenticated', async () => {
    const auth = createMockAuth(null);
    const headers = new Headers();
    const policyLayer = Layer.succeed(Policy, createMockPolicy());

    const result = await Effect.runPromise(
      getSessionWithRole(auth, headers).pipe(Effect.provide(policyLayer)),
    );

    expect(result).toBeNull();
  });

  it('should default to USER role when not found', async () => {
    const mockSession = {
      user: {
        id: 'unknown-user',
        email: 'test@example.com',
        name: 'Test User',
      },
    };
    const auth = createMockAuth(mockSession);
    const headers = new Headers();
    const policyLayer = Layer.succeed(Policy, createMockPolicy({}));

    const result = await Effect.runPromise(
      getSessionWithRole(auth, headers).pipe(Effect.provide(policyLayer)),
    );

    expect(result?.user.role).toBe(Role.USER);
  });
});

describe('requireSession', () => {
  it('should return session with user when authenticated', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    };
    const auth = createMockAuth(mockSession);
    const headers = new Headers();
    const policyLayer = Layer.succeed(Policy, createMockPolicy());

    const result = await Effect.runPromise(
      requireSession(auth, headers).pipe(Effect.provide(policyLayer)),
    );

    expect(result.user.id).toBe('user-1');
    expect(result.session).toEqual(mockSession);
  });

  it('should fail with UnauthorizedError when not authenticated', async () => {
    const auth = createMockAuth(null);
    const headers = new Headers();
    const policyLayer = Layer.succeed(Policy, createMockPolicy());

    const exit = await Effect.runPromiseExit(
      requireSession(auth, headers).pipe(Effect.provide(policyLayer)),
    );

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null;
      expect(error?._tag).toBe('UnauthorizedError');
      expect((error as UnauthorizedError).message).toBe(
        'Authentication required',
      );
    }
  });
});
