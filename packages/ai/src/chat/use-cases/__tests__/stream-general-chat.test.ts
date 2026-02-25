import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from 'ai';
import { LLM } from '../../../llm/service';
import { streamGeneralChat } from '../stream-general-chat';

const streamTextMock = vi.fn();
const convertToModelMessagesMock = vi.fn();

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
  convertToModelMessages: (...args: unknown[]) => convertToModelMessagesMock(...args),
}));

const testMessages: UIMessage[] = [
  {
    id: 'msg_1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
  } as UIMessage,
];

const withLLM = Effect.provide(
  Layer.succeed(LLM, {
    model: { provider: 'mock' },
    generate: () => Effect.die('unused in stream test'),
  }),
);

describe('streamGeneralChat', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    convertToModelMessagesMock.mockReset();
    convertToModelMessagesMock.mockResolvedValue([{ role: 'user', content: 'hello' }]);
    streamTextMock.mockReturnValue({
      toUIMessageStream: () => ({ mocked: true }),
    });
  });

  it('uses channel default prompt from registry', async () => {
    const stream = await Effect.runPromise(
      streamGeneralChat({ messages: testMessages }).pipe(withLLM),
    );

    expect(stream).toEqual({ mocked: true });
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(streamTextMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        system: expect.stringContaining('default AI assistant for Agent Engine Template'),
      }),
    );
  });

  it('uses explicit prompt version when provided', async () => {
    await Effect.runPromise(
      streamGeneralChat({
        messages: testMessages,
        promptVersion: 'v2',
      }).pipe(withLLM),
    );

    expect(streamTextMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        system: expect.stringContaining('Use numbered lists for multi-step responses'),
      }),
    );
  });

  it('uses legacy fallback when prompt resolution fails and compatibility mode is enabled', async () => {
    await Effect.runPromise(
      streamGeneralChat({
        messages: testMessages,
        promptVersion: 'v404',
        promptCompatibilityMode: 'legacy-inline-fallback',
      }).pipe(withLLM),
    );

    expect(streamTextMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        system: expect.stringContaining('default AI assistant for Agent Engine Template'),
      }),
    );
  });

  it('fails with typed resolver error when compatibility mode is disabled', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        streamGeneralChat({
          messages: testMessages,
          promptVersion: 'v404',
          promptCompatibilityMode: 'off',
        }).pipe(withLLM),
      ),
    );

    expect(error._tag).toBe('PromptVersionNotFoundError');
  });
});
