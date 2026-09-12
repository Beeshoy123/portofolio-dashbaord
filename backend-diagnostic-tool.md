# Backend Diagnostic Tool

## Purpose
This file captures the diagnostic findings and the planned implementation for a frontend-mounted backend diagnostic tool that shows what each AI bot run actually did, what succeeded, what failed, and what returned as blanks or dashes.

This is a reference note for future implementation. It reflects the live diagnosis performed against real database data and does not invent missing values.

---

## Document split

This file is intentionally split into two sections:

- Implementation Steps: the workflow and process used to diagnose, validate, and plan the fix.
- Finding Results: the verified technical findings from the live database and code analysis.

This separation is important because the implementation path is not the same as the root-cause evidence. The implementation path tells us how to move forward; the finding results tell us what is actually broken and why.

---

## Implementation Steps

### Executive Summary

The core issue is not that the bot never ran. The issue is that the run was only partially successful and created incomplete downstream data.

The live evidence shows:
- the bot run record exists
- some stage data exists
- some linked tables were populated
- some critical keys and fields are null or missing
- these missing values explain the blank/dash outputs in the UI

The fix is not to fabricate a return series or approximate volatility. The real solution is to diagnose and surface exactly what is missing, and then build a UI tool to expose it per run and per entity.

---

## Step-by-step diagnostic process used

The following is the actual investigation sequence used to identify the real problem.

### Step 1: Confirm the backend is connected to the real Supabase database
This is a required first check. It prevents false conclusions caused by a stale or empty localhost environment.

The project instructions state that the backend must connect to the remote Supabase PostgreSQL instance on the pooler host, not to an empty local PostgreSQL or placeholder database.

### Step 2: Inspect the run record itself
We checked the live `bot_runs` table and confirmed the run existed. The record includes the job status, timestamps, and stage metadata.

This tells us the run was created and tracked, but it does not yet tell us whether the downstream data is complete.

### Step 3: Check the run-linked tables for populated counts
We inspected the related tables for the same run, including:
- `comparison_watchlist`
- `comparison_snapshots`
- `technical_signals`
- `verdict_history`
- `advisor_recommendations`
- `portfolio_summaries`

This showed the pattern of a partial pipeline: some tables were populated, while others were incomplete or missing key rows.

### Step 4: Compare entity presence across stages
For each watchlist entity, we checked whether it had:
- snapshot data
- technical signal data
- verdict data
- advisor data

The real pattern was that many entities had some early-stage record but were missing a later-stage result. That is exactly how a partial run becomes a dash in the UI.

### Step 5: Inspect row completeness, not just row existence
The key diagnostic turn is this: a row existing is not the same as a useful row.

We looked beyond count checks into field-level completeness, especially for required verdict columns such as:
- `signal`
- `performance_grade`
- `technical_grade`
- `financial_health_grade`
- `holding_return_percent`
- `coverage_percent`
- `market_value_egp`

This is where the real issue surfaced: row exists, but the required fields are null or incomplete.

### Step 6: Validate the user-facing symptom
Once the missing fields were identified, the dashboard symptom became clear:
- the run existed
- the entity existed
- the downstream row existed or partially existed
- the key values were null
- the UI rendered a dash because the app cannot invent a number

---

---

## Finding Results

### Actual findings from the live diagnostic pass

### Finding 1: Run 49 exists
The database contains a real `bot_runs` record for run 49. That means the issue is not “the run never existed.”

### Finding 2: The run is partial, not fully successful
The evidence indicates the pipeline did some work, but it did not complete the later stages cleanly. The run contains stage metadata and some linked rows, but not enough usable data for every entity.

### Finding 3: The actual breakage is downstream data quality
The critical bug is not only stage failure. It is that partial data was saved and later shown as if it were usable.

This created a mismatch between:
- data existence
- data usefulness
- UI rendering

### Finding 4: Nulls and missing rows explain the dashes
The most important finding is that the dashboard dashes were not random. They were caused by actual missing or null values in the downstream data contract.

In practical terms:
- the entity row may exist
- the technical row may be missing
- the verdict row may exist but be incomplete
- advisor output may never have been created
- the app then renders a dash for the missing business value

### Finding 5: This is not a fabricated-number problem
The correct behavior is to keep the value blank or dash if the underlying data is missing. It is not valid to create a synthetic return series or estimated Sharpe ratio from a few summary values.

This aligns with the project rule: no fabricated values, no fake financial outputs.

---

