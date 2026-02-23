import { eq } from '@repo/db';
import { Db } from '@repo/db/effect';
import { user } from '@repo/db/schema';
import { Effect, Layer } from 'effect';
import { PolicyError } from '../errors';
import { Policy } from './service';
import { Role } from './types';

/**
 * Database-backed policy provider.
 */
export const DatabasePolicyLive: Layer.Layer<Policy, never, Db> = Layer.effect(
  Policy,
  Effect.gen(function* () {
    const db = yield* Db;

    return {
      getUserRole: (userId: string) =>
        Effect.tryPromise({
          try: async () => {
            const [row] = await db.db
              .select({ role: user.role })
              .from(user)
              .where(eq(user.id, userId));
            return (row?.role as Role) ?? Role.USER;
          },
          catch: (cause) =>
            new PolicyError({
              message: cause instanceof Error ? cause.message : String(cause),
              cause,
            }),
        }).pipe(Effect.withSpan('policy.db.getUserRole')),
    };
  }),
);
