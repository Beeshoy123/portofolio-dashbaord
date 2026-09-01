// Smart Advisor — Prompt Builder
//
// Turns a HoldingVerdict (from Comparison Judge) into a prompt for Gemini.
// Deliberately sends the STRUCTURED signal/flags/key numbers, not the full
// raw entry list for every group — Comparison Judge already did the
// analysis; Gemini's job is explaining the conclusion clearly, not
// re-deriving it from scratch. See design discussion: this keeps the
// prompt small (cost) and reduces the chance Gemini misreads a number
// buried in a long table.
//
// FILE STRUCTURE:
// ├── Types & Context
// ├── System Instructions (advisor rules, confidence caps, fundamentals)
// ├── Portfolio Summary Instructions (portfolio-wide decision logic)
// ├── Data Block Builders (format verdict data for the prompt)
// └── Main Entry Points (buildPrompt, buildPortfolioSummaryPrompt)

import type { HoldingVerdict, ComparisonGroup, ComparisonEntry } from "../judge/types";
import type { SignalHistoryRow } from "../judge/signalTrend";

export interface AdvisorAlertContext {
  timeStop?: { is_stagnant: boolean; stagnant_days?: number | null };
  thesis?: { has_reversal: boolean; newly_appeared_flags?: string[] };
  drawdown?: { current_drawdown_percent?: number | null };
  signalTrend?: SignalHistoryRow[] | null;
  portfolioSummary?: {
    summary_text: string;
    strong_count: number;
    mixed_count: number;
    weak_count: number;
    insufficient_data_count: number;
  };
}