## Actual evidence pattern observed

This is the consistent pattern we observed in the live database:

```text
run row exists
   ↓
some stage rows exist
   ↓
selected downstream rows exist but have null/required field gaps
   ↓
UI renders dash / blank because value is not legitimately available
```

This is the exact reason the diagnostic tool must show:
- process status
- entity status
- missing fields
- why the UI appears blank

---

## Why the tool must do both per-process and per-entity checks

A process-level report alone is not enough. It can say a run is partial, but it cannot tell you which entity failed or why the dashboard displays a dash.

The real diagnosis requires both:

### Process view
- which stage ran
- which stage partially ran
- which stage failed
- aggregate counts

### Entity view
- did this entity have a snapshot?
- did it have a technical signal?
- did it have a verdict?
- did it have an advisor row?
- which required field is absent?
- did it become a dash or null in the UI?

This combined view is the correct implementation target.

---

## Direct run 49 result summary

The live diagnostic pass showed the following behavior for the run in question:

- run existed in `bot_runs`
- related tables were partially populated
- some entities had early-stage data but no complete downstream output
- several verdict rows were incomplete or missing essential fields
- the missing data explains blank or dash rendering in the app

This is not an empty-table problem; it is a partial-run completeness problem.

---

## Concrete diagnostic checklist for future runs

Use this checklist for each run:

1. Does `bot_runs` have a record for the run?
2. What is the run status?
3. Which stages are present in `stage_counts` and `stage_errors`?
4. How many entities were in the watchlist?
5. For each entity, did snapshot / technical / verdict / advisor data exist?
6. Were any required fields null?
7. Which stage failed to produce completed data?
8. Was the UI rendering a dash because the value was genuinely missing?

This turns the diagnostic into a reproducible process instead of a guess.

---

## Design requirement for the future diagnostic tool

The tool should not simply say “run failed.” It must answer:

- what succeeded
- what partially succeeded
- what failed
- what was missing
- what ended up as dash / null

This is the core requirement to implement.

---

---

## Priority order to fix the finding results

### Priority 1: Fix the data-contract completeness issue
The highest-priority fix is to ensure each downstream stage only writes usable values. If the chart reader cannot produce a valid technical signal, the system must not treat the row as complete.

This is the main root cause behind dashes and missing values.

### Priority 2: Repair the stage handoff logic
The pipeline must validate that a stage passed enough data for the next stage to succeed. If a technical signal is missing, partial, or `raw_fetch_ok = false`, the verdict stage should mark that entity as incomplete instead of proceeding as if it had valid evidence.

### Priority 3: Fix the partial-run reporting pattern
The app should clearly show run status as `partial` when some entity rows are missing, not only `success` or `failed` at the run level.

### Priority 4: Fix the UI wording for missing business data
The UI should explain that a dash is a genuine missing-data condition, not a silent failure or a hidden fallback value.

### Priority 5: Make the diagnostic tool visible and actionable
Once the pipeline is stable, the diagnostic icon should present the per-run and per-entity status clearly without exposing noisy technical details.

---

## Recommendations to fix the finding results

### Recommendation 1: enforce row validity before write
Before inserting a technical signal or verdict row, enforce that required values are present. Do not allow a partially valid row to masquerade as a completed result.

### Recommendation 2: add stage-level validation gates
At each handoff boundary:
- snapshot → technical
- technical → verdict
- verdict → advisor

check whether required data exists and whether the row is genuinely usable.

### Recommendation 3: classify missing output explicitly
When a stage cannot produce valid output, mark it as `missing` or `partial`, not `success`.

### Recommendation 4: keep the run status honest
A run can be recorded in `bot_runs` and still be partial. The UI should reflect real completion quality, not just a started/stopped state.

### Recommendation 5: keep the diagnostic tool read-only
This tool should report, not mutate. It should help explain the missing data without interfering with the actual pipeline.

### Recommendation 6: add logging for failed signal reasons
Capture the exact reason for a failed technical fetch or incomplete verdict: invalid currency, sparse candle history, absent signal, null required field, etc.

### Recommendation 7: narrow the scope of fallback behavior
Fallbacks are useful, but they should not hide partial failure. If fallback data does not meet minimum validity thresholds, the result must still be marked as `partial` or `missing`.

---

## Cleanup note for the final state

Once the finding results are fully fixed in code and the pipeline is stable, this file should be reduced to implementation steps only.

The final version should no longer carry the historical findings and root-cause notes, and it should only document the working implementation path for future maintenance.

