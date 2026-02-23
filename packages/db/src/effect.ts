import { Context, Effect, Layer } from 'effect';
import type { DatabaseInstance } from './client';
import {
  DbError,
  ConstraintViolationError,
  DeadlockError,
  ConnectionError,
} from './errors';

export { DbError, ConstraintViolationError, DeadlockError, ConnectionError };

export type DatabaseError =
  | DbError
  | ConstraintViolationError
  | DeadlockError
  | ConnectionError;

export interface DbService {
  readonly db: DatabaseInstance;
}

export class Db extends Context.Tag('@repo/db/Db')<Db, DbService>() {}

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  table?: string;
}

const mapDatabaseError = (cause: unknown): DatabaseError => {
  if (cause instanceof Error) {
    const pgError = cause as PostgresError;
    const code = pgError.code;

    if (code?.startsWith('23')) {
      return new ConstraintViolationError({
        constraint: pgError.constraint ?? 'unknown',
        table: pgError.table,
        message: cause.message,
        cause,
      });
    }

    if (code === '40P01') {
      return new DeadlockError({
        message: cause.message,
        cause,
      });
    }

    if (code?.startsWith('08')) {
      return new ConnectionError({
        message: cause.message,
        cause,
      });
    }
  }

  return new DbError({
    cause,
    message: cause instanceof Error ? cause.message : String(cause),
  });
};

export const withDb = <A>(
  name: string,
  f: (db: DatabaseInstance) => Promise<A>,
): Effect.Effect<A, DatabaseError, Db> =>
  Effect.flatMap(Db, ({ db }) =>
    Effect.tryPromise({
      try: () => f(db),
      catch: mapDatabaseError,
    }),
  ).pipe(
    Effect.withSpan(`db.${name}`, {
      attributes: { 'db.system': 'postgresql' },
    }),
  );

export const DbLive = (db: DatabaseInstance): Layer.Layer<Db> =>
  Layer.succeed(Db, { db });
