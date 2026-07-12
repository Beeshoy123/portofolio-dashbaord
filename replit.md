# Beeshoy Portfolio Tracker

A personal finance dashboard that tracks gold holdings, money-market/property funds, bank certificates, and transactions — all backed by a Postgres database instead of hardcoded numbers.

## Run & Operate

- `artifacts/api-server: API Server` workflow — runs the Express API on port 8080
- `artifacts/portfolio: web` workflow — runs the Vite dev server for the dashboard (port 21113, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml` after editing the spec
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to the dev DB
- Required env: `DATABASE_URL` — Postgres connection string (managed by Replit's built-in DB, never exposed to the frontend)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, artifact `artifacts/api-server`, mounted at `/api`
- Frontend: React + Vite, artifact `artifacts/portfolio`, mounted at `/`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → generates `@workspace/api-client-react` hooks + `@workspace/api-zod` schemas
- Build: esbuild (CJS bundle) for the API server

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the portfolio API contract (`Portfolio`, `GoldHolding`, `Fund`, `Certificate`, `Transaction`, `GrowthSnapshot`, `PortfolioSettings` schemas + `/portfolio` endpoints)
- `lib/db/src/schema/portfolio.ts` — Drizzle tables for gold, funds, certificates, transactions, growth snapshots, portfolio settings
- `artifacts/api-server/src/routes/portfolio.ts` — `GET /portfolio` (aggregate read), `PATCH /portfolio/gold`, `PATCH /portfolio/funds/:key`, `POST /portfolio/snapshots`
- `artifacts/portfolio/src/lib/portfolioMath.ts` — `computeDerived(portfolio)`: all derived numbers (P&L, yields, wallet-health scores, allocation %) computed from live DB data
- `artifacts/portfolio/src/lib/dashboardHtml.ts` — builds the dashboard markup from `portfolio` + `derived`
- `artifacts/portfolio/src/lib/dashboardBehavior.ts` — wires up interactions (tabs, NAV editor, snapshot save, DCA calculator) and calls the real mutation hooks
- `artifacts/portfolio/src/App.tsx` — fetches `useGetPortfolio()`, renders the above, owns the mutation callbacks + query invalidation, and shows a "No portfolio data found" empty state when the DB has no rows yet

## Architecture decisions

- **Hard rule: no hardcoded/placeholder financial numbers, anywhere, ever — not in routes, the frontend, schema defaults, or a seed script (there is intentionally no seed script).** Every number the user sees must come from a live query against Postgres. If the database isn't connected yet or a value is missing, surface an explicit error/"unavailable" state and wait for the real data — never substitute a sample value, even temporarily. This is enforced with policy comments at the top of `lib/db/src/index.ts`, `artifacts/api-server/src/routes/portfolio.ts`, `artifacts/portfolio/src/lib/portfolioMath.ts`, and `artifacts/portfolio/src/lib/dashboardHtml.ts`.
- Only gold, funds, and growth snapshots have write endpoints — certificates and transactions are read-only via the aggregate `GET /portfolio` since there's no write UI for them yet.
- The dashboard keeps its original vanilla-JS-style DOM templating (string-built HTML + imperative event wiring) rather than being rewritten as JSX-per-widget, to minimize risk while swapping the data source from hardcoded literals to the DB. `computeDerived` is the single place all formulas live.
- DB credentials (`DATABASE_URL`) are only ever read by `lib/db` on the API server; the frontend talks to Postgres exclusively through `/api/portfolio*` endpoints.
- **No real financial numbers live in the codebase.** There is no seed script — `GET /portfolio` returns `404 { error: "NOT_SEEDED" }` when the DB is empty, and the dashboard shows a "No portfolio data found — please import your data" message instead of fake/zero data. The user's actual data only ever exists in the live Postgres database and is backed up/restored via their own SQL exports, outside of git.

## Product

- Dashboard views: Total / Gold / Liquid / Certificates, each showing balances, P&L, and allocation derived from the DB.
- Wallet Health card (diversity/emergency-fund/yield/liquidity scores), Emergency Fund progress vs. a configurable target, and a Growth chart backed by saved snapshots.
- NAV editor (edit gold market price / fund NAV) and "Save Snapshot" both write through to Postgres and refetch afterward.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval's generated names come from each endpoint's `operationId` + `Body`/`Response` suffix (e.g. `GetPortfolioResponse`, `UpdateGoldHoldingBody`), not the raw OpenAPI component schema name (`Portfolio`, `UpdateGoldHolding`). Check the generated file's exports before importing types/schemas into route handlers.
- These two artifacts (`api-server`, `portfolio`) had `artifact.toml` files on disk but no workflows registered yet when work resumed on this project — they had to be (re)created with `configureWorkflow` using the exact command/PORT/BASE_PATH from each `artifact.toml`.
- The gold schema migrated from a single aggregate snapshot (`gold_holdings`: grams_held/avg_cost/market_price) to a per-transaction ledger (`gold_settings` + `gold_transactions`). `backups/db_backup_20260711_140726.sql` is in the old format for `gold_holdings`, but the real per-purchase gold rows were separately present in the generic `transactions` table (`asset_type = 'gold'`) with pricing folded into `amount`/`meta` — they were moved into `gold_transactions` (karat 24, `manufacturing_fee_per_gram` defaulted to 0 since the backup didn't separate fee from spot price) and removed from `transactions`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
