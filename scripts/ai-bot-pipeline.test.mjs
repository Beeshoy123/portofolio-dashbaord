import assert from "node:assert/strict";
import test from "node:test";
import { runBotPipeline } from "../artifacts/api-server/src/aiBot/pipeline.ts";

test("AI Bot runs Price Checker, Judge, Alerts, and Advisor with one run ID", async () => {
  const calls = [];
  const runId = 42;
  const verdicts = [{ holding_ticker: "BRE" }];
  const alerts = { timeStops: [], theses: [], drawdown: null };

  const summary = await runBotPipeline({
    runPriceChecker: async () => {
      calls.push(["priceChecker", runId]);
      return { runId, succeeded: 3, failed: 0, total: 3 };
    },
    runComparisonJudge: async (receivedRunId) => {
      calls.push(["comparisonJudge", receivedRunId]);
      return verdicts;
    },
    runAlerts: async (receivedRunId) => {
      calls.push(["alerts", receivedRunId]);
      return alerts;
    },
    runSmartAdvisor: async (receivedRunId, receivedVerdicts, receivedAlerts) => {
      calls.push(["smartAdvisor", receivedRunId, receivedVerdicts, receivedAlerts]);
    },
  });

  assert.deepEqual(summary, { runId, succeeded: 3, failed: 0, total: 3 });
  assert.deepEqual(calls.map(([stage]) => stage), [
    "priceChecker",
    "comparisonJudge",
    "alerts",
    "smartAdvisor",
  ]);
  assert.deepEqual(calls.map(([, receivedRunId]) => receivedRunId), [runId, runId, runId, runId]);
  assert.deepEqual(calls[3][2], verdicts);
  assert.deepEqual(calls[3][3], alerts);
});

test("AI Bot stops before Judge, Alerts, and Advisor when every price fetch fails", async () => {
  const calls = [];

  await assert.rejects(
    runBotPipeline({
      runPriceChecker: async () => {
        calls.push("priceChecker");
        return { runId: 99, succeeded: 0, failed: 2, total: 2 };
      },
      runComparisonJudge: async () => {
        calls.push("comparisonJudge");
        return [];
      },
      runAlerts: async () => {
        calls.push("alerts");
        return {};
      },
      runSmartAdvisor: async () => {
        calls.push("smartAdvisor");
      },
    }),
    /Price Checker failed for every entity/,
  );

  assert.deepEqual(calls, ["priceChecker"]);
});