export const SYSTEM_INSTRUCTIONS = `You are a financial explainer inside a personal investment dashboard for an Egyptian investor tracking EGX mutual funds and stocks. You are NOT a licensed financial advisor, and you must say so is implicit — never use language implying guaranteed outcomes.

STRICT RULES (violating any of these makes your response unusable):
1. ZERO GUESSWORK — Only use numbers explicitly given to you in the data below. NEVER invent, estimate, or assume a number, price, rate, or fact not present in the input. If something relevant is missing, say plainly that the data isn't available rather than filling the gap.
2. NO FINANCIAL HYPE — Never promise or imply guaranteed returns. Never use speculative pitch language ("don't miss out", "huge opportunity"). Always mention downside/risk alongside any upside you highlight.
3. EDUCATIONAL FORMAT — Structure your response in exactly this order:
   a) Explain the relevant concept in plain language first (e.g. what "beating a sector benchmark" means, in one sentence, only if it aids understanding — skip if the person likely already knows it)
   b) Show the actual numbers from the data given
   c) Give a clear action suggestion matching your DECISION (never say "buy X now" — frame it as "worth researching" or "worth watching", since you cannot execute trades or guarantee outcomes)
   d) Show the simple math/reasoning behind the action (e.g. "the gap is X percentage points, which is significant/marginal because...")
4. TONE — Plain, direct, warm but not falsely encouraging. No emojis. No exclamation marks. Keep it tight: 3-5 sentences when giving a plain recommendation (rule 3 only). If rule 6 applies (a rotation split is being suggested), you may extend to 6-8 sentences total — the extra room is for the EGP breakdown, not for extra hedging or repetition.
5. Never mention inflation-adjustment or "real return" — this dashboard deliberately does not use inflation-adjusted figures, only nominal returns. Do not bring up inflation at all.
6. ROTATION SUGGESTIONS (only when the position value is provided AND the gap to a better alternative is significant, e.g. a "losing_to_direct_stock" or "losing_to_benchmark" flag with a double-digit percentage-point gap):
   - You MAY suggest a split of the CURRENT POSITION VALUE between the current holding and the better alternative(s).
   - You MUST choose only from these clean fractions — never a precise/calculated percentage: 100/0 (no change), 75/25, 60/40, 50/50, 40/60, 25/75, 0/100 (full rotation).
   - Justify the fraction choice in plain terms relative to the size of the gap (e.g. "since the gap is large and consistent across multiple comparisons, a 60/40 split toward the alternative reflects that" — not a precise calculation implying false precision).
   - ALWAYS state the actual EGP amounts each side of the split represents, using the position value given.
   - If the position value is not provided in the data, or the gap is small/mixed, do NOT suggest a split — just give the qualitative recommendation from rule 3.
   - This is a suggestion for the person to consider, not an instruction — phrase it as "you could consider" not "you should".
7. RISK PARITY PROTECTION — NEVER suggest rotating money from a lower-risk asset into a higher-risk asset based on return performance alone. The data below includes a computed risk tier (Low/Medium/High) for the holding and for each comparison entry, calculated from return volatility. FIX (bug #2 from audit): the priority order when data sources disagree was previously ambiguous — it is now explicit: ALWAYS base your risk assessment and any risk-related statements on the COMPUTED risk tier (labeled "computed risk" or "YOUR COMPUTED RISK TIER" in the data below) — this is the authoritative value for this rule. Where a "NOTE: our computed risk disagrees with FoudaLens's own label" appears for an entry, mention that disagreement exists (so the person knows there's uncertainty), but do NOT let FoudaLens's label change your actual recommendation — it is supporting context only, never the deciding input. If a higher-computed-risk asset is beating the holding, explicitly say that the outperformance comes with higher computed risk/volatility, and recommend maintaining the current risk profile unless the person actively wants to increase portfolio risk. Do not silently treat a higher-risk winner as a clean "better choice" — the risk difference is part of the answer, not a footnote.
8. FUNDAMENTALS CONCERNS — Where an entry beating the holding has a "FUNDAMENTALS CONCERN" note (e.g. high debt, negative free cash flow, low_return_on_equity, shrinking_revenue, dilution), you MUST mention it explicitly when discussing that entry as an alternative — the same way rule 7 requires you to mention higher computed risk. A stock that's beating the holding on price return but carries a flagged fundamentals concern is not a clean "better choice" — say so plainly, the same way you already do for risk tier differences. Do not let a fundamentals concern change the win/lose count or the Strong/Mixed/Weak signal — Comparison Judge already decided that; your job is only to make sure the concern isn't hidden from the person reading the recommendation.
9. THIN SAMPLE CAUTION — When you see a "thin_comparable_sample" flag in the FLAGS RAISED section, the Judge's "Strong" signal was capped at "Mixed" because there were fewer than 4 comparable entries with usable returns. Treat this the same way you treat risk mismatches (rule 7) and fundamentals concerns (rule 8): mention it explicitly in your recommendation. A holding that appears "Strong" on a thin sample should not receive the same confident recommendation as one backed by 6+ solid comparables. Lower your confidence score accordingly, and phrase the recommendation as "worth watching" rather than "hold with confidence".
10. REVERSAL RISK — When "reversal_risk_elevated" appears in FLAGS RAISED, this is a pattern-based observation (not a prediction): the recent trend is upward, but recent candlestick patterns include bearish signals. Describe this as a short-term technical pattern observation worth monitoring, not as a reason to immediately exit the position. Mention it as a note: "the recent trend shows some bearish pattern signals alongside the uptrend, which is worth watching in the near term." Do not frame this as advice to sell.
11. TECHNICAL DIVERGENCE — When "technical_divergence" appears in FLAGS RAISED, you MUST explicitly mention the conflict between the strong comparison result and the recent downtrend. Lean toward "watch_and_wait" rather than a confident "hold" because the recent chart direction conflicts with the Strong comparison signal.
12. DATA QUALITY — Treat DATA QUALITY as a hard confidence constraint. If the holding snapshot is missing, failed, or stale, say that the recommendation is limited and do not present the comparison as definitive. If few comparables have usable returns, prefer "watch_and_wait" over a confident rotation suggestion. If a SIGNAL TREND shows a declining pattern (e.g. Strong, Strong, Mixed, Weak), lower your confidence score and mention this deterioration in your summary — a worsening trend is a meaningful context shift. Never invent missing values.
13. CONFIDENCE CALIBRATION — Your confidence score (0-100) must reflect the amount of comparison data available, not just how clear the direction looks. If 'Comparable entries with usable returns' (from the DETERMINISTIC ANALYSIS BASIS section) is 0-2, confidence must be 40 or below. If it is 3-5, confidence must be 65 or below. Only use a confidence above 65 when 6 or more comparable entries have usable returns. This is a hard ceiling, not a suggestion — a confident-sounding summary with thin backing data must still report a low confidence number.
14. STRUCTURED ACTION VOCABULARY & FIELDS:
DECISION must be exactly one of: consider_entry, consider_rotation, watch_and_wait, hold.
- consider_entry: use only when this holding is NOT currently held (skip for now if the verdict is for an already-held holding — that case should nearly always be hold or watch_and_wait)
- consider_rotation: use only when comparison data clearly shows a specific alternative outperforming this holding by a wide, sustained margin — name the alternative explicitly in the summary
- watch_and_wait: the default when signal is Mixed, or when signal is Weak/Strong but data quality or technical flags (e.g. reversal_risk_elevated, thin_comparable_sample) reduce certainty
- hold: use when signal is Strong or Mixed with no conflicting flags and no significant technical divergence

WATCH_TRIGGER: when decision is watch_and_wait or consider_rotation, you MUST state one concrete, checkable condition drawn from data already provided (e.g. referencing the comparable count needed, a stated technical pattern, or 'next scheduled bot run') — do not invent a specific price percentage or number that was not provided to you in the DATA block. When decision is consider_entry or hold, return an empty string.

DO_NOT_ACT_REASONS: when decision is watch_and_wait or hold, list 1-3 short reasons grounded in the DATA block for why no action is needed yet (e.g. 'still beating comparable peers', 'no reversal pattern confirmed'). When decision is consider_entry or consider_rotation, return an empty array.
`;

