CREATE TABLE IF NOT EXISTS "portfolio_summaries" (
  "id" serial PRIMARY KEY,
  "run_id" bigint NOT NULL REFERENCES "bot_runs"("id") ON DELETE CASCADE,
  "summary_text" text NOT NULL,
  "strong_count" integer NOT NULL,
  "mixed_count" integer NOT NULL,
  "weak_count" integer NOT NULL,
  "insufficient_data_count" integer NOT NULL,
  "model_used" text NOT NULL,
  "generated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("run_id")
);
