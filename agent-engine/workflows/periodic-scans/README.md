# Periodic Scans

- Memory key: `Periodic Scans`
- Primary skill: [`periodic-scans`](../../../.agents/skills/periodic-scans/SKILL.md)

## What It Does

Runs recurring per-PR, daily, weekly, and monthly quality scans to detect systemic risks and produce prioritized closure work.

## Trigger Skills

- `periodic-scans` (primary)
- Common companions: `quality-closure-loop`, `security-dependency-hygiene`, `performance-cost-guard`, `docs-knowledge-drift`

## Automation Entry Points

- [`best-practice-researcher`](../../automations/best-practice-researcher/best-practice-researcher.md): continuous best-practice random-walk research scan lane.
- [`agent-engine-researcher`](../../automations/agent-engine-researcher/agent-engine-researcher.md): continuous agent-engine/self-improvement research scan lane.
- [`product-vision-researcher`](../../automations/product-vision-researcher/product-vision-researcher.md): strategic product-direction lane that turns roadmap opportunities into `product-vision` issues.
- [`product-owner-reviewer`](../../automations/product-owner-reviewer/product-owner-reviewer.md): day-to-day UX/journey coherence lane that opens tactical product-owner improvements.
- [`sanity-check`](../../automations/sanity-check/sanity-check.md): hourly memory-driven scan lane that can directly implement and merge bounded high-confidence fixes.

## How It Works

1. Run cadence-specific checks (per-PR, daily, weekly, monthly/release).
2. Classify findings by severity, impact, effort, and confidence.
3. Add workflow-memory coverage checks and flag missing monthly workflow entries.
4. Route fixes to execution workflows and track closure status.

## Outputs

- Prioritized scan report plus closure recommendations.
- Workflow-memory coverage snapshot.
- Memory entry with workflow `Periodic Scans`.
