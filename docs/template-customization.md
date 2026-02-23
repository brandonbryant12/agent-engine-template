# Template Customization Guide

Use this checklist right after creating a repository from this template.

## 1. Rename Project Identifiers

Replace placeholders:
- `template-app` (slug)
- `template_app` (database names)
- `Template App` (display name)

## 2. Keep or Remove Optional Surfaces

This template ships with chat, background runs, and SSE updates.

Choose what to keep:
- Keep runs + worker if you need async processing.
- Remove runs if your app is chat-only with immediate streaming responses.

## 3. Update Environment Defaults

Review and adjust:
- DB names/URLs
- public URLs
- telemetry service names
- Redis key prefixes

## 4. Rewrite Product Spec

Replace `docs/master-spec.md` narrative sections with your product behavior and acceptance criteria.

## 5. Verify Baseline

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
