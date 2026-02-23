# Frontend Project Structure

```text
apps/web/src/
  clients/
    api-client.ts         # oRPC API client (raw + TanStack Query)
    auth-client.ts        # better-auth React client
  components/
    app-shell.tsx          # Sidebar navigation + layout wrapper
    auth-gate.tsx          # Sign-in / sign-up form
    logo.tsx               # EngineIcon + LogoMark shared components
  lib/
    chat-utils.ts          # Thread persistence, message extraction
    run-utils.ts           # Run state, SSE event reducer, formatting
  pages/
    dashboard.tsx          # Overview: stats, quick actions, recent runs
    chat.tsx               # AI chat with thread management
    jobs.tsx               # Job queue: create runs, monitor progress
  main.tsx
  router.tsx               # Route definitions + auth layout
  query-client.ts
  style.css
```

The app uses a multi-page layout with sidebar navigation. Each feature gets its own page under `pages/`. Shared components live in `components/` and reusable logic in `lib/`.
