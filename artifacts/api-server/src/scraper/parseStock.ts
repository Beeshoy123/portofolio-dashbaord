// Comparison Judge — Stock Page Parser (v2)
//
// ⚠️ STILL NEEDS YOUR TESTING IN REPLIT — READ BEFORE RUNNING ⚠️
//
// Three-tier attempt, cheapest/most reliable first:
//
//   1. __NEXT_DATA__ extraction — if FoudaLens is built on Next.js (their
//      URL patterns suggest it might be), the page often embeds a
//      <script id="__NEXT_DATA__"> tag containing the exact raw JSON used
//      to render the page. If present, this is faster and far more
//      reliable than parsing rendered text — no browser needed at all.
//      UNVERIFIED — I could not fetch a real stock page's raw HTML to
//      confirm this tag exists or what shape the JSON is in. The code
//      below searches for it and logs the full JSON structure to console
//      on first success so you can see the real shape and refine the
//      field paths (the `?.` chains below are guesses at likely field
//      names — e.g. `props.pageProps.stock.price` — VERIFY against the
//      logged output and adjust).
//
//   2. Optimized headless browser (Playwright, asset-blocked) — used only
//      if step 1 finds no __NEXT_DATA__ or the JSON doesn't have the
//      fields we need. Blocks images/fonts/stylesheets so each page loads
//      faster than a naive Playwright fetch would.
//
//   3. Plain fetch — kept as a last-resort attempt in case some stock
//      pages (unlike DTPP.CA, which was checked during design) turn out
//      to be server-rendered after all.
//
// npm installs needed: cheerio, playwright
// (`npx playwright install chromium` once, after npm install)

import * as cheerio from "cheerio";
import type { ScrapedSnapshot } from "./types";

const STOCK_PAGE_BASE = "https://foudalens.com/en/stock/";

function emptySnapshot(watchlistId: number): ScrapedSnapshot {
  return {
    watchlist_id: watchlistId,
    nav_or_price: null,
    return_30d_percent: null,
    return_ytd_percent: null,
    return_1y_percent: null,
    cagr_percent: null,
    total_score: null,
    risk_level: null,
    signal: null,
    pe_ratio: null,
    dividend_yield_percent: null,
    market_cap: null,
    sector_rank: null,
    raw_fetch_ok: false,
  };
}

// --- Extraction helpers for fields confirmed available via FoudaLens's
// platform FAQ (signal, P/E, dividend yield, market cap, sector rank).
// Exact label text on individual guide pages is UNCONFIRMED — these are
// best-guess patterns. Log actual matches/misses on first real run.
//
// UPDATE: a direct check of a live stock page (foudalens.com/en/stock/
// MOSC.CA) found price, Fouda Score, support/resistance levels, and
// dividend history in plain text — but no "Signal", "P/E", "Dividend
// Yield", "Market Cap", or "Rank" label anywhere on that page. The FAQ's
// mention of these is describing the /en/screener tool, not necessarily
// this page — they may only exist there (possibly client-rendered, so a
// plain fetch may not see them either), or behind the subscriber-only
// sections visible on the page ("This content is available for
// subscribers"). Expect these 5 fields to keep coming back null until
// you've confirmed where they actually live; don't spend time tuning
// these regexes further until then. --- 

function extractSignal(text: string): string | null {
  const match = text.match(
    /Signal[:\s]+(Strong Buy|Buy|Neutral|Hold|Sell|Strong Sell)/i
  );
  return match ? match[1] : null;
}

