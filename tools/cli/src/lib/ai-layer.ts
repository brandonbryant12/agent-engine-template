import { GoogleAILive, type AI } from '@repo/ai';
import type { Layer } from 'effect';

export interface AILayerOptions {
  readonly apiKey: string;
  readonly model?: string;
}

export const createAILayer = (options: AILayerOptions): Layer.Layer<AI> =>
  GoogleAILive({
    apiKey: options.apiKey,
    llmModel: options.model,
  });
