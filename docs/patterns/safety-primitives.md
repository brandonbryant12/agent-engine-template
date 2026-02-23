# Safety Primitives

Required protections in backend flows:

- typed input validation
- authenticated context for protected routes
- protocol-aware error mapping
- bounded retries for transient external failures
- queue stale-job recovery/timeout behavior
