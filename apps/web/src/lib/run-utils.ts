import type { RouterOutput } from '@repo/api/client';
import type { SSEEvent } from '@repo/api/contracts';

export type RunRecord = RouterOutput['runs']['list'][number];
export type RunStep = 'planning' | 'generating' | 'finalizing';

export interface RunState extends RunRecord {
  progress: number | null;
  progressStep: RunStep | null;
  progressMessage: string | null;
  lastEventAt: string | null;
}

export const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
};

export const toRunState = (run: RunRecord): RunState => ({
  ...run,
  progress:
    run.status === 'completed' ? 100 : run.status === 'processing' ? 10 : null,
  progressStep: null,
  progressMessage: null,
  lastEventAt: run.updatedAt,
});

export const createRunPlaceholder = (
  runId: string,
  timestamp: string,
): RunState => ({
  id: runId,
  status: 'pending',
  prompt: 'Background run',
  threadId: null,
  result: null,
  error: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  startedAt: null,
  completedAt: null,
  progress: null,
  progressStep: null,
  progressMessage: null,
  lastEventAt: timestamp,
});

export const sortRuns = (a: RunState, b: RunState) =>
  b.updatedAt.localeCompare(a.updatedAt);

export const upsertRun = (runs: RunState[], next: RunState): RunState[] => {
  const index = runs.findIndex((run) => run.id === next.id);
  if (index === -1) {
    return [next, ...runs].sort(sortRuns);
  }

  const updated = [...runs];
  updated[index] = next;
  return updated.sort(sortRuns);
};

export const updateRun = (
  runs: RunState[],
  runId: string,
  updater: (run: RunState) => RunState,
  fallbackTimestamp: string,
): RunState[] => {
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return upsertRun(
      runs,
      updater(createRunPlaceholder(runId, fallbackTimestamp)),
    );
  }

  const next = [...runs];
  next[index] = updater(next[index]!);
  return next.sort(sortRuns);
};

export const applyRunEvent = (runs: RunState[], event: SSEEvent): RunState[] => {
  switch (event.type) {
    case 'connected':
      return runs;

    case 'run_queued':
      return upsertRun(
        runs,
        toRunState({
          id: event.runId,
          status: 'pending',
          prompt: event.prompt,
          threadId: event.threadId,
          result: null,
          error: null,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          startedAt: null,
          completedAt: null,
        }),
      );

    case 'run_started':
      return updateRun(
        runs,
        event.runId,
        (run) => ({
          ...run,
          status: 'processing',
          startedAt: run.startedAt ?? event.timestamp,
          updatedAt: event.timestamp,
          progress: Math.max(run.progress ?? 0, 20),
          progressStep: 'planning',
          progressMessage: 'Run started',
          lastEventAt: event.timestamp,
        }),
        event.timestamp,
      );

    case 'run_progress':
      return updateRun(
        runs,
        event.runId,
        (run) => ({
          ...run,
          status: 'processing',
          updatedAt: event.timestamp,
          progress: event.progress,
          progressStep: event.step,
          progressMessage: event.message,
          lastEventAt: event.timestamp,
        }),
        event.timestamp,
      );

    case 'run_completed':
      return updateRun(
        runs,
        event.runId,
        (run) => ({
          ...run,
          status: 'completed',
          result: event.result,
          error: null,
          progress: 100,
          progressStep: 'finalizing',
          progressMessage: 'Completed',
          updatedAt: event.timestamp,
          completedAt: event.timestamp,
          lastEventAt: event.timestamp,
        }),
        event.timestamp,
      );

    case 'run_failed':
      return updateRun(
        runs,
        event.runId,
        (run) => ({
          ...run,
          status: 'failed',
          error: event.error,
          progress: null,
          progressStep: null,
          progressMessage: null,
          updatedAt: event.timestamp,
          completedAt: event.timestamp,
          lastEventAt: event.timestamp,
        }),
        event.timestamp,
      );

    default:
      return runs;
  }
};

export const formatRunStatus = (status: RunState['status']): string => {
  if (status === 'pending') return 'Queued';
  if (status === 'processing') return 'Processing';
  if (status === 'completed') return 'Completed';
  return 'Failed';
};

export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
