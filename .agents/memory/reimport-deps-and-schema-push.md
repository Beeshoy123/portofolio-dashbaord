---
name: Reimported project needs deps + schema push
description: After a GitHub import/reimport, artifact workflows fail until node_modules and the DB schema are both restored — not just one of them.
---

An imported/reimported pnpm-workspace project can fail both artifact workflows with two separate root causes that look similar (both throw "module/package not found" style errors):

1. `node_modules` missing entirely → `pnpm install` at the repo root fixes both the Vite frontend ("vite: not found") and the esbuild-based API server ("Cannot find package 'esbuild'").
2. Even after install, DB-backed routes 500 with a Drizzle "Failed query: select ... from <table>" error if the Postgres schema was never pushed (e.g. a fresh/reset dev DB). Fix with the project's `db push` script (e.g. `pnpm --filter @workspace/db run push`), not by hand-writing SQL migrations.

**Why:** these two failures are independent and both must be cleared before the app is actually usable — installing deps alone leaves the API 500ing, and pushing schema alone doesn't help if `vite`/`esbuild` binaries aren't present yet.

**How to apply:** on "workflow won't start" after an import, always do `pnpm install` first, restart workflows, then check for DB errors in the API logs and run the project's schema-push command if tables are missing. An empty-but-working API response (e.g. a deliberate `404 NOT_SEEDED`) after schema push is expected behavior for projects with a "no hardcoded data" policy — not a bug to keep chasing.
