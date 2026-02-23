# Effect vs NestJS

## Why Effect Here

- typed effects for dependencies and errors
- explicit runtime composition through layers
- predictable error translation to API protocol

## Decision

Use Effect patterns for core backend logic in this template.

- business logic: pure Effect use-cases
- adapters: repositories, provider clients, queue handlers
- API boundary: oRPC handlers + `handleEffectWithProtocol`
