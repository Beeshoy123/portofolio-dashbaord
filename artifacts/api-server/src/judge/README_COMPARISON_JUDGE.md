# Comparison Judge & Smart Advisor — Feature Architecture & Reference

The Comparison Judge is the core deterministic evaluation engine of the portfolio dashboard. It evaluates each watchlist asset (funds, stocks, indices) against relevant peer groups, chart patterns, and benchmarks. Its outputs serve as the single source of truth for the V2 Alert System and Smart Advisor LLM explanations.

---

## Architecture Overview

```
Comparison Watchlist + Snapshots + Technical Signals
                     ↓
        comparisonJudge.judgeHolding()
                     ↓
   ┌─────────────────┴─────────────────┐
   ↓                                   ↓
HoldingVerdict (Report Card)     verdict_history (Postgres)
   ↓                                   ↓
   ├─► V2 Alert System (Time Stop, Thesis Check, Drawdown)
   ├─► Portfolio Summary (Counts, Value Weights, Aggregate Metrics)
   └─► Smart Advisor LLM Prompt (Gemini 3.7 Flash)
```

---

## Core Features

### 1. Peer grouping
**What it does:** Organizes comparable assets for any given holding into four distinct reference buckets (`sector_sibling`, `manager_sibling`, `direct_stock`, `benchmark`), filtering out the emergency cash reserve fund (`ABR` / Bareeq).
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `groupFor()`, `buildGroup()`, `isEmergencyReserveFund()`, and `judgeHolding()`.
**Scope:** Per-entity
**UI status:** Partial (The per-entity Comparison Judge panel displays aggregate comparable return counts and coverage, but individual peer-group cards and entry-level comparison tables are not directly rendered in the workspace view).

### 2. Win/loss tally
**What it does:** Computes the head-to-head performance delta (`gap_percent = holdingReturn - peerReturn`) against every peer with usable return data, counting beats (`gap_percent > 0`) versus losses (`gap_percent < 0`) overall and per group.
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `buildGroup()` (lines 197–199 for `you_beat_count`/`you_lose_count`) and `judgeHolding()` (lines 230–232 for `comparableEntries`, `beats`, `loses`).
**Scope:** Per-entity
**UI status:** Partial (The entity panel displays `comparable_with_return_count` out of `comparable_count`, but the exact beat/loss ratio, e.g. "Beating 4 of 6 peers", is not explicitly displayed as a visual counter).

### 3. Strong/Mixed/Weak/Insufficient Data signal
**What it does:** Determines the primary verdict signal from the peer win rate (≥60% = Strong, 40–59% = Mixed, <40% = Weak, 0 usable comparables = Insufficient Data), and enforces a sample-size guardrail capping "Strong" at "Mixed" if usable comparables are fewer than `MIN_RELIABLE_COMPARABLES` (4).
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `MIN_RELIABLE_COMPARABLES` (line 13) and `judgeHolding()` (lines 243–255).
**Scope:** Per-entity
**UI status:** Complete (Rendered as color-coded verdict pills `ai-bot-verdict-pill` on the per-entity panel, and aggregated into "By count" and "By value" status rows in the portfolio overview).

### 4. Warning flags
**What it does:** Automatically pushes deterministic diagnostic flag strings into the verdict's `flags` array when data anomalies, performance deficits, sample limitations, or chart/fundamental conflicts occur.
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `judgeHolding()` (lines 233–261). Flag strings actually emitted in code:
- `missing_${period}_return` (holding itself lacks historical return)
- `no_comparable_return_data` (zero peers have return data)
- `underperforming_comparables` (holding loses to more peers than it beats)
- `incomplete_comparison_data` (at least one peer in a group is missing return data)
- `thin_comparable_sample` (win rate qualified for Strong but capped at Mixed due to <4 comparables)
- `technical_divergence` (holding has Strong signal but technical trend is downtrend)
- `reversal_risk_elevated` (technical signal detects elevated reversal risk from bearish patterns in an uptrend)
**Scope:** Per-entity
**UI status:** Partial (Portfolio summary displays aggregate `⚑ [count] flagged` and `⚠ [count] diverging` pills, but individual diagnostic flag badges are not rendered directly inside the per-entity card).

### 5. Report card bundle
**What it does:** Bundles the complete `HoldingVerdict` payload (entity metadata, returns, EGP position value, risk tier, chart technical signal, data quality stats, comparison groups, signal, coverage %, flags, and completeness booleans) and logs it into `verdict_history` for downstream consumption by the Alert System and Smart Advisor.
**Where it lives:** `artifacts/api-server/src/judge/types.ts` (`HoldingVerdict` interface), `artifacts/api-server/src/judge/comparisonJudge.ts` (`judgeHolding()`, lines 283–326), `artifacts/api-server/src/routes/aiBot.ts`, and `artifacts/api-server/src/routes/advisor.ts`.
**Scope:** Per-entity
**UI status:** Complete (Fully persisted in Postgres, retrieved via API endpoints, and powers the entire AI Bot Workspace interface).

