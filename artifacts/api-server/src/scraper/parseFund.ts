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
  if (idx === -1) {
    console.warn(`[parseFundPage] label "${label}" not found on page at all — check for a wording/encoding change`);
    return null;
  }

  // Confirmed via direct fetch of a live fund page: real order is
  // label-then-value ("30-Day Return" ... "+11.79%"). Widened window
  // (was 40) to tolerate any icon/tooltip markup between them, and the
  // sign is now required (not optional) so we don't accidentally grab
  // an unrelated bare percentage from surrounding copy.
  const after = fullText.slice(idx, idx + label.length + 80);
  const afterMatch = after.match(/[-+]\d+(\.\d+)?%/);
  if (afterMatch) return parseFloat(afterMatch[0].replace("%", ""));

  // Defensive fallback in case a template variant renders value-before-label,
  // same pattern already used for NAV/score.
  const before = fullText.slice(Math.max(0, idx - 80), idx);
  const beforeMatch = before.match(/([-+]\d+(\.\d+)?)%(?!.*%)/);
  if (beforeMatch) return parseFloat(beforeMatch[1]);

  console.warn(
    `[parseFundPage] label "${label}" found but no +/-N% value nearby. Context: "${fullText.slice(Math.max(0, idx - 40), idx + 100)}"`
  );
  return null;
}

function extractCagr(fullText: string): number | null {
  // BUG FIX (confirmed via direct fetch of foudalens.com/en/fund/MUB-6203):
  // the real page renders this with ZERO whitespace between the label and
  // the value — "CAGR+79.96%" — not "CAGR +80.8%" as originally assumed.
  // \s+ (one-or-more) never matched real pages; switched to \s* so it
  // matches with or without a space.
  const match = fullText.match(/CAGR\s*([-+]\d+(\.\d+)?)%/);
  if (!match) return null;
  return parseFloat(match[1]);
}

function extractPriceNear(fullText: string, label: string): number | null {
  const idx = fullText.indexOf(label);
  if (idx === -1) return null;
  // BUG FIX (confirmed via direct fetch of a live fund page): the real
  // render order is VALUE then LABEL — "2.028 EGP" immediately followed by
  // "Unit price (NAV) — 2026-07-30" as a caption underneath. The forward-
  // only search here (a prior "fix" that flipped an earlier backward-only
  // search) was still wrong, just in the opposite direction — it's been
  // consistently wrong, just about which direction, without ever having
  // been checked against a real page. This now checks both directions so
  // it survives either template.
  const before = fullText.slice(Math.max(0, idx - 30), idx);
  const beforeMatch = before.match(/(\d+(\.\d+)?)\s*EGP\s*$/);
  if (beforeMatch) return parseFloat(beforeMatch[1]);

  const after = fullText.slice(idx, idx + label.length + 60);
  const afterMatch = after.match(/(\d+(\.\d+)?)\s*EGP/);
  if (afterMatch) return parseFloat(afterMatch[1]);

  return null;
}

function extractScoreNear(fullText: string): number | null {
  // BUG FIX: anchored specifically to "Total Score" instead of grabbing the
  // first "NN/100" anywhere on the page. Confirmed real page also uses
  // "/100" for the Performance, Risk, Stability, and Cost Efficiency
  // sub-scores further down ("Performance100/100", "Risk33/100", ...) — a
  // blind first-match happened to land on the right one only because Total
  // Score is listed first in the DOM, one template tweak away from silently
  // grabbing a sub-score instead. Real order here is value-then-label too:
  // "61/100 Total Score". parseFloat (not parseInt) to allow decimal scores,
  // matching the numeric(5,2) column in 001_create_comparison_snapshots.sql.
  const match = fullText.match(/(\d{1,3}(?:\.\d+)?)\/100\s*Total Score/i);
  if (!match) return null;
  return parseFloat(match[1]);
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
    $("script, style, noscript").remove();
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
