// ── EUR/EGP RATE CACHE ───────────────────────────────────────────────────
// Fetches the live EUR→EGP exchange rate from open.er-api.com server-side.
// Same pattern as usdEgpCache — browser fetches to external APIs are blocked
// by the Replit preview iframe, so this must run on the server.
// Refreshes every 30 minutes; falls back to the last successful rate on error.
// ─────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

export interface EurEgpRate {
  rate: number;
  /** 'live' = last fetch succeeded; 'fallback' = using stale cached data */
  status: "live" | "fallback";
  fetchedAt: string;
}

const API_URL = "https://open.er-api.com/v6/latest/EUR";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 8_000;

let cache: EurEgpRate | null = null;

async function refresh(): Promise<void> {
  try {
    const resp = await fetch(API_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "eur-egp-cache: API returned non-OK status");
      if (cache) cache = { ...cache, status: "fallback" };
      return;
    }
    const data = (await resp.json()) as { result?: string; rates?: { EGP?: number } };
    const rate = data?.rates?.EGP;
    if (typeof rate === "number" && rate > 0) {
      cache = { rate, status: "live", fetchedAt: new Date().toISOString() };
      logger.info({ rate }, "eur-egp-cache: fetched live rate");
    } else {
      logger.warn({ data }, "eur-egp-cache: unexpected response shape");
      if (cache) cache = { ...cache, status: "fallback" };
    }
  } catch (err) {
    if (cache) {
      cache = { ...cache, status: "fallback" };
      logger.warn({ err }, "eur-egp-cache: fetch threw — serving stale rate as fallback");
    } else {
      logger.warn({ err }, "eur-egp-cache: fetch threw and no cached rate available");
    }
  }
}

/** Return the most recently fetched rate, or null if never fetched. */
export function getEurEgpRate(): EurEgpRate | null {
  return cache;
}

/**
 * Kick off an immediate fetch and schedule one every 30 minutes.
 * Call once at server startup.
 */
export function startEurEgpScheduler(): void {
  void refresh();
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
}
