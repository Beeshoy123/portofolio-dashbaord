# Beeshoy Portfolio Tracker

A personal finance dashboard that tracks gold holdings, money-market/property funds, bank certificates, and transactions — all backed by a Postgres database instead of hardcoded numbers.

## Startup sequence (automatic, every run)

The **Project** run button executes these steps in order every time — not just on first run:

1. **`bash scripts/startup.sh`** — runs before either workflow starts:
   - Installs dependencies (`pnpm install`) if `node_modules` is absent. No-op if already present.
   - Pushes the Drizzle schema (`pnpm --filter @workspace/db run push`). Idempotent — only creates tables that don't exist; never touches existing data.
2. **`artifacts/api-server: API Server`** — Express API on port 8080. Starts only after step 1 succeeds.
3. **`artifacts/portfolio: web`** — Vite dev server on port 21113 (`/`). Starts only after step 2 is up.

**Empty state is expected and correct — waiting for offline SQL backup.** After schema push, the database has empty tables. The API returns `404 NOT_SEEDED` and the dashboard shows "No data found — the database is empty" with placeholder zeros. This is the correct state until the real backup is imported. The startup script never seeds, restores, or touches data — that's intentional.

**Current status: awaiting the user's offline SQL backup.** Do not seed, fabricate, or populate any data. Just run the project as-is and wait.

To restore data when ready: the user will upload their offline `.sql` backup file, then ask the agent to pipe it directly into Postgres via `psql $DATABASE_URL`, then delete the uploaded file immediately. The agent must never keep the SQL file on disk after importing.

To export data: ask the agent to generate a temporary SQL dump, download it, then ask the agent to delete it. Temporary export files generated on request are fine — they just must not be committed to GitHub or left in the project long-term.

## Workflows

