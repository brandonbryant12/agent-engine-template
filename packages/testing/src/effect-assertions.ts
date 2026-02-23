import { Cause, Exit, Option } from 'effect';

/**
 * Assert that an Effect exit is a failure containing the expected error type.
 * Returns the narrowed error instance for further assertions.
 *
 * Throws plain errors instead of using vitest's `expect`,
 * so this module is safe to import at runtime (no vitest dependency).
 */
export function expectEffectFailure<E, T extends E>(
  exit: Exit.Exit<unknown, E>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- standard TS constructor constraint
  ErrorClass: new (...args: any[]) => T,
): T {
  if (!Exit.isFailure(exit)) {
    throw new Error(`Expected Effect failure, got success`);
  }
  const option = Cause.failureOption(exit.cause);
  if (!Option.isSome(option)) {
    throw new Error(`Expected Fail cause, got ${exit.cause._tag}`);
  }
  if (!(option.value instanceof ErrorClass)) {
    const proto =
      option.value != null ? Object.getPrototypeOf(option.value) : null;
    const actual = proto?.constructor?.name ?? typeof option.value;
    throw new Error(`Expected ${ErrorClass.name}, got ${actual}`);
  }
  return option.value;
}
