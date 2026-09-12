import type { Portfolio } from "@workspace/api-client-react";

// ── DATA SOURCE POLICY ──────────────────────────────────────────────────
// All figures on the dashboard used to be hardcoded numbers baked directly
// into the markup. This module derives every one of them from the live
// database-backed Portfolio payload, using the same formulas the original
// static dashboard displayed in its "show calculation" (ℹ) panels.
//
// Do not reintroduce a hardcoded/sample financial number here, even
// temporarily. If an input is missing or the database isn't connected yet,
// propagate `null`/an explicit error so the UI shows "unavailable" —
// never a fabricated value.
// ─────────────────────────────────────────────────────────────────────────

export interface DerivedCertificate {
  id: number;
  name: string;
  value: number;
  rate: number;
  maturity: string;
  monthly: number;
}

export interface Derived {
  gold: {
    gramsHeld: number;
    avgCostPerGram: number;
    cashbackPerGram: number;
    // Cost basis — always known, derived from real transaction history.
    cost: number;
    // Live price / current value / pnl are all null until the live gold
    // price feature is built. Never render a fake number for these —
    // show the "unavailable" state instead.
    livePricePerGram: number | null;
    value: number | null;
    rawPnl: number | null;
    cashback: number | null;
    netPnl: number | null;
    pnlPct: number | null;
    pnlAvailable: boolean;
  };
  abr: {
    unitsHeld: number;
    costBasisTotal: number;
    nav: number;
    apyPercent: number;
    value: number;
    pnl: number;
    pnlPct: number;
    monthlyYield: number;
  };
  re: {
    unitsHeld: number;
    costBasisTotal: number;
    nav: number;
    value: number;
    pnl: number;
    pnlPct: number;
  };
  liquid: {
    value: number;
    cost: number;
    pnl: number;
    pnlPct: number;
  };
  certs: DerivedCertificate[];
  certTotals: {
    totalPrincipal: number;
    weightedAvgRate: number;
    totalMonthly: number;
    annualYield: number;
    maturingSoon: number;
  };
  total: {
    value: number;
    cost: number;
    pnl: number;
    pnlPct: number;
    /** Unrealized capital gains: gold net PnL + liquid PnL (funds only, excl. certs at face value) */
    capitalPnl: number;
    /** Annual income from yield-bearing assets: cert interest + fund APY */
    incomePnl: number;
    /** (totalAnnualYield / totalValue) × 100 — portfolio-wide blended yield rate */
    blendedYieldPct: number;
    contributions: {
      /** Gold's share of total capitalPnl (0 when live price unavailable) */
      goldCapitalPct: number;
      /** Liquid funds' share of total capitalPnl */
      liquidCapitalPct: number;
      /** ABR fund's share of total annual income */
      abrIncomePct: number;
      /** Certificates' share of total annual income */
      certIncomePct: number;
    };
  };
  yield: {
    totalMonthly: number;
  };
  health: {
    goldConcentrationPct: number;
    diversityScore: number;
    hhi: number;
    assetCount: number;
    largestAssetPct: number;
    largestAssetName: string;
    emergencyFundPct: number;
    emergencyFundScore: number;
    emergencyFundCurrent: number;
    blendedYieldPct: number;
    yieldScore: number;
    liquidityPct: number;
    liquidityScore: number;
    liquidHoldingsValue: number;
    overallScore: number;
  };
  allocation: {
    pctGold: number;
    pctLiquid: number;
    pctAbr: number;
    pctRe: number;
    pctCert: number;
  };
  settings: {
    emergencyFundTarget: number;
    usdEgpRate: number;
  };
}

