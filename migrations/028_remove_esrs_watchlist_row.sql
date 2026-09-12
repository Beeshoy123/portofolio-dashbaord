-- ESRS / Ezz Steel is outside the active EGX stock set.
-- Remove historical rows first because older deployments used non-cascading
-- foreign keys for snapshots and fundamentals.
DELETE FROM comparison_snapshots
WHERE watchlist_id IN (SELECT id FROM comparison_watchlist WHERE ticker = 'ESRS' OR lower(name) = 'ezz steel');

DELETE FROM stock_fundamentals
WHERE watchlist_id IN (SELECT id FROM comparison_watchlist WHERE ticker = 'ESRS' OR lower(name) = 'ezz steel');

DELETE FROM verdict_history
WHERE watchlist_id IN (SELECT id FROM comparison_watchlist WHERE ticker = 'ESRS' OR lower(name) = 'ezz steel');

DELETE FROM comparison_watchlist
WHERE ticker = 'ESRS'
   OR lower(name) = 'ezz steel';
