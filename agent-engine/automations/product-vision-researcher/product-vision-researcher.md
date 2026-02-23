# Product Vision Researcher Playbook

Automation ID: `product-vision-researcher`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Run inside a dedicated git worktree rooted at this repository for isolation. Role: strategic product-vision lane for Agent Engine Template as an internal enterprise AI assistant platform powered primarily by Gemini and Google APIs. Keep this lane strictly focused on making Agent Engine Template better for real users and enterprise outcomes; reject generic product or AI ideas that do not materially improve this repository's product direction. Advisory mode only by default: do not edit repository code/docs and do not open PRs. Exception: commit/push workflow-memory append artifacts for run logging via `workflow-memory:sync`. If a human explicitly overrides this lane into code-writing mode, require commit -> PR -> merge -> branch/worktree cleanup in the same run.

Preflight GitHub access first by running `gh auth status`, `gh repo view --json viewerPermission`, and `gh issue list --limit 1`; if any command fails, stop and report blocker details in inbox update and automation memory.

GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR search/read/write, comments, labels, reactions, and metadata). Do not use browser/manual edits or non-`gh` GitHub clients.

Memory-driven focus protocol:
1. Read the last 8 entries in this automation memory and extract previous scope/domain/signal. Also review recent `product-vision` issues (open + closed) to identify prior hypotheses this lane already proposed.
2. Choose a primary focus with weighted transitions, not pure random:
- Scope transitions: macro -> (macro|meso), meso -> (macro|meso).
- Walk mix target: about 60 percent macro, 40 percent meso over time.
- Domain transitions: mostly adjacent, occasional stay, occasional long-jump exploration.
3. Domain graph:
- north-star product narrative and business outcomes (macro)
- enterprise adoption, governance, and safety constraints (macro)
- generative-ai capability radar with Gemini + Google API focus (macro)
- external market and competitor product movement scan (meso)
- cross-surface product portfolio gaps (chat/runs/events/auth/ops) (meso)
- product-to-platform fit across Google AI Studio, Vertex AI, and Google Cloud primitives (meso)
- then loop back to north-star product narrative and business outcomes.
4. Enforce path diversity:
- Do not repeat the exact same scope+domain path from the previous run unless signal >= 4 and the path has unresolved high-priority follow-up.
- If repeating, explicitly justify the revisit in run memory with the unresolved follow-up reference.
5. Include external research when it materially improves confidence; force external research at least once every 2 runs.

Research protocol:
- Prioritize official and primary sources plus recent release notes.
- Prioritize this stack for external research: Gemini, Google AI Studio, Vertex AI, Google Cloud AI platform updates, and enterprise governance guidance relevant to AI assistant operations.
- Compare findings against [`docs/master-spec.md`](../../../docs/master-spec.md), generated product surfaces in [`docs/spec/generated/`](../../../docs/spec/generated/), [`AGENTS.md`](../../../AGENTS.md), [`agent-engine/workflows/README.md`](../../../agent-engine/workflows/README.md), and recent workflow memory.
- Produce 3-6 ranked product opportunities with impact, effort, confidence, and concrete repository evidence.
- For each candidate opportunity, run a prior-idea debate against related previous product-vision issues:
  - Keep: the prior thesis still holds with stronger/new evidence.
  - Amend: the prior thesis is directionally right but needs scope/timing changes.
  - Reject: new evidence invalidates the prior thesis.
- Record the debate outcome and rationale in run output and issue body/comments.
- Apply materiality checks: "Does this strengthen product direction for enterprise users now?" and "What measurable product outcome improves?"
- Drop low-signal ideas that do not change product clarity, adoption, or differentiated capability.
- Drop recommendations that are not specific to improving Agent Engine Template.

Issue policy:
- Ensure label availability before issue operations:
  - `gh label create product-vision --color 0E8A16 --description "Strategic product vision opportunities" --force`
- Search open and closed issues plus open PRs before creating anything.
- Reuse/extend existing issues when possible.
- If a recommendation is materially the same topic as a prior issue (same user outcome + same core intervention), reuse that issue instead of creating a new one. Update the issue body/comment with the latest debate result (keep/amend/reject), new evidence, and revised priority.
- Create a new issue only when the recommendation is materially unrelated to prior issues.
- Open up to 3 high-signal non-duplicate issues when confidence >= 0.75.
- Every new issue title must start with `[Product Vision]`.
- Every new issue must include:
  - Why This Change Makes Sense Now For Humans
  - Recommendation Metadata (rank, impact, effort, confidence)
  - Enterprise User Narrative (user segment + business/user outcome)
  - Concrete Product Evidence (current-state repo references + target-state behavior)
  - Gemini/Google API Alignment (how the idea uses or benefits from Google-first AI strategy)
  - Prior Idea Debate (prior issue linkage + keep/amend/reject decision + rationale)
  - Acceptance Criteria
  - Human Approval Gate: implementation only after a human adds the `ready-for-dev` label.
- If external docs/release notes/research are cited, include a `References` section with direct clickable URLs and short relevance notes.
- For any issue influenced by external papers or reports, include a Research Trace section with:
  - Source link(s)
  - Key idea(s) selected for this repo
  - Planned adaptation in this codebase (not generic advice)
  - Requirement that implementers append [`research/implemented-ideas.md`](../../../research/implemented-ideas.md) when shipped
- Add labels `product-vision` and `codex-automation` when available.
- Do not add `ready-for-dev` from this automation; only humans apply that label when an issue is approved for implementation.

Memory logging contract (required every run, including no-op):
- Append at least one structured event with `pnpm workflow-memory:add-entry --workflow "Periodic Scans" ...`.
- Include finding + trajectory + tool trace in memory fields:
  - `finding`: top recommendation summary and why it matters now
  - `evidence`: repo file evidence + external references used
  - `follow-up`: issue URLs, next path hypothesis, and approval state
- Required tags:
  - baseline: `automation,periodic-scans,product-vision,memory,workflow-memory`
  - trajectory: `trajectory:scope:<scope>`, `trajectory:domain:<domain>`
  - tools used in run: at minimum `tool:gh`, `tool:workflow-memory:add-entry`, `tool:workflow-memory:sync` plus any others actually used
- Because `memory`/`workflow-memory` tags are present, include canonical taxonomy flags:
  - `--memory-form external`
  - `--memory-function episodic,semantic`
  - `--memory-dynamics retrieve,write`
- Commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): product-vision-researcher run memory"`
- If `workflow-memory:sync` reports non-fast-forward, allow it to auto-rebase append-only memory files and retry; only stop when conflicts include non-memory paths.
