import { streamGeneralChat } from '@repo/ai/chat';
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
        streamGeneralChat({ messages: input.messages }),
        errors,
        { requestId: context.requestId, span: 'api.chat.general' },
      ),
  ),
};

export default chatRouter;
