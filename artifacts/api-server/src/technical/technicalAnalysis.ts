import { allPatterns, patternChain } from "candlestick";
import * as cheerio from "cheerio";
import { pool } from "../lib/dbPool";

// Role note: Chart Reader is a Gatherer. It collects candles, trend, and
// pattern evidence for the Deciders; it does not produce investment labels.

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const CHART_READER_CONCURRENCY = 6;

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
  recent_high: number | null;
  recent_low: number | null;
  range_position_percent: number | null;
  candles: Candle[];
};

type YahooChartResponse = {
  chart?: { result?: Array<{ timestamp?: number[]; meta?: { instrumentType?: string; currency?: string; longName?: string; shortName?: string }; indicators?: { quote?: Array<Record<string, Array<number | null>>> } }> };
};

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word.length >= 3));
}

function namesPlausiblyMatch(expected: string, actual: string): boolean {
  const expectedWords = normalizedWords(expected);
  const actualWords = normalizedWords(actual);
  const overlap = [...expectedWords].filter((word) => actualWords.has(word)).length;
  if (overlap >= 1 || expectedWords.size === 0 || actualWords.size === 0) return true;

  const normalizedExpected = expected.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedActual = actual.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalizedExpected || !normalizedActual) return true;

  return normalizedActual.includes(normalizedExpected.slice(0, Math.min(8, normalizedExpected.length))) ||
    normalizedExpected.includes(normalizedActual.slice(0, Math.min(8, normalizedActual.length)));
}

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

function rangeMetrics(candles: Candle[]): Pick<TechnicalSignal, "recent_high" | "recent_low" | "range_position_percent"> {
  if (candles.length < 20) {
    return { recent_high: null, recent_low: null, range_position_percent: null };
  }
  const recentCandles = candles.slice(-60);
  const recentHigh = Math.max(...recentCandles.map((candle) => candle.high));
  const recentLow = Math.min(...recentCandles.map((candle) => candle.low));
  const range = recentHigh - recentLow;
  return {
    recent_high: recentHigh,
    recent_low: recentLow,
    range_position_percent: range === 0
      ? 0
      : ((recentCandles[recentCandles.length - 1].close - recentLow) / range) * 100,
  };
}

