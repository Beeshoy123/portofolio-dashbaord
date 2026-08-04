// ── GOLD PRICE CACHE ────────────────────────────────────────────────────
// Scrapes goldbullioneg.com for 24K and 21K buy/sell prices (EGP/gram).
// Prices are fetched server-side (the page does not support CORS) and
// cached in memory with a 5-minute TTL, refreshed by a background
// setInterval. `getGoldPrices()` is synchronous — callers get the last
// successfully scraped values, or null if no scrape has succeeded yet.
//
// Page structure (as of Aug 2026):
//   <tr>
//     <td> جرام عيار 24 <span>…</span></td>
//     <td class="num" data-val="6703">6703</td>        ← buy (شراء)
//     <td class="num td-arrow" data-val="6680">6680</td> ← sell (بيع)
//   </tr>
// We locate the <tr> whose first <td> contains "جرام عيار NN", then pull
// the first two data-val integers after it as buy / sell respectively.
// ─────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

export interface GoldPrices {
  buyPrice24k: number;
  sellPrice24k: number;
  buyPrice21k: number;
  sellPrice21k: number;
  /** 'live' = last scrape succeeded; 'fallback' = using stale cached data */
  status: "live" | "fallback";
  fetchedAt: string;
}

const SCRAPE_URL =
  "https://goldbullioneg.com/%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%B0%D9%87%D8%A8/";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10_000;

let cache: GoldPrices | null = null;

/** Extract buy/sell prices (EGP/gram) for a given karat from raw HTML.
 *
 * Strategy: find the <tr> whose first cell contains "جرام عيار NN", then
 * grab the first two `data-val="DDDD"` integers that follow it in the same
 * row — first is buy (شراء), second is sell (بيع).
 */
function extractKaratPrices(
  html: string,
  karat: "24" | "21",
): { buy: number; sell: number } | null {
  // Locate the row-start position where "جرام عيار NN" appears
  const marker = `جرام عيار ${karat}`;
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  // Find the <tr> that encloses this marker (search backwards)
  const trStart = html.lastIndexOf("<tr", markerIdx);
  if (trStart === -1) return null;

  // Find the closing </tr> after the marker
  const trEnd = html.indexOf("</tr>", markerIdx);
  if (trEnd === -1) return null;

  // Slice the row HTML and extract all data-val="DDDD" values
  const rowHtml = html.slice(trStart, trEnd + 5);
  const dataValRe = /data-val="(\d+)"/g;
  const vals: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = dataValRe.exec(rowHtml)) !== null) {
    const v = parseInt(m[1], 10);
    if (v > 0) vals.push(v);
  }

  // Expect at least two values: [buy, sell]
  if (vals.length < 2) return null;
  return { buy: vals[0], sell: vals[1] };
}

async function scrape(): Promise<{
  buyPrice24k: number;
  sellPrice24k: number;
  buyPrice21k: number;
  sellPrice21k: number;
} | null> {
  const resp = await fetch(SCRAPE_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Beeshoy-PortfolioTracker/1.0; +portfolio-tracker)",
      "Accept-Language": "ar,en;q=0.9",
    },
  });

  if (!resp.ok) {
    logger.warn(
      { status: resp.status },
      "gold-price-cache: scrape returned non-OK status",
    );
    return null;
  }

  const html = await resp.text();
  const p24 = extractKaratPrices(html, "24");
  const p21 = extractKaratPrices(html, "21");

  if (!p24 || !p21) {
    logger.warn(
      { found24: !!p24, found21: !!p21 },
      "gold-price-cache: could not extract one or both karat prices — page layout may have changed",
    );
    return null;
  }

  return {
    buyPrice24k: p24.buy,
    sellPrice24k: p24.sell,
    buyPrice21k: p21.buy,
    sellPrice21k: p21.sell,
  };
}

async function refresh(): Promise<void> {
  try {
    const prices = await scrape();
    if (prices) {
      cache = { ...prices, status: "live", fetchedAt: new Date().toISOString() };
      logger.info(
        {
          buyPrice24k: prices.buyPrice24k,
          sellPrice24k: prices.sellPrice24k,
          buyPrice21k: prices.buyPrice21k,
          sellPrice21k: prices.sellPrice21k,
        },
        "gold-price-cache: scraped fresh prices",
      );
    } else if (cache) {
      // Scrape failed but we have stale data — mark as fallback, keep values.
      cache = { ...cache, status: "fallback" };
      logger.warn("gold-price-cache: scrape failed — serving stale cached prices as fallback");
    } else {
      logger.warn("gold-price-cache: scrape failed and no cached prices available");
    }
  } catch (err) {
    if (cache) {
      cache = { ...cache, status: "fallback" };
      logger.warn({ err }, "gold-price-cache: scrape threw — serving stale cached prices as fallback");
    } else {
      logger.warn({ err }, "gold-price-cache: scrape threw and no cached prices available");
    }
  }
}

/** Return the most recently scraped gold prices, or null if never fetched. */
export function getGoldPrices(): GoldPrices | null {
  return cache;
}

/**
 * Kick off an immediate scrape and schedule one every 5 minutes.
 * Call once at server startup.
 */
export function startGoldPriceScheduler(): void {
  void refresh();
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
}
