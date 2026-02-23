# Error Handling Pattern

## Strategy

- Define tagged errors in shared packages.
- Attach HTTP protocol metadata on error classes.
- Map errors at API boundary with `handleEffectWithProtocol`.

## Benefits

- consistent status codes
- stable error codes for frontend handling
- centralized logging policy
