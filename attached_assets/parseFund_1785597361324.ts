// Comparison Judge — Fund Page Parser
//
// CONFIRMED: FoudaLens fund pages (foudalens.com/en/fund/<CODE>) are
// server-rendered. A plain fetch() returns the real numbers directly in
// the HTML text — no headless browser needed. Verified against
// /en/fund/MUB-6203 (Beltone Real Estate) during design of this scraper.
//
// Uses cheerio for HTML parsing (npm install cheerio).

import * as cheerio from "cheerio";
import type { ScrapedSnapshot } from "./types";

const FUND_PAGE_BASE = "https://foudalens.com/en/fund/";

/**
 * Extracts the first number (with optional +/-, decimals, %) that appears
 * in the text immediately following a label. FoudaLens renders these as
 * plain text blocks, e.g. "30-Day Return\n+9.38%" — so we match on the
 * label text, then grab the nearby percentage.
 */
function extractPercentNear(fullText: string, label: string): number | null {
  const idx = fullText.indexOf(label);
  if (idx === -1) return null;
  const window = fullText.slice(idx, idx + label.length + 40);
  const match = window.match(/[-+]?\d+(\.\d+)?%/);
  if (!match) return null;
  return parseFloat(match[0].replace("%", ""));
}

function extractCagr(fullText: string): number | null {
  // FIX (bug #1 from audit): "CAGR" alone is a short, generic label with
  // real risk of matching a stray mention elsewhere on the page (e.g. in
  // explanatory prose) rather than the actual metric. Confirmed real page
  // format from earlier in this project: the Performance Score section
  // shows "CAGR +80.8%" — label directly followed by a signed percentage,
  // no separator. Unlike extractPercentNear (used for 30-Day/YTD/1-Year,
  // where the sign is optional in the regex), this specifically REQUIRES
  // a +/- sign immediately after "CAGR ", which prose referencing the
  // term generally wouldn't have — meaningfully narrows false-match risk
  // versus reusing the generic helper.
  const match = fullText.match(/CAGR\s+([-+]\d+(\.\d+)?)%/);
  if (!match) return null;
  return parseFloat(match[1]);
}

function extractPriceNear(fullText: string, label: string): number | null {
  const idx = fullText.indexOf(label);
  if (idx === -1) return null;
  // FIX (caught via Gemini audit, confirmed against real page content from
  // earlier in this project): FoudaLens renders "Unit price (NAV)\n2.0346
  // EGP" — label BEFORE value, same as extractPercentNear. This was
  // previously searching backward (idx - 60 to idx), which only works if
  // the value precedes the label — it doesn't here. Now searches forward,
  // consistent with extractPercentNear.
  const window = fullText.slice(idx, idx + label.length + 60);
  const match = window.match(/(\d+(\.\d+)?)\s*EGP/);
  if (!match) return null;
  return parseFloat(match[1]);
}

function extractScoreNear(fullText: string): number | null {
  const match = fullText.match(/(\d{1,3})\/100/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function extractRiskLevel(fullText: string): string | null {
  if (/High Risk/i.test(fullText)) return "High";
  if (/Medium Risk/i.test(fullText)) return "Medium";
  if (/Low Risk/i.test(fullText)) return "Low";
  return null;
}

/**
 * Fetches and parses one fund's FoudaLens page.
 * @param sourceCode e.g. "MUB-6203"
 * @param watchlistId the comparison_watchlist.id this snapshot belongs to
 */
export async function parseFundPage(
  sourceCode: string,
  watchlistId: number
): Promise<ScrapedSnapshot> {
  const url = `${FUND_PAGE_BASE}${sourceCode}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.error(`[parseFundPage] ${sourceCode}: HTTP ${res.status}`);
      return emptySnapshot(watchlistId);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    // Use the full visible text of the page body for label-proximity matching.
    // This is deliberately resilient to class-name changes — FoudaLens may
    // restyle the page, but the label text ("30-Day Return", "NAV") is
    // unlikely to change since it's user-facing copy.
    const bodyText = $("body").text().replace(/\s+/g, " ");

    const nav = extractPriceNear(bodyText, "Unit price (NAV)");
    const return30d = extractPercentNear(bodyText, "30-Day Return");
    const returnYtd = extractPercentNear(bodyText, "YTD Return");
    const return1y = extractPercentNear(bodyText, "1-Year Return");
    const cagr = extractCagr(bodyText);

    const score = extractScoreNear(bodyText);
    const risk = extractRiskLevel(bodyText);

    const gotAnyData = [nav, return30d, returnYtd, return1y].some(
      (v) => v !== null
    );

    if (!gotAnyData) {
      console.warn(
        `[parseFundPage] ${sourceCode}: page fetched but no expected fields found — page structure may have changed. Inspect manually.`
      );
    }

    return {
      watchlist_id: watchlistId,
      nav_or_price: nav,
      return_30d_percent: return30d,
      return_ytd_percent: returnYtd,
      return_1y_percent: return1y,
      cagr_percent: cagr,
      total_score: score,
      risk_level: risk,
      // Funds don't have P/E, dividend yield, market cap, sector rank, or a
      // buy/sell signal in the same sense stocks do — left null deliberately.
      signal: null,
      pe_ratio: null,
      dividend_yield_percent: null,
      market_cap: null,
      sector_rank: null,
      raw_fetch_ok: gotAnyData,
    };
  } catch (err) {
    console.error(`[parseFundPage] ${sourceCode}: fetch failed —`, err);
    return emptySnapshot(watchlistId);
  }
}

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
