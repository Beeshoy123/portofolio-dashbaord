// Deterministic Portfolio Opportunity Analysis
//
// Calculates structured opportunity data BEFORE Gemini runs:
// - Strong unheld entities
// - Sectors with no current Strong exposure
// - Sectors with too little representation
// - Unheld assets outperforming held positions
// - Risk differences
//
// Gemini's job is explaining these facts, not discovering them.

import type { HoldingVerdict, ComparisonEntry } from "../judge/types";

export interface OpportunitySector {
  sector: string;
  held_strong_count: number;
  held_mixed_count: number;
  held_weak_count: number;
  unheld_strong_entities: Array<{
    ticker: string;
    name: string;
    return_percent: number | null;
    signal?: string;
  }>;
}

export interface PortfolioOpportunityAnalysis {
  strong_unheld_entities: Array<{
    ticker: string;
    name: string;
    return_percent: number | null;
    risk_tier: string | null;
  }>;
  sectors_no_strong_exposure: OpportunitySector[];
  underrepresented_sectors: OpportunitySector[];
  unheld_outperforming_held: Array<{
    unheld_ticker: string;
    unheld_name: string;
    unheld_return: number | null;
    held_ticker: string;
    held_name: string;
    held_return: number | null;
    gap_percent: number;
    risk_comparison: string;
  }>;
  risk_tier_comparison: {
    portfolio_avg_risk: string;
    opportunities_avg_risk: string;
    higher_risk_opportunities: number;
  };
}

