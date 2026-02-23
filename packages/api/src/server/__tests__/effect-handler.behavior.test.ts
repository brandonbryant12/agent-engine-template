import { Effect, Layer, ManagedRuntime } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerRuntime } from '../runtime';
import {
  handleEffectWithProtocol,
  type ErrorFactory,
  type HandleEffectOptions,
} from '../effect-handler';

interface FactoryOptions {
  message: string;
  data?: unknown;
}

interface ProtocolErrorPayload {
  code: string;
  status: number;
  message: string;
  data?: unknown;
}

type SerializedFiberFailure = {
  cause?: {
    _tag?: string;
    defect?: ProtocolErrorPayload;
  };
};

const createFactory =
  (code: string, status: number) =>
  (options: FactoryOptions): ProtocolErrorPayload => ({
    code,
    status,
    message: options.message,
    data: options.data,
  });

const createErrors = (): ErrorFactory & {
  CONFLICT: (options: FactoryOptions) => ProtocolErrorPayload;
  INTERNAL_ERROR: (options: FactoryOptions) => ProtocolErrorPayload;
  NOT_FOUND: (options: FactoryOptions) => ProtocolErrorPayload;
} => ({
  CONFLICT: createFactory('CONFLICT', 409),
  INTERNAL_ERROR: createFactory('INTERNAL_ERROR', 500),
  NOT_FOUND: createFactory('NOT_FOUND', 404),
});

const createRuntime = (): ServerRuntime =>
  ManagedRuntime.make(Layer.empty) as unknown as ServerRuntime;

const extractDieDefect = (error: unknown): ProtocolErrorPayload | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  const serialized = JSON.parse(JSON.stringify(error)) as SerializedFiberFailure;
  if (serialized.cause?._tag !== 'Die') {
    return null;
  }

  return serialized.cause.defect ?? null;
};

class TaggedConflictError extends Error {
  readonly _tag = 'TaggedConflictError';
  static readonly httpStatus = 409;
  static readonly httpCode = 'CONFLICT';
  static readonly httpMessage = 'Tagged conflict';
  static readonly logLevel = 'silent' as const;
}

const createOptions = (requestId: string): HandleEffectOptions => ({
  span: 'api.tests.effect-handler',
  requestId,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleEffectWithProtocol', () => {
  it('maps tagged failures with protocol metadata', async () => {
    const thrown = await handleEffectWithProtocol(
      createRuntime(),
      null,
      Effect.fail(new TaggedConflictError()),
      createErrors(),
      createOptions('req-tagged'),
    ).catch((error) => error);

    const defect = extractDieDefect(thrown);
    expect(defect).not.toBeNull();
    expect(defect).toMatchObject({
      code: 'CONFLICT',
      status: 409,
      message: 'Tagged conflict',
    });
  });

  it('preserves custom tagged-error override behavior', async () => {
    const errors = createErrors();
    let receivedTag: string | null = null;

    const thrown = await handleEffectWithProtocol(
      createRuntime(),
      null,
      Effect.fail(new TaggedConflictError()),
      errors,
      createOptions('req-custom'),
      {
        TaggedConflictError: (error: unknown): never => {
          if (error instanceof TaggedConflictError) {
            receivedTag = error._tag;
          }
          throw errors.NOT_FOUND({ message: 'custom override' });
        },
      },
    ).catch((error) => error);

    const defect = extractDieDefect(thrown);
    expect(receivedTag).toBe('TaggedConflictError');
    expect(defect).not.toBeNull();
    expect(defect).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      message: 'custom override',
    });
  });

  it('maps defects to INTERNAL_ERROR and logs request correlation/failure class', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const thrown = await handleEffectWithProtocol(
      createRuntime(),
      null,
      Effect.die(new Error('boom')),
      createErrors(),
      createOptions('req-defect'),
    ).catch((error) => error);

    const defect = extractDieDefect(thrown);
    expect(defect).not.toBeNull();
    expect(defect).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
      message: 'An unexpected error occurred',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[effect-handler] Falling back to INTERNAL_ERROR',
      expect.objectContaining({
        'request.id': 'req-defect',
        failureClass: 'defect',
      }),
    );
  });
});
