import { invokeWeatherTool, streamGeneralChat } from '@repo/ai/chat';
import type { UIMessage } from 'ai';
import {
  handleEffectWithProtocol,
  handleEffectStreamWithProtocol,
} from '../effect-handler';
import { protectedProcedure } from '../orpc';

interface ChatRouterErrorFactory {
  INPUT_VALIDATION_FAILED?: (options: {
    message: string;
    data?: Record<string, unknown>;
  }) => unknown;
  INTERNAL_ERROR?: (options: {
    message: string;
    data?: Record<string, unknown>;
  }) => unknown;
}

interface ChatContractMessagePart {
  readonly type: string;
  readonly text?: string;
}

interface ChatContractMessage {
  readonly id: string;
  readonly role: 'system' | 'user' | 'assistant';
  readonly parts: readonly ChatContractMessagePart[];
}

const throwInputValidationError = (
  errors: ChatRouterErrorFactory,
  message: string,
  data?: Record<string, unknown>,
): never => {
  const factory = errors.INPUT_VALIDATION_FAILED ?? errors.INTERNAL_ERROR;
  if (factory) {
    throw factory({ message, data });
  }
  throw new Error(message);
};

export const decodeChatContractMessages = (
  messages: readonly ChatContractMessage[],
  errors: ChatRouterErrorFactory,
): UIMessage[] =>
  messages.map((message, messageIndex) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.map((part, partIndex) => {
      if (part.type !== 'text') {
        return throwInputValidationError(
          errors,
          'Unsupported chat message part type',
          {
            messageIndex,
            partIndex,
            partType: part.type,
          },
        );
      }

      if (typeof part.text !== 'string' || part.text.length === 0) {
        return throwInputValidationError(
          errors,
          'Chat text message parts must include non-empty text',
          {
            messageIndex,
            partIndex,
          },
        );
      }

      return {
        type: 'text' as const,
        text: part.text,
      };
    }),
  }));

const chatRouter = {
  general: protectedProcedure.chat.general.handler(
    async ({ context, input, errors }) => {
      const messages = decodeChatContractMessages(input.messages, errors);

      return handleEffectStreamWithProtocol(
        context.runtime,
        context.user,
        streamGeneralChat({
          messages,
        }),
        errors,
        { requestId: context.requestId, span: 'api.chat.general' },
      );
    },
  ),
  weatherCurrent: protectedProcedure.chat.weatherCurrent.handler(
    async ({ context, input, errors }) =>
      handleEffectWithProtocol(
        context.runtime,
        context.user,
        invokeWeatherTool({
          input,
          executionContext: 'interactive-chat',
          user: context.user
            ? { id: context.user.id, role: context.user.role }
            : null,
        }),
        errors,
        { requestId: context.requestId, span: 'api.chat.weatherCurrent' },
      ),
  ),
};

export default chatRouter;
