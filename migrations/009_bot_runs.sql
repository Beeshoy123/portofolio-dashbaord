-- Shared execution context for the four-engine AI investing bot.
-- Apply after comparison_snapshots and stock_fundamentals exist.

CREATE TABLE IF NOT EXISTS "bot_runs" (
  "id" bigserial PRIMARY KEY,
  "status" text NOT NULL DEFAULT 'running',
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone,
  "succeeded_count" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "total_count" integer NOT NULL DEFAULT 0,
  "error_message" text
);

ALTER TABLE "comparison_snapshots"
  ADD COLUMN IF NOT EXISTS "run_id" bigint REFERENCES "bot_runs"("id") ON DELETE SET NULL;

ALTER TABLE "stock_fundamentals"
  ADD COLUMN IF NOT EXISTS "run_id" bigint REFERENCES "bot_runs"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_comparison_snapshots_run_id"
  ON "comparison_snapshots" ("run_id");

CREATE INDEX IF NOT EXISTS "idx_stock_fundamentals_run_id"
  ON "stock_fundamentals" ("run_id");
