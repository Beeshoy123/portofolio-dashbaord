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

  assert.match(prompt, /Strong unheld opportunit/i);
  assert.match(prompt, /MAB/i);
});

import { analyzePortfolioOpportunities, buildOpportunityAnalysisPrompt } from "../artifacts/api-server/src/advisor/opportunityAnalysis.ts";

test("analyzePortfolioOpportunities correctly computes absolute_return_positive and sorts list", () => {
  const verdicts = [
    {
      holding_ticker: "HELD1",
      holding_name: "Held 1",
      holding_asset_role: "income_fund",
      holding_return_percent: 10.0,
      holding_current_value_egp: 100000,
      holding_risk_tier: "Low",
      technical_signal: null,
      is_held: true,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 5,
        comparable_with_return_count: 5,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 5,
      comparables_total: 5,
    },
    {
      // Strong unheld with negative return (lost less than peers in bad sector)
      holding_ticker: "DOWN_STRONG",
      holding_name: "Down Strong Performer",
      holding_asset_role: "growth_fund",
      holding_return_percent: -4.5,
      holding_current_value_egp: null,
      holding_risk_tier: "Medium",
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 5,
        comparable_with_return_count: 5,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 5,
      comparables_total: 5,
    },
    {
      // Strong unheld with null return
      holding_ticker: "NULL_STRONG",
      holding_name: "Null Strong Performer",
      holding_asset_role: "growth_fund",
      holding_return_percent: null,
      holding_current_value_egp: null,
      holding_risk_tier: "Medium",
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 5,
        comparable_with_return_count: 5,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 5,
      comparables_total: 5,
    },
    {
      // Strong unheld with positive return
      holding_ticker: "UP_STRONG_1",
      holding_name: "Up Strong Performer 1",
      holding_asset_role: "growth_fund",
      holding_return_percent: 12.0,
      holding_current_value_egp: null,
      holding_risk_tier: "Medium",
      holding_fundamentals: {
        pe_ratio: 15,
        forward_pe: 14,
        debt_to_equity: 2.1,
        current_ratio: 1.2,
        roe_percent: 4.5,
        free_cash_flow: 1000,
        net_income: 2000,
        net_income_growth_percent: 5,
        revenue_growth_percent: 6,
        dividend_yield_percent: 2,
        beta: 1.1,
        analyst_rating: null,
        price_target_upside_percent: null,
        shares_change_percent: null,
        flags: [
          { flag: "low_return_on_equity", detail: "ROE is low" },
          { flag: "high_debt_load", detail: "D/E elevated" },
        ],
      },
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 5,
        comparable_with_return_count: 5,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 5,
      comparables_total: 5,
    },
    {
      // Another Strong unheld with positive return to verify stable order
      holding_ticker: "UP_STRONG_2",
      holding_name: "Up Strong Performer 2",
      holding_asset_role: "growth_fund",
      holding_return_percent: 8.5,
      holding_current_value_egp: null,
      holding_risk_tier: "Low",
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 5,
        comparable_with_return_count: 5,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 100,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 5,
      comparables_total: 5,
    },
    {
      // Moderate confidence: coverage 60%, win rate 70% (7/10)
      holding_ticker: "MOD_CONF",
      holding_name: "Moderate Confidence Performer",
      holding_asset_role: "stock",
      holding_return_percent: 15.0,
      holding_current_value_egp: null,
      holding_risk_tier: "Medium",
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 10,
        comparable_with_return_count: 6,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 60,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 7,
      comparables_total: 10,
    },
    {
      // Low confidence: coverage 40% (< 50)
      holding_ticker: "LOW_CONF",
      holding_name: "Low Confidence Performer",
      holding_asset_role: "stock",
      holding_return_percent: 25.0,
      holding_current_value_egp: null,
      holding_risk_tier: "High",
      technical_signal: null,
      is_held: false,
      data_quality: {
        holding_snapshot_status: "fresh",
        holding_snapshot_age_hours: 1,
        comparable_count: 10,
        comparable_with_return_count: 4,
      },
      return_period: "return_1y",
      groups: [],
      signal: "Strong",
      coverage_percent: 40,
      flags: [],
      data_completeness_warning: false,
      fundamentals_flags_found: false,
      comparables_beaten: 8,
      comparables_total: 10,
    },
  ];

  const analysis = analyzePortfolioOpportunities(verdicts);

  // Check that all 6 strong unheld candidates are preserved (not filtered out)
  assert.equal(analysis.strong_unheld_entities.length, 6);

  // Check absolute_return_positive boolean values and confidence tiers
  const byTicker = Object.fromEntries(
    analysis.strong_unheld_entities.map((e) => [e.ticker, e])
  );
  assert.equal(byTicker.UP_STRONG_1.absolute_return_positive, true);
  assert.equal(byTicker.UP_STRONG_1.confidence_tier, "high");
  assert.equal(byTicker.UP_STRONG_2.absolute_return_positive, true);
  assert.equal(byTicker.UP_STRONG_2.confidence_tier, "high");
  assert.equal(byTicker.DOWN_STRONG.absolute_return_positive, false);
  assert.equal(byTicker.DOWN_STRONG.confidence_tier, "high");
  assert.equal(byTicker.NULL_STRONG.absolute_return_positive, false);
  assert.equal(byTicker.NULL_STRONG.confidence_tier, "high");
  assert.equal(byTicker.MOD_CONF.confidence_tier, "moderate");
  assert.equal(byTicker.LOW_CONF.confidence_tier, "low");

  // Check fundamentals_flags extracted properly
  assert.deepEqual(byTicker.UP_STRONG_1.fundamentals_flags, [
    "low_return_on_equity",
    "high_debt_load",
  ]);
  assert.deepEqual(byTicker.UP_STRONG_2.fundamentals_flags, []);
  assert.deepEqual(byTicker.DOWN_STRONG.fundamentals_flags, []);
  assert.deepEqual(byTicker.NULL_STRONG.fundamentals_flags, []);

  // Check multi-level sorting:
  // 1. High confidence: UP_STRONG_1, UP_STRONG_2 (positive return), then DOWN_STRONG, NULL_STRONG (non-positive)
  // 2. Moderate confidence: MOD_CONF
  // 3. Low confidence: LOW_CONF
  assert.deepEqual(
    analysis.strong_unheld_entities.map((e) => e.ticker),
    ["UP_STRONG_1", "UP_STRONG_2", "DOWN_STRONG", "NULL_STRONG", "MOD_CONF", "LOW_CONF"]
  );

  // Check prompt builder surfaces note for confidence tier, negative/flat absolute return, and fundamentals concerns
  const prompt = buildOpportunityAnalysisPrompt(analysis);
  assert.match(prompt, /DOWN_STRONG/);
  assert.match(prompt, /confidence=high/);
  assert.match(prompt, /confidence=moderate/);
  assert.match(prompt, /confidence=low/);
  assert.match(prompt, /beat peers, but absolute return <= 0/);
  assert.match(prompt, /FUNDAMENTALS CONCERNS: low_return_on_equity, high_debt_load/);
});
