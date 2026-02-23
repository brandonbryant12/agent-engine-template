import { useChat } from '@ai-sdk/react';
import {
  eventIteratorToUnproxiedDataStream,
  type RouterOutput,
} from '@repo/api/client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Toaster } from '@repo/ui/components/sonner';
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

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

function HomePage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
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
    <section className="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
      <div className="w-full space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Badge variant="info">AI Chat MVP</Badge>
        <h1 className="text-2xl font-semibold">Agent Engine Template Chat</h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'signin'
            ? 'Sign in to continue your chat threads.'
            : 'Create an account to start chatting.'}
        </p>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email"
          />
          <Input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Password"
          />
          <Button onClick={() => void onSubmit()} disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'signin'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
        >
          {mode === 'signin'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </Button>
      </div>
    </section>
  );
}

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
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <Badge variant="success">Authenticated</Badge>
          <h1 className="mt-1 text-2xl font-semibold">AI Chat MVP</h1>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={createThread}>
            New Thread
          </Button>
          <Button variant="ghost" onClick={() => void onSignOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <p className="text-sm font-medium">Previous Threads</p>

          {threadsWithActiveMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No threads yet.</p>
          ) : (
            <ul className="space-y-2">
              {threadsWithActiveMessages.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => selectThread(thread.id)}
                    className={
                      thread.id === activeThreadId
                        ? 'w-full rounded-lg border border-primary/40 bg-primary/10 p-2 text-left'
                        : 'w-full rounded-lg border border-border p-2 text-left hover:bg-muted'
                    }
                  >
                    <p className="truncate text-sm font-medium">{thread.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
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
        </aside>

        <div className="flex min-h-[560px] flex-col rounded-2xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Start a new conversation in this thread.
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'ml-auto max-w-[85%] rounded-xl bg-primary px-4 py-3 text-primary-foreground'
                      : 'mr-auto max-w-[85%] rounded-xl border border-border bg-muted/40 px-4 py-3'
                  }
                >
                  <p className="mb-1 text-xs uppercase tracking-wide opacity-70">
                    {message.role}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {extractMessageText(message)}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="border-t border-border p-4">
            {error ? (
              <p className="mb-2 text-sm text-destructive">
                {error.message || 'Streaming failed.'}
              </p>
            ) : null}

            <div className="space-y-2">
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
                className="min-h-[96px]"
                aria-label="Chat message"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isStreaming
                    ? 'Streaming response...'
                    : 'Enter sends chat. Background runs execute asynchronously.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void onQueueRun()}
                    disabled={
                      isQueueingRun || isStreaming || draft.trim().length === 0
                    }
                  >
                    {isQueueingRun ? 'Queueing...' : 'Run in Background'}
                  </Button>
                  <Button
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

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Background Runs</p>
            <Badge variant="info">{activeRuns} active</Badge>
          </div>

          {runsLoading ? (
            <p className="text-sm text-muted-foreground">Loading runs...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Queue a run from the composer to test jobs + SSE.
            </p>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="rounded-xl border border-border bg-background/50 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatRunStatus(run.status)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTimestamp(run.lastEventAt ?? run.updatedAt)}
                    </p>
                  </div>

                  <p className="text-sm break-words">{run.prompt}</p>

                  {run.status === 'processing' && run.progress !== null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {run.progressMessage ?? 'Processing'} ({run.progress}%)
                    </p>
                  ) : null}

                  {run.status === 'completed' && run.result ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {run.result.title}
                      </p>
                      <p className="break-words">{run.result.summary}</p>
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
        </aside>
      </div>
    </section>
  );
}

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
