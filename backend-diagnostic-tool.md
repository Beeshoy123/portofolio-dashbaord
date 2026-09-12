# The Doctor

## Purpose

The Doctor is a read-only forensic view of AI Bot runs. It explains what ran, what failed, which entity outputs are incomplete, and why the dashboard displays unavailable values or dashes.

At the top of the panel, **Root Cause Summary** groups repeated provider and
stage failures into a short explanation and lists the stages that completed.
Start there before opening individual entity rows.

The summary also provides actions for recoverable failures:

- **Retry Chart Reader** retries only the failed entities for the current run.
- **Start new full run** reruns the complete Price Checker, Chart Reader,
  Judge, Alerts, and Advisor pipeline with a new run ID.

The tool never invents financial values and never mutates pipeline data.

The entity view distinguishes unavailable values conservatively:

- `Unavailable or not reported by source`: the source did not provide that metric.
- `Fetch failed at source`: the latest StockAnalysis fundamentals fetch failed.
- `Not applicable`: a metric is not shown for an entity type where it does not apply.

The UI does not label a value as a parser issue unless the backend has verified that the source contained a value that the parser missed.

## Backend endpoint

`GET /api/ai-bot/diagnostics`

Optional query:

- `runId`: positive run ID. When omitted, the latest run is returned.

The endpoint is mounted behind the existing authentication boundary.

### Response shape

```json
{
  "run": {
    "id": 49,
    "status": "partial",
    "started_at": "...",
    "completed_at": "...",
    "error_message": null,
    "stage_counts": {},
    "stage_errors": {}
  },
  "summary": {
    "entity_count": 0,
    "complete": 0,
    "partial": 0,
    "missing": 0,
    "dash": 0
  },
  "entities": []
}
```

Each entity contains:

- `ticker`, `name`, `entity_type`, and `is_held`
- `state`: `complete`, `partial`, `missing`, or `dash`
- `reason` and `diagnostic_messages`
- `missing_fields` and `dash_fields`
- stage presence and usability for snapshot, technical, verdict, and advisor data

The endpoint reads from `bot_runs`, `comparison_watchlist`, `comparison_snapshots`, `technical_signals`, `verdict_history`, and `advisor_recommendations`.

## Entity classification

- `complete`: every tracked stage exists and required fields are usable.
- `partial`: at least one downstream stage or required field is missing or unusable.
- `missing`: no downstream output was recorded for the entity.
- `dash`: a downstream row exists, but a business value is unavailable and the UI must render it as unavailable.

The diagnostic classifier also preserves per-ticker Chart Reader messages from `bot_runs.stage_errors.chartReader`.

## How to read the diagnostic panel

The notification badge counts only **Needs review** entities. These indicate a
pipeline or stage problem, such as a failed fetch, missing technical signal,
missing verdict, or failed Advisor output.

The **Expected unavailable** filter keeps source limitations visible without
classifying them as pipeline failures. Examples include a source not reporting
NAV/price, a missing return period, unavailable peer coverage, or an unknown
portfolio value. These rows are still useful because they explain why the UI
shows a dash and why a verdict may have lower confidence.

Use the stage filters after **Needs review**: Prices, Chart Reader, Comparison
Judge, and Advisor identify which pipeline boundary needs investigation. The
All view preserves every entity and its raw missing/dash fields.

## Chart Reader behavior

Chart Reader requires at least 20 valid OHLC candles and an EGP equity instrument.

For each mapped entity it:

1. Tries the stored Yahoo symbol.
2. Tries the current `<ticker>.CA` EGX alias if the stored symbol is stale or too sparse.
3. Falls back to StockAnalysis if Yahoo cannot provide valid history.
4. Records exact source failures and fallback usage in run diagnostics.
5. Persists only usable technical signals.

StockAnalysis may return a Cloudflare challenge in the backend environment. If no source provides enough valid history, the entity remains incomplete and no technical number is fabricated.

## Frontend behavior

The AI Insights header contains a bell icon beside Refresh prices.

Clicking the bell opens a compact diagnostic popover showing:

- run status and run ID
- stage success/failure counts
- complete, partial, missing, and dash totals
- affected entities, reasons, missing fields, and dash fields

The popover loads the latest run on startup and refreshes after a new AI Bot run. It supports English and Arabic labels.

## Run status behavior

A `bot_runs` record is marked `partial` when any recorded pipeline stage reports failures, even if the Price Checker itself succeeded. Stage details remain available through `stage_counts` and `stage_errors`.

## Data rules

- Use live database values as the source of truth.
- Treat row existence and row usability as separate checks.
- Keep missing values unavailable; do not estimate or backfill them.
- Keep the diagnostic endpoint read-only.
- Preserve exact stage and entity failure reasons where available.

## Validation

Run the focused classifier tests:

```bash
pnpm run test:diagnostics
```

Run the relevant builds and typechecks:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/portfolio run typecheck
pnpm -w run typecheck:libs
```
