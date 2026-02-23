# Repository Pattern

Repositories are persistence adapters only.

## Rules

- No policy checks in repositories.
- No transport/protocol errors in repositories.
- Return typed domain rows/DTOs.

## Naming

- `findById`
- `listByUser`
- `insert`
- `update`
- `delete`
