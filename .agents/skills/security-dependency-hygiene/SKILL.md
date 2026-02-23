---
name: security-dependency-hygiene
description: Security and dependency hygiene workflow for auth/data safety, secret exposure prevention, and dependency risk control.
---

# Agent Engine Template Security + Dependency Hygiene

Use this skill in weekly scans, before releases, and after dependency updates.

## Security Surfaces

- authentication and authorization flows in `packages/auth/`, `packages/api/src/server/router/`, and `packages/media/src/*/use-cases/`
- user-owned resource access paths in mutating use cases under `packages/media/src/*/use-cases/`
- prompt/input sanitization boundaries in `packages/ai/src/` and use-case input mappers
- secret handling in config/log points (`apps/server/src/`, `apps/worker/src/`, env loading code)
- dependency and supply-chain risk in root `package.json`, `pnpm-lock.yaml`, and `packages/*/package.json`

## Hygiene Flow

1. Validate authn/authz for changed mutating paths.
2. Validate concealment semantics and error mapping where required.
3. Scan for likely secret leakage patterns in changed files and config.
4. Review dependency changes:
   - intentionality
   - scope
   - compatibility
   - lockfile integrity
5. Run or review vulnerability checks (`pnpm audit` or equivalent CI output when available).
6. Propose remediations with severity and operational impact.

## Output Contract

1. Critical vulnerabilities/exposures
2. High-priority remediation tasks
3. Medium/low hygiene improvements
4. Deferred risks with owner and due date

Each item includes severity, exploitability, impact, and file/package evidence.

## Memory + Compounding

`Security + Dependency Hygiene` is a utility skill. Record memory under the parent core workflow key (`Periodic Scans`, `Feature Delivery`, or `Self-Improvement`) using `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md). Include the event `id` in output.
