# Smart Advisor & Stock Data Integration - To Do List

## 📋 Immediate Next Steps

### 1. ✅ Check if `comparison_watchlist` has `yahoo_ticker` column
```sql
SELECT ticker, yahoo_ticker FROM comparison_watchlist LIMIT 5;
```
- If column exists → proceed to step 2
- If column missing → run the SQL in step 2 first

### 2. ⚙️ Add `yahoo_ticker` column (if needed)
```sql
-- Add the column if it doesn't exist
ALTER TABLE comparison_watchlist 
ADD COLUMN yahoo_ticker VARCHAR(20);
```

### 3. 📍 Populate Egyptian stock tickers with Yahoo Finance mappings
```sql
-- Map each Egyptian stock to its Yahoo Finance ticker
UPDATE comparison_watchlist SET yahoo_ticker = 'ETEL.CA' WHERE ticker = 'ETEL';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGCH.CA' WHERE ticker = 'EGCH';
UPDATE comparison_watchlist SET yahoo_ticker = 'AMOC.CA' WHERE ticker = 'AMOC';
UPDATE comparison_watchlist SET yahoo_ticker = 'ARCC.CA' WHERE ticker = 'ARCC';
UPDATE comparison_watchlist SET yahoo_ticker = 'EGAI.CA' WHERE ticker = 'EGAI';
UPDATE comparison_watchlist SET yahoo_ticker = 'RMDA.CA' WHERE ticker = 'RMDA';

-- Verify the updates
SELECT ticker, yahoo_ticker FROM comparison_watchlist WHERE yahoo_ticker IS NOT NULL;
```

**Note:** You may need to adjust the Yahoo ticker suffixes (`.CA`, `.EG`, etc.) based on what's actually available on finance.yahoo.com for your Egyptian stocks.

---

## 🚀 After completing the above:

1. Restart the backend API server
2. Hit "Refresh Prices" in the dashboard
3. The scraper should now populate stock prices from Yahoo Finance
4. Check the Smart Advisor panel for auto-generated recommendations

---

## 📝 Related Files
- **Backend:** `artifacts/api-server/src/judge/enrichReturnsFromYahoo.ts` (newly created)
- **Scraper:** `artifacts/api-server/src/scraper/runScraper.ts`
- **Database:** Make sure `comparison_watchlist.yahoo_ticker` is populated

---

## 🔧 Manual Entry UX Enhancement

### Goal
Make manual data entry match all portfolio holdings dynamically instead of being hardcoded to fund NAVs only.

### Desired behaviour
- First field is a dropdown for the entity type
- After selecting an entity, the form shows only the relevant fields for that holding
- The same repeated field block can be used for multiple rows/entries
- Supported holdings should include:
  - Gold
  - Fund
  - Certificate
  - any additional entity type that maps to the current portfolio schema
- The field labels should follow the real database/schema column names where possible
- When one asset is selected, the form should show the matching header/data structure and not the unrelated ones

### Acceptance criteria
- User can choose entity type from dropdown first
- Input fields update dynamically based on entity type
- Repeated row pattern works for multiple entries
- Values map cleanly to the portfolio database model
- Gold, fund, and certificate entries are all supported through the same UI flow

### Files likely involved
- `artifacts/portfolio/src/lib/dashboardHtml.ts`
- `artifacts/portfolio/src/lib/dashboardBehavior.ts`
- `artifacts/portfolio/src/App.tsx`
- backend portfolio routes and schema for updates/inserts

### Notes
This is the last request that should be preserved for future work if the current API credit cycle runs out.