This is intentional: findings are useful during diagnosis, but after the root cause is fixed, the file should become a clean execution guide rather than an archive of broken states.

---

## Final conclusion

The live investigation established that the problem pattern is a partial AI pipeline run with incomplete downstream data. That is why the app showed dashes, blanks, and incomplete data despite the run record being present.

The correct future diagnostic tool is therefore a run-and-entity-level forensic view that captures both stage execution and business data completeness.

---

## Chart Reader failure diagnosis

### Root cause
The chart reader failed because it could not reliably obtain enough valid technical history for the entities to produce a trustworthy technical signal.

The failure path in the live code is explicit:

- it attempts to fetch Yahoo chart data
- it requires a real equity instrument with EGP pricing data
- it needs enough valid OHLC candles to derive trend and patterns
- if Yahoo fails or the data is too sparse, it falls back to StockAnalysis
- if the fallback still cannot produce enough valid candles, it writes a `technical_signals` row with `raw_fetch_ok = false` and `trend = 'unknown'`

This means the stage can still write a row, but the row is unusable as evidence for the judge.

### Why this matters downstream
The judge logic treats missing or failed technical signals as insufficient evidence. Once the technical signal is unusable:

- the verdict stage is weakened or incomplete
- some entity rows end up without a valid verdict
- downstream advisor output can also be missing
- the dashboard then shows blank or dash values because no valid value exists to render

### Short version

```text
Chart Reader fails to get valid OHLC history
   ↓
raw_fetch_ok = false / trend = unknown
   ↓
verdict stage has insufficient technical evidence
   ↓
missing downstream outputs
   ↓
dashboard displays dash / blank
```

### Relevant code behavior
The technical analysis stage explicitly checks for:
- insufficient candle history
- invalid instrument type or wrong currency
- failed fetches or parse failures
- too few valid OHLC points to form a trend/pattern signal

The stage then returns a failed signal record instead of inventing a value.

This is the correct behavior for a diagnostic tool: when the signal is not real, the app should mark it as missing rather than present a fake number.

---

## Model operating guide for future work

This section is meant to help future models and agents work correctly without repeating the same mistakes.

### Non-negotiable rules
- Use the live database as the source of truth; do not rely on inferred values or summary numbers.
- Do not fabricate missing data, return series, or volatility metrics.
- Treat a row as valid only if the required fields are present and complete.
- A run can be recorded in `bot_runs` and still be partial or unusable.
- A blank or dash in the UI is evidence of missing business data, not proof that the run failed completely.

### Required investigation pattern
1. Verify the run exists in `bot_runs`.
2. Inspect stage counts and errors.
3. Check all run-linked tables for row counts.
4. Check entity-level presence for snapshot, technical, verdict, and advisor data.
5. Verify field-level completeness for required values.
6. Classify each entity as `complete`, `partial`, `missing`, or `dash`.
7. Explain the reason in plain language.

### Required output format for any run diagnostic
Each diagnosis should contain:
- `run_id`
- `run_status`
- `stage_summary`
- `entity_count`
- `entities_with_missing_data`
- `missing_value_summary`
- `dash_or_null_summary`
- `root_cause`

### Required per-entity decision logic
For each entity, determine:
- snapshot present? yes/no
- technical present? yes/no
- verdict present? yes/no
- advisor present? yes/no
- required fields complete? yes/no
- final result state: `complete`, `partial`, `missing`, or `dash`

### What good output looks like
A future model should produce a report that answers these questions immediately:
- What existed?
- What was missing?
- What was incomplete?
- Which entities became dashes?
- Which stage failed to produce usable downstream data?

### Success criteria
A run diagnostic is considered useful only if it clearly distinguishes between:
- stage failure
- row creation without required fields
- missing entity output
- dashboard blank/dash rendering due to real nulls

This should be the standard operating minimum for any future model working on the bot pipeline or the diagnostic panel.

### Easy-to-read mental model

This is the pattern we are dealing with:

```text
Run created
   ↓
Stage A ran successfully
   ↓
Stage B partially wrote rows
   ↓
Critical fields missing
   ↓
Frontend renders dashes
```

That means the problem is not always “the whole job failed.” Often it is:

```text
The job started, wrote partial output, and then stopped being usable.
```

This is precisely why the diagnostic tool must highlight both the stage outcome and the downstream data quality.

---

## Verified Findings from the Diagnostic Pass

