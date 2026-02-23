import { Effect, Schema } from 'effect';

export class SerializationError extends Schema.TaggedError<SerializationError>()(
  'SerializationError',
  {
    entity: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  static readonly httpStatus = 500 as const;
  static readonly httpCode = 'INTERNAL_ERROR' as const;
  static readonly httpMessage = 'Serialization failed';
  static readonly logLevel = 'error' as const;
  static getData(e: SerializationError) {
    return { entity: e.entity };
  }
}

export const createEffectSerializer = <DbType, OutputType>(
  entityName: string,
  transform: (entity: DbType) => OutputType,
) => {
  return (entity: DbType): Effect.Effect<OutputType, SerializationError> =>
    Effect.try({
      try: () => transform(entity),
      catch: (cause) =>
        new SerializationError({
          entity: entityName,
          message: `Failed to serialize ${entityName}`,
          cause,
        }),
    }).pipe(
      Effect.withSpan(`serialize.${entityName}`, {
        attributes: { 'serialization.entity': entityName },
      }),
    );
};

export const createBatchEffectSerializer = <DbType, OutputType>(
  entityName: string,
  transform: (entity: DbType) => OutputType,
) => {
  const serialize = createEffectSerializer(entityName, transform);

  return (
    entities: readonly DbType[],
  ): Effect.Effect<OutputType[], SerializationError> =>
    Effect.all(entities.map(serialize), { concurrency: 'unbounded' }).pipe(
      Effect.withSpan(`serialize.${entityName}.batch`, {
        attributes: {
          'serialization.entity': entityName,
          'serialization.count': entities.length,
        },
      }),
    );
};

export const createSyncSerializer = <DbType, OutputType>(
  transform: (entity: DbType) => OutputType,
): ((entity: DbType) => OutputType) => transform;
