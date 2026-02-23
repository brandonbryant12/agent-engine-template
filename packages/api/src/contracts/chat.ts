import { oc, eventIterator, type } from '@orpc/contract';
import type { UIMessage, UIMessageChunk } from 'ai';

const ChatMessagesInput = type<{ messages: UIMessage[] }>();
const ChatStreamOutput = eventIterator(type<UIMessageChunk>());

const chatContract = oc
  .prefix('/chat')
  .tag('chat')
  .router({
    general: oc
      .route({ method: 'POST', path: '/general' })
      .input(ChatMessagesInput)
      .output(ChatStreamOutput),
  });

export default chatContract;