export const PORTFOLIO_SUMMARY_SYSTEM_INSTRUCTIONS = `You are a financial explainer inside a personal investment dashboard for an Egyptian investor tracking EGX mutual funds and stocks. You are not a licensed financial advisor.

Your job is to produce a single structured JSON object — NOT narrative prose — that captures an overall portfolio-level read based on the DATA block provided. Use only the numbers and counts given to you; do not invent, estimate, or assume any figure not in the data.

DECISION (exactly one of: "hold", "watch", "rebalance"):
- "hold": portfolio composition looks fine overall. The count-based and value-based signal distributions are both reasonable (e.g. most holdings and most portfolio value sit in Strong or Mixed). No flags or reversal-risk clusters represent a major fraction of the total. No changes needed at the portfolio level.
- "watch": something specific deserves attention but does not yet require action. Examples: a single holding with an outsized value weight is showing Weak signal; reversal-risk or technical divergence is present in 2+ holdings; flagged holdings represent more than a small fraction of the total. Name what specifically deserves watching in the summary.
- "rebalance": allocation is meaningfully skewed and attention to redistribution across holdings is warranted. Use this when the size-weighted (By value) data diverges materially from the count-based picture — e.g. a large percentage of total portfolio value sits in Weak or Insufficient Data holdings while the count looks fine, or multiple holdings share the same flag or risk exposure. Reference the size-weighted data and the flags/coverage/reversal-risk aggregates from the DATA block when justifying this decision.

CONFIDENCE (0–100): Reflect the completeness and quality of the data.
- If many holdings have Insufficient Data signal or missing coverage, or if a partial evaluation was noted, confidence must be lower (≤50).
- If the data is complete and the signal distribution is clear, confidence can be higher.
- Never assign confidence above 75 when the portfolio summary is based on a partial evaluation.

SUMMARY: One concise paragraph (4–6 sentences). State the counts and value percentages of Strong, Mixed, Weak, and Insufficient Data holdings. When the count-based and value-based pictures diverge meaningfully (e.g. a count read of "mostly Strong" but a large value percentage sits in Weak), call this out explicitly — this is the single most decision-relevant signal. Name holdings that clearly carry or drag the portfolio when their signal is notably different from the rest. Explicitly say when too many holdings have Insufficient Data to support a confident overall conclusion. If the prompt notes a partial evaluation, mention that the summary is based on partial data. Mention risk where it is present. For every opportunity candidate you mention by name, you MUST also state the single strongest reason this recommendation could be wrong — grounded in the DATA block (e.g. thin coverage, a fundamentals flag, a negative absolute return despite beating peers, or sector concentration with other listed opportunities). Do not invent a generic risk disclaimer — cite the specific data point. If genuinely no concerning data point exists for a candidate, state that explicitly (e.g. 'no significant concerns found in available data') rather than fabricating one. Never use hype, promise returns, or say buy or sell now.

EVIDENCE (2–4 bullet points): Cite specific counts, tickers, or percentages drawn directly from the DATA block. Examples: "3 of 7 holdings are Weak", "62% of portfolio value is in Mixed holdings", "2 holdings have reversal_risk_elevated". Do not invent figures.

RISKS (2–4 bullet points): Portfolio-level risks grounded in the DATA block. Examples: concentration of value in one signal tier, multiple holdings sharing the same flag, size-weighted mismatch between count signal and value signal, elevated reversal-risk cluster, low average coverage reducing confidence in verdicts.

NEXT_REVIEW_DAYS (1–365): When to reassess the portfolio as a whole. This can differ from any individual holding's own next_review_days. Use shorter windows (7–14 days) when the decision is "rebalance" or when reversal risk is elevated. Use moderate windows (21–45 days) for "watch". Use longer windows (45–90 days) when the decision is "hold" with high confidence.

TONE AND CONSTRAINTS:
- Plain, direct, warm but not falsely encouraging. No emojis. No exclamation marks.
- Never say "buy now", "sell now", or imply guaranteed outcomes.
- Never mention inflation-adjustment or "real return" — this dashboard uses only nominal returns.
- If data is missing, say so plainly; do not fill gaps with invented figures.
`;

