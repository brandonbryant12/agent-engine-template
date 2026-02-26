# Rate-Limit Identity and Trusted Proxies

Rate limiting now derives identity from a server-verified socket address first,
then only considers forwarded headers when the immediate sender is trusted.

## Resolution Order

1. Read remote socket address via `@hono/node-server/conninfo`.
2. If proxy trust is disabled, use the remote socket address only.
3. If proxy trust is enabled and remote sender is trusted:
   - Parse `x-forwarded-for` and select the client hop based on trusted proxy
     hop count.
   - Fall back to `x-real-ip` when forwarded chain is unavailable.
4. If no valid signal exists, use `unknown`.

Malformed or non-IP forwarded headers are ignored.

## Environment Controls

- `RATE_LIMIT_TRUST_PROXY` (default: `true`)
  Enables trusted-proxy header processing.
- `RATE_LIMIT_TRUSTED_HOPS` (default: `1`)
  Number of trusted proxy hops between app and client identity.
- `RATE_LIMIT_TRUSTED_PROXIES` (default: `loopback,private`)
  CSV allowlist for immediate sender trust:
  - `loopback` for `127.0.0.1` / `::1`
  - `private` for RFC1918/ULA ranges
  - exact IP values
  - `*` to trust all senders (not recommended)

## Deployment Assumptions

- Single proxy:
  Keep `RATE_LIMIT_TRUSTED_HOPS=1` and include ingress proxy source addresses
  in `RATE_LIMIT_TRUSTED_PROXIES`.
- Chained proxies:
  Set `RATE_LIMIT_TRUSTED_HOPS` to the number of trusted hops nearest the app,
  and ensure each trusted hop is represented by the trusted sender allowlist.
- Local development:
  Defaults (`loopback,private`) support local reverse proxies and local direct
  requests without extra configuration.

## Security Outcome

- Direct internet clients cannot bypass limits by spoofing `x-forwarded-for`
  because their untrusted remote address is used as the identity key.
- Trusted ingress still preserves per-client rate limiting by forwarding a
  validated proxy chain.
