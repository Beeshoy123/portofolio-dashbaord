export interface BotRunSummary {
  runId: number;
  succeeded: number;
  failed: number;
  total: number;
}

export interface BotPipelineDependencies {
  runPriceChecker: () => Promise<BotRunSummary>;
  runTechnicalAnalysis: (runId: number) => Promise<unknown>;
  runComparisonJudge: (runId: number) => Promise<unknown[]>;
  runAlerts: (runId: number) => Promise<unknown>;
  runSmartAdvisor: (runId: number, verdicts: unknown[], alerts: unknown) => Promise<void>;
}

/**
 * Coordinates the four engines as one bot run. Each downstream engine receives
 * the exact run ID created by Price Checker, so no stage can silently consume
 * data from another execution.
 */
export async function runBotPipeline(
  dependencies: BotPipelineDependencies,
): Promise<BotRunSummary> {
  const summary = await dependencies.runPriceChecker();

  try {
    await dependencies.runTechnicalAnalysis(summary.runId);
  } catch (error) {
    console.error("[ai-bot] Technical Analysis failed; continuing pipeline", error);
  }

  let verdicts: unknown[] = [];
  try {
    verdicts = await dependencies.runComparisonJudge(summary.runId);
  } catch (error) {
    console.error("[ai-bot] Comparison Judge failed; continuing pipeline", error);
  }

  let alerts: unknown = [[], [], null];
  try {
    alerts = await dependencies.runAlerts(summary.runId);
  } catch (error) {
    console.error("[ai-bot] Alerts failed; continuing to Smart Advisor", error);
  }

  try {
    await dependencies.runSmartAdvisor(summary.runId, verdicts, alerts);
  } catch (error) {
    console.error("[ai-bot] Smart Advisor failed; pipeline completed with partial results", error);
  }

  return summary;
}
