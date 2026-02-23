# Automations - Guardrails + Controlled Chaos

This directory documents how Codex automations are designed for this repo.

Goal:
- Keep all code changes aligned with repository guardrails in [`docs/`](../../docs/), [`AGENTS.md`](../../AGENTS.md), and [`CLAUDE.md`](../../CLAUDE.md).
- Continuously inject controlled external research ("chaos") to discover better patterns over time.

## Terminology

- `Workflow`: process contract and memory-key class (see [`agent-engine/workflows/README.md`](../workflows/README.md)).
- `Skill`: reusable execution method (see [`.agents/skills/`](../../.agents/skills/)).
- `Automation lane`: runtime orchestration policy that can trigger one or more workflows and skills.

Automations are not duplicates of workflows. They define runtime policy (triggering, approvals, branch/merge behavior, gate ordering) around workflow execution.

## Directory Structure

Each automation lane has its own folder:

- In [`agent-engine/automations/`](./), each lane folder contains a `<lane>.md` playbook.
- In [`agent-engine/automations/`](./), each lane folder contains a matching `<lane>.toml` runtime wrapper.

Example:

- [`agent-engine/automations/best-practice-researcher/best-practice-researcher.md`](./best-practice-researcher/best-practice-researcher.md)
- [`agent-engine/automations/best-practice-researcher/best-practice-researcher.toml`](./best-practice-researcher/best-practice-researcher.toml)

## Operating Model

We run two complementary forces:

1. Guardrail enforcement lanes (execution lanes)
- Only implement changes when guardrails are satisfied.
- Use deterministic branching and test gates.
- Merge only after full validation.

2. Controlled chaos lanes (research lanes)
- Continuously research outside practices and recent docs.
- Generate proposals/issues that challenge current patterns.
- Feed only high-signal, coherent ideas into execution lanes.

This creates stability plus adaptation:
- Guardrails prevent regressions.
- Chaos research prevents stagnation.

## Active Lanes

1. `best-practice-researcher`
- Research-only random-walk lane spanning architecture, coding patterns, docs, and repository configuration practices.
- Creates/updates best-practice issues with evidence and acceptance criteria.
- No direct code changes.

2. `agent-engine-researcher`
- Research-only lane for agent-engine system improvements and self-improvement loop design.
- Pulls outside research and compares against repo workflow/skills.
- Produces ready-for-dev candidate issues for implementation.

3. `product-vision-researcher`
- Research-only strategic lane for long-horizon product direction.
- Scans internal product surfaces plus external AI/market movement, prioritizing Gemini and Google API opportunities.
- Creates/updates product opportunity issues labeled `product-vision` for human prioritization.

4. `product-owner-reviewer`
- Research-only tactical lane for UX and journey coherence across current features.
- Reviews onboarding, creation, generation, approval, and recovery flows for clarity and friction.
- Creates/updates UX/product-owner improvement issues for human prioritization.

5. `ready-for-dev-executor`
- Human-in-the-loop coding lane.
- Implements human-approved `ready-for-dev` issues with bounded per-run aggregation.
- Can conservatively bundle multiple small, tightly related `ready-for-dev` issues into one coherent PR when manageable in a single context.
- Branches from latest `origin/main`, runs core validation gates, and auto-merges on success.

6. `sanity-check`
- Hourly memory-driven periodic scan lane spanning macro-to-micro sanity checks.
- Can move directly from high-confidence bounded findings to implementation, PR, and auto-merge in one run.
- Uses workflow routing to pick the correct execution contract for each fix.

## Lane Contract

For every lane:

- The `.md` playbook is source of truth for lane behavior.
- The `.toml` wrapper should only load and execute that playbook.
- If wrapper and playbook conflict, follow the playbook.

## Required Contract For Any Code-Writing Automation

Any automation that edits code must:

1. Read relevant repo standards before editing
- [`agent-engine/workflows/README.md`](../workflows/README.md)
- relevant files in [`docs/patterns/`](../../docs/patterns/)
- relevant files in [`docs/frontend/`](../../docs/frontend/) and [`docs/testing/`](../../docs/testing/) as needed

2. Branch from latest main
- `git fetch origin main`
- create a dedicated git worktree and branch from `origin/main` (do not code on the primary checkout)
- if only files in [`agent-engine/workflow-memory/events/`](../workflow-memory/events/) and/or [`agent-engine/workflow-memory/index.json`](../workflow-memory/index.json) are dirty, treat them as expected automation artifacts and continue (carry them into the branch; stash/re-apply only if checkout requires it)
- if any other unexpected dirty paths exist, stop and report blocker details

