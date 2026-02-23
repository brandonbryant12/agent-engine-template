import { streamGeneralChat } from '@repo/ai/chat';
import type { UIMessage } from 'ai';
import {
  handleEffectStreamWithProtocol,
} from '../effect-handler';
import { protectedProcedure } from '../orpc';

const chatRouter = {
  general: protectedProcedure.chat.general.handler(
    async ({ context, input, errors }) =>
      handleEffectStreamWithProtocol(
        context.runtime,
        context.user,
        streamGeneralChat({
          messages: input.messages as unknown as UIMessage[],
        }),
        errors,
        { requestId: context.requestId, span: 'api.chat.general' },
      ),
  ),
};

export default chatRouter;
