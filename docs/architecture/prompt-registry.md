# Prompt Registry and Versioning

## Scope

Prompt artifacts are first-class, git-versioned assets in `packages/ai/src/chat/prompts`.

This contract is required for runtime prompt resolution:

- deterministic policy: `explicitVersion > channelDefault`
- immutable artifact versions after publish
- lifecycle status: `active | deprecated | blocked`
- typed resolver failures with `_tag`
- compatibility fallback only behind explicit compatibility mode

## Artifact Contract

Each prompt artifact includes:

- `key`
- `version`
- `status`
- `owner`
- `inputSchema`
- `contentHash`
- `content`

Artifacts are in-repo only. Runtime does not side-load prompts from remote systems.

## Resolver Behavior

`resolvePrompt` lives in `packages/ai/src/chat/prompts` and is consumed by use-cases.

Resolution precedence:

1. `explicitVersion` when provided
2. `channelDefault` otherwise

Failure model (typed tagged errors):

- `PromptKeyNotFoundError`
- `PromptVersionNotFoundError`
- `PromptVersionBlockedError`
- `PromptVariableSchemaMismatchError`

## Compatibility Mode

Compatibility mode allows a temporary legacy-inline fallback for migration windows.

Current migration path:

- use-case: `streamGeneralChat`
- fallback mode: `GENERAL_CHAT_PROMPT_COMPATIBILITY_MODE`
- sunset trigger: remove fallback after 30 days with zero fallback telemetry for `chat.general.system`

## Observability Contract

Use-case spans must include prompt resolution attributes:

- `prompt.key`
- `prompt.version`
- `prompt.policy`
- `prompt.fallbackUsed`
- `prompt.failureReason` (fallback path only)

Do not include interpolation payload values or user input in prompt telemetry.

## Quickstart + Smoke Test

1. Add a new prompt artifact in `packages/ai/src/chat/prompts/resolver.ts`.
2. Resolve it from a use-case with `resolvePrompt`.
3. Add resolver/use-case tests with `_tag` assertions for failure paths.
4. Run smoke checks:

```bash
pnpm --filter @repo/ai test
pnpm test:invariants
```
