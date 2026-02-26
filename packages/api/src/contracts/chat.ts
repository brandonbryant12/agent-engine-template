import { oc, eventIterator, type } from '@orpc/contract';
import {
  WeatherToolInputSchema,
  WeatherToolOutputSchema,
} from '@repo/ai/chat';
import { Schema } from 'effect';
import type { UIMessageChunk } from 'ai';
import { std } from './shared';

const ChatMessageRoleSchema = Schema.Literal('system', 'user', 'assistant');

const ChatMessagePartSchema = Schema.Struct({
  type: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.maxLength(64),
  ),
  text: Schema.optional(
    Schema.String.pipe(Schema.trimmed(), Schema.maxLength(8_000)),
  ),
});

const ChatMessageSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.maxLength(128),
  ),
  role: ChatMessageRoleSchema,
  parts: Schema.Array(ChatMessagePartSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
});

const ChatMessagesInputSchema = Schema.Struct({
  messages: Schema.Array(ChatMessageSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(100),
  ),
});

const ChatMessagesInput = std(ChatMessagesInputSchema);
const ChatStreamOutput = eventIterator(type<UIMessageChunk>());
const WeatherToolInput = std(WeatherToolInputSchema);
const WeatherToolOutput = std(WeatherToolOutputSchema);

const chatContract = oc
  .prefix('/chat')
  .tag('chat')
  .router({
    general: oc
      .route({ method: 'POST', path: '/general' })
      .input(ChatMessagesInput)
      .output(ChatStreamOutput),
    weatherCurrent: oc
      .route({ method: 'POST', path: '/tools/weather/current' })
      .input(WeatherToolInput)
      .output(WeatherToolOutput),
  });

export default chatContract;
