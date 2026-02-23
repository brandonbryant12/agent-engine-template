import { Effect, Exit, Cause, Schema } from 'effect';
import { describe, it, expect } from 'vitest';
import { expectEffectFailure } from '../effect-assertions';

// ---------------------------------------------------------------------------
// Test error classes
// ---------------------------------------------------------------------------

class TestNotFound extends Schema.TaggedError<TestNotFound>()('TestNotFound', {
  id: Schema.String,
}) {}

class TestUnauthorized extends Schema.TaggedError<TestUnauthorized>()(
  'TestUnauthorized',
  { reason: Schema.String },
) {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('expectEffectFailure', () => {
  describe('success exit', () => {
    it('throws when the exit is a success', () => {
      const exit = Exit.succeed('ok');

      expect(() => expectEffectFailure(exit, TestNotFound)).toThrow(
        'Expected Effect failure, got success',
      );
    });
  });

  describe('failure exit with correct error type', () => {
    it('returns the narrowed error instance', async () => {
      const exit = await Effect.runPromiseExit(
        Effect.fail(new TestNotFound({ id: 'doc_123' })),
      );

      const error = expectEffectFailure(exit, TestNotFound);

      expect(error).toBeInstanceOf(TestNotFound);
      expect(error._tag).toBe('TestNotFound');
      expect(error.id).toBe('doc_123');
    });
  });

  describe('failure exit with wrong error type', () => {
    it('throws when the error does not match the expected class', async () => {
      const exit = await Effect.runPromiseExit(
        Effect.fail(new TestUnauthorized({ reason: 'not allowed' })),
      );

      expect(() => expectEffectFailure(exit, TestNotFound)).toThrow(
        'Expected TestNotFound, got TestUnauthorized',
      );
    });
  });

  describe('non-Fail cause (Die)', () => {
    it('throws when the cause is a Die (defect)', async () => {
      const exit = await Effect.runPromiseExit(
        Effect.die(new Error('unexpected defect')),
      );

      expect(() => expectEffectFailure(exit, TestNotFound)).toThrow(
        'Expected Fail cause, got Die',
      );
    });
  });

  describe('non-Fail cause (Interrupt)', () => {
    it('throws when the cause is an Interrupt', () => {
      const interruptExit = Exit.failCause(Cause.interrupt('fiber-1'));

      expect(() => expectEffectFailure(interruptExit, TestNotFound)).toThrow(
        'Expected Fail cause, got Interrupt',
      );
    });
  });

  describe('failure exit with non-class error value', () => {
    it('throws with descriptive message for string error', async () => {
      const exit = await Effect.runPromiseExit(
        Effect.fail('plain string error'),
      );

      expect(() => expectEffectFailure(exit, TestNotFound)).toThrow(
        'Expected TestNotFound, got String',
      );
    });
  });
});
