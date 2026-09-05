import { Router } from "express";
import { type PoolClient } from "pg";
import { pool } from "../lib/dbPool";
import { runScraper } from "../scraper/runScraper";
import { judgeAllHoldings, findOpportunities, invalidateJudgeCache, type OpportunitiesAnalysis } from "../judge/comparisonJudge";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { getRecentSignalTrend } from "../judge/signalTrend";
import { capturePortfolioValue, computeDrawdown } from "../judge/drawdownDb";
import { generatePortfolioSummary, generateRecommendation } from "../advisor/generateRecommendation";
import { runBotPipeline } from "../aiBot/pipeline";
import { runTechnicalAnalysis } from "../technical/technicalAnalysis";
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from "../lib/advisoryLock";
import type { JudgeRunDiagnostics } from "../judge/types";

const router = Router();
const BOT_LOCK_ID = 1844674410;

type StageState = "waiting" | "running" | "completed" | "failed";
type StageCounts = { succeeded: number; failed: number; total: number };
type BotStatus = {
  running: boolean;
  runId: number | null;
  startedAt: string | null;
  error: string | null;
  verdict_history_write_failures: string[];
  chart_reader_failures: string[];
  chart_reader_errors: string[];
  stage_counts: Record<string, StageCounts>;
  stage_errors: Record<string, string[]>;
  stages: {
    priceChecker: StageState;
    chartReader: StageState;
    comparisonJudge: StageState;
    alerts: StageState;
    smartAdvisor: StageState;
  };
};

let status: BotStatus = {
  running: false,
  runId: null,
  startedAt: null,
  error: null,
  verdict_history_write_failures: [],
  chart_reader_failures: [],
  chart_reader_errors: [],
  stage_counts: {},
  stage_errors: {},
  stages: {
    priceChecker: "waiting",
    chartReader: "waiting",
    comparisonJudge: "waiting",
    alerts: "waiting",
    smartAdvisor: "waiting",
  },
};

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function persistRunDiagnostics(
  runId: number,
  stageCounts: Record<string, StageCounts>,
  stageErrors: Record<string, string[]>,
): Promise<void> {
  await pool.query(
    `UPDATE bot_runs SET stage_counts = $1::jsonb, stage_errors = $2::jsonb WHERE id = $3`,
    [JSON.stringify(stageCounts), JSON.stringify(stageErrors), runId],
  );
}

