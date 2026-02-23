import { useChat } from '@ai-sdk/react';
import {
  eventIteratorToUnproxiedDataStream,
  type RouterOutput,
} from '@repo/api/client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Toaster } from '@repo/ui/components/sonner';
import { Spinner } from '@repo/ui/components/spinner';
import { Textarea } from '@repo/ui/components/textarea';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter as createTanstackRouter,
} from '@tanstack/react-router';
import { type UIMessage } from 'ai';
import { ThemeProvider } from 'next-themes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SSEEvent } from '@repo/api/contracts';
import { rawApiClient } from '@/clients/api-client';
import { authClient } from '@/clients/auth-client';
import { env } from '@/env';
import { queryClient } from '@/query-client';

const STORAGE_NAMESPACE = 'agent-engine-template.chat.threads';

type AuthMode = 'signin' | 'signup';

type RunRecord = RouterOutput['runs']['list'][number];
type RunStep = 'planning' | 'generating' | 'finalizing';

interface StoredThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: UIMessage[];
}

interface RunState extends RunRecord {
  progress: number | null;
  progressStep: RunStep | null;
  progressMessage: string | null;
  lastEventAt: string | null;
}

const rootRoute = createRootRoute({ component: RootLayout });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const routeTree = rootRoute.addChildren([homeRoute]);

/* ─── Shared Logo ─── */

function EngineIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M14 4 L6 17 h8 L10 28 L26 15 h-8 L22 4 Z" fill="currentColor" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div className="logo">
      <div className="logo-icon">
        <EngineIcon />
      </div>
      <span className="logo-text">Agent Engine</span>
    </div>
  );
}

/* ─── Layout & Pages ─── */

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster position="bottom-right" />
    </div>
  );
}

function HomePage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <LogoMark />
          <Spinner />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <AuthGate />;
  }

  return (
    <ChatWorkspace
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
    />
  );
}

/* ─── Auth ─── */

