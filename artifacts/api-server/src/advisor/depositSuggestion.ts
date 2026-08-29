// Deposit Suggestion Engine
// Deterministic allocation recommendations for new deposits
// Does NOT call Gemini — all math is rule-based and verifiable

import { pool } from "../lib/dbPool";
import { judgeAllHoldings, findOpportunities } from "../judge/comparisonJudge";
import type { HoldingVerdict } from "../judge/types";

export interface DepositSuggestion {
  ticker: string;
  name: string;
  amount_egp: number;
  reason: string;
}

export interface DepositAllocationResponse {
  disclaimer: string;
  total_amount_egp: number;
  emergency_fund_gap_egp: number;
  emergency_fund_gap_covered: number;
  suggestions: DepositSuggestion[];
}

/**
 * suggestDepositAllocation - recommends where to allocate a new deposit
 * 
 * Rules:
 * 1. If emergency fund is below target, recommend funding it first
 * 2. Otherwise, identify strong unheld opportunities in underrepresented sectors
 * 3. Split allocation proportionally to opportunity strength and sector underrepresentation
 * 4. No Gemini — all math is deterministic
 */
export async function suggestDepositAllocation(
  amountEgp: number,
  runId?: number,
  emergencyFundTarget?: number
): Promise<DepositAllocationResponse> {
  try {
    // Fetch emergency fund target from database if not provided
    let targetEgp = emergencyFundTarget;
    if (!targetEgp) {
      const settingsResult = await pool.query<{ emergencyFundTarget: string }>(
        `SELECT emergencyFundTarget FROM portfolio_settings LIMIT 1`
      );
      targetEgp = settingsResult.rows.length > 0
        ? Number(settingsResult.rows[0].emergencyFundTarget)
        : 60000; // fallback default
    }

    // Get all verdicts to find emergency fund status
    const allVerdicts = await judgeAllHoldings("return_1y", runId, true);
    
    // Find emergency reserve holding (ABR / Bareeq)
    const emergencyFundVerdict = allVerdicts.find(
      (v) => v.holding_ticker.toUpperCase() === "ABR"
        || v.holding_name.toLowerCase().includes("bareeq")
        || v.holding_name.toLowerCase().includes("money market")
    );

    const currentEmergencyValue = emergencyFundVerdict?.holding_current_value_egp ?? 0;
    const emergencyGapEgp = Math.max(0, targetEgp - currentEmergencyValue);
    const isEmergencyBelowTarget = emergencyGapEgp > 0;

    // Response structure
    const response: DepositAllocationResponse = {
      disclaimer:
        "⚠️ This is a suggestion based on current data, not financial advice. Verify your portfolio targets and strategy before acting.",
      total_amount_egp: amountEgp,
      emergency_fund_gap_egp: emergencyGapEgp,
      emergency_fund_gap_covered: 0,
      suggestions: [],
    };

    // CASE 1: Emergency fund is below target — recommend topping it up first
    if (isEmergencyBelowTarget) {
      const emergencyAllocation = Math.min(amountEgp, emergencyGapEgp);
      response.emergency_fund_gap_covered = emergencyAllocation;

      if (emergencyFundVerdict) {
        response.suggestions.push({
          ticker: emergencyFundVerdict.holding_ticker,
          name: emergencyFundVerdict.holding_name,
          amount_egp: emergencyAllocation,
          reason: `Emergency fund is ${(
            (currentEmergencyValue / targetEgp) * 100
          ).toFixed(0)}% of target. Top it up to ${((currentEmergencyValue + emergencyAllocation) / targetEgp * 100).toFixed(0)}%.`,
        });
      }

      // If there's money left after emergency fund, allocate remainder to opportunities
      const remainder = amountEgp - emergencyAllocation;
      if (remainder > 100) {
        // Only suggest opportunities if remainder is meaningful (>100 EGP)
        const opportunities = await findOpportunities(runId);
        if (opportunities.strong_unheld.length > 0) {
          const topCandidates = opportunities.strong_unheld.slice(0, 2);
          const remainderPerCandidate = remainder / topCandidates.length;

          topCandidates.forEach((candidate, index) => {
            response.suggestions.push({
              ticker: candidate.holding_ticker,
              name: candidate.holding_name,
              amount_egp: remainderPerCandidate,
              reason: `Strong unheld opportunity${index === 0 ? " (top candidate)" : ""} — consider after reaching emergency fund target.`,
            });
          });
        }
      }
    } else {
      // CASE 2: Emergency fund is healthy — allocate to opportunities
      // Discover opportunities
      const opportunities = await findOpportunities(runId);

      if (opportunities.strong_unheld.length === 0 && opportunities.underrepresented_sectors.length === 0) {
        // No opportunities identified
        response.suggestions.push({
          ticker: emergencyFundVerdict?.holding_ticker || "ABR",
          name: emergencyFundVerdict?.holding_name || "Bareeq",
          amount_egp: amountEgp,
          reason: "No strong unheld opportunities identified. Consider maintaining emergency fund or reviewing your watchlist.",
        });
      } else {
        // Split between strong unheld and underrepresented sector candidates
        let suggestions: DepositSuggestion[] = [];

        // Top 2-3 strong unheld candidates
        const topUnheld = opportunities.strong_unheld.slice(0, 2);
        if (topUnheld.length > 0) {
          const unheldAllocation = amountEgp * 0.5; // 50% to top candidates
          const perCandidate = unheldAllocation / topUnheld.length;

          topUnheld.forEach((candidate, index) => {
            suggestions.push({
              ticker: candidate.holding_ticker,
              name: candidate.holding_name,
              amount_egp: perCandidate,
              reason: `Strong unheld opportunity${index === 0 ? " (highest priority)" : ""}. Return: ${
                candidate.holding_return_percent !== null
                  ? `${candidate.holding_return_percent.toFixed(1)}%`
                  : "data unavailable"
              }.`,
            });
          });
        }

        // Underrepresented sector with strong candidates
        if (opportunities.underrepresented_sectors.length > 0 && topUnheld.length > 0) {
          const underrepSector = opportunities.underrepresented_sectors[0];
          const sectorAllocation = amountEgp * 0.5; // 50% to underrepresented sector
          const topSectorCandidate = underrepSector.strong_candidates[0];

          suggestions.push({
            ticker: topSectorCandidate.holding_ticker,
            name: topSectorCandidate.holding_name,
            amount_egp: sectorAllocation,
            reason: `${underrepSector.sector} sector is underrepresented (${underrepSector.portfolio_allocation_percent.toFixed(
              1
            )}% of portfolio). Strong candidate in this sector.`,
          });
        } else if (opportunities.underrepresented_sectors.length > 0) {
          // If no top unheld, just use underrepresented sector
          const underrepSector = opportunities.underrepresented_sectors[0];
          const topSectorCandidate = underrepSector.strong_candidates[0];

          suggestions.push({
            ticker: topSectorCandidate.holding_ticker,
            name: topSectorCandidate.holding_name,
            amount_egp: amountEgp,
            reason: `${underrepSector.sector} sector is underrepresented (${underrepSector.portfolio_allocation_percent.toFixed(
              1
            )}% of portfolio). Strong candidate in this sector.`,
          });
        } else if (topUnheld.length > 0) {
          // No underrep sectors but have unheld — suggest all to unheld
          const perCandidate = amountEgp / topUnheld.length;
          suggestions = suggestions.map((s, i) => ({
            ...s,
            amount_egp: perCandidate,
          }));
        }

        response.suggestions = suggestions;
      }
    }

    return response;
  } catch (err) {
    console.error("[suggestDepositAllocation] failed:", err);
    throw new Error("Deposit suggestion failed", { cause: err });
  }
}
