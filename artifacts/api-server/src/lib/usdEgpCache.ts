// ── USD/EGP RATE CACHE ───────────────────────────────────────────────────
// Fetches the live USD→EGP exchange rate from open.er-api.com server-side.
// The Replit preview iframe blocks cross-origin browser fetches to external
// APIs, so this must run on the server and be served through the portfolio
// response. Refreshes every 30 minutes; falls back to the last successful
// rate if a fetch fails.
// ─────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

export interface UsdEgpRate {
  rate: number;
  /** 'live' = last fetch succeeded; 'fallback' = using stale cached data */
  status: "live" | "fallback";
  fetchedAt: string;
}

const API_URL = "https://open.er-api.com/v6/latest/USD";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 8_000;

let cache: UsdEgpRate | null = null;

async function refresh(): Promise<void> {
  try {
    const resp = await fetch(API_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "usd-egp-cache: API returned non-OK status");
      if (cache) cache = { ...cache, status: "fallback" };
      return;
    }
    const data = (await resp.json()) as { result?: string; rates?: { EGP?: number } };
    const rate = data?.rates?.EGP;
    if (typeof rate === "number" && rate > 0) {
      cache = { rate, status: "live", fetchedAt: new Date().toISOString() };
      logger.info({ rate }, "usd-egp-cache: fetched live rate");
    } else {
      logger.warn({ data }, "usd-egp-cache: unexpected response shape");
      if (cache) cache = { ...cache, status: "fallback" };
    }
  } catch (err) {
    if (cache) {
      cache = { ...cache, status: "fallback" };
      logger.warn({ err }, "usd-egp-cache: fetch threw — serving stale rate as fallback");
    } else {
      logger.warn({ err }, "usd-egp-cache: fetch threw and no cached rate available");
    }
  }
}

/** Return the most recently fetched rate, or null if never fetched. */
export function getUsdEgpRate(): UsdEgpRate | null {
  return cache;
}

/**
 * Kick off an immediate fetch and schedule one every 30 minutes.
 * Call once at server startup.
 */
export function startUsdEgpScheduler(): void {
  void refresh();
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
}
