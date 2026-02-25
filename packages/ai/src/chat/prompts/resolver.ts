import { Schema, Effect } from 'effect';
import {
  PromptKeyNotFoundError,
  PromptVariableSchemaMismatchError,
  PromptVersionBlockedError,
  PromptVersionNotFoundError,
  type PromptResolverError,
} from './errors';

type PromptLifecycleStatus = 'active' | 'deprecated' | 'blocked';
type PromptChannel = 'chat.general';
type PromptResolutionPolicy = 'explicitVersion' | 'channelDefault';
type PromptResolutionOutcome = 'resolved' | 'compatibility-fallback';

interface PromptArtifact {
  readonly key: string;
  readonly version: string;
  readonly status: PromptLifecycleStatus;
  readonly owner: string;
  readonly inputSchema: Schema.Schema.AnyNoContext;
  readonly contentHash: string;
  readonly content: string;
}

export interface ResolvePromptInput {
  readonly key: string;
  readonly channel: PromptChannel;
  readonly version?: string;
  readonly variables?: Record<string, unknown>;
  readonly compatibilityMode?: 'off' | 'legacy-inline-fallback';
  readonly legacyFallback?: string;
}

export interface ResolvedPrompt {
  readonly key: string;
  readonly version: string;
  readonly status: PromptLifecycleStatus | 'legacy';
  readonly owner: string;
  readonly policy: PromptResolutionPolicy;
  readonly contentHash: string;
  readonly content: string;
  readonly outcome: PromptResolutionOutcome;
  readonly fallbackReason?: PromptResolverError['_tag'];
}

const EmptyVariablesSchema = Schema.Struct({});

const PromptArtifacts: readonly PromptArtifact[] = [
  {
    key: 'chat.general.system',
    version: 'v0',
    status: 'blocked',
    owner: 'ai-platform',
    inputSchema: EmptyVariablesSchema,
    contentHash:
      'sha256:6dc84a98f109af001f3b8f2854c4c4f15f911db8ad34ab5ec2a3832b2dd4c030',
    content: 'Blocked prompt placeholder',
  },
  {
    key: 'chat.general.system',
    version: 'v1',
    status: 'active',
    owner: 'ai-platform',
    inputSchema: EmptyVariablesSchema,
    contentHash:
      'sha256:6632f5d91d856d5bfd2ec5cce9520517b5724345ee6f68d57743ce83a4d8b715',
    content: `You are the default AI assistant for Agent Engine Template.

Guidelines:
- Be concise, clear, and practical.
- Prefer structured answers when they help readability.
- If you are uncertain, state assumptions explicitly.
- Ask one clarifying question only when required.
- Do not invent capabilities that are not requested.`,
  },
  {
    key: 'chat.general.system',
    version: 'v2',
    status: 'deprecated',
    owner: 'ai-platform',
    inputSchema: EmptyVariablesSchema,
    contentHash:
      'sha256:05617c8e8ca0c350512726f12f905e40dd766da7cd3d2ba3dd35fe8f5d3f4668',
    content: `You are the default AI assistant for Agent Engine Template.

Guidelines:
- Prefer concise practical answers.
- Use numbered lists for multi-step responses.
- Declare assumptions before uncertain claims.`,
  },
  {
    key: 'chat.templated.system',
    version: 'v1',
    status: 'active',
    owner: 'ai-platform',
    inputSchema: Schema.Struct({
      persona: Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
    }),
    contentHash:
      'sha256:3e6d0f15af97bfe4ac66e126addf67df39d4a58ecbf527347362af2ca8bf4f2a',
    content: 'You are {{persona}}.',
  },
];

const PromptChannelDefaults: Record<PromptChannel, Record<string, string>> = {
  'chat.general': {
    'chat.general.system': 'v1',
  },
};

const findPromptByKey = (key: string) =>
  PromptArtifacts.filter((prompt) => prompt.key === key);

const findPromptByVersion = (key: string, version: string) =>
  PromptArtifacts.find(
    (prompt) => prompt.key === key && prompt.version === version,
  );

const decodeVariables = (artifact: PromptArtifact, variables: unknown) =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(artifact.inputSchema)(variables),
    catch: (error) => {
      const issue =
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Invalid prompt variables';
      return new PromptVariableSchemaMismatchError({
        key: artifact.key,
        version: artifact.version,
        issues: [issue],
      });
    },
  });

const resolvePromptStrict = (
  input: ResolvePromptInput,
): Effect.Effect<ResolvedPrompt, PromptResolverError> =>
  Effect.gen(function* () {
    const promptsByKey = findPromptByKey(input.key);
    if (promptsByKey.length === 0) {
      return yield* Effect.fail(
        new PromptKeyNotFoundError({ key: input.key }),
      );
    }

    const policy: PromptResolutionPolicy = input.version
      ? 'explicitVersion'
      : 'channelDefault';

    const resolvedVersion =
      input.version ??
      PromptChannelDefaults[input.channel]?.[input.key];

    if (!resolvedVersion) {
      return yield* Effect.fail(
        new PromptVersionNotFoundError({
          key: input.key,
          version: '<channel-default>',
        }),
      );
    }

    const prompt = findPromptByVersion(input.key, resolvedVersion);
    if (!prompt) {
      return yield* Effect.fail(
        new PromptVersionNotFoundError({
          key: input.key,
          version: resolvedVersion,
        }),
      );
    }

    if (prompt.status === 'blocked') {
      return yield* Effect.fail(
        new PromptVersionBlockedError({
          key: prompt.key,
          version: prompt.version,
        }),
      );
    }

    yield* decodeVariables(prompt, input.variables ?? {});

    return {
      key: prompt.key,
      version: prompt.version,
      status: prompt.status,
      owner: prompt.owner,
      policy,
      contentHash: prompt.contentHash,
      content: prompt.content,
      outcome: 'resolved',
    };
  });

export const resolvePrompt = (
  input: ResolvePromptInput,
): Effect.Effect<ResolvedPrompt, PromptResolverError> =>
  resolvePromptStrict(input).pipe(
    Effect.catchAll((error) => {
      if (
        input.compatibilityMode !== 'legacy-inline-fallback' ||
        !input.legacyFallback
      ) {
        return Effect.fail(error);
      }

      const policy: PromptResolutionPolicy = input.version
        ? 'explicitVersion'
        : 'channelDefault';

      return Effect.succeed({
        key: input.key,
        version: 'legacy-inline',
        status: 'legacy',
        owner: 'legacy-inline',
        policy,
        contentHash: 'legacy-inline',
        content: input.legacyFallback,
        outcome: 'compatibility-fallback',
        fallbackReason: error._tag,
      } as const);
    }),
  );
