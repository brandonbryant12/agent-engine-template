# Web App (Agent Engine Template)

This app is the MVP surface for a signed-in AI chat workflow:

- user authentication with `better-auth`
- thread sidebar with previous chats (stored per user in localStorage for MVP)
- streaming chat responses using `useChat` from AI SDK
- transport wired to backend oRPC chat stream (`chat.general`)

## Development

```bash
pnpm dev       # Start Vite dev server
pnpm test      # Run unit tests
pnpm test:e2e  # Run Playwright e2e smoke
pnpm build     # Production build
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PUBLIC_SERVER_URL` | Yes | — | Backend base URL (for auth + API requests) |
| `PUBLIC_SERVER_API_PATH` | No | `/api` | Backend API path prefix |
| `PUBLIC_WEB_URL` | No | `http://localhost:8085` | Vite dev host/port source |
| `PUBLIC_BASE_PATH` | No | `/` | Optional sub-path deployment base |

## Runtime Config

In production Docker deployments, `PUBLIC_*` variables are injected at container startup through `env.js`.

