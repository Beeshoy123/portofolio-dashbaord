// ── GLOBAL GOLD PRICE CACHE ──────────────────────────────────────────────────
// Fetches the international XAU/USD spot price (USD per troy ounce) from
// Swissquote's public quotes feed — no API key required.
// Cached in memory with a 5-minute TTL, refreshed by a background setInterval.
// `getGlobalGoldPrice()` is synchronous; callers get the last successfully
// fetched value, or null if no fetch has succeeded yet.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

export interface GlobalGoldPrice {
  /** Mid-price: (bid + ask) / 2 in USD per troy ounce */
  priceUsdPerOz: number;
  status: "live" | "fallback";
  fetchedAt: string;
}

const QUOTES_URL =
  "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10_000;

let cache: GlobalGoldPrice | null = null;

type SwissquoteEntry = {
  spreadProfilePrices: Array<{ bid: number; ask: number }>;
};

async function fetchPrice(): Promise<number | null> {
  const resp = await fetch(QUOTES_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Beeshoy-PortfolioTracker/1.0; +portfolio-tracker)",
    },
  });

  if (!resp.ok) {
    logger.warn(
      { status: resp.status },
      "global-gold-cache: fetch returned non-OK status",
    );
    return null;
  }

  const data = (await resp.json()) as SwissquoteEntry[];
  const prices = data?.[0]?.spreadProfilePrices?.[0];
  if (!prices?.bid || !prices?.ask) {
    logger.warn(
      "global-gold-cache: could not extract bid/ask from response",
    );
    return null;
  }

  return (prices.bid + prices.ask) / 2;
}

async function refresh(): Promise<void> {
  try {
    const price = await fetchPrice();
    if (price !== null) {
      cache = {
        priceUsdPerOz: price,
        status: "live",
        fetchedAt: new Date().toISOString(),
      };
      logger.info(
        { priceUsdPerOz: price },
        "global-gold-cache: fetched live XAU/USD rate",
      );
    } else if (cache) {
      cache = { ...cache, status: "fallback" };
      logger.warn(
        "global-gold-cache: fetch failed — serving stale cached price as fallback",
      );
    } else {
      logger.warn(
        "global-gold-cache: fetch failed and no cached price available",
      );
    }
  } catch (err) {
    if (cache) {
      cache = { ...cache, status: "fallback" };
      logger.warn(
        { err },
        "global-gold-cache: fetch threw — serving stale cached price as fallback",
      );
    } else {
      logger.warn(
        { err },
        "global-gold-cache: fetch threw and no cached price available",
      );
    }
  }
}

/** Return the most recently fetched XAU/USD price, or null if never fetched. */
export function getGlobalGoldPrice(): GlobalGoldPrice | null {
  return cache;
}

/**
 * Kick off an immediate fetch and schedule one every 5 minutes.
 * Call once at server startup.
 */
export function startGlobalGoldScheduler(): void {
  void refresh();
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
}