- `artifacts/api-server: API Server` workflow — runs the Express API on port 8080
- `artifacts/portfolio: web` workflow — runs the Vite dev server for the dashboard (port 21113, served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml` after editing the spec
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to the dev DB
- `pnpm --filter @workspace/api-server run build` — rebuild the API bundle before restarting its workflow
- `pnpm --filter @workspace/api-server run typecheck` — typecheck the API server
- `pnpm --filter @workspace/portfolio run typecheck` — typecheck the frontend
- `node --test scripts/ai-bot-pipeline.test.mjs` — test pipeline ordering and all-fetch failure behavior
- `node --test scripts/ai-bot-contracts.test.mjs` — test API/frontend contract expectations
- `node --test scripts/parser-alert.test.mjs` — test parser fixtures and drawdown calculations
- `node --test scripts/concurrency.test.mjs` — test bot/advisor lock behavior
- `pnpm run typecheck:libs` — build generated workspace library declarations before package typechecks
- Required env: `DATABASE_URL` — Postgres connection string (managed by Replit's built-in DB, never exposed to the frontend)
- Required env: `PORTFOLIO_OWNER_USER_ID` — Supabase user UUID allowed to access this personal portfolio; the API fails closed when it is missing and rejects other authenticated users

## Replit API recovery

The API workflow owns port `8080`. Never start a second API process on that
port. If the console shows `EADDRINUSE`, stop the existing API workflow (or
stop the whole Project workflow) and start the Project workflow again.

After backend changes, use this order:

1. Stop the API workflow so no old process remains on port `8080`.
2. Run `pnpm --filter @workspace/api-server run build`.
3. Start the API workflow with `PORT=8080 pnpm --filter @workspace/api-server run dev`.
4. Confirm the console says `Server listening` on port `8080`.
5. Confirm `POST /api/ai-bot/run` returns `202` or `409`, never `404`.

If the API crashes during startup with `zod.int is not a function`, rebuild the
generated API schema compatibility output before restarting. The installed
Zod runtime uses `zod.number().int()`.

The frontend workflow uses port `21113` and must not be used as a replacement
for the API workflow. A frontend `Unknown error` on the AI pipeline can be a
masked HTML API error; inspect the API console and HTTP status first.

## Financial data privacy

Never put real balances, prices, quantities, order dates, or transaction
amounts in source files, fixtures, screenshots committed to the repository,
tests, GitHub, or permanent Replit files. Real financial data belongs only in
the user's Supabase/Postgres database. Scanner imports must be reviewed by the
user and written through authenticated API endpoints. Temporary user-provided
imports or exports must be deleted immediately after use.

## Work-session protocol

Keep this file updated while working whenever a new setup fact, runtime
failure, recovery step, or verified command is discovered. Add the smallest
useful note under the relevant section rather than relying on chat history.

- Record the actual command, working directory, port, and result for important checks.
- Record blockers with their root cause and next safe action.
- Mark whether a problem is local-only, Replit-only, or shared by both.
- Never record passwords, API keys, Supabase tokens, credential-bearing database URLs, or real financial values.
- Before finishing, verify no temporary financial export, uploaded file, duplicate server, or unnecessary background process was left behind.
- When an instruction becomes outdated, correct it in place instead of adding contradictory advice elsewhere.

## Current work log

Update this section during an active task after each meaningful discovery or
change. Keep entries short and safe; describe files, commands, symptoms, and
results without recording secrets or real portfolio values.

- 2026-08-22: Local frontend was reachable on port `3001`.
- 2026-08-22: Local API was moved from an accidental port `3000` to port `8080` so the frontend proxy could reach it.
- 2026-08-22: Local API startup was verified after rebuilding the API bundle; `/api/healthz` responded successfully.
- 2026-08-22: Local PostgreSQL SSL mismatch was identified from `The server does not support SSL connections`; local hosts now disable SSL while remote database hosts retain SSL.
- 2026-08-22: Replit API troubleshooting identified duplicate port ownership as `EADDRINUSE`; only one API workflow may listen on port `8080`.
- 2026-08-22: Future agents must append the next verified result here while working, then move durable setup guidance into the relevant section above.

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

### AI bot engine contract

The Price Checker, Comparison Judge, Smart Advisor, and Alert System are four
engines of one AI investing bot. They must work as a coordinated pipeline:

1. **Price Checker** fetches and persists current market data.
2. **Comparison Judge** reads that data and produces holding-versus-peer verdicts.
3. **Smart Advisor** reads the verdicts and produces recommendations.
4. **Alert System** reads verdict and portfolio history to detect stagnation, thesis changes, and drawdown.

The frontend should present these engines as one workflow, and backend changes
must preserve the shared authenticated data contracts between them. A later
engine should not run against missing or stale output from an earlier engine.

- **Hard rule: no hardcoded/placeholder financial numbers, anywhere, ever — not in routes, the frontend, schema defaults, or a seed script (there is intentionally no seed script).** Every number the user sees must come from a live query against Postgres. If the database isn't connected yet or a value is missing, surface an explicit error/"unavailable" state and wait for the real data — never substitute a sample value, even temporarily. This is enforced with policy comments at the top of `lib/db/src/index.ts`, `artifacts/api-server/src/routes/portfolio.ts`, `artifacts/portfolio/src/lib/portfolioMath.ts`, and `artifacts/portfolio/src/lib/dashboardHtml.ts`.
- Only gold, funds, and growth snapshots have write endpoints — certificates and transactions are read-only via the aggregate `GET /portfolio` since there's no write UI for them yet.
- The dashboard keeps its original vanilla-JS-style DOM templating (string-built HTML + imperative event wiring) rather than being rewritten as JSX-per-widget, to minimize risk while swapping the data source from hardcoded literals to the DB. `computeDerived` is the single place all formulas live.
- DB credentials (`DATABASE_URL`) are only ever read by `lib/db` on the API server; the frontend talks to Postgres exclusively through `/api/portfolio*` endpoints.
- **No real financial numbers live in the codebase.** There is no seed script — `GET /portfolio` returns `404 { error: "NOT_SEEDED" }` when the DB is empty, and the dashboard shows a "No portfolio data found — please import your data" message instead of fake/zero data. The user's actual data only ever exists in the live Postgres database.
- **No persistent backup/restore files in this repo.** The rule is about permanence, not existence: never commit a `.sql` dump to git, never leave one sitting in the project long-term, and never create a `backups/` directory or seed files. However, temporary export files generated on explicit user request are fine — generate the dump, let the user download it, then delete it immediately afterward. The same applies to imports: if the user uploads a `.sql` backup, pipe it directly into `psql`, then delete the uploaded file right after import.

## Product

- Dashboard views: Total / Gold / Liquid / Certificates, each showing balances, P&L, and allocation derived from the DB.
- Wallet Health card (diversity/emergency-fund/yield/liquidity scores), Emergency Fund progress vs. a configurable target, and a Growth chart backed by saved snapshots.
- NAV editor (edit gold market price / fund NAV) and "Save Snapshot" both write through to Postgres and refetch afterward.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval's generated names come from each endpoint's `operationId` + `Body`/`Response` suffix (e.g. `GetPortfolioResponse`, `UpdateGoldHoldingBody`), not the raw OpenAPI component schema name (`Portfolio`, `UpdateGoldHolding`). Check the generated file's exports before importing types/schemas into route handlers.
- These two artifacts (`api-server`, `portfolio`) had `artifact.toml` files on disk but no workflows registered yet when work resumed on this project — they had to be (re)created with `configureWorkflow` using the exact command/PORT/BASE_PATH from each `artifact.toml`.
- The gold schema migrated from a single aggregate snapshot (`gold_holdings`: grams_held/avg_cost/market_price) to a per-transaction ledger (`gold_settings` + `gold_transactions`). An old-format backup (`gold_holdings` shape) is not compatible as-is — per-purchase gold rows must be reshaped into `gold_transactions` (karat, `manufacturing_fee_per_gram` separated from spot price), not restored verbatim.
- **Backup/export file policy — temporary is fine, permanent is not.** The rule is about permanence, not existence. For imports: wait for the user to upload their own offline SQL backup, pipe it directly into Postgres via `psql`, delete the uploaded file immediately after — never leave it in `attached_assets/` or anywhere else. For exports: when the user explicitly asks, generate a temporary `.sql` dump, present it for download, then delete it right after. Never commit a dump to git or leave one sitting in the project. Never type real balances, prices, or transaction amounts as literals into `.ts`/`.tsx`/route files, even "temporarily" — if you ever find a real financial number hardcoded in source, replace it with a live DB-backed value or explicit error state.
- **Replit's checkpoint system is a separate, private backup — not GitHub.** Every checkpoint (auto-created as work happens) snapshots the codebase *and* the Replit-managed Postgres database, but it lives inside this repl only; it is not pushed to GitHub and not visible to anyone the repo is shared with. Do not conflate "restore from git history" with "restore from a checkpoint" — they cover different data (git has no DB rows) and different audiences (checkpoints are private to this repl, GitHub history is whatever was pushed). If the user asks to roll back data, clarify which system they mean before acting.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Windows Local Setup Notes (added after manual debugging session)

- PowerShell is supported when using `pnpm.cmd`; Git Bash is also supported.
- Use pnpm, not npm. On Windows, use `pnpm.cmd` if `pnpm` is blocked by execution policy.
- Replit live view is the authoritative full app: it supplies the managed PostgreSQL database, Supabase server secrets, API on 8080, and frontend on 21113.
- Windows local frontend: from `artifacts/portfolio`, run `pnpm.cmd run dev` (default port 3001). It proxies `/api` to `http://localhost:8080`.
- Windows local backend requires PostgreSQL 16 and a local `DATABASE_URL`; it cannot use Replit's private database automatically. Start it with `PORT=8080` only after local PostgreSQL and required server secrets are configured.
- Do not use VPN instructions for this repository. A VPN is not a normal prerequisite; connectivity failures usually mean the local database/server is unavailable or the Replit workflow is not running.
- For Replit: stop duplicate workflows, rebuild the API, then restart exactly one API workflow on 8080. Never run a second process on the same port.
- For local Windows API tests, set `PORT=8080` explicitly in the same command; the API `.env` may otherwise select port 3000.
- For a live Replit view, use the `artifacts/portfolio: web` workflow URL, not `localhost`.

## Testing protocol

Run these checks from the repository root after backend or scanner changes:

1. `pnpm run typecheck:libs`
2. `pnpm --filter @workspace/api-server run typecheck`
3. `pnpm --filter @workspace/portfolio run typecheck`
4. `node --test scripts/ai-bot-pipeline.test.mjs`
5. `node --test scripts/ai-bot-contracts.test.mjs`
6. `node --test scripts/parser-alert.test.mjs`
7. `node --test scripts/concurrency.test.mjs`

For a local API smoke test, start it with an explicit port and then check:

```bash
PORT=8080 pnpm --filter @workspace/api-server run start
curl -i http://localhost:8080/api/healthz
curl -i -X POST http://localhost:8080/api/ai-bot/run
```

The health check should return `200`. The protected AI Bot route should return
`401` without authentication, or `202`/`409` with valid authentication. A
`404` means the wrong process or stale bundle is serving the port. A startup
failure with `EADDRINUSE` means another process already owns the port; stop it
before restarting the API.
- PostgreSQL 16 must be running locally. Service name: postgresql-x64-16. Set to auto-start via: Set-Service -Name postgresql-x64-16 -StartupType Automatic (run as Administrator).
- Local PostgreSQL uses no SSL; the DB client now disables SSL automatically for `localhost`, `127.0.0.1`, and `::1`. Remote Supabase/Replit database connections continue to use SSL.
- If the local app says "connectivity issue", "VPN required", or the API returns HTTP 500 with `The server does not support SSL connections`, this is usually not a VPN problem. It means a local PostgreSQL URL is being used with SSL enabled. Confirm the database host is local, use the current DB client that disables SSL for local hosts, rebuild the API, and restart it.
- If the error changes to `ECONNREFUSED`, PostgreSQL is not running locally. Start the PostgreSQL service or use the Replit workflow, which provides its own managed database. Do not invent data or change database values to work around the connection error.
- If the frontend remains on `Loading your portfolio...`, check the API first: `curl -i http://localhost:8080/api/healthz`, then inspect the API console for database/auth errors. The frontend proxy cannot load portfolio data while the API is stopped or listening on another port.
- Local passwordless access enabled via pg_hba.conf (C:\Program Files\PostgreSQL\16\data\pg_hba.conf), changing scram-sha-256 to trust on the two 127.0.0.1/32 and ::1/128 lines, then restarting the service.
- Database created via: psql -U postgres -c "CREATE DATABASE portfolio_dev;"
- Tables created via drizzle-kit from lib/db folder: DATABASE_URL="postgresql://postgres@localhost:5432/portfolio_dev" pnpm run push
- Known bug: lib/db/drizzle.config.ts originally failed to find the schema file on Windows due to backslash paths. Fixed by appending .replace(/\\/g, '/') to the schemaPath line.
- Known typo: the actual folder name is portofolio-dashbaord (not "dashboard") — this typo is consistent throughout the project, do not "fix" it.

## Standalone operation

This application does not require Replit. Replit workflows and metadata are
optional convenience wrappers only. The standalone runtime is:

1. Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `PORTFOLIO_OWNER_USER_ID` in the process environment or an ignored local
   `.env` file. Never commit these values.
2. From the repository root, run `pnpm install`.
3. Start the API with `start-backend.bat` or `PORT=8080 pnpm --filter @workspace/api-server run start`.
4. Start the frontend with `start-frontend.bat` or `PORT=3001 pnpm --filter @workspace/portfolio run dev`.
5. Open `http://localhost:3001/`. The frontend proxies `/api` to the API on
   `http://localhost:8080`.

The standalone API uses SSL for remote Supabase/Postgres hosts and disables
SSL automatically for local PostgreSQL hosts. A local database is optional if
you use a remote Supabase Postgres connection through `DATABASE_URL`.
