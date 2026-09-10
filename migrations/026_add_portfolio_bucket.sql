ALTER TABLE comparison_watchlist
  ADD COLUMN IF NOT EXISTS portfolio_bucket text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comparison_watchlist_portfolio_bucket_check'
  ) THEN
    ALTER TABLE comparison_watchlist
      ADD CONSTRAINT comparison_watchlist_portfolio_bucket_check
      CHECK (
        portfolio_bucket IN ('safety', 'steady_growth', 'broad_market', 'individual_stocks')
        OR portfolio_bucket IS NULL
      );
  END IF;
END $$;
