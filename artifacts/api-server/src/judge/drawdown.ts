// Portfolio Drawdown -- V2 Alert System, Item 4
//
// Drawdown = how far the portfolio has fallen from its highest recorded
// value. Reads portfolio_value_history (see portfolio_value_history_migration.sql)
// and computes:
//   - current drawdown: % below the highest value ever recorded, right now
//   - max drawdown: the worst peak-to-trough decline seen in the log so far
//
// With little history this will read close to 0% for both -- that's
// correct, not broken. Meaningful numbers need weeks/months of logged
// snapshots, same caveat as Time Stop and Thesis Check.

interface PortfolioValueRow {
  total_market_value: number;
  recorded_at: string;
}

export interface DrawdownResult {
  has_enough_history: boolean;
  current_value: number | null;
  peak_value: number | null;
  peak_at: string | null;
  current_drawdown_percent: number | null; // how far below peak, right now
  max_drawdown_percent: number | null; // worst peak-to-trough decline ever logged
}

export function calculateDrawdown(rows: PortfolioValueRow[]): DrawdownResult {
  if (rows.length === 0) {
    return {
      has_enough_history: false,
      current_value: null,
      peak_value: null,
      peak_at: null,
      current_drawdown_percent: null,
      max_drawdown_percent: null,
    };
  }

  let peakValue = rows[0].total_market_value;
  let peakAt = rows[0].recorded_at;
  let maxDrawdownPercent = 0;

  for (const row of rows) {
    if (row.total_market_value > peakValue) {
      peakValue = row.total_market_value;
      peakAt = row.recorded_at;
    }
    const drawdownFromPeak = ((peakValue - row.total_market_value) / peakValue) * 100;
    if (drawdownFromPeak > maxDrawdownPercent) maxDrawdownPercent = drawdownFromPeak;
  }

  const latest = rows[rows.length - 1];
  return {
    has_enough_history: rows.length >= 2,
    current_value: latest.total_market_value,
    peak_value: peakValue,
    peak_at: peakAt,
    current_drawdown_percent: ((peakValue - latest.total_market_value) / peakValue) * 100,
    max_drawdown_percent: maxDrawdownPercent,
  };
}

