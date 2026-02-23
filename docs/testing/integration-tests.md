# Integration Tests

Integration tests should target contract/handler behavior and queue interactions.

## Guidelines

- create real runtime layers for the unit under test
- seed minimal auth/user data
- assert typed error codes and status transitions

## Database

Use `pnpm test:db:setup` before DB-backed suites when needed.
