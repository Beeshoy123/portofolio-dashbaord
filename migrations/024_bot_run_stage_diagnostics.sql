-- Persist stage-level progress and per-ticker Smart Advisor outcomes.

ALTER TABLE "bot_runs"
  ADD COLUMN IF NOT EXISTS "stage_counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "stage_errors" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "advisor_recommendations"
  ADD COLUMN IF NOT EXISTS "generation_status" text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS "error_message" text;

CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_run_status"
  ON "advisor_recommendations" ("run_id", "generation_status");