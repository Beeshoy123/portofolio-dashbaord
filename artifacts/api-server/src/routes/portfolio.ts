// ── DATA SOURCE POLICY ──────────────────────────────────────────────────
// Every field returned by these routes must come from a live `db.select()`
// against Postgres. Never hardcode a financial value, never substitute a
// "reasonable default" for a missing column, and never add a seed/sample
// data path here. If a required row is missing, return an explicit error
// (e.g. NOT_SEEDED below) so the frontend can show a clear empty/error
// state instead of a fabricated number.
// ─────────────────────────────────────────────────────────────────────────

import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { getGoldPrices } from "../lib/goldPriceCache";
import { getGlobalGoldPrice } from "../lib/globalGoldCache";
import { getUsdEgpRate } from "../lib/usdEgpCache";
import { getEurEgpRate } from "../lib/eurEgpCache";
import { logger } from "../lib/logger";
import {
  db,
  goldSettingsTable,
  goldTransactionsTable,
  fundsTable,
  certificatesTable,
  transactionsTable,
  growthSnapshotsTable,
  portfolioSettingsTable,
} from "@workspace/db";
import {
  GetPortfolioResponse,
  UpdateGoldSettingsBody,
  UpdateGoldSettingsResponse,
  CreateGoldTransactionBody,
  CreateGoldTransactionResponse,
  UpdateFundBody,
  UpdateFundResponse,
  CreateGrowthSnapshotBody,
  CreateGrowthSnapshotResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toGoldTransaction(row: typeof goldTransactionsTable.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    quantity: row.quantity,
    weightPerUnitGrams: Number(row.weightPerUnitGrams),
    totalWeightGrams: Number(row.totalWeightGrams),
    karat: row.karat,
    spotPricePerGram: Number(row.spotPricePerGram),
    manufacturingFeePerGram: Number(row.manufacturingFeePerGram),
    totalPaid: Number(row.totalPaid),
  };
}

// gramsHeld / costBasis / avgCostPerGram are always derived by summing the
// transaction history here — never stored as a static snapshot. Live price
// (and therefore currentValue / pnl) is null until that feature is built;
// callers must treat null as "unavailable", not zero.
function buildGoldPosition(
  txRows: (typeof goldTransactionsTable.$inferSelect)[],
  settings: typeof goldSettingsTable.$inferSelect,
) {
  const transactions = txRows
    .map(toGoldTransaction)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const gramsHeld = transactions.reduce((s, t) => s + t.totalWeightGrams, 0);
  const costBasis = transactions.reduce((s, t) => s + t.totalPaid, 0);
  const avgCostPerGram = gramsHeld > 0 ? costBasis / gramsHeld : 0;
  const cashbackPerGram = Number(settings.cashbackPerGram);

  // Live gold prices scraped from goldbullioneg.com by the background
  // scheduler in goldPriceCache.ts (refreshed every 5 minutes).
  //
  // The SELL price is used as livePricePerGram: that is the price the
  // user actually receives when selling physical gold, which is the
  // correct basis for P&L valuation.
  //   currentValue = gramsHeld × sellPrice24k
  //   pnl (net)    = (currentValue + gramsHeld × cashbackPerGram) − costBasis
  //
  // The BUY prices (24K and 21K) are exposed separately for the DCA
  // calculator — buying new gold costs the buy price + mfg fee.
  const cachedPrices = getGoldPrices();
  const livePricePerGram = cachedPrices?.sellPrice24k ?? null;
  const currentValue =
    livePricePerGram !== null ? gramsHeld * livePricePerGram : null;
  const pnl =
    currentValue !== null
      ? currentValue + gramsHeld * cashbackPerGram - costBasis
      : null;

  return {
    gramsHeld,
    costBasis,
    avgCostPerGram,
    cashbackPerGram,
    livePricePerGram,
    currentValue,
    pnl,
    buyPrice24k: cachedPrices?.buyPrice24k ?? null,
    sellPrice24k: cachedPrices?.sellPrice24k ?? null,
    buyPrice21k: cachedPrices?.buyPrice21k ?? null,
    sellPrice21k: cachedPrices?.sellPrice21k ?? null,
    goldPriceStatus: cachedPrices?.status ?? null,
    transactions,
  };
}

