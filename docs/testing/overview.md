# Testing Overview

The template uses layered checks:
- unit tests (Vitest)
- integration tests where needed
- invariant tests for architecture constraints
- e2e smoke tests (Playwright)

## Core Commands

```bash
pnpm test
pnpm test:invariants
pnpm test:e2e
```