async function fetchYahooCandles(yahooTicker: string, expectedName: string): Promise<Candle[]> {
  const response = await fetch(`${YAHOO_CHART_URL}${encodeURIComponent(yahooTicker)}?range=1y&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Yahoo chart HTTP ${response.status}`);
  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  if (meta?.instrumentType !== "EQUITY") throw new Error(`Yahoo instrument type is ${meta?.instrumentType ?? "unknown"}`);
  if (meta.currency !== "EGP") throw new Error(`Yahoo currency is ${meta.currency ?? "unknown"}`);
  const yahooName = meta.longName ?? meta.shortName ?? "";
  if (!namesPlausiblyMatch(expectedName, yahooName)) {
    console.warn(`[technical] ${yahooTicker}: Yahoo name mismatch but continuing; expected="${expectedName}", actual="${yahooName || "missing"}"`);
  }
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

function parseHistoryNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

const KNOWN_NAME_EXCEPTIONS: Record<string, string> = {
  QNBE: "QNB Egypt is the Egyptian subsidiary of Qatar National Bank Group; StockAnalysis lists it under the parent group's name.",
  CCAP: "QALAA Holdings is also listed as QALA For Financial Investments; FoudaLens independently identifies that name with EGX:CCAP.",
};

async function fetchStockAnalysisCandles(ticker: string, expectedName: string): Promise<Candle[]> {
  const headers = { "User-Agent": "Mozilla/5.0" };
  const candlesByDate = new Map<string, Candle>();
  let identityVerified = false;

  for (let page = 1; page <= 12; page++) {
    const url = `https://stockanalysis.com/quote/egx/${encodeURIComponent(ticker)}/history/${page > 1 ? `?p=${page}` : ""}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`StockAnalysis history HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    if (!identityVerified) {
      const identity = $("h1").first().text().trim();
      const nameException = KNOWN_NAME_EXCEPTIONS[ticker];
      const isIdentityGood = identity.includes(`EGX:${ticker}`) || (!!nameException && namesPlausiblyMatch(expectedName, identity));
      if (!isIdentityGood && !namesPlausiblyMatch(expectedName, identity)) {
        console.warn(`[technical] ${ticker}: StockAnalysis identity mismatch but continuing; expected="${expectedName}", actual="${identity || "missing"}"`);
      }
      if (nameException) console.warn(`[technical] ${ticker}: using documented StockAnalysis name exception: ${nameException}`);
      identityVerified = true;
    }

    let pageRows = 0;
    $("table tbody tr").each((_index, row) => {
      const cells = $(row).find("td").map((_cellIndex, cell) => $(cell).text().trim()).get();
      const date = new Date(cells[0] ?? "");
      const open = parseHistoryNumber(cells[1]);
      const high = parseHistoryNumber(cells[2]);
      const low = parseHistoryNumber(cells[3]);
      const close = parseHistoryNumber(cells[4]);
      const volume = parseHistoryNumber(cells[7]);
      if (!Number.isNaN(date.getTime()) && open !== null && high !== null && low !== null && close !== null && open > 0 && high > 0 && low > 0 && close > 0) {
        const dateKey = date.toISOString().slice(0, 10);
        candlesByDate.set(dateKey, { date: dateKey, open, high, low, close, volume });
        pageRows++;
      }
    });
    if (pageRows === 0 || candlesByDate.size >= 260) break;
  }

  return [...candlesByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function analyzeEntity(row: { id: number; ticker: string; name: string; yahoo_ticker: string }, runId: number): Promise<TechnicalSignal> {
  try {
    let candles: Candle[];
    try {
      candles = await fetchYahooCandles(row.yahoo_ticker, row.name);
      if (candles.length < 20) throw new Error("not enough OHLC history");
    } catch (yahooError) {
      console.warn(`[technical] ${row.ticker}: Yahoo unavailable, using StockAnalysis`, yahooError);
      candles = await fetchStockAnalysisCandles(row.ticker, row.name);
    }
    if (candles.length < 20) throw new Error("not enough OHLC history");
    let matches: Array<{ index: number; pattern: string }> = [];
    try {
      matches = patternChain(candles, allPatterns, {
        strict: true,
      }) as Array<{ index: number; pattern: string }>;
    } catch (patternError) {
      console.warn(`[technical] ${row.ticker}: pattern scan degraded to no-pattern fallback`, patternError);
    }
    const latestDate = candles[candles.length - 1].date;
    const recentMatches = matches.filter((match) => match.index >= candles.length - 5);
    const patterns = recentMatches.map((match) => ({ name: match.pattern, date: candles[match.index].date, direction: patternDirection(match.pattern) }));
    const trend = trendOf(candles);
    const reversalRisk = reversalRiskOf(trend, patterns);
    const range = rangeMetrics(candles);
    return {
      watchlist_id: row.id,
      run_id: runId,
      candle_date: latestDate,
      trend,
      patterns,
      confidence: patterns.length > 0 ? Math.min(1, 0.5 + patterns.length * 0.1) : null,
      raw_fetch_ok: true,
      reversal_risk: reversalRisk,
      ...range,
      candles: candles.slice(-250),
    };
  } catch (error) {
    console.warn(`[technical] ${row.yahoo_ticker}: unavailable`, error);
    return { watchlist_id: row.id, run_id: runId, candle_date: null, trend: "unknown", patterns: [], confidence: null, raw_fetch_ok: false, reversal_risk: "none", recent_high: null, recent_low: null, range_position_percent: null, candles: [] };
  }
}

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

export async function runTechnicalAnalysis(runId: number, onlyTickers?: string[]): Promise<{ succeeded: number; failed: number; total: number; failed_tickers: string[]; failure_messages: string[] }> {
  const result = await pool.query<{ id: number; ticker: string; name: string; yahoo_ticker: string | null; entity_type: string; is_held: boolean; funds_table_key: string | null }>(
    `SELECT id, ticker, name, yahoo_ticker, entity_type, is_held, funds_table_key
     FROM comparison_watchlist
    WHERE entity_type IN ('stock', 'fund', 'index')
       AND yahoo_ticker IS NOT NULL
       -- ABR is a money-market reserve whose NAV accrues yield rather than tracking market price movement; Comparison Judge's Performance, Financial Health, and Technical categories do not meaningfully apply, so it is intentionally excluded from this pipeline.
       AND COALESCE(funds_table_key, '') <> 'abr'
       AND ticker <> 'ABR'`,
  );
  const requestedTickers = onlyTickers?.length
    ? new Set(onlyTickers.map((ticker) => ticker.trim().toUpperCase()))
    : null;
  const rows = requestedTickers
    ? result.rows.filter((row) => requestedTickers.has(row.ticker.toUpperCase()))
    : result.rows;
  let succeeded = 0;
  const failedTickers: string[] = [];
  const failureMessages: string[] = [];
  await runWithConcurrency(rows, CHART_READER_CONCURRENCY, async (row) => {
    try {
      const signal = await analyzeEntity({ id: row.id, ticker: row.ticker, name: row.name, yahoo_ticker: row.yahoo_ticker! }, runId);
      await pool.query(
        `DELETE FROM technical_signals WHERE watchlist_id = $1 AND run_id = $2`,
        [signal.watchlist_id, signal.run_id],
      );
      await pool.query(
        `INSERT INTO technical_signals (watchlist_id, run_id, candle_date, trend, patterns, confidence, raw_fetch_ok, reversal_risk, recent_high, recent_low, range_position_percent, candles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [signal.watchlist_id, signal.run_id, signal.candle_date, signal.trend, JSON.stringify(signal.patterns), signal.confidence, signal.raw_fetch_ok, signal.reversal_risk, signal.recent_high, signal.recent_low, signal.range_position_percent, JSON.stringify(signal.candles)],
      );
      if (signal.raw_fetch_ok) succeeded++;
      else failedTickers.push(row.ticker);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedTickers.push(row.ticker);
      failureMessages.push(`${row.ticker}: ${message}`);
      console.error(`[technical] ${row.ticker}: could not persist signal`, error);
    }
  });
  return { succeeded, failed: rows.length - succeeded, total: rows.length, failed_tickers: failedTickers, failure_messages: failureMessages };
}