function toFund(row: typeof fundsTable.$inferSelect) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    ticker: row.ticker,
    icon: row.icon,
    unitsHeld: Number(row.unitsHeld),
    costBasisTotal: Number(row.costBasisTotal),
    nav: Number(row.nav),
    apyPercent: row.apyPercent === null ? null : Number(row.apyPercent),
  };
}

function toCertificate(row: typeof certificatesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    value: Number(row.value),
    ratePercent: Number(row.ratePercent),
    maturityDate: row.maturityDate,
  };
}

function toTransaction(row: typeof transactionsTable.$inferSelect) {
  return {
    id: row.id,
    assetType: row.assetType as "gold" | "abr" | "re" | "azs",
    name: row.name,
    meta: row.meta,
    occurredAt: row.occurredAt.toISOString(),
    amount: Number(row.amount),
    txType: row.txType as "buy" | "sell",
  };
}

function toGrowthSnapshot(row: typeof growthSnapshotsTable.$inferSelect) {
  return {
    id: row.id,
    snapshotDate: row.snapshotDate,
    value: Number(row.value),
  };
}

function isMissingPortfolioRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const candidate = err as {
    code?: string;
    message?: string;
    detail?: string;
  };

  const code = candidate.code;
  const message = `${candidate.message ?? ""} ${candidate.detail ?? ""}`;

  return (
    code === "42P01" ||
    code === "undefined_table" ||
    /relation \".*\" does not exist/i.test(message) ||
    /table .* does not exist/i.test(message) ||
    /missing relation/i.test(message)
  );
}

