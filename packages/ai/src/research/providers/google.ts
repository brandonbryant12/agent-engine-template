import { GoogleGenAI } from '@google/genai';
import { Effect, Layer } from 'effect';
import { ResearchError } from '../../errors';
import { DEEP_RESEARCH_MODEL } from '../../models';
import {
  DeepResearch,
  type DeepResearchService,
  type ResearchResult,
  type ResearchSource,
} from '../service';

/**
 * Configuration for Google Deep Research provider.
 */
export interface GoogleDeepResearchConfig {
  readonly apiKey: string;
}

/** A single typed content block from the interactions API. */
interface OutputBlock {
  type?: string;
  text?: string;
  annotations?: Array<{
    source?: string;
    start_index?: number;
    end_index?: number;
  }>;
  result?: Array<{ title?: string; url?: string; rendered_content?: string }>;
}

/** Extract text content from typed content blocks. */
function extractContent(outputs: readonly OutputBlock[]): string {
  return outputs
    .filter(
      (b): b is OutputBlock & { text: string } => b.type === 'text' && !!b.text,
    )
    .map((b) => b.text)
    .join('\n\n');
}

/** Extract deduplicated sources from search result blocks and text annotations. */
function extractSources(outputs: readonly OutputBlock[]): ResearchSource[] {
  const sources: ResearchSource[] = [];
  const seenUrls = new Set<string>();

  const addSource = (url: string, title: string) => {
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      sources.push({ title, url });
    }
  };

  for (const block of outputs) {
    if (block.type === 'google_search_result' && block.result) {
      for (const result of block.result) {
        if (result.url) addSource(result.url, result.title ?? result.url);
      }
    }
    if (block.type === 'text' && block.annotations) {
      for (const annotation of block.annotations) {
        if (annotation.source) addSource(annotation.source, annotation.source);
      }
    }
  }

  return sources;
}

/**
 * Create Google Deep Research service implementation.
 */
const makeGoogleDeepResearchService = (
  config: GoogleDeepResearchConfig,
): DeepResearchService => {
  const genAI = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    startResearch: (query: string) =>
      Effect.tryPromise({
        try: async () => {
          const interaction = await genAI.interactions.create({
            agent: DEEP_RESEARCH_MODEL,
            input: query,
            background: true,
            agent_config: {
              type: 'deep-research',
            },
          });

          return { interactionId: interaction.id };
        },
        catch: (error) =>
          new ResearchError({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to start research',
            cause: error,
          }),
      }).pipe(
        Effect.withSpan('deepResearch.startResearch', {
          attributes: { 'research.provider': 'google' },
        }),
      ),

    getResult: (interactionId: string) =>
      Effect.gen(function* () {
        const interaction = yield* Effect.tryPromise({
          try: () => genAI.interactions.get(interactionId),
          catch: (error) =>
            new ResearchError({
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to get research result',
              cause: error,
            }),
        });

        if (interaction.status === 'failed') {
          return yield* new ResearchError({
            message: 'Research operation failed',
          });
        }

        if (interaction.status === 'cancelled') {
          return yield* new ResearchError({
            message: 'Research operation was cancelled',
          });
        }

        if (
          interaction.status === 'in_progress' ||
          interaction.status === 'requires_action'
        ) {
          return null;
        }

        const outputs = (interaction.outputs ?? []) as OutputBlock[];
        const content = extractContent(outputs);
        const sources = extractSources(outputs);
        const wordCount = content
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        return { content, sources, wordCount } satisfies ResearchResult;
      }).pipe(
        Effect.withSpan('deepResearch.getResult', {
          attributes: {
            'research.provider': 'google',
            'research.interactionId': interactionId,
          },
        }),
      ),
  };
};

/**
 * Create Google Deep Research service layer.
 *
 * @example
 * ```typescript
 * const DeepResearchLive = GoogleDeepResearchLive({ apiKey: env.GEMINI_API_KEY });
 *
 * const program = Effect.gen(function* () {
 *   const research = yield* DeepResearch;
 *   const { interactionId } = yield* research.startResearch('AI trends 2025');
 *   // ... poll getResult ...
 * }).pipe(Effect.provide(DeepResearchLive));
 * ```
 */
export const GoogleDeepResearchLive = (
  config: GoogleDeepResearchConfig,
): Layer.Layer<DeepResearch> =>
  Layer.sync(DeepResearch, () => makeGoogleDeepResearchService(config));
