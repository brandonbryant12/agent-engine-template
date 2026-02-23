# Issue Scope + Domain Contract

Version: `v1`

Applies to:
- [`issue-evaluator`](../issue-evaluator/issue-evaluator.md)
- [`ready-for-dev-executor`](../ready-for-dev-executor/ready-for-dev-executor.md)

Purpose:
- give `issue-evaluator` a deterministic way to score implementation scope
- give `ready-for-dev-executor` a deterministic signal for how many issues to bundle in one run
- link similar issues in the same domain so executor can pick coherent next work

## Scope Labels (required)

Exactly one scope label must exist on each open issue.

| Label | Numeric `scope_score` | Meaning |
|---|---:|---|
| `scope:1` | `1.0` | Tiny change (single-file or narrowly bounded guardrail/test edit). |
| `scope:2` | `2.0` | Small change (few files, one subsystem). |
| `scope:3` | `3.0` | Medium change (multi-file, moderate coordination). |
| `scope:4` | `4.0` | Large change (cross-cutting, higher risk). |
| `scope:5` | `5.0` | Very large/complex change (high coordination or architecture sensitivity). |

Scoring guidance:
- Start from explicit issue effort metadata when present (`Low`, `Low-Medium`, `Medium`, `Medium-High`, `High`).
- Adjust upward when acceptance criteria are broad, cross-package, or architecture-sensitive.
- Clamp final score to one of `1..5`.

## Domain Labels (required)

Exactly one primary domain label must exist on each open issue.

Canonical domain labels:
- `domain:api`
- `domain:auth`
- `domain:queue`
- `domain:observability`
- `domain:frontend`
- `domain:data`
- `domain:docs-tooling`

Domain guidance:
- choose the subsystem where the primary implementation risk/work sits
- for cross-cutting issues, pick the dominant implementation surface

## Related-Issue Linking Contract (required)

`issue-evaluator` maintains planning links so executor can choose coherent bundles:

- On each open issue, keep one planning comment with marker:
  - `<!-- issue-evaluator:planning:v1 -->`
- Comment fields:
  - `Scope score: <1..5>`
  - `Domain: <domain:...>`
  - `Related ready-for-dev issues: #<n>, #<m> ...` (up to 3, omit self)
  - one short rationale line for why the issues are related
- Prefer related links that share both domain and nearby scope (difference <= 1 when possible).
- If a previous planning marker comment exists, update it instead of adding noisy duplicates.

## Executor Consumption Contract (required)

`ready-for-dev-executor` must consume this contract before final selection:

1. Read `scope:*` label first for numeric `scope_score`.
2. Read `domain:*` label for bundle coherence.
3. Use planning links from evaluator comment as a strong tie-breaker for which issues to bundle next.
4. Fallback inference is allowed only when scope/domain labels are missing; report missing labels in run output.

Bundling policy stays bounded:
- target cumulative bundle score `<= 5.0`
- when multiple compatible issues are small (`scope_score <= 2.0`), bundle 2-3 in one run when safe
- keep one coherent domain narrative per PR
