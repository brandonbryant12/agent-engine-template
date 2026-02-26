import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Spinner } from '@repo/ui/components/spinner';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rawApiClient } from '@/clients/api-client';
import { authClient } from '@/clients/auth-client';
import { EngineIcon } from '@/components/logo';
import { loadThreads } from '@/lib/chat-utils';
import {
  type RunState,
  formatRunStatus,
  readErrorMessage,
  formatTimestamp,
  sortRuns,
  toRunState,
} from '@/lib/run-utils';

/* ─── Icons ─── */

function ChatSmallIcon() {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LayersSmallIcon() {
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
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

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

/* ─── Dashboard Page ─── */

export function DashboardPage() {
  const { data: session } = authClient.useSession();
  const [runs, setRuns] = useState<RunState[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsLoadError, setRunsLoadError] = useState<string | null>(null);
  const [lastRunsUpdatedAt, setLastRunsUpdatedAt] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsLoadError(null);
    try {
      const result = await rawApiClient.runs.list({ limit: 10 });
      setRuns(result.map(toRunState).sort(sortRuns));
      setLastRunsUpdatedAt(new Date().toISOString());
    } catch (error) {
      setRunsLoadError(readErrorMessage(error, 'Failed to load runs.'));
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) {
        return;
      }

      await loadRuns();
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [loadRuns]);

  const threadCount = useMemo(() => {
    if (!session?.user) return 0;
    return loadThreads(session.user.id).length;
  }, [session?.user]);

  const stats = useMemo(() => {
    const active = runs.filter(
      (r) => r.status === 'pending' || r.status === 'processing',
    ).length;
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    return { active, completed, failed };
  }, [runs]);

  const runsStatsUnavailable = runsLoadError !== null;
  const activeRunsValue = runsStatsUnavailable ? '—' : String(stats.active);
  const completedRunsValue = runsStatsUnavailable ? '—' : String(stats.completed);
  const failedRunsValue = runsStatsUnavailable ? '—' : String(stats.failed);

  return (
    <div className="page-container animate-fade-in">
      {/* Welcome */}
      <div className="mb-8">
        <p className="page-eyebrow">Dashboard</p>
        <h1 className="page-title">Welcome back</h1>
        <p className="text-body mt-2">
          Here&apos;s an overview of your workspace.
        </p>
      </div>

      {/* Stats */}
      <div className="content-grid-4 mb-8">
        <div className="stat-card animate-fade-in stagger-1">
          <div className="stat-card-header">
            <span className="stat-card-label">Chat Threads</span>
            <div className="stat-card-icon bg-primary/10">
              <ChatSmallIcon />
            </div>
          </div>
          <p className="stat-card-value">{threadCount}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-2">
          <div className="stat-card-header">
            <span className="stat-card-label">Active Runs</span>
            <div className="stat-card-icon bg-info/10 text-info">
              <ActivityIcon />
            </div>
          </div>
          <p className="stat-card-value">{activeRunsValue}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-3">
          <div className="stat-card-header">
            <span className="stat-card-label">Completed</span>
            <div className="stat-card-icon bg-success/10 text-success">
              <CheckIcon />
            </div>
          </div>
          <p className="stat-card-value">{completedRunsValue}</p>
        </div>
        <div className="stat-card animate-fade-in stagger-4">
          <div className="stat-card-header">
            <span className="stat-card-label">Failed</span>
            <div className="stat-card-icon bg-destructive/10 text-destructive">
              <AlertIcon />
            </div>
          </div>
          <p className="stat-card-value">{failedRunsValue}</p>
        </div>
      </div>

      {runsLoadError ? (
        <div className="card-padded mb-8 border-destructive/30 bg-destructive/5 text-destructive">
          <p className="section-title text-destructive">Runs failed to load.</p>
          <p className="mt-2 text-sm">{runsLoadError}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadRuns()}
              disabled={runsLoading}
            >
              {runsLoading ? 'Retrying...' : 'Retry loading runs'}
            </Button>
            {lastRunsUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                Last updated {formatTimestamp(lastRunsUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="section-header">
        <h2 className="section-title">Quick Actions</h2>
      </div>
      <div className="content-grid-2 mb-8">
        <Link to="/chat" className="action-card animate-fade-in stagger-1">
          <div className="action-card-icon">
            <ChatSmallIcon />
          </div>
          <div>
            <p className="action-card-title">New Chat</p>
            <p className="action-card-description">
              Start a conversation with the AI assistant
            </p>
          </div>
        </Link>
        <Link to="/jobs" className="action-card animate-fade-in stagger-2">
          <div className="action-card-icon">
            <LayersSmallIcon />
          </div>
          <div>
            <p className="action-card-title">Run Queue</p>
            <p className="action-card-description">
              View and manage runs
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Runs */}
      <div className="recent-section animate-fade-in stagger-3">
        <div className="recent-section-header">
          <div className="recent-section-title">
            <h3>Recent Runs</h3>
            <span className="recent-section-count">{runs.length}</span>
          </div>
          {lastRunsUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              Last updated {formatTimestamp(lastRunsUpdatedAt)}
            </span>
          ) : null}
          <Link to="/jobs" className="text-link">
            View all
          </Link>
        </div>

        {runsLoading ? (
          <div className="loading-center">
            <Spinner size="sm" />
          </div>
        ) : runsLoadError ? (
          <div className="recent-section-empty">
            <div className="empty-state-icon mb-3">
              <AlertIcon />
            </div>
            <p className="text-sm text-destructive">Unable to load recent runs.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Retry to refresh dashboard run data.
            </p>
          </div>
        ) : runs.length === 0 ? (
          <div className="recent-section-empty">
            <div className="empty-state-icon mb-3">
              <EngineIcon size={24} />
            </div>
            <p className="text-sm text-muted-foreground">No runs yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Queue a background run to get started.
            </p>
          </div>
        ) : (
          <div className="recent-section-body">
            {runs.slice(0, 5).map((run) => (
              <div key={run.id} className="recent-item">
                <div
                  className={`recent-item-icon ${
                    run.status === 'completed'
                      ? 'bg-success/10 text-success'
                      : run.status === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-info/10 text-info'
                  }`}
                >
                  {run.status === 'completed' ? (
                    <CheckIcon />
                  ) : run.status === 'failed' ? (
                    <AlertIcon />
                  ) : (
                    <ActivityIcon />
                  )}
                </div>
                <div className="recent-item-info">
                  <p className="recent-item-title">{run.prompt}</p>
                  <p className="recent-item-meta">
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
                  className="text-[10px]"
                >
                  {formatRunStatus(run.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
