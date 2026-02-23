# Docs + Knowledge Drift

- Memory key: `Docs + Knowledge Drift`
- Primary skill: [`docs-knowledge-drift`](../../../.agents/skills/docs-knowledge-drift/SKILL.md)

## What It Does

Keeps standards, workflow guidance, and onboarding docs aligned with real repository behavior.

## Trigger Skills

- `docs-knowledge-drift` (primary)
- Common companions: `feature-delivery`, `self-improvement`

## Automation Entry Points

- No dedicated automation lane currently owns this workflow.
- Typically run during feature delivery, periodic scans, and self-improvement loops.

## How It Works

1. Identify changed behavior and affected docs surfaces.
2. Validate docs language against current code and guardrails.
3. Update behavior drift, remove stale guidance, and repair dead links.
4. Reconcile cross-doc consistency across `AGENTS.md`, `CLAUDE.md`, and `agent-engine/workflows/README.md`.

## Outputs

- Critical/important/quality doc updates with evidence.
- Follow-up doc backlog.
- Memory entry with workflow `Docs + Knowledge Drift`.
