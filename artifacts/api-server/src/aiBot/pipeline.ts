export interface BotRunSummary {
  runId: number;
  succeeded: number;
  failed: number;
  total: number;
}

export interface BotPipelineDependencies {
  runPriceChecker: () => Promise<BotRunSummary>;
  runChartReader?: (runId: number) => Promise<unknown>;
  runComparisonJudge?: (runId: number) => Promise<unknown[]>;
  runAlerts?: (runId: number) => Promise<unknown>;
  runSmartAdvisor?: (runId: number, verdicts: unknown[], alerts: unknown) => Promise<void>;
}

/**
 * Naming convention from multi-factor-grid-plan.md:
 * Gatherers (Price Checker and Chart Reader) collect raw market data.
 * Deciders (Comparison Judge and Opportunity Scanner) consume that data to
 * compare, grade, and surface opportunities. Gatherers must not make
 * investment judgments or silently drop fields before the Deciders receive them.
 */
/**
 * Coordinates the five engines as one bot run. Each downstream engine receives
 * the exact run ID created by Price Checker, so no stage can silently consume
 * data from another execution.
 */
export async function runBotPipeline(
  dependencies: BotPipelineDependencies,
): Promise<BotRunSummary> {
  const summary = await dependencies.runPriceChecker();

  // Stop pipeline if Price Checker failed for every entity
  if (summary.succeeded === 0 && summary.total > 0) {
    throw new Error("Price Checker failed for every entity");
  }

  let downstreamFailureCount = 0;

  if (typeof dependencies.runChartReader === "function") {
    try {
      await dependencies.runChartReader(summary.runId);
    } catch (error) {
      downstreamFailureCount += 1;
      console.error("[ai-bot] Technical Analysis failed; continuing pipeline", error);
    }
  }

  let verdicts: unknown[] = [];
  if (typeof dependencies.runComparisonJudge === "function") {
    try {
      verdicts = await dependencies.runComparisonJudge(summary.runId);
    } catch (error) {
      downstreamFailureCount += 1;
      console.error("[ai-bot] Comparison Judge failed; continuing pipeline", error);
    }
  }

  let alerts: unknown = [[], [], null];
  if (typeof dependencies.runAlerts === "function") {
    try {
      alerts = await dependencies.runAlerts(summary.runId);
    } catch (error) {
      downstreamFailureCount += 1;
      console.error("[ai-bot] Alerts failed; continuing to Smart Advisor", error);
    }
  }

  if (typeof dependencies.runSmartAdvisor === "function") {
    try {
      await dependencies.runSmartAdvisor(summary.runId, verdicts, alerts);
    } catch (error) {
      downstreamFailureCount += 1;
      console.error("[ai-bot] Smart Advisor failed; pipeline completed with partial results", error);
    }
  }

  if (downstreamFailureCount > 0) {
    summary.failed = Math.max(summary.failed, 1);
  }

  return summary;
}
