import { Layer, Effect } from 'effect';
import {
  ImageGen,
  type ImageGenService,
  type GenerateImageResult,
  ImageGenError,
} from '..';

export interface MockImageGenOptions {
  delay?: number;
  imageData?: Buffer;
  shouldRejectContent?: boolean;
}

/** 1x1 transparent PNG for fast tests. */
const MOCK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export function createMockImageGen(
  options: MockImageGenOptions = {},
): Layer.Layer<ImageGen> {
  const {
    delay = 0,
    imageData = MOCK_PNG,
    shouldRejectContent = false,
  } = options;

  const service: ImageGenService = {
    generateImage: (_opts) =>
      Effect.gen(function* () {
        if (delay > 0) {
          yield* Effect.sleep(delay);
        }

        if (shouldRejectContent) {
          return yield* new ImageGenError({
            message: 'Content was filtered by safety settings',
          });
        }

        return {
          imageData,
          mimeType: 'image/png',
        } satisfies GenerateImageResult;
      }),
  };

  return Layer.succeed(ImageGen, service);
}

export const MockImageGenLive = createMockImageGen();

export const MockImageGenWithLatency = createMockImageGen({ delay: 8_000 });
