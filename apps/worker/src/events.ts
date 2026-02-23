import type {
  RunCompletedEvent,
  RunFailedEvent,
  RunProgressEvent,
  RunStartedEvent,
  SSEEvent,
} from '@repo/api/contracts';
import type { RunResult } from '@repo/api/contracts';

export type PublishEvent = (userId: string, event: SSEEvent) => void;

const now = () => new Date().toISOString();

export const emitRunStarted = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  runId: string,
): void => {
  if (!publishEvent) return;

  const event: RunStartedEvent = {
    type: 'run_started',
    runId,
    timestamp: now(),
  };
  publishEvent(userId, event);
};

export const emitRunProgress = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  runId: string,
  step: RunProgressEvent['step'],
  progress: number,
  message: string,
): void => {
  if (!publishEvent) return;

  const event: RunProgressEvent = {
    type: 'run_progress',
    runId,
    step,
    progress,
    message,
    timestamp: now(),
  };
  publishEvent(userId, event);
};

export const emitRunCompleted = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  runId: string,
  result: RunResult,
): void => {
  if (!publishEvent) return;

  const event: RunCompletedEvent = {
    type: 'run_completed',
    runId,
    result,
    timestamp: now(),
  };
  publishEvent(userId, event);
};

export const emitRunFailed = (
  publishEvent: PublishEvent | undefined,
  userId: string,
  runId: string,
  error: string,
): void => {
  if (!publishEvent) return;

  const event: RunFailedEvent = {
    type: 'run_failed',
    runId,
    error,
    timestamp: now(),
  };
  publishEvent(userId, event);
};
