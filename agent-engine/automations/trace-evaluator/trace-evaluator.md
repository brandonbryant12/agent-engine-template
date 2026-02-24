# Trace Evaluator Playbook

Automation ID: `trace-evaluator`
Source of truth: this file is authoritative for lane behavior.

## Instructions

Use gpt-5.3-codex with reasoning effort xhigh and keep reasoning at xhigh for the full run. Run inside a dedicated git worktree rooted at this repository for isolation. Role: independent AI judge for automation trace evaluation. Advisory mode only: never implement refactors, never edit repository code or docs, and never open PRs. Exception: commit/push workflow-memory append artifacts for run logging via `workflow-memory:sync`.

Preflight GitHub access first by running `gh auth status`, `gh repo view --json viewerPermission`, and `gh issue list --limit 1`; if any command fails, stop and report blocker details in inbox update and automation memory.

Runtime bootstrap in each fresh isolated worktree before evaluation logic:
- Run dependency install: `zsh -lic 'cd "$PWD" && pnpm install --frozen-lockfile --prefer-offline'`.
- If install fails due network/registry errors, retry with explicit npm registries and stop with actionable diagnostics if still failing.
- Run workflow-memory runtime preflight: `zsh -lic 'cd "$PWD" && pnpm workflow-memory:retrieve --workflow "Periodic Scans" --limit 1 --min-score 0'`.
- If preflight fails, stop before evaluation logic and report diagnostics in run output/memory.

GitHub interaction policy: use `gh` CLI for all GitHub interactions in this run (issue/PR search/read/write, comments, labels, reactions, and metadata). Do not use browser/manual edits or non-`gh` GitHub clients.

## Purpose

This automation is the **independent feedback loop** for prompt optimization.

Self-evaluation during an automation run is inherently biased — the same model
that produced the output is rating its own work within the same context window.
This trace evaluator operates with **fresh context** and serves as an objective
"AI judge" whose feedback can drive future GAPA/DSPy optimization cycles.

The key insight from the GAPA paper: reflective prompt mutation requires
**natural language feedback** from an evaluator that is independent of the
original generation. This automation IS that evaluator.

## Trace Discovery Protocol

1. Retrieve recent workflow-memory events that have traces but lack AI feedback:
   ```bash
   pnpm workflow-memory:retrieve --has-trace --limit 20 --min-score 0
   ```

2. Filter to traces where `trace.evaluation.aiFeedback` is null/empty and
   `trace.evaluation.score` is null. These are unevaluated traces.

3. If no unevaluated traces exist, log a no-op memory entry and exit cleanly.

4. Process up to **5 traces per run** to keep context manageable and
   evaluation quality high. Prioritize:
   - Traces from automations that have never been evaluated (cold-start)
   - Oldest unevaluated traces first (FIFO within priority tier)
   - Traces from different automations over multiple traces from the same one
     (maximize coverage diversity)

## Evaluation Protocol

For each unevaluated trace, perform an independent evaluation with fresh eyes.
Do NOT read the original automation's playbook instructions during evaluation —
evaluate the output purely on its observable quality.

### Step 1: Load Context

Read the trace's `input` and `output` fields from the event JSONL file.
Understand what the automation was asked to do and what it produced.

### Step 2: Evidence Verification

When the output contains citations, references, URLs, or file paths:
- Verify URLs are reachable (use `gh` or `curl` for GitHub links)
- Verify file paths exist in the repository
- Check that cited issue/PR numbers exist and match described content
- Flag any hallucinated or broken references

Score: `evidenceValidity` (0-1, proportion of verifiable citations that check out)

### Step 3: Output Quality Assessment

Evaluate the output on these dimensions:

- **Evidence quality** (0-1): Are claims backed by specific, verifiable evidence?
  Not just "the code does X" but "file Y, line Z shows X".
- **Actionability** (0-1): Can someone act on the output without further
  research? Are next steps clear and concrete?
- **Coherence** (0-1): Is the output well-structured, internally consistent,
  and free of contradictions?
- **Relevance** (0-1): Does the output address the actual task/context from
  the input? Or did it drift to tangential topics?
- **Completeness** (0-1): Are important aspects of the task covered? Are there
  obvious gaps or missing considerations?
- **Accuracy** (0-1): Where verifiable, are factual claims correct? Do code
  references match actual code?

### Step 4: Playbook Alignment Check

Now read the source automation's playbook (from `trace.playbook` → look up
`agent-engine/automations/{playbook}/{playbook}.md`) and assess:

- **Goal alignment** (0-1): Does the output fulfill the playbook's stated
  objectives?
- **Protocol compliance** (0-1): Did the automation follow its prescribed
  protocols (e.g., random-walk rules, issue format, duplicate checks)?
- **Boundary respect** (0-1): Did the automation stay within its defined scope
  (e.g., advisory-only lanes not making code changes)?

