import { Effect, Exit, Cause, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import type {
  DbError,
  ConstraintViolationError,
  DeadlockError,
  ConnectionError,
} from '../effect';
import { withDb, Db } from '../effect';

const mockDbLayer = Layer.succeed(Db, { db: {} as never });

describe('withDb', () => {
  it('executes a successful database operation', async () => {
    const result = await Effect.runPromise(
      withDb('test.find', async () => ({
        id: 'job_123',
        title: 'Test Job',
      })).pipe(Effect.provide(mockDbLayer)),
    );
    expect(result).toEqual({ id: 'job_123', title: 'Test Job' });
  });

  it('maps constraint violation errors (23xxx codes)', async () => {
    const pgError = Object.assign(new Error('unique violation'), {
      code: '23505',
      constraint: 'unique_email',
      table: 'users',
    });

    const exit = await Effect.runPromiseExit(
      withDb('test.insert', async () => {
        throw pgError;
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe('Some');
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('ConstraintViolationError');
        expect((error.value as ConstraintViolationError).constraint).toBe(
          'unique_email',
        );
        expect((error.value as ConstraintViolationError).table).toBe('users');
      }
    }
  });

  it('maps constraint errors with unknown constraint when not specified', async () => {
    const pgError = Object.assign(new Error('check violation'), {
      code: '23514',
    });

    const exit = await Effect.runPromiseExit(
      withDb('test.insert', async () => {
        throw pgError;
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('ConstraintViolationError');
        expect((error.value as ConstraintViolationError).constraint).toBe(
          'unknown',
        );
      }
    }
  });

  it('maps deadlock errors (40P01)', async () => {
    const pgError = Object.assign(new Error('deadlock detected'), {
      code: '40P01',
    });

    const exit = await Effect.runPromiseExit(
      withDb('test.update', async () => {
        throw pgError;
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('DeadlockError');
        expect((error.value as DeadlockError).message).toBe(
          'deadlock detected',
        );
      }
    }
  });

  it('maps connection errors (08xxx codes)', async () => {
    const pgError = Object.assign(new Error('connection refused'), {
      code: '08001',
    });

    const exit = await Effect.runPromiseExit(
      withDb('test.query', async () => {
        throw pgError;
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('ConnectionError');
        expect((error.value as ConnectionError).message).toBe(
          'connection refused',
        );
      }
    }
  });

  it('maps generic errors to DbError', async () => {
    const exit = await Effect.runPromiseExit(
      withDb('test.query', async () => {
        throw new Error('something went wrong');
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('DbError');
        expect((error.value as DbError).message).toBe('something went wrong');
      }
    }
  });

  it('maps non-Error throws to DbError with string message', async () => {
    const exit = await Effect.runPromiseExit(
      withDb('test.query', async () => {
        throw 'raw string error';
      }).pipe(Effect.provide(mockDbLayer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') {
        expect(error.value._tag).toBe('DbError');
        expect((error.value as DbError).message).toBe('raw string error');
      }
    }
  });
});
