import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModel,
} from 'ai';
import { Effect } from 'effect';
import { LLM } from '../../llm/service';

const GENERAL_CHAT_SYSTEM_PROMPT = `You are the default AI assistant for Template App.

Guidelines:
- Be concise, clear, and practical.
- Prefer structured answers when they help readability.
- If you are uncertain, state assumptions explicitly.
- Ask one clarifying question only when required.
- Do not invent capabilities that are not requested.`;

export interface StreamGeneralChatInput {
  readonly messages: UIMessage[];
}

export const streamGeneralChat = (input: StreamGeneralChatInput) =>
  Effect.gen(function* () {
    const llm = yield* LLM;
    const model = llm.model as LanguageModel;

    const modelMessages = yield* Effect.promise(() =>
      convertToModelMessages(input.messages),
    );

    const result = streamText({
      model,
      system: GENERAL_CHAT_SYSTEM_PROMPT,
      messages: modelMessages,
      maxOutputTokens: 1024,
      temperature: 0.4,
    });

    return result.toUIMessageStream();
  }).pipe(
    Effect.withSpan('useCase.streamGeneralChat', {
      attributes: { 'chat.messageCount': input.messages.length },
    }),
  );
