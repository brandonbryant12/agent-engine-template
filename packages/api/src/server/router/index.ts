import chatRouter from './chat';
import eventsRouter from './events';
import runsRouter from './runs';

export const appRouter = {
  chat: chatRouter,
  events: eventsRouter,
  runs: runsRouter,
};
