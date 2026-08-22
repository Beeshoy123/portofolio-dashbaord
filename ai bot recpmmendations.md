# AI Bot Recommendations

This is the remaining technical backlog for the four-engine AI investing bot.

## P0: Data and Security

1. True row-level user isolation
   - Add owner IDs to portfolio, watchlist, snapshots, advisor, and alert tables.
   - Apply ownership filters to every query.
   - The current owner allowlist supports only one personal user.

2. Escape generated dashboard HTML
   - Prevent database or scraper values from creating XSS through innerHTML.

## P1: Scraper and Data Integrity

3. Make scraper runs transactional
   - Commit snapshots and fundamentals consistently.
   - Handle interrupted runs cleanly.

4. Improve portfolio history recording
   - Record partial valuations explicitly when one asset class lacks live pricing.

5. Complete timeout coverage
   - Add timeouts to every fetch, Playwright operation, and response read.

6. Improve fundamentals freshness display
   - Show the actual fundamentals timestamp in the frontend.
   - Clearly label unavailable or stale fields.

7. Validate Comparison Judge with real data
   - Add fixtures for peer groups, signals, risk tiers, missing data, and fundamentals warnings.

## P1: Smart Advisor and Alerts

8. Add backend-owned alert thresholds
    - Define drawdown and other alert severity thresholds in the API.

9. Populate and validate alert history continuously
    - Confirm verdict_history and portfolio_value_history receive usable records over multiple runs.

## P2: Input and Runtime Safety

10. Validate OCR scanner input
    - Reject impossible prices, quantities, amounts, and dates.

11. Remove client-provided Gemini keys
    - Only use the server-side GEMINI_API_KEY.

12. Handle auth initialization failures
    - Prevent an infinite loading state when getSession() fails.

13. Abort frontend requests on unmount
    - Apply AbortController to advisor and scraper polling/generation.

## Testing

14. Add real behavior tests
    - Parser fixtures
    - Database persistence tests
    - Alert calculation tests
    - Authentication tests
    - Concurrency tests

The current contract and pipeline suite contains 9 passing tests.

## Completed Integration Work

- Shared bot_runs schema and run IDs across Price Checker, Judge, Alerts, and Smart Advisor
- Coordinated `/api/ai-bot/run` pipeline
- Run-aware Judge, Time Stop, Thesis Check, and Smart Advisor
- Frontend four-engine workflow status strip
- Active-run recommendation filtering
- Failed bot-run finalization
- Standalone scraper deprecation
- Advisor recommendation idempotency with migration 011
- Real Yahoo Chart historical returns for mapped stocks and indices
- Scraper/advisor advisory locks and request timeouts
- Alert-history migration and portfolio history writes
- Advisor/alert contract alignment and authenticated frontend requests
- Comparison Judge implementation and explicit database errors
- Progressive Price Checker table, summaries, and retry handling
- Obsolete Yahoo implementation and dependency removal

