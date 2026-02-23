import { Context } from 'effect';
import type { ResearchError, ResearchTimeoutError } from '../errors';
import type { Effect } from 'effect';

/**
 * Result from a deep research operation.
 */
export interface ResearchResult {
  readonly content: string;
  readonly sources: readonly ResearchSource[];
  readonly wordCount: number;
}

/**
 * A source cited in the research output.
 */
export interface ResearchSource {
  readonly title: string;
  readonly url: string;
}

/**
 * Deep Research service interface.
 * Provider-agnostic — currently backed by Google's Deep Research agent.
 */
export interface DeepResearchService {
  /**
   * Start a background research operation.
   * Returns an interaction ID that can be polled with `getResult`.
   */
  readonly startResearch: (
    query: string,
  ) => Effect.Effect<{ interactionId: string }, ResearchError>;

  /**
   * Poll for the result of a research operation.
   * Returns the result if completed, null if still processing.
   * Fails with ResearchError on failure or ResearchTimeoutError on timeout.
   */
  readonly getResult: (
    interactionId: string,
  ) => Effect.Effect<
    ResearchResult | null,
    ResearchError | ResearchTimeoutError
  >;
}

/**
 * DeepResearch service Context.Tag for dependency injection.
 */
export class DeepResearch extends Context.Tag('@repo/ai/DeepResearch')<
  DeepResearch,
  DeepResearchService
>() {}
