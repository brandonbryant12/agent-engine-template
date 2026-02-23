---
name: frontend-design
description: Intentional UI design workflow for Agent Engine Template `apps/web`. Use when designing or refreshing page/component visuals, layout, styling, or interaction polish, especially when requests call for a distinct visual direction instead of generic UI.
---

# Agent Engine Template Frontend Design

Apply this skill when shipping design-heavy frontend changes in `apps/web`.

## Steps

1. Define design intent before coding:
   - tone and visual direction (editorial, technical, playful, etc.)
   - hierarchy plan (hero, sections, density, emphasis)
   - state plan (loading, empty, error, success)
2. Anchor implementation to repo standards:
   - follow typography, spacing, token, and animation scales in [`docs/frontend/styling.md`](../../../docs/frontend/styling.md)
   - preserve container/presenter responsibilities from [`docs/frontend/components.md`](../../../docs/frontend/components.md)
   - keep data/routing concerns aligned with [`.agents/skills/tanstack-vite/SKILL.md`](../tanstack-vite/SKILL.md)
3. Implement with project primitives:
   - use `@repo/ui` components first
   - use Tailwind utilities and semantic tokens only (no hardcoded color literals, no inline styles)
   - keep Radix portal widths tied to trigger-width CSS variables
4. Add purposeful visual character:
   - avoid flat, boilerplate layouts; choose an explicit composition
   - use atmospheric backgrounds (gradients/shapes/patterns) that preserve readability
   - use 1-2 meaningful animations and respect reduced-motion expectations
5. Validate quality gates:
   - desktop + mobile rendering checks
   - keyboard navigation, visible focus, semantic labeling, and contrast checks
   - composition-first APIs (avoid boolean-prop mode sprawl)

## Repo Anchors

- [`docs/frontend/styling.md`](../../../docs/frontend/styling.md)
- [`docs/frontend/components.md`](../../../docs/frontend/components.md)
- [`.agents/skills/tanstack-vite/SKILL.md`](../tanstack-vite/SKILL.md)
- `apps/web/src`
- `packages/ui/src`

## Review Checklist

- Visual direction is explicit and not interchangeable boilerplate.
- Required UI states are intentionally designed.
- Styling uses semantic tokens and Tailwind utilities only.
- Typography/spacing/motion choices match repo scales.
- Component APIs stay composition-friendly.
- Accessibility baseline holds (keyboard/focus/labels/contrast).
- UI is validated for mobile and desktop.

## Memory + Compounding

No standalone memory key.
Use the parent workflow key (`Feature Delivery`, `Architecture + ADR Guard`, or `Self-Improvement`) and log outcomes with `pnpm workflow-memory:add-entry` per [`agent-engine/workflow-memory/README.md`](../../../agent-engine/workflow-memory/README.md).