### Step 5: Synthesize Feedback

Produce structured feedback:

```json
{
  "metrics": {
    "evidenceQuality": 0.0,
    "evidenceValidity": 0.0,
    "actionability": 0.0,
    "coherence": 0.0,
    "relevance": 0.0,
    "completeness": 0.0,
    "accuracy": 0.0,
    "goalAlignment": 0.0,
    "protocolCompliance": 0.0,
    "boundaryRespect": 0.0
  },
  "aiFeedback": {
    "strengths": ["..."],
    "improvements": ["..."],
    "criticalIssues": ["..."],
    "overallAssessment": "..."
  },
  "score": 0.0
}
```

The overall `score` is a weighted average:
- Evidence quality: 0.15
- Evidence validity: 0.15
- Actionability: 0.15
- Coherence: 0.10
- Relevance: 0.15
- Completeness: 0.10
- Accuracy: 0.10
- Goal alignment: 0.05
- Protocol compliance: 0.03
- Boundary respect: 0.02

`criticalIssues` captures any severe problems:
- Hallucinated citations or evidence
- Output contradicts its own claims
- Automation violated its boundary constraints
- Factually incorrect technical claims

### Step 6: Persist Evaluation

For each evaluated trace, create a **new** workflow-memory event that records
the evaluation. Use the original event's ID as a reference:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Self-Improvement" \
  --title "trace-evaluator: evaluated {original-automation} trace {original-event-id}" \
  --trigger "Unevaluated trace discovered" \
  --finding "Evaluation score: {score}. {one-line-summary}" \
  --evidence "Original event: {original-event-id}" \
  --follow-up "Feed into GAPA optimization pipeline when available" \
  --owner "@automation" \
  --status "open" \
  --severity "low" \
  --tags trace-evaluation,{original-automation},prompt-optimization \
  --importance 0.5 \
  --recency 0.9 \
  --confidence 0.7 \
  --trace-playbook trace-evaluator \
  --trace-playbook-version "$(git log -1 --format=%H -- agent-engine/automations/trace-evaluator/trace-evaluator.md)" \
  --trace-input '{"evaluatedEventId":"{id}","evaluatedPlaybook":"{playbook}"}' \
  --trace-output @/tmp/trace-eval-output.json \
  --trace-model MODEL_NAME \
  --trace-score {score} \
  --trace-ai-feedback @/tmp/trace-eval-feedback.json
```

Note: The evaluation feedback is stored as a **new trace** (the trace-evaluator's
own trace), not by mutating the original event. This preserves event immutability.
The link between evaluation and source is via the `evaluatedEventId` field in the
trace input.

## Evaluation Integrity Rules

1. **Independence**: Do not read the original automation's playbook UNTIL Step 4.
   Steps 2-3 must evaluate output quality blind to the playbook's instructions.
   This prevents anchoring bias.

2. **Calibration**: Apply consistent scoring standards across all automations.
   A 0.8 evidence quality score from `best-practice-researcher` should mean the
   same thing as 0.8 from `product-vision-researcher`.

3. **Honesty over nicety**: If an automation produced poor output, say so clearly.
   The entire point is honest feedback for optimization. Inflated scores poison
   the optimization dataset.

4. **Specificity**: Every score must be justified with specific examples from the
   output. "Evidence quality is 0.6" is insufficient. "Evidence quality is 0.6:
   3/5 recommendations cite specific files, but recommendations #2 and #4 make
   claims without repo evidence" is correct.

5. **No hallucination in evaluation**: If you cannot verify a citation (e.g.,
   external URL is unreachable), mark it as unverifiable rather than
   assuming it's correct or incorrect.

## Memory Persistence

Append concise run memory including:
- number of traces discovered vs evaluated
- per-trace: automation, event ID, score, one-line assessment
- any traces skipped and why
- aggregate statistics if >3 traces evaluated (mean score, lowest-scoring automation)

Workflow memory entry for the run itself:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Self-Improvement" \
  --title "trace-evaluator: evaluated N traces" \
  --trigger "Scheduled trace evaluation run" \
  --finding "Evaluated N traces across M automations. Mean score: X.XX" \
  --evidence "Trace evaluation events created: {list-of-event-ids}" \
  --follow-up "Continue trace evaluation in next run" \
  --owner "@automation" \
  --status "open" \
  --severity "low" \
  --tags trace-evaluator,prompt-optimization \
  --importance 0.5 \
  --recency 0.9 \
  --confidence 0.8
```

- commit and push memory append artifacts after each run:
  - `pnpm workflow-memory:sync --message "chore(workflow-memory): trace-evaluator run memory"`
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
  --trace-playbook trace-evaluator \
  --trace-playbook-version "$(git log -1 --format=%H -- agent-engine/automations/trace-evaluator/trace-evaluator.md)" \
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
