-- Prevent duplicate Smart Advisor recommendations within one coordinated bot run.

CREATE UNIQUE INDEX IF NOT EXISTS "idx_advisor_recommendations_watchlist_run_unique"
  ON "advisor_recommendations" ("watchlist_id", "run_id")
  WHERE "run_id" IS NOT NULL;
