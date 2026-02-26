import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Spinner } from '@repo/ui/components/spinner';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { rawApiClient } from '@/clients/api-client';
import { authClient } from '@/clients/auth-client';
import { EngineIcon } from '@/components/logo';
import { loadThreads } from '@/lib/chat-utils';
import {
  readErrorMessage,
  type RunState,
  formatRunStatus,
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
  const [lastSuccessfulRunsLoadAt, setLastSuccessfulRunsLoadAt] = useState<
    string | null
  >(null);
  const hasSuccessfulRunsSnapshot = lastSuccessfulRunsLoadAt !== null;

  useEffect(() => {
    let cancelled = false;

    const loadRuns = async () => {
      setRunsLoading(true);
      setRunsLoadError(null);

      try {
        const result = await rawApiClient.runs.list({ limit: 10 });
        if (cancelled) return;
        setRuns(result.map(toRunState).sort(sortRuns));
        setLastSuccessfulRunsLoadAt(new Date().toISOString());
      } catch (error) {
        if (!cancelled) {
          setRunsLoadError(
            readErrorMessage(error, 'Failed to load recent runs.'),
          );
        }
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  const retryRunsLoad = async () => {
    setRunsLoading(true);
    setRunsLoadError(null);
    try {
      const result = await rawApiClient.runs.list({ limit: 10 });
      setRuns(result.map(toRunState).sort(sortRuns));
      setLastSuccessfulRunsLoadAt(new Date().toISOString());
    } catch (error) {
      setRunsLoadError(readErrorMessage(error, 'Failed to load recent runs.'));
    } finally {
      setRunsLoading(false);
    }
  };

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
          <p className="stat-card-value">
            {runsLoadError && !hasSuccessfulRunsSnapshot ? '—' : stats.active}
          </p>
        </div>
        <div className="stat-card animate-fade-in stagger-3">
          <div className="stat-card-header">
            <span className="stat-card-label">Completed</span>
            <div className="stat-card-icon bg-success/10 text-success">
              <CheckIcon />
            </div>
          </div>
          <p className="stat-card-value">
            {runsLoadError && !hasSuccessfulRunsSnapshot ? '—' : stats.completed}
          </p>
        </div>
        <div className="stat-card animate-fade-in stagger-4">
          <div className="stat-card-header">
            <span className="stat-card-label">Failed</span>
            <div className="stat-card-icon bg-destructive/10 text-destructive">
              <AlertIcon />
            </div>
          </div>
          <p className="stat-card-value">
            {runsLoadError && !hasSuccessfulRunsSnapshot ? '—' : stats.failed}
          </p>
        </div>
      </div>

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
            <span className="recent-section-count">
              {runsLoadError && !hasSuccessfulRunsSnapshot ? '—' : runs.length}
            </span>
          </div>
          <Link to="/jobs" className="text-link">
            View all
          </Link>
        </div>
        {lastSuccessfulRunsLoadAt ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Last successful update:{' '}
            {formatTimestamp(lastSuccessfulRunsLoadAt)}
          </p>
        ) : null}

        {runsLoading ? (
          <div className="loading-center">
            <Spinner size="sm" />
          </div>
        ) : runsLoadError ? (
          <div className="recent-section-empty" role="alert">
            <div className="empty-state-icon mb-3">
              <AlertIcon />
            </div>
            <p className="text-sm text-foreground">{runsLoadError}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasSuccessfulRunsSnapshot
                ? 'Showing the last successful run snapshot until retry succeeds.'
                : 'No successful run snapshot is available yet.'}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              onClick={() => {
                void retryRunsLoad();
              }}
            >
              Retry runs load
            </Button>
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
