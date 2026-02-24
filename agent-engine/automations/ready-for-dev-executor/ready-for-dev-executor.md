# Ready-for-Dev Executor Playbook

Automation ID: `ready-for-dev-executor`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Role: approval-gated implementation lane for any repository issue explicitly labeled `ready-for-dev`. Execute all code-writing work from a dedicated git worktree, never from the primary checkout.

Scope and approval:
- GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR queries, comments, labels, reactions, merges, metadata). Do not use browser/manual edits or non-`gh` GitHub clients.
- Ensure the label `ready-for-dev` exists in this repository using `gh label create ready-for-dev --color 0E8A16 --description "Approved and ready for implementation automation" --force`.
- Triage open GitHub issues labeled `ready-for-dev` in this repository.
- This lane is the single implementation executor for issues marked `ready-for-dev`, including issues approved by `issue-evaluator` and any explicit human approvals.
- Use GitHub REST-style commands for triage (`gh issue list`, `gh issue view --json`, `gh api repos/...`) and do not depend on `gh api graphql` for issue selection.
- Approval gate is label-based only: implement only issues explicitly marked with the `ready-for-dev` label.
- Optional guidance comments on issues not yet labeled `ready-for-dev` are allowed and do not consume execution capacity.

Selection and bounded aggregation (`1..N` issues per run):
- Build candidate set from actionable open issues labeled `ready-for-dev`, ordered by issue number ascending.
- Select at least 1 issue when actionable candidates exist.
- N is dynamic and must stay bounded by coherent scope: default target is 1-3 issues; allow up to 5 only when issues are small, tightly related, and safely deliverable together in one PR.
- Bundling rules:
  - bias conservative: if uncertain, reduce scope and implement fewer issues
  - maintain one coherent implementation narrative (same subsystem/root-cause class)
  - do not bundle if scope/risk becomes hard to reason about in one context
  - keep to one PR per run
- Skip issues already linked to an open PR or recently processed in memory without new approval signal.
- Before final selection, run an actionability screen on candidates and skip any candidate that fails one of these checks:
  - no longer open, missing `ready-for-dev`, or assigned status changed since list call (re-check with `gh issue view --json state,labels`)
  - already linked to an open PR
  - recently processed in automation memory without new approval signal
  - already implemented on `main` based on concrete code evidence mapped to issue acceptance criteria
- For "already implemented on `main`" candidates, do not run implementation preflight/gates; instead:
  - post a concise evidence comment with file path(s) and line references
  - close issue as completed when criteria are satisfied
  - record this as `selection_outcome: skipped_already_implemented` in memory and continue candidate screening in the same run
- If no actionable issue remains after screening, end run with a concise no-op summary and memory entry (no branch/PR).

Workflow routing contract (must use correct workflow per selected issue):
- For each selected issue, assign a primary workflow and companion skills before coding using [`agent-engine/workflows/README.md`](../../workflows/README.md):
  - `Feature Delivery` for product/backend/frontend implementation work
  - `Architecture + ADR Guard` for boundary/runtime/layer/authz/observability architecture-impacting work
  - `Self-Improvement` for harness/workflow-memory/skills/automation-loop improvements
- For each selected issue, document route rationale in PR output under a `Workflow Routing` section.
- For bundled issues, ensure workflow routes are compatible in one coherent PR; if not compatible, reduce bundle size and carry overflow to later runs.
- Execute using the selected workflow contracts and required docs/guardrails for each routed task.

Runtime preflight for code tasks:
1) GitHub fast-path: run `gh auth status`, then proceed directly with required `gh` triage commands. If any required `gh` command fails due to transient network/DNS/TLS errors, run recovery before stopping:
  - retry `gh api rate_limit` up to 3 times with short backoff
  - retry once after clearing proxy env for this process: `unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy`
  - verify network path: `nslookup api.github.com`
  - if still failing, capture diagnostics and stop: `gh auth status`, `gh api rate_limit` error output, `nslookup api.github.com`
