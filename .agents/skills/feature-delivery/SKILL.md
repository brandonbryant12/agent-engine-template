---
name: feature-delivery
description: End-to-end feature delivery workflow for Agent Engine Template. Use when implementing or refactoring a feature from request to merge, including planning, coding, tests, docs updates, and compounding learnings.
---

# Agent Engine Template Feature Delivery

Use this skill for the happy path of shipping features with the repo's docs-first standards.

## Core Loop

Run this sequence every time:

1. Plan
2. Work
3. Review
4. Compound

This is the default loop inspired by compound engineering practices.

## 1) Plan

- Read only the docs needed for the change ([`docs/**/*.md`](../../../docs/)); include concrete anchors like `docs/master-spec.md` and `agent-engine/workflows/README.md`.
- Convert the request into 1-3 vertical slices with user-visible outcomes.
- For frontend slices, define a short design brief before coding:
  - visual direction (typography, palette, spacing, motion)
  - key states (loading, empty, error, success)
  - accessibility expectations (keyboard/focus/contrast)
- Define test intent before coding:
  - use case/integration tests for backend behavior
  - frontend RTL tests for stateful UI
  - workflow/invariant tests when jobs or guardrails are touched

## 2) Work

- Implement one vertical slice at a time.
- Apply regression guardrails from [`AGENTS.md`](../../../AGENTS.md)/[`CLAUDE.md`](../../../CLAUDE.md) for:
  - boundary typing and unsafe casts
  - auth before mutating existing resources
  - structured-field sanitization
  - query key, retry, and streaming-state rules
  - telemetry lifecycle requirements
- Apply composition-first React APIs:
  - avoid boolean-prop proliferation for behavior toggles
  - prefer compound components/context and explicit variants
  - lift state into shared providers when siblings must coordinate
- Apply React performance guardrails:
  - eliminate waterfalls (parallelize independent async work)
  - keep derived state in render, not in effects
  - use transitions for non-urgent updates
  - avoid accidental bundle growth from broad imports

## 3) Review

- Verify with the smallest meaningful command set first, then widen:
  - targeted package tests
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:invariants` for backend changes
- Confirm docs and guardrails match behavior.
- Ensure no redundant tests remain for compile-time guarantees.
- For frontend slices, confirm:
  - design intent is visible in implementation (not generic UI)
  - accessibility baseline holds (keyboard/focus/semantic labeling)
  - component APIs remain composable and scalable

## 4) Compound

After each merged change, capture what worked, what failed, and the smallest guardrail/script improvement worth adding.

Record one event with workflow key `Feature Delivery` using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md), then include the event `id` in output.

## Output Contract

When this skill is used, produce:

1. Short plan with vertical slices
2. Code + tests + docs updates
3. Validation summary
4. Compound notes (2-6 bullets)
5. Memory note entry summary with event `id` and `workflow` (what was appended to `agent-engine/workflow-memory/events/YYYY-MM.jsonl`)
