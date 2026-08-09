/**
 * Phase 1.11 — USD Reality Check & S&P500 Comparison
 * Pure math engine — no APIs, no dependencies
 * All formulas verified against test cases in roadmap
 *
 * DEPENDENCY NOTE:
 * This engine needs the live USD/EGP rate. It calls getCurrentUSDRate(),
 * which must be wired to whatever ALREADY powers the "USD/EGP: ... LIVE"
 * ticker on the dashboard header — do not add a new/second rate source.
 * Reuse the existing one; find wherever that ticker's number comes from
 * and call the same function/service from here.
 *
 * CHANGE LOG (this revision):
 * - Added buyDate to AssetInput, analyzeGold, and analyzeCerts. Every S&P500
 *   comparison and every "annualized devaluation" calculation now uses the
 *   REAL elapsed time since purchase instead of assuming 1 year (assets/gold)
 *   or reusing the forward projection horizon as if it were the past holding
 *   period (certs). BREAKING CHANGE to all three function signatures — every
 *   call site needs a real ISO date string now, not just the numbers it
 *   passed before.
 * - Fixed portfolio-level S&P500 comparison in runUSDRealityCheck(). It used
 *   to compare the blended portfolio return against a single flat
 *   `sp500AnnualReturn * 100`, which silently ignored the fact that
 *   individual assets can now have very different real holding periods. It
 *   now sums each asset's own already-correctly-compounded sp500ValueUSD
 *   (computed per-asset in analyzeAsset, respecting that asset's own
 *   yearsHeld) into a single blended S&P500 benchmark, so a mix of a
 *   3-year-old position and a 2-month-old position is no longer compared
 *   against the same flat annual rate.
 * - yearsHeld() now throws on an invalid buyDate instead of silently
 *   returning NaN, which would otherwise poison every downstream number
 *   (return %, verdict, portfolio score) with no visible error.
 */

// ─── Live Rate Placeholder ────────────────────────────────────────────────────
// Replit: replace this with whatever ALREADY provides the "USD/EGP: ... LIVE"
// value shown on the dashboard header — reuse that source, don't add a new one.
export async function getCurrentUSDRate(): Promise<number> {
  // TODO: wire to the existing USD/EGP live rate source already used elsewhere
  // in the app (the same one behind the dashboard header's "USD/EGP LIVE" tag).
  throw new Error('getCurrentUSDRate() must be wired to existing live rate feed');
}

// ─── Time Helper ───────────────────────────────────────────────────────────────

