import { GoogleGenAI } from '@google/genai';
import { Effect, Layer } from 'effect';
import {
  ImageGenError,
  ImageGenRateLimitError,
  ImageGenContentFilteredError,
} from '../../errors';
import { IMAGE_GEN_MODEL } from '../../models';
import {
  ImageGen,
  type ImageGenService,
  type GenerateImageOptions,
  type GenerateImageResult,
} from '../service';

/**
 * Configuration for Google Image Gen provider.
 */
export interface GoogleImageGenConfig {
  readonly apiKey: string;
  readonly model?: string;
}

/**
 * Format to dimension hint for prompting.
 * The model uses the prompt + aspect ratio hint to generate appropriately.
 */
const FORMAT_HINTS: Record<GenerateImageOptions['format'], string> = {
  portrait: '1080x1920 portrait aspect ratio (9:16)',
  square: '1080x1080 square aspect ratio (1:1)',
  landscape: '1920x1080 landscape aspect ratio (16:9)',
  og_card: '1200x630 wide landscape aspect ratio (approximately 1.9:1)',
};

/**
 * Map API errors to domain errors.
 */
const mapError = (
  error: unknown,
): ImageGenError | ImageGenRateLimitError | ImageGenContentFilteredError => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('rate limit') || msg.includes('429')) {
      return new ImageGenRateLimitError({
        message: error.message,
      });
    }

    if (
      msg.includes('safety') ||
      msg.includes('blocked') ||
      msg.includes('content filter') ||
      msg.includes('prohibited')
    ) {
      return new ImageGenContentFilteredError({
        message: error.message,
      });
    }

    return new ImageGenError({
      message: error.message,
      cause: error,
    });
  }

  return new ImageGenError({
    message: 'Unknown image generation error',
    cause: error,
  });
};

/**
 * Create Google Image Gen service implementation via native SDK.
 */
const makeGoogleImageGenService = (
  config: GoogleImageGenConfig,
): ImageGenService => {
  const modelId = config.model ?? IMAGE_GEN_MODEL;

  const genAI = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    generateImage: (options: GenerateImageOptions) =>
      Effect.tryPromise({
        try: async (): Promise<GenerateImageResult> => {
          const formatHint = FORMAT_HINTS[options.format];
          const fullPrompt = `${options.prompt}\n\nGenerate this as a ${formatHint} image.`;

          // Build multimodal content when a reference image is provided
          const contents = options.referenceImage
            ? [
                {
                  inlineData: {
                    data: options.referenceImage.data.toString('base64'),
                    mimeType: options.referenceImage.mimeType,
                  },
                },
                { text: fullPrompt },
              ]
            : fullPrompt;

          const response = await genAI.models.generateContent({
            model: modelId,
            contents,
            config: {
              responseModalities: ['IMAGE', 'TEXT'],
            },
          });

          const parts = response.candidates?.[0]?.content?.parts;
          if (!parts || parts.length === 0) {
            throw new Error('No content in image generation response');
          }

          const imagePart = parts.find((p) => p.inlineData);
          if (!imagePart?.inlineData) {
            throw new Error(
              'No image data in response — the model may have returned text only',
            );
          }

          const { data, mimeType } = imagePart.inlineData;
          if (!data) {
            throw new Error('Image data is empty');
          }

          return {
            imageData: Buffer.from(data, 'base64'),
            mimeType: mimeType ?? 'image/png',
          };
        },
        catch: mapError,
      }).pipe(
        Effect.withSpan('imageGen.generate', {
          attributes: {
            'imageGen.provider': 'google',
            'imageGen.model': modelId,
            'imageGen.format': options.format,
          },
        }),
      ),
  };
};

/**
 * Create Google Image Gen service layer.
 *
 * @example
 * ```typescript
 * const ImageGenLive = GoogleImageGenLive({ apiKey: env.GEMINI_API_KEY });
 *
 * const program = Effect.gen(function* () {
 *   const imageGen = yield* ImageGen;
 *   const result = yield* imageGen.generateImage({
 *     prompt: 'A timeline graphic about project milestones',
 *     format: 'portrait',
 *   });
 *   return result.imageData;
 * }).pipe(Effect.provide(ImageGenLive));
 * ```
 */
export const GoogleImageGenLive = (
  config: GoogleImageGenConfig,
): Layer.Layer<ImageGen> =>
  Layer.sync(ImageGen, () => makeGoogleImageGenService(config));
