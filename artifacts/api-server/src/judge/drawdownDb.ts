import { pool } from "../lib/dbPool";
import { calculateDrawdown } from "./drawdown";

type PortfolioValueRow = {
  total_market_value: number;
  recorded_at: string;
};

export async function capturePortfolioValue(runId: number): Promise<void> {
  await pool.query(
    `INSERT INTO portfolio_value_history (total_cost_basis, total_market_value, run_id)
     SELECT total_cost_basis, total_market_value, $1
     FROM portfolio_value_history
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [runId],
  );
}

export async function computeDrawdown(runId?: number) {
  try {
    const runFilter = runId === undefined ? "" : "WHERE run_id = $1";
    const result = await pool.query<PortfolioValueRow>(
      `SELECT total_market_value, recorded_at
       FROM portfolio_value_history
       ${runFilter}
       ORDER BY recorded_at ASC`,
      runId === undefined ? [] : [runId],
    );

    return calculateDrawdown(result.rows);
  } catch (err) {
    console.error("[computeDrawdown] failed:", err);
    throw new Error("Drawdown could not load portfolio history", { cause: err });
  }
}