export const OPPORTUNITY_ANALYSIS_SYSTEM_INSTRUCTIONS = `You are a financial explainer helping an Egyptian investor identify portfolio diversification opportunities. Your job is to explain PRE-CALCULATED opportunity facts, not discover them yourself.

OPPORTUNITY ANALYSIS RULES:
1. EXPLAIN FACTS ONLY — You will receive a deterministic analysis showing strong unheld entities, sector gaps, and performance comparisons. Explain these facts plainly; do not recalculate or contradict them.
2. STRUCTURE YOUR RESPONSE as:
   a) Strongest unheld candidates (Strong signal, ranked by return if tied)
   b) Sector gaps (sectors with no Strong held exposure, with Strong unheld alternatives)
   c) Underrepresented sectors (sectors with room for growth)
   d) Performance comparisons (unheld assets significantly outperforming current holdings)
3. RISK TRANSPARENCY — Always mention when opportunities carry higher risk than the portfolio average. Never recommend rotating money FROM lower-risk assets INTO higher-risk assets on return performance alone.
4. For every opportunity candidate you mention by name, you MUST also state the single strongest reason this recommendation could be wrong — grounded in the DATA block (e.g. thin coverage, a fundamentals flag, a negative absolute return despite beating peers, or sector concentration with other listed opportunities). Do not invent a generic risk disclaimer — cite the specific data point. If genuinely no concerning data point exists for a candidate, state that explicitly (e.g. 'no significant concerns found in available data') rather than fabricating one.
5. When discussing an opportunity candidate, your confidence score must not exceed what its confidence_tier supports: 'low' tier caps confidence at 40, 'moderate' tier caps at 65, 'high' tier has no additional cap beyond the existing comparable-count rule. If fundamentals_flags is non-empty for this candidate, reduce confidence by at least 15 points from whatever the tier would otherwise allow, and mention the specific fundamentals flag in your evidence or thesis_risk.
6. TONE — Educational and neutral. No hype ("don't miss this opportunity"), no guarantees. Frame as "worth researching" or "worth watching", never "buy now".
7. ACTIONABLE — End with 1-2 clear next steps: e.g., "Watch XYZ for one quarter" or "Research ABC's fundamentals before considering".
`;


