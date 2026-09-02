import { allPatterns, patternChain } from "candlestick";
import { pool } from "../lib/dbPool";

// Role note: Chart Reader is a Gatherer. It collects candles, trend, and
// pattern evidence for the Deciders; it does not produce investment labels.

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number | null };
type TechnicalSignal = {
  watchlist_id: number;
  run_id: number;
  candle_date: string | null;
  trend: "uptrend" | "downtrend" | "sideways" | "unknown";
  patterns: Array<{ name: string; date: string; direction: "bullish" | "bearish" | "neutral" }>;
  confidence: number | null;
  raw_fetch_ok: boolean;
  reversal_risk: "none" | "watch" | "elevated";
  candles: Candle[];
};

type YahooChartResponse = {
  chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<Record<string, Array<number | null>>> } }> };
};

function trendOf(candles: Candle[]): TechnicalSignal["trend"] {
  if (candles.length < 20) return "unknown";
  const recent = candles.slice(-10).reduce((sum, candle) => sum + candle.close, 0) / 10;
  const prior = candles.slice(-20, -10).reduce((sum, candle) => sum + candle.close, 0) / 10;
  const change = (recent - prior) / prior;
  return change > 0.02 ? "uptrend" : change < -0.02 ? "downtrend" : "sideways";
}

function patternDirection(name: string): "bullish" | "bearish" | "neutral" {
  const normalized = name.toLowerCase();
  if (normalized.includes("bullish") || normalized.includes("hammer") || normalized.includes("morning") || normalized.includes("soldiers") || normalized.includes("piercing")) return "bullish";
  if (normalized.includes("bearish") || normalized.includes("hanging") || normalized.includes("shooting") || normalized.includes("evening") || normalized.includes("crows") || normalized.includes("dark")) return "bearish";
  return "neutral";
}

function reversalRiskOf(
  trend: TechnicalSignal["trend"],
  patterns: TechnicalSignal["patterns"]
): "none" | "watch" | "elevated" {
  if (trend !== "uptrend") return "none";
  const hasBearish = patterns.some((p) => p.direction === "bearish");
  const hasNeutral = patterns.some((p) => p.direction === "neutral");
  if (hasBearish) return "elevated";
  if (hasNeutral) return "watch";
  return "none";
}

async function fetchCandles(yahooTicker: string): Promise<Candle[]> {
  const response = await fetch(`${YAHOO_CHART_URL}${encodeURIComponent(yahooTicker)}?range=1y&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Yahoo chart HTTP ${response.status}`);
  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];
  return timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index] ?? 0,
    high: quote.high?.[index] ?? 0,
    low: quote.low?.[index] ?? 0,
    close: quote.close?.[index] ?? 0,
    volume: quote.volume?.[index] ?? null,
  })).filter((candle) => candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0);
}

async function analyzeEntity(row: { id: number; yahoo_ticker: string }, runId: number): Promise<TechnicalSignal> {
  try {
    const candles = await fetchCandles(row.yahoo_ticker);
    if (candles.length < 20) throw new Error("not enough OHLC history");
    const matches = patternChain(candles, allPatterns, {
      strict: true,
    }) as Array<{ index: number; pattern: string }>;
    const latestDate = candles[candles.length - 1].date;
    const recentMatches = matches.filter((match) => match.index >= candles.length - 5);
    const patterns = recentMatches.map((match) => ({ name: match.pattern, date: candles[match.index].date, direction: patternDirection(match.pattern) }));
    const trend = trendOf(candles);
    const reversalRisk = reversalRiskOf(trend, patterns);
    return {
      watchlist_id: row.id,
      run_id: runId,
      candle_date: latestDate,
      trend,
      patterns,
      confidence: patterns.length > 0 ? Math.min(1, 0.5 + patterns.length * 0.1) : null,
      raw_fetch_ok: true,
      reversal_risk: reversalRisk,
      candles: candles.slice(-60),
    };
  } catch (error) {
    console.warn(`[technical] ${row.yahoo_ticker}: unavailable`, error);
    return { watchlist_id: row.id, run_id: runId, candle_date: null, trend: "unknown", patterns: [], confidence: null, raw_fetch_ok: false, reversal_risk: "none", candles: [] };
  }
}

export async function runTechnicalAnalysis(runId: number): Promise<{ succeeded: number; failed: number; total: number }> {
  const result = await pool.query<{ id: number; ticker: string; yahoo_ticker: string | null; entity_type: string; is_held: boolean; funds_table_key: string | null }>(
    `SELECT id, ticker, yahoo_ticker, entity_type, is_held, funds_table_key
     FROM comparison_watchlist
     WHERE entity_type IN ('stock', 'fund')
       AND yahoo_ticker IS NOT NULL
       AND COALESCE(funds_table_key, '') <> 'abr'
       AND ticker <> 'ABR'`,
  );
  let succeeded = 0;
  for (const row of result.rows) {
    const signal = await analyzeEntity({ id: row.id, yahoo_ticker: row.yahoo_ticker! }, runId);
    await pool.query(
      `INSERT INTO technical_signals (watchlist_id, run_id, candle_date, trend, patterns, confidence, raw_fetch_ok, reversal_risk, candles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (watchlist_id, run_id) DO UPDATE SET candle_date = EXCLUDED.candle_date, trend = EXCLUDED.trend, patterns = EXCLUDED.patterns, confidence = EXCLUDED.confidence, raw_fetch_ok = EXCLUDED.raw_fetch_ok, reversal_risk = EXCLUDED.reversal_risk, candles = EXCLUDED.candles`,
      [signal.watchlist_id, signal.run_id, signal.candle_date, signal.trend, JSON.stringify(signal.patterns), signal.confidence, signal.raw_fetch_ok, signal.reversal_risk, JSON.stringify(signal.candles)],
    );
    if (signal.raw_fetch_ok) succeeded++;
  }
  return { succeeded, failed: result.rows.length - succeeded, total: result.rows.length };
}
