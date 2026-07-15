// ── DATA SOURCE POLICY ──────────────────────────────────────────────────
// Every field returned by these routes must come from a live `db.select()`
// against Postgres. Never hardcode a financial value, never substitute a
// "reasonable default" for a missing column, and never add a seed/sample
// data path here. If a required row is missing, return an explicit error
// (e.g. NOT_SEEDED below) so the frontend can show a clear empty/error
// state instead of a fabricated number.
// ─────────────────────────────────────────────────────────────────────────

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getGoldPrices } from "../lib/goldPriceCache";
import { getGlobalGoldPrice } from "../lib/globalGoldCache";
import { getUsdEgpRate } from "../lib/usdEgpCache";
import { getEurEgpRate } from "../lib/eurEgpCache";
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
    assetType: row.assetType as "gold" | "abr" | "re",
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

router.get("/portfolio", async (_req, res) => {
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

  if (!image || !mimeType || !mode || !apiKey) {
    res.status(400).json({ error: "Missing required fields: image, mimeType, mode, apiKey" });
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
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

  if (!geminiRes || !geminiRes.ok) {
    const status = geminiRes?.status ?? 429;
    // Log the technical detail server-side for debugging, but show the user
    // a plain-language message — they can't act on a raw Google API string.
    console.warn(
      `[scan] all models exhausted (last: ${lastModel}, status: ${status}): ${lastErrData?.error?.message ?? "no detail"}`,
    );
    const friendlyMessage =
      status === 429 || status === 503
        ? "Gemini is busy or your key's quota is used up right now. Wait a bit and try again, or enter the values manually."
        : "Could not read the image — please try again or enter the values manually.";
    res.status(status).json({ error: friendlyMessage });
    return;
  }

  const data = (await geminiRes.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: { fund?: unknown; nav?: unknown; unitsHeld?: unknown };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    res.status(422).json({ error: "Gemini returned unreadable data. Try a clearer screenshot." });
    return;
  }

  if (!parsed.fund || !["abr", "re"].includes(parsed.fund as string)) {
    res.status(422).json({ error: "Could not identify the fund (ABR or RE). Try a clearer screenshot." });
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

export default router;
