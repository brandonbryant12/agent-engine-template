import { Effect, Layer } from 'effect';
import { describe, it, expect } from 'vitest';
import type { ForbiddenError } from '../errors';
import { requireOwnership, requireRole } from '../policy/policies';
import { Policy, type PolicyService } from '../policy/service';
import { Role } from '../policy/types';
import { withCurrentUser, type User } from '../policy/user';

const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: Role.USER,
  ...overrides,
});

const createAdminUser = (overrides: Partial<User> = {}): User => ({
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: Role.ADMIN,
  ...overrides,
});

const mockPolicyService: PolicyService = {
  getUserRole: (userId) =>
    Effect.succeed(userId === 'admin-1' ? Role.ADMIN : Role.USER),
};

const MockPolicyLive = Layer.succeed(Policy, mockPolicyService);

const runWithUser = <A, E>(user: User, effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(withCurrentUser(user)(effect));

describe('requireOwnership', () => {
  it('should succeed when user owns the resource', async () => {
    const user = createTestUser({ id: 'owner-id' });
    const result = await runWithUser(user, requireOwnership('owner-id'));
    expect(result.id).toBe('owner-id');
  });

  it('should fail when user does not own the resource', async () => {
    const user = createTestUser({ id: 'other-id' });
    await expect(
      runWithUser(user, requireOwnership('owner-id')),
    ).rejects.toThrow();
  });

  it('should succeed when admin accesses any resource', async () => {
    const admin = createAdminUser();
    const result = await runWithUser(admin, requireOwnership('other-owner-id'));
    expect(result.role).toBe(Role.ADMIN);
  });
});

describe('requireRole', () => {
  it('should succeed when user has the required role', async () => {
    const user = createTestUser({ role: Role.USER });
    const result = await runWithUser(user, requireRole(Role.USER));
    expect(result.role).toBe(Role.USER);
  });

  it('should fail when user does not have the required role', async () => {
    const user = createTestUser({ role: Role.USER });
    await expect(runWithUser(user, requireRole(Role.ADMIN))).rejects.toThrow();
  });

  it('should succeed when admin for any role', async () => {
    const admin = createAdminUser();
    const result = await runWithUser(admin, requireRole(Role.USER));
    expect(result.role).toBe(Role.ADMIN);
  });
});

describe('error types', () => {
  it('should fail with ForbiddenError for ownership failure', async () => {
    const user = createTestUser({ id: 'other-id' });
    const result = await Effect.runPromiseExit(
      withCurrentUser(user)(requireOwnership('owner-id')),
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error?._tag).toBe('ForbiddenError');
      expect((error as ForbiddenError).message).toBe(
        'You do not own this resource',
      );
    }
  });

  it('should fail with ForbiddenError with role name for role failure', async () => {
    const user = createTestUser();
    const result = await Effect.runPromiseExit(
      withCurrentUser(user)(requireRole(Role.ADMIN)),
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(error?._tag).toBe('ForbiddenError');
      expect((error as ForbiddenError).message).toBe('Requires admin role');
    }
  });
});

describe('Policy service', () => {
  it('should get user role from mock policy', async () => {
    const user = createTestUser();
    const effect = Effect.gen(function* () {
      const policy = yield* Policy;
      return yield* policy.getUserRole(user.id);
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(MockPolicyLive)),
    );
    expect(result).toBe(Role.USER);
  });

  it('should get admin role for admin user', async () => {
    const admin = createAdminUser();
    const effect = Effect.gen(function* () {
      const policy = yield* Policy;
      return yield* policy.getUserRole(admin.id);
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(MockPolicyLive)),
    );
    expect(result).toBe(Role.ADMIN);
  });
});
