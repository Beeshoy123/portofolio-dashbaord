import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { parseFundPage } from "../artifacts/api-server/src/scraper/parseFund.ts";
import { parseIndexPage } from "../artifacts/api-server/src/scraper/parseIndex.ts";
import { calculateDrawdown } from "../artifacts/api-server/src/judge/drawdown.ts";

const fixture = async (name) => fs.readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function mockFetch(body) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(body, { status: 200 });
  return () => { globalThis.fetch = original; };
}

test("fund parser extracts NAV, returns, score, and risk from a fixture", async () => {
  const restore = mockFetch(await fixture("fund-page.html"));
  try {
    const snapshot = await parseFundPage("MUB-6203", 17);
    assert.deepEqual(snapshot, {
      watchlist_id: 17,
      nav_or_price: 2.028,
      return_30d_percent: 11.79,
      return_ytd_percent: -3.25,
      return_1y_percent: 24.5,
      cagr_percent: 19.1,
      total_score: 61,
      risk_level: "Medium",
      signal: null,
      pe_ratio: null,
      dividend_yield_percent: null,
      market_cap: null,
      sector_rank: null,
      raw_fetch_ok: true,
    });
  } finally {
    restore();
  }
});

test("index parser extracts levels after digit-bearing labels", async () => {
  const restore = mockFetch(await fixture("indices-page.html"));
  try {
    const snapshots = await parseIndexPage([
      { watchlistId: 1, label: "EGX30" },
      { watchlistId: 2, label: "EGX70 EWI" },
      { watchlistId: 3, label: "EGX100 EWI" },
    ]);
    assert.deepEqual(snapshots.map((snapshot) => snapshot.nav_or_price), [53627.32, 7812.4, 11204.75]);
  } finally {
    restore();
  }
});

test("drawdown calculation tracks peak, current, and maximum decline", () => {
  const result = calculateDrawdown([
    { total_market_value: 100, recorded_at: "2026-01-01T00:00:00Z" },
    { total_market_value: 130, recorded_at: "2026-01-02T00:00:00Z" },
    { total_market_value: 104, recorded_at: "2026-01-03T00:00:00Z" },
    { total_market_value: 120, recorded_at: "2026-01-04T00:00:00Z" },
  ]);
  assert.equal(result.peak_value, 130);
  assert.equal(result.current_value, 120);
  assert.equal(result.current_drawdown_percent, (10 / 130) * 100);
  assert.equal(result.max_drawdown_percent, 20);
  assert.equal(result.has_enough_history, true);
});
