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
    emergencyFundPct: number;
    emergencyFundScore: number;
    blendedYieldPct: number;
    yieldScore: number;
    liquidityPct: number;
    liquidityScore: number;
    overallScore: number;
  };
  allocation: {
    pctGold: number;
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
  const diversityScore = Math.max(0, Math.min(100, 100 - goldConcentrationPct));

  const emergencyFundTarget = portfolio.settings.emergencyFundTarget;
  const emergencyFundPct =
    emergencyFundTarget > 0 ? (abrCostBasisTotal / emergencyFundTarget) * 100 : 0;
  const emergencyFundScore = Math.max(0, Math.min(100, emergencyFundPct));

  const blendedYieldPct = totalValue > 0 ? ((fundAnnualIncome + annualYield) / totalValue) * 100 : 0;
  const yieldScore = Math.max(
    0,
    Math.min(100, (blendedYieldPct / YIELD_BENCHMARK_PCT) * 100),
  );

  const liquidityPct = totalValue > 0 ? (abrValue / totalValue) * 100 : 0;
  const liquidityScore = Math.max(0, Math.min(100, liquidityPct));

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
      emergencyFundPct,
      emergencyFundScore,
      blendedYieldPct,
      yieldScore,
      liquidityPct,
      liquidityScore,
      overallScore,
    },
    allocation: {
      pctGold: totalValue > 0 ? (goldValueForTotals / totalValue) * 100 : 0,
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
