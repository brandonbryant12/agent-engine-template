import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModel,
} from 'ai';
import { Effect } from 'effect';
import { LLM } from '../../llm/service';
import { resolvePrompt } from '../prompts';

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
    Effect.annotateLogs('prompt.failure_reason', prompt.fallbackReason),
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
      key: 'chat.general.system',
      channel: 'chat.general',
      version: input.promptVersion,
      compatibilityMode: input.promptCompatibilityMode ?? 'legacy-inline-fallback',
      legacyFallback: `You are the default AI assistant for Agent Engine Template.

Guidelines:
- Be concise, clear, and practical.
- Prefer structured answers when they help readability.
- If you are uncertain, state assumptions explicitly.
- Ask one clarifying question only when required.
- Do not invent capabilities that are not requested.`,
    }).pipe(
      Effect.withSpan('prompt.resolveForGeneralChat', {
        captureStackTrace: false,
        attributes: {
          'prompt.key': 'chat.general.system',
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

    return result.toUIMessageStream();
  }).pipe(
    Effect.withSpan('useCase.streamGeneralChat', {
      attributes: {
        'chat.messageCount': input.messages.length,
      },
    }),
  );
