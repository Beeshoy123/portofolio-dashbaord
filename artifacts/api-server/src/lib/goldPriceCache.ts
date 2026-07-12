// ── GOLD PRICE CACHE ────────────────────────────────────────────────────
// Scrapes goldbullioneg.com for 24K and 21K buy/sell prices (EGP/gram).
// Prices are fetched server-side (the page does not support CORS) and
// cached in memory with a 5-minute TTL, refreshed by a background
// setInterval. `getGoldPrices()` is synchronous — callers get the last
// successfully scraped values, or null if no scrape has succeeded yet.
//
// The page contains <a href="...?buy=N&sell=N&item=...عيار 24..."> links
// for each karat. We scan all href attributes, decode percent-encoding,
// and extract buy= / sell= from whichever link's item= param contains
// "عيار 24" or "عيار 21".
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

/** Extract buy/sell prices (EGP/gram) for a given karat from raw HTML. */
function extractKaratPrices(
  html: string,
  karat: "24" | "21",
): { buy: number; sell: number } | null {
  const hrefRe = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1];
    // Decode percent-encoding so Arabic text is readable; ignore decode errors.
    try {
      href = decodeURIComponent(href);
    } catch {
      /* keep raw href */
    }

    // Check whether this link targets the right karat
    // Pattern in item= param: " جرام عيار 24" or " جرام عيار 21"
    if (!href.includes(`عيار ${karat}`) && !href.includes(`عيار\u00a0${karat}`)) {
      continue;
    }

    const buyM = href.match(/[?&]buy=(\d+)/);
    const sellM = href.match(/[?&]sell=(\d+)/);
    if (buyM && sellM) {
      const buy = parseInt(buyM[1], 10);
      const sell = parseInt(sellM[1], 10);
      if (buy > 0 && sell > 0) {
        return { buy, sell };
      }
    }
  }

  return null;
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
