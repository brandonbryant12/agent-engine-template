import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Spinner } from '@repo/ui/components/spinner';
import { Textarea } from '@repo/ui/components/textarea';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { rawApiClient } from '@/clients/api-client';
import { authClient } from '@/clients/auth-client';
import { EngineIcon } from '@/components/logo';
import {
  type RunState,
  applyRunEvent,
  formatRunStatus,
  formatTimestamp,
  readErrorMessage,
  sortRuns,
  toRunState,
  upsertRun,
} from '@/lib/run-utils';

/* ─── Icons ─── */

function ActivityIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ─── Jobs Page ─── */

export function JobsPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? '';

  const [runs, setRuns] = useState<RunState[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isQueueing, setIsQueueing] = useState(false);

  /* Load initial runs */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setRunsLoading(true);
      try {
        const result = await rawApiClient.runs.list({ limit: 30 });
        if (!cancelled) setRuns(result.map(toRunState).sort(sortRuns));
      } catch {
        if (!cancelled) toast.error('Failed to load runs.');
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* SSE subscription for real-time updates */
  useEffect(() => {
    const controller = new AbortController();

    const subscribe = async () => {
      try {
        const iterator = await rawApiClient.events.subscribe(
          {},
          { signal: controller.signal },
        );

        for await (const event of iterator) {
          setRuns((prev) => applyRunEvent(prev, event));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('SSE subscription failed', err);
        }
      }
    };

    void subscribe();

    return () => {
      controller.abort();
    };
  }, [userId]);

  const activeRuns = useMemo(
    () =>
      runs.filter(
        (r) => r.status === 'pending' || r.status === 'processing',
      ).length,
    [runs],
  );

  const completedRuns = useMemo(
    () => runs.filter((r) => r.status === 'completed').length,
    [runs],
  );

  const failedRuns = useMemo(
    () => runs.filter((r) => r.status === 'failed').length,
    [runs],
  );

  const onQueueRun = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isQueueing) return;

    setIsQueueing(true);
    try {
      const run = await rawApiClient.runs.create({ prompt: text });
      setRuns((prev) => upsertRun(prev, toRunState(run)));
      setPrompt('');
      toast.success('Run queued.');
    } catch (err) {
      toast.error(readErrorMessage(err, 'Failed to queue run.'));
    } finally {
      setIsQueueing(false);
    }
  }, [prompt, isQueueing]);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="page-eyebrow">Runs</p>
        <h1 className="page-title">Run Queue</h1>
        <p className="text-body mt-2">Manage and monitor runs.</p>
      </div>

      {/* Stats */}
      <div className="content-grid-4 mb-8">
        <div className="stat-card animate-fade-in stagger-1">
          <div className="stat-card-header">
            <span className="stat-card-label">Total</span>
          </div>
          <p className="stat-card-value">{runs.length}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-2">
          <div className="stat-card-header">
            <span className="stat-card-label">Active</span>
            <div className="stat-card-icon bg-info/10 text-info">
              <ActivityIcon />
            </div>
          </div>
          <p className="stat-card-value">{activeRuns}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-3">
          <div className="stat-card-header">
            <span className="stat-card-label">Completed</span>
            <div className="stat-card-icon bg-success/10 text-success">
              <CheckIcon />
            </div>
          </div>
          <p className="stat-card-value">{completedRuns}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-4">
          <div className="stat-card-header">
            <span className="stat-card-label">Failed</span>
            <div className="stat-card-icon bg-destructive/10 text-destructive">
              <AlertIcon />
            </div>
          </div>
          <p className="stat-card-value">{failedRuns}</p>
        </div>
      </div>

      {/* Create Run */}
      <div className="card-padded mb-8 animate-fade-in stagger-3">
        <p className="section-title mb-4">Queue a Run</p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void onQueueRun();
            }
          }}
          placeholder="Enter a prompt for the run..."
          className="min-h-[80px] resize-none"
          aria-label="Run prompt"
        />
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => void onQueueRun()}
            disabled={isQueueing || prompt.trim().length === 0}
          >
            {isQueueing ? 'Queueing...' : 'Queue Run'}
          </Button>
        </div>
      </div>

      {/* Runs List */}
      <div className="recent-section animate-fade-in stagger-4">
        <div className="recent-section-header">
          <div className="recent-section-title">
            <h3>All Runs</h3>
            <span className="recent-section-count">{runs.length}</span>
          </div>
          {activeRuns > 0 && (
            <Badge variant="info" className="text-[10px]">
              {activeRuns} active
            </Badge>
          )}
        </div>

        {runsLoading ? (
          <div className="loading-center">
            <Spinner size="sm" />
          </div>
        ) : runs.length === 0 ? (
          <div className="recent-section-empty">
            <div className="empty-state-icon mb-3">
              <EngineIcon size={24} />
            </div>
            <p className="text-sm text-muted-foreground">No runs yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Queue a run above to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {runs.map((run, index) => (
              <div
                key={run.id}
                className={`p-5 animate-fade-in stagger-${String(Math.min(index + 1, 6))}`}
              >
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">
                      {run.prompt}
                    </p>
                    <p className="text-meta mt-1">
                      {formatTimestamp(run.lastEventAt ?? run.updatedAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === 'completed'
                        ? 'success'
                        : run.status === 'failed'
                          ? 'error'
                          : run.status === 'processing'
                            ? 'purple'
                            : 'info'
                    }
                    className="shrink-0 text-[10px]"
                  >
                    {formatRunStatus(run.status)}
                  </Badge>
                </div>

                {run.status === 'processing' && run.progress !== null ? (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${String(run.progress)}%` }}
                      />
                    </div>
                    <p className="text-meta mt-1.5">
                      {run.progressMessage ?? 'Processing'} ({run.progress}%)
                    </p>
                  </div>
                ) : null}

                {run.status === 'completed' && run.result ? (
                  <div className="mt-3 space-y-1 rounded-lg border border-success/10 bg-success/5 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {run.result.title}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {run.result.summary}
                    </p>
                  </div>
                ) : null}

                {run.status === 'failed' ? (
                  <p className="mt-3 text-xs text-destructive">
                    {run.error ?? 'Run failed.'}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
