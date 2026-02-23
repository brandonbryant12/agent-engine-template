# Workflow Memory Taxonomy

Use this taxonomy to keep workflow-memory tags consistent across self-improvement,
periodic scans, and agent-eval notes.

## Memory Taxonomy (Issue #66)

Apply these tags when an event is about memory behavior, memory regressions, or
workflow-memory retrieval quality.

### Form

| Tag | Meaning |
| --- | --- |
| `memory-form:parametric` | Behavior tied to model weights or prompt-internal recall, not external stores. |
| `memory-form:external` | Behavior tied to external memory stores, indexes, summaries, or retrieval helpers. |

### Function

| Tag | Meaning |
| --- | --- |
| `memory-function:semantic` | Stable factual/task knowledge and reusable rules. |
| `memory-function:episodic` | Event/run-specific recall (who/what/when happened). |
| `memory-function:working` | Short-lived context needed inside the active run. |

### Dynamics

| Tag | Meaning |
| --- | --- |
| `memory-dynamics:write` | New memory creation or memory updates. |
| `memory-dynamics:retrieve` | Memory lookup/ranking/use during execution. |
| `memory-dynamics:decay` | Signal loss from stale, compressed, or aging memory. |
| `memory-dynamics:conflict` | Competing entries or contradictory memory signals. |

### Required Memory Tag Rule

When an event includes `memory` or `workflow-memory`, include at least one tag
from each dimension:

1. `memory-form:*`
2. `memory-function:*`
3. `memory-dynamics:*`

## Agent Run Taxonomy (Issue #39)

Use these tags for agent-run failures and evaluation notes so failures can be
grouped by capability and failure class.

### Capability Axes

| Tag | Meaning |
| --- | --- |
| `capability:planning` | Task decomposition and execution plan quality. |
| `capability:tool-use` | Command/tool selection and sequencing quality. |
| `capability:long-term-reasoning` | Multi-step reasoning over longer horizons. |
| `capability:instruction-following` | Adherence to explicit request/constraints. |
| `capability:debugging` | Fault isolation, hypothesis testing, and patch verification. |

### Failure Modes

| Tag | Meaning |
| --- | --- |
| `failure:tool-misuse` | Invalid command usage or wrong tool choice. |
| `failure:state-loss` | Lost context, stale assumptions, or dropped constraints. |
| `failure:incorrect-patch` | Code change does not fix root issue or introduces breakage. |
| `failure:test-evasion` | Patch passes superficial checks but misses real behavior. |
| `failure:env-drift` | Toolchain/runtime mismatch causing false negatives or false positives. |

### Required Agent Run Tag Rule

If an event uses `capability:*` or `failure:*` tags, include at least one tag
from both groups.

## `workflow-memory:add-entry` Taxonomy Options

Use these options to append canonical tags without hand-typing prefixes:

- `--memory-form parametric|external[,..]`
- `--memory-function semantic|episodic|working[,..]`
- `--memory-dynamics write|retrieve|decay|conflict[,..]`
- `--capability planning|tool-use|long-term-reasoning|instruction-following|debugging[,..]`
- `--failure-mode tool-misuse|state-loss|incorrect-patch|test-evasion|env-drift[,..]`

Example:

```bash
pnpm workflow-memory:add-entry \
  --workflow "Self-Improvement" \
  --title "Improve memory tag consistency" \
  --trigger "Repeated memory-tag ambiguity in events" \
  --finding "Added taxonomy tags and validation in add-entry helper" \
  --evidence "agent-engine/workflow-memory/taxonomy.md, agent-engine/scripts/workflow-memory/add-entry.ts" \
  --follow-up "Apply taxonomy tags in periodic scan memory entries" \
  --owner "@team" \
  --status "closed" \
  --tags self-improvement,memory,workflow-memory \
  --memory-form external \
  --memory-function semantic \
  --memory-dynamics write,retrieve
```