export function buildPortfolioSummaryPrompt(
  verdicts: HoldingVerdict[],
  opportunities?: { strong_unheld: HoldingVerdict[]; underrepresented_sectors: Array<{ sector: string; portfolio_allocation_percent: number; strong_candidates: HoldingVerdict[] }> },
  evaluationScope?: { totalExpected: number; evaluated: number }
): string {
  const lines = verdicts.length > 0
    ? verdicts.map((verdict) =>
      `- ${verdict.holding_ticker} (${verdict.holding_name}): ${verdict.signal}; return ${verdict.holding_return_percent !== null ? `${verdict.holding_return_percent.toFixed(1)}%` : "unavailable"}`,
    )
    : ["- No holding verdicts were produced for this run."];

  let partialEvaluationLine = "";
  if (evaluationScope && evaluationScope.totalExpected > evaluationScope.evaluated) {
    const missingCount = evaluationScope.totalExpected - evaluationScope.evaluated;
    partialEvaluationLine = `\n- Note: ${evaluationScope.evaluated} of ${evaluationScope.totalExpected} entities were judged this run; ${missingCount} could not be evaluated.`;
  }

  const totalCount = verdicts.length;
  const flaggedCount = verdicts.filter((v) => v.flags && v.flags.length > 0).length;
  const coverageVerdicts = verdicts.filter((v) => typeof v.coverage_percent === "number" && Number.isFinite(v.coverage_percent));
  const avgCoverageStr = coverageVerdicts.length > 0
    ? `${(coverageVerdicts.reduce((sum, v) => sum + v.coverage_percent!, 0) / coverageVerdicts.length).toFixed(1)}%`
    : "unavailable";
  const reversalRiskCount = verdicts.filter((v) => v.technical_signal?.reversal_risk === "elevated").length;
  const divergenceCount = verdicts.filter((v) => v.flags && v.flags.includes("technical_divergence")).length;

  const counts = verdicts.reduce(
    (result, verdict) => {
      if (verdict.signal === "Strong") result.strong++;
      else if (verdict.signal === "Mixed") result.mixed++;
      else if (verdict.signal === "Weak") result.weak++;
      else if (verdict.signal === "Insufficient Data") result.insufficientData++;
      return result;
    },
    { strong: 0, mixed: 0, weak: 0, insufficientData: 0 },
  );

  const valueSums = verdicts.reduce(
    (acc, verdict) => {
      const val = verdict.holding_current_value_egp;
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        acc.totalValue += val;
        if (verdict.signal === "Strong") acc.strongValue += val;
        else if (verdict.signal === "Mixed") acc.mixedValue += val;
        else if (verdict.signal === "Weak") acc.weakValue += val;
        else if (verdict.signal === "Insufficient Data") acc.insufficientValue += val;
      }
      return acc;
    },
    { totalValue: 0, strongValue: 0, mixedValue: 0, weakValue: 0, insufficientValue: 0 },
  );

  const countParts: string[] = [];
  if (counts.strong > 0) countParts.push(`${counts.strong} Strong`);
  if (counts.mixed > 0) countParts.push(`${counts.mixed} Mixed`);
  if (counts.weak > 0) countParts.push(`${counts.weak} Weak`);
  if (counts.insufficientData > 0) countParts.push(`${counts.insufficientData} Insufficient Data`);
  const countStr = countParts.length > 0 ? countParts.join(", ") : "0 holdings";

  let valueStr = "unavailable (holding values not provided)";
  if (valueSums.totalValue > 0) {
    const valueParts: string[] = [];
    if (valueSums.strongValue > 0) valueParts.push(`${((valueSums.strongValue / valueSums.totalValue) * 100).toFixed(1)}% in Strong holdings`);
    if (valueSums.mixedValue > 0) valueParts.push(`${((valueSums.mixedValue / valueSums.totalValue) * 100).toFixed(1)}% in Mixed holdings`);
    if (valueSums.weakValue > 0) valueParts.push(`${((valueSums.weakValue / valueSums.totalValue) * 100).toFixed(1)}% in Weak holdings`);
    if (valueSums.insufficientValue > 0) valueParts.push(`${((valueSums.insufficientValue / valueSums.totalValue) * 100).toFixed(1)}% in Insufficient Data`);
    valueStr = valueParts.length > 0 ? valueParts.join(", ") : "0%";
  }

  const distributionLine = `- Signal distribution: By holding count: ${countStr}. By portfolio value: ${valueStr}.`;
  const aggregateLine = `- Aggregate metrics: Flags raised: ${flaggedCount} of ${totalCount} holdings | Avg coverage: ${avgCoverageStr} | Reversal risk: ${reversalRiskCount} holdings | Diverging from trend: ${divergenceCount} holdings`;

  // Use passed opportunities data if available, otherwise fall back to filtering verdicts
  let opportunityLines: string[];
  if (opportunities?.strong_unheld) {
    opportunityLines = opportunities.strong_unheld.length > 0
      ? opportunities.strong_unheld.slice(0, 3).map((verdict) => 
          `- Strong unheld opportunity: ${verdict.holding_ticker} (${verdict.holding_name}) — ${verdict.holding_return_percent !== null ? `${verdict.holding_return_percent.toFixed(1)}%` : "return unavailable"}`
        )
      : ["- No strong unheld opportunities were detected in the current run."];
  } else {
    const strongUnheld = verdicts.filter((verdict) => verdict.signal === "Strong");
    opportunityLines = strongUnheld.length > 0
      ? strongUnheld.map((verdict) => `- Strong unheld opportunity: ${verdict.holding_ticker} (${verdict.holding_name}) — ${verdict.holding_return_percent !== null ? `${verdict.holding_return_percent.toFixed(1)}%` : "return unavailable"}`)
      : ["- No strong unheld opportunities were detected in the current run."];
  }

  // Build underrepresented sectors context
  const sectorsContext = opportunities?.underrepresented_sectors && opportunities.underrepresented_sectors.length > 0
    ? opportunities.underrepresented_sectors
        .map((s) => `- ${s.sector} sector: currently ${s.portfolio_allocation_percent.toFixed(1)}% of portfolio; candidates: ${s.strong_candidates.map((c) => c.holding_ticker).join(", ")}`)
        .join("\n")
    : "- No underrepresented sectors identified.";

  const sectorsLine = [
    "- Underrepresented sectors (portfolio allocation <10% with strong unheld candidates):",
    sectorsContext,
    "- Mention 1-2 specific opportunity candidates by name if their signal and sector fit unmet portfolio needs.",
    "- Include only actual watchlist evidence; do not invent sectors or holdings.",
  ].join("\n");

  return `PORTFOLIO VERDICTS:\n${lines.join("\n")}${partialEvaluationLine}\n${distributionLine}\n${aggregateLine}\n\nDETERMINISTIC OPPORTUNITY ANALYSIS:\n${opportunityLines.join("\n")}\n\n${sectorsLine}\n\nReturn ONLY valid JSON matching this exact shape. Do not use Markdown fences:\n{"decision":"hold|watch|rebalance","confidence":0,"summary":"...","evidence":["..."],"risks":["..."],"next_review_days":30}`;
}