2) Shell + Node runtime: run toolchain checks through interactive login zsh and require Node >= 22.10.0:
  - `zsh -lic 'cd "$PWD" && node -v && pnpm -v && npm -v'`
  - run all remaining Node/pnpm preflight and gate commands through the same `zsh -lic` pattern in this run (do not hardcode Homebrew/corepack shim paths)
  - if check fails, capture diagnostics and stop: `echo $SHELL`, `which node`, `node -v`, `which pnpm`, `pnpm -v`, `which corepack`, `corepack --version`
3) Workspace bootstrap fast-path: run `zsh -lic 'cd "$PWD" && pnpm install --frozen-lockfile --prefer-offline'`. If it fails due to transient network/DNS errors (for example `ENOTFOUND`, `EAI_AGAIN`, `ECONNRESET`, `ETIMEDOUT`), run recovery before stopping:
  - confirm registry settings: `npm config get registry` and `pnpm config get registry`
  - retry install with `npm_config_registry=https://registry.npmjs.org pnpm install --frozen-lockfile`
  - if still failing, retry with `npm_config_registry=https://registry.npmjs.com pnpm install --frozen-lockfile`
  - if dependency-state corruption is indicated, remove node_modules once and retry install
  - if still failing, capture diagnostics and stop: `node -v`, `pnpm -v`, `npm -v`, `nslookup registry.npmjs.org`, `curl -I https://registry.npmjs.org/`
4) Container runtime fast-path: run `docker info --format '{{.ServerVersion}}'`. If it fails (especially permission denied on `/var/run/docker.sock`), run this recovery sequence before stopping:
  - `docker context ls`
  - if available, `docker context use desktop-linux`, then retry `docker info`
  - if still failing, `export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock`, then retry `docker info`
  - if still failing, `export DOCKER_HOST=unix:///var/run/docker.sock`, then retry `docker info`
  - if still failing, capture diagnostics and stop: `whoami`, `id`, `docker context ls`, `ls -l /var/run/docker.sock`, `ls -l $HOME/.docker/run/docker.sock`
5) Worktree cleanliness policy before branching:
  - run `git status --porcelain` and inspect dirty paths
  - treat dirty workflow-memory paths as expected automation artifacts, not blockers:
    - `agent-engine/workflow-memory/events/*.jsonl`
    - `agent-engine/workflow-memory/index.json`
  - do not stop to ask stash/commit/stop choices when only those paths are dirty; continue the run and carry those changes into the execution branch
  - if checkout from `origin/main` is blocked by those local changes, temporarily stash only those workflow-memory paths, create/switch branch, then re-apply stash and continue
  - for any other unexpected dirty paths, stop and report blocker details with file list

Branching and implementation contract:
- Branch from latest main every run using a dedicated git worktree:
  - `git fetch origin main`
  - `REPO_ROOT="$(git rev-parse --show-toplevel)"`
  - `RUN_TS="$(date +%Y%m%d%H%M)"`
  - `WORKTREE_BRANCH="codex/ready-for-dev-<primary-issue-number>-$RUN_TS"`
  - `WORKTREE_DIR="$REPO_ROOT/.codex-worktrees/ready-for-dev-<primary-issue-number>-$RUN_TS"`
  - `mkdir -p "$REPO_ROOT/.codex-worktrees"`
  - `git worktree add -B "$WORKTREE_BRANCH" "$WORKTREE_DIR" origin/main`
  - `cd "$WORKTREE_DIR"`
- Implement the selected issue set and any conservatively bundled related issues only in `"$WORKTREE_DIR"`.
- Read relevant docs in docs/ before edits and follow [`AGENTS.md`](../../../AGENTS.md) guardrails.
- If any implemented issue in the bundle contains a Research Trace or external paper links, append a log entry to [`research/implemented-ideas.md`](../../../research/implemented-ideas.md) with:
  - date
  - issue and PR links
  - paper link(s)
  - idea(s) adopted
  - what was implemented in this repo

