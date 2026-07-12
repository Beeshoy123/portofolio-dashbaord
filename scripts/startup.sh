#!/bin/bash
# startup.sh — runs every time the project starts, before any workflow.
# Safe to re-run: both steps are idempotent.
set -e

# ── Step 1: Dependencies ──────────────────────────────────────────────────────
# Always check; only install if node_modules is absent.
if [ ! -d "node_modules" ]; then
  echo "[startup] node_modules missing — running pnpm install..."
  pnpm install
  echo "[startup] pnpm install done."
else
  echo "[startup] node_modules present — skipping install."
fi

# ── Step 2: Database schema ───────────────────────────────────────────────────
# Always run — drizzle-kit push is idempotent (diffs current schema against the
# DB and only creates/alters what is missing). Creates empty tables on a fresh
# DB; no-ops when tables already exist. Never seeds or restores data.
echo "[startup] Pushing database schema..."
pnpm --filter @workspace/db run push
echo "[startup] Schema push done."

echo "[startup] Setup complete — handing off to workflows."
