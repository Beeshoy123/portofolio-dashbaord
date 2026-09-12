-- Repair advisor opportunity persistence for databases where migration 017
-- created the table before sort_rank was included.
ALTER TABLE advisor_opportunities
  ADD COLUMN IF NOT EXISTS sort_rank integer;

CREATE INDEX IF NOT EXISTS idx_advisor_opportunities_run_sort_rank
  ON advisor_opportunities (run_id, sort_rank ASC)
  WHERE sort_rank IS NOT NULL;
