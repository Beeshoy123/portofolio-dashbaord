// Comparison Judge — Print Verdicts (test/debug script)
//
// Run with: npx tsx judge/printVerdicts.ts
// Requires comparison_snapshots to have at least one successful scrape —
// run scraper/runScraper.ts first.

import { judgeAllHoldings } from "./comparisonJudge";
import type { HoldingVerdict, ComparisonGroup } from "./types";

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
    const contextParts: string[] = [];
    if (entry.sector_rank !== null) contextParts.push(`Rank #${entry.sector_rank}`);
    if (entry.stock_signal !== null) contextParts.push(`Signal: ${entry.stock_signal}`);
    if (entry.computed_risk_tier !== null) contextParts.push(`Risk: ${entry.computed_risk_tier}`);
    if (entry.risk_mismatch) contextParts.push(`⚠️ risk mismatch vs FoudaLens (${entry.foudalens_risk_level})`);
    const contextStr = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
    lines.push(
      `    ${entry.ticker.padEnd(8)} ${entry.return_percent.toFixed(1).padStart(7)}%${contextStr}   ${gapStr}`
    );

    // Second-opinion summary: only print disagreements, not every check —
    // agreements are the expected/quiet case, disagreements are the
    // signal worth surfacing.
    const disagreements = Object.entries(entry.second_opinions).filter(
      ([, check]) => check.agrees === false
    );
    if (disagreements.length > 0) {
      for (const [category, check] of disagreements) {
        lines.push(`        ⚠️ [${category}] ${check.note}`);
      }
    }
  }
  return lines.join("\n");
}

function printVerdict(v: HoldingVerdict): void {
  console.log("=".repeat(60));
  console.log(
    `${v.holding_name} (${v.holding_ticker}) — ${v.return_period.replace("return_", "").toUpperCase()}`
  );
  console.log(
    `Your return: ${v.holding_return_percent !== null ? v.holding_return_percent.toFixed(1) + "%" : "no data"}`
  );
  console.log(
    `Current position value: ${v.holding_current_value_egp !== null ? v.holding_current_value_egp.toLocaleString() + " EGP" : "unknown — check funds_table_key mapping"}`
  );
  console.log(
    `Your computed risk tier: ${v.holding_risk_tier ?? "unknown — need all 3 return periods (30d/YTD/1Y) to compute"}`
  );
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
      `⚠️  Over 30% of comparison entries have no data yet — verdict may be unreliable until Price Checker has run more successfully.`
    );
  }
  console.log("");
}

async function main() {
  const verdicts = await judgeAllHoldings("return_1y");
  if (verdicts.length === 0) {
    console.log(
      "No holdings found with is_held=true in comparison_watchlist. Nothing to compare."
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
