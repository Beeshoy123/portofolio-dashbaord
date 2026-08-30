// Comparison Judge — Index Page Parser
//
// CONFIRMED: all 3 tracked indices (EGX30, EGX70 EWI, EGX100 EWI) live on
// ONE shared page: foudalens.com/en/indices. Confirmed via direct fetch
// during design — the page returned index names and appeared to be
// server-rendered similarly to fund pages (plain text, not JS-only shell).
// Level/points values were not fully confirmed in the same pass — verify
// the extraction below against the real page output once run in Replit.
//
// This parser fetches the page ONCE and returns snapshots for all 3
// indices, rather than being called 3 times like fund/stock parsers.

import * as cheerio from "cheerio";
import type { ScrapedSnapshot } from "./types";

const INDICES_URL = "https://foudalens.com/en/indices";

interface IndexTarget {
  watchlistId: number;
  label: string; // exact text to search for, e.g. "EGX30", "EGX70 EWI"
  analysisSlug?: string;
}

/**
 * Finds ALL occurrences of a label in the text, not just the first.
 * FIX (bug #2 from audit): the original version used indexOf(), which
 * only finds the FIRST occurrence — a real risk on this page specifically,
 * since 3 different indices are searched on ONE shared page. If a label
 * like "EGX30" appears more than once before the actual data block (e.g.
 * in a nav link, a "compare to EGX30" caption on a different index's
 * card, or a page title), the old code would have silently extracted
 * from the wrong location. This returns every match position so the
 * caller can reason about which one is correct instead of blindly
 * trusting the first.
 */
function findAllOccurrences(fullText: string, label: string): number[] {
  const positions: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(label, searchFrom);
    if (idx === -1) break;
    positions.push(idx);
    searchFrom = idx + label.length;
  }
  return positions;
}

/**
 * Given multiple candidate positions for a label, tries extracting a
 * value near EACH one and returns the first successful extraction. This
 * is a pragmatic fix, not a perfect one: without seeing the real page
 * structure, we can't know for certain which occurrence is the "real"
 * data card vs. a nav link or cross-reference — but a nav link or plain
 * text mention is very unlikely to have a number immediately after it,
 * while the actual data card will. Trying each occurrence in order and
 * taking the first one that yields a plausible number is safer than
 * blindly trusting occurrence #1, and the logging below makes it
 * possible to verify this against the real page on first run.
 */
function extractPointsNear(fullText: string, label: string): number | null {
  const positions = findAllOccurrences(fullText, label);
  if (positions.length === 0) return null;

  if (positions.length > 1) {
    console.warn(
      `[parseIndex] Label "${label}" appears ${positions.length} times on the page — trying each occurrence to find a real value.`
    );
  }

  for (const idx of positions) {
    // BUG FIX (confirmed against the live /en/indices page): the old window
    // started at `idx` — the label's OWN start position — not after it. For
    // labels that contain digits themselves ("EGX30", "EGX70 EWI", "EGX100
    // EWI"), the regex below matched the digits INSIDE the label text
    // ("30", "70", "100") before ever reaching the real index level that
    // follows. That's exactly why the dashboard showed NAV/Price of
    // 30.00 / 70.00 / 100.00 for the three indices — those are literally
    // the numbers embedded in the tickers, not real index levels.
    // The real page puts the value AFTER the label in both places it
    // appears: the top ticker strip ("EGX30 53,627.32 (-0.19%)") and each
    // index's own section ("EGX30 7/29/2026 53,627.32 -102.65 (-0.19%)").
    const start = idx + label.length;
    const window = fullText.slice(start, start + 60);
    const match = window.match(/[\d,]+(\.\d+)?/);
    if (match) {
      const value = parseFloat(match[0].replace(/,/g, ""));
      // Sanity guard: EGX30/70/100 all trade in the thousands. A small
      // value here almost always means we matched a stray date fragment
      // (e.g. the "7" in "7/29/2026" from the section-header format)
      // instead of the real level. Raise/lower this if you add an index
      // that legitimately trades under 1000.
      if (value >= 1000) {
        return value;
      }
    }
  }

  return null;
}

