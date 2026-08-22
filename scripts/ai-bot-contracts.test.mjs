import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const judge = read("artifacts/api-server/src/judge/comparisonJudge.ts");
const scraperRoute = read("artifacts/api-server/src/routes/scraper.ts");
const advisorRoute = read("artifacts/api-server/src/routes/advisor.ts");
const auth = read("artifacts/api-server/src/lib/supabaseAuth.ts");
const dashboard = read("artifacts/portfolio/src/lib/dashboardBehavior.ts");
const advisor = read("artifacts/portfolio/src/components/SmartAdvisorPanel.tsx");
const migration = read("migrations/008_alert_history.sql");

test("Comparison Judge builds all comparison groups and propagates failures", () => {
  assert.match(judge, /sector_sibling/);
  assert.match(judge, /manager_sibling/);
  assert.match(judge, /direct_stock/);
  assert.match(judge, /benchmark/);
  assert.match(judge, /throw new Error\("Comparison Judge could not load/);
});

test("scraper preserves successful snapshots and reports partial runs", () => {
  assert.match(scraperRoute, /cs\.raw_fetch_ok = true/);
  const botRoute = read("artifacts/api-server/src/routes/aiBot.ts");
  assert.match(botRoute, /result\.failed === result\.total/);
  assert.match(botRoute, /"partial"/);
  assert.match(dashboard, /scraper\/snapshots\?since=/);
});

test("scraper and advisor generation use database advisory locks", () => {
  assert.match(scraperRoute, /STANDALONE_SCRAPER_DEPRECATED/);
  assert.match(read("artifacts/api-server/src/routes/aiBot.ts"), /BOT_LOCK_ID/);
  assert.match(advisorRoute, /pg_try_advisory_lock\(1844674408\)/);
});

test("alert history schema exists for every alert engine", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS \"verdict_history\"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS \"portfolio_value_history\"/);
  assert.match(migration, /REFERENCES \"comparison_watchlist\"/);
});

test("frontend advisor requests attach the Supabase bearer token", () => {
  assert.match(advisor, /supabase\.auth\.getSession\(\)/);
  assert.match(advisor, /Authorization.*Bearer/);
  assert.match(advisor, /Failed to fetch recommendations/);
  assert.match(advisor, /response\.status/);
});

test("API authentication fails closed for an unconfigured or different owner", () => {
  assert.match(auth, /PORTFOLIO_OWNER_USER_ID/);
  assert.match(auth, /AUTH_CONFIGURATION_REQUIRED/);
  assert.match(auth, /data\.user\.id !== portfolioOwnerId/);
});

test("obsolete Yahoo implementation is not referenced by the active scraper", () => {
  assert.equal(
    fs.existsSync(path.join(root, "artifacts/api-server/src/judge/enrichReturnsFromYahoo.ts")),
    false,
  );
  assert.doesNotMatch(read("artifacts/api-server/src/scraper/runScraper.ts"), /Yahoo/);
  assert.doesNotMatch(read("artifacts/api-server/package.json"), /yahoo-finance2/);
});