function extractPeRatio(text: string): number | null {
  const match = text.match(/P\/E[:\s]*(\d+(\.\d+)?)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractDividendYield(text: string): number | null {
  const match = text.match(/Dividend Yield[:\s]*(\d+(\.\d+)?)%/i);
  return match ? parseFloat(match[1]) : null;
}

function extractMarketCap(text: string): number | null {
  // May need B/M suffix handling once real format is confirmed.
  const match = text.match(/Market Cap[:\s]*([\d,]+(\.\d+)?)/i);
  return match ? parseFloat(match[1].replace(/,/g, "")) : null;
}

function extractSectorRank(text: string): number | null {
  const match = text.match(/(?:Sector )?Rank[:\s#]*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// ---------- Tier 1: __NEXT_DATA__ extraction ----------

interface NextDataGuess {
  price?: number | null;
  score?: number | null;
  dailyChangePercent?: number | null;
  signal?: string | null;
  peRatio?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
  sectorRank?: number | null;
}

/**
 * Digs through the __NEXT_DATA__ JSON for plausible price/score fields.
 * The exact path is UNKNOWN — this walks common Next.js conventions
 * (props.pageProps.*) and tries a few likely key names. Log the full
 * object on first real run and hand-fix this function once you see the
 * actual shape — treat this as a starting guess, not a final parser.
 */
function guessFieldsFromNextData(json: any): NextDataGuess {
  const pageProps = json?.props?.pageProps ?? {};
  // Try a handful of plausible shapes without assuming one is correct.
  const stockObj =
    pageProps.stock ?? pageProps.stockData ?? pageProps.data ?? pageProps;

  const price =
    stockObj?.price ?? stockObj?.currentPrice ?? stockObj?.lastPrice ?? null;
  const score =
    stockObj?.foudaScore ?? stockObj?.score ?? stockObj?.fouda_score ?? null;
  const dailyChangePercent =
    stockObj?.changePercent ??
    stockObj?.dailyChangePercent ??
    stockObj?.change_percent ??
    null;
  const signal =
    stockObj?.signal ?? stockObj?.tradingSignal ?? stockObj?.rating ?? null;
  const peRatio =
    stockObj?.peRatio ?? stockObj?.pe ?? stockObj?.pe_ratio ?? null;
  const dividendYield =
    stockObj?.dividendYield ??
    stockObj?.dividend_yield ??
    stockObj?.divYield ??
    null;
  const marketCap =
    stockObj?.marketCap ?? stockObj?.market_cap ?? null;
  const sectorRank =
    stockObj?.sectorRank ?? stockObj?.rank ?? stockObj?.sector_rank ?? null;

  return {
    price,
    score,
    dailyChangePercent,
    signal,
    peRatio,
    dividendYield,
    marketCap,
    sectorRank,
  };
}

async function tryNextData(
  ticker: string,
  watchlistId: number
): Promise<ScrapedSnapshot | null> {
  const url = `${STOCK_PAGE_BASE}${ticker}.CA`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);
  const scriptTag = $("script#__NEXT_DATA__").html();

  if (!scriptTag) {
    console.log(`[parseStock/nextData] ${ticker}: no __NEXT_DATA__ tag found on page`);
    return null;
  }

  let json: any;
  try {
    json = JSON.parse(scriptTag);
  } catch {
    console.warn(`[parseStock/nextData] ${ticker}: __NEXT_DATA__ tag found but not valid JSON`);
    return null;
  }

  // First successful parse: dump the shape so you can refine
  // guessFieldsFromNextData() with real field names.
  console.log(
    `[parseStock/nextData] ${ticker}: __NEXT_DATA__ found. Top-level keys: ${Object.keys(
      json?.props?.pageProps ?? {}
    ).join(", ")}`
  );

  const {
    price,
    score,
    signal,
    peRatio,
    dividendYield,
    marketCap,
    sectorRank,
  } = guessFieldsFromNextData(json);

  // BUG FIX: this used to accept the NEXT_DATA result whenever EITHER price
  // OR score resolved. Confirmed via direct fetch of a live stock page
  // (foudalens.com/en/stock/MOSC.CA) that Tier 3's plain-text patterns for
  // BOTH price ("285.19 EGP") and score ("58/100") match correctly against
  // real content — but the guessed __NEXT_DATA__ field names for price
  // (price/currentPrice/lastPrice) don't necessarily match FoudaLens's
  // actual JSON keys, while a guessed score key can coincidentally match.
  // That combination is exactly what produced snapshots with a real score
  // but nav_or_price = null for every stock, silently marked as a success.
  // Now price specifically is required before trusting this tier; anything
  // less falls through to the plain-fetch tier below, which is verified to
  // work off the real page text.
  if (price === null) {
    console.warn(
      `[parseStock/nextData] ${ticker}: __NEXT_DATA__ found but the guessed price field didn't resolve — falling through to plain fetch instead of accepting a price-less "success". Check the logged pageProps keys above and fix guessFieldsFromNextData() if you want Tier 1 to carry price too.`
    );
    return null;
  }

  // FIX (bug #3 from audit): previously, raw_fetch_ok was set to true
  // whenever price OR score was found, with no visibility into whether
  // the OTHER 5 fields (signal, P/E, dividend yield, market cap, sector
  // rank) actually extracted or silently came back null. A partial
  // extraction (e.g. price found, everything else missing) was
  // indistinguishable from a full one in the logs — this made it easy to
  // miss that guessFieldsFromNextData()'s field-name guesses were wrong
  // for most fields even when the run "succeeded". raw_fetch_ok itself
  // is unchanged (price/score alone is still a legitimate partial
  // success worth keeping), but now the gaps are visible.
  const missingFields: string[] = [];
  if (signal === null) missingFields.push("signal");
  if (peRatio === null) missingFields.push("pe_ratio");
  if (dividendYield === null) missingFields.push("dividend_yield");
  if (marketCap === null) missingFields.push("market_cap");
  if (sectorRank === null) missingFields.push("sector_rank");

  if (missingFields.length > 0) {
    console.warn(
      `[parseStock/nextData] ${ticker}: got price/score via __NEXT_DATA__, but these fields did NOT extract: ${missingFields.join(", ")} — the guessed field names in guessFieldsFromNextData() likely don't match this field. Check the logged pageProps keys above.`
    );
  }

  return {
    watchlist_id: watchlistId,
    nav_or_price: price ?? null,
    return_30d_percent: null,
    return_ytd_percent: null,
    return_1y_percent: null,
    cagr_percent: null,
    total_score: score ?? null,
    risk_level: null,
    signal: signal ?? null,
    pe_ratio: peRatio ?? null,
    dividend_yield_percent: dividendYield ?? null,
    market_cap: marketCap ?? null,
    sector_rank: sectorRank ?? null,
    raw_fetch_ok: true,
  };
}

// ---------- Tier 2: optimized Playwright (asset-blocked) ----------

async function tryOptimizedBrowser(
  ticker: string,
  watchlistId: number
): Promise<ScrapedSnapshot> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    // Block heavy, unnecessary asset types — this is the "optimization"
    // over a naive Playwright fetch: images/fonts/stylesheets add load
    // time but contain none of the data we need.
    await page.route("**/*", (route: any) => {
      const type = route.request().resourceType();
      if (["image", "font", "stylesheet", "media"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(`${STOCK_PAGE_BASE}${ticker}.CA`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });

    const bodyText: string = await page.evaluate(
      () => document.body.innerText
    );
    const normalized = bodyText.replace(/\s+/g, " ");

    const priceMatch = normalized.match(/(\d+(\.\d+)?)\s*EGP/);
    const scoreMatch = normalized.match(/(\d{1,3}(\.\d+)?)\s*\/\s*100/);

    const price = priceMatch ? parseFloat(priceMatch[1]) : null;
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    return {
      watchlist_id: watchlistId,
      nav_or_price: price,
      return_30d_percent: null,
      return_ytd_percent: null,
      return_1y_percent: null,
      cagr_percent: null,
      total_score: score,
      risk_level: null,
      signal: extractSignal(normalized),
      pe_ratio: extractPeRatio(normalized),
      dividend_yield_percent: extractDividendYield(normalized),
      market_cap: extractMarketCap(normalized),
      sector_rank: extractSectorRank(normalized),
      raw_fetch_ok: price !== null || score !== null,
    };
  } finally {
    await browser.close();
  }
}

// ---------- Tier 3: plain fetch (last resort) ----------

async function tryPlainFetch(
  ticker: string,
  watchlistId: number
): Promise<ScrapedSnapshot> {
  const url = `${STOCK_PAGE_BASE}${ticker}.CA`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!res.ok) return emptySnapshot(watchlistId);

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ");

  const priceMatch = bodyText.match(/(\d+(\.\d+)?)\s*EGP/);
  const scoreMatch = bodyText.match(/(\d{1,3}(\.\d+)?)\s*\/\s*100/);

  const price = priceMatch ? parseFloat(priceMatch[1]) : null;
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

  return {
    watchlist_id: watchlistId,
    nav_or_price: price,
    return_30d_percent: null,
    return_ytd_percent: null,
    return_1y_percent: null,
    cagr_percent: null,
    total_score: score,
    risk_level: null,
    signal: extractSignal(bodyText),
    pe_ratio: extractPeRatio(bodyText),
    dividend_yield_percent: extractDividendYield(bodyText),
    market_cap: extractMarketCap(bodyText),
    sector_rank: extractSectorRank(bodyText),
    raw_fetch_ok: price !== null || score !== null,
  };
}

// ---------- Entry point ----------

export async function parseStockPage(
  ticker: string,
  watchlistId: number
): Promise<ScrapedSnapshot> {
  try {
    // Tier 1
    let nextDataResult: ScrapedSnapshot | null = null;
    try {
      nextDataResult = await tryNextData(ticker, watchlistId);
    } catch (err) {
      console.warn(`[parseStockPage] ${ticker}: __NEXT_DATA__ tier failed, continuing to plain fetch`, err);
    }
    if (nextDataResult) {
      console.log(`[parseStockPage] ${ticker}: resolved via __NEXT_DATA__`);
      return nextDataResult;
    }

    // Tier 3 (plain fetch) is cheap — try it before paying for a browser,
    // in case this particular stock page is server-rendered after all.
    const plainResult = await tryPlainFetch(ticker, watchlistId);
    if (plainResult.raw_fetch_ok) {
      console.log(`[parseStockPage] ${ticker}: resolved via plain fetch`);
      return plainResult;
    }

    // Tier 2 (optimized browser) — the expensive, known-reliable fallback
    console.warn(
      `[parseStockPage] ${ticker}: falling back to headless browser — this is the slow path, expected on first runs until __NEXT_DATA__ field names are confirmed`
    );
    const browserResult = await tryOptimizedBrowser(ticker, watchlistId);
    return browserResult;
  } catch (err) {
    console.error(`[parseStockPage] ${ticker}: all tiers failed —`, err);
    return emptySnapshot(watchlistId);
  }
}
