import assert from "node:assert/strict";
import test from "node:test";
import { buildPortfolioSummaryPrompt } from "../artifacts/api-server/src/advisor/buildPrompt.ts";

test("portfolio summary prompt calls out strong unheld opportunities", () => {
  const verdicts = [
    {
      holding_ticker: "ABR",
      holding_name: "Bareeq",
      holding_asset_role: "money_market_reserve",
      holding_return_percent: 5.2,
      holding_current_value_egp: 250000,
      holding_risk_tier: "Low",
      technical_signal: null,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 4,
        comparable_with_return_count: 4,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
    },
    {
      holding_ticker: "MAB",
      holding_name: "MAB",
      holding_asset_role: "stock",
      holding_return_percent: 18.4,
      holding_current_value_egp: null,
      holding_risk_tier: "Medium",
      technical_signal: null,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 2,
        comparable_count: 6,
        comparable_with_return_count: 6,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
    },
  ];

  const prompt = buildPortfolioSummaryPrompt(verdicts);

  assert.match(prompt, /Strong unheld opportunities/i);
  assert.match(prompt, /MAB/i);
});
