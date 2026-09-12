import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseEntity } from "../artifacts/api-server/src/routes/diagnosticLogic.ts";

const completeRow = {
  id: 1,
  ticker: "TEST",
  name: "Test entity",
  entity_type: "stock",
  is_held: true,
  snapshot_id: 1,
  snapshot_raw_fetch_ok: true,
  snapshot_value: "10",
  technical_id: 1,
  technical_raw_fetch_ok: true,
  technical_trend: "sideways",
  verdict_id: 1,
  raw_verdict: {
    signal: "Solid",
    performance_grade: "Mixed",
    technical_grade: "Neutral",
    financial_health_grade: "Neutral",
    holding_return_percent: 2,
    coverage_percent: 100,
    holding_current_value_egp: 1000,
  },
  advisor_id: 1,
  advisor_status: "succeeded",
  advisor_text: "Review periodically",
};

test("diagnostic classifier marks complete entities", () => {
  const result = diagnoseEntity(completeRow, []);
  assert.equal(result.state, "complete");
  assert.deepEqual(result.missing_fields, []);
  assert.deepEqual(result.dash_fields, []);
});

test("diagnostic classifier preserves exact fallback messages", () => {
  const result = diagnoseEntity({ ...completeRow, technical_id: null }, [
    "TEST: Yahoo unavailable; used StockAnalysis fallback",
  ]);
  assert.equal(result.state, "partial");
  assert.equal(result.reason, "TEST: Yahoo unavailable; used StockAnalysis fallback");
  assert.deepEqual(result.diagnostic_messages, ["TEST: Yahoo unavailable; used StockAnalysis fallback"]);
});

test("diagnostic classifier distinguishes missing and dash states", () => {
  const missing = diagnoseEntity({
    ...completeRow,
    snapshot_id: null,
    technical_id: null,
    verdict_id: null,
    advisor_id: null,
  }, []);
  assert.equal(missing.state, "missing");

  const dash = diagnoseEntity({ ...completeRow, snapshot_value: null }, []);
  assert.equal(dash.state, "dash");
  assert.deepEqual(dash.dash_fields, ["snapshot.nav_or_price"]);
});
