# Prompt Registry Pattern

Prompt artifacts are first-class, git-versioned assets in `packages/ai`.

## v1 Contract

- Resolution policies: `explicitVersion`, `channelDefault`
- Precedence: `explicitVersion > channelDefault`
- Required artifact fields:
  - `key`
  - `version`
  - `status` (`active | deprecated | blocked`)
  - `owner`
  - `inputSchema`
  - `contentHash`
- Runtime source: in-repo artifacts only
- Typed failures: missing key, missing version, blocked version, variable schema mismatch
- Lifecycle governance:
  - each prompt key must have exactly one `active` version
  - `deprecated` versions require migration notes
  - `blocked` versions fail deterministically

## Compatibility Mode

`legacy-inline-fallback` is temporary for migration safety. It is only allowed
when a use-case opts in explicitly and must emit prompt decision telemetry
showing fallback reason.

Sunset trigger: remove compatibility mode once all production chat prompt paths
resolve from registry artifacts and no fallback telemetry appears for 14 days.

## Quickstart

1. Add/update a prompt artifact in `packages/ai/src/chat/prompts/resolver.ts`.
2. Resolve that prompt in a use-case via `resolvePrompt(...)`.
3. Keep handlers prompt-agnostic (`packages/api/src/server/router/*` unchanged).
4. Run smoke test:

```bash
pnpm --filter @repo/ai test src/chat/use-cases/__tests__/stream-general-chat.test.ts
```
