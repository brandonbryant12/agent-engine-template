# Control Surfaces And Enforcement

This page is the operational reference for repository management controls.
It maps each surface to its canonical location, enforcement path, and output evidence.

## Surface Matrix

| Surface | Canonical Location | Enforced By | Produced Evidence |
|---|---|---|---|
| Master behavior spec | [`docs/master-spec.md`](../docs/master-spec.md), `docs/spec/generated/*`, `agent-engine/scripts/spec/*` | `pnpm spec:generate`, `pnpm spec:check` | Updated generated snapshots, spec drift pass |
| Architecture/pattern standards | `docs/architecture/*`, `docs/patterns/*` | Type checks, lint, invariant tests, PR review | Rule-conformant code and tests |
| Frontend standards | `docs/frontend/*` | Lint, web tests/build, PR review | Hook/component/route behavior aligned with docs |
| Testing standards | `docs/testing/*` | Test selection and CI gates | Correct test depth by change type |
| Workflow catalog | `agent-engine/workflows/registry.json`, `agent-engine/workflows/*/README.md` | `pnpm workflows:generate`, docs review | Generated workflow catalog + per-workflow playbooks |
| Skill system | `.agents/skills/*/SKILL.md` | `agent-engine/scripts/sync-skills.sh`, `pnpm skills:check:strict` | Valid canonical skills + symlink mirrors |
| Lint rules | `tools/eslint/base.js`, `tools/eslint/custom-rules.js`, package eslint configs | `pnpm lint` | Static rule pass/fail |
| Invariant tests | `packages/api/src/server/__tests__/*invariants.test.ts`, `packages/testing/src/__tests__/docs-invariants.test.ts` | `pnpm test:invariants` | Policy invariants pass/fail |
| Workspace quality gates | `package.json` scripts, `turbo.json`, `vitest.config.ts` | `pnpm typecheck`, `pnpm test`, `pnpm build` | Full build and runtime confidence |
| Workflow memory | `agent-engine/workflow-memory/*`, `agent-engine/scripts/workflow-memory/*.ts` | Add/retrieve/coverage/scenario scripts | Durable event logs + index + summaries |
| Automation lanes | `agent-engine/automations/*/*.md`, `agent-engine/automations/*/*.toml` | Lane preflights + lane-specific gate contracts | Automated issue/PR execution trails |
| CI/CD pipelines | `.github/workflows/*.yml` | GitHub Actions job gates | PR/main quality reports |

## `enforced-by` Markers In Standards Docs

Many docs rules include `<!-- enforced-by: ... -->` markers. They indicate expected enforcement mode:

| Marker | Practical Meaning | Typical Enforcement Path |
|---|---|---|
| `types` | Compile-time contract | `pnpm typecheck` and type signatures |
| `eslint` / `lint` | Static rule | `pnpm lint` + custom ESLint rules |
| `invariant-test` | Non-negotiable policy check | `pnpm test:invariants` |
| `architecture` | Boundary/runtime structure | Design review + integration tests + docs checks |
| `manual-review` | Human judgment required | PR review skills (`pr-risk-review`, `architecture-adr-guard`) |

`manual-review` rules are intentionally not fully automated; they are review checklists and risk controls.

## Lifecycle Wiring

| Phase | Primary Surfaces | Required Checks |
|---|---|---|
| Intake | Workflow + skills + standards docs | Scope and risk flags from `intake-triage` |
| Design/Spec | Master spec + architecture docs | Spec updates and generated artifacts when behavior changes |
| Implementation | Pattern/frontend docs + skills | Slice-level tests and guardrail compliance |
| Validation | Lint + tests + invariants + build | Full gate ladder before merge |
| Merge/Release | PR risk review + CI/CD | Linkage, gate evidence, deployment policy |
| Learning loop | Workflow memory + periodic scans + self-improvement | Event persistence, coverage checks, guardrail updates |

## Naming Boundaries To Keep Clear

1. Workflow memory keys are not automation lane IDs.
Examples:
- Memory key: `Feature Delivery`
- Automation lane: `ready-for-dev-executor`

2. Workflows are process contracts; skills are execution methods.
Examples:
- Workflow: `Feature Delivery`
- Skill: `feature-delivery`

3. Automation lanes can execute multiple workflows/skills.
Examples:
- Automation lane: `ready-for-dev-executor`
- Executes: `Self-Improvement` workflow and `Feature Delivery` workflow with utility skills such as `debug-fix`

4. Skill source is canonical in `.agents/skills`.
`.agent/skills`, `.claude/skills`, and `.github/skills` are mirrors.

5. [`docs/master-spec.md`](../docs/master-spec.md) has generated and non-generated sections.
Only non-generated sections should be edited directly.

## Practical Start Sequence For New Contributors

1. Read [`agent-engine/README.md`](./README.md).
2. Read [`agent-engine/workflows/README.md`](./workflows/README.md) and the selected workflow page.
3. Read only the standards docs relevant to the touched surface.
4. Use the matching skills from `.agents/skills`.
5. Run required gates.
6. Persist workflow memory for workflows executed.
