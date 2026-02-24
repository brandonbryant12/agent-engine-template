# Sanity Check Playbook

Automation ID: `sanity-check`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Role: periodic autonomous sanity scan + fix lane for this repository. Execute any code-writing fix path from a dedicated git worktree, never from the primary checkout.

GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR queries, comments, labels, reactions, merges, metadata). Do not use browser/manual edits or non-`gh` GitHub clients.

Scan-selection protocol (memory-driven):
1. Read the last 8 entries in this automation memory and extract prior scope/domain/signal.
2. Choose next scan focus with weighted transitions, not pure random:
- Scope transitions: macro -> (macro|meso), meso -> (macro|meso|micro), micro -> (micro|meso).
- Walk mix target over time: about 30 percent macro, 45 percent meso, 25 percent micro.
- Domain transitions: mostly adjacent, occasional stay, occasional long-jump exploration.
3. Domain graph:
- repo-wide architecture/contract coherence (macro)
- workflow/automation/registry drift (macro)
- package-level scan (apps/* or packages/*) (meso)
- pattern-level scan (docs/patterns, docs/frontend, docs/testing rules in code) (meso)
- CI/toolchain/runtime configuration sanity (meso)
- single invariant/pattern deep check (micro)
- then loop back to repo-wide architecture/contract coherence.
4. Enforce path diversity:
- Do not repeat the exact same scope+domain path from the previous run unless signal >= 4 with unresolved high-priority follow-up.
- If repeating, include revisit justification in memory.

Execution model:
- This lane is unique: it may move directly from scan finding to implementation when confidence and scope are high.
- Target one primary finding per run. Optional second finding only when tiny and same subsystem.
- If no high-signal finding exists, produce a no-op run summary and append memory only.

Fix eligibility gate:
- Implement directly only when all hold:
  - confidence >= 0.8
  - bounded scope suitable for one coherent PR
  - clear acceptance criteria and verification plan
  - no open PR already addressing the same root-cause class
- If a finding is valid but too large/risky for one run, open/update an issue and stop (no code change).

Recurrence-to-prevention rule:
- Before coding, check for recurrence in workflow memory (`agent-engine/workflow-memory/index.json` and recent `events/*.jsonl`):
  - recurring finding class = 2 or more similar events in recent history
- If recurring finding class is detected:
  - route primary fix through `Self-Improvement`
  - require at least one prevention artifact in the same PR:
    - invariant or targeted regression test
    - lint/script guardrail
    - docs rule hardening
    - skill/playbook/automation guardrail update
- If recurring finding class is detected and no prevention artifact is included, do not auto-merge.

Workflow routing contract (must use correct workflow before coding):
- Route each selected fix to a primary workflow using [`agent-engine/workflows/README.md`](../../workflows/README.md):
  - `Feature Delivery` for product/backend/frontend implementation work
  - `Architecture + ADR Guard` for boundary/runtime/layer/authz/observability architecture-impacting work
  - `Self-Improvement` for harness/workflow-memory/skills/automation-loop improvements
- Document routing rationale in PR output under `Workflow Routing`.

Runtime preflight for code tasks:
1) GitHub fast-path: run `gh auth status`, then proceed with required `gh` triage commands. If any required `gh` command fails due to transient network/DNS/TLS errors, run recovery before stopping:
  - retry `gh api rate_limit` up to 3 times with short backoff
  - retry once after clearing proxy env for this process: `unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy`
  - verify network path: `nslookup api.github.com`
  - if still failing, capture diagnostics and stop: `gh auth status`, `gh api rate_limit` error output, `nslookup api.github.com`
2) Shell + Node runtime: run toolchain checks through interactive login zsh and require Node >= 22.10.0:
  - `zsh -lic 'cd "$PWD" && node -v && pnpm -v && npm -v'`
  - run all remaining Node/pnpm preflight and gate commands through the same `zsh -lic` pattern in this run
  - if check fails, capture diagnostics and stop: `echo $SHELL`, `which node`, `node -v`, `which pnpm`, `pnpm -v`, `which corepack`, `corepack --version`
3) Workspace bootstrap fast-path: run `zsh -lic 'cd "$PWD" && pnpm install --frozen-lockfile --prefer-offline'` with the same network/corruption recovery strategy as other code-writing lanes.
4) Container runtime fast-path: run `docker info --format '{{.ServerVersion}}'` with the same context/socket recovery strategy as other code-writing lanes.
5) Worktree cleanliness policy before branching:
  - run `git status --porcelain` and inspect dirty paths
  - treat dirty workflow-memory paths as expected automation artifacts, not blockers:
    - `agent-engine/workflow-memory/events/*.jsonl`
    - `agent-engine/workflow-memory/index.json`
  - do not stop to ask stash/commit/stop choices when only those paths are dirty; continue and carry them into the branch
  - if checkout from `origin/main` is blocked by those local changes, temporarily stash only those workflow-memory paths, create/switch branch, then re-apply stash and continue
  - for any other unexpected dirty paths, stop and report blocker details with file list

Branching, validation, and delivery:
- Branch from latest main every coding run using a dedicated git worktree:
  - `git fetch origin main`
  - `REPO_ROOT="$(git rev-parse --show-toplevel)"`
  - `RUN_TS="$(date +%Y%m%d%H%M)"`
  - `WORKTREE_BRANCH="codex/sanity-check-<focus>-$RUN_TS"`
  - `WORKTREE_DIR="$REPO_ROOT/.codex-worktrees/sanity-check-<focus>-$RUN_TS"`
  - `mkdir -p "$REPO_ROOT/.codex-worktrees"`
  - `git worktree add -B "$WORKTREE_BRANCH" "$WORKTREE_DIR" origin/main`
  - `cd "$WORKTREE_DIR"`
- Read relevant docs in docs/ before edits and follow [`AGENTS.md`](../../../AGENTS.md) guardrails.
- Required validation gates, in order (run via `zsh -lic 'cd "$WORKTREE_DIR" && <gate-command>'`):
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test:invariants`
  - `pnpm test`
  - `pnpm build`
- On gate failure: do not merge; open/update issue with blocker evidence and append memory.
- On gate success: commit, push, open one PR, and auto-merge with squash when linkage checks pass and recurrence-prevention requirements are met. Delete merged branch, then clean up the git worktree with `git worktree remove "$WORKTREE_DIR"` and delete any remaining local branch pointer for `"$WORKTREE_BRANCH"`.
- Keep to one PR per run.

PR requirements:
- Include `Scan Finding`, `Workflow Routing`, `Validation Evidence`, and `Risk/Scope Bound` sections.
- Include `Recurrence Check` section (new finding vs recurring, with memory evidence links).
- For recurring findings, include `Prevention Artifact` section with concrete files and expected recurrence reduction.
- If issue exists, include `Fixes #...` / `Refs #...` keywords.
- If issue does not exist and fix is direct, include a concise root-cause statement and evidence links in PR body.

Append concise run memory including:
- chosen scan path and why from memory
- finding severity/confidence and decision (no-op, issue-only, direct-fix)
- recurrence classification and evidence
- prevention artifact shipped (or reason none)
- workflow route used
- issue/PR URLs
- merge result
- follow-up delta
- append at least one structured event:
  - `pnpm workflow-memory:add-entry --workflow "<Core Workflow>" ...`
- commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): sanity-check run memory"`
- if `workflow-memory:sync` reports non-fast-forward, allow it to auto-rebase
  append-only memory files and retry; only stop when conflicts include
  non-memory paths.


## LLM Trace Capture

For LLM trace capture, follow the protocol in [`traces/README.md`](../../workflow-memory/traces/README.md).
