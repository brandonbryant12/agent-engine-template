import { type UIMessage } from 'ai';

const STORAGE_NAMESPACE = 'agent-engine-template.chat.threads';

export interface StoredThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: UIMessage[];
}

export const createThreadId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `thread_${Math.random().toString(36).slice(2)}`;
};

export const createEmptyThread = (): StoredThread => ({
  id: createThreadId(),
  title: 'New chat',
  updatedAt: new Date().toISOString(),
  messages: [],
});

export const extractMessageText = (message: UIMessage): string => {
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

export const deriveThreadTitle = (
  currentTitle: string,
  messages: UIMessage[],
): string => {
  if (currentTitle !== 'New chat') return currentTitle;

  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return currentTitle;

  const text = extractMessageText(firstUserMessage).trim();
  if (!text) return currentTitle;

  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
};

export const fingerprintMessages = (messages: UIMessage[]): string =>
  messages
    .map(
      (message) =>
        `${message.id}:${message.role}:${extractMessageText(message)}`,
    )
    .join('|');

const getStorageKey = (userId: string) => `${STORAGE_NAMESPACE}:${userId}`;

export const loadThreads = (userId: string): StoredThread[] => {
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

export const saveThreads = (userId: string, threads: StoredThread[]) => {
  globalThis.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(threads),
  );
};