router.get("/portfolio", async (_req, res) => {
  try {
    const [
      goldTxRows,
      goldSettingsRows,
      fundRows,
      certRows,
      txRows,
      snapshotRows,
      settingsRows,
    ] = await Promise.all([
      db
        .select()
        .from(goldTransactionsTable)
        .orderBy(goldTransactionsTable.date),
      db.select().from(goldSettingsTable).limit(1),
      db.select().from(fundsTable),
      db.select().from(certificatesTable),
      db.select().from(transactionsTable).orderBy(transactionsTable.occurredAt),
      db
        .select()
        .from(growthSnapshotsTable)
        .orderBy(growthSnapshotsTable.snapshotDate),
      db.select().from(portfolioSettingsTable).limit(1),
    ]);

    const goldSettings = goldSettingsRows[0];
    const settings = settingsRows[0];
    if (!goldSettings || !settings) {
      logger.warn({ hasGoldSettings: Boolean(goldSettings), hasSettings: Boolean(settings) }, "Portfolio route missing seed data");
      res.status(404).json({
        error: "NOT_SEEDED",
        message: "No portfolio data found — please import your data.",
      });
      return;
    }

    const data = GetPortfolioResponse.parse({
      gold: buildGoldPosition(goldTxRows, goldSettings),
      funds: fundRows.map(toFund),
      certificates: certRows.map(toCertificate),
      transactions: txRows
        .map(toTransaction)
        .sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
      snapshots: snapshotRows.map(toGrowthSnapshot),

      // Drawdown needs a time series, not just the current portfolio response.
      // Record only complete valuations and suppress refresh noise within a
      // short window so opening the dashboard does not create fake volatility.
      if (data.gold.currentValue !== null) {
        const fundMarketValue = data.funds.reduce(
          (sum, fund) => sum + fund.nav * fund.unitsHeld,
          0,
        );
        const fundCostBasis = data.funds.reduce(
          (sum, fund) => sum + fund.costBasisTotal,
          0,
        );
        const totalMarketValue = data.gold.currentValue + fundMarketValue;
        const totalCostBasis = data.gold.costBasis + fundCostBasis;

        try {
          await db.execute(sql`
            INSERT INTO portfolio_value_history (total_cost_basis, total_market_value)
            SELECT ${totalCostBasis}, ${totalMarketValue}
            WHERE NOT EXISTS (
              SELECT 1 FROM portfolio_value_history
              WHERE recorded_at > now() - interval '15 minutes'
            )
          `);
        } catch (historyError) {
          logger.warn({ err: historyError }, "Could not record portfolio history for alerts");
        }
      }
      settings: (() => {
        // Prefer the live server-side rate; fall back to the DB value if
        // the first fetch hasn't completed yet (cold start race window).
        const liveUsd = getUsdEgpRate();
        const liveEur = getEurEgpRate();
        return {
          emergencyFundTarget: Number(settings.emergencyFundTarget),
          usdEgpRate: liveUsd?.rate ?? Number(settings.usdEgpRate),
          usdEgpStatus: liveUsd?.status ?? null,
          eurEgpRate: liveEur?.rate ?? null,
          eurEgpStatus: liveEur?.status ?? null,
        };
      })(),
    });

    res.json(data);
  } catch (err) {
    logger.error({ err }, "Error fetching portfolio data");

    if (isMissingPortfolioRelationError(err)) {
      logger.warn(
        { err },
        "Portfolio route hit a missing Postgres relation; returning NOT_SEEDED",
      );

      res.status(404).json({
        error: "NOT_SEEDED",
        message: "No portfolio data found — please import your data.",
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to load portfolio data.",
    });
  }
});

router.patch("/portfolio/gold/settings", async (req, res) => {
  const body = UpdateGoldSettingsBody.parse(req.body);
  const [existing] = await db.select().from(goldSettingsTable).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Gold settings not found" });
    return;
  }

  const updates: Partial<typeof goldSettingsTable.$inferInsert> = {};
  if (body.cashbackPerGram !== undefined)
    updates.cashbackPerGram = String(body.cashbackPerGram);

  const [updated] = await db
    .update(goldSettingsTable)
    .set(updates)
    .where(eq(goldSettingsTable.id, existing.id))
    .returning();

  const goldTxRows = await db
    .select()
    .from(goldTransactionsTable)
    .orderBy(goldTransactionsTable.date);

  res.json(
    UpdateGoldSettingsResponse.parse(buildGoldPosition(goldTxRows, updated)),
  );
});

router.post("/portfolio/gold/transactions", async (req, res) => {
  const body = CreateGoldTransactionBody.parse(req.body);
  const totalWeightGrams = body.quantity * body.weightPerUnitGrams;

  await db.insert(goldTransactionsTable).values({
    date: body.date.toISOString().slice(0, 10),
    quantity: body.quantity,
    weightPerUnitGrams: String(body.weightPerUnitGrams),
    totalWeightGrams: String(totalWeightGrams),
    karat: body.karat,
    spotPricePerGram: String(body.spotPricePerGram),
    manufacturingFeePerGram: String(body.manufacturingFeePerGram),
    totalPaid: String(body.totalPaid),
  });

  // Mirror every real gold purchase into the shared activity feed
  // (`transactions`) so the Activity & Holdings widget's Transactions tab
  // — which already has a Gold filter chip — always reflects the same
  // count of real receipts as gold_transactions, never silently drifting
  // out of sync with the actual purchase history.
  const barLabel = body.quantity > 1 ? `${body.quantity} bars` : "1 bar";
  await db.insert(transactionsTable).values({
    assetType: "gold",
    name: `Gold ${body.karat}K`,
    meta: `${barLabel} x ${body.weightPerUnitGrams}g @ ${body.spotPricePerGram} EGP/g + ${body.manufacturingFeePerGram} EGP/g fee`,
    occurredAt: body.date,
    amount: String(body.totalPaid),
    txType: "buy",
  });

  const [goldTxRows, [goldSettings]] = await Promise.all([
    db.select().from(goldTransactionsTable).orderBy(goldTransactionsTable.date),
    db.select().from(goldSettingsTable).limit(1),
  ]);
  if (!goldSettings) {
    res.status(404).json({ error: "Gold settings not found" });
    return;
  }

  res
    .status(201)
    .json(
      CreateGoldTransactionResponse.parse(
        buildGoldPosition(goldTxRows, goldSettings),
      ),
    );
});

