import { protectedProcedure } from '../orpc';
import { ssePublisher } from '../publisher';

const eventsRouter = {
  // Intentional exception: SSE is an async generator contract and cannot use
  // Effect protocol helpers without changing stream semantics.
  subscribe: protectedProcedure.events.subscribe.handler(async function* ({
    context,
    signal,
  }) {
    yield { type: 'connected' as const, userId: context.user.id };

    for await (const event of ssePublisher.subscribe(context.user.id, {
      signal,
    })) {
      yield event;
    }
  }),
};

export default eventsRouter;
