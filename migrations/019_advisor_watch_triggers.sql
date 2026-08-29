-- Smart Advisor: add watch_trigger and do_not_act_reasons to advisor_recommendations
-- Stores the concrete watch trigger condition and explicit reasons not to act yet
-- from Gemini's structured response.

ALTER TABLE "advisor_recommendations"
ADD COLUMN IF NOT EXISTS "watch_trigger" text,
ADD COLUMN IF NOT EXISTS "do_not_act_reasons" jsonb;

-- Index for filtering by presence of watch triggers
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_watch_trigger"
ON "advisor_recommendations"("watch_trigger")
WHERE "watch_trigger" IS NOT NULL AND "watch_trigger" != '';