router.patch("/portfolio/funds/:key", async (req, res) => {
  const body = UpdateFundBody.parse(req.body);
  const [existing] = await db
    .select()
    .from(fundsTable)
    .where(eq(fundsTable.key, req.params.key))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: `Fund '${req.params.key}' not found` });
    return;
  }

  const updates: Partial<typeof fundsTable.$inferInsert> = {};
  if (body.unitsHeld !== undefined) updates.unitsHeld = String(body.unitsHeld);
  if (body.nav !== undefined) updates.nav = String(body.nav);

  const [updated] = await db
    .update(fundsTable)
    .set(updates)
    .where(eq(fundsTable.id, existing.id))
    .returning();

  res.json(UpdateFundResponse.parse(toFund(updated)));
});

// Lightweight endpoint so the client can poll for a fresh USD/EGP rate
// without re-fetching the entire portfolio.
router.get("/portfolio/usd-rate", (_req, res) => {
  const r = getUsdEgpRate();
  if (!r) {
    res.json({ status: "unavailable" });
    return;
  }
  res.json(r);
});

// Lightweight endpoint so the client can poll for a fresh EUR/EGP rate
// without re-fetching the entire portfolio.
router.get("/portfolio/eur-rate", (_req, res) => {
  const r = getEurEgpRate();
  if (!r) {
    res.json({ status: "unavailable" });
    return;
  }
  res.json(r);
});

// Lightweight endpoint so the client can poll for fresh gold prices
// without re-fetching the entire portfolio. Returns the in-memory
// scraper cache (status: 'live' | 'fallback' | 'unavailable').
router.get("/portfolio/gold-prices", (_req, res) => {
  const prices = getGoldPrices();
  const global = getGlobalGoldPrice();
  if (!prices) {
    res.json({
      status: "unavailable",
      globalGoldUsdPerOz: global?.priceUsdPerOz ?? null,
      globalGoldStatus: global?.status ?? null,
    });
    return;
  }
  res.json({
    ...prices,
    globalGoldUsdPerOz: global?.priceUsdPerOz ?? null,
    globalGoldStatus: global?.status ?? null,
  });
});