export function analyzePortfolioOpportunities(
  verdicts: HoldingVerdict[],
): PortfolioOpportunityAnalysis {
  const heldVerdicts = verdicts.filter((v) => v.is_held);
  const unheldVerdicts = verdicts.filter((v) => !v.is_held);

  // 1. Strong unheld entities
  const strongUnheld = unheldVerdicts.filter((v) => v.signal === "Strong");

  // 2. Sectors analysis
  const sectorMap = new Map<
    string,
    {
      held_strong: HoldingVerdict[];
      held_mixed: HoldingVerdict[];
      held_weak: HoldingVerdict[];
      unheld_strong: HoldingVerdict[];
    }
  >();

  // Extract sector from asset role or name
  const getSector = (verdict: HoldingVerdict): string => {
    const role = verdict.holding_asset_role;
    if (role === "income_fund") return "Income";
    if (role === "growth_fund") return "Growth";
    if (role === "commodity_fund") return "Commodities";
    if (role === "real_estate_fund") return "Real Estate";
    if (role === "stock") return "Direct Stocks";
    return "Other";
  };

  // Populate sector map
  for (const verdict of heldVerdicts) {
    const sector = getSector(verdict);
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        held_strong: [],
        held_mixed: [],
        held_weak: [],
        unheld_strong: [],
      });
    }
    const entry = sectorMap.get(sector)!;
    if (verdict.signal === "Strong") entry.held_strong.push(verdict);
    else if (verdict.signal === "Mixed") entry.held_mixed.push(verdict);
    else if (verdict.signal === "Weak") entry.held_weak.push(verdict);
  }

  for (const verdict of unheldVerdicts) {
    const sector = getSector(verdict);
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        held_strong: [],
        held_mixed: [],
        held_weak: [],
        unheld_strong: [],
      });
    }
    const entry = sectorMap.get(sector)!;
    if (verdict.signal === "Strong") entry.unheld_strong.push(verdict);
  }

  // 3. Sectors with no Strong exposure (held)
  const sectorsNoStrongExposure: OpportunitySector[] = [];
  for (const [sector, data] of sectorMap.entries()) {
    if (data.held_strong.length === 0 && data.unheld_strong.length > 0) {
      sectorsNoStrongExposure.push({
        sector,
        held_strong_count: 0,
        held_mixed_count: data.held_mixed.length,
        held_weak_count: data.held_weak.length,
        unheld_strong_entities: data.unheld_strong.map((v) => ({
          ticker: v.holding_ticker,
          name: v.holding_name,
          return_percent: v.holding_return_percent,
          signal: v.signal,
        })),
      });
    }
  }

  // 4. Underrepresented sectors (have some held but room for growth)
  const underrepresentedSectors: OpportunitySector[] = [];
  const UNDERREPRESENTED_THRESHOLD = 1; // Less than 2 strong holdings
  for (const [sector, data] of sectorMap.entries()) {
    if (
      data.held_strong.length < UNDERREPRESENTED_THRESHOLD &&
      data.held_strong.length > 0 &&
      data.unheld_strong.length > 0
    ) {
      underrepresentedSectors.push({
        sector,
        held_strong_count: data.held_strong.length,
        held_mixed_count: data.held_mixed.length,
        held_weak_count: data.held_weak.length,
        unheld_strong_entities: data.unheld_strong.map((v) => ({
          ticker: v.holding_ticker,
          name: v.holding_name,
          return_percent: v.holding_return_percent,
          signal: v.signal,
        })),
      });
    }
  }

  // 5. Unheld assets outperforming held positions
  const unheldOutperformingHeld: PortfolioOpportunityAnalysis["unheld_outperforming_held"] = [];
  for (const unheld of unheldVerdicts) {
    if (unheld.holding_return_percent === null) continue;
    for (const held of heldVerdicts) {
      if (held.holding_return_percent === null) continue;
      const gap =
        unheld.holding_return_percent - held.holding_return_percent;
      if (gap >= 3) {
        // Significant gap (3+ percentage points)
        const riskComparison =
          unheld.holding_risk_tier === held.holding_risk_tier
            ? "similar risk"
            : unheld.holding_risk_tier === "Low"
              ? "lower risk"
              : unheld.holding_risk_tier === "High"
                ? "higher risk"
                : "different risk profile";

        unheldOutperformingHeld.push({
          unheld_ticker: unheld.holding_ticker,
          unheld_name: unheld.holding_name,
          unheld_return: unheld.holding_return_percent,
          held_ticker: held.holding_ticker,
          held_name: held.holding_name,
          held_return: held.holding_return_percent,
          gap_percent: gap,
          risk_comparison: riskComparison,
        });
      }
    }
  }

  // 6. Risk tier comparison
  const getRiskScore = (tier: string | null): number => {
    if (tier === "Low") return 1;
    if (tier === "Medium") return 2;
    if (tier === "High") return 3;
    return 0;
  };

  const heldRiskScores = heldVerdicts
    .map((v) => getRiskScore(v.holding_risk_tier))
    .filter((s) => s > 0);
  const unheldRiskScores = unheldVerdicts
    .map((v) => getRiskScore(v.holding_risk_tier))
    .filter((s) => s > 0);

  const getAvgRiskTier = (scores: number[]): string => {
    if (scores.length === 0) return "Unknown";
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 1.5) return "Low";
    if (avg < 2.5) return "Medium";
    return "High";
  };

  const heldAvgRisk = getAvgRiskTier(heldRiskScores);
  const unheldAvgRisk = getAvgRiskTier(unheldRiskScores);
  const higherRiskOpportunities = unheldVerdicts.filter(
    (v) =>
      v.signal === "Strong" &&
      getRiskScore(v.holding_risk_tier) > getRiskScore(heldAvgRisk as any),
  ).length;

  return {
    strong_unheld_entities: strongUnheld.map((v) => ({
      ticker: v.holding_ticker,
      name: v.holding_name,
      return_percent: v.holding_return_percent,
      risk_tier: v.holding_risk_tier,
    })),
    sectors_no_strong_exposure: sectorsNoStrongExposure,
    underrepresented_sectors: underrepresentedSectors,
    unheld_outperforming_held,
    risk_tier_comparison: {
      portfolio_avg_risk: heldAvgRisk,
      opportunities_avg_risk: unheldAvgRisk,
      higher_risk_opportunities: higherRiskOpportunities,
    },
  };
}

