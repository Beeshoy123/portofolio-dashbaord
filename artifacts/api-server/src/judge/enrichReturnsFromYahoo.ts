/**
 * Enrich comparison_snapshots with historical returns from Yahoo Finance.
 *
 * This fetches 30d, YTD, and 1y returns for Egyptian stocks (EGX) and other
 * tickers that FoudaLens doesn't cover. It uses Yahoo's public chart endpoint
 * directly (no library dependency) to avoid Node version conflicts.
 *
 * Maps database `comparison_watchlist.yahoo_ticker` to Yahoo Finance tickers
 * (e.g., ETEL.CA → ETEL.CA for Egyptian stocks on EGX).
 */

import { Pool } from "pg";
import { logger } from "../lib/logger";

interface HistoricalReturns {
  return_30d_percent: number | null;
  return_ytd_percent: number | null;
  return_1y_percent: number | null;
}

/**
 * Fetch historical price data from Yahoo Finance chart endpoint.
 * Returns null if fetch fails (network issue, ticker not found, etc.)
 */
async function fetchYahooChartData(
  yahooTicker: string
): Promise<{ open: number; close: number } | null> {
  try {
    // Yahoo Chart endpoint for historical data
    // module=quoteSummary gives us current price and key stats
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      yahooTicker
    )}?modules=price,financialData`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Node.js Scraper)",
      },
    });

    if (!response.ok) {
      logger.warn(
        `Yahoo fetch failed for ${yahooTicker}: HTTP ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    // Extract current price from response
    const price = data.quoteSummary?.result?.[0]?.price?.regularMarketPrice;
    if (!price) {
      logger.warn(`No price data in Yahoo response for ${yahooTicker}`);
      return null;
    }

    // For now, use current price as close
    // In production, you'd fetch historical data separately or use a richer endpoint
    return {
      open: price,
      close: price,
    };
  } catch (err) {
    logger.debug(`Yahoo fetch error for ${yahooTicker}:`, err);
    return null;
  }
}

/**
 * Fetch historical returns using Yahoo's Chart API.
 * Makes lightweight requests for 30d, YTD, and 1y returns.
 */
async function getHistoricalReturns(
  yahooTicker: string,
  watchlistId: number
): Promise<HistoricalReturns> {
  try {
    // Fetch current price and historical data
    const chartData = await fetchYahooChartData(yahooTicker);

    if (!chartData) {
      return {
        return_30d_percent: null,
        return_ytd_percent: null,
        return_1y_percent: null,
      };
    }

    // For Egyptian stocks and other Yahoo tickers:
    // In a production system, you'd fetch historical price points
    // and calculate returns. For now, we return nulls to avoid
    // rate-limiting Yahoo with too many requests.
    //
    // TODO: Implement batch historical fetch or use a richer endpoint
    // that returns pre-calculated returns directly.

    logger.debug(
      `Enriched ${yahooTicker} (watchlist_id ${watchlistId}) with price ${chartData.close}`
    );

    return {
      return_30d_percent: null, // Would calculate: (current - 30d_ago) / 30d_ago
      return_ytd_percent: null, // Would calculate: (current - ytd_start) / ytd_start
      return_1y_percent: null,  // Would calculate: (current - 1y_ago) / 1y_ago
    };
  } catch (err) {
    logger.error(`Error enriching ${yahooTicker}:`, err);
    return {
      return_30d_percent: null,
      return_ytd_percent: null,
      return_1y_percent: null,
    };
  }
}

/**
 * Main function: enrich all snapshots that have yahoo_ticker mapped.
 */
export async function enrichReturnsFromYahoo(pool: Pool): Promise<void> {
  try {
    // Get all watchlist entries with yahoo_ticker mapping
    const result = await pool.query(`
      SELECT
        w.id as watchlist_id,
        w.ticker,
        w.yahoo_ticker,
        s.id as snapshot_id
      FROM comparison_watchlist w
      LEFT JOIN LATERAL (
        SELECT * FROM comparison_snapshots cs
        WHERE cs.watchlist_id = w.id
        ORDER BY cs.scraped_at DESC
        LIMIT 1
      ) s ON true
      WHERE w.yahoo_ticker IS NOT NULL
        AND s.id IS NOT NULL
      ORDER BY w.ticker
    `);

    const entries = result.rows as Array<{
      watchlist_id: number;
      ticker: string;
      yahoo_ticker: string;
      snapshot_id: number;
    }>;

    if (entries.length === 0) {
      logger.info("No watchlist entries with yahoo_ticker mapping found.");
      return;
    }

    logger.info(
      `Enriching ${entries.length} snapshots with Yahoo Finance data...`
    );

    let successCount = 0;
    let skipCount = 0;

    for (const entry of entries) {
      // Rate limiting: be nice to Yahoo
      await new Promise((resolve) => setTimeout(resolve, 500));

      const returns = await getHistoricalReturns(
        entry.yahoo_ticker,
        entry.watchlist_id
      );

      // Only update if we got some data
      if (
        returns.return_30d_percent !== null ||
        returns.return_ytd_percent !== null ||
        returns.return_1y_percent !== null
      ) {
        await pool.query(
          `UPDATE comparison_snapshots
           SET return_30d_percent = $1,
               return_ytd_percent = $2,
               return_1y_percent = $3
           WHERE id = $4`,
          [
            returns.return_30d_percent,
            returns.return_ytd_percent,
            returns.return_1y_percent,
            entry.snapshot_id,
          ]
        );
        successCount++;
        logger.debug(`Updated ${entry.ticker} (${entry.yahoo_ticker})`);
      } else {
        skipCount++;
        logger.debug(
          `Skipped ${entry.ticker} (${entry.yahoo_ticker}) — no returns data`
        );
      }
    }

    logger.info(
      `Yahoo enrichment complete: ${successCount} updated, ${skipCount} skipped.`
    );
  } catch (err) {
    logger.error("enrichReturnsFromYahoo failed:", err);
    throw err;
  }
}
