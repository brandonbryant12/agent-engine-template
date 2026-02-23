import { Layer, Effect } from 'effect';
import {
  DeepResearch,
  type DeepResearchService,
  type ResearchResult,
} from '..';

export interface MockDeepResearchOptions {
  delay?: number;
  content?: string;
}

const MOCK_RESEARCH_CONTENT = `# Mock Research Results

This is a mock research result generated for testing purposes.

## Key Findings

1. Finding one with supporting evidence from multiple sources.
2. Finding two with additional context and analysis.
3. Finding three with implications for the broader topic.

## Analysis

The research indicates several important trends that warrant further investigation.
Multiple sources corroborate these findings, lending credibility to the conclusions drawn.

## Sources Referenced

The research drew from academic papers, news articles, and industry reports to provide
a comprehensive overview of the topic.`;

export function createMockDeepResearch(
  options: MockDeepResearchOptions = {},
): Layer.Layer<DeepResearch> {
  const { delay = 0, content = MOCK_RESEARCH_CONTENT } = options;

  // Track interactions to simulate async polling
  const completedInteractions = new Map<string, ResearchResult>();
  let counter = 0;

  const service: DeepResearchService = {
    startResearch: (_query: string) =>
      Effect.gen(function* () {
        if (delay > 0) {
          yield* Effect.sleep(delay);
        }

        const interactionId = `mock-research-${++counter}`;

        // Pre-compute the result for when getResult is called
        const wordCount = content
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        completedInteractions.set(interactionId, {
          content,
          sources: [
            { title: 'Mock Source 1', url: 'https://example.com/source-1' },
            { title: 'Mock Source 2', url: 'https://example.com/source-2' },
            { title: 'Mock Source 3', url: 'https://example.com/source-3' },
          ],
          wordCount,
        });

        return { interactionId };
      }),

    getResult: (interactionId: string) =>
      Effect.gen(function* () {
        if (delay > 0) {
          yield* Effect.sleep(delay);
        }

        // Always return completed for mocks (no pending state)
        return completedInteractions.get(interactionId) ?? null;
      }),
  };

  return Layer.succeed(DeepResearch, service);
}

export const MockDeepResearchLive = createMockDeepResearch();

export const MockDeepResearchWithLatency = createMockDeepResearch({
  delay: 15_000,
});