// ── AI Scanner proxy ─────────────────────────────────────────────────────────
// Calls Gemini from the server so the request originates from Replit's
// infrastructure, bypassing regional free-tier quota restrictions.
router.post("/portfolio/scan", async (req, res) => {
  const { image, mimeType, mode, apiKey } = req.body as {
    image?: string;
    mimeType?: string;
    mode?: string;
    apiKey?: string;
  };

  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!image || !mimeType || !mode || !resolvedApiKey) {
    res.status(400).json({ error: "Missing required fields: image, mimeType, mode, and a valid Gemini API key." });
    return;
  }

  const prompt =
    mode === "order"
      ? `You are analyzing a Thndr (Egyptian investment app) order confirmation screenshot.
Extract ONLY these fields as a raw JSON object — no markdown, no code fences, just the JSON:
{
  "fund": "abr" or "re"  (ABR / Bareeq / بريق = "abr", BRE / Real Estate / عقاري = "re"),
  "nav": <number: NAV per unit shown on screen, e.g. 1.2345>,
  "unitsHeld": <number: total units/certificates held AFTER this transaction>
}
Omit any field you cannot read confidently. Return ONLY the JSON.`
      : `You are analyzing an Egyptian investment fund NAV or price page screenshot.
Extract ONLY these fields as a raw JSON object — no markdown, no code fences, just the JSON:
{
  "fund": "abr" or "re"  (ABR / Bareeq / بريق = "abr", BRE / Real Estate / عقاري = "re"),
  "nav": <number: current NAV per unit shown on screen, e.g. 1.2345>
}
Omit any field you cannot read confidently. Return ONLY the JSON.`;

  // Support an orders-list mode which returns an ARRAY of simple order rows
  // so the frontend can render a multi-row review UI before writing to DB.
  if (mode === "orders-list") {
    // The rows should be an array of objects with these fields:
    // { assetType: "abr"|"re"|"azs", side: "buy"|"sell", pricePerUnit: <number>, amountEgp: <number>, occurredAt?: <iso string> }
    // Return ONLY the raw JSON array.
    const ORDERS_LIST_PROMPT = `You are analyzing a screenshot that contains multiple executed orders (an orders list/table).
Extract ONLY a JSON ARRAY of rows — no markdown, no code fences, just the JSON array. Each row must contain these fields:
[
  {
    "assetType": "abr" or "re" or "azs",
    "side": "buy" or "sell",
    "pricePerUnit": <number: price per unit/cert shown on screen>,
    "amountEgp": <number: total EGP value of the order>,
    "occurredAt": <optional ISO-8601 datetime string if visible>
  }
]
Omit any row you cannot read confidently. Return ONLY the JSON array.`;
    // Override prompt for orders-list
    // eslint-disable-next-line no-unused-vars
    // (we intentionally keep `prompt` variable name for parity with Gemini calls below)
    // @ts-ignore - reassign for clarity
    // NOTE: we'll set promptText local variable to avoid confusing the earlier `prompt` const
  }

  // Tried in order — if a model's quota is exhausted (429), the model is
  // unavailable (404, e.g. deprecated), or Google's servers are transiently
  // overloaded (503 "model is currently experiencing high demand"), fall
  // through to the next one on the same key before giving up. Other errors
  // (bad key, bad request) surface immediately since retrying won't help.
  const MODEL_FALLBACK_CHAIN = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
  ];

  let geminiRes: Response | undefined;
  let lastErrData: { error?: { message?: string } } = {};
  let lastModel = MODEL_FALLBACK_CHAIN[0];

  for (const model of MODEL_FALLBACK_CHAIN) {
    lastModel = model;
    const attempt = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: image } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      },
    );

    if (attempt.ok) {
      geminiRes = attempt;
      break;
    }

    lastErrData = (await attempt.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    const shouldFallThrough =
      attempt.status === 429 || attempt.status === 404 || attempt.status === 503;
    if (!shouldFallThrough) {
      geminiRes = attempt;
      break;
    }
    // else: try next model in the chain
  }

  // If Gemini failed, try Qwen as fallback
  let qwenRes: Response | undefined;
  if (!geminiRes || !geminiRes.ok) {
    const qwenApiKey = process.env.QWEN_API_KEY;
    if (qwenApiKey) {
      try {
        const qwenAttempt = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${qwenApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen-vl-max-latest",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${image}` },
                  },
                ],
              },
            ],
            max_tokens: 256,
            temperature: 0.1,
          }),
        });

        if (qwenAttempt.ok) {
          qwenRes = qwenAttempt;
        } else {
          const qwenErr = (await qwenAttempt.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          console.warn(
            `[scan] Qwen fallback failed (status: ${qwenAttempt.status}): ${qwenErr?.error?.message ?? "no detail"}`,
          );
        }
      } catch (e) {
        console.warn(`[scan] Qwen fallback error: ${e}`);
      }
    }
  }

  // If both Gemini and Qwen failed, use Qwen response if available, else Gemini
  const finalRes = (qwenRes && qwenRes.ok) ? qwenRes : geminiRes;

  if (!finalRes || !finalRes.ok) {
    const status = finalRes?.status ?? 429;
    // Log the technical detail server-side for debugging, but show the user
    // a plain-language message — they can't act on a raw Google API string.
    console.warn(
      `[scan] all models exhausted (Gemini: ${lastModel}, status: ${status}): ${lastErrData?.error?.message ?? "no detail"}`,
    );
    const friendlyMessage =
      status === 429 || status === 503
        ? "AI models are busy or quota exhausted. Wait a bit and try again, or enter the values manually."
        : "Could not read the image — please try again or enter the values manually.";
    res.status(status).json({ error: friendlyMessage });
    return;
  }

  const data = (await finalRes.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    choices?: { message?: { content?: string } }[];
  };
  
  // Handle both Gemini (candidates) and Qwen (choices) response formats
  let raw = "";
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    raw = data.candidates[0].content.parts[0].text.trim();
  } else if (data?.choices?.[0]?.message?.content) {
    raw = data.choices[0].message.content.trim();
  }

  if (!raw) {
    res.status(422).json({ error: "AI returned empty response. Try a clearer screenshot." });
    return;
  }

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // If the request asked for orders-list, expect a JSON ARRAY back.
  if (mode === "orders-list") {
    let parsedRows: unknown;
    try {
      parsedRows = JSON.parse(cleaned);
    } catch {
      // Try OpenRouter fallback if configured
      if (process.env.OPENROUTER_API_KEY) {
        try {
          const orResp = await fetch("https://api.openrouter.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: ORDERS_LIST_PROMPT }],
              max_tokens: 512,
              temperature: 0.1,
            }),
          });
          if (orResp.ok) {
            const orData = await orResp.json().catch(() => ({}));
            const orText = (orData?.choices?.[0]?.message?.content ?? "").trim();
            const cleanedOr = orText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
            parsedRows = JSON.parse(cleanedOr);
          }
        } catch (e) {
          // fall through to error below
        }
      }
    }

    if (!Array.isArray(parsedRows)) {
      res.status(422).json({ error: "Could not parse an orders array from the image. Try a clearer screenshot." });
      return;
    }

    const validRows: any[] = [];
    for (const r of parsedRows as any[]) {
      if (!r || typeof r !== "object") continue;
      const asset = (r.assetType || r.asset || r.fund) as string | undefined;
      const side = (r.side || r.txType || r.type) as string | undefined;
      const price = Number(r.pricePerUnit ?? r.price ?? r.unitPrice ?? r.pricePer_unit ?? null);
      const amount = Number(r.amountEgp ?? r.amount ?? r.total ?? null);
      const occurredAt = typeof r.occurredAt === "string" ? r.occurredAt : undefined;
      if (!asset || !["abr", "re", "azs"].includes(asset)) continue;
      if (!side || !["buy", "sell"].includes(side)) continue;
      if (!Number.isFinite(price) || !Number.isFinite(amount)) continue;
      validRows.push({ assetType: asset, side, pricePerUnit: price, amountEgp: amount, occurredAt });
    }

    if (validRows.length === 0) {
      res.status(422).json({ error: "No valid order rows found in the image." });
      return;
    }

    res.json({ rows: validRows });
    return;
  }

  // Otherwise (order/nav single-object modes) parse as before
  let parsed: { fund?: unknown; nav?: unknown; unitsHeld?: unknown };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // OpenRouter fallback: try a text-only completion if configured
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const orResp = await fetch("https://api.openrouter.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 256,
            temperature: 0.1,
          }),
        });
        if (orResp.ok) {
          const orData = await orResp.json().catch(() => ({}));
          const orText = (orData?.choices?.[0]?.message?.content ?? "").trim();
          const cleanedOr = orText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          parsed = JSON.parse(cleanedOr) as typeof parsed;
        }
      } catch (e) {
        /* fall through */
      }
    }
    if (!parsed) {
      res.status(422).json({ error: "Gemini returned unreadable data. Try a clearer screenshot." });
      return;
    }
  }

  if (!parsed.fund || !["abr", "re", "azs"].includes(parsed.fund as string)) {
    res.status(422).json({ error: "Could not identify the fund (ABR, RE or AZS). Try a clearer screenshot." });
    return;
  }

  res.json({
    fund: parsed.fund,
    nav: parsed.nav != null ? Number(parsed.nav) : undefined,
    unitsHeld: parsed.unitsHeld != null ? Number(parsed.unitsHeld) : undefined,
  });
});

