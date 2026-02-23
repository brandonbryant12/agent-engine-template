import { Context } from 'effect';
import type {
  ImageGenError,
  ImageGenRateLimitError,
  ImageGenContentFilteredError,
} from '../errors';
import type { Effect } from 'effect';

/**
 * A reference image to use as a base for iterative editing.
 */
export interface ReferenceImage {
  readonly data: Buffer;
  readonly mimeType: string;
}

/**
 * Options for generating an image.
 */
export interface GenerateImageOptions {
  readonly prompt: string;
  readonly format: 'portrait' | 'square' | 'landscape' | 'og_card';
  readonly referenceImage?: ReferenceImage;
}

/**
 * Result from image generation.
 */
export interface GenerateImageResult {
  readonly imageData: Buffer;
  readonly mimeType: string;
}

/**
 * Image generation service interface.
 * Provider-agnostic — works with Gemini, DALL-E, etc.
 */
export interface ImageGenService {
  readonly generateImage: (
    options: GenerateImageOptions,
  ) => Effect.Effect<
    GenerateImageResult,
    ImageGenError | ImageGenRateLimitError | ImageGenContentFilteredError
  >;
}

/**
 * ImageGen service Context.Tag for dependency injection.
 */
export class ImageGen extends Context.Tag('@repo/ai/ImageGen')<
  ImageGen,
  ImageGenService
>() {}
