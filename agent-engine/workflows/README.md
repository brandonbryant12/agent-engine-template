<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. -->
<!-- Run `pnpm workflows:generate` to regenerate from registry.json. -->

# Workflow Catalog

Canonical workflow catalog for Agent Engine Template.

Source of truth: [`agent-engine/workflows/registry.json`](./registry.json)

## Concepts

- `Workflow`: A process contract that defines scope, expected outcome, and workflow-memory key.
- `Skill`: A reusable execution method that implements one part of a workflow (or a helper task).
- `Automation`: A runtime lane (scheduled or event-driven) that can trigger one or more workflows and skills with lane-specific policies.

Not every workflow has an automation lane, and not every automation lane maps 1:1 to one workflow.

## Core Workflows

Core workflows are the only entries with first-class workflow memory keys.

| Workflow | Directory | Memory Key | Primary Skills | Automation Triggers | Intent |
|---|---|---|---|---|---|
| Feature Delivery | [`feature-delivery`](./feature-delivery/README.md) | `Feature Delivery` | [`feature-delivery`](../../.agents/skills/feature-delivery/SKILL.md) | [`ready-for-dev-executor`](../automations/ready-for-dev-executor/ready-for-dev-executor.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Executes plan -> implement -> validate -> compound for vertical delivery slices. |
| Architecture + ADR Guard | [`architecture-adr-guard`](./architecture-adr-guard/README.md) | `Architecture + ADR Guard` | [`architecture-adr-guard`](../../.agents/skills/architecture-adr-guard/SKILL.md) | [`best-practice-researcher`](../automations/best-practice-researcher/best-practice-researcher.md), [`ready-for-dev-executor`](../automations/ready-for-dev-executor/ready-for-dev-executor.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Checks boundary/layer/runtime correctness and documents approved deviations. |
| Docs + Knowledge Drift | [`docs-knowledge-drift`](./docs-knowledge-drift/README.md) | `Docs + Knowledge Drift` | [`docs-knowledge-drift`](../../.agents/skills/docs-knowledge-drift/SKILL.md) | No dedicated lane | Keeps workflow/standards docs aligned with actual repository behavior. |
| Periodic Scans | [`periodic-scans`](./periodic-scans/README.md) | `Periodic Scans` | [`periodic-scans`](../../.agents/skills/periodic-scans/SKILL.md) | [`best-practice-researcher`](../automations/best-practice-researcher/best-practice-researcher.md), [`agent-engine-researcher`](../automations/agent-engine-researcher/agent-engine-researcher.md), [`product-vision-researcher`](../automations/product-vision-researcher/product-vision-researcher.md), [`product-owner-reviewer`](../automations/product-owner-reviewer/product-owner-reviewer.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Runs recurring quality scans and routes findings into closure workflows. |
| Self-Improvement | [`self-improvement`](./self-improvement/README.md) | `Self-Improvement` | [`self-improvement`](../../.agents/skills/self-improvement/SKILL.md) | [`agent-engine-researcher`](../automations/agent-engine-researcher/agent-engine-researcher.md), [`ready-for-dev-executor`](../automations/ready-for-dev-executor/ready-for-dev-executor.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Converts repeated failures into stronger guardrails, tests, docs, and automation rules. |

## Utility Skills (Not Workflows)

These are reusable helper/orchestrator skills. They do not define standalone workflow classes.

| Utility Skill | Memory Key | Source Skill | Used With Workflows | Automation Triggers | Purpose |
|---|---|---|---|---|---|
| Intake + Triage | `Use parent workflow key` | [`intake-triage`](../../.agents/skills/intake-triage/SKILL.md) | `Feature Delivery`, `Architecture + ADR Guard`, `Self-Improvement` | [`ready-for-dev-executor`](../automations/ready-for-dev-executor/ready-for-dev-executor.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Scopes requests into slices, acceptance criteria, and risk flags before implementation. |
| TanStack + Vite Guardrails | `Use parent workflow key` | [`tanstack-vite`](../../.agents/skills/tanstack-vite/SKILL.md) | `Feature Delivery`, `Architecture + ADR Guard`, `Self-Improvement` | No dedicated lane | Applies frontend data/routing/forms/build guardrails for apps/web. |
| PR Risk Review | `Use parent workflow key` | [`pr-risk-review`](../../.agents/skills/pr-risk-review/SKILL.md) | `Feature Delivery`, `Architecture + ADR Guard`, `Self-Improvement` | No dedicated lane | Runs findings-first pre-merge risk review for regressions, safety, and contract drift. |
| Test Surface Steward | `Use parent workflow key` | [`test-surface-steward`](../../.agents/skills/test-surface-steward/SKILL.md) | `Feature Delivery`, `Periodic Scans`, `Self-Improvement` | No dedicated lane | Balances required test depth and reliability across backend, API, worker, and web. |
| Security + Dependency Hygiene | `Use parent workflow key` | [`security-dependency-hygiene`](../../.agents/skills/security-dependency-hygiene/SKILL.md) | `Periodic Scans`, `Feature Delivery`, `Self-Improvement` | No dedicated lane | Audits auth/data safety, secret handling, and dependency risk. |
| Performance + Cost Guard | `Use parent workflow key` | [`performance-cost-guard`](../../.agents/skills/performance-cost-guard/SKILL.md) | `Periodic Scans`, `Feature Delivery`, `Self-Improvement` | No dedicated lane | Detects and prioritizes performance and cost regressions. |
| Release + Incident Response | `Use parent workflow key` | [`release-incident-response`](../../.agents/skills/release-incident-response/SKILL.md) | `Feature Delivery`, `Periodic Scans`, `Self-Improvement` | No dedicated lane | Defines release go/no-go, canary/rollback thresholds, and incident handling loops. |
| Quality Closure Loop | `Uses workflow keys executed in-loop` | [`quality-closure-loop`](../../.agents/skills/quality-closure-loop/SKILL.md) | `Periodic Scans`, `Feature Delivery`, `Docs + Knowledge Drift`, `Self-Improvement`, `Architecture + ADR Guard` | No dedicated lane | Orchestrates scan -> triage -> fixes -> recurrence prevention -> closure. |
| Code Simplifier | `Use parent workflow key` | [`code-simplifier`](../../.agents/skills/code-simplifier/SKILL.md) | `Feature Delivery`, `Docs + Knowledge Drift`, `Self-Improvement`, `Architecture + ADR Guard` | No dedicated lane | Improves readability while preserving behavior and guardrail compliance. |
| Codebase Navigation | `Use parent workflow key` | [`codebase-nav`](../../.agents/skills/codebase-nav/SKILL.md) | `Feature Delivery`, `Architecture + ADR Guard`, `Docs + Knowledge Drift` | No dedicated lane | Locates canonical files and test targets quickly before implementation/review. |
| Debug + Fix | `Use parent workflow key` | [`debug-fix`](../../.agents/skills/debug-fix/SKILL.md) | `Feature Delivery`, `Periodic Scans`, `Self-Improvement`, `Architecture + ADR Guard` | [`ready-for-dev-executor`](../automations/ready-for-dev-executor/ready-for-dev-executor.md), [`sanity-check`](../automations/sanity-check/sanity-check.md) | Runs a test-driven reproduce -> isolate -> fix -> validate loop. |

## Usage

1. Pick the smallest core workflow set that satisfies the change.
2. Add utility skills only when they reduce risk or improve execution clarity.
3. Persist workflow-memory notes using the core workflow key(s) that were actually executed.