function formatGroupForPrompt(group: ComparisonGroup): string {
  const label: Record<string, string> = {
    sector_sibling: "Other funds in the same sector",
    manager_sibling: "Other funds from the same manager",
    direct_stock: "Individual stocks in the same sector",
    benchmark: "Market benchmarks (EGX30/70/100)",
  };

  const usableEntries = group.entries.filter((e) => e.return_percent !== null);
  if (usableEntries.length === 0) {
    return `${label[group.group_type]}: no data available yet`;
  }

  const lines = usableEntries.map((e) => {
    const context: string[] = [];
    if (e.sector_rank !== null) context.push(`sector rank #${e.sector_rank}`);
    if (e.stock_signal !== null) context.push(`current signal: ${e.stock_signal}`);
    if (e.computed_risk_tier !== null) context.push(`computed risk: ${e.computed_risk_tier}`);
    if (e.risk_mismatch) context.push(`NOTE: our computed risk disagrees with FoudaLens's own label (${e.foudalens_risk_level}) — mention this uncertainty if relevant`);
    if (e.fundamentals && e.fundamentals.flags.length > 0) {
      const flagDetails = e.fundamentals.flags.map((f) => f.detail).join("; ");
      context.push(`FUNDAMENTALS CONCERN: ${flagDetails}`);
    }
    const contextStr = context.length > 0 ? ` (${context.join(", ")})` : "";
    const gapStr =
      e.gap_percent !== null
        ? e.gap_percent >= 0
          ? `you are ahead by ${e.gap_percent.toFixed(1)}pp`
          : `you are behind by ${Math.abs(e.gap_percent).toFixed(1)}pp`
        : "";
    return `  - ${e.name} (${e.ticker}, role: ${e.asset_role}): ${e.return_percent!.toFixed(1)}%${contextStr} — ${gapStr}`;
  });

  return `${label[group.group_type]}:\n${lines.join("\n")}`;
}

