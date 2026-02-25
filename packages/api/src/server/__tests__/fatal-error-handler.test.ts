import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFatalErrorHandlers } from '../fatal-error-handler';

afterEach(() => {
  vi.useRealTimers();
});

describe('createFatalErrorHandlers', () => {
  it('executes cleanup and exits with code 1 for unhandled rejections', async () => {
    const cleanup = vi.fn(async () => {});
    const exit = vi.fn(
      ((_: number) => undefined) as unknown as (code: number) => never,
    );
    const logger = { error: vi.fn() };

    const handlers = createFatalErrorHandlers({
      processName: 'server',
      cleanup,
      exit,
      logger,
      timeoutMs: 50,
    });

    handlers.unhandledRejection(new Error('boom'), Promise.resolve());
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
    });
  });

  it('forces exit with code 1 when cleanup times out', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn(
      () =>
        new Promise<void>(() => {
          // intentionally unresolved
        }),
    );
    const exit = vi.fn(
      ((_: number) => undefined) as unknown as (code: number) => never,
    );
    const logger = { error: vi.fn() };

    const handlers = createFatalErrorHandlers({
      processName: 'worker',
      cleanup,
      exit,
      logger,
      timeoutMs: 25,
    });

    handlers.uncaughtException(new Error('crash'));
    await vi.advanceTimersByTimeAsync(25);
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[FATAL] Cleanup failed before exit:',
      expect.objectContaining({ process: 'worker' }),
    );
  });
});
