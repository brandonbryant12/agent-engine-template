# Observability

## Span Naming

- API handlers: `api.{domain}.{action}`
- Queue operations: `queue.{action}`
- Serializers: `serialize.{entity}`

## Required Attributes

- `request.id` for API spans
- `queue.job.id` for queue transitions
- user identifier when available

## Error Logging

Use protocol-aware logging levels from error classes:
- `silent`
- `warn`
- `error`
- `error-with-stack`
