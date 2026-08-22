export interface BotRunSummary {
  runId: number;
  succeeded: number;
  failed: number;
  total: number;
}

export interface BotPipelineDependencies {
  runPriceChecker: () => Promise<BotRunSummary>;
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
  if (summary.failed === summary.total) {
    throw new Error("Price Checker failed for every entity");
  }

  const verdicts = await dependencies.runComparisonJudge(summary.runId);
  const alerts = await dependencies.runAlerts(summary.runId);
  await dependencies.runSmartAdvisor(summary.runId, verdicts, alerts);

  return summary;
}