### 1. The run exists
The run record exists in the database and is tracked by its run ID. This is the authoritative source for run-scoped diagnostics.

### 2. The pipeline does not necessarily fail cleanly
A run can exist and still be partially complete. The diagnosis showed a pattern where:
- some rows were written
- some downstream tables were populated
- critical fields were null or absent
- the app therefore rendered blank or dash values even though the run itself was recorded

A quick way to visualize it:

```text
Complete run:
  [run exists] → [all required data exists] → [UI shows numbers]

Partial run:
  [run exists] → [some tables filled] → [critical nulls remain] → [UI shows dashes]
```

### 3. Missing or null fields are the real problem
The evidence indicates that some data was never generated, or generated without required values. That is what causes the UI to show placeholders or dashes.

Concrete examples:
- row exists in a results table, but the primary business value is null
- snapshot exists, but the derived comparison verdict is absent
- technical signal exists, but essential fields are blank
- advisor output exists, but the final recommendation block is empty

This is the critical distinction:
- Not a generic “database is empty” issue
- Not a complete pipeline failure from the start
- A partial run with incomplete data quality

This is the critical distinction:
- Not a generic “database is empty” issue
- Not a complete pipeline failure from the start
- A partial run with incomplete data quality

### 4. The app should not pretend a number exists when it does not
The original policy was explicit: do not fabricate a return series, do not estimate a Sharpe ratio from a few summary values, and do not treat missing data as real data.

This is still the correct rule.

---

## What We Learned from the Real Data

### Run-scoped structure already exists
The application already has a run-tracking model with information in:
- bot_runs
- stage_counts
- stage_errors
- run-linked entity records

These are the correct building blocks for a diagnostic panel.

### Stage-level failure and entity-level blank values are different problems
The tool should show both:
- run stage status (what the bot did)
- entity status (what each entity produced)

A stage can say success while an entity is still incomplete. This is why the diagnostic view needs both layers.

### The user-facing issue is usually the downstream null
The real UI bug is often not the stage itself; it is the row that exists but is incomplete enough to be unusable.

Examples:
- snapshot exists but no meaningful value
- technical signal exists but missing required fields
- verdict exists but critical fields are null
- advisor row exists but empty or incomplete

This is a normal failure shape for partial pipeline runs:

```text
Expected: [data complete] → [render number]
Actual:   [record exists] → [missing required field] → [render dash]
```

These generate dashes and blanks, which are the visible symptom.

### Why this matters for the diagnostic tool
A stage can be marked successful while the actual entity record remains unusable. Because of that, one UI indicator is not enough. The app needs a status stack:

```text
Run status
  ├─ stage status
  ├─ entity status
  ├─ required-field completeness
  └─ missing-data reasons
```

---

## Planned Backend Diagnostic Endpoint

### Recommended endpoint shape
Use a read-only endpoint such as:

- GET /api/ai-bot/diagnostics?runId=...
- or GET /api/ai-bot/run/:id/diagnostics

### Response object
Use a compact, structured shape like this:

```json
{
  "run": {
    "id": 49,
    "status": "partial",
    "started_at": "...",
    "completed_at": "...",
    "stage_counts": {"total": 8, "success": 5, "partial": 2, "failed": 1},
    "stage_errors": {"judge": "missing verdict payload"}
  },
  "stages": [
    { "name": "price-checker", "status": "success" },
    { "name": "judge", "status": "partial" },
    { "name": "advisor", "status": "failed" }
  ],
  "entities": [
    {
      "ticker": "T70",
      "entity_type": "fund",
      "snapshot_status": "present",
      "technical_status": "missing",
      "verdict_status": "missing",
      "advisor_status": "missing",
      "missing_fields": ["technical_signal", "verdict"],
      "errors": ["critical dependency missing"],
      "ui_visibility": "dash"
    }
  ],
  "missing_values": [
    {
      "entity": "T70",
      "table": "technical_signals",
      "field": "signal_score",
      "reason": "null"
    }
  ],
  "failed_rows": [
    { "entity": "T70", "table": "verdict_history", "issue": "row incomplete" }
  ],
  "diagnostic_summary": "Run exists, but 3 of 10 entities are missing required verdict fields."
}
```

### Simple example of the failure pattern

```text
Expected:
  entity row → verdict row → advisor row → dashboard number

Observed:
  entity row → verdict row exists but required fields NULL → dashboard shows dash
```

