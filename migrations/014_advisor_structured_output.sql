-- Smart Advisor: add structured output fields to advisor_recommendations
-- Stores decision, confidence, evidence, risks, and next_review_days
-- from Gemini's structured response, allowing future queries on confidence levels,
-- decision types, and recommendation evidence/risks without parsing recommendation_text.

ALTER TABLE "advisor_recommendations"
ADD COLUMN "decision" text,
ADD COLUMN "confidence" integer,
ADD COLUMN "evidence" jsonb,
ADD COLUMN "risks" jsonb,
ADD COLUMN "next_review_days" integer;

-- Index for filtering by decision type and confidence level
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_decision_confidence"
ON "advisor_recommendations"("decision", "confidence" DESC)
WHERE "decision" IS NOT NULL;

-- Index for filtering by next_review_days
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_next_review"
ON "advisor_recommendations"("next_review_days")
WHERE "next_review_days" IS NOT NULL;
