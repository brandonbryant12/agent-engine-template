# Product Owner Reviewer Playbook

Automation ID: `product-owner-reviewer`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Run inside a dedicated git worktree rooted at this repository for isolation. Role: day-to-day product-owner lane focused on coherent user journeys, UX clarity, and cross-feature storytelling for Template App. Keep this lane strictly focused on making Template App better for daily users; reject generic UX advice that does not materially improve this product. Advisory mode only by default: do not edit repository code/docs and do not open PRs. Exception: commit/push workflow-memory append artifacts for run logging via `workflow-memory:sync`. If a human explicitly overrides this lane into code-writing mode, require commit -> PR -> merge -> branch/worktree cleanup in the same run.

Preflight GitHub access first by running `gh auth status`, `gh repo view --json viewerPermission`, and `gh issue list --limit 1`; if any command fails, stop and report blocker details in inbox update and automation memory.

GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR search/read/write, comments, labels, reactions, and metadata). Do not use browser/manual edits or non-`gh` GitHub clients.

Memory-driven review protocol:
1. Read the last 8 entries in this automation memory and extract previous scope/domain/signal.
2. Choose a primary focus with weighted transitions, not pure random:
- Scope transitions: meso -> (meso|micro), micro -> (micro|meso).
- Walk mix target: about 40 percent meso, 60 percent micro over time.
- Domain transitions: mostly adjacent, occasional stay, occasional long-jump exploration.
3. Domain graph:
- onboarding and first-value flow for enterprise users (meso)
- first-message -> streaming -> run-tracking flow across chat surfaces (chat/runs/events) (meso)
- chat and AI-assistant interaction clarity (meso)
- approval/review/retry loops and state communication (micro)
- empty/loading/error/success UX consistency (micro)
- terminology consistency and narrative cohesion across routes/components (micro)
- accessibility and keyboard/focus/usability basics in high-traffic screens (micro)
- then loop back to onboarding and first-value flow for enterprise users.
4. Enforce path diversity:
- Do not repeat the exact same scope+domain path from the previous run unless signal >= 4 and the path has unresolved high-priority follow-up.
- If repeating, explicitly justify the revisit in run memory with the unresolved follow-up reference.
5. If the last 3 runs skipped end-to-end journey checks, force an end-to-end journey check in this run.

Review protocol:
- Compare current UX and interaction patterns against [`docs/frontend/project-structure.md`](../../../docs/frontend/project-structure.md), [`docs/frontend/components.md`](../../../docs/frontend/components.md), [`docs/frontend/error-handling.md`](../../../docs/frontend/error-handling.md), [`docs/master-spec.md`](../../../docs/master-spec.md), and current route/component evidence.
- Evaluate whether flows tell a coherent product story for enterprise users operating an AI assistant workflow.
- Produce 3-6 ranked UX/product-owner recommendations with impact, effort, confidence, and concrete repository evidence.
- Apply materiality checks: "Does this reduce user friction on a real journey?" and "Does this improve cohesion across adjacent features?"
- Drop low-signal polish requests that do not materially improve usability or outcome clarity.
- Drop recommendations that are not specific to improving Template App journeys.

Issue policy:
- Ensure label availability before issue operations:
  - `gh label create product-owner --color 1D76DB --description "Product owner UX and journey improvements" --force`
- Search open and closed issues plus open PRs before creating anything.
- Reuse/extend existing issues when possible.
- Open up to 4 high-signal non-duplicate issues when confidence >= 0.75.
- Every new issue title must start with `[Product Owner]`.
- Every new issue must include:
  - Why This Improves Daily UX For Humans
  - Recommendation Metadata (rank, impact, effort, confidence)
  - Journey Stage + User Story
  - Concrete UX Evidence (current-state repo references + proposed target-state)
  - Cohesion Impact (how this aligns story/terminology across adjacent surfaces)
  - Acceptance Criteria
  - Human Approval Gate: implementation only after a human adds the `ready-for-dev` label.
- If external docs/research are cited, include a `References` section with direct clickable URLs and short relevance notes.
- Add labels `product-owner` and `codex-automation` when available.
- Do not add `ready-for-dev` from this automation; only humans apply that label when an issue is approved for implementation.

Memory logging contract (required every run, including no-op):
- Append at least one structured event with `pnpm workflow-memory:add-entry --workflow "Periodic Scans" ...`.
- Include finding + trajectory + tool trace in memory fields:
  - `finding`: top UX/journey recommendations and user-friction impact
  - `evidence`: route/component references, journey observations, and any external references used
  - `follow-up`: issue URLs, next journey focus, and approval state
- Required tags:
  - baseline: `automation,periodic-scans,product-owner,memory,workflow-memory`
  - trajectory: `trajectory:scope:<scope>`, `trajectory:domain:<domain>`
  - tools used in run: at minimum `tool:gh`, `tool:workflow-memory:add-entry`, `tool:workflow-memory:sync` plus any others actually used
- Because `memory`/`workflow-memory` tags are present, include canonical taxonomy flags:
  - `--memory-form external`
  - `--memory-function episodic,semantic`
  - `--memory-dynamics retrieve,write`
- Commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): product-owner-reviewer run memory"`
- If `workflow-memory:sync` reports non-fast-forward, allow it to auto-rebase append-only memory files and retry; only stop when conflicts include non-memory paths.
