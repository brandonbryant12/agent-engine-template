import { Effect } from 'effect';
import type { AuthInstance } from './auth';
import type { User } from '../policy/types';
import {
  AuthSessionError,
  type PolicyError,
  UnauthorizedError,
} from '../errors';
import { Policy } from '../policy/service';

type Session = AuthInstance['$Infer']['Session'];

/**
 * Get session from headers - Effect wrapper around better-auth.
 * Returns null if no session exists or if there's an auth error.
 */
export const getSession = (
  auth: AuthInstance,
  headers: Headers,
): Effect.Effect<Session | null, AuthSessionError> =>
  Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: (cause) =>
      new AuthSessionError({
        message: 'Failed to retrieve authentication session',
        cause,
      }),
  }).pipe(
    Effect.map((s) => s ?? null),
    Effect.tapError((error) =>
      Effect.logWarning('auth.getSession.failed').pipe(
        Effect.annotateLogs('auth.failure.tag', error._tag),
      ),
    ),
    Effect.withSpan('auth.getSession'),
  );

/**
 * Get session with user role loaded from database.
 * Returns null if no session exists.
 */
export const getSessionWithRole = (
  auth: AuthInstance,
  headers: Headers,
): Effect.Effect<
  { session: Session; user: User } | null,
  PolicyError | AuthSessionError,
  Policy
> =>
  Effect.gen(function* () {
    const session = yield* getSession(auth, headers);
    if (!session?.user) return null;

    const policy = yield* Policy;
    const role = yield* policy.getUserRole(session.user.id);

    return {
      session,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role,
      },
    };
  }).pipe(Effect.withSpan('auth.getSessionWithRole'));

/**
 * Require a valid session - fails with UnauthorizedError if not authenticated.
 */
export const requireSession = (
  auth: AuthInstance,
  headers: Headers,
): Effect.Effect<
  { session: Session; user: User },
  UnauthorizedError | PolicyError | AuthSessionError,
  Policy
> =>
  getSessionWithRole(auth, headers).pipe(
    Effect.filterOrFail(
      (result): result is { session: Session; user: User } => result !== null,
      () => new UnauthorizedError({ message: 'Authentication required' }),
    ),
    Effect.withSpan('auth.requireSession'),
  );
