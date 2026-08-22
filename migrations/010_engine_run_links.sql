-- Link downstream engine outputs to the coordinated AI bot run.

ALTER TABLE "verdict_history"
  ADD COLUMN IF NOT EXISTS "run_id" bigint REFERENCES "bot_runs"("id") ON DELETE SET NULL;

ALTER TABLE "portfolio_value_history"
  ADD COLUMN IF NOT EXISTS "run_id" bigint REFERENCES "bot_runs"("id") ON DELETE SET NULL;

ALTER TABLE "advisor_recommendations"
  ADD COLUMN IF NOT EXISTS "run_id" bigint REFERENCES "bot_runs"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_verdict_history_run_id"
  ON "verdict_history" ("run_id");

CREATE INDEX IF NOT EXISTS "idx_portfolio_value_history_run_id"
  ON "portfolio_value_history" ("run_id");

CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_run_id"
  ON "advisor_recommendations" ("run_id");