const YIELD_BENCHMARK_PCT = 27;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeDerived(portfolio: Portfolio): Derived {
  const gramsHeld = portfolio.gold.gramsHeld;
  const avgCostPerGram = portfolio.gold.avgCostPerGram;
  const cashbackPerGram = portfolio.gold.cashbackPerGram;
  const livePricePerGram = portfolio.gold.livePricePerGram;
  const goldCost = portfolio.gold.costBasis;

  // PnL formula (ready for when live price is wired in):
  //   currentValue = gramsHeld * livePricePerGram
  //   pnl = (currentValue + gramsHeld * cashbackPerGram) - costBasis
  // Cashback is a sell-side refund, so it's added on the value side, never
  // subtracted from the cost basis.
  const pnlAvailable = livePricePerGram !== null;
  const goldValue = pnlAvailable ? gramsHeld * livePricePerGram! : null;
  const goldRawPnl = pnlAvailable ? goldValue! - goldCost : null;
  const goldCashback = pnlAvailable ? gramsHeld * cashbackPerGram : null;
  const goldNetPnl = pnlAvailable ? goldRawPnl! + goldCashback! : null;
  const goldPnlPct =
    pnlAvailable && goldCost > 0 ? (goldRawPnl! / goldCost) * 100 : null;

  const abrFund = portfolio.funds.find((f) => f.key === "abr");
  const reFund = portfolio.funds.find((f) => f.key === "re");

  const abrUnitsHeld = abrFund?.unitsHeld ?? 0;
  const abrCostBasisTotal = abrFund?.costBasisTotal ?? 0;
  const abrNav = abrFund?.nav ?? 0;
  const abrApyPercent = abrFund?.apyPercent ?? 0;
  const abrValue = abrUnitsHeld * abrNav;
  const abrPnl = abrValue - abrCostBasisTotal;
  const abrPnlPct = abrCostBasisTotal > 0 ? (abrPnl / abrCostBasisTotal) * 100 : 0;
  const abrMonthlyYield = (abrValue * abrApyPercent) / 100 / 12;

  const reUnitsHeld = reFund?.unitsHeld ?? 0;
  const reCostBasisTotal = reFund?.costBasisTotal ?? 0;
  const reNav = reFund?.nav ?? 0;
  const reValue = reUnitsHeld * reNav;
  const rePnl = reValue - reCostBasisTotal;
  const rePnlPct = reCostBasisTotal > 0 ? (rePnl / reCostBasisTotal) * 100 : 0;

  // The funds table is the current active-position source of truth. Do not
  // limit wallet totals to the two legacy fund keys; newly imported funds
  // must contribute exactly once here.
  const liquidValue = portfolio.funds.reduce(
    (sum, fund) => sum + fund.unitsHeld * fund.nav,
    0,
  );
  const liquidCost = portfolio.funds.reduce(
    (sum, fund) => sum + fund.costBasisTotal,
    0,
  );
  const liquidPnl = liquidValue - liquidCost;
  const liquidPnlPct = liquidCost > 0 ? (liquidPnl / liquidCost) * 100 : 0;

  const certs: DerivedCertificate[] = portfolio.certificates.map((c) => ({
    id: c.id,
    name: c.name,
    value: c.value,
    rate: c.ratePercent,
    maturity:
      typeof c.maturityDate === "string"
        ? c.maturityDate
        : new Date(c.maturityDate).toISOString().slice(0, 10),
    monthly: (c.value * c.ratePercent) / 100 / 12,
  }));

  const totalPrincipal = certs.reduce((s, c) => s + c.value, 0);
  const weightedRateSum = certs.reduce((s, c) => s + c.value * c.rate, 0);
  const weightedAvgRate =
    totalPrincipal > 0 ? round1(weightedRateSum / totalPrincipal) : 0;
  const totalMonthly = certs.reduce((s, c) => s + c.monthly, 0);
  const annualYield = totalMonthly * 12;
  const today = new Date();
  const maturingSoon = certs.filter((c) => {
    const mat = new Date(c.maturity);
    const d = Math.ceil((mat.getTime() - today.getTime()) / 86400000);
    return d >= 0 && d <= 90;
  }).length;

  // Live gold price isn't available yet, so aggregate totals conservatively
  // use gold's cost basis (never a fabricated market value) as its
  // contribution — this means gold's unrealized gain/loss is intentionally
  // excluded from Total P&L until the live price feature ships.
  const goldValueForTotals = goldValue ?? goldCost;

  const totalValue = goldValueForTotals + liquidValue + totalPrincipal;
  const totalCost = goldCost + liquidCost + totalPrincipal;
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const totalYieldMonthly = portfolio.funds.reduce(
    (sum, fund) =>
      sum + (fund.unitsHeld * fund.nav * (fund.apyPercent ?? 0)) / 100 / 12,
    0,
  ) + totalMonthly;

  // ── Whole-wallet performance fields (Total toggle) ───────────────────────
  // Capital P&L: unrealized gains from price-appreciating assets only.
  // Certs are always at face value, so their capital contribution is zero.
  const capitalPnl = (goldNetPnl ?? 0) + liquidPnl;
  const fundAnnualIncome = portfolio.funds.reduce(
    (sum, fund) =>
      sum + (fund.unitsHeld * fund.nav * (fund.apyPercent ?? 0)) / 100,
    0,
  );
  // Income P&L: what the wallet earns annually from yield-bearing assets.
  const incomePnl = fundAnnualIncome + annualYield;
  const totalBlendedYieldPct =
    totalValue > 0 ? round1((totalYieldMonthly * 12 / totalValue) * 100) : 0;
  // Attribution: each bucket's share of capitalPnl / incomePnl.
  // Guarded against divide-by-zero and sign-flip edge cases.
  const goldCapitalPct =
    capitalPnl !== 0 ? ((goldNetPnl ?? 0) / capitalPnl) * 100 : 0;
  const liquidCapitalPct =
    capitalPnl !== 0 ? (liquidPnl / capitalPnl) * 100 : 0;
  const abrIncomePct =
    incomePnl > 0 ? (fundAnnualIncome / incomePnl) * 100 : 0;
  const certIncomePct =
    incomePnl > 0 ? (annualYield / incomePnl) * 100 : 0;

  const goldConcentrationPct = totalValue > 0 ? (goldValueForTotals / totalValue) * 100 : 0;

  // ── 1. True Multi-Asset Diversification (Herfindahl-Hirschman Index) ─────
  // Evaluates concentration across all active asset classes and holdings:
  // (Gold, Certificates, Liquid/Money Market Funds, Real Estate, Equities).
  // HHI ranges from 1/N (perfectly spread) to 1.0 (100% in a single asset).
  const assetHoldings: { name: string; value: number }[] = [];
  if (goldValueForTotals > 0) {
    assetHoldings.push({ name: "Gold 24K", value: goldValueForTotals });
  }
  if (totalPrincipal > 0) {
    assetHoldings.push({ name: "Certificates", value: totalPrincipal });
  }
  portfolio.funds.forEach((f) => {
    const val = f.unitsHeld * f.nav;
    if (val > 0) {
      assetHoldings.push({ name: f.name || f.ticker || f.key, value: val });
    }
  });

  const assetCount = assetHoldings.length;
  let hhi = 1.0;
  let diversityScore = 0;
  let largestAssetPct = 0;
  let largestAssetName = "";

  if (totalValue > 0 && assetHoldings.length > 0) {
    let sumSquares = 0;
    for (const holding of assetHoldings) {
      const weight = holding.value / totalValue;
      sumSquares += weight * weight;
      const weightPct = weight * 100;
      if (weightPct > largestAssetPct) {
        largestAssetPct = weightPct;
        largestAssetName = holding.name;
      }
    }
    hhi = sumSquares;
    // An ideal balanced allocation across >= 4 asset classes has HHI <= 0.25.
    // Normalized score scales (1 - HHI) against (1 - 1/4) = 0.75 target spread.
    // Single asset (HHI = 1.0) scores 0. 4 equal holdings score 100.
    const normalizedDiversity = ((1 - hhi) / 0.75) * 100;
    diversityScore = Math.max(0, Math.min(100, Math.round(normalizedDiversity)));
  }

  /**
   * ── 2. EMERGENCY FUND RATIONALE & POLICY ────────────────────────────────
   * Target: 60,000 EGP, representing 6 months of living expenses (10,000 EGP/month).
   * Strategy: These reserves are intentionally held in Al Ahly Bareeq Money Market Fund (ABR)
   * rather than uninvested cash to generate daily compound yield and hedge against inflation
   * while preserving same-day liquidity for financial emergencies.
   */
  const defaultEmergencyTarget = 60000;
  const emergencyFundTarget =
    portfolio.settings.emergencyFundTarget > 0
      ? portfolio.settings.emergencyFundTarget
      : defaultEmergencyTarget;
  // Use live market value of Bareeq fund if available, falling back to cost basis
  const emergencyFundCurrent = abrValue > 0 ? abrValue : abrCostBasisTotal;
  const emergencyFundPct =
    emergencyFundTarget > 0 ? (emergencyFundCurrent / emergencyFundTarget) * 100 : 0;
  const emergencyFundScore = Math.max(0, Math.min(100, emergencyFundPct));

  // ── 3. Blended Yield Benchmark Scoring ──────────────────────────────────
  // Compares annual yield against prevailing Egyptian risk-free / CBE corridor rate (27%).
  const blendedYieldPct = totalValue > 0 ? ((fundAnnualIncome + annualYield) / totalValue) * 100 : 0;
  const yieldScore = Math.max(
    0,
    Math.min(100, Math.round((blendedYieldPct / YIELD_BENCHMARK_PCT) * 100)),
  );

  // ── 4. Sensible Liquidity Buffer Scoring ────────────────────────────────
  // Evaluates liquidity against a healthy financial target (10%–25% of total portfolio).
  // Holding 0% liquid is dangerous (score 0), while 15%–25% is optimal (score 100).
  // Extreme cash hoarding (> 30%) gently tapers to reflect cash drag / inflation loss.
  const liquidHoldings = portfolio.funds.filter(
    (f) =>
      f.key === "abr" ||
      f.name.toLowerCase().includes("bareeq") ||
      f.name.toLowerCase().includes("money market") ||
      f.name.toLowerCase().includes("liquid"),
  );
  const liquidHoldingsValue =
    liquidHoldings.length > 0
      ? liquidHoldings.reduce((sum, f) => sum + f.unitsHeld * f.nav, 0)
      : abrValue;

  const liquidityPct = totalValue > 0 ? (liquidHoldingsValue / totalValue) * 100 : 0;
  let liquidityScore = 0;
  if (liquidityPct <= 15) {
    liquidityScore = Math.round((liquidityPct / 15) * 100);
  } else if (liquidityPct <= 30) {
    liquidityScore = 100; // Optimal 15% - 30% liquidity buffer
  } else {
    // Slight penalty for excessive cash drag above 30%
    liquidityScore = Math.max(50, Math.round(100 - (liquidityPct - 30) * 1.5));
  }
  liquidityScore = Math.max(0, Math.min(100, liquidityScore));

  const overallScore = Math.round(
    (diversityScore + emergencyFundScore + yieldScore + liquidityScore) / 4,
  );

  return {
    gold: {
      gramsHeld,
      avgCostPerGram,
      cashbackPerGram,
      cost: goldCost,
      livePricePerGram,
      value: goldValue,
      rawPnl: goldRawPnl,
      cashback: goldCashback,
      netPnl: goldNetPnl,
      pnlPct: goldPnlPct,
      pnlAvailable,
    },
    abr: {
      unitsHeld: abrUnitsHeld,
      costBasisTotal: abrCostBasisTotal,
      nav: abrNav,
      apyPercent: abrApyPercent,
      value: abrValue,
      pnl: abrPnl,
      pnlPct: abrPnlPct,
      monthlyYield: abrMonthlyYield,
    },
    re: {
      unitsHeld: reUnitsHeld,
      costBasisTotal: reCostBasisTotal,
      nav: reNav,
      value: reValue,
      pnl: rePnl,
      pnlPct: rePnlPct,
    },
    liquid: {
      value: liquidValue,
      cost: liquidCost,
      pnl: liquidPnl,
      pnlPct: liquidPnlPct,
    },
    certs,
    certTotals: {
      totalPrincipal,
      weightedAvgRate,
      totalMonthly,
      annualYield,
      maturingSoon,
    },
    total: {
      value: totalValue,
      cost: totalCost,
      pnl: totalPnl,
      pnlPct: totalPnlPct,
      capitalPnl,
      incomePnl,
      blendedYieldPct: totalBlendedYieldPct,
      contributions: {
        goldCapitalPct,
        liquidCapitalPct,
        abrIncomePct,
        certIncomePct,
      },
    },
    yield: {
      totalMonthly: totalYieldMonthly,
    },
    health: {
      goldConcentrationPct,
      diversityScore,
      hhi,
      assetCount,
      largestAssetPct,
      largestAssetName,
      emergencyFundPct,
      emergencyFundScore,
      emergencyFundCurrent,
      blendedYieldPct,
      yieldScore,
      liquidityPct,
      liquidityScore,
      liquidHoldingsValue,
      overallScore,
    },
    allocation: {
      pctGold: totalValue > 0 ? (goldValueForTotals / totalValue) * 100 : 0,
      pctLiquid: totalValue > 0 ? (liquidValue / totalValue) * 100 : 0,
      pctAbr: totalValue > 0 ? (abrValue / totalValue) * 100 : 0,
      pctRe: totalValue > 0 ? (reValue / totalValue) * 100 : 0,
      pctCert: totalValue > 0 ? (totalPrincipal / totalValue) * 100 : 0,
    },
    settings: {
      emergencyFundTarget,
      usdEgpRate: portfolio.settings.usdEgpRate,
    },
  };
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmt1(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

export function fmt2(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function signed(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : fmt(n);
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "var(--pnl-up)";
  if (score >= 40) return "var(--warning-border)";
  return "var(--pnl-down)";
}

