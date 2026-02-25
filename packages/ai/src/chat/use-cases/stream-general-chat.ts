import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModel,
} from 'ai';
import { Effect } from 'effect';
import { LLM } from '../../llm/service';
import {
  GENERAL_CHAT_LEGACY_INLINE_FALLBACK,
  GENERAL_CHAT_PROMPT_CHANNEL,
  GENERAL_CHAT_PROMPT_KEY,
  resolvePrompt,
} from '../prompts';

export interface StreamGeneralChatInput {
  readonly messages: UIMessage[];
  readonly promptVersion?: string;
  readonly promptCompatibilityMode?: 'off' | 'legacy-inline-fallback';
}

const logPromptDecision = (
  policy: 'explicitVersion' | 'channelDefault',
  prompt: {
    key: string;
    version: string;
    outcome: string;
    fallbackReason?: string;
  },
) => {
  const logEffect =
    prompt.outcome === 'compatibility-fallback'
      ? Effect.logWarning('prompt.decision')
      : Effect.logInfo('prompt.decision');

  const baseLog = logEffect.pipe(
    Effect.annotateLogs('prompt.key', prompt.key),
    Effect.annotateLogs('prompt.version', prompt.version),
    Effect.annotateLogs('prompt.policy', policy),
    Effect.annotateLogs('prompt.outcome', prompt.outcome),
  );

  if (!prompt.fallbackReason) {
    return baseLog;
  }

  return baseLog.pipe(
    Effect.annotateLogs('prompt.failureReason', prompt.fallbackReason),
  );
};

export const streamGeneralChat = (input: StreamGeneralChatInput) =>
  Effect.gen(function* () {
    const llm = yield* LLM;
    const model = llm.model as LanguageModel;
    const promptPolicy = input.promptVersion
      ? 'explicitVersion'
      : 'channelDefault';
    const prompt = yield* resolvePrompt({
      key: GENERAL_CHAT_PROMPT_KEY,
      channel: GENERAL_CHAT_PROMPT_CHANNEL,
      version: input.promptVersion,
      compatibilityMode: input.promptCompatibilityMode ?? 'legacy-inline-fallback',
      legacyFallback: GENERAL_CHAT_LEGACY_INLINE_FALLBACK,
    }).pipe(
      Effect.withSpan('prompt.resolveForGeneralChat', {
        captureStackTrace: false,
        attributes: {
          'prompt.key': GENERAL_CHAT_PROMPT_KEY,
          'prompt.policy': promptPolicy,
        },
      }),
    );

    const modelMessages = yield* Effect.promise(() =>
      convertToModelMessages(input.messages),
    );

    const result = streamText({
      model,
      system: prompt.content,
      messages: modelMessages,
      maxOutputTokens: 1024,
      temperature: 0.4,
    });

    yield* logPromptDecision(promptPolicy, prompt);

    return yield* Effect.sync(() => result.toUIMessageStream()).pipe(
      Effect.withSpan('useCase.streamGeneralChat', {
        attributes: {
          'chat.messageCount': input.messages.length,
          'prompt.key': prompt.key,
          'prompt.version': prompt.version,
          'prompt.policy': prompt.policy,
          'prompt.outcome': prompt.outcome,
          ...(prompt.fallbackReason
            ? { 'prompt.failureReason': prompt.fallbackReason }
            : {}),
        },
      }),
    );
  });
