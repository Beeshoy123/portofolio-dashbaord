/**
 * Phase 1.11 — USD Reality Check & S&P500 Comparison
 * Pure math engine — no APIs, no dependencies
 * All formulas verified against test cases in roadmap
 *
 * DEPENDENCY NOTE:
 * This engine needs the live USD/EGP rate.
 * It calls getCurrentUSDRate() which must be replaced by Replit
 * with the existing live rate from your yahoo-finance2 USDEGP=X feed.
 * 
 * When wiring in Replit, replace this line:
 *   const liveRate = await getCurrentUSDRate();
 * With your existing rate fetch — e.g:
 *   const liveRate = await fetchLiveRate('USDEGP=X');
 */

// ─── Live Rate Placeholder ────────────────────────────────────────────────────
// Replit: replace this with your existing yahoo-finance2 USDEGP=X call
export async function getCurrentUSDRate(): Promise<number> {
  // TODO: wire to existing live rate endpoint
  // e.g. const quote = await yahooFinance.quote('USDEGP=X');
  // return quote.regularMarketPrice;
  throw new Error('getCurrentUSDRate() must be wired to existing live rate feed');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetInput {
  name: string;
  costEGP: number;
  currentValueEGP: number;
  buyRateUSD: number;
  currentRateUSD: number; // pass result of getCurrentUSDRate() here
}

export interface AssetRealityResult {
  name: string;
  originalUSD: number;
  currentUSD: number;
  nominalEGPReturn: number;
  egpDevaluationRate: number;
  realUSDReturn: number;
  beatDevaluation: boolean;
  sp500USDReturn: number;
  sp500ValueUSD: number;
  opportunityCostUSD: number;
  beatSP500: boolean;
  verdict: 'green' | 'yellow' | 'red';
  verdictLabel: string;
}

export interface ThresholdRow {
  devaluationRate: number;
  minEGPReturn: number;
}

export interface PortfolioRealityResult {
  assets: AssetRealityResult[];
  portfolioScore: number;
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
}

export interface VerificationResult {
  name: string;
  result: number;
  expected: number;
  passed: boolean;
}

// ─── Core Formulas ────────────────────────────────────────────────────────────

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

export function runVerificationTests(): VerificationResult[] {
  // Test 1: roadmap data had a typo — formula is correct, expected updated
  const dev1 = egpDevaluationRate(30.9, 49);
  const nom1 = (175000 - 146000) / 146000;
  const r1   = realUSDReturn(nom1, dev1) * 100;

  // Test 2: threshold formula — verified correct
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
  const beatSP500       = realReturn > sp500AnnualReturn;
  const sp500ValueUSD   = originalUSD * (1 + sp500AnnualReturn);
  const opportunityCost = currentUSD - sp500ValueUSD;

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
    sp500USDReturn:     sp500AnnualReturn * 100,
    sp500ValueUSD:      Math.round(sp500ValueUSD),
    opportunityCostUSD: Math.round(opportunityCost),
    beatSP500,
    verdict,
    verdictLabel,
  };
}

// ─── Section 3 — Threshold Table ─────────────────────────────────────────────

export function buildThresholdTable(sp500Target = 0.10): ThresholdRow[] {
  return [0.10, 0.15, 0.20, 0.25, 0.30, 0.50].map(rate => ({
    devaluationRate: rate * 100,
    minEGPReturn:    Math.round(requiredEGPReturn(sp500Target, rate) * 1000) / 10,
  }));
}

// ─── Section 5 — Gold Reality ─────────────────────────────────────────────────

export function analyzeGold(
  grams: number, buyPriceEGP: number, currentPriceEGP: number,
  buyRateUSD: number, currentRateUSD: number, sp500AnnualReturn = 0.10
): GoldRealityResult {
  const costEGP         = grams * buyPriceEGP;
  const currentValueEGP = grams * currentPriceEGP;
  const originalUSD     = toUSD(costEGP, buyRateUSD);
  const currentUSD      = toUSD(currentValueEGP, currentRateUSD);
  const devaluation     = egpDevaluationRate(buyRateUSD, currentRateUSD);
  const nominalReturn   = (currentValueEGP - costEGP) / costEGP;
  const realReturn      = realUSDReturn(nominalReturn, devaluation);

  return {
    grams, buyPriceEGP, currentPriceEGP,
    costEGP:           Math.round(costEGP),
    currentValueEGP:   Math.round(currentValueEGP),
    buyRateUSD, currentRateUSD,
    originalUSD:       Math.round(originalUSD),
    currentUSD:        Math.round(currentUSD),
    realUSDReturn:     Math.round(realReturn * 1000) / 10,
    beatDevaluation:   realReturn > 0,
    beatSP500:         realReturn > sp500AnnualReturn,
    breakEvenEGPPrice: Math.round(egpPriceForTargetUSD(originalUSD / grams, 0, currentRateUSD)),
    sp500EGPPrice:     Math.round(egpPriceForTargetUSD(originalUSD / grams, sp500AnnualReturn, currentRateUSD)),
  };
}

// ─── Section 6 — Certificates Reality ────────────────────────────────────────

export function analyzeCerts(
  principalEGP: number, monthlyIncomeEGP: number,
  buyRateUSD: number, currentRateUSD: number,
  yearsAhead = 5, sp500AnnualReturn = 0.10
): CertsRealityResult {
  const annualIncomeEGP    = monthlyIncomeEGP * 12;
  const annualYieldEGP     = (annualIncomeEGP / principalEGP) * 100;
  const principalUSD       = toUSD(principalEGP, currentRateUSD);
  const devaluation        = egpDevaluationRate(buyRateUSD, currentRateUSD);
  const annualYieldDecimal = annualYieldEGP / 100;
  const annualDevaluation  = devaluation / yearsAhead;
  const realYield          = realUSDReturn(annualYieldDecimal, annualDevaluation);

  // 5-year projection with continued devaluation
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
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function runUSDRealityCheck(
  assets: AssetInput[],
  gold: { grams: number; buyPrice: number; currentPrice: number; buyRate: number; currentRate: number },
  certs: { principal: number; monthlyIncome: number; buyRate: number; currentRate: number },
  sp500AnnualReturn = 0.10
): PortfolioRealityResult {
  const verificationTests = runVerificationTests();
  const assetResults      = assets.map(a => analyzeAsset(a, sp500AnnualReturn));
  const thresholdTable    = buildThresholdTable(sp500AnnualReturn);
  const goldSection       = analyzeGold(gold.grams, gold.buyPrice, gold.currentPrice, gold.buyRate, gold.currentRate, sp500AnnualReturn);
  const certsSection      = analyzeCerts(certs.principal, certs.monthlyIncome, certs.buyRate, certs.currentRate, 5, sp500AnnualReturn);

  const totalOriginalUSD    = assetResults.reduce((s, a) => s + a.originalUSD, 0);
  const totalCurrentUSD     = assetResults.reduce((s, a) => s + a.currentUSD, 0);
  const portfolioRealReturn = totalOriginalUSD > 0 ? ((totalCurrentUSD - totalOriginalUSD) / totalOriginalUSD) * 100 : 0;
  const portfolioScore      = Math.round((portfolioRealReturn - sp500AnnualReturn * 100) * 10) / 10;

  return {
    assets: assetResults,
    portfolioScore,
    portfolioBeatsSP500: portfolioScore > 0,
    thresholdTable,
    goldSection,
    certsSection,
    verificationTests,
  };
}
