import { Layer } from 'effect';
import type { AI } from '..';
import {
  MockDeepResearchLive,
  MockDeepResearchWithLatency,
} from './deep-research';
import { MockImageGenLive, MockImageGenWithLatency } from './image-gen';
import { MockLLMLive, MockLLMWithLatency } from './llm';
import { MockTTSLive, MockTTSWithLatency } from './tts';

export * from './llm';
export * from './tts';
export * from './image-gen';
export * from './deep-research';

/** Combined mock layer for all AI services. No delay for fast tests. */
export const MockAILive: Layer.Layer<AI> = Layer.mergeAll(
  MockLLMLive,
  MockTTSLive,
  MockImageGenLive,
  MockDeepResearchLive,
);

/** Combined mock layer with realistic latency for dev server. */
export const MockAIWithLatency: Layer.Layer<AI> = Layer.mergeAll(
  MockLLMWithLatency,
  MockTTSWithLatency,
  MockImageGenWithLatency,
  MockDeepResearchWithLatency,
);
