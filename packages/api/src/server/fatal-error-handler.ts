type FatalEvent = 'unhandledRejection' | 'uncaughtException';

export interface FatalErrorHandlerConfig {
  processName: string;
  cleanup: () => Promise<void>;
  timeoutMs?: number;
  exit?: (code: number) => never;
  logger?: Pick<Console, 'error'>;
}

export interface FatalErrorHandlers {
  unhandledRejection: (
    reason: unknown,
    promise: PromiseLike<unknown>,
  ) => void;
  uncaughtException: (error: Error) => void;
}

const DEFAULT_FATAL_CLEANUP_TIMEOUT_MS = 10_000;

const serializeReason = (reason: unknown): unknown => {
  if (reason instanceof Error) {
    return { message: reason.message, stack: reason.stack };
  }
  return reason;
};

const serializeError = (error: unknown): unknown => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return error;
};

const eventLabel: Record<FatalEvent, string> = {
  unhandledRejection: 'Unhandled Promise Rejection',
  uncaughtException: 'Uncaught Exception',
};

export const createFatalErrorHandlers = (
  config: FatalErrorHandlerConfig,
): FatalErrorHandlers => {
  const logger = config.logger ?? console;
  const exit = config.exit ?? process.exit;
  const timeoutMs = config.timeoutMs ?? DEFAULT_FATAL_CLEANUP_TIMEOUT_MS;
  let isHandlingFatalError = false;

  const handleFatalError = async (
    event: FatalEvent,
    metadata: Record<string, unknown>,
  ): Promise<void> => {
    if (isHandlingFatalError) {
      return;
    }
    isHandlingFatalError = true;

    logger.error(`[FATAL] ${eventLabel[event]}:`, {
      process: config.processName,
      ...metadata,
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        config.cleanup(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `Fatal cleanup timed out after ${timeoutMs}ms (${config.processName})`,
              ),
            );
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } catch (error) {
      logger.error('[FATAL] Cleanup failed before exit:', {
        process: config.processName,
        error: serializeError(error),
      });
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      exit(1);
    }
  };

  return {
    unhandledRejection: (reason, promise) => {
      void handleFatalError('unhandledRejection', {
        reason: serializeReason(reason),
        promise: String(promise),
      });
    },
    uncaughtException: (error) => {
      void handleFatalError('uncaughtException', {
        error: serializeError(error),
      });
    },
  };
};
