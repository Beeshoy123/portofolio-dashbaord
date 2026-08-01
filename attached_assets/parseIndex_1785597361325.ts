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
      `[parseIndex] Label "${label}" appears ${positions.length} times on the page — trying each occurrence to find a real value. Verify this picks the correct one once you can see the actual page.`
    );
  }

  for (const idx of positions) {
    const window = fullText.slice(idx, idx + label.length + 60);
    // Index levels are typically larger numbers, possibly with commas,
    // e.g. "34,521.60" — adjust this regex if the real format differs.
    const match = window.match(/[\d,]+(\.\d+)?/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ""));
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
    const window = fullText.slice(idx, idx + label.length + 80);
    const match = window.match(/[-+]\d+(\.\d+)?%/);
    if (match) {
      return parseFloat(match[0].replace("%", ""));
    }
  }

  return null;
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
    });

    if (!res.ok) {
      console.error(`[parseIndexPage] HTTP ${res.status}`);
      return targets.map((t) => emptySnapshot(t.watchlistId));
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const bodyText = $("body").text().replace(/\s+/g, " ");

    return targets.map((t) => {
      const points = extractPointsNear(bodyText, t.label);
      const changePercent = extractChangePercentNear(bodyText, t.label);
      const gotData = points !== null;

      if (!gotData) {
        console.warn(
          `[parseIndexPage] "${t.label}": no value found near label — inspect page manually, extraction pattern may need adjusting`
        );
      }

      return {
        watchlist_id: t.watchlistId,
        nav_or_price: points,
        return_30d_percent: null, // not available on this page — only current level + daily change
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
