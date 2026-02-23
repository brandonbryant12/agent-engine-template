import { Effect, FiberRef, Option } from 'effect';
import type { User } from './types';
import { UnauthorizedError } from '../errors';

export type { User } from './types';

/**
 * FiberRef holding the current user context.
 * Set per-request via Effect.locally in handlers/workers.
 */
export const CurrentUserRef: FiberRef.FiberRef<Option.Option<User>> =
  FiberRef.unsafeMake<Option.Option<User>>(Option.none());

/**
 * Get the current user. Fails with UnauthorizedError if not authenticated.
 */
export const getCurrentUser: Effect.Effect<User, UnauthorizedError> =
  FiberRef.get(CurrentUserRef).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(
            new UnauthorizedError({ message: 'Authentication required' }),
          ),
        onSome: Effect.succeed,
      }),
    ),
  );

/**
 * Get the current user as Option. Never fails.
 */
export const getMaybeCurrentUser: Effect.Effect<Option.Option<User>> =
  FiberRef.get(CurrentUserRef);

/**
 * Run an effect with a specific user context.
 * Uses Effect.locally to scope the user to the effect's fiber tree.
 */
export const withCurrentUser =
  (user: User) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.locally(CurrentUserRef, Option.some(user))(effect);
