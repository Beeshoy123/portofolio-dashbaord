import type { FundamentalsSnapshot } from "./fundamentalsTypes";

export type FinancialHealthGrade =
  | "Red Flag"
  | "Weak"
  | "Strong"
  | "Neutral"
  | "Insufficient Data";

type FinancialHealthMetricKey =
  | "roe_percent"
  | "revenue_growth_percent"
  | "debt_to_equity"
  | "current_ratio"
  | "free_cash_flow"
  | "shares_change_percent";

const FINANCIAL_HEALTH_METRICS: FinancialHealthMetricKey[] = [
  "roe_percent",
  "revenue_growth_percent",
  "debt_to_equity",
  "current_ratio",
  "free_cash_flow",
  "shares_change_percent",
];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + (sorted[upper] ?? sorted[lower]) * weight;
}

function winsorize(values: number[], lowPct: number, highPct: number): number[] {
  if (values.length === 0) return values;
  const lowerBound = percentile(values, lowPct);
  const upperBound = percentile(values, highPct);
  return values.map((value) => {
    if (value < lowerBound) return lowerBound;
    if (value > upperBound) return upperBound;
    return value;
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function numericValueForMetric(
  fundamentals: FundamentalsSnapshot | null,
  metric: FinancialHealthMetricKey,
): number | null {
  if (!fundamentals) return null;
  return fundamentals[metric] ?? null;
}

export function computeFinancialHealthGrade(
  holding: { fundamentals: FundamentalsSnapshot | null } | null,
  peerGroup: Array<{ fundamentals: FundamentalsSnapshot | null }>,
): FinancialHealthGrade {
  const holdingFundamentals = holding?.fundamentals ?? null;
  if (!holdingFundamentals) return "Insufficient Data";

  const peerFundamentals = peerGroup
    .map((entry) => entry.fundamentals)
    .filter((entry): entry is FundamentalsSnapshot => Boolean(entry));

  if (peerFundamentals.length < 6) {
    return "Insufficient Data";
  }

  const zScores: number[] = [];

  for (const metric of FINANCIAL_HEALTH_METRICS) {
    const holdingValue = numericValueForMetric(holdingFundamentals, metric);
    if (holdingValue === null || !Number.isFinite(holdingValue)) continue;

    const peerValues = peerFundamentals
      .map((entry) => numericValueForMetric(entry, metric))
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (peerValues.length === 0) continue;

    const adjustedPeerValues = metric === "debt_to_equity"
      ? winsorize(peerValues, 0.05, 0.95).map((value) => -value)
      : winsorize(peerValues, 0.05, 0.95);

    const adjustedHoldingValue = metric === "debt_to_equity"
      ? -holdingValue
      : holdingValue;

    const adjustedMean = mean(adjustedPeerValues);
    const adjustedStdDev = standardDeviation(adjustedPeerValues, adjustedMean);
    const zScore = adjustedStdDev === 0 ? 0 : (adjustedHoldingValue - adjustedMean) / adjustedStdDev;
    zScores.push(zScore);
  }

  if (zScores.length === 0) {
    return "Insufficient Data";
  }

  const compositeZScore = mean(zScores);

  if (compositeZScore < -2.0) return "Red Flag";
  if (compositeZScore < -1.0) return "Weak";
  if (compositeZScore > 0.5) return "Strong";
  return "Neutral";
}