Validation gates (required, in order):
Run each gate via `zsh -lic 'cd "$WORKTREE_DIR" && <gate-command>'`.
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:invariants`
- `pnpm test`
- `pnpm build`

Delivery behavior:
- If any gate fails, do not open/merge PR. Post concise failure details and next action on the primary issue, then record memory. For preflight failures (GitHub API, Docker, or npm/network), include the captured diagnostics in issue comments.
- If all gates pass, commit with a conventional message referencing the primary issue, push, and open one PR to main that:
  - uses closing/linking keywords for the issues addressed (`Fixes #...` for fully resolved issues, `Refs #...` for partials)
  - MUST include `Fixes #<primary-issue-number>` for the primary issue when the run intent is full resolution
  - includes an `Aggregated Issues` section listing all bundled issues and status
  - includes a `Workflow Routing` section mapping each issue to workflow + skills used
  - includes a `Research Log Update` section when applicable
  Then run a pre-merge linkage gate:
  - fetch PR body via `gh pr view --json body,number,url`
  - verify primary issue has a closing keyword (`Fixes #<primary-issue-number>` or `Closes #<primary-issue-number>`)
  - verify each bundled issue line in Aggregated Issues matches intent (`Fixes #...` for fully resolved, `Refs #...` for partial)
  - if linkage check fails, do not merge; update PR body or post a blocking comment, then record memory
  Then add labels codex and codex-automation when available and auto-merge with squash, deleting the merged branch from remote and local (prefer `gh pr merge --delete-branch`; if local branch still exists, delete it explicitly). After merge, clean up the git worktree with `git worktree remove "$WORKTREE_DIR"` and delete any remaining local branch pointer for `"$WORKTREE_BRANCH"`.
- After merge, verify closure/linkage for all issues referenced by the PR; if any expected closure did not occur, post corrective issue comment and open a follow-up issue for linkage failure.

Persist run memory in git-tracked workflow memory and include an inbox summary
with selected issue set, bundled issue count, workflow routing summary, branch,
PR URL, merge result, branch cleanup result, and closure verification. Hard
limit: one PR per run.
- append at least one structured event:
  - `pnpm workflow-memory:add-entry --workflow "<Core Workflow>" ...`
- commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): ready-for-dev-executor run memory"`
- if `workflow-memory:sync` reports non-fast-forward, allow it to auto-rebase
  append-only memory files and retry; only stop when conflicts include
  non-memory paths.


## LLM Trace Capture (Optional)

When trace capture is enabled for this automation, capture the LLM interaction
data alongside the standard workflow-memory event. This supports future
GAPA/DSPy prompt optimization.

### Protocol

1. **Before running**: Serialize the input context (task description, relevant
   memory, repo state summary) to a temporary JSON file.
2. **After running**: Serialize the output (raw LLM response and any structured
   results) to a temporary JSON file.
3. **Self-evaluation** (optional): Review your own output and score it on
   relevant dimensions (evidence quality, actionability, coherence, relevance).
   Generate natural language feedback about strengths and improvements.
4. **Persist trace**: Add `--trace-*` flags to the `workflow-memory:add-entry`
   command:

```bash
pnpm workflow-memory:add-entry \
  ... \  # standard flags
  --trace-playbook ready-for-dev-executor \
  --trace-playbook-version "$(git log -1 --format=%H -- agent-engine/automations/ready-for-dev-executor/ready-for-dev-executor.md)" \
  --trace-input @/tmp/trace-input.json \
  --trace-output @/tmp/trace-output.json \
  --trace-model MODEL_NAME \
  --trace-tokens '{"prompt":N,"completion":N}' \
  --trace-latency MILLISECONDS \
  --trace-ai-feedback '{"strengths":[...],"improvements":[...],"overallAssessment":"..."}' \
  --trace-score SCORE
```

5. **Cleanup**: Remove temporary trace JSON files after persisting.

See [`agent-engine/workflow-memory/traces/README.md`](../../workflow-memory/traces/README.md)
for the full trace schema and optimization roadmap.
