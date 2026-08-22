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

-- Preserve the pre-pipeline rows as one completed historical run so consumers
-- never need to mix NULL-linked data into a run-scoped query.
DO $$
DECLARE
  legacy_run_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "comparison_snapshots" WHERE "run_id" IS NULL
    UNION ALL SELECT 1 FROM "stock_fundamentals" WHERE "run_id" IS NULL
    UNION ALL SELECT 1 FROM "verdict_history" WHERE "run_id" IS NULL
    UNION ALL SELECT 1 FROM "portfolio_value_history" WHERE "run_id" IS NULL
    UNION ALL SELECT 1 FROM "advisor_recommendations" WHERE "run_id" IS NULL
  ) THEN
    INSERT INTO "bot_runs" ("status", "completed_at")
    VALUES ('completed', now())
    RETURNING "id" INTO legacy_run_id;

    UPDATE "comparison_snapshots" SET "run_id" = legacy_run_id WHERE "run_id" IS NULL;
    UPDATE "stock_fundamentals" SET "run_id" = legacy_run_id WHERE "run_id" IS NULL;
    UPDATE "verdict_history" SET "run_id" = legacy_run_id WHERE "run_id" IS NULL;
    UPDATE "portfolio_value_history" SET "run_id" = legacy_run_id WHERE "run_id" IS NULL;
    UPDATE "advisor_recommendations" SET "run_id" = legacy_run_id WHERE "run_id" IS NULL;
  END IF;
END $$;
