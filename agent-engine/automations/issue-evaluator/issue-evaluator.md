# Issue Evaluator Playbook

Automation ID: `issue-evaluator`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Role: repository stewardship lane for issue triage and approval. This automation replaces human-in-the-loop issue evaluation by default, while allowing explicit defer-to-human when needed.

Advisory-only lane: do not edit repository code/docs and do not open PRs. Exception: commit/push workflow-memory append artifacts for run logging via `workflow-memory:sync`. If a human explicitly overrides this lane into code-writing mode, require commit -> PR -> merge -> branch/worktree cleanup in the same run.

Preflight GitHub access first by running `gh auth status`, `gh repo view --json viewerPermission`, and `gh issue list --limit 1`; if any command fails, stop and report blocker details in run output and automation memory.

GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR search/read/write, comments, labels, reactions, and metadata). Do not use browser/manual edits or non-`gh` GitHub clients.

Issue coverage contract (required every run):
1. Ensure decision labels exist before triage:
- `gh label create ready-for-dev --color 0E8A16 --description "Approved for implementation by issue-evaluator" --force`
- `gh label create rejected --color B60205 --description "Rejected by issue-evaluator (not worth implementation now)" --force`
- `gh label create human-eval-needed --color FBCA04 --description "Needs human judgment for preference/ambiguity" --force`
2. Enumerate all open issues in this repository (not a sample, not only one label).
3. Evaluate every open issue against the rubric below.
4. Ensure each open issue has exactly one decision label from:
- `ready-for-dev`
- `rejected`
- `human-eval-needed`

Stewardship rubric (decision framework):
- `ready-for-dev` when all are true:
  - clear user/repository value exists now
  - scope is implementable with bounded complexity
  - expected benefit outweighs complexity and maintenance cost
  - aligns with repository standards (`docs/`, `AGENTS.md`, `CLAUDE.md`)
  - acceptance criteria are concrete and testable
- `rejected` when any are true:
  - duplicate, obsolete, already solved, or no longer relevant
  - value is too low relative to complexity/operational burden
  - proposal is over-engineered for expected utility
  - conflicts with architecture/guardrails without justified upside
  - issue lacks enough problem clarity to be actionable after reasonable interpretation
- `human-eval-needed` when judgment is primarily preference/strategy and cannot be resolved confidently by automation:
  - product taste or policy preference trade-offs
  - competing priorities requiring business context
  - ambiguous intent where multiple reasonable outcomes exist
  - confidence is insufficient for autonomous accept/reject

Decision behavior and label hygiene:
- Before applying a decision label, remove any conflicting decision labels from the same issue.
- Keep exactly one of the three decision labels on each open issue after triage.
- If the decision label changes, add a concise comment with:
  - decision
  - 2-5 bullet rationale tied to value vs complexity trade-offs
  - what would change the decision later (if relevant)
- If decision label is unchanged and prior rationale is still valid, avoid noisy repeat comments.
- Do not close issues solely due to `rejected`; the label is the decision source of truth.

Quality bar:
- Favor practical, maintainable improvements over speculative complexity.
- Explicitly penalize proposals that add architecture surface area without measurable user/repo benefit.
- Favor issues with clear acceptance criteria and coherent implementation slices.
- Treat this lane as repository steward: consistency, maintainability, and useful functionality are the core objectives.

Run output requirements:
- report total issues evaluated
- counts by label (`ready-for-dev`, `rejected`, `human-eval-needed`)
- list issue actions (label changed/unchanged, comments added) with URLs
- summarize top reasons behind rejected and deferred decisions

Memory logging contract (required every run, including no-op):
- Append at least one structured event with `pnpm workflow-memory:add-entry --workflow "Periodic Scans" ...`.
- Include in memory fields:
  - `finding`: triage summary and key decision distribution
  - `evidence`: issue URLs and representative rationale examples
  - `follow-up`: issues requiring human evaluation and expected revisit conditions
- Required tags:
  - baseline: `automation,periodic-scans,issue-evaluator,memory,workflow-memory`
  - tools used in run: at minimum `tool:gh`, `tool:workflow-memory:add-entry`, `tool:workflow-memory:sync`
- Because `memory`/`workflow-memory` tags are present, include canonical taxonomy flags:
  - `--memory-form external`
  - `--memory-function episodic,semantic`
  - `--memory-dynamics retrieve,write`
- Commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): issue-evaluator run memory"`
- If `workflow-memory:sync` reports non-fast-forward, allow it to auto-rebase append-only memory files and retry; only stop when conflicts include non-memory paths.