### Data sources
The diagnostic view should read from the relevant run-linked tables, such as:
- bot_runs
- comparison_watchlist
- comparison_snapshots
- technical_signals
- verdict_history
- advisor_recommendations
- portfolio_summaries
- alert_history

No writes should be performed from this endpoint.

---

## Front-End UX Plan

### Placement
Place a diagnostic icon next to the existing refresh prices button in the same control cluster.

### Interaction pattern
- click icon → open side panel or modal
- panel loads run diagnostics for the active or latest run
- default tab: run overview
- second tab: per-entity status
- third tab: missing data / dashes
- fourth tab: stage errors

### UX design goals
- low friction
- no interruption to normal refresh flow
- read-only
- clearly distinguishes failed, partial, and successful states
- calls out exact missing fields rather than vague errors

### Example panel layout

```text
AI Run Diagnostics
┌──────────────────────────────────────────────────────────────┐
│ Run 49 | Status: PARTIAL | 8/12 stages complete           │
├──────────────────────────────────────────────────────────────┤
│ Stage health: price-checker ✅  judge ⚠️  advisor ❌        │
│ Entities affected: 3 / 10                                    │
│ Missing values: 7                                            │
├──────────────────────────────────────────────────────────────┤
│ Entity | Snapshot | Technical | Verdict | Advisor | Result │
│ T70    | ✅        | ❌         | ❌      | ❌      | Dash   │
│ T82    | ✅        | ✅         | ⚠️       | ❌      | Partial│
│ ...                                                       │
└──────────────────────────────────────────────────────────────┘
```

This makes the real issue obvious without needing to inspect raw SQL or logs first.

---

## Data Interpretation Rules for the Diagnostic Tool

The tool should display data conservatively:

- if a field is null, show as missing
- if a table row exists but a required field is null, show as partial
- if the run is incomplete, show the run as partial even if the bot run record exists
- if a value is not real and not present, do not backfill it

This ensures the tool matches the truth and does not hide missing data behind a misleading summary.

### Decision rules for display

```text
if run row exists but required downstream data is missing:
    status = partial

if row exists but critical value is null:
    status = incomplete

if data is absent and no source exists:
    status = missing

if value is not present in the DB:
    render as empty / dash, not as a fake number
```

This keeps the diagnostic UI honest and useful.

---

## Implementation Order

### Phase 1: backend
1. Build the diagnostic read endpoint
2. Query run metadata and stage metadata
3. Query entity-level status and null/missing checks
4. Return structured diagnostics object
5. Include explicit missing-values and failed-row arrays

### Phase 2: frontend
1. Add icon beside refresh prices
2. Hook the button to fetch diagnostics
3. Render summary cards
4. Render entity table with status columns
5. Render missing-values list
6. Add a tiny “Why is this a dash?” explanation for each entity

### Phase 3: polish
1. Add filtering by stage or entity
2. Add sort by status or missing fields
3. Add copyable summary / export if useful
4. Add a “latest run only” and “all runs” toggle

### Product principle

```text
The tool should answer the question:
  “What is real, what is missing, and what is broken in this run?”
```

That is more valuable than a generic status screen.

---

## Important Constraints

- Do not change the existing pipeline logic just to make the UI look healthy.
- Do not fabricate data.
- Do not treat summary numbers as if they were a real return series.
- Do not hide missing values behind placeholders.
- The diagnostic tool should explain the leaves of the problem clearly.

---

## Current Working Diagnosis

The current diagnostic trajectory is clear:

- There is a real run record.
- There are partial writes and partial rows.
- Some joinable data exists.
- Some required fields are null.
- The UI dashes are a direct symptom of incomplete downstream data.

A concise summary of the pattern is:

```text
The run existed, but the contract between stages was broken.
A stage created a row, but not all required values were produced.
The UI then displayed a dash because the app is not allowed to invent the number.
```

The diagnostic tool is meant to reveal that pattern cleanly and make it actionable for future debugging.

---

## Final Reference Summary

This tool is best thought of as a forensic status panel for AI bot runs.

It should answer, in one place:
1. What ran successfully?
2. What partially ran?
3. What failed?
4. Which entity rows are incomplete?
5. Which values are missing and why are they showing as dashes?

If the answer to any of those is not obvious, the tool is not yet doing its job.

---

## Future Reference Note

This tool should be used as a forensic status view for each AI bot run. Its purpose is not to replace the pipeline. It exists to answer three questions quickly:

1. What worked?
2. What failed?
3. What returned as blank, dash, or missing data?

That is the core design requirement for the final implementation.
