import { oc } from '@orpc/contract';
import { Schema } from 'effect';
import { CoerceNumber, std } from './shared';

const RunStatusSchema = Schema.Literal(
  'pending',
  'processing',
  'completed',
  'failed',
);

export const RunResultSchema = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  keyPoints: Schema.Array(Schema.String),
  nextActions: Schema.Array(Schema.String),
});

const RunOutputSchema = Schema.Struct({
  id: Schema.String,
  status: RunStatusSchema,
  prompt: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  result: Schema.NullOr(RunResultSchema),
  error: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
});

const CreateRunInputSchema = Schema.Struct({
  prompt: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.maxLength(4000),
  ),
  threadId: Schema.optional(
    Schema.String.pipe(Schema.trimmed(), Schema.maxLength(128)),
  ),
});

const ListRunsInputSchema = Schema.Struct({
  limit: Schema.optional(
    CoerceNumber.pipe(
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(50),
    ),
  ),
});

const runsContract = oc
  .prefix('/runs')
  .tag('runs')
  .router({
    create: oc
      .route({
        method: 'POST',
        path: '/',
        summary: 'Create run',
        description: 'Queue a background AI run and track progress via SSE.',
      })
      .input(std(CreateRunInputSchema))
      .output(std(RunOutputSchema)),

    list: oc
      .route({
        method: 'GET',
        path: '/',
        summary: 'List runs',
        description: 'List background AI runs for the current user.',
      })
      .input(std(ListRunsInputSchema))
      .output(std(Schema.Array(RunOutputSchema))),
  });

export type RunResult = typeof RunResultSchema.Type;
export type RunOutput = typeof RunOutputSchema.Type;
export type RunStatus = typeof RunStatusSchema.Type;
export type CreateRunInput = typeof CreateRunInputSchema.Type;

export default runsContract;
