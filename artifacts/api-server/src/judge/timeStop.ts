// Time Stop — V2 Alert System, Item 1
//
// Flags a holding whose Comparison Judge verdict has stagnated: the same
// signal AND the same set of flags, unchanged, for STALE_DAYS or longer.
// This is about stagnation (nothing changing) -- Thesis Check (item 2)
// is the separate check for reversal (something that WAS true stops being true).
//
// UPGRADE FROM THE ORIGINAL SPEC: the plan doc defines this as "N
// consecutive weekly runs." Runs are only actually weekly if something
// reliably triggers Comparison Judge every week -- nothing in this
// project currently guarantees that (no confirmed cron/scheduler), so
// counting ROWS would silently mean different real-world time spans
// depending on how often it happens to run. Using elapsed CALENDAR TIME
// since the verdict last changed is robust to irregular triggering.

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 3 weeks -- long enough that normal week-to-week noise doesn't trip it,
// short enough to still be a useful nudge. Not verified against real
// portfolio outcomes -- same caveat as comparisonJudge.ts's own
// thresholds. Adjust once you've watched it fire a few times.
const STALE_DAYS = 21;

interface VerdictHistoryRow {
  signal: string;
  flags: string[];
  recorded_at: string;
}

export interface TimeStopResult {
  watchlist_id: number;
  ticker: string;
  is_stagnant: boolean;
  current_signal: string | null;
  current_flags: string[];
  stagnant_since: string | null; // when this exact signal+flags combo first appeared
  stagnant_days: number | null;
}

function sameVerdict(
  a: { signal: string; flags: string[] },
  b: { signal: string; flags: string[] }
): boolean {
  if (a.signal !== b.signal) return false;
  if (a.flags.length !== b.flags.length) return false;
  const sortedA = [...a.flags].sort();
  const sortedB = [...b.flags].sort();
  return sortedA.every((f, i) => f === sortedB[i]);
}

/** Checks one holding's verdict_history for stagnation. */
export async function checkTimeStop(watchlistId: number): Promise<TimeStopResult | null> {
  try {
    const tickerResult = await pool.query<{ ticker: string }>(
      `SELECT ticker FROM comparison_watchlist WHERE id = $1`,
      [watchlistId]
    );

    if (tickerResult.rows.length === 0) return null;

    const ticker = tickerResult.rows[0].ticker;

    const result = await pool.query<VerdictHistoryRow>(
      `SELECT signal, flags, recorded_at
       FROM verdict_history
       WHERE watchlist_id = $1
       ORDER BY recorded_at DESC`,
      [watchlistId]
    );

    const rows = result.rows;
    if (rows.length === 0) {
      // No history yet -- either step 1 hasn't run, or this holding is new.
      return {
        watchlist_id: watchlistId,
        ticker,
        is_stagnant: false,
        current_signal: null,
        current_flags: [],
        stagnant_since: null,
        stagnant_days: null,
      };
    }

    const latest = rows[0];
    let stagnantSince = latest.recorded_at;

    // Walk backward from the most recent row while the verdict keeps matching.
    // Stop at the first row that differs -- that's the boundary of "how long
    // has THIS specific verdict been true."
    for (let i = 1; i < rows.length; i++) {
      if (sameVerdict(rows[i], latest)) {
        stagnantSince = rows[i].recorded_at;
      } else {
        break;
      }
    }

    const stagnantDays = Math.floor(
      (Date.now() - new Date(stagnantSince).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      watchlist_id: watchlistId,
      ticker,
      is_stagnant: stagnantDays >= STALE_DAYS,
      current_signal: latest.signal,
      current_flags: latest.flags,
      stagnant_since: stagnantSince,
      stagnant_days: stagnantDays,
    };
  } catch (err) {
    console.error(`[checkTimeStop] failed for watchlist ${watchlistId}:`, err);
    return null;
  }
}

/** Runs checkTimeStop() for every held entity in the watchlist. */
export async function checkAllTimeStops(): Promise<TimeStopResult[]> {
  try {
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM comparison_watchlist WHERE is_held = true`
    );

    const results: TimeStopResult[] = [];
    for (const row of result.rows) {
      const timeStop = await checkTimeStop(row.id);
      if (timeStop) results.push(timeStop);
    }
    return results;
  } catch (err) {
    console.error("[checkAllTimeStops] failed:", err);
    return [];
  }
}