function extractChangePercentNear(
  fullText: string,
  label: string
): number | null {
  const positions = findAllOccurrences(fullText, label);
  if (positions.length === 0) return null;

  for (const idx of positions) {
    // Same window-start fix as extractPointsNear above, for consistency —
    // this one happened to work anyway (the regex requires a leading +/-,
    // which none of the digit-bearing labels contain), but starting after
    // the label instead of at it removes the accidental reliance on that.
    const start = idx + label.length;
    const window = fullText.slice(start, start + 80);
    const match = window.match(/[-+]\d+(\.\d+)?%/);
    if (match) {
      return parseFloat(match[0].replace("%", ""));
    }
  }

  return null;
}

function extractYtdPercentNear(fullText: string, label: string): number | null {
  const positions = findAllOccurrences(fullText, label);
  for (const idx of positions) {
    const window = fullText.slice(idx + label.length, idx + label.length + 180);
    const match = window.match(/YTD\s*:?\s*([-+]\d+(?:\.\d+)?)%/i);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extract1yPercentNear(fullText: string, label: string): number | null {
  const positions = findAllOccurrences(fullText, label);
  for (const idx of positions) {
    const window = fullText.slice(idx + label.length, idx + label.length + 250);
    const match = window.match(/(?:1[Yy]|1-Year|1\s*Year|12[Mm]|52[Ww]|1\s*سنة)\s*:?\s*([-+]\d+(?:\.\d+)?)%/i);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

async function fetchSixtySessionMove(slug: string): Promise<number | null> {
  try {
    const response = await fetch(`https://foudalens.com/en/indices/${slug}/analysis`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const $ = cheerio.load(await response.text());
    $("script, style, noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ");
    const match = text.match(/60-session move\s*([-+]\d+(?:\.\d+)?)%/i);
    return match ? parseFloat(match[1]) : null;
  } catch (error) {
    console.warn(`[parseIndexPage] ${slug}: 60-session analysis unavailable`, error);
    return null;
  }
}

/**
 * Fetches the shared indices page once and returns a snapshot per target.
 * @param targets array of {watchlistId, label} — label must match the
 * exact text FoudaLens uses on the page (confirmed: "EGX30", "EGX70 EWI",
 * "EGX100 EWI").
 */
export async function parseIndexPage(
  targets: IndexTarget[]
): Promise<ScrapedSnapshot[]> {
  try {
    const res = await fetch(INDICES_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[parseIndexPage] HTTP ${res.status}`);
      return targets.map((t) => emptySnapshot(t.watchlistId));
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ");

    // DISABLED: 60-session moves were causing 30+ second delays with extra HTTP requests
    // These requests frequently timeout or fail, blocking index data retrieval
    // Re-enable if FoudaLens API becomes more stable
    // const sixtySessionMoves = await Promise.all(
    //   targets.map((target) => target.analysisSlug ? fetchSixtySessionMove(target.analysisSlug) : Promise.resolve(null)),
    // );
    const sixtySessionMoves = targets.map(() => null); // All null for now

    return targets.map((t, index) => {
      const points = extractPointsNear(bodyText, t.label);
      const changePercent = extractChangePercentNear(bodyText, t.label);
      const ytdPercent = extractYtdPercentNear(bodyText, t.label);
      const oneYearPercent = extract1yPercentNear(bodyText, t.label);
      const gotData = points !== null;

      if (!gotData) {
        console.warn(
          `[parseIndexPage] "${t.label}": no value found near label — inspect page manually, extraction pattern may need adjusting`
        );
      }

      return {
        watchlist_id: t.watchlistId,
        nav_or_price: points,
        return_30d_percent: null, // FoudaLens exposes no exact 30-day return on this page.
        return_60d_percent: sixtySessionMoves[index],
        return_ytd_percent: ytdPercent,
        return_1y_percent: oneYearPercent,
        cagr_percent: null,
        total_score: null,
        risk_level: null,
        signal: null,
        pe_ratio: null,
        dividend_yield_percent: null,
        market_cap: null,
        sector_rank: null,
        raw_fetch_ok: gotData,
      } satisfies ScrapedSnapshot;
    });
  } catch (err) {
    console.error(`[parseIndexPage] fetch failed —`, err);
    return targets.map((t) => emptySnapshot(t.watchlistId));
  }
}

function emptySnapshot(watchlistId: number): ScrapedSnapshot {
  return {
    watchlist_id: watchlistId,
    nav_or_price: null,
    return_30d_percent: null,
    return_60d_percent: null,
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
