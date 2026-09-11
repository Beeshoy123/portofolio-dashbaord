// Comparison Judge — Print Verdicts (test/debug script)
//
// Run with: npx tsx judge/printVerdicts.ts
// Uses the production judge and its current verdict shape.

import path from "node:path";
import { config } from "dotenv";
import type { ComparisonGroup, HoldingVerdict } from "../src/judge/types";

config({ path: path.resolve(process.cwd(), "../../.secrets/api-server.env"), override: false });

function formatGroup(group: ComparisonGroup): string {
  const labelMap: Record<string, string> = {
    sector_sibling: "Sector Siblings (other funds, same sector)",
    manager_sibling: "Manager Siblings (other funds, same manager)",
    direct_stock: "Direct Stocks (same sector)",
    benchmark: "Benchmarks",
  };

  const lines = [`  vs ${labelMap[group.group_type]}:`];
  if (group.entries.length === 0) {
    lines.push(`    (none in watchlist)`);
    return lines.join("\n");
  }

  for (const entry of group.entries) {
    if (entry.return_percent === null) {
      lines.push(`    ${entry.ticker.padEnd(8)} no data yet`);
      continue;
    }
    const gapStr =
      entry.gap_percent !== null
        ? entry.gap_percent >= 0
          ? `you're ahead by +${entry.gap_percent.toFixed(1)}pp`
          : `you're behind by ${Math.abs(entry.gap_percent).toFixed(1)}pp` // FIX: was printing the raw negative number, showing "behind by -5.2pp"
        : "";
    const contextParts: string[] = [`Role: ${entry.asset_role}`];
    if (entry.sector_rank !== null) contextParts.push(`Rank #${entry.sector_rank}`);
    if (entry.stock_signal !== null) contextParts.push(`Signal: ${entry.stock_signal}`);
    if (entry.computed_risk_tier !== null) contextParts.push(`Risk: ${entry.computed_risk_tier}`);
    if (entry.risk_mismatch) contextParts.push(`⚠️ risk mismatch vs FoudaLens (${entry.foudalens_risk_level})`);
    const contextStr = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
    lines.push(
      `    ${entry.ticker.padEnd(8)} ${entry.return_percent.toFixed(1).padStart(7)}%${contextStr}   ${gapStr}`
    );

    if (entry.fundamentals?.flags.length) {
      lines.push(`        Fundamentals: ${entry.fundamentals.flags.map(({ flag, detail }) => `${flag}${detail ? ` (${detail})` : ""}`).join(", ")}`);
    }
  }
  return lines.join("\n");
}

function printVerdict(v: HoldingVerdict): void {
  console.log("=".repeat(60));
  console.log(
    `${v.holding_name} (${v.holding_ticker}) — ${v.return_period.replace("return_", "").toUpperCase()}`
  );
  console.log(`Asset role: ${v.holding_asset_role}`);
  console.log(
    `Your return: ${v.holding_return_percent !== null ? v.holding_return_percent.toFixed(1) + "%" : "no data"}`
  );
  console.log(
    `Current position value: ${v.holding_current_value_egp !== null ? v.holding_current_value_egp.toLocaleString() + " EGP" : "unavailable"}`
  );
  console.log(`Portfolio weight: ${v.holding_portfolio_weight_percent === null ? "unavailable" : `${v.holding_portfolio_weight_percent.toFixed(1)}%`}`);
  console.log(`Risk tier: ${v.holding_risk_tier ?? "unavailable"}`);
  console.log(`Final label: ${v.final_label}`);
  console.log(`Performance: ${v.performance_grade}`);
  console.log(`Financial health: ${v.financial_health_grade}${v.financial_health_reason ? ` (${v.financial_health_reason})` : ""}`);
  console.log(`Technical: ${v.technical_grade}${v.technical_reason ? ` (${v.technical_reason})` : ""}`);
  console.log(`Confidence tier: ${v.confidence_tier ?? "unavailable"}`);
  console.log(`Coverage: ${v.coverage_percent === null ? "unavailable" : `${v.coverage_percent.toFixed(1)}%`} (${v.data_quality.comparable_with_return_count}/${v.comparables_total} peers with returns)`);
  console.log(`Data quality: ${v.data_quality.holding_snapshot_status}, ${v.data_quality.comparable_count} comparable peers`);
  if (v.caution_reason) console.log(`Caution reason: ${v.caution_reason}`);
  if (v.technical_signal) {
    console.log(`Technical signal: ${v.technical_signal.trend}, reversal risk ${v.technical_signal.reversal_risk}`);
  }
  console.log("");

  for (const group of v.groups) {
    console.log(formatGroup(group));
    console.log("");
  }

  console.log(`SIGNAL: ${v.signal}`);
  if (v.flags.length > 0) {
    console.log(`FLAGS: ${v.flags.join(", ")}`);
  }
  if (v.data_completeness_warning) {
    console.log(
      `⚠️  Comparison coverage is incomplete — verdict reliability may improve after more successful Price Checker data.`
    );
  }
  console.log("");
}

async function main() {
  const { judgeAllHoldings } = await import("../src/judge/comparisonJudge");
  const verdicts = await judgeAllHoldings("return_1y");
  if (verdicts.length === 0) {
    console.log(
      "No held holdings were returned by the production Comparison Judge. Nothing to print."
    );
    return;
  }
  for (const v of verdicts) {
    printVerdict(v);
  }
}

main().catch((err) => {
  console.error("Failed to generate verdicts:", err);
  process.exit(1);
});
