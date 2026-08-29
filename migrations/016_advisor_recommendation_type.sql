-- Smart Advisor: add recommendation_type to distinguish holding vs opportunity advisors
-- Allows separate tracking of recommendations for:
-- - "holding": advice for currently held positions (is_held = true)
-- - "opportunity": advice for strong unheld entities (is_held = false, signal = Strong)

ALTER TABLE "advisor_recommendations"
ADD COLUMN "recommendation_type" text DEFAULT 'holding';

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_type"
ON "advisor_recommendations"("recommendation_type")
WHERE "recommendation_type" IS NOT NULL;

-- Index for combined queries: finding opportunities with high confidence
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_type_confidence"
ON "advisor_recommendations"("recommendation_type", "confidence" DESC)
WHERE "recommendation_type" = 'opportunity' AND "confidence" IS NOT NULL;
