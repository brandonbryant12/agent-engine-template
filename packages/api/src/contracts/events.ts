/**
 * Server-Sent Events (SSE) event types for real-time updates.
 */

import { oc, eventIterator } from '@orpc/contract';
import { Schema } from 'effect';
import { RunResultSchema, type RunResult } from './runs';
import { std } from './shared';

export interface ConnectionEvent {
  type: 'connected';
  userId: string;
}

export interface RunQueuedEvent {
  type: 'run_queued';
  runId: string;
  prompt: string;
  threadId: string | null;
  timestamp: string;
}

export interface RunStartedEvent {
  type: 'run_started';
  runId: string;
  timestamp: string;
}

export interface RunProgressEvent {
  type: 'run_progress';
  runId: string;
  step: 'planning' | 'generating' | 'finalizing';
  progress: number;
  message: string;
  timestamp: string;
}

export interface RunCompletedEvent {
  type: 'run_completed';
  runId: string;
  result: RunResult;
  timestamp: string;
}

export interface RunFailedEvent {
  type: 'run_failed';
  runId: string;
  error: string;
  timestamp: string;
}

export type SSEEvent =
  | ConnectionEvent
  | RunQueuedEvent
  | RunStartedEvent
  | RunProgressEvent
  | RunCompletedEvent
  | RunFailedEvent;

const ConnectionEventSchema = Schema.Struct({
  type: Schema.Literal('connected'),
  userId: Schema.String,
});

const RunQueuedEventSchema = Schema.Struct({
  type: Schema.Literal('run_queued'),
  runId: Schema.String,
  prompt: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  timestamp: Schema.String,
});

const RunStartedEventSchema = Schema.Struct({
  type: Schema.Literal('run_started'),
  runId: Schema.String,
  timestamp: Schema.String,
});

const RunProgressEventSchema = Schema.Struct({
  type: Schema.Literal('run_progress'),
  runId: Schema.String,
  step: Schema.Literal('planning', 'generating', 'finalizing'),
  progress: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(100),
  ),
  message: Schema.String,
  timestamp: Schema.String,
});

const RunCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('run_completed'),
  runId: Schema.String,
  result: RunResultSchema,
  timestamp: Schema.String,
});

const RunFailedEventSchema = Schema.Struct({
  type: Schema.Literal('run_failed'),
  runId: Schema.String,
  error: Schema.String,
  timestamp: Schema.String,
});

const SSEEventSchema = Schema.Union(
  ConnectionEventSchema,
  RunQueuedEventSchema,
  RunStartedEventSchema,
  RunProgressEventSchema,
  RunCompletedEventSchema,
  RunFailedEventSchema,
);

const eventsContract = oc
  .prefix('/events')
  .tag('events')
  .router({
    subscribe: oc
      .route({ method: 'GET', path: '/' })
      .output(eventIterator(std(SSEEventSchema))),
  });

export default eventsContract;