function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Email and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await authClient.signIn.email({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (result.error) {
          toast.error(result.error.message ?? 'Sign in failed.');
          return;
        }

        toast.success('Signed in.');
        return;
      }

      const fallbackName = trimmedEmail.split('@')[0] || 'Template User';
      const result = await authClient.signUp.email({
        name: fallbackName,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (result.error) {
        toast.error(result.error.message ?? 'Sign up failed.');
        return;
      }

      toast.success('Account created and signed in.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, mode, password]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="auth-card animate-fade-in-up">
        <div className="auth-header">
          <div className="mb-6 flex justify-center">
            <LogoMark />
          </div>
          <h1 className="page-title">
            {mode === 'signin' ? 'Welcome back' : 'Get started'}
          </h1>
          <p className="text-body mt-2">
            {mode === 'signin'
              ? 'Sign in to continue to your workspace.'
              : 'Create an account to start building.'}
          </p>
        </div>

        <div className="card-padded">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="auth-email"
              >
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="auth-password"
              >
                Password
              </label>
              <Input
                id="auth-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void onSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? mode === 'signin'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </Button>
          </div>
        </div>

        <div className="auth-footer">
          <button
            type="button"
            className="text-link"
            onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
          >
            {mode === 'signin'
              ? 'Need an account? Create one'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Workspace ─── */

// eslint-disable-next-line max-lines-per-function
function ChatWorkspace({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const hydratedThreads = useMemo(() => {
    const loaded = loadThreads(userId);
    return loaded.length > 0 ? loaded : [createEmptyThread()];
  }, [userId]);

  const [threads, setThreads] = useState<StoredThread[]>(() => hydratedThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => hydratedThreads[0]?.id ?? null,
  );
  const [draft, setDraft] = useState('');
  const [runs, setRuns] = useState<RunState[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [isQueueingRun, setIsQueueingRun] = useState(false);

  const transport = useMemo(
    () => ({
      sendMessages: async (options: {
        messages: UIMessage[];
        abortSignal: AbortSignal | undefined;
      }) => {
        const iterator = await rawApiClient.chat.general(
          { messages: options.messages },
          { signal: options.abortSignal },
        );

        return eventIteratorToUnproxiedDataStream(iterator);
      },
      reconnectToStream: async () => null,
    }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    messages: hydratedThreads[0]?.messages ?? [],
  });

  const isStreaming = status === 'submitted' || status === 'streaming';

  const activeRuns = useMemo(
    () => runs.filter((run) => run.status === 'pending' || run.status === 'processing').length,
    [runs],
  );

  const applyActiveMessages = useCallback(
    (inputThreads: StoredThread[]): StoredThread[] => {
      if (!activeThreadId) return inputThreads;

      const index = inputThreads.findIndex(
        (thread) => thread.id === activeThreadId,
      );
      if (index === -1) return inputThreads;

      const current = inputThreads[index]!;
      if (fingerprintMessages(current.messages) === fingerprintMessages(messages)) {
        return inputThreads;
      }

      const updated: StoredThread = {
        ...current,
        messages,
        updatedAt: new Date().toISOString(),
        title: deriveThreadTitle(current.title, messages),
      };

      const next = [...inputThreads];
      next[index] = updated;
      next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return next;
    },
    [activeThreadId, messages],
  );

  const threadsWithActiveMessages = useMemo(
    () => applyActiveMessages(threads),
    [applyActiveMessages, threads],
  );

  const threadsRef = useRef<StoredThread[]>(threadsWithActiveMessages);

  useEffect(() => {
    threadsRef.current = threadsWithActiveMessages;
  }, [threadsWithActiveMessages]);

  useEffect(() => {
    saveThreads(userId, threadsWithActiveMessages);
  }, [threadsWithActiveMessages, userId]);

  useEffect(() => {
    let cancelled = false;

    const loadRuns = async () => {
      setRunsLoading(true);
      try {
        const result = await rawApiClient.runs.list({ limit: 30 });
        if (!cancelled) {
          setRuns(result.map(toRunState).sort(sortRuns));
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load background runs.');
        }
      } finally {
        if (!cancelled) {
          setRunsLoading(false);
        }
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      } catch (subscriptionError) {
        if (!controller.signal.aborted) {
          console.error('SSE subscription failed', subscriptionError);
        }
      }
    };

    void subscribe();

    return () => {
      controller.abort();
    };
  }, [userId]);

  const selectThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => applyActiveMessages(prev));
      const thread = threadsRef.current.find((candidate) => candidate.id === threadId);
      setActiveThreadId(threadId);
      setMessages(thread?.messages ?? []);
    },
    [applyActiveMessages, setMessages],
  );

  const createThread = useCallback(() => {
    const next = createEmptyThread();
    setThreads((prev) => [next, ...applyActiveMessages(prev)]);
    setActiveThreadId(next.id);
    setMessages([]);
  }, [applyActiveMessages, setMessages]);

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;

    if (!activeThreadId) {
      createThread();
    }

    void sendMessage({ text });
    setDraft('');
  }, [activeThreadId, createThread, draft, isStreaming, sendMessage]);

  const onQueueRun = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || isQueueingRun || isStreaming) return;

    setIsQueueingRun(true);
    try {
      const run = await rawApiClient.runs.create({
        prompt,
        threadId: activeThreadId ?? undefined,
      });

      setRuns((prev) => upsertRun(prev, toRunState(run)));
      setDraft('');
      toast.success('Background run queued.');
    } catch (queueError) {
      toast.error(readErrorMessage(queueError, 'Failed to queue background run.'));
    } finally {
      setIsQueueingRun(false);
    }
  }, [activeThreadId, draft, isQueueingRun, isStreaming]);

  const onSignOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) {
      toast.error(result.error.message ?? 'Sign out failed.');
      return;
    }

    toast.success('Signed out.');
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* ── Sticky Header ── */}
      <header className="header shrink-0">
        <div className="header-content">
          <LogoMark />
          <div className="flex items-center gap-3">
            <span className="text-meta hidden sm:inline">{userEmail}</span>
            <Button variant="outline" size="sm" onClick={createThread}>
              New Thread
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void onSignOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thread Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
          <div className="p-3 pb-0">
            <p className="page-eyebrow mb-0 px-1">Threads</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {threadsWithActiveMessages.length === 0 ? (
              <div className="empty-state rounded-xl py-6">
                <p className="text-sm text-muted-foreground">No threads yet.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {threadsWithActiveMessages.map((thread, index) => (
                  <li
                    key={thread.id}
                    className={`animate-fade-in stagger-${String(Math.min(index + 1, 6))}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectThread(thread.id)}
                      className={
                        thread.id === activeThreadId
                          ? 'w-full rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-all duration-200'
                          : 'w-full rounded-xl border border-transparent p-3 text-left transition-all duration-200 hover:bg-muted/50'
                      }
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {thread.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {thread.messages.length === 0
                          ? 'No messages yet'
                          : extractMessageText(
                              thread.messages[thread.messages.length - 1]!,
                            )}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="empty-state-lg w-full max-w-md animate-fade-in-up">
                  <div className="empty-state-icon">
                    <EngineIcon size={28} />
                  </div>
                  <p className="empty-state-title">Start a conversation</p>
                  <p className="empty-state-description">
                    Send a message or queue a background run to get started.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === 'user'
                        ? 'ml-auto max-w-[80%] animate-fade-in'
                        : 'mr-auto max-w-[80%] animate-fade-in'
                    }
                  >
                    <p className="text-meta mb-1.5 px-1">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <div
                      className={
                        message.role === 'user'
                          ? 'rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground'
                          : 'card rounded-2xl rounded-bl-md px-4 py-3'
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {extractMessageText(message)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-border bg-card/80 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              {error ? (
                <p className="mb-2 text-sm text-destructive">
                  {error.message || 'Streaming failed.'}
                </p>
              ) : null}

              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Ask anything..."
                className="min-h-[80px] resize-none"
                aria-label="Chat message"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-meta">
                  {isStreaming
                    ? 'Streaming...'
                    : 'Enter to send \u00b7 Shift+Enter for newline'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onQueueRun()}
                    disabled={
                      isQueueingRun || isStreaming || draft.trim().length === 0
                    }
                  >
                    {isQueueingRun ? 'Queueing...' : 'Background Run'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={onSend}
                    disabled={isStreaming || draft.trim().length === 0}
                  >
                    {isStreaming ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Background Runs Sidebar */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card/50 xl:flex">
          <div className="flex items-center justify-between p-3 px-4 pb-0">
            <p className="page-eyebrow mb-0">Runs</p>
            <Badge variant="info" className="text-[10px]">
              {activeRuns} active
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {runsLoading ? (
              <div className="loading-center">
                <Spinner size="sm" />
              </div>
            ) : runs.length === 0 ? (
              <div className="empty-state rounded-xl py-6 px-3">
                <p className="text-xs text-muted-foreground">
                  Queue a run from the composer.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {runs.map((run, index) => (
                  <li
                    key={run.id}
                    className={`card-interactive p-3 animate-fade-in stagger-${String(Math.min(index + 1, 6))}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
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
                      <span className="text-meta">
                        {formatTimestamp(run.lastEventAt ?? run.updatedAt)}
                      </span>
                    </div>

                    <p className="text-sm break-words text-foreground/90">
                      {run.prompt}
                    </p>

                    {run.status === 'processing' && run.progress !== null ? (
                      <div className="mt-2">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${String(run.progress)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-meta">
                          {run.progressMessage ?? 'Processing'} ({run.progress}%)
                        </p>
                      </div>
                    ) : null}

                    {run.status === 'completed' && run.result ? (
                      <div className="mt-2 space-y-1 rounded-lg bg-success/5 border border-success/10 p-2">
                        <p className="text-sm font-medium text-foreground">
                          {run.result.title}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {run.result.summary}
                        </p>
                      </div>
                    ) : null}

                    {run.status === 'failed' ? (
                      <p className="mt-2 text-xs text-destructive">
                        {run.error ?? 'Run failed.'}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Utilities ─── */

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
};

const toRunState = (run: RunRecord): RunState => ({
  ...run,
  progress:
    run.status === 'completed' ? 100 : run.status === 'processing' ? 10 : null,
  progressStep: null,
  progressMessage: null,
  lastEventAt: run.updatedAt,
});

const createRunPlaceholder = (runId: string, timestamp: string): RunState => ({
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

const sortRuns = (a: RunState, b: RunState) =>
  b.updatedAt.localeCompare(a.updatedAt);

const upsertRun = (runs: RunState[], next: RunState): RunState[] => {
  const index = runs.findIndex((run) => run.id === next.id);
  if (index === -1) {
    return [next, ...runs].sort(sortRuns);
  }

  const updated = [...runs];
  updated[index] = next;
  return updated.sort(sortRuns);
};

const updateRun = (
  runs: RunState[],
  runId: string,
  updater: (run: RunState) => RunState,
  fallbackTimestamp: string,
): RunState[] => {
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return upsertRun(runs, updater(createRunPlaceholder(runId, fallbackTimestamp)));
  }

  const next = [...runs];
  next[index] = updater(next[index]!);
  return next.sort(sortRuns);
};

const applyRunEvent = (runs: RunState[], event: SSEEvent): RunState[] => {
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

const formatRunStatus = (status: RunState['status']): string => {
  if (status === 'pending') return 'Queued';
  if (status === 'processing') return 'Processing';
  if (status === 'completed') return 'Completed';
  return 'Failed';
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const createEmptyThread = (): StoredThread => ({
  id: createThreadId(),
  title: 'New chat',
  updatedAt: new Date().toISOString(),
  messages: [],
});

const createThreadId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `thread_${Math.random().toString(36).slice(2)}`;
};

const deriveThreadTitle = (currentTitle: string, messages: UIMessage[]): string => {
  if (currentTitle !== 'New chat') return currentTitle;

  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return currentTitle;

  const text = extractMessageText(firstUserMessage).trim();
  if (!text) return currentTitle;

  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
};

const getStorageKey = (userId: string) => `${STORAGE_NAMESPACE}:${userId}`;

const loadThreads = (userId: string): StoredThread[] => {
  try {
    const raw = globalThis.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as StoredThread[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((thread) => typeof thread?.id === 'string')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
};

const saveThreads = (userId: string, threads: StoredThread[]) => {
  globalThis.localStorage.setItem(getStorageKey(userId), JSON.stringify(threads));
};

const extractMessageText = (message: UIMessage): string => {
  const withParts = message as UIMessage & {
    parts?: Array<{ type: string; text?: string }>;
    content?: unknown;
  };

  if (Array.isArray(withParts.parts)) {
    const text = withParts.parts
      .map((part) => {
        if (
          typeof part === 'object' &&
          part !== null &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }

        return '';
      })
      .join('')
      .trim();

    if (text.length > 0) return text;
  }

  if (typeof withParts.content === 'string') {
    return withParts.content;
  }

  if (Array.isArray(withParts.content)) {
    const text = withParts.content
      .map((part) => {
        if (
          typeof part === 'object' &&
          part !== null &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }

        return '';
      })
      .join('')
      .trim();

    if (text.length > 0) return text;
  }

  return '';
};

const fingerprintMessages = (messages: UIMessage[]): string =>
  messages
    .map((message) => `${message.id}:${message.role}:${extractMessageText(message)}`)
    .join('|');

export function createAppRouter() {
  return createTanstackRouter({
    routeTree,
    basepath: env.PUBLIC_BASE_PATH,
    defaultPreload: 'intent',
    scrollRestoration: true,
    Wrap: function WrapComponent({ children }) {
      return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
      );
    },
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