async function runBot(lockClient: PoolClient, runId: number): Promise<void> {
  status = {
    running: true,
    runId,
    startedAt: new Date().toISOString(),
    error: null,
    verdict_history_write_failures: [],
    chart_reader_failures: [],
    chart_reader_errors: [],
    stage_counts: {},
    stage_errors: {},
    stages: {
      priceChecker: "running",
      chartReader: "waiting",
      comparisonJudge: "waiting",
      alerts: "waiting",
      smartAdvisor: "waiting",
    },
  };

  const stageCounts: Record<string, StageCounts> = {};
  const stageErrors: Record<string, string[]> = {};
  const persistProgress = async () => {
    status.stage_counts = stageCounts;
    status.stage_errors = stageErrors;
    await persistRunDiagnostics(runId, stageCounts, stageErrors);
  };

  try {
    const summary = await runBotPipeline({
      runPriceChecker: async () => {
        const result = await runScraper(runId);
        stageCounts.priceChecker = result;
        if (result.failed > 0) stageErrors.priceChecker = [`${result.failed} price checks failed`];
        await persistProgress();
        status.stages.priceChecker = result.failed === result.total ? "failed" : "completed";
        return result;
      },
      runChartReader: async (runId) => {
        status.stages.chartReader = "running";
        try {
          const result = await runTechnicalAnalysis(runId);
          status.chart_reader_failures = result.failed_tickers;
          status.chart_reader_errors = result.failure_messages;
          stageCounts.chartReader = { succeeded: result.succeeded, failed: result.failed, total: result.total };
          if (result.failure_messages.length > 0) stageErrors.chartReader = result.failure_messages;
          await persistProgress();
          status.stages.chartReader = result.total > 0 && result.failed === result.total
            ? "failed"
            : "completed";
          if (result.failed > 0 && result.succeeded > 0) {
            console.warn(`[ai-bot] Chart Reader completed with partial results: ${result.succeeded}/${result.total} signals fetched`);
          }
          return result;
        } catch (error) {
          status.stages.chartReader = "failed";
          stageCounts.chartReader = { succeeded: 0, failed: 0, total: 0 };
          stageErrors.chartReader = [error instanceof Error ? error.message : String(error)];
          await persistProgress();
          console.error("[ai-bot] Chart Reader failed", error);
          return { succeeded: 0, failed: 0, total: 0 };
        }
      },
      runComparisonJudge: async (runId) => {
        status.stages.comparisonJudge = "running";
        const diagnostics: JudgeRunDiagnostics = { verdict_history_write_failures: [] };
        try {
          const result = await judgeAllHoldings("return_1y", runId, false, diagnostics);
          stageCounts.comparisonJudge = { succeeded: result.length, failed: diagnostics.verdict_history_write_failures.length, total: result.length + diagnostics.verdict_history_write_failures.length };
          if (diagnostics.verdict_history_write_failures.length > 0) stageErrors.comparisonJudge = diagnostics.verdict_history_write_failures;
          await persistProgress();
          status.verdict_history_write_failures = diagnostics.verdict_history_write_failures;
          status.stages.comparisonJudge = "completed";
          return result;
        } catch (error) {
          status.stages.comparisonJudge = "failed";
          stageErrors.comparisonJudge = [error instanceof Error ? error.message : String(error)];
          await persistProgress();
          console.error("[ai-bot] Comparison Judge failed", error);
          return [];
        }
      },
      runAlerts: async (runId) => {
        status.stages.alerts = "running";
        try {
          await capturePortfolioValue(runId);
          const result = await Promise.all([
            checkAllTimeStops(runId),
            checkAllTheses(runId),
            computeDrawdown(runId),
          ]);
          stageCounts.alerts = { succeeded: 1, failed: 0, total: 1 };
          await persistProgress();
          status.stages.alerts = "completed";
          return result;
        } catch (error) {
          status.stages.alerts = "failed";
          stageCounts.alerts = { succeeded: 0, failed: 1, total: 1 };
          stageErrors.alerts = [error instanceof Error ? error.message : String(error)];
          await persistProgress();
          console.error("[ai-bot] Alerts failed", error);
          return [];
        }
      },
      runSmartAdvisor: async (runId, rawVerdicts, rawAlerts) => {
        status.stages.smartAdvisor = "running";
        try {
          const allVerdicts = rawVerdicts as Awaited<ReturnType<typeof judgeAllHoldings>>;
          const skippedVerdicts = allVerdicts.filter((verdict) => verdict.holding_return_percent === null);
          const verdicts = allVerdicts.filter((verdict) => verdict.holding_return_percent !== null);
          if (skippedVerdicts.length > 0) {
            stageErrors.smartAdvisor = skippedVerdicts.map((verdict) => `${verdict.holding_ticker}: skipped because no usable return data was available`);
          }
          const [timeStops, theses, drawdown] = rawAlerts as [
            Array<{ ticker: string; is_stagnant: boolean; stagnant_days?: number | null }>,
            Array<{ ticker: string; has_reversal: boolean; newly_appeared_flags?: string[] }>,
            { current_drawdown_percent?: number | null } | undefined,
          ];
          let portfolioSummaryContext: {
            summary_text: string;
            excellent_count: number;
            solid_count: number;
            caution_count: number;
            avoid_count: number;
            insufficient_data_count: number;
          } | undefined;

          // Portfolio Summary must succeed — it's essential for per-holding context
          const counts = verdicts.reduce(
            (result, verdict) => {
              if (verdict.signal === "Excellent") result.excellent++;
              else if (verdict.signal === "Solid") result.solid++;
              else if (verdict.signal === "Caution") result.caution++;
              else if (verdict.signal === "Avoid") result.avoid++;
              else if (verdict.signal === "Insufficient Data") result.insufficientData++;

              if (verdict.flags && verdict.flags.length > 0) {
                result.flaggedCount++;
              }
              if (typeof verdict.coverage_percent === "number" && Number.isFinite(verdict.coverage_percent)) {
                result.coverageSum += verdict.coverage_percent;
                result.coverageCount++;
              }
              if (verdict.technical_signal?.reversal_risk === "elevated") {
                result.reversalRiskCount++;
              }
              if (verdict.flags && verdict.flags.includes("technical_divergence")) {
                result.divergenceCount++;
              }

              return result;
            },
            {
              excellent: 0,
              solid: 0,
              caution: 0,
              avoid: 0,
              insufficientData: 0,
              flaggedCount: 0,
              coverageSum: 0,
              coverageCount: 0,
              reversalRiskCount: 0,
              divergenceCount: 0,
            },
          );

          const avgCoveragePercent = counts.coverageCount > 0
            ? Number((counts.coverageSum / counts.coverageCount).toFixed(1))
            : null;

          // Compute value-weighted signal distribution across holdings with known position value.
          // Note: Holdings with unknown value (null) are excluded from the value-weighted total,
          // not from the equal-weighted counts above.
          const valueSums = verdicts.reduce(
            (acc, verdict) => {
              const val = verdict.holding_current_value_egp;
              if (typeof val === "number" && Number.isFinite(val) && val > 0) {
                acc.totalValue += val;
                if (verdict.signal === "Excellent") acc.excellentValue += val;
                else if (verdict.signal === "Solid") acc.solidValue += val;
                else if (verdict.signal === "Caution") acc.cautionValue += val;
                else if (verdict.signal === "Avoid") acc.avoidValue += val;
                else if (verdict.signal === "Insufficient Data") acc.insufficientValue += val;
              }
              return acc;
            },
            {
              totalValue: 0,
              excellentValue: 0,
              solidValue: 0,
              cautionValue: 0,
              avoidValue: 0,
              insufficientValue: 0,
            },
          );

          const excellentValuePercent = valueSums.totalValue > 0
            ? Number(((valueSums.excellentValue / valueSums.totalValue) * 100).toFixed(1))
            : null;
          const solidValuePercent = valueSums.totalValue > 0
            ? Number(((valueSums.solidValue / valueSums.totalValue) * 100).toFixed(1))
            : null;
          const cautionValuePercent = valueSums.totalValue > 0
            ? Number(((valueSums.cautionValue / valueSums.totalValue) * 100).toFixed(1))
            : null;
          const avoidValuePercent = valueSums.totalValue > 0
            ? Number(((valueSums.avoidValue / valueSums.totalValue) * 100).toFixed(1))
            : null;
          const insufficientValuePercent = valueSums.totalValue > 0
            ? Number(((valueSums.insufficientValue / valueSums.totalValue) * 100).toFixed(1))
            : null;

          // Check how many held entities were expected vs how many verdicts succeeded
          let totalExpectedHoldings = verdicts.length;
          try {
            const heldCountResult = await pool.query<{ count: number }>(
              `SELECT COUNT(*)::int AS count FROM comparison_watchlist
               WHERE is_held = true AND ticker <> 'ABR' AND COALESCE(funds_table_key, '') <> 'abr' AND lower(name) NOT LIKE '%bareeq%'`
            );
            if (heldCountResult.rows.length > 0 && heldCountResult.rows[0].count > 0) {
              totalExpectedHoldings = Number(heldCountResult.rows[0].count);
            }
          } catch (countErr) {
            console.warn("[ai-bot] Could not query expected held holdings count:", countErr);
          }

          const succeededCount = verdicts.length;
          const hasEnoughData = succeededCount > 0 && totalExpectedHoldings > 0 && (succeededCount / totalExpectedHoldings) >= 0.5;

          try {
            if (!hasEnoughData) {
              const fallbackSummaryText = `Only ${succeededCount} of ${totalExpectedHoldings} holdings could be judged this run — not enough data for a reliable portfolio summary. Retry the run for a complete picture.`;
              portfolioSummaryContext = {
                summary_text: fallbackSummaryText,
                excellent_count: counts.excellent,
                solid_count: counts.solid,
                caution_count: counts.caution,
                avoid_count: counts.avoid,
                insufficient_data_count: counts.insufficientData,
              };
              await pool.query(
                `INSERT INTO portfolio_summaries
                  (run_id, summary_text, excellent_count, solid_count, caution_count, avoid_count, insufficient_data_count, model_used, flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count, excellent_value_percent, solid_value_percent, caution_value_percent, avoid_value_percent, insufficient_value_percent, decision, confidence, evidence, risks, next_review_days)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                 ON CONFLICT (run_id) DO UPDATE SET
                   summary_text = EXCLUDED.summary_text,
                   excellent_count = EXCLUDED.excellent_count,
                   solid_count = EXCLUDED.solid_count,
                   caution_count = EXCLUDED.caution_count,
                   avoid_count = EXCLUDED.avoid_count,
                   insufficient_data_count = EXCLUDED.insufficient_data_count,
                   model_used = EXCLUDED.model_used,
                   flagged_count = EXCLUDED.flagged_count,
                   avg_coverage_percent = EXCLUDED.avg_coverage_percent,
                   reversal_risk_count = EXCLUDED.reversal_risk_count,
                   divergence_count = EXCLUDED.divergence_count,
                   excellent_value_percent = EXCLUDED.excellent_value_percent,
                   solid_value_percent = EXCLUDED.solid_value_percent,
                   caution_value_percent = EXCLUDED.caution_value_percent,
                   avoid_value_percent = EXCLUDED.avoid_value_percent,
                   insufficient_value_percent = EXCLUDED.insufficient_value_percent,
                   decision = EXCLUDED.decision,
                   confidence = EXCLUDED.confidence,
                   evidence = EXCLUDED.evidence,
                   risks = EXCLUDED.risks,
                   next_review_days = EXCLUDED.next_review_days,
                   generated_at = now()`,
                [
                  runId,
                  fallbackSummaryText,
                  counts.excellent,
                  counts.solid,
                  counts.caution,
                  counts.avoid,
                  counts.insufficientData,
                  "deterministic-fallback",
                  counts.flaggedCount,
                  avgCoveragePercent,
                  counts.reversalRiskCount,
                  counts.divergenceCount,
                  excellentValuePercent,
                  solidValuePercent,
                  cautionValuePercent,
                  avoidValuePercent,
                  insufficientValuePercent,
                  null, // decision — not available for deterministic fallback
                  null, // confidence
                  null, // evidence
                  null, // risks
                  null, // next_review_days
                ],
              );
              console.warn(`[ai-bot] Portfolio summary skipped (below 50% threshold: ${succeededCount}/${totalExpectedHoldings} judged); saved deterministic summary.`);
            } else {
              // Discover opportunities periodically (every 5th run) to balance freshness vs. performance
              // Each run evaluates ~59 entities instead of ~8-10 held ones, so we throttle to reduce load
              let opportunities: OpportunitiesAnalysis | undefined;
              if (runId && runId % 5 === 0) {
                try {
                  opportunities = await findOpportunities(runId);
                  console.log("[ai-bot] Opportunities discovery ran for runId", runId);
                } catch (err) {
                  console.warn("[ai-bot] Opportunities discovery failed; proceeding without opportunity context:", err);
                  // Non-fatal: opportunities are optional context, portfolio summary can still run
                }
              } else if (runId) {
                console.log("[ai-bot] Skipping opportunities discovery for runId", runId, "(runs every 5th time)");
              }

              const evaluationScope = {
                totalExpected: totalExpectedHoldings,
                evaluated: succeededCount,
              };

              let summaryText = "";
              let modelUsed = "deterministic-fallback";
              let portfolioDecision: string | null = null;
              let portfolioConfidence: number | null = null;
              let portfolioEvidence: string[] | null = null;
              let portfolioRisks: string[] | null = null;
              let portfolioNextReviewDays: number | null = null;

              try {
                const portfolioSummary = await generatePortfolioSummary(verdicts, opportunities, evaluationScope);
                summaryText = portfolioSummary.summary;
                modelUsed = portfolioSummary.model_used;
                portfolioDecision = portfolioSummary.decision;
                portfolioConfidence = portfolioSummary.confidence;
                portfolioEvidence = portfolioSummary.evidence;
                portfolioRisks = portfolioSummary.risks;
                portfolioNextReviewDays = portfolioSummary.next_review_days;
              } catch (genError) {
                console.error("[ai-bot] generatePortfolioSummary failed; falling back to deterministic summary:", genError);
                summaryText = `Portfolio summary could not be generated by AI for this run. Evaluated ${succeededCount} of ${totalExpectedHoldings} holdings: ${counts.excellent} Excellent, ${counts.solid} Solid, ${counts.caution} Caution, ${counts.avoid} Avoid, ${counts.insufficientData} Insufficient Data.`;
                modelUsed = "fallback";
              }

              portfolioSummaryContext = {
                summary_text: summaryText,
                excellent_count: counts.excellent,
                solid_count: counts.solid,
                caution_count: counts.caution,
                avoid_count: counts.avoid,
                insufficient_data_count: counts.insufficientData,
              };
              await pool.query(
                `INSERT INTO portfolio_summaries
                  (run_id, summary_text, excellent_count, solid_count, caution_count, avoid_count, insufficient_data_count, model_used, flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count, excellent_value_percent, solid_value_percent, caution_value_percent, avoid_value_percent, insufficient_value_percent, decision, confidence, evidence, risks, next_review_days)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                 ON CONFLICT (run_id) DO UPDATE SET
                   summary_text = EXCLUDED.summary_text,
                   excellent_count = EXCLUDED.excellent_count,
                   solid_count = EXCLUDED.solid_count,
                   caution_count = EXCLUDED.caution_count,
                   avoid_count = EXCLUDED.avoid_count,
                   insufficient_data_count = EXCLUDED.insufficient_data_count,
                   model_used = EXCLUDED.model_used,
                   flagged_count = EXCLUDED.flagged_count,
                   avg_coverage_percent = EXCLUDED.avg_coverage_percent,
                   reversal_risk_count = EXCLUDED.reversal_risk_count,
                   divergence_count = EXCLUDED.divergence_count,
                   excellent_value_percent = EXCLUDED.excellent_value_percent,
                   solid_value_percent = EXCLUDED.solid_value_percent,
                   caution_value_percent = EXCLUDED.caution_value_percent,
                   avoid_value_percent = EXCLUDED.avoid_value_percent,
                   insufficient_value_percent = EXCLUDED.insufficient_value_percent,
                   decision = EXCLUDED.decision,
                   confidence = EXCLUDED.confidence,
                   evidence = EXCLUDED.evidence,
                   risks = EXCLUDED.risks,
                   next_review_days = EXCLUDED.next_review_days,
                   generated_at = now()`,
                [
                  runId,
                  summaryText,
                  counts.excellent,
                  counts.solid,
                  counts.caution,
                  counts.avoid,
                  counts.insufficientData,
                  modelUsed,
                  counts.flaggedCount,
                  avgCoveragePercent,
                  counts.reversalRiskCount,
                  counts.divergenceCount,
                  excellentValuePercent,
                  solidValuePercent,
                  cautionValuePercent,
                  avoidValuePercent,
                  insufficientValuePercent,
                  portfolioDecision,
                  portfolioConfidence,
                  portfolioEvidence !== null ? JSON.stringify(portfolioEvidence) : null,
                  portfolioRisks !== null ? JSON.stringify(portfolioRisks) : null,
                  portfolioNextReviewDays,
                ],
              );
            }
          } catch (error) {
            console.error("[ai-bot] Portfolio summary step encountered an error; continuing with per-holding advisor:", error);
          }

          // Track advisor generation success — if all fail, the run should not be "completed"
          let advisorSuccessCount = 0;
          let advisorFailureCount = 0;
          const advisorFailures: string[] = [];

          await runWithConcurrency(verdicts, 3, async (verdict) => {
            try {
              // Call Gemini for ALL verdicts, including those with missing return data — Gemini will explain insufficient data
              // Fetch signal trend for context
              const watchlistIdResult = await pool.query<{ id: number }>(
                `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
                [verdict.holding_ticker]
              );
              const watchlistId = watchlistIdResult.rows[0]?.id;
              const signalTrend = watchlistId ? await getRecentSignalTrend(watchlistId) : null;
              
              const recommendation = await generateRecommendation(verdict, {
                timeStop: timeStops.find((alert) => alert.ticker === verdict.holding_ticker),
                thesis: theses.find((alert) => alert.ticker === verdict.holding_ticker),
                drawdown,
                signalTrend,
                portfolioSummary: portfolioSummaryContext,
              });
              await pool.query(
                `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id, decision, confidence, evidence, risks, next_review_days, watch_trigger, do_not_act_reasons, generation_status, error_message)
                 SELECT id, $1, $2, $4, $5, $6, $7, $8, $9, $10, $11, 'succeeded', NULL FROM comparison_watchlist WHERE ticker = $3
                 ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL
                 DO UPDATE SET recommendation_text = EXCLUDED.recommendation_text,
                               model_used = EXCLUDED.model_used,
                               generation_status = 'succeeded',
                               error_message = NULL,
                               decision = EXCLUDED.decision,
                               confidence = EXCLUDED.confidence,
                               evidence = EXCLUDED.evidence,
                               risks = EXCLUDED.risks,
                               next_review_days = EXCLUDED.next_review_days,
                               watch_trigger = EXCLUDED.watch_trigger,
                               do_not_act_reasons = EXCLUDED.do_not_act_reasons`,
                [
                  recommendation.recommendation_text,
                  recommendation.model_used,
                  verdict.holding_ticker,
                  runId,
                  recommendation.structured.decision,
                  recommendation.structured.confidence,
                  JSON.stringify(recommendation.structured.evidence),
                  JSON.stringify(recommendation.structured.risks),
                  recommendation.structured.next_review_days,
                  recommendation.structured.watch_trigger,
                  JSON.stringify(recommendation.structured.do_not_act_reasons),
                ],
              );
              advisorSuccessCount++;
            } catch (error) {
              advisorFailureCount++;
              console.error(`[ai-bot] Smart Advisor failed for ${verdict.holding_ticker}`, error);
              try {
                await pool.query(
                  `INSERT INTO advisor_recommendations
                    (watchlist_id, recommendation_text, model_used, run_id,
                    decision, confidence, evidence, risks, next_review_days,
                     watch_trigger, do_not_act_reasons, thesis_risk, generation_status, error_message)
                   SELECT id, $1, $2, $4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, $5, $6
                   FROM comparison_watchlist
                   WHERE ticker = $3
                   ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL
                   DO UPDATE SET recommendation_text = EXCLUDED.recommendation_text,
                                 model_used = EXCLUDED.model_used,
                                 generation_status = EXCLUDED.generation_status,
                                 error_message = EXCLUDED.error_message,
                                 decision = NULL,
                                 confidence = NULL,
                                 evidence = NULL,
                                 risks = NULL,
                                 next_review_days = NULL,
                                 watch_trigger = NULL,
                                 do_not_act_reasons = NULL,
                                 thesis_risk = NULL`,
                  [
                    "Recommendation could not be generated this run — see server logs for details.",
                    "error",
                    verdict.holding_ticker,
                    runId,
                    "failed",
                    error instanceof Error ? error.message : String(error),
                  ],
                );
                advisorFailures.push(`${verdict.holding_ticker}: ${error instanceof Error ? error.message : String(error)}`);
              } catch (persistenceError) {
                console.error(`[ai-bot] Could not persist Smart Advisor failure for ${verdict.holding_ticker}`, persistenceError);
              }
            }
          });

          stageCounts.smartAdvisor = { succeeded: advisorSuccessCount, failed: advisorFailureCount + skippedVerdicts.length, total: allVerdicts.length };
          stageErrors.smartAdvisor = [
            ...(stageErrors.smartAdvisor ?? []),
            ...advisorFailures,
          ];
          await persistProgress();

          // If no recommendations were generated, this is a failure
          if (advisorSuccessCount === 0 && verdicts.length > 0) {
            throw new Error(`Smart Advisor generated 0 recommendations out of ${verdicts.length} verdicts; all advisor calls failed`);
          }

          // Log partial advisor results if some failed
          if (advisorFailureCount > 0) {
            console.warn(`[ai-bot] Smart Advisor completed with partial results: ${advisorSuccessCount}/${verdicts.length} recommendations generated`);
          }

          status.stages.smartAdvisor = "completed";
        } catch (error) {
          status.stages.smartAdvisor = "failed";
          console.error("[ai-bot] Smart Advisor failed", error);
        }
      },
    });
    await pool.query(
      `UPDATE bot_runs SET status = $1, completed_at = now(), succeeded_count = $2,
       failed_count = $3, total_count = $4, stage_counts = $6::jsonb, stage_errors = $7::jsonb WHERE id = $5`,
      [summary.failed ? "partial" : "completed", summary.succeeded, summary.failed, summary.total, summary.runId, JSON.stringify(stageCounts), JSON.stringify(stageErrors)],
    );
  } catch (err) {
    status.error = err instanceof Error ? err.message : "AI Bot run failed";
    const failedStage = status.stages.priceChecker === "running"
      ? "priceChecker"
      : status.stages.chartReader === "running"
        ? "chartReader"
      : status.stages.comparisonJudge === "running"
        ? "comparisonJudge"
        : status.stages.alerts === "running"
          ? "alerts"
          : "smartAdvisor";
    status.stages[failedStage] = "failed";
    await pool.query(
      `UPDATE bot_runs SET status = 'failed', completed_at = now(),
       error_message = $1, stage_counts = $3::jsonb, stage_errors = $4::jsonb WHERE id = $2 AND status = 'running'`,
      [status.error, runId, JSON.stringify(stageCounts), JSON.stringify(stageErrors)],
    );
  } finally {
    status.running = false;
    try {
      await releaseAdvisoryLock(lockClient, BOT_LOCK_ID);
    } finally {
      lockClient.release();
    }
  }
}

router.post("/ai-bot/run", async (_req, res) => {
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await pool.connect();
    const acquired = await tryAcquireAdvisoryLock(lockClient, BOT_LOCK_ID);
    if (!acquired) {
      lockClient.release();
      res.status(409).json({ error: "AI Bot is already running. Please wait." });
      return;
    }
    const runResult = await lockClient.query<{ id: number }>(
      `INSERT INTO bot_runs (status) VALUES ('running') RETURNING id`,
    );
    const runId = Number(runResult.rows[0].id);
    void runBot(lockClient, runId).catch((err) => {
      console.error("[ai-bot] background run failed unexpectedly:", err);
    });
    res.status(202).json({ running: true, runId });
  } catch (err) {
    lockClient?.release();
    res.status(503).json({ error: "AI Bot lock unavailable. Please try again." });
  }
});

router.post("/ai-bot/retry-chart-reader", async (req, res) => {
  const rawRunId = req.query.runId;
  const runId = typeof rawRunId === "string" && /^\d+$/.test(rawRunId) ? Number(rawRunId) : null;
  const tickers = Array.isArray(req.body?.tickers)
    ? req.body.tickers.filter((ticker: unknown): ticker is string => typeof ticker === "string" && ticker.trim().length > 0)
    : [];

  if (runId === null || !Number.isSafeInteger(runId) || runId <= 0) {
    res.status(400).json({ error: "runId is required" });
    return;
  }
  if (tickers.length === 0) {
    res.status(400).json({ error: "tickers must contain at least one ticker" });
    return;
  }

  try {
    const result = await runTechnicalAnalysis(runId, tickers);
    invalidateJudgeCache(runId);
    res.json({ runId, tickers, result });
  } catch (error) {
    console.error(`[ai-bot] Chart Reader retry failed for run ${runId}`, error);
    res.status(500).json({ error: "Chart Reader retry failed" });
  }
});

router.get("/ai-bot/status", async (_req, res) => {
  if (status.running) {
    res.json(status);
    return;
  }

  try {
    await pool.query(
      `UPDATE bot_runs
       SET status = 'failed', completed_at = now(), error_message = 'API restarted while run was active'
        WHERE status = 'running'`,
    );
    const result = await pool.query<{
      id: number;
      status: string;
      started_at: string;
      completed_at: string | null;
      error_message: string | null;
      stage_counts: Record<string, StageCounts>;
      stage_errors: Record<string, string[]>;
    }>(
      `SELECT id, status, started_at, completed_at, error_message, stage_counts, stage_errors
       FROM bot_runs ORDER BY id DESC LIMIT 1`,
    );
    const latest = result.rows[0];
    if (!latest) {
      res.json(status);
      return;
    }

    if (status.runId === Number(latest.id)) {
      res.json(status);
      return;
    }

    res.json({
      running: latest.status === "running",
      runId: Number(latest.id),
      startedAt: latest.started_at,
      error: latest.error_message,
      stage_counts: latest.stage_counts ?? {},
      stage_errors: latest.stage_errors ?? {},
      chart_reader_failures: [],
      stages: {
        priceChecker: latest.status === "failed" ? "failed" : latest.status === "running" ? "running" : "completed",
        chartReader: latest.status === "failed" ? "failed" : latest.status === "running" ? "running" : "completed",
        comparisonJudge: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
        alerts: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
        smartAdvisor: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
      },
    });
  } catch (err) {
    console.error("[ai-bot] could not load persisted status:", err);
    res.json(status);
  }
});

export default router;
