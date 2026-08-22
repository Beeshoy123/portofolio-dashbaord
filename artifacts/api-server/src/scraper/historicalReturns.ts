import type { ScrapedSnapshot } from "./types";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

export interface HistoricalReturns {
  return_30d_percent: number | null;
  return_ytd_percent: number | null;
  return_1y_percent: number | null;
}

function findCloseOnOrBefore(
  timestamps: number[],
  closes: Array<number | null>,
  targetTimestamp: number,
): number | null {
  let selected: number | null = null;
  for (let index = 0; index < timestamps.length; index++) {
    const close = closes[index];
    if (timestamps[index] <= targetTimestamp && close !== null && Number.isFinite(close)) {
      selected = close;
    }
  }
  return selected;
}

function percentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function fetchHistoricalReturns(yahooTicker: string): Promise<HistoricalReturns> {
  const empty: HistoricalReturns = {
    return_30d_percent: null,
    return_ytd_percent: null,
    return_1y_percent: null,
  };

  try {
    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    const rangeStart = Math.floor(oneYearAgo.getTime() / 1000) - 45 * 24 * 60 * 60;
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}`);
    url.searchParams.set("period1", String(rangeStart));
    url.searchParams.set("period2", String(now));
    url.searchParams.set("interval", "1d");
    url.searchParams.set("events", "history");

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Node.js Scraper)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.warn(`[historicalReturns] ${yahooTicker}: HTTP ${response.status}`);
      return empty;
    }

    const payload = (await response.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const current = [...closes].reverse().find((close) => close !== null && Number.isFinite(close)) ?? null;
    if (current === null || timestamps.length === 0) return empty;

    const nowDate = new Date();
    const thirtyDaysAgo = new Date(nowDate);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const yearStart = new Date(Date.UTC(nowDate.getUTCFullYear(), 0, 1));
    const previousYear = new Date(nowDate);
    previousYear.setUTCFullYear(previousYear.getUTCFullYear() - 1);

    return {
      return_30d_percent: percentageChange(current, findCloseOnOrBefore(timestamps, closes, Math.floor(thirtyDaysAgo.getTime() / 1000))),
      return_ytd_percent: percentageChange(current, findCloseOnOrBefore(timestamps, closes, Math.floor(yearStart.getTime() / 1000))),
      return_1y_percent: percentageChange(current, findCloseOnOrBefore(timestamps, closes, Math.floor(previousYear.getTime() / 1000))),
    };
  } catch (error) {
    console.warn(`[historicalReturns] ${yahooTicker}: request failed`, error);
    return empty;
  }
}

export async function enrichHistoricalReturns(
  snapshot: ScrapedSnapshot,
  yahooTicker: string | null,
): Promise<ScrapedSnapshot> {
  if (!yahooTicker) return snapshot;
  const returns = await fetchHistoricalReturns(yahooTicker);
  return {
    ...snapshot,
    return_30d_percent: returns.return_30d_percent ?? snapshot.return_30d_percent,
    return_ytd_percent: returns.return_ytd_percent ?? snapshot.return_ytd_percent,
    return_1y_percent: returns.return_1y_percent ?? snapshot.return_1y_percent,
  };
}
