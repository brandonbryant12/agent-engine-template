import { withCurrentUser, Role, type User } from '@repo/auth/policy';
import type { TestUser } from '../factories/user';
import type { Effect } from 'effect';

/** Convert a TestUser to a User for policy context. */
export function toUser(testUser: TestUser): User {
  return {
    id: testUser.id,
    email: testUser.email,
    name: testUser.name,
    role: testUser.role === 'admin' ? Role.ADMIN : Role.USER,
  };
}

/**
 * Wrap an effect with test user context.
 * Uses FiberRef to scope user context for the duration of the effect.
 */
export const withTestUser =
  (testUser: TestUser) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    withCurrentUser(toUser(testUser))(effect);
