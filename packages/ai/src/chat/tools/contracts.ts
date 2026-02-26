import { Schema } from 'effect';

export const ToolInvocationStateSchema = Schema.Literal(
  'idle',
  'validating',
  'running',
  'succeeded',
  'failed',
  'timed_out',
  'cancelled',
  'retrying',
);

export type ToolInvocationState = Schema.Schema.Type<
  typeof ToolInvocationStateSchema
>;

export const WeatherToolInputSchema = Schema.Struct({
  latitude: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(-90),
    Schema.lessThanOrEqualTo(90),
  ),
  longitude: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(-180),
    Schema.lessThanOrEqualTo(180),
  ),
  locationLabel: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.maxLength(80),
  ),
});

export type WeatherToolInput = Schema.Schema.Type<typeof WeatherToolInputSchema>;

export const WeatherToolOutputSchema = Schema.Struct({
  locationLabel: Schema.String,
  observedAtIso: Schema.String,
  weatherSummary: Schema.String,
  temperature: Schema.Struct({
    value: Schema.Number,
    unit: Schema.Literal('Celsius'),
  }),
  windSpeed: Schema.Struct({
    value: Schema.Number,
    unit: Schema.Literal('km/h'),
  }),
  windDirection: Schema.Struct({
    value: Schema.Number,
    unit: Schema.Literal('degrees'),
  }),
  source: Schema.Literal('open-meteo'),
});

export type WeatherToolOutput = Schema.Schema.Type<typeof WeatherToolOutputSchema>;
