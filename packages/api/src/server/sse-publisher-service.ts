import { Context, Effect, Layer, Schedule } from 'effect';
import type { SSEEvent } from '../contracts/events';
import { ssePublisher } from './publisher';

export interface SSEPublisherService {
  readonly publish: (
    userId: string,
    event: SSEEvent,
  ) => Effect.Effect<void, Error>;
}

export class SSEPublisher extends Context.Tag('@repo/api/SSEPublisher')<
  SSEPublisher,
  SSEPublisherService
>() {}

export const SSEPublisherLive = Layer.succeed(SSEPublisher, {
  publish: (userId, event) =>
    Effect.try({
      try: () => {
        ssePublisher.publish(userId, event);
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
    }).pipe(
      Effect.tapError((error) =>
        Effect.logWarning('sse.publish.retry').pipe(
          Effect.annotateLogs('sse.user.id', userId),
          Effect.annotateLogs('sse.event.type', event.type),
          Effect.annotateLogs('sse.error.message', error.message),
        ),
      ),
      Effect.retry(Schedule.recurs(2)),
      Effect.tapError((error) =>
        Effect.logWarning('sse.publish.failed').pipe(
          Effect.annotateLogs('sse.user.id', userId),
          Effect.annotateLogs('sse.event.type', event.type),
          Effect.annotateLogs('sse.error.message', error.message),
        ),
      ),
    ),
});
