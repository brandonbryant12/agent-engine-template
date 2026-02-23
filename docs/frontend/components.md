# Components

## Current Surface

- **App shell** — sidebar navigation (Dashboard, Chat, Jobs) + mobile drawer
- **Auth gate** — sign-in / sign-up form
- **Dashboard** — stat cards, quick action links, recent runs list
- **Chat** — thread sidebar + message stream + composer
- **Jobs** — run stats, create-run form, full run list with SSE updates

## Rules

- Keep presentational components stateless when possible.
- Keep network calls in hooks/clients, not leaf components.