export function buildOpportunityAnalysisPrompt(
  analysis: PortfolioOpportunityAnalysis,
): string {
  const lines: string[] = [];

  lines.push("PORTFOLIO OPPORTUNITY ANALYSIS (deterministic, pre-calculated):\n");

  if (analysis.strong_unheld_entities.length > 0) {
    lines.push("Strong Unheld Entities:");
    for (const entity of analysis.strong_unheld_entities) {
      const returnStr =
        entity.return_percent !== null
          ? `${entity.return_percent.toFixed(1)}%`
          : "N/A";
      lines.push(
        `  - ${entity.ticker} (${entity.name}): ${returnStr}, risk=${entity.risk_tier || "unknown"}`,
      );
    }
    lines.push("");
  } else {
    lines.push("Strong Unheld Entities: None detected\n");
  }

  if (analysis.sectors_no_strong_exposure.length > 0) {
    lines.push("Sectors with No Strong Held Exposure:");
    for (const sector of analysis.sectors_no_strong_exposure) {
      lines.push(`  - ${sector.sector}:`);
      lines.push(`    - Held positions: ${sector.held_mixed_count} Mixed, ${sector.held_weak_count} Weak`);
      lines.push(`    - Strong opportunities: ${sector.unheld_strong_entities.length}`);
      for (const opp of sector.unheld_strong_entities) {
        const returnStr =
          opp.return_percent !== null ? `${opp.return_percent.toFixed(1)}%` : "N/A";
        lines.push(`      • ${opp.ticker} (${opp.name}): ${returnStr}`);
      }
    }
    lines.push("");
  }

  if (analysis.underrepresented_sectors.length > 0) {
    lines.push("Underrepresented Sectors (have some Strong exposure but room for growth):");
    for (const sector of analysis.underrepresented_sectors) {
      lines.push(`  - ${sector.sector}:`);
      lines.push(
        `    - Held: ${sector.held_strong_count} Strong, ${sector.held_mixed_count} Mixed, ${sector.held_weak_count} Weak`,
      );
      lines.push(`    - Strong opportunities: ${sector.unheld_strong_entities.length}`);
      for (const opp of sector.unheld_strong_entities) {
        const returnStr =
          opp.return_percent !== null ? `${opp.return_percent.toFixed(1)}%` : "N/A";
        lines.push(`      • ${opp.ticker} (${opp.name}): ${returnStr}`);
      }
    }
    lines.push("");
  }

  if (analysis.unheld_outperforming_held.length > 0) {
    lines.push("Unheld Assets Outperforming Held Positions (3+ percentage point gap):");
    for (const comparison of analysis.unheld_outperforming_held) {
      const heldReturnStr =
        comparison.held_return !== null
          ? comparison.held_return.toFixed(1)
          : "N/A";
      const unheldReturnStr =
        comparison.unheld_return !== null
          ? comparison.unheld_return.toFixed(1)
          : "N/A";
      lines.push(
        `  - ${comparison.unheld_ticker} (${unheldReturnStr}%) vs held ${comparison.held_ticker} (${heldReturnStr}%): +${comparison.gap_percent.toFixed(1)}pp gap, ${comparison.risk_comparison}`,
      );
    }
    lines.push("");
  }

  lines.push("Risk Profile Summary:");
  lines.push(
    `  - Portfolio average risk (held): ${analysis.risk_tier_comparison.portfolio_avg_risk}`,
  );
  lines.push(
    `  - Opportunity average risk: ${analysis.risk_tier_comparison.opportunities_avg_risk}`,
  );
  lines.push(
    `  - Strong opportunities with higher risk than portfolio average: ${analysis.risk_tier_comparison.higher_risk_opportunities}`,
  );

  return lines.join("\n");
}
