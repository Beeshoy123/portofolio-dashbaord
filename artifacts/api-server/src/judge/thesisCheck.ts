// Thesis Check — V2 Alert System, Item 2
//
// Different question from Time Stop: Time Stop asks "has nothing changed
// in a while" (stagnation). Thesis Check asks "did something that WAS
// true stop being true" (reversal) -- e.g. it was beating its sector a
// month ago, now it isn't.
//
// Compares the LATEST verdict against the closest available snapshot
// that's at least LOOKBACK_DAYS old, and surfaces:
//   - any flag that's present now but wasn't back then (a new, specific
//     reason to worry that didn't exist before)
//   - whether the overall signal got worse (Strong -> Mixed/Weak, etc.)

import { pool } from "../lib/dbPool";

// How far back to look for "what did this look like before." 30 days is
// a starting point matching the doc's own "beating its sector last
// month" example -- not verified against real outcomes, tune once you've
// watched it fire a few times (same caveat as STALE_DAYS in timeStop.ts).
const LOOKBACK_DAYS = 30;

const SIGNAL_RANK: Record<string, number> = {
  "Insufficient Data": 0,
  Avoid: 1,
  Caution: 2,
  Solid: 3,
  Excellent: 4,
};

interface VerdictHistoryRow {
  signal: string;
  flags: string[];
  recorded_at: string;
  run_id: number | null;
}

export interface ThesisCheckResult {
  watchlist_id: number;
  ticker: string;
  has_reversal: boolean;
  has_enough_history: boolean; // false if no snapshot is old enough yet to compare against
  current_signal: string | null;
  current_flags: string[];
  compared_signal: string | null;
  compared_flags: string[];
  compared_at: string | null; // actual recorded_at of the snapshot used for comparison
  newly_appeared_flags: string[]; // present now, weren't present at compared_at -- the core "reason flipped" signal
  signal_degraded: boolean;
}

/** Checks one holding's verdict_history for a thesis reversal. */
export async function checkThesis(watchlistId: number, runId?: number): Promise<ThesisCheckResult | null> {
  try {
    const tickerResult = await pool.query<{ ticker: string }>(
      `SELECT ticker FROM comparison_watchlist WHERE id = $1`,
      [watchlistId]
    );

    if (tickerResult.rows.length === 0) return null;

    const ticker = tickerResult.rows[0].ticker;

    const runFilter = runId === undefined ? "" : "AND run_id = $2";
    const result = await pool.query<VerdictHistoryRow>(
      `SELECT signal, flags, recorded_at, run_id
       FROM verdict_history
       WHERE watchlist_id = $1
       ${runFilter}
       ORDER BY recorded_at DESC`,
      runId === undefined ? [watchlistId] : [watchlistId, runId]
    );

    const rows = result.rows;
    if (rows.length === 0) {
      return {
        watchlist_id: watchlistId,
        ticker,
        has_reversal: false,
        has_enough_history: false,
        current_signal: null,
        current_flags: [],
        compared_signal: null,
        compared_flags: [],
        compared_at: null,
        newly_appeared_flags: [],
        signal_degraded: false,
      };
    }

    const latest = rows[0];

    // Walk from newest to oldest; the first row that's already at least
    // LOOKBACK_DAYS old is the closest available stand-in for "a month ago."
    let comparisonRow: VerdictHistoryRow | null = null;
    for (const row of rows) {
      const ageDays =
        (Date.now() - new Date(row.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays >= LOOKBACK_DAYS) {
        comparisonRow = row;
        break;
      }
    }

    if (!comparisonRow) {
      // History exists but none of it is old enough yet -- not a reversal,
      // just not enough data to compare against. Distinct from "no reversal
      // found" so the UI can show "still gathering history" instead of a
      // false all-clear.
      return {
        watchlist_id: watchlistId,
        ticker,
        has_reversal: false,
        has_enough_history: false,
        current_signal: latest.signal,
        current_flags: latest.flags,
        compared_signal: null,
        compared_flags: [],
        compared_at: null,
        newly_appeared_flags: [],
        signal_degraded: false,
      };
    }

    const newlyAppearedFlags = latest.flags.filter(
      (f) => !comparisonRow!.flags.includes(f)
    );
    const signalDegraded =
      SIGNAL_RANK[latest.signal] < SIGNAL_RANK[comparisonRow.signal];

    return {
      watchlist_id: watchlistId,
      ticker,
      has_reversal: newlyAppearedFlags.length > 0 || signalDegraded,
      has_enough_history: true,
      current_signal: latest.signal,
      current_flags: latest.flags,
      compared_signal: comparisonRow.signal,
      compared_flags: comparisonRow.flags,
      compared_at: comparisonRow.recorded_at,
      newly_appeared_flags: newlyAppearedFlags,
      signal_degraded: signalDegraded,
    };
  } catch (err) {
    console.error(`[checkThesis] failed for watchlist ${watchlistId}:`, err);
    throw new Error(`Thesis Check could not evaluate watchlist ${watchlistId}`, { cause: err });
  }
}

/** Runs checkThesis() for every held entity in the watchlist. */
export async function checkAllTheses(runId?: number): Promise<ThesisCheckResult[]> {
  try {
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM comparison_watchlist WHERE is_held = true`
    );

    const results: ThesisCheckResult[] = [];
    for (const row of result.rows) {
      const thesis = await checkThesis(row.id, runId);
      if (thesis) results.push(thesis);
    }
    return results;
  } catch (err) {
    console.error("[checkAllTheses] failed:", err);
    throw new Error("Thesis Check could not load alert history", { cause: err });
  }
}