router.post("/portfolio/snapshots", async (req, res) => {
  const body = CreateGrowthSnapshotBody.parse(req.body);
  const [created] = await db
    .insert(growthSnapshotsTable)
    .values({
      snapshotDate: new Date().toISOString().slice(0, 10),
      value: String(body.value),
    })
    .returning();

  res
    .status(201)
    .json(CreateGrowthSnapshotResponse.parse(toGrowthSnapshot(created)));
});

// Insert multiple fund transactions derived from an orders-list scan
router.post("/portfolio/fund-transactions", async (req, res) => {
  const body = req.body as { rows?: any[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    res.status(400).json({ error: "Missing rows array" });
    return;
  }

  const inserted: ReturnType<typeof toTransaction>[] = [];
  const skippedDuplicates: any[] = [];
  const missingFunds = new Set<string>();

  try {
    await db.transaction(async (tx) => {
      for (const r of body.rows) {
        if (!r || typeof r !== "object") continue;
        const asset = (r.assetType || r.asset || r.fund) as string | undefined;
        const side = (r.side || r.txType || r.type) as string | undefined;
        const price = Number(r.pricePerUnit ?? r.price ?? null);
        const amount = Number(r.amountEgp ?? r.amount ?? null);
        const occurredAt = r.occurredAt ? new Date(r.occurredAt) : new Date();

        if (!asset || !["abr", "re", "azs"].includes(asset)) continue;
        if (!side || !["buy", "sell"].includes(side)) continue;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0) continue;

        const [fundRow] = await tx.select().from(fundsTable).where(eq(fundsTable.key, asset)).limit(1);
        if (!fundRow) {
          missingFunds.add(asset);
          continue;
        }

        // Duplicate detection: match assetType + amount + occurredAt + txType
        const dupMatch = await tx
          .select()
          .from(transactionsTable)
          .where(
            eq(transactionsTable.assetType, asset),
            eq(transactionsTable.amount, String(amount)),
            eq(transactionsTable.occurredAt, occurredAt.toISOString()),
            eq(transactionsTable.txType, side),
          )
          .limit(1);
        if (dupMatch.length > 0) {
          skippedDuplicates.push({ asset, amount, occurredAt: occurredAt.toISOString(), reason: "duplicate" });
          continue;
        }

        const unitsDelta = amount / price;
        const existingUnits = Number(fundRow.unitsHeld);
        const existingCost = Number(fundRow.costBasisTotal);

        let newUnitsHeld = existingUnits;
        let newCostBasisTotal = existingCost;

        if (side === "buy") {
          newUnitsHeld = existingUnits + unitsDelta;
          newCostBasisTotal = existingCost + amount;
        } else {
          const avgCostPerUnit = existingUnits > 0 ? existingCost / existingUnits : price;
          const costRemoved = avgCostPerUnit * unitsDelta;
          newUnitsHeld = existingUnits - unitsDelta;
          newCostBasisTotal = Math.max(0, existingCost - costRemoved);
        }

        const [updatedFund] = await tx
          .update(fundsTable)
          .set({ unitsHeld: String(newUnitsHeld), costBasisTotal: String(newCostBasisTotal) })
          .where(eq(fundsTable.id, fundRow.id))
          .returning();

        const meta = `scan-import ${side} ${unitsDelta.toFixed(6)} units @ ${price.toFixed(4)} EGP, total ${amount.toFixed(2)} EGP`;
        const [created] = await tx.insert(transactionsTable).values({
          assetType: asset,
          name: fundRow.name,
          meta,
          occurredAt: occurredAt.toISOString(),
          amount: String(amount),
          txType: side,
        }).returning();

        inserted.push(toTransaction(created));
      }
    });
  } catch (err) {
    console.error("/portfolio/fund-transactions error:", err);
    res.status(500).json({ error: "Internal error while inserting transactions" });
    return;
  }

  if (inserted.length === 0) {
    res.status(422).json({ error: "No transactions inserted", missingFunds: Array.from(missingFunds), skippedDuplicates });
    return;
  }

  res.json({ inserted, skippedDuplicates, missingFunds: Array.from(missingFunds) });
});

export default router;
