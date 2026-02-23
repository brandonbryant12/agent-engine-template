import { Context, Effect, Layer } from 'effect';
import type { SSEEvent } from '../contracts/events';
import { ssePublisher } from './publisher';

export interface SSEPublisherService {
  readonly publish: (
    userId: string,
    event: SSEEvent,
  ) => Effect.Effect<void, never>;
}

export class SSEPublisher extends Context.Tag('@repo/api/SSEPublisher')<
  SSEPublisher,
  SSEPublisherService
>() {}

export const SSEPublisherLive = Layer.succeed(SSEPublisher, {
  publish: (userId, event) =>
    Effect.sync(() => {
      ssePublisher.publish(userId, event);
    }),
});