/** Years elapsed between an ISO date string and now, as a decimal (e.g. 1.5). Never negative. */
export function yearsHeld(buyDate: string): number {
  const buy = new Date(buyDate).getTime();
  if (Number.isNaN(buy)) {
    // Fail loud, matching getCurrentUSDRate()'s style — a malformed date
    // must not silently become NaN and poison every downstream calculation
    // (return %, verdict, portfolio score) with no visible error anywhere.
    throw new Error(`yearsHeld() received an invalid buyDate: "${buyDate}" — expected an ISO date string like "2024-03-15"`);
  }
  const now = Date.now();
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return Math.max((now - buy) / msPerYear, 0);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetInput {
  name: string;
  costEGP: number;
  currentValueEGP: number;
  buyRateUSD: number;
  currentRateUSD: number; // pass result of getCurrentUSDRate() here
  buyDate: string; // ISO date string, e.g. "2024-03-15", when this position was bought
}

export interface AssetRealityResult {
  name: string;
  originalUSD: number;
  currentUSD: number;
  nominalEGPReturn: number;
  egpDevaluationRate: number;
  realUSDReturn: number;
  beatDevaluation: boolean;
  yearsHeld: number; // actual holding period used for the S&P500 comparison below
  sp500USDReturn: number; // annual S&P500 rate assumed (input rate, unchanged meaning)
  sp500ValueUSD: number; // compounded over yearsHeld, not a flat 1-year figure
  opportunityCostUSD: number;
  beatSP500: boolean; // compares against the compounded S&P500 return over yearsHeld
  verdict: 'green' | 'yellow' | 'red';
  verdictLabel: string;
}

export interface ThresholdRow {
  devaluationRate: number;
  minEGPReturn: number;
}

export interface PortfolioRealityResult {
  assets: AssetRealityResult[];
  totalOriginalUSD: number; // sum of every asset's originalUSD
  totalCurrentUSD: number; // sum of every asset's currentUSD
  portfolioRealReturn: number; // total % gain in USD terms across all assets (percent, e.g. 12.3 = +12.3%)
  sp500BlendedReturn: number; // % the SAME capital would show if it had gone into S&P500 instead, respecting each asset's own real holding period (not a flat rate)
  portfolioWeightedYearsHeld: number; // dollar-weighted average holding period across assets
  portfolioScore: number; // portfolioRealReturn - sp500BlendedReturn, in percentage points
  portfolioBeatsSP500: boolean;
  thresholdTable: ThresholdRow[];
  goldSection: GoldRealityResult;
  certsSection: CertsRealityResult;
  verificationTests: VerificationResult[];
}

export interface GoldRealityResult {
  grams: number;
  buyPriceEGP: number;
  currentPriceEGP: number;
  costEGP: number;
  currentValueEGP: number;
  buyRateUSD: number;
  currentRateUSD: number;
  originalUSD: number;
  currentUSD: number;
  realUSDReturn: number;
  beatDevaluation: boolean;
  beatSP500: boolean;
  breakEvenEGPPrice: number;
  sp500EGPPrice: number;
  yearsHeld: number;
}

export interface CertsRealityResult {
  principalEGP: number;
  monthlyIncomeEGP: number;
  annualYieldEGP: number;
  buyRateUSD: number;
  currentRateUSD: number;
  principalUSD: number;
  realUSDYield: number;
  growingUSDWealth: boolean;
  sp500ComparisonUSD: number;
  value5YearsUSD: number;
  yearsSinceBuy: number; // actual time the past devaluation was annualized over
}

export interface VerificationResult {
  name: string;
  result: number;
  expected: number;
  passed: boolean;
}

// ─── Core Formulas ────────────────────────────────────────────────────────────
// Unchanged — these are the formulas the verification tests below check directly.

export function realUSDReturn(nominalEGPReturn: number, egpDevaluationRate: number): number {
  return ((1 + nominalEGPReturn) / (1 + egpDevaluationRate)) - 1;
}

export function requiredEGPReturn(targetUSDReturn: number, devaluationRate: number): number {
  return ((1 + targetUSDReturn) * (1 + devaluationRate)) - 1;
}

export function egpDevaluationRate(buyRate: number, currentRate: number): number {
  return (currentRate - buyRate) / buyRate;
}

export function toUSD(egp: number, rate: number): number {
  return egp / rate;
}

export function egpPriceForTargetUSD(originalUSD: number, targetReturn: number, currentRate: number): number {
  return originalUSD * (1 + targetReturn) * currentRate;
}

// ─── Verification Tests ───────────────────────────────────────────────────────
// Untouched by this revision — these test the core formulas directly, none of
// which changed.

export function runVerificationTests(): VerificationResult[] {
  const dev1 = egpDevaluationRate(30.9, 49);
  const nom1 = (175000 - 146000) / 146000;
  const r1   = realUSDReturn(nom1, dev1) * 100;

  const r2 = requiredEGPReturn(0.10, 0.15) * 100;

  return [
    {
      name: 'Beltone Fund — Real USD Return',
      result:   Math.round(r1 * 10) / 10,
      expected: -24.4,
      passed:   Math.abs(r1 - (-24.4)) < 0.5,
    },
    {
      name: 'Threshold Formula — Required EGP Return',
      result:   Math.round(r2 * 10) / 10,
      expected: 26.5,
      passed:   Math.abs(r2 - 26.5) < 0.5,
    },
  ];
}

// ─── Section 1 + 2 — Asset Reality ───────────────────────────────────────────

export function analyzeAsset(asset: AssetInput, sp500AnnualReturn = 0.10): AssetRealityResult {
  const originalUSD     = toUSD(asset.costEGP, asset.buyRateUSD);
  const currentUSD      = toUSD(asset.currentValueEGP, asset.currentRateUSD);
  const nominalReturn   = (asset.currentValueEGP - asset.costEGP) / asset.costEGP;
  const devaluation     = egpDevaluationRate(asset.buyRateUSD, asset.currentRateUSD);
  const realReturn      = realUSDReturn(nominalReturn, devaluation);
  const beatDevaluation = realReturn > 0;

  // sp500 comparison compounds over the REAL holding period instead of
  // assuming exactly 1 year for every position regardless of buy date.
  const years                 = yearsHeld(asset.buyDate);
  const sp500CompoundedReturn = Math.pow(1 + sp500AnnualReturn, years) - 1;
  const beatSP500             = realReturn > sp500CompoundedReturn;
  const sp500ValueUSD         = originalUSD * (1 + sp500CompoundedReturn);
  const opportunityCost       = currentUSD - sp500ValueUSD;

  let verdict: 'green' | 'yellow' | 'red';
  let verdictLabel: string;
  if (beatSP500)        { verdict = 'green';  verdictLabel = 'Beating S&P500 ✅'; }
  else if (beatDevaluation) { verdict = 'yellow'; verdictLabel = 'Beating devaluation but not S&P500 ⚠️'; }
  else                  { verdict = 'red';    verdictLabel = 'Losing to devaluation ❌'; }

  return {
    name: asset.name,
    originalUSD:        Math.round(originalUSD),
    currentUSD:         Math.round(currentUSD),
    nominalEGPReturn:   Math.round(nominalReturn * 1000) / 10,
    egpDevaluationRate: Math.round(devaluation * 1000) / 10,
    realUSDReturn:      Math.round(realReturn * 1000) / 10,
    beatDevaluation,
    yearsHeld:          Math.round(years * 100) / 100,
    sp500USDReturn:     sp500AnnualReturn * 100,
    sp500ValueUSD:      Math.round(sp500ValueUSD),
    opportunityCostUSD: Math.round(opportunityCost),
    beatSP500,
    verdict,
    verdictLabel,
  };
}

// ─── Section 3 — Threshold Table ─────────────────────────────────────────────
// Unchanged — this table is deliberately period-agnostic (shows required
// return per devaluation rate, not tied to any specific asset's holding period).

export function buildThresholdTable(sp500Target = 0.10): ThresholdRow[] {
  return [0.10, 0.15, 0.20, 0.25, 0.30, 0.50].map(rate => ({
    devaluationRate: rate * 100,
    minEGPReturn:    Math.round(requiredEGPReturn(sp500Target, rate) * 1000) / 10,
  }));
}

// ─── Section 5 — Gold Reality ─────────────────────────────────────────────────

export function analyzeGold(
  grams: number, buyPriceEGP: number, currentPriceEGP: number,
  buyRateUSD: number, currentRateUSD: number, buyDate: string, sp500AnnualReturn = 0.10
): GoldRealityResult {
  const costEGP         = grams * buyPriceEGP;
  const currentValueEGP = grams * currentPriceEGP;
  const originalUSD     = toUSD(costEGP, buyRateUSD);
  const currentUSD      = toUSD(currentValueEGP, currentRateUSD);
  const devaluation     = egpDevaluationRate(buyRateUSD, currentRateUSD);
  const nominalReturn   = (currentValueEGP - costEGP) / costEGP;
  const realReturn      = realUSDReturn(nominalReturn, devaluation);

  // Same compounded-over-real-holding-period treatment as analyzeAsset.
  const years                 = yearsHeld(buyDate);
  const sp500CompoundedReturn = Math.pow(1 + sp500AnnualReturn, years) - 1;

  return {
    grams, buyPriceEGP, currentPriceEGP,
    costEGP:           Math.round(costEGP),
    currentValueEGP:   Math.round(currentValueEGP),
    buyRateUSD, currentRateUSD,
    originalUSD:       Math.round(originalUSD),
    currentUSD:        Math.round(currentUSD),
    realUSDReturn:     Math.round(realReturn * 1000) / 10,
    beatDevaluation:   realReturn > 0,
    beatSP500:         realReturn > sp500CompoundedReturn,
    breakEvenEGPPrice: Math.round(egpPriceForTargetUSD(originalUSD / grams, 0, currentRateUSD)),
    sp500EGPPrice:     Math.round(egpPriceForTargetUSD(originalUSD / grams, sp500CompoundedReturn, currentRateUSD)),
    yearsHeld:         Math.round(years * 100) / 100,
  };
}

// ─── Section 6 — Certificates Reality ────────────────────────────────────────

export function analyzeCerts(
  principalEGP: number, monthlyIncomeEGP: number,
  buyRateUSD: number, currentRateUSD: number, buyDate: string,
  yearsAhead = 5, sp500AnnualReturn = 0.10
): CertsRealityResult {
  const annualIncomeEGP    = monthlyIncomeEGP * 12;
  const annualYieldEGP     = (annualIncomeEGP / principalEGP) * 100;
  const principalUSD       = toUSD(principalEGP, currentRateUSD);
  const devaluation        = egpDevaluationRate(buyRateUSD, currentRateUSD);
  const annualYieldDecimal = annualYieldEGP / 100;

  // FIX: was `devaluation / yearsAhead` — simple division using the FORWARD
  // projection horizon as the divisor. Two problems: (1) simple division
  // instead of geometric annualization understates the true annualized
  // devaluation rate, and (2) yearsAhead is how far we're projecting forward,
  // not how long the past devaluation (buyRateUSD → currentRateUSD) actually
  // took — the wrong time base entirely unless those two happened to match
  // by coincidence. Now uses the real elapsed time since buyDate, compounded
  // correctly.
  const yearsSinceBuy     = yearsHeld(buyDate);
  const annualDevaluation = yearsSinceBuy > 0
    ? Math.pow(1 + devaluation, 1 / yearsSinceBuy) - 1
    : 0;

  const realYield = realUSDReturn(annualYieldDecimal, annualDevaluation);

  // 5-year projection with continued devaluation at the (now correctly
  // computed) annual pace
  let egpValue = principalEGP;
  for (let i = 0; i < yearsAhead; i++) egpValue *= (1 + annualYieldDecimal);
  const futureRate     = currentRateUSD * Math.pow(1 + annualDevaluation, yearsAhead);
  const value5YearsUSD = toUSD(egpValue, futureRate);

  return {
    principalEGP, monthlyIncomeEGP,
    annualYieldEGP:     Math.round(annualYieldEGP * 10) / 10,
    buyRateUSD, currentRateUSD,
    principalUSD:       Math.round(principalUSD),
    realUSDYield:       Math.round(realYield * 1000) / 10,
    growingUSDWealth:   realYield > 0,
    sp500ComparisonUSD: Math.round(principalUSD * sp500AnnualReturn),
    value5YearsUSD:     Math.round(value5YearsUSD),
    yearsSinceBuy:      Math.round(yearsSinceBuy * 100) / 100,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function runUSDRealityCheck(
  assets: AssetInput[], // each asset must now include buyDate
  gold: { grams: number; buyPrice: number; currentPrice: number; buyRate: number; currentRate: number; buyDate: string },
  certs: { principal: number; monthlyIncome: number; buyRate: number; currentRate: number; buyDate: string },
  sp500AnnualReturn = 0.10
): PortfolioRealityResult {
  const verificationTests = runVerificationTests();
  const assetResults      = assets.map(a => analyzeAsset(a, sp500AnnualReturn));
  const thresholdTable    = buildThresholdTable(sp500AnnualReturn);
  const goldSection       = analyzeGold(gold.grams, gold.buyPrice, gold.currentPrice, gold.buyRate, gold.currentRate, gold.buyDate, sp500AnnualReturn);
  const certsSection      = analyzeCerts(certs.principal, certs.monthlyIncome, certs.buyRate, certs.currentRate, certs.buyDate, 5, sp500AnnualReturn);

  const totalOriginalUSD = assetResults.reduce((s, a) => s + a.originalUSD, 0);
  const totalCurrentUSD  = assetResults.reduce((s, a) => s + a.currentUSD, 0);

  // FIX: portfolio-level S&P500 comparison used to be a flat
  // `sp500AnnualReturn * 100`, silently ignoring that assets can now have
  // very different real holding periods. It's now the sum of each asset's
  // OWN already-correctly-compounded sp500ValueUSD (from analyzeAsset,
  // above) — so a position held 3 years and one held 2 months are each
  // compared against S&P500 over their own real time, not a shared flat rate.
  const totalSP500ValueUSD = assetResults.reduce((s, a) => s + a.sp500ValueUSD, 0);

  const portfolioRealReturn = totalOriginalUSD > 0
    ? ((totalCurrentUSD - totalOriginalUSD) / totalOriginalUSD) * 100
    : 0;
  const sp500BlendedReturn = totalOriginalUSD > 0
    ? ((totalSP500ValueUSD - totalOriginalUSD) / totalOriginalUSD) * 100
    : 0;
  const portfolioScore = Math.round((portfolioRealReturn - sp500BlendedReturn) * 10) / 10;

  const portfolioWeightedYearsHeld = totalOriginalUSD > 0
    ? assetResults.reduce((s, a) => s + a.yearsHeld * a.originalUSD, 0) / totalOriginalUSD
    : 0;

  return {
    assets: assetResults,
    totalOriginalUSD:  Math.round(totalOriginalUSD),
    totalCurrentUSD:   Math.round(totalCurrentUSD),
    portfolioRealReturn: Math.round(portfolioRealReturn * 10) / 10,
    sp500BlendedReturn:  Math.round(sp500BlendedReturn * 10) / 10,
    portfolioWeightedYearsHeld: Math.round(portfolioWeightedYearsHeld * 100) / 100,
    portfolioScore,
    portfolioBeatsSP500: portfolioScore > 0,
    thresholdTable,
    goldSection,
    certsSection,
    verificationTests,
  };
}
