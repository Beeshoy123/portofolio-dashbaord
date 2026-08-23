// Comparison Judge — Stock Fundamentals Parser (stockanalysis.com)
//
// ⚠️ NEEDS YOUR TESTING IN REPLIT — READ BEFORE RUNNING ⚠️
//
// Replaces enrichReturnsFromYahoo.ts, which was a stub: it fetched a
// current price from Yahoo's quoteSummary endpoint and then always wrote
// null for return_30d/ytd/1y (see the TODO that used to sit in that file).
// It never actually enriched anything.
//
// This fetches real fundamentals from stockanalysis.com instead, using the
// same plain ticker your comparison_watchlist.ticker column already stores
// (COMI, ETEL, TMGH, ...) — NOT the ISIN-style yahoo_ticker column from
// migration 005. Confirmed via direct fetch/search against real pages:
//   - stockanalysis.com/quote/egx/{TICKER}/            → Overview
//   - stockanalysis.com/quote/egx/{TICKER}/statistics/  → Statistics
// Both are server-rendered (plain fetch + cheerio works, verified against
// COMI, ETEL, AMOC, ARCC, HDBK) — no Playwright/browser needed for this
// site, unlike FoudaLens's stock pages.
//
// UNVERIFIED — the exact DOM structure (element classes/ids) around each
// number was not captured from raw HTML in this environment; only
// rendered/extracted text was available. The regex-over-flattened-text
// approach below (same pattern parseStock.ts already uses for FoudaLens)
// is deliberately format-driven, not selector-driven, so it should survive
// minor markup changes — but VERIFY the first real run's console output
// against the live page before trusting this in production. Log lines are
// included for exactly that purpose.
//
// npm installs needed: cheerio (already a dependency — see parseStock.ts)

import * as cheerio from "cheerio";

const BASE_URL = "https://stockanalysis.com/quote/egx/";

export interface StockFundamentals {
  watchlist_id: number;
  ticker: string;

  return_30d_percent: number | null;
  return_ytd_percent: number | null;
  return_1y_percent: number | null;

  // --- Overview page ---
  price: number | null;
  price_change_percent: number | null;
  market_cap: number | null;
  revenue_ttm: number | null;
  revenue_growth_percent: number | null;
  net_income: number | null;
  net_income_growth_percent: number | null;
  eps: number | null;
  eps_growth_percent: number | null;
  shares_out: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  dividend_yield_percent: number | null;
  dividend_per_share: number | null;
  ex_dividend_date: string | null;
  volume: number | null;
  week52_low: number | null;
  week52_high: number | null;
  beta: number | null;
  analyst_rating: string | null;
  price_target: number | null;
  price_target_upside_percent: number | null;
  earnings_date: string | null;

  // --- Statistics page ---
  debt_to_equity: number | null;
  current_ratio: number | null;
  roe_percent: number | null;
  roic_percent: number | null;
  cash_on_hand: number | null;
  total_debt: number | null;
  net_cash_position: number | null;
  operating_cash_flow: number | null;
  capex: number | null;
  free_cash_flow: number | null;
  gross_margin_percent: number | null;
  operating_margin_percent: number | null;
  net_margin_percent: number | null;
  ev_to_ebitda: number | null;
  ev_to_fcf: number | null;
  shares_change_percent: number | null;

  raw_fetch_ok: boolean;
}

function emptyFundamentals(
  watchlistId: number,
  ticker: string
): StockFundamentals {
  return {
    watchlist_id: watchlistId,
    ticker,
    return_30d_percent: null,
    return_ytd_percent: null,
    return_1y_percent: null,
    price: null,
    price_change_percent: null,
    market_cap: null,
    revenue_ttm: null,
    revenue_growth_percent: null,
    net_income: null,
    net_income_growth_percent: null,
    eps: null,
    eps_growth_percent: null,
    shares_out: null,
    pe_ratio: null,
    forward_pe: null,
    dividend_yield_percent: null,
    dividend_per_share: null,
    ex_dividend_date: null,
    volume: null,
    week52_low: null,
    week52_high: null,
    beta: null,
    analyst_rating: null,
    price_target: null,
    price_target_upside_percent: null,
    earnings_date: null,
    debt_to_equity: null,
    current_ratio: null,
    roe_percent: null,
    roic_percent: null,
    cash_on_hand: null,
    total_debt: null,
    net_cash_position: null,
    operating_cash_flow: null,
    capex: null,
    free_cash_flow: null,
    gross_margin_percent: null,
    operating_margin_percent: null,
    net_margin_percent: null,
    ev_to_ebitda: null,
    ev_to_fcf: null,
    shares_change_percent: null,
    raw_fetch_ok: false,
  };
}

