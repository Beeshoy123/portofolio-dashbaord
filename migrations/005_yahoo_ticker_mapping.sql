-- Comparison Judge: Yahoo Finance ticker mapping for stocks & indices
--
-- This is a CONSOLIDATED file — combines what was previously split across
-- several messages (the yahoo_ticker column add + two separate batches of
-- UPDATE statements). Safe to run even if some of these already ran before:
-- the ALTER uses IF NOT EXISTS, and every UPDATE just re-sets the same
-- value it would already have.
--
-- Run this AFTER migration 004 (which adds the 24 new EGX30 stock rows to
-- comparison_watchlist) — the UPDATEs below only take effect on rows that
-- already exist.
--
-- Every yahoo_ticker value below was individually verified against a live
-- finance.yahoo.com quote page — none are guessed. See chat history for the
-- specific traps this avoided (e.g. plain "RAYA" on Yahoo is a different,
-- unrelated US company; "PHDC.L" / "EFID.L" are foreign GDR listings, not
-- the EGX line).
--
-- PHAR and JUFO are deliberately left unmapped (NULL) — no reliable Yahoo
-- ticker was found for either. Do not guess these; resolve them the same
-- careful way if/when needed.

-- Step 1: the column itself
ALTER TABLE comparison_watchlist ADD COLUMN IF NOT EXISTS yahoo_ticker text;

-- Step 2: original 12 stocks (from the first watchlist)
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS691S1C011.CA' WHERE ticker = 'TMGH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS655L1C012.CA' WHERE ticker = 'PHDC';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS65571C019.CA' WHERE ticker = 'MASR';
UPDATE comparison_watchlist SET yahoo_ticker = 'COMI.CA'          WHERE ticker = 'COMI';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS60081C014.CA' WHERE ticker = 'QNBE';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS3G0Z1C014.CA' WHERE ticker = 'SWDY';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS3C251C013-EGP.CA' WHERE ticker = 'ESRS';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS48031C016.CA' WHERE ticker = 'ETEL';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS745L1C014.CA' WHERE ticker = 'FWRY';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS729J1C018.CA' WHERE ticker = 'CLHO';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS512O1C012.CA' WHERE ticker = 'ISPH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS305I1C011.CA' WHERE ticker = 'EFID';

-- Step 3: the 3 indices
UPDATE comparison_watchlist SET yahoo_ticker = '^CASE30'        WHERE ticker = 'EGX30';
UPDATE comparison_watchlist SET yahoo_ticker = '^EGX70EWI.CA'   WHERE ticker = 'EGX70';
UPDATE comparison_watchlist SET yahoo_ticker = '^EGX100EWI.CA'  WHERE ticker = 'EGX100';

-- Step 4: the 24 EGX30-expansion stocks (require migration 004 to have run first)
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS38191C010.CA' WHERE ticker = 'ABUK';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS60111C019.CA' WHERE ticker = 'ADIB';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS380P1C010.CA' WHERE ticker = 'AMOC';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS3C0O1C016.CA' WHERE ticker = 'ARCC';
UPDATE comparison_watchlist SET yahoo_ticker = 'BTFH.CA'          WHERE ticker = 'BTFH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EAST.CA'          WHERE ticker = 'EAST';
UPDATE comparison_watchlist SET yahoo_ticker = 'HRHO.CA'          WHERE ticker = 'HRHO';
UPDATE comparison_watchlist SET yahoo_ticker = 'EFIH.CA'          WHERE ticker = 'EFIH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS3E181C010.CA' WHERE ticker = 'EGAL';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS38201C017.CA' WHERE ticker = 'EGCH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS673Y1C015.CA' WHERE ticker = 'EMFD';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS673T1C012.CA' WHERE ticker = 'GBCO';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS65591C017.CA' WHERE ticker = 'HELI';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS3C391C017.CA' WHERE ticker = 'MCQE';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS95001C011.CA' WHERE ticker = 'ORAS';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS70321C012.CA' WHERE ticker = 'ORHD';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS693V1C014.CA' WHERE ticker = 'OIH';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS33041C012.CA' WHERE ticker = 'ORWE';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS73541C012.CA' WHERE ticker = 'CCAP';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS690C1C010.CA' WHERE ticker = 'RAYA';
UPDATE comparison_watchlist SET yahoo_ticker = 'RMDA.CA'          WHERE ticker = 'RMDA';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS69082C013.CA' WHERE ticker = 'VLMR';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS60301C016.CA' WHERE ticker = 'HDBK';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGS42111C012.CA' WHERE ticker = 'ALCN';

-- PHAR and JUFO intentionally NOT updated — stay NULL until resolved properly.
