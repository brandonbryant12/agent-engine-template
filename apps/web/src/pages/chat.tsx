import { useChat } from '@ai-sdk/react';
import { eventIteratorToUnproxiedDataStream } from '@repo/api/client';
import { Button } from '@repo/ui/components/button';
import { Textarea } from '@repo/ui/components/textarea';
import { useNavigate } from '@tanstack/react-router';
import { type UIMessage } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { rawApiClient } from '@/clients/api-client';
import { authClient } from '@/clients/auth-client';
import { EngineIcon } from '@/components/logo';
import {
  type StoredThread,
  createEmptyThread,
  deriveThreadTitle,
  extractMessageText,
  fingerprintMessages,
  loadThreads,
  saveThreads,
} from '@/lib/chat-utils';
import { readErrorMessage } from '@/lib/run-utils';

export function ChatPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? '';
  const navigate = useNavigate();

  const hydratedThreads = useMemo(() => {
    const loaded = loadThreads(userId);
    return loaded.length > 0 ? loaded : [createEmptyThread()];
  }, [userId]);

  const [threads, setThreads] = useState<StoredThread[]>(() => hydratedThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => hydratedThreads[0]?.id ?? null,
  );
  const [draft, setDraft] = useState('');
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

  const applyActiveMessages = useCallback(
    (inputThreads: StoredThread[]): StoredThread[] => {
      if (!activeThreadId) return inputThreads;

      const index = inputThreads.findIndex(
        (thread) => thread.id === activeThreadId,
      );
      if (index === -1) return inputThreads;

      const current = inputThreads[index]!;
      if (
        fingerprintMessages(current.messages) ===
        fingerprintMessages(messages)
      ) {
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

  const selectThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => applyActiveMessages(prev));
      const thread = threadsRef.current.find(
        (candidate) => candidate.id === threadId,
      );
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
      await rawApiClient.runs.create({
        prompt,
        threadId: activeThreadId ?? undefined,
      });
      setDraft('');
      toast.success('Background run queued.', {
        action: {
          label: 'View Jobs',
          onClick: () => void navigate({ to: '/jobs' }),
        },
      });
    } catch (queueError) {
      toast.error(
        readErrorMessage(queueError, 'Failed to queue background run.'),
      );
    } finally {
      setIsQueueingRun(false);
    }
  }, [activeThreadId, draft, isQueueingRun, isStreaming, navigate]);

  return (
    <div className="flex h-full">
      {/* Thread Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex items-center justify-between p-3">
          <p className="page-eyebrow mb-0 px-1">Threads</p>
          <Button variant="ghost" size="sm" onClick={createThread}>
            + New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 pt-0">
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
    </div>
  );
}
