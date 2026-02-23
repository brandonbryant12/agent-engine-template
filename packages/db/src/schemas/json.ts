import { Schema } from 'effect';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

const JsonPrimitiveSchema = Schema.Union(
  Schema.String,
  Schema.JsonNumber,
  Schema.Boolean,
  Schema.Null,
);

export const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union(
    JsonPrimitiveSchema,
    Schema.Array(JsonValueSchema),
    Schema.Record({ key: Schema.String, value: JsonValueSchema }),
  ),
);

export const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: JsonValueSchema,
});
