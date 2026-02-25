# Components

## Current Surface

- **App shell** — sidebar navigation (Dashboard, Chat, Runs) + mobile drawer
- **Auth gate** — sign-in / sign-up form
- **Dashboard** — stat cards, quick action links, recent runs list
- **Chat** — thread sidebar + message stream + composer
- **Runs page (`/jobs`)** — run stats, create-run form, full run list with SSE updates

## UX Copy Canonical Terms

- Use **Run / Runs** as the canonical user-facing noun for asynchronous work.
- Keep route path `/jobs` as an implementation detail where needed, but avoid
  user-facing labels like "Jobs", "Job Queue", or "Background Run".

## Rules

- Keep presentational components stateless when possible.
- Keep network calls in hooks/clients, not leaf components.
