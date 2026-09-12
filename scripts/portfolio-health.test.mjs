import assert from "node:assert/strict";
import test from "node:test";
import { computeDerived, getScoreColor } from "../artifacts/portfolio/src/lib/portfolioMath.ts";

test("getScoreColor returns proper semantic CSS variables", () => {
  assert.equal(getScoreColor(85), "var(--pnl-up)");
  assert.equal(getScoreColor(70), "var(--pnl-up)");
  assert.equal(getScoreColor(69), "var(--warning-border)");
  assert.equal(getScoreColor(40), "var(--warning-border)");
  assert.equal(getScoreColor(39), "var(--pnl-down)");
  assert.equal(getScoreColor(0), "var(--pnl-down)");
});

test("computeDerived calculates multi-asset diversity, 60k emergency fund, and sensible liquidity", () => {
  const samplePortfolio = {
    gold: {
      gramsHeld: 20,
      costBasis: 160000,
      avgCostPerGram: 8000,
      cashbackPerGram: 24,
      livePricePerGram: 8000,
      currentValue: 160000,
    },
    funds: [
      {
        id: 1,
        key: "abr",
        name: "Al Ahly Bareeq Fund",
        ticker: "ABR",
        icon: "🏦",
        unitsHeld: 120,
        costBasisTotal: 25000,
        nav: 208.33, // Value ~25,000 EGP
        apyPercent: 23,
        holdingType: "fund",
      },
      {
        id: 2,
        key: "re",
        name: "Beltone Real Estate",
        ticker: "BRE",
        icon: "🏢",
        unitsHeld: 5000,
        costBasisTotal: 10000,
        nav: 2.0, // Value 10,000 EGP
        apyPercent: 0,
        holdingType: "fund",
      },
    ],
    certificates: [
      {
        id: 1,
        name: "NBE 27% Cert",
        value: 200000,
        ratePercent: 27,
        maturityDate: "2026-12-31",
      },
    ],
    transactions: [],
    snapshots: [],
    settings: {
      emergencyFundTarget: 0, // Should default to 60,000 (6 months @ 10,000/mo)
      usdEgpRate: 50,
      usdEgpStatus: null,
      eurEgpRate: 52,
      eurEgpStatus: null,
    },
  };

  const derived = computeDerived(samplePortfolio);

  // Total Value = 160k (gold) + 25k (Bareeq) + 10k (RE) + 200k (certs) = 395k
  assert.ok(derived.total.value > 0);

  // 1. Emergency Fund:
  // Target should be 60,000 EGP (6 months @ 10k/mo)
  assert.equal(derived.settings.emergencyFundTarget, 60000);
  // Bareeq value is ~25,000 -> 25,000 / 60,000 * 100 ~ 41.67% -> score ~ 42
  assert.ok(derived.health.emergencyFundScore >= 41 && derived.health.emergencyFundScore <= 43);
  assert.equal(derived.health.emergencyFundCurrent, 120 * 208.33);

  // 2. Diversity:
  // Evaluated across Gold (160k), Certs (200k), Bareeq (25k), RE (10k)
  assert.equal(derived.health.assetCount, 4);
  assert.ok(derived.health.diversityScore > 50, "Multi-asset portfolio should score above 50");
  assert.ok(derived.health.hhi < 1.0, "HHI should be less than 1.0");

  // 3. Liquidity:
  // Bareeq is 25k / 395k = ~6.3% of total wallet
  // In sensible curve: (6.3% / 15%) * 100 ~ 42 score
  assert.ok(derived.health.liquidityScore >= 40 && derived.health.liquidityScore <= 45);

  // 4. Overall score is average of the 4
  const expectedAvg = Math.round(
    (derived.health.diversityScore +
      derived.health.emergencyFundScore +
      derived.health.yieldScore +
      derived.health.liquidityScore) /
      4
  );
  assert.equal(derived.health.overallScore, expectedAvg);
});

