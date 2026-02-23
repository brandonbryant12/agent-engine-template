import { implement } from '@orpc/server';
import { type AuthInstance, getSessionWithRole } from '@repo/auth/server';
import { Effect } from 'effect';
import type { ServerRuntime } from './runtime';
import type { User } from '@repo/auth/policy';
import { appContract } from '../contracts';

type Session = AuthInstance['$Infer']['Session'];

/** Storage configuration for different providers */
export type StorageConfig =
  | { provider: 'filesystem'; basePath: string; baseUrl: string }
  | {
      provider: 's3';
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint?: string;
      publicEndpoint?: string;
    };

/**
 * oRPC context passed to all handlers.
 *
 * Contains:
 * - session: The auth session (null if unauthenticated)
 * - user: The user with role loaded from DB (null if unauthenticated)
 * - runtime: Shared server runtime with all services
 */
export interface ORPCContext {
  session: Session | null;
  user: User | null;
  requestId: string;
  runtime: ServerRuntime;
}

/**
 * Authenticated context type - used after protectedProcedure middleware.
 * Guarantees session and user are non-null.
 */
export interface AuthenticatedORPCContext extends ORPCContext {
  session: Session;
  user: User;
}

/**
 * Creates the oRPC context for a request.
 *
 * This is called once per request and:
 * 1. Uses the shared runtime to look up the session
 * 2. Loads the user's role from the database
 * 3. Returns a lightweight context with runtime reference
 *
 * Note: No layer creation happens here - that's done once at startup.
 */
export const createORPCContext = async ({
  auth,
  runtime,
  headers,
  requestId,
}: {
  auth: AuthInstance;
  runtime: ServerRuntime;
  headers: Headers;
  requestId: string;
}): Promise<ORPCContext> => {
  const result = await runtime.runPromise(
    getSessionWithRole(auth, headers).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.warn(
            '[AUTH_CONTEXT] Session lookup failed:',
            error instanceof Error ? error.message : String(error),
          );
          return null;
        }),
      ),
    ),
  );

  return {
    session: result?.session ?? null,
    user: result?.user ?? null,
    requestId,
    runtime,
  };
};

const base = implement(appContract);

export const publicProcedure = base.$context<ORPCContext>();

export const protectedProcedure = publicProcedure.use(
  ({ context, next, errors }) => {
    if (!context.session?.user || !context.user) {
      throw errors.UNAUTHORIZED({
        message: 'Missing user session. Please log in!',
      });
    }
    return next({
      context: context as AuthenticatedORPCContext,
    });
  },
);
