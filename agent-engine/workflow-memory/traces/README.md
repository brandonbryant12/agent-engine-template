# LLM Trace Capture for Prompt Optimization

This directory documents the trace capture infrastructure that enables future
GAPA/DSPy-style prompt optimization for automation playbooks.

## Why Traces?

The [GAPA (Generalized Automatic Prompt Adaptation)](https://arxiv.org/abs/2311.09558) methodology
requires three ingredients to automatically optimize prompts:

1. **The current prompt/instructions** — the playbook `.md` file
2. **Input/output examples** — what was sent to the LLM and what it produced
3. **Feedback signals** — human ratings, AI self-evaluation, or metric scores

Without captured traces, you cannot build the optimization dataset. The
workflow-memory system already captures *what happened* (findings, follow-ups),
but not the *raw LLM interaction* that produced those results.

## Trace Schema

Each workflow-memory event can include an optional `trace` field:

```json
{
  "trace": {
    "playbook": "best-practice-researcher",
    "playbookVersion": "abc123",
    "input": {
      "context": "Repository state, prior memory, etc.",
      "taskDescription": "The specific task given to the LLM"
    },
    "output": {
      "raw": "Full LLM response text",
      "structured": {
        "recommendations": [],
        "issuesOpened": []
      }
    },
    "evaluation": {
      "metrics": {
        "evidenceQuality": 0.8,
        "actionability": 0.7,
        "coherence": 0.9
      },
      "humanFeedback": null,
      "aiFeedback": {
        "strengths": ["Well-sourced recommendations"],
        "improvements": ["Could include more concrete code examples"],
        "overallAssessment": "Good research depth, moderate actionability"
      },
      "score": 0.78
    },
    "metadata": {
      "model": "gpt-5.3-codex",
      "temperature": null,
      "tokens": { "prompt": 12000, "completion": 3500 },
      "latencyMs": 45000,
      "timestamp": "2026-02-24T14:30:00.000Z"
    }
  }
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `playbook` | Yes | Automation ID (e.g. `best-practice-researcher`) |
| `playbookVersion` | No | Git SHA or content hash of the `.md` playbook file |
| `input` | No | The context and task description sent to the LLM |
| `output` | No | Raw and/or structured LLM output |
| `evaluation` | No | Feedback signals (metrics, human, AI, score) |
| `metadata` | No | Model info, token counts, latency |

All fields except `playbook` are optional. Capture what you can — partial
traces are still valuable for optimization.

## Feedback Strategy: Independent Evaluation over Self-Evaluation

A key insight from the GAPA paper: **self-evaluation during a run is biased**.
The same model that produced the output rates its own work within the same
context window, leading to inflated scores and blind spots.

Instead, this system uses a two-tier feedback approach:

### Tier 1: Optional In-Run Self-Evaluation (Lightweight)

Automations *can* run a quick self-evaluation after their main task. This is
cheap and immediate but inherently biased. Useful as a rough signal but not
sufficient for optimization.

### Tier 2: Independent Trace Evaluator (Primary Feedback Source)

The [`trace-evaluator`](../../automations/trace-evaluator/trace-evaluator.md)
automation runs on a separate schedule and evaluates traces with **fresh
context**. It:

- Discovers traces that lack AI feedback
- Evaluates output quality across 10 dimensions (evidence quality/validity,
  actionability, coherence, relevance, completeness, accuracy, goal alignment,
  protocol compliance, boundary respect)
- Verifies citations and references are real
- Checks playbook alignment (blind evaluation first, then alignment check)
- Produces structured feedback with specific justifications for each score

This independent evaluation is the **natural language feedback** that GAPA uses
for reflective prompt mutation. It's what makes future optimization possible.

### Example Evaluation Output

```json
{
  "metrics": {
    "evidenceQuality": 0.85,
    "evidenceValidity": 0.9,
    "actionability": 0.6,
    "coherence": 0.9,
    "relevance": 0.95,
    "completeness": 0.7,
    "accuracy": 0.85,
    "goalAlignment": 0.8,
    "protocolCompliance": 0.9,
    "boundaryRespect": 1.0
  },
  "aiFeedback": {
    "strengths": [
      "All recommendations cite specific repo files",
      "Clear impact/effort/confidence ratings"
    ],
    "improvements": [
      "Recommendation #2 lacks a concrete code example",
      "Could cross-reference with existing open issues"
    ],
    "criticalIssues": [],
    "overallAssessment": "Strong research with good evidence. Actionability could improve with more implementation guidance."
  },
  "score": 0.82
}
```

## Capturing Traces via CLI

Use the existing `add-entry` command with trace flags:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Periodic Scans" \
  --title "best-practice-researcher: meso scan" \
  --trigger "Scheduled random-walk run" \
  --finding "Found 3 recommendations" \
  --evidence "https://github.com/org/repo/issues/123" \
  --follow-up "Await evaluation" \
  --owner "@automation" \
  --status "open" \
  --trace-playbook best-practice-researcher \
  --trace-playbook-version abc123def \
  --trace-input @/tmp/trace-input.json \
  --trace-output @/tmp/trace-output.json \
  --trace-model gpt-5.3-codex \
  --trace-tokens '{"prompt":12000,"completion":3500}' \
  --trace-latency 45000 \
  --trace-ai-feedback '{"strengths":["Good evidence"],"improvements":["More examples"],"overallAssessment":"Solid","score":0.78}' \
  --trace-score 0.78
```

The `@` prefix for `--trace-input` and `--trace-output` reads JSON from a file
path, which is useful when the content is large.

## Roadmap: From Traces to Optimization

```
Phase 1 (this PR): Trace capture infrastructure
  └── Automations write traces to workflow-memory events

Phase 2: Trace analysis tooling
  └── Scripts to extract, filter, and analyze traces
  └── Identify low-scoring runs and common failure patterns

Phase 3: GAPA/DSPy optimization pipeline
  └── Feed traces into DSPy optimizers
  └── Current playbook + (input, output, feedback) examples → improved playbook
  └── A/B test optimized vs. original playbooks

Phase 4: Continuous optimization loop
  └── Automated trace collection → periodic optimization runs
  └── Human review of proposed playbook changes
  └── Version tracking via playbookVersion field
```

## Integration with Workflow Memory

Traces are stored inline within workflow-memory events (not in separate files).
This means:

- Existing events without traces continue to work unchanged
- Traces are queryable via the same retrieval tooling
- Index rows include `hasTrace: true` and `tracePlaybook` for filtering
- Monthly summaries can reference trace quality trends

## References

- [GAPA: Generalized Automatic Prompt Adaptation](https://arxiv.org/abs/2311.09558)
- [DSPy: Programming—not Prompting—Foundation Models](https://arxiv.org/abs/2310.03714)
- [TextGrad: Automatic Differentiation via Text](https://arxiv.org/abs/2406.07496)