interface HistoricalClose {
  date: Date;
  close: number;
}

function percentageChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function extractChartReferencePrice(html: string, key: "price1m" | "priceYTD" | "price1y"): number | null {
  const match = html.match(new RegExp(`changes:\\{[^}]*${key}:([^,}]+)`, "i"));
  return match ? parsePlainNumber(match[1]) : null;
}

async function fetchHistory(ticker: string): Promise<Partial<StockFundamentals>> {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    };
    const closes: HistoricalClose[] = [];
    const oldestRequiredDate = new Date();
    oldestRequiredDate.setUTCFullYear(oldestRequiredDate.getUTCFullYear() - 1);

    // StockAnalysis paginates history at roughly 50 rows per page. Fetch only
    // as many pages as needed to cover the one-year comparison window.
    for (let page = 1; page <= 12; page++) {
      const url = `${BASE_URL}${ticker}/history/${page > 1 ? `?p=${page}` : ""}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) break;

      const html = await res.text();
      const $ = cheerio.load(html);
      let pageRows = 0;
      $("table tbody tr").each((_index, row) => {
        const cells = $(row)
          .find("td")
          .map((_cellIndex, cell) => $(cell).text().trim())
          .get();
        const date = new Date(cells[0] ?? "");
        const close = parsePlainNumber(cells[4]);
        if (!Number.isNaN(date.getTime()) && close !== null) {
          closes.push({ date, close });
          pageRows++;
        }
      });

      const oldestOnPage = closes[closes.length - 1]?.date;
      if (pageRows === 0 || (oldestOnPage && oldestOnPage <= oldestRequiredDate)) break;
    }

    if (closes.length === 0) return {};
    closes.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = closes[0];
    const closeOnOrBefore = (target: Date): number | null =>
      closes.find((entry) => entry.date.getTime() <= target.getTime())?.close ?? null;
    const thirtyDaysAgo = new Date(latest.date);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const yearStart = new Date(Date.UTC(latest.date.getUTCFullYear(), 0, 1));
    const oneYearAgo = new Date(latest.date);
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

    return {
      return_30d_percent: percentageChange(latest.close, closeOnOrBefore(thirtyDaysAgo)),
      return_ytd_percent: percentageChange(latest.close, closeOnOrBefore(yearStart)),
      return_1y_percent: percentageChange(latest.close, closeOnOrBefore(oneYearAgo)),
    };
  } catch (error) {
    console.warn(`[parseStockAnalysis/history] ${ticker}: request failed`, error);
    return {};
  }
}

// --- Number parsing helpers ---
// stockanalysis.com renders large numbers with B/M/K suffixes (e.g.
// "474.23B", "139.17B") and shows "--" or "n/a" for missing fields.

function parseSuffixedNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "--" || cleaned === "—" || cleaned === "" || /n\/?a/i.test(cleaned)) return null;

  const match = cleaned.match(/^-?\d+(\.\d+)?([BMK])?$/i);
  if (!match) return null;

  const value = parseFloat(cleaned);
  const suffix = match[2]?.toUpperCase();
  if (suffix === "B") return value * 1_000_000_000;
  if (suffix === "M") return value * 1_000_000;
  if (suffix === "K") return value * 1_000;
  return value;
}

function parsePlainNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "--" || cleaned === "—" || cleaned === "" || /n\/?a/i.test(cleaned)) return null;
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parsePercent(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[+,%]/g, "");
  if (cleaned === "--" || cleaned === "—" || cleaned === "" || /n\/?a/i.test(cleaned)) return null;
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Extracts a "Label ... value" pair from flattened page text.
 * stockanalysis.com's overview page lays fields out as label/value pairs
 * in a grid — once cheerio strips tags and normalizes whitespace, the
 * label and its value end up adjacent in the text stream. This is the
 * same "flatten then regex" approach parseStock.ts already uses for
 * FoudaLens, kept deliberately loose so small markup changes don't break
 * it — but this is a text-adjacency GUESS, not a confirmed DOM path.
 * VERIFY against the first real run's logged raw text.
 */
function extractLabeled(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The page text is flattened to single spaces, so do not depend on
  // repeated whitespace to separate a label from its value. Capture only
  // the next scalar token; this prevents a missing field from consuming the
  // next metric's label/value pair.
  const match = text.match(
    new RegExp(`${escaped}\\s*:?\\s*(--|—|n\\/?a|[-+]?\\d[\\d,.]*(?:\\.\\d+)?%?(?:[BMK])?)`, "i")
  );
  return match?.[1]?.trim() ?? null;
}

function extractLabeledAny(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const value = extractLabeled(text, label);
    if (value !== null) return value;
  }
  return null;
}

function extractPeRatio(text: string): string | null {
  const match = text.match(
    /(?<!Forward )(?:P\/E Ratio|PE Ratio|P\/E|PE)\s*:?\s*(--|—|n\/?a|[-+]?\d[\d,.]*(?:\.\d+)?%?(?:[BMK])?)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function extractPercentageAfter(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

// ---------- Overview page ----------

async function fetchOverview(ticker: string): Promise<Partial<StockFundamentals> | null> {
  const url = `${BASE_URL}${ticker}/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
      signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.error(`[parseStockAnalysis/overview] ${ticker}: HTTP ${res.status}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ");

  console.log(`[parseStockAnalysis/overview] ${ticker}: fetched ${text.length} chars.`);

  const priceMatch = text.match(/([\d,]+\.\d+)\s*[-+]\s*[\d.]+\s*\(([-+]?[\d.]+)%\)/);
  const price = priceMatch ? parsePlainNumber(priceMatch[1]) : null;
  const price_change_percent = priceMatch ? parsePercent(priceMatch[2]) : null;
  const chart30d = extractChartReferencePrice(html, "price1m");
  const chartYtd = extractChartReferencePrice(html, "priceYTD");
  const chart1y = extractChartReferencePrice(html, "price1y");

  const result: Partial<StockFundamentals> = {
    price,
    price_change_percent,
    return_30d_percent: price !== null ? percentageChange(price, chart30d) : null,
    return_ytd_percent: price !== null ? percentageChange(price, chartYtd) : null,
    return_1y_percent: price !== null ? percentageChange(price, chart1y) : null,
    market_cap: parseSuffixedNumber(extractLabeled(text, "Market Cap")),
    revenue_ttm: parseSuffixedNumber(extractLabeled(text, "Revenue")),
    revenue_growth_percent: parsePercent(
      extractPercentageAfter(text, /Revenue\s*\(ttm\)\s*[-+]?\d[\d,.]*(?:\.\d+)?[BMK]?\s*([-+]?\d[\d,.]*(?:\.\d+)?%)/i)
        ?? extractLabeledAny(text, ["Revenue Growth", "Revenue growth"]),
    ),
    net_income: parseSuffixedNumber(extractLabeled(text, "Net Income")),
    net_income_growth_percent: parsePercent(extractLabeled(text, "Net Income Growth")),
    eps: parsePlainNumber(extractLabeled(text, "EPS")),
    eps_growth_percent: parsePercent(extractLabeled(text, "EPS Growth")),
    shares_out: parseSuffixedNumber(extractLabeled(text, "Shares Outstanding")),
    pe_ratio: parsePlainNumber(extractPeRatio(text)),
    forward_pe: parsePlainNumber(extractLabeledAny(text, ["Forward P/E", "Forward PE"])),
    dividend_yield_percent: parsePercent(extractLabeledAny(text, ["Dividend Yield", "Dividend yield"])),
    dividend_per_share: parsePlainNumber(extractLabeled(text, "Dividend Per Share")),
    ex_dividend_date: extractLabeled(text, "Ex-Dividend Date"),
    volume: parseSuffixedNumber(extractLabeled(text, "Volume")),
    beta: parsePlainNumber(extractLabeled(text, "Beta")),
    analyst_rating: extractLabeled(text, "Analyst Rating"),
    price_target: parsePlainNumber(extractLabeled(text, "Price Target")),
    price_target_upside_percent: parsePercent(extractLabeled(text, "Upside")),
    earnings_date: extractLabeled(text, "Earnings Date"),
  };

  const week52 = parseWeek52Range(text);
  result.week52_low = week52.week52_low;
  result.week52_high = week52.week52_high;

  const coreFields = [
    result.price,
    result.market_cap,
    result.revenue_ttm,
    result.eps,
    result.pe_ratio,
  ];
  if (coreFields.every((f) => f === null)) {
    console.warn(`[parseStockAnalysis/overview] ${ticker}: core fields missing after parse — check extractLabeled() patterns above`);
  }

  return result;
}

function parseWeek52Range(
  text: string
): { week52_low: number | null; week52_high: number | null } {
  const match = text.match(/52 Week Range\s*:?\s*([\d,]+\.?\d*)\s*[-–]\s*([\d,]+\.?\d*)/i);
  if (!match) return { week52_low: null, week52_high: null };
  return {
    week52_low: parsePlainNumber(match[1]),
    week52_high: parsePlainNumber(match[2]),
  };
}

// ---------- Statistics page ----------

async function fetchStatistics(ticker: string): Promise<Partial<StockFundamentals> | null> {
  const url = `${BASE_URL}${ticker}/statistics/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.warn(`[parseStockAnalysis/statistics] ${ticker}: HTTP ${res.status} — fundamentals fetch failed`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ");

  console.log(`[parseStockAnalysis/statistics] ${ticker}: fetched ${text.length} chars.`);

  const dividendYield = extractPercentageAfter(text, /dividend\s+yield\s+of\s+([-+]?\d[\d,.]*(?:\.\d+)?%)/i)
    ?? extractLabeledAny(text, ["Dividend Yield", "Dividend yield"]);
  const revenueGrowth = extractLabeledAny(text, ["Revenue Growth Forecast (3Y)", "Revenue Growth"]);

  const result: Partial<StockFundamentals> = {
    ...(dividendYield !== null ? { dividend_yield_percent: parsePercent(dividendYield) } : {}),
    ...(revenueGrowth !== null ? { revenue_growth_percent: parsePercent(revenueGrowth) } : {}),
    debt_to_equity: parsePlainNumber(extractLabeledAny(text, ["Debt to Equity", "Debt / Equity", "Debt/Equity"])),
    current_ratio: parsePlainNumber(extractLabeled(text, "Current Ratio")),
    roe_percent: parsePercent(extractLabeledAny(text, ["Return on Equity (ROE)", "Return on Equity", "ROE"])),
    roic_percent: parsePercent(extractLabeled(text, "ROIC")),
    cash_on_hand: parseSuffixedNumber(extractLabeled(text, "Cash")),
    total_debt: parseSuffixedNumber(extractLabeled(text, "Total Debt")),
    operating_cash_flow: parseSuffixedNumber(extractLabeled(text, "Operating Cash Flow")),
    capex: parseSuffixedNumber(extractLabeled(text, "CapEx")),
    free_cash_flow: parseSuffixedNumber(extractLabeled(text, "Free Cash Flow")),
    gross_margin_percent: parsePercent(extractLabeled(text, "Gross Margin")),
    operating_margin_percent: parsePercent(extractLabeled(text, "Operating Margin")),
    net_margin_percent: parsePercent(extractLabeled(text, "Net Margin")),
    ev_to_ebitda: parsePlainNumber(extractLabeled(text, "EV/EBITDA")),
    ev_to_fcf: parsePlainNumber(extractLabeled(text, "EV/FCF")),
    shares_change_percent: parsePercent(extractLabeled(text, "Share Change")),
  };

  // Compute net cash position: cash - debt
  if (result.cash_on_hand !== null && result.total_debt !== null) {
    result.net_cash_position = result.cash_on_hand - result.total_debt;
  }

  return result;
}

// ---------- Entry point ----------

/**
 * Fetches both Overview and Statistics pages for one ticker.
 * Two requests per stock (not per data point) — see chat discussion:
 * ~35 stocks × 2 requests = ~70 requests total for a full run, not 35×35.
 */
export async function parseStockAnalysis(
  ticker: string,
  watchlistId: number
): Promise<StockFundamentals> {
  const [overview, stats] = await Promise.all([
    fetchOverview(ticker),
    fetchStatistics(ticker),
  ]);

  if (!overview) {
    return emptyFundamentals(watchlistId, ticker);
  }

  // The overview chart normally contains all required return periods. Only
  // crawl paginated history when a chart reference is missing, avoiding up to
  // twelve extra sequential requests for every stock on a normal run.
  const needsHistory = overview.return_30d_percent === null
    || overview.return_ytd_percent === null
    || overview.return_1y_percent === null;
  const history = needsHistory ? await fetchHistory(ticker) : {};

  const result = emptyFundamentals(watchlistId, ticker);

  // Merge overview and stats
  const merged = { ...result, ...history, ...overview, ...stats };

  // Verify raw_fetch_ok: true only if both pages fetched successfully
  merged.raw_fetch_ok = overview !== null && stats !== null && stats !== undefined;

  return merged as StockFundamentals;
}