function buildAnalysisBasis(verdict: HoldingVerdict): string {
  const entries = verdict.groups.flatMap((group) => group.entries);
  const usableEntries = entries.filter((entry) => entry.gap_percent !== null);
  const largestDeficit = usableEntries.reduce<ComparisonEntry | null>(
    (worst, entry) => !worst || entry.gap_percent! < worst.gap_percent! ? entry : worst,
    null,
  );
  const largestLead = usableEntries.reduce<ComparisonEntry | null>(
    (best, entry) => !best || entry.gap_percent! > best.gap_percent! ? entry : best,
    null,
  );
  const riskMismatches = entries.filter((entry) => entry.risk_mismatch).length;
  const fundamentalsConcerns = entries.filter(
    (entry) => entry.fundamentals && entry.fundamentals.flags.length > 0,
  ).length;

  return `
  DETERMINISTIC ANALYSIS BASIS (calculated by the Comparison Judge; do not recalculate or contradict it):
  - Comparable entries with usable returns: ${usableEntries.length}/${entries.length}
  - Coverage: ${verdict.coverage_percent !== null ? `${verdict.coverage_percent.toFixed(1)}%` : "unavailable"}
  - Judge signal: ${verdict.signal}
  - Gap range versus comparables: ${largestDeficit ? `${largestDeficit.gap_percent!.toFixed(1)}pp to ${largestLead!.gap_percent!.toFixed(1)}pp` : "unavailable"}
  - Largest lead: ${largestLead ? `${largestLead.ticker} (${largestLead.gap_percent!.toFixed(1)}pp)` : "unavailable"}
  - Largest deficit: ${largestDeficit ? `${largestDeficit.ticker} (${largestDeficit.gap_percent!.toFixed(1)}pp)` : "unavailable"}
  - Risk mismatches: ${riskMismatches}
  - Comparables with fundamentals concerns: ${fundamentalsConcerns}
  `.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA BLOCK BUILDERS — Format verdict data for Gemini prompts
// buildDataBlock() — Single holding recommendation context
// buildPortfolioSummaryPrompt() — Portfolio-wide verdict summary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds just the data portion of the prompt — used with Gemini's
 * systemInstruction field (see generateRecommendation.ts), which keeps
 * constraints separate from data rather than concatenating everything
 * into one string. This is the function generateRecommendation.ts calls.
 * 
 * Now optionally includes alert context (from Time Stop, Thesis Check, Drawdown)
 * to inform recommendation confidence and caveats.
 */
export function buildDataBlock(
  verdict: HoldingVerdict,
  alerts?: AdvisorAlertContext,
): string {
  const periodLabel = verdict.return_period.replace("return_", "").toUpperCase();

  let alertsBlock = "";
  if (alerts) {
    const alertLines: string[] = [];

    if (alerts.timeStop && alerts.timeStop.is_stagnant) {
      alertLines.push(
        `⚠ STAGNANT SIGNAL: This verdict has not changed for ${alerts.timeStop.stagnant_days || "??"} days. Consider mentioning this in your confidence level.`
      );
    }

    if (alerts.thesis && alerts.thesis.has_reversal) {
      const newFlags =
        alerts.thesis.newly_appeared_flags && alerts.thesis.newly_appeared_flags.length > 0
          ? ` (newly appeared: ${alerts.thesis.newly_appeared_flags.join(", ")})`
          : "";
      alertLines.push(
        `⚠ THESIS REVERSAL: The holding's signal or flags have changed since 30 days ago${newFlags}. Mention this context shift.`
      );
    }

    const drawdownPercent = alerts.drawdown?.current_drawdown_percent;
    if (drawdownPercent !== null && drawdownPercent !== undefined && drawdownPercent > 10) {
        alertLines.push(
          `⚠ PORTFOLIO DRAWDOWN: The total portfolio is currently ${drawdownPercent.toFixed(1)}% below its peak. Acknowledge broader portfolio context.`
        );
    }

    if (alertLines.length > 0) {
      alertsBlock = `\n\nALERT SYSTEM CONTEXT:\n${alertLines.join("\n")}`;
    }
  }

  const dataBlock = `
HOLDING: ${verdict.holding_name} (${verdict.holding_ticker})
ASSET ROLE: ${verdict.holding_asset_role}
RETURN PERIOD: ${periodLabel}
YOUR RETURN: ${verdict.holding_return_percent !== null ? verdict.holding_return_percent.toFixed(1) + "%" : "no data available"}
CURRENT POSITION VALUE: ${verdict.holding_current_value_egp !== null ? verdict.holding_current_value_egp.toLocaleString() + " EGP" : "not available — do not suggest a rotation split without this"}
YOUR COMPUTED RISK TIER: ${verdict.holding_risk_tier ?? "unknown"}
TECHNICAL ANALYSIS: ${verdict.technical_signal ? `${verdict.technical_signal.trend}; ${verdict.technical_signal.patterns.length > 0 ? verdict.technical_signal.patterns.map((pattern) => `${pattern.direction} ${pattern.name} (${pattern.date})`).join(", ") : "no recent candlestick pattern"}; confidence ${verdict.technical_signal.confidence !== null ? verdict.technical_signal.confidence.toFixed(2) : "unavailable"}` : "unavailable — do not infer chart direction"}
DATA QUALITY: holding snapshot ${verdict.data_quality.holding_snapshot_status}${verdict.data_quality.holding_snapshot_age_hours !== null ? ` (${verdict.data_quality.holding_snapshot_age_hours.toFixed(1)} hours old)` : ""}; ${verdict.data_quality.comparable_with_return_count}/${verdict.data_quality.comparable_count} comparables have usable returns

COMPARISON JUDGE'S SIGNAL: ${verdict.signal}
FLAGS RAISED: ${verdict.flags.length > 0 ? verdict.flags.join(", ") : "none"}${alerts?.signalTrend && alerts.signalTrend.length >= 2 ? `\nSIGNAL TREND (last ${alerts.signalTrend.length} runs, oldest to newest): ${alerts.signalTrend.map((row) => row.signal).join(", ")}` : ""}
${alerts?.portfolioSummary ? `
PORTFOLIO-WIDE COMPARISON JUDGE SUMMARY (same run; use as context, do not repeat every detail):
- Strong holdings: ${alerts.portfolioSummary.strong_count}
- Mixed holdings: ${alerts.portfolioSummary.mixed_count}
- Weak holdings: ${alerts.portfolioSummary.weak_count}
- Insufficient Data holdings: ${alerts.portfolioSummary.insufficient_data_count}
- Overall read: ${alerts.portfolioSummary.summary_text}` : ""}

${verdict.groups.map(formatGroupForPrompt).join("\n\n")}

${buildAnalysisBasis(verdict)}

${verdict.data_completeness_warning ? "NOTE: More than 30% of comparison data is missing this run — mention that the picture is incomplete if it affects your confidence in the recommendation." : ""}${alertsBlock}
`.trim();

  return `DATA:\n${dataBlock}\n\n---\n\nWrite the recommendation now, following the structure and rules above exactly.`;
}

/**
 * Legacy combined version (instructions + data as one string). Kept for
 * any external code that might reference it, but generateRecommendation.ts
 * now uses SYSTEM_INSTRUCTIONS + buildDataBlock() separately via the
 * systemInstruction API field instead of this.
 */
export function buildPrompt(verdict: HoldingVerdict): string {
  return `${SYSTEM_INSTRUCTIONS}\n\n---\n\n${buildDataBlock(verdict)}`;
}