### 6. Insufficient Data + coverage_percent
**What it does:** Calculates `coverage_percent = Math.round((comparableWithReturnCount / comparableCount) * 1000) / 10` to measure peer data completeness, setting signal to "Insufficient Data" when coverage is 0 or no peer returns exist.
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `judgeHolding()` (lines 243–244, 269–271) and `artifacts/api-server/src/routes/aiBot.ts` (`avgCoveragePercent`).
**Scope:** Per-entity
**UI status:** Complete (Displayed inline on the entity verdict pill e.g. `(68.5% coverage)` and aggregated in the portfolio overview as `📊 avg [X]% coverage`).

### 7. Reversal risk
**What it does:** Analyzes OHLC candlestick data to detect bearish reversal patterns (hanging man, shooting star, evening star, three black crows, dark cloud cover) during an active uptrend, flagging `reversal_risk = "elevated"` (or `"watch"` for neutral patterns) and triggering the `reversal_risk_elevated` flag in the verdict.
**Where it lives:** `artifacts/api-server/src/technical/technicalAnalysis.ts` — `reversalRiskOf()` (lines 39–49) and `artifacts/api-server/src/judge/comparisonJudge.ts` — `judgeHolding()` (lines 259–261).
**Scope:** Per-entity
**UI status:** Complete (Rendered in Chart Reader footer as `· Reversal Alert` or `· Reversal Watch` with descriptive tooltip, and aggregated in portfolio overview as `↩ [count] reversal risk`).

### 8. Technical divergence
**What it does:** Identifies holdings where peer fundamentals/returns yield a "Strong" signal but technical price trend is in a confirmed "downtrend", pushing the `technical_divergence` flag to signal potential trend conflict.
**Where it lives:** `artifacts/api-server/src/judge/comparisonJudge.ts` — `judgeHolding()` (lines 256–258).
**Scope:** Per-entity
**UI status:** Partial (Summarized at the portfolio level as `⚠ [count] diverging`, and both the chart downtrend and Strong verdict appear in their respective cards, but an explicit dedicated "Technical Divergence" badge is not displayed on the per-entity Comparison Judge panel).

### 9. Opportunity Candidate
**What it does:** Evaluates unheld watchlist entities (`is_held = false`) with `judgeAllHoldings(..., true)`, identifying non-held assets with a "Strong" signal, discovering underrepresented sectors (<10% portfolio allocation with strong unheld alternatives), and presenting actionable rotation/entry ideas.
**Where it lives:** `artifacts/api-server/src/advisor/opportunityAnalysis.ts` (`analyzePortfolioOpportunities()`), `artifacts/api-server/src/judge/comparisonJudge.ts` (`findOpportunities()`), and `artifacts/portfolio/src/components/AiBotWorkspace.tsx` (`opportunities` hook and rendering at lines 211–226, 353–366, 382).
**Scope:** Portfolio-wide & Per-entity
**UI status:** Complete (Rendered as a dedicated `🎯 Opportunities` list in the portfolio overview panel, and displayed as a `💡 Opportunity Candidate` banner in the Smart Advisor panel when viewing an unheld strong asset).

---

## Known gaps (as of August 29, 2026)

1. **Peer Group Breakdown Cards (Feature 1 - Partial)**: The per-entity Comparison Judge panel displays aggregate metrics (`comparable_with_return_count` of `comparable_count` and `coverage_percent`), but does not render individual group breakdown cards (e.g. Sector Siblings vs. Manager Siblings vs. Direct Stocks vs. Benchmark) showing which specific peers were evaluated.
2. **Explicit Win/Loss Count Display (Feature 2 - Partial)**: The exact number of beats versus losses (e.g., "Beating 4 / Losing to 2") is computed in `judgeHolding()` but is not rendered as a direct tally in `AiBotWorkspace.tsx`.
3. **Per-Holding Diagnostic Flag Badges (Feature 4 - Partial)**: Diagnostic flags (`underperforming_comparables`, `thin_comparable_sample`, `incomplete_comparison_data`, `missing_return_1y_return`, `reversal_risk_elevated`) are tracked on each `HoldingVerdict` and fed to the LLM prompt and alert system, but are not rendered as badge chips on the individual entity Comparison Judge panel.
4. **Per-Holding Technical Divergence Badge (Feature 8 - Partial)**: While the portfolio summary displays `⚠ [count] diverging`, the per-entity Comparison Judge card does not display a dedicated warning chip when a holding has a concurrent Strong signal and chart downtrend.

