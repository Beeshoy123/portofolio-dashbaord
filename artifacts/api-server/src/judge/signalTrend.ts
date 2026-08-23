// Signal Trend — Verdict History Reader
//
// Extracts the signal progression for a holding over recent runs to give
// Gemini visibility into whether a signal is improving, stable, or declining.
// This is read-only and additive — does not change what timeStop or
// thesisCheck do with verdict_history, only adds a new read path.

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface SignalHistoryRow {
  signal: string;
  recorded_at: string;
}

/**
 * getRecentSignalTrend - retrieves the last N signals for a holding,
 * ordered oldest to newest, to show the trend of signal changes over time.
 * Returns null if no history exists, or if fewer than 2 historical points exist.
 */
export async function getRecentSignalTrend(
  watchlistId: number,
  limit: number = 5,
): Promise<SignalHistoryRow[] | null> {
  try {
    const result = await pool.query<SignalHistoryRow>(
      `SELECT signal, recorded_at
       FROM verdict_history
       WHERE watchlist_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [watchlistId, limit]
    );

    const rows = result.rows;
    // Return null if fewer than 2 points exist (a single point isn't a trend)
    if (rows.length < 2) {
      return null;
    }

    // Reverse to oldest-to-newest order
    return rows.reverse();
  } catch (error) {
    console.error(`[signalTrend] failed to fetch signal trend for watchlist ${watchlistId}:`, error);
    return null;
  }
}