3. Prepare runtime for reliable automation execution
- run Node/pnpm commands via interactive login zsh (`zsh -lic 'cd <repo-root> && <command>'`) so automation uses the same shell toolchain as interactive development
- verify toolchain before install/gates: `zsh -lic 'cd <repo-root> && node -v && pnpm -v'` and require Node >= 22.10.0
- `pnpm install --frozen-lockfile --prefer-offline` (fast-path, fall back to online recovery on failure)
- `docker info --format '{{.ServerVersion}}'` (fast-path, fall back to context/socket diagnostics on failure)
- skip `pnpm test:e2e` in automation checklists (too slow/flaky for this lane)

4. Pass full gates before merge
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:invariants`
- `pnpm test`
- `pnpm build`

5. Use safe delivery behavior
- on failure: no merge, report blocker with evidence
- on success: open PR with issue linkage, follow lane-specific merge policy, and clean up branch/worktree after merge

## Required Memory Persistence For Every Lane

Every automation run (including no-op and failure paths) must persist structured
workflow memory in git:

1. Append an event with [`pnpm workflow-memory:add-entry`](../../package.json).
2. Commit and push memory artifacts with [`pnpm workflow-memory:sync`](../../package.json).
3. Treat append-only memory conflicts as recoverable:
  - allow `workflow-memory:sync` to rebase and retry on non-fast-forward
  - allow auto-resolution for:
    - `agent-engine/workflow-memory/events/*.jsonl`
    - `agent-engine/workflow-memory/index.json`
    - `agent-engine/workflow-memory/summaries/*.md`
  - only block when non-memory conflicts appear

## Controlled Chaos Rules

External research is encouraged, but only through filters:

1. Evidence quality
- prioritize primary/official sources and recent release notes

2. System coherence
- proposed change must fit repo architecture, skills, and workflow memory

3. Material impact
- reject ideas that add complexity without clear system-level benefit

4. Non-duplication
- reuse existing issues/PRs when possible

5. Bounded execution
- at most one PR per execution lane run; bundling multiple issues is allowed only when the bundle is small and coherent

6. Research traceability
- when an issue is based on external paper ideas, include paper links and adopted ideas in the issue
- when those ideas are implemented, append a shipped-entry log in [`research/implemented-ideas.md`](../../research/implemented-ideas.md)

## Flow Across Lanes

1. `best-practice-researcher` finds best-practice and coding-pattern improvements.
2. `agent-engine-researcher` finds agent-engine improvement opportunities.
3. `product-vision-researcher` finds strategic product-direction and roadmap opportunities.
4. `product-owner-reviewer` finds tactical UX/journey and story-cohesion opportunities.
5. `sanity-check` performs hourly memory-driven scans and directly ships bounded high-confidence fixes.
6. Human approves selected researcher issues by adding `ready-for-dev`.
7. `ready-for-dev-executor` implements and merges approved issues after gates, selecting 1..N with conservative bundling in one PR.

## Research Logging

When paper-derived ideas are adopted, log shipped changes in:
- [`research/implemented-ideas.md`](../../research/implemented-ideas.md)

Use the template in that file to record:
- paper link(s)
- adopted idea(s)
- issue/PR links
- concrete implementation summary

## Runtime Sync Commands

Push wrapper updates from repo mirror to local runtime:

```bash
cp agent-engine/automations/best-practice-researcher/best-practice-researcher.toml ~/.codex/automations/best-practice-researcher/automation.toml
cp agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.toml ~/.codex/automations/ready-for-dev-executor/automation.toml
cp agent-engine/automations/agent-engine-researcher/agent-engine-researcher.toml ~/.codex/automations/agent-engine-researcher/automation.toml
cp agent-engine/automations/product-vision-researcher/product-vision-researcher.toml ~/.codex/automations/product-vision-researcher/automation.toml
cp agent-engine/automations/product-owner-reviewer/product-owner-reviewer.toml ~/.codex/automations/product-owner-reviewer/automation.toml
cp agent-engine/automations/sanity-check/sanity-check.toml ~/.codex/automations/sanity-check/automation.toml
```

Pull runtime wrappers back into repo mirror (verification only):

```bash
cp ~/.codex/automations/best-practice-researcher/automation.toml agent-engine/automations/best-practice-researcher/best-practice-researcher.toml
cp ~/.codex/automations/ready-for-dev-executor/automation.toml agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.toml
cp ~/.codex/automations/agent-engine-researcher/automation.toml agent-engine/automations/agent-engine-researcher/agent-engine-researcher.toml
cp ~/.codex/automations/product-vision-researcher/automation.toml agent-engine/automations/product-vision-researcher/product-vision-researcher.toml
cp ~/.codex/automations/product-owner-reviewer/automation.toml agent-engine/automations/product-owner-reviewer/product-owner-reviewer.toml
cp ~/.codex/automations/sanity-check/automation.toml agent-engine/automations/sanity-check/sanity-check.toml
```
