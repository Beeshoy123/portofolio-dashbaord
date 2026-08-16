# Portfolio · Beeshoy

A personal finance dashboard tracking gold holdings, investment funds, certificates, and portfolio growth snapshots.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/portfolio`)
- **Backend**: Express.js API server (`artifacts/api-server`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Monorepo**: pnpm workspaces

## How to run

Both workflows are managed by Replit:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/portfolio: web` | `PORT=21113 BASE_PATH=/ pnpm --filter @workspace/portfolio run dev` | 21113 |

The portfolio frontend is the user-facing app (port 21113). The API server runs on port 8080.

## Environment

- `DATABASE_URL` — PostgreSQL connection string (provisioned by Replit)
- `SESSION_SECRET` — secret for session signing
- `VITE_SUPABASE_URL` — Supabase project URL required by the portfolio auth gate
- `VITE_SUPABASE_ANON_KEY` — Supabase public client key required by the portfolio auth gate

The portfolio workflow starts successfully, but the frontend intentionally stops with a clear configuration error until both Supabase variables are supplied. Do not replace them with placeholder values.

## First-time setup (after import/clone)

```bash
pnpm install
pnpm --filter @workspace/db run push   # push schema to DB
```

Then start both workflows. A fresh DB will show "No data found" — that's expected until real data is entered.

## Project structure

```
artifacts/
  api-server/    Express API server
  portfolio/     React dashboard frontend
lib/
  db/            Drizzle schema + migrations
  api-spec/      OpenAPI spec
  api-zod/       Zod validators generated from spec
  api-client-react/  React Query hooks generated from spec
```

## User preferences

- Keep existing project structure and stack — do not restructure or migrate.
