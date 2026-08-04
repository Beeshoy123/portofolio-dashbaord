// ── DATA SOURCE POLICY ──────────────────────────────────────────────────
// This file only ever renders values passed in via `Portfolio`/`Derived`,
// which are fetched live from the database through the API. Do not
// hardcode a financial number here — if a figure isn't available (e.g. no
// live gold price feed yet), render an explicit "unavailable" state
// instead of a placeholder value.
// ─────────────────────────────────────────────────────────────────────────

import type { Portfolio } from "@workspace/api-client-react";
import type { Derived } from "./portfolioMath";
import { fmt, fmt1, fmt2 } from "./portfolioMath";
import type { Lang } from "./i18n";

function pctStr(n: number, digits = 1): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function heatColor(pct: number): string {
  if (pct >= 5) return "#1a6b5a";
  if (pct >= 0) return "#2a8a70";
  if (pct >= -5) return "#e07060";
  return "#c94035";
}

/** Horizontal attribution bar row used in the Total-view Capital and Income panels. */
function attribBar(
  icon: string, label: string, sub: string,
  barPct: number, valLabel: string, valColor: string,
  labelKey?: string, subKey?: string,
): string {
  const w = Math.min(100, Math.abs(barPct));
  const labelHtml = labelKey ? `<span data-i18n="${labelKey}">${label}</span>` : label;
  const subHtml   = subKey   ? `<span data-i18n="${subKey}">${sub}</span>`   : sub;
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <div style="width:68px;flex-shrink:0">
      <div style="font-size:10.5px;font-weight:700;color:var(--fg)">${icon} ${labelHtml}</div>
      <div style="font-size:9px;color:var(--dim);margin-top:1px">${subHtml}</div>
    </div>
    <div style="flex:1;background:var(--edge);border-radius:4px;height:5px;overflow:hidden">
      <div style="height:100%;width:${w}%;background:${valColor};border-radius:4px;transition:width .5s ease"></div>
    </div>
    <div style="min-width:88px;text-align:right;font-size:10px;font-weight:700;color:${valColor}">${valLabel}</div>
  </div>`;
}

// Donut ring built from four segments (gold, abr, re, cert) as fractions of
// a circle with r=28 (circumference ≈ 175.93).
function buildDonutRing(d: Derived): string {
  const r = 28;
  const c = 2 * Math.PI * r;
  const segments = [
    { pct: d.allocation.pctGold, color: "#b8893f" },
    { pct: d.allocation.pctAbr, color: "#0f6a5e" },
    { pct: d.allocation.pctRe, color: "#e05a50" },
    { pct: d.allocation.pctCert, color: "#8b6fb0" },
  ];
  let offset = 0;
  const circles = segments
    .map((seg) => {
      const len = Math.max(0, (seg.pct / 100) * c);
      const dashOffset = -offset;
      offset += len;
      return `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${seg.color}" stroke-width="9" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 32 32)"></circle>`;
    })
    .join("");
  return circles;
}

const GOLD_PRICE_UNAVAILABLE = "Live price unavailable";
const GOLD_PNL_UNAVAILABLE = "PnL unavailable — live price pending";

// ── Gold Cohort Analysis ───────────────────────────────────────────────────
// Breaks the gold position into individual purchase batches from
// p.gold.transactions. Current value uses the live sell price from
// goldbullioneg.com; profit includes the dealer cashback on sell.
// Shows a "live price pending" state when the scrape hasn't run yet.
function buildGoldCohortAnalysis(p: Portfolio, d: Derived): string {
  type GoldTx = Portfolio["gold"]["transactions"][number];
  const txs = [...(p.gold.transactions as GoldTx[])].sort(
    (a: GoldTx, b: GoldTx) =>
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (txs.length === 0) {
    return `<div style="grid-column:span 6;margin-top:var(--gap)" data-view-card="gold-cohort">
      <div class="card"><div class="card-lbl" data-i18n="card.cohort.gold">📊 Cohort Analysis · Gold Purchases</div>
      <div style="font-size:11px;color:var(--dim);padding:12px 0" data-i18n="cohort.empty">No gold transactions recorded yet.</div></div>
    </div>`;
  }

  const livePrice = d.gold.livePricePerGram;
  const cashback = d.gold.cashbackPerGram;
  const priceAvail = livePrice !== null;

  let totalPaid = 0;
  let totalGrams = 0;
  let totalCurrentValue = 0;
  let totalProfit = 0;

  const dataRows = txs.map((tx: GoldTx, i: number) => {
    const avgCostPerGram = tx.totalWeightGrams > 0
      ? tx.totalPaid / tx.totalWeightGrams
      : 0;
    const currentValue = priceAvail ? tx.totalWeightGrams * livePrice! : null;
    const profitNet = priceAvail
      ? (currentValue! + tx.totalWeightGrams * cashback) - tx.totalPaid
      : null;
    const returnPct = priceAvail && tx.totalPaid > 0
      ? (profitNet! / tx.totalPaid) * 100
      : null;
    const profitColor = profitNet !== null
      ? profitNet >= 0 ? "var(--teal)" : "var(--coral)"
      : "var(--dim)";

    const dateStr = new Date(tx.date).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "2-digit",
    });

    totalPaid += tx.totalPaid;
    totalGrams += tx.totalWeightGrams;
    if (priceAvail && currentValue !== null) totalCurrentValue += currentValue;
    if (priceAvail && profitNet !== null) totalProfit += profitNet;

    const valueCell = priceAvail
      ? `<td style="font-weight:700">${fmt2(currentValue!)}</td>`
      : `<td style="color:var(--dim)">—</td>`;
    const profitCell = priceAvail
      ? `<td style="font-weight:700;color:${profitColor}">${profitNet! >= 0 ? "+" : ""}${fmt2(profitNet!)}</td>`
      : `<td style="color:var(--dim);font-size:10px" data-i18n="cohort.live.pending">live pending</td>`;
    const returnCell = priceAvail
      ? `<td style="font-weight:800;color:${profitColor}">${returnPct! >= 0 ? "+" : ""}${returnPct!.toFixed(2)}%</td>`
      : `<td style="color:var(--dim)">—</td>`;

    return `<tr>
      <td><span style="font-size:10px;font-weight:800;background:var(--bg);border:1px solid var(--edge);border-radius:6px;padding:2px 7px;color:var(--gold,#b8893f)">B${i + 1}</span></td>
      <td style="color:var(--dim);font-size:11px">${dateStr}</td>
      <td style="font-weight:600">${fmt2(tx.totalPaid)}</td>
      <td style="font-weight:600">${fmt(tx.totalWeightGrams)}g</td>
      <td style="color:var(--dim)">${tx.karat}K · ${tx.quantity}×${fmt(tx.weightPerUnitGrams)}g</td>
      <td style="color:var(--dim)">${fmt2(avgCostPerGram)}</td>
      ${valueCell}${profitCell}${returnCell}
    </tr>`;
  });

  const totalAvgCost = totalGrams > 0 ? totalPaid / totalGrams : 0;
  const totalReturnPct = priceAvail && totalPaid > 0 ? (totalProfit / totalPaid) * 100 : null;
  const totalProfitColor = totalProfit >= 0 ? "var(--teal)" : "var(--coral)";

  const totalValueCell = priceAvail
    ? `<td style="font-weight:800">${fmt2(totalCurrentValue)}</td>`
    : `<td style="color:var(--dim)">—</td>`;
  const totalProfitCell = priceAvail
    ? `<td style="font-weight:800;color:${totalProfitColor}">${totalProfit >= 0 ? "+" : ""}${fmt2(totalProfit)}</td>`
    : `<td style="color:var(--dim);font-size:10px" data-i18n="cohort.live.pending">live pending</td>`;
  const totalReturnCell = priceAvail && totalReturnPct !== null
    ? `<td style="font-weight:800;color:${totalProfitColor}">${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%</td>`
    : `<td style="color:var(--dim)">—</td>`;

  const priceNote = priceAvail
    ? `<span data-i18n="cohort.sell.prefix">Sell:</span> <b>${fmt(livePrice!)} EGP/g</b> · <span data-i18n="cohort.cashback.prefix">Cashback:</span> <b>${fmt2(cashback)} EGP/g</b> · <span data-i18n="cohort.profit.formula">Profit = (Value + Cashback) − Paid</span>`
    : `<span data-i18n="cohort.price.pending">⏳ Live sell price pending — goldbullioneg.com scrape in progress</span>`;

  return `<div style="grid-column:span 6;margin-top:var(--gap)" data-view-card="gold-cohort">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px">
        <div class="card-lbl" data-i18n="card.cohort.gold">📊 Cohort Analysis · Gold Purchases</div>
      </div>
      <div style="font-size:10px;color:${priceAvail ? "var(--teal)" : "var(--dim)"};margin-bottom:16px">${priceNote}</div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="ah-table" style="min-width:640px">
          <thead><tr>
            <th><span data-i18n="cohort.th.cohort">Cohort</span></th>
            <th><span data-i18n="cohort.th.date">Date</span></th>
            <th><span data-i18n="cohort.th.paid">Paid (EGP)</span></th>
            <th><span data-i18n="cohort.th.weight">Weight</span></th>
            <th><span data-i18n="cohort.th.bar.karat">Bar / Karat</span></th>
            <th><span data-i18n="cohort.th.avg.cost">Avg Cost/g</span></th>
            <th><span data-i18n="cohort.th.curr.value">Current Value (EGP)</span></th>
            <th><span data-i18n="cohort.th.profit.cb">Profit incl. Cashback</span></th>
            <th><span data-i18n="cohort.th.return">Return (%)</span></th>
          </tr></thead>
          <tbody>
            ${dataRows.join("")}
            <tr class="cohort-total-row">
              <td colspan="2" style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)"><span data-i18n="cohort.total">Total</span></td>
              <td style="font-weight:800">${fmt2(totalPaid)}</td>
              <td style="font-weight:800">${fmt(totalGrams)}g</td>
              <td style="color:var(--dim)">—</td>
              <td style="color:var(--dim)">${fmt2(totalAvgCost)}</td>
              ${totalValueCell}${totalProfitCell}${totalReturnCell}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// ── Cohort Analysis ────────────────────────────────────────────────────────
// Breaks each fund's position into its individual buy batches, computes
// current value (units × live NAV) and profit/return for each cohort, and
// totals them. Data comes exclusively from p.transactions + live NAV — no
// hardcoded numbers.
//
// Fund-type distinctions (per product spec):
//   ABR (Bareeq):  Fixed-income accumulative. NAV accrues daily. NO dividend
//                  harvesting or yield-sale logic — profit is pure NAV growth.
//   RE  (Beltone): Equity/RE fund. Performance is NAV market volatility.
//                  Average cost basis logic applies.
function buildCohortAnalysis(p: Portfolio, d: Derived): string {
  // Parse unit count from meta strings like:
  //   "48 units @ EGP 206.988"  → 48
  //   "2,656 units @ EGP 1.888" → 2656
  function parseUnits(meta: string): number {
    const m = meta.replace(/,/g, "").match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  // Parse avg cost per unit from meta strings like "48 units @ EGP 206.988" → 206.988
  function parseAvgCost(meta: string): number {
    const m = meta.match(/EGP\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function buildFundTable(
    assetKey: string,
    currentNav: number,
    label: string,
    fundTypeNote: string,
    accentColor: string,
  ): string {
    const fundTypeNoteKey = assetKey === 'abr' ? 'cohort.fund.abr.note' : 'cohort.fund.re.note';
    type Tx = Portfolio["transactions"][number];
    const buys = p.transactions
      .filter((tx: Tx) => tx.assetType === assetKey && tx.txType === "buy")
      .sort(
        (a: Tx, b: Tx) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );

    if (buys.length === 0) {
      return `<div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="font-size:12px;font-weight:800;color:var(--fg)">${label}</div>
          <div style="font-size:10px;color:var(--dim);background:var(--bg);padding:2px 8px;border-radius:10px;border:1px solid var(--edge)"><span data-i18n="${fundTypeNoteKey}">${fundTypeNote}</span></div>
        </div>
        <div style="font-size:11px;color:var(--dim);padding:12px 0" data-i18n="cohort.no.buys">No buy transactions recorded yet.</div>
      </div>`;
    }

    let totalInvested = 0;
    let totalUnits = 0;
    let totalCurrentValue = 0;

    const dataRows = (buys as Tx[])
      .map((tx: Tx, i: number) => {
        const units = parseUnits(tx.meta);
        const avgCost = parseAvgCost(tx.meta);
        const invested = tx.amount;
        const currentValue = units * currentNav;
        const profit = currentValue - invested;
        const returnPct = invested > 0 ? (profit / invested) * 100 : 0;
        const profitColor =
          profit >= 0 ? "var(--teal)" : "var(--coral)";
        const date = new Date(tx.occurredAt);
        const dateStr = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "2-digit",
        });
        totalInvested += invested;
        totalUnits += units;
        totalCurrentValue += currentValue;
        return `<tr>
          <td><span style="font-size:10px;font-weight:800;background:var(--bg);border:1px solid var(--edge);border-radius:6px;padding:2px 7px;color:${accentColor}">B${i + 1}</span></td>
          <td style="color:var(--dim);font-size:11px">${dateStr}</td>
          <td style="font-weight:600">${fmt2(invested)}</td>
          <td>${fmt(units)}</td>
          <td style="color:var(--dim)">${fmt2(avgCost)}</td>
          <td style="font-weight:700">${fmt2(currentValue)}</td>
          <td style="font-weight:700;color:${profitColor}">${profit >= 0 ? "+" : ""}${fmt2(profit)}</td>
          <td style="font-weight:800;color:${profitColor}">${profit >= 0 ? "+" : ""}${returnPct.toFixed(2)}%</td>
        </tr>`;
      })
      .join("");

    const totalProfit = totalCurrentValue - totalInvested;
    const totalReturn =
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const totalProfitColor =
      totalProfit >= 0 ? "var(--teal)" : "var(--coral)";
    const totalAvgCost =
      totalUnits > 0 ? totalInvested / totalUnits : 0;

    const totalRow = `<tr class="cohort-total-row">
      <td colspan="2" style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)"><span data-i18n="cohort.total">Total</span></td>
      <td style="font-weight:800">${fmt2(totalInvested)}</td>
      <td style="font-weight:800">${fmt(totalUnits)}</td>
      <td style="color:var(--dim)">${fmt2(totalAvgCost)}</td>
      <td style="font-weight:800">${fmt2(totalCurrentValue)}</td>
      <td style="font-weight:800;color:${totalProfitColor}">${totalProfit >= 0 ? "+" : ""}${fmt2(totalProfit)}</td>
      <td style="font-weight:800;color:${totalProfitColor}">${totalProfit >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%</td>
    </tr>`;

    return `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div style="font-size:12px;font-weight:800;color:var(--fg)">${label}</div>
        <div style="font-size:9.5px;color:${accentColor};background:var(--bg);padding:2px 8px;border-radius:10px;border:1px solid ${accentColor};opacity:.8"><span data-i18n="${fundTypeNoteKey}">${fundTypeNote}</span></div>
        <div style="font-size:9.5px;color:var(--dim);margin-left:auto">NAV: <b style="color:var(--fg)">${fmt2(currentNav)}</b> EGP</div>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="ah-table" style="min-width:580px">
          <thead><tr>
            <th><span data-i18n="cohort.th.cohort">Cohort</span></th>
            <th><span data-i18n="cohort.th.date">Date</span></th>
            <th><span data-i18n="cohort.th.invested">Invested (EGP)</span></th>
            <th><span data-i18n="cohort.th.units">Units</span></th>
            <th><span data-i18n="cohort.th.avg.unit">Avg. Cost/Unit</span></th>
            <th><span data-i18n="cohort.th.curr.value">Current Value (EGP)</span></th>
            <th><span data-i18n="cohort.th.profit">Profit (EGP)</span></th>
            <th><span data-i18n="cohort.th.return">Return (%)</span></th>
          </tr></thead>
          <tbody>
            ${dataRows}
            ${totalRow}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  return `<div style="grid-column:span 6;margin-top:var(--gap)" data-view-card="cohort">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">
        <div class="card-lbl" data-i18n="card.cohort.batches">📊 Cohort Analysis · Buy Batches</div>
        <div style="font-size:9.5px;color:var(--dim)" data-i18n="cohort.fund.profit.formula">Profit = (Units × Current NAV) − Invested</div>
      </div>
      ${buildFundTable("abr", d.abr.nav, "🏦 Bareeq Fund (ABR)", "Fixed Income · Accrual — NAV grows daily, no yield harvest", "var(--teal)")}
      <div style="height:1px;background:var(--edge);margin-bottom:20px"></div>
      ${buildFundTable("re", d.re.nav, "🏢 Beltone Real Estate (BRE)", "Equity Fund · NAV Volatility — avg cost basis", "var(--coral)")}
    </div>
  </div>`;
}

export function buildDashboardHtml(p: Portfolio, d: Derived): string {
  const goldSubCost = fmt(d.gold.avgCostPerGram);
  const goldSubMkt = d.gold.livePricePerGram !== null
    ? `${fmt(d.gold.livePricePerGram)} EGP/g`
    : GOLD_PRICE_UNAVAILABLE;
  // "Value" always falls back to cost basis when the live price isn't
  // available yet, so we never fabricate a market value.
  const goldValueDisplay = fmt2(d.gold.cost);
  const goldPnlPctDisplay = d.gold.pnlAvailable
    ? pctStr(d.gold.pnlPct!, 2)
    : "N/A";
  const goldPnlPctDisplay1 = d.gold.pnlAvailable
    ? pctStr(d.gold.pnlPct!)
    : "N/A";
  const goldHeatPct = d.gold.pnlPct ?? 0;

  // Gold price fields added by the server-side scraper (goldbullioneg.com).
  const goldPriceStatus = p.gold.goldPriceStatus;
  const goldDotClass =
    goldPriceStatus === "live" ? "live-dot ok" : "live-dot err";
  const goldBadgeClass =
    goldPriceStatus === "live"
      ? "status-badge status-live"
      : "status-badge status-fallback";
  const goldBadgeText =
    goldPriceStatus === "live"
      ? "live"
      : goldPriceStatus === "fallback"
        ? "fallback"
        : "unavail";
  // USD/EGP rate fields added by the server-side cache (open.er-api.com).
  const usdStatus = p.settings.usdEgpStatus;
  const usdDotClass = usdStatus === "live" ? "live-dot ok" : "live-dot err";
  const usdBadgeClass = usdStatus === "live" ? "status-badge status-live" : "status-badge status-fallback";
  const usdBadgeText = usdStatus === "live" ? "live" : usdStatus === "fallback" ? "fallback" : "unavail";
  // EUR/EGP rate fields.
  const eurStatus = (p.settings as any).eurEgpStatus as string | null;
  const eurRate = (p.settings as any).eurEgpRate as number | null;
  const eurDotClass = eurStatus === "live" ? "live-dot ok" : eurStatus === "fallback" ? "live-dot warn" : "live-dot err";
  const eurBadgeClass = eurStatus === "live" ? "status-badge status-live" : "status-badge status-fallback";
  const eurBadgeText = eurStatus === "live" ? "live" : eurStatus === "fallback" ? "fallback" : "unavail";
  const eurRateLabel = eurRate != null ? eurRate.toFixed(2) : "—";
  // Show the live-bar immediately if either feed has data.
  const liveBarStyle = (goldPriceStatus || usdStatus) ? "display:flex" : "display:none";
  // Upper-right "Live Rates" box content.
  const rateBoxContent =
    d.gold.pnlAvailable && p.gold.buyPrice24k
      ? `Sell: ${fmt(d.gold.livePricePerGram!)} EGP/g · Buy: ${fmt(p.gold.buyPrice24k)} EGP/g<br>USD/EGP: ${fmt2(d.settings.usdEgpRate)}`
      : `Gold: ${goldSubMkt}<br>USD/EGP: ${fmt2(d.settings.usdEgpRate)}`;
  // Performance card — gold P&L headline.
  const goldPnlLabel = d.gold.pnlAvailable
    ? `${d.gold.netPnl! >= 0 ? "+" : ""}${fmt(d.gold.netPnl!)} EGP net`
    : GOLD_PNL_UNAVAILABLE;
  const goldPnlColor = d.gold.pnlAvailable
    ? d.gold.netPnl! >= 0
      ? "var(--teal)"
      : "var(--coral)"
    : "var(--dim)";
  const goldPnlSubLabel = d.gold.pnlAvailable
    ? `${pctStr(d.gold.pnlPct!)} raw · ${fmt2(d.gold.cashbackPerGram)} EGP/g cashback on sell`
    : `Cashback rate on file: ${fmt2(d.gold.cashbackPerGram)} EGP/g (applied on sell)`;
  // Spot-check line: my weighted avg cost per gram vs. what I'd actually
  // net per gram if I sold right now (live sell price + cashback).
  const goldEffectiveSellPerGram = d.gold.pnlAvailable
    ? d.gold.livePricePerGram! + d.gold.cashbackPerGram
    : null;
  const goldAvgVsSellColor =
    goldEffectiveSellPerGram !== null
      ? goldEffectiveSellPerGram >= d.gold.avgCostPerGram
        ? "var(--teal)"
        : "var(--coral)"
      : "var(--dim)";
  const goldAvgVsSellLabel =
    goldEffectiveSellPerGram !== null
      ? `<span data-i18n="perf.my.avg">My Avg:</span> ${fmt2(d.gold.avgCostPerGram)} EGP/g <span data-i18n="perf.vs.sell.cb">vs Sell+Cashback:</span> ${fmt2(goldEffectiveSellPerGram)} EGP/g`
      : `<span data-i18n="perf.my.avg">My Avg:</span> ${fmt2(d.gold.avgCostPerGram)} EGP/g <span data-i18n="perf.vs.sell.cb">vs Sell+Cashback:</span> <span data-i18n="attr.price.pending">live price pending</span>`;
  // Gold row in the P&L breakdown list.
  const goldPnlRowRight = d.gold.pnlAvailable
    ? `<div class="pnl-row-val" style="color:${d.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"}">${d.gold.netPnl! >= 0 ? "+" : ""}${fmt(d.gold.netPnl!)} EGP</div><div id="gold-pnl-row-meta" style="font-size:9.5px;color:${d.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"};font-weight:600">${pctStr(d.gold.pnlPct!)} <span data-i18n="pnl.gold.sell.cb">(sell + cashback)</span></div>`
    : `<div class="pnl-row-val" style="color:var(--dim)">N/A</div><div id="gold-pnl-row-meta" style="font-size:9.5px;color:var(--dim);font-weight:600" data-i18n="pnl.gold.pending">live price pending</div>`;
  // ── Total-view performance panel helpers ─────────────────────────────────
  const totCapColor = d.total.capitalPnl >= 0 ? "var(--teal)" : "var(--coral)";
  const totCapLabel = `${d.total.capitalPnl >= 0 ? "+" : ""}${fmt(d.total.capitalPnl)} EGP <span data-i18n="perf.net.word">net</span>`;
  const totCapPctStr = pctStr(d.total.cost > 0 ? (d.total.capitalPnl / d.total.cost) * 100 : 0);
  const goldCapLabel = d.gold.pnlAvailable
    ? `${(d.gold.netPnl ?? 0) >= 0 ? "+" : ""}${fmt(d.gold.netPnl ?? 0)} EGP`
    : `<span data-i18n="attr.price.pending">live price pending</span>`;
  const goldCapColor = d.gold.pnlAvailable
    ? (d.gold.netPnl ?? 0) >= 0 ? "var(--teal)" : "var(--coral)"
    : "var(--dim)";
  const liquidCapLabel = `${d.liquid.pnl >= 0 ? "+" : ""}${fmt(d.liquid.pnl)} EGP`;
  const liquidCapColor = d.liquid.pnl >= 0 ? "var(--teal)" : "var(--coral)";
  const abrAnnualIncEgp = fmt(Math.round(d.abr.monthlyYield * 12));
  const certAnnualIncEgp = fmt(Math.round(d.certTotals.annualYield));
  const totIncomeMonthly = `${d.yield.totalMonthly >= 0 ? "+" : ""}${fmt(Math.round(d.yield.totalMonthly))}`;

  // math-gold expandable section.
  const mathGoldRows = d.gold.pnlAvailable
    ? `<div class="math-line"><span class="math-label" data-i18n="ml.sell.price">Sell Price:</span><span class="math-calc">24K · goldbullioneg.com</span><span class="math-result">${fmt(d.gold.livePricePerGram!)} EGP/g</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.curr.value">Current Value:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt(d.gold.livePricePerGram!)} EGP/g</span><span class="math-result">= ${fmt(d.gold.value!)} EGP</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.cost.basis">Cost Basis:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubCost} EGP/g</span><span class="math-result">= ${fmt(d.gold.cost)} EGP</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.raw.pnl">Raw PnL:</span><span class="math-calc" data-i18n="mc.val.minus.cost">value − cost</span><span class="math-result">${d.gold.rawPnl! >= 0 ? "+" : ""}${fmt(d.gold.rawPnl!)} EGP</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.sell.cashback">Sell Cashback:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt2(d.gold.cashbackPerGram)} EGP/g</span><span class="math-result">= ${fmt(d.gold.cashback!)} EGP</span></div>
  <div class="math-divider"></div>
  <div class="math-line math-total${d.gold.netPnl! >= 0 ? "" : " neg"}"><span class="math-label" data-i18n="ml.net.pnl">Net PnL:</span><span class="math-calc" data-i18n="mc.val.cb.minus.cost">(value + cashback) − cost</span><span class="math-result">${d.gold.netPnl! >= 0 ? "+" : ""}${fmt(d.gold.netPnl!)} EGP</span></div>`
    : `<div class="math-line"><span class="math-label" data-i18n="ml.curr.value">Current Value:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubMkt}</span><span class="math-result">${GOLD_PRICE_UNAVAILABLE}</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.cost.basis">Cost Basis:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubCost} EGP/g</span><span class="math-result">= ${fmt(d.gold.cost)} EGP</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.raw.pnl">Raw PnL:</span><span class="math-calc" data-i18n="mc.val.minus.cost">value − cost</span><span class="math-result">N/A</span></div>
  <div class="math-line"><span class="math-label" data-i18n="ml.sell.cashback">Sell Cashback:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt2(d.gold.cashbackPerGram)} EGP/g</span><span class="math-result" data-i18n="mc.refunded.on.sell">added on sell, not cost basis</span></div>
  <div class="math-divider"></div>
  <div class="math-line math-total"><span class="math-label" data-i18n="ml.net.pnl">Net PnL:</span><span class="math-calc" data-i18n="mc.val.cb.minus.cost">(value + cashback) − cost</span><span class="math-result">${GOLD_PNL_UNAVAILABLE}</span></div>`;

  return `
<div id="dashboard-root">

<div class="header">
  <h1 id="app-title">📊 Portfolio · Beeshoy</h1>
  <button class="icon-btn" onclick="doRefresh()" id="refresh-btn" title="Refresh live prices">🔄</button>
  <button class="icon-btn" onclick="openInsights()" title="Insights &amp; Actions">ℹ️</button>
  <button class="icon-btn" onclick="openAdd()" title="Add data">➕</button>
  <div class="settings-wrap">
    <button class="icon-btn" id="settings-btn" onclick="toggleSettings()" title="Settings" aria-label="Settings">⚙️</button>
    <div class="settings-dropdown" id="settings-dropdown">
      <button class="settings-item" onclick="toggleDark();closeSettings()">
        <span class="settings-item-icon" id="dark-mode-icon">🌙</span>
        <span id="dark-mode-label">Dark mode</span>
      </button>
      <div class="settings-divider"></div>
      <button class="settings-item" onclick="toggleLang();closeSettings()">
        <span class="settings-item-icon" id="lang-icon" style="font-family:'Cairo',sans-serif;font-weight:700">ع</span>
        <span id="lang-label">العربية</span>
      </button>
    </div>
  </div>
</div>

<div class="view-toggle-bar" id="view-toggle-bar">
  <span class="view-toggle-slider" id="view-toggle-slider"></span>
  <button class="view-btn active" id="view-btn-total" onclick="setView('total')">📊 Total</button>
  <button class="view-btn gold-view" id="view-btn-gold" onclick="setView('gold')">🥇 Gold</button>
  <button class="view-btn liquid-view" id="view-btn-liquid" onclick="setView('liquid')">💧 Liquid</button>
  <button class="view-btn cert-view" id="view-btn-certs" onclick="setView('certs')">🏦 Certificates</button>
  <button class="view-btn ai-view" id="view-btn-ai" onclick="setView('ai')">🤖 AI Insights</button>
</div>
<div class="view-label" id="view-label">All assets · full portfolio</div>

<div class="api-warning" id="api-warning" style="display:flex">
  ⚠️
  <span id="api-warning-text" data-i18n="warning.text">USD exchange rate &amp; Gold price unavailable — using fallback estimates. Prices may be inaccurate.</span>
  <button onclick="doRefresh()" style="margin-left:8px;background:var(--card);border:1px solid var(--edge);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;cursor:pointer" data-i18n="warning.retry">Retry</button>
  <button onclick="dismissWarning()" style="margin-left:4px;background:transparent;border:none;font-size:14px;cursor:pointer;padding:0 4px">×</button>
</div>

<div class="live-bar" id="live-bar" style="${liveBarStyle}">
  <span class="${goldDotClass}" id="dot-gold"></span>
  <span class="live-pill"><span data-i18n="live.gold">Gold 24K:</span> <b id="live-gold">${goldSubMkt}</b> <span id="gold-status" class="${goldBadgeClass}">${goldBadgeText}</span></span>
  <span class="live-dot" id="dot-xau"></span>
  <span class="live-pill"><span data-i18n="live.xau">XAU:</span> <b id="live-xau">—</b> <span style="font-size:9px;color:var(--dim)">USD/oz</span> <span id="xau-status" class="status-badge"></span></span>
  <span class="${usdDotClass}" id="dot-usd"></span>
  <span class="live-pill"><span data-i18n="live.usd">USD/EGP:</span> <b id="live-usd">${fmt2(d.settings.usdEgpRate)}</b> <span id="usd-status" class="${usdBadgeClass}">${usdBadgeText}</span></span>
  <span class="${eurDotClass}" id="dot-eur"></span>
  <span class="live-pill"><span data-i18n="live.eur">EUR/EGP:</span> <b id="live-eur">${eurRateLabel}</b> <span id="eur-status" class="${eurBadgeClass}">${eurBadgeText}</span></span>
  <span class="live-time" id="live-time"></span>
</div>

<div class="bento">

  <!-- ① HERO TOTAL -->
  <div class="card dark s-6" style="padding:26px 28px" data-view-card="hero">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="card-lbl"><span id="hero-title">Total Portfolio Value</span> <span class="info-icon" onclick="toggleMath('math-total')" title="Show calculation">ℹ</span></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a7a74;margin-top:10px;margin-bottom:4px" id="hero-sublabel">Total Cost Basis · EGP</div>
        <div style="font-family:'Sora',sans-serif;font-size:50px;font-weight:800;line-height:1;letter-spacing:-.02em" id="s-total">${fmt(d.total.cost)} EGP</div>
        <div style="font-size:12px;font-weight:600;margin-top:10px;color:${d.total.pnl >= 0 ? "var(--teal)" : "var(--coral)"}" id="s-total-chg" class="${d.total.pnl >= 0 ? "pos" : "neg"}">${d.total.pnl >= 0 ? "▲" : "▼"} <span data-i18n="hero.market.value">Market Value:</span> ${fmt(d.total.value)} EGP (<span data-i18n="hero.net.pnl">net PnL</span> ${d.total.pnl >= 0 ? "+" : ""}${fmt(d.total.pnl)} EGP, ${pctStr(d.total.pnlPct)})</div>
        <!-- GOLD STAT ROW — visible only in gold view, shown/hidden by setView() -->
        <div id="gold-hero-stats" style="display:none;flex-wrap:wrap;gap:20px;margin-top:16px">
          <div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a7a74" data-i18n="gold.stat.avg">Avg Cost</div>
            <div style="font-size:16px;font-weight:800;color:var(--ink)" id="gold-stat-avg">${fmt(d.gold.avgCostPerGram)} <span style="font-size:11px;font-weight:600;color:#5a7a74">EGP/g</span></div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a7a74" data-i18n="gold.stat.grams">Grams Held</div>
            <div style="font-size:16px;font-weight:800;color:var(--ink)" id="gold-stat-grams">${fmt(d.gold.gramsHeld)} <span style="font-size:11px;font-weight:600;color:#5a7a74">g</span></div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a7a74" data-i18n="gold.stat.live">Live Price</div>
            <div style="font-size:16px;font-weight:800;color:${d.gold.pnlAvailable ? "var(--teal)" : "#5a7a74"}" id="gold-stat-live">${d.gold.pnlAvailable ? `${fmt(d.gold.livePricePerGram!)} <span style="font-size:11px;font-weight:600;color:#5a7a74">EGP/g</span>` : `<span style="font-size:11px;font-weight:600" data-i18n="attr.price.pending">live price pending</span>`}</div>
          </div>
        </div>
        <div class="math-section" id="math-total"><div id="hero-math-body"></div></div>
      </div>
      <div id="rate-box-container" style="display:none"></div>
    </div>
  </div>

<!-- GOLD COHORT ANALYSIS — gold view only -->
${buildGoldCohortAnalysis(p, d)}

<!-- COHORT ANALYSIS — liquid view only -->
${buildCohortAnalysis(p, d)}

  <!-- ② HOLDINGS HEATMAP — primary card -->
  <div class="card s-4" data-view-card="heatmap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-lbl" id="heatmap-label" style="font-size:12px" data-i18n="card.heatmap">Holdings Heatmap</div>
      <div style="font-size:10px;color:var(--dim)" data-i18n="heatmap.legend">size = value · color = return</div>
    </div>
    <div id="heatmap-container" style="width:100%;aspect-ratio:16/7;position:relative;border-radius:12px;overflow:hidden">
      <div class="hm-cell" id="hm-cert-cell" style="left:3px;top:3px;width:43%;height:94%;background:${heatColor(d.certTotals.weightedAvgRate)};animation-delay:0ms"><div class="hm-name" style="font-size:15px">Certificates</div><div class="hm-pct" style="font-size:13px" id="hm-cert-pct">${pctStr(d.certTotals.weightedAvgRate)}</div></div>
      <div class="hm-cell" style="left:47%;top:3px;width:50%;height:55%;background:${heatColor(goldHeatPct)};animation-delay:80ms"><div class="hm-name" style="font-size:15px">Gold 24K</div><div class="hm-pct" style="font-size:13px">${goldPnlPctDisplay1}</div></div>
      <div class="hm-cell" style="left:47%;top:60%;width:37%;height:37%;background:${heatColor(d.abr.pnlPct)};animation-delay:160ms"><div class="hm-name" style="font-size:13px">Bareeq</div><div class="hm-pct" style="font-size:11px">${pctStr(d.abr.pnlPct)}</div></div>
      <div class="hm-cell" style="left:86%;top:60%;width:11%;height:37%;background:${heatColor(d.re.pnlPct)};animation-delay:240ms"><div class="hm-name" style="font-size:9px">RE</div><div class="hm-pct" style="font-size:9px">${pctStr(d.re.pnlPct)}</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px">
      <span style="font-size:10px;color:var(--dim)" data-i18n="heatmap.loss">Loss</span>
      <div style="flex:1;height:7px;border-radius:4px;background:linear-gradient(90deg,#c94035,#e07060,#c8c0b0,#2a8a70,#1a6b5a)"></div>
      <span style="font-size:10px;color:var(--dim)" data-i18n="heatmap.gain">Gain</span>
    </div>
  </div>

  <!-- ③ PERFORMANCE -->
  <div class="card s-2" data-view-card="perf">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-lbl"><span data-i18n="card.perf">Performance</span> <span class="info-icon" id="perf-info-btn" onclick="togglePerfMath()" title="Show calculation">ℹ</span></div>
      <div style="display:flex;gap:0;background:var(--bg);border-radius:20px;padding:3px">
        <button class="perf-pill active" id="pill-pnl" onclick="switchPerf('pnl')">PnL</button>
        <button class="perf-pill" id="pill-yield" onclick="switchPerf('yield')">Yield</button>
        <button class="perf-pill" id="pill-growth" onclick="switchPerf('growth')">Growth</button>
      </div>
    </div>

    <!-- P&L VIEW -->
    <div id="perf-pnl">
      <div style="font-size:22px;margin-bottom:6px" id="perf-pnl-icon">🥇</div>
      <div style="font-family:Sora,sans-serif;font-size:20px;font-weight:800;color:${goldPnlColor}" id="gold-pnl">${goldPnlLabel}</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px;color:var(--dim)" id="gold-pnl-pct">${goldPnlSubLabel}</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:3px;color:${goldAvgVsSellColor}" id="gold-avg-vs-sell">${goldAvgVsSellLabel}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;position:relative">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)" data-i18n="perf.breakdown">Breakdown</div>
        <button class="sort-btn" id="pnl-sort-btn" onclick="toggleSortMenu(event)" title="Sort positions">
          <span class="sort-btn-icon">⇅</span><span id="pnl-sort-label">Default</span>
        </button>
        <div class="sort-popover" id="pnl-sort-popover">
          <div class="sort-popover-hint" data-i18n="perf.sort.hint">Tap a parameter to sort all your positions by it.</div>
          <button class="sort-option" id="sort-opt-value" data-key="value" onclick="setSortKey('value')"><span data-i18n="perf.sort.value">Market Value</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-pnl" data-key="pnl" onclick="setSortKey('pnl')"><span data-i18n="perf.sort.pnl">Unrealized PnL Value</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-pct" data-key="pct" onclick="setSortKey('pct')"><span data-i18n="perf.sort.pct">Unrealized PnL %</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-name" data-key="name" onclick="setSortKey('name')"><span data-i18n="perf.sort.name">Alphabetical</span><span class="sort-option-arrow"></span></button>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px" id="pnl-rows">
        <div class="pnl-row" data-perf-group="gold"><div><div class="pnl-row-name">🥇 Gold 24K</div><div class="pnl-row-sub" id="pnl-row-sub-gold">${fmt(d.gold.gramsHeld)}g <span data-i18n="pnl.sub.physical">physical</span></div></div><div style="text-align:right">${goldPnlRowRight}</div></div>
        <div class="pnl-row" data-perf-group="liquid"><div><div class="pnl-row-name">🏦 Bareeq</div><div class="pnl-row-sub" id="pnl-row-sub-abr"><span data-i18n="pnl.sub.fixed.income">Fixed Income</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(d.abr.nav)} EGP · ${fmt(d.abr.apyPercent)}% <span data-i18n="pnl.sub.apy">APY</span></div></div><div style="text-align:right"><div class="pnl-row-val" style="color:var(--teal)">${signedFmt(d.abr.pnl)} EGP</div><div style="font-size:9.5px;color:var(--teal);font-weight:600">${pctStr(d.abr.pnlPct)}</div></div></div>
        <div class="pnl-row" data-perf-group="liquid"><div><div class="pnl-row-name">🏢 Real Est.</div><div class="pnl-row-sub" id="pnl-row-sub-re"><span data-i18n="pnl.sub.equity">Equity Fund</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(d.re.nav)} EGP</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:${d.re.pnl >= 0 ? "var(--teal)" : "var(--coral)"}">${signedFmt(d.re.pnl)} EGP</div><div style="font-size:9.5px;color:${d.re.pnl >= 0 ? "var(--teal)" : "var(--coral)"};font-weight:600">${pctStr(d.re.pnlPct)}</div></div></div>
        <div class="pnl-row" data-perf-group="certs"><div><div class="pnl-row-name">📜 Certificates</div><div class="pnl-row-sub" id="pnl-row-sub-certs" data-i18n="pnl.sub.nbe.income">NBE · interest income</div></div><div style="text-align:right"><div class="pnl-row-val" id="cert-pnl-val" style="color:var(--teal)">${signedFmt(d.certTotals.annualYield)} EGP/yr</div><div style="font-size:9.5px;color:var(--teal);font-weight:600" id="cert-pnl-pct">${pctStr(d.certTotals.weightedAvgRate)} APY</div></div></div>
      </div>
      <div class="math-section" id="math-gold">
        ${mathGoldRows}
      </div>
      <div class="math-section" id="math-liquid">
        <div class="math-line"><span class="math-label" data-i18n="ml.bareeq">Bareeq:</span><span class="math-calc">${fmt(d.abr.unitsHeld)} units × ${fmt2(d.abr.nav)} NAV</span><span class="math-result">= ${fmt(Math.round(d.abr.value))} EGP</span></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.cost.basis">Cost Basis:</span><span class="math-calc"></span><span class="math-result">= ${fmt(d.abr.costBasisTotal)} EGP</span></div>
        <div class="math-line math-total${d.abr.pnl < 0 ? " neg" : ""}"><span class="math-label" data-i18n="ml.bareeq.pnl">Bareeq PnL:</span><span class="math-calc" data-i18n="mc.val.minus.cost">value − cost</span><span class="math-result">${d.abr.pnl >= 0 ? "+" : ""}${fmt(Math.round(d.abr.pnl))} EGP (${pctStr(d.abr.pnlPct)})</span></div>
        <div class="math-divider"></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.re">Real Est.:</span><span class="math-calc">${fmt(d.re.unitsHeld)} units × ${fmt2(d.re.nav)} NAV</span><span class="math-result">= ${fmt(Math.round(d.re.value))} EGP</span></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.cost.basis">Cost Basis:</span><span class="math-calc"></span><span class="math-result">= ${fmt(d.re.costBasisTotal)} EGP</span></div>
        <div class="math-line math-total${d.re.pnl < 0 ? " neg" : ""}"><span class="math-label" data-i18n="ml.re.pnl">Real Est. PnL:</span><span class="math-calc" data-i18n="mc.val.minus.cost">value − cost</span><span class="math-result">${d.re.pnl >= 0 ? "+" : ""}${fmt(Math.round(d.re.pnl))} EGP (${pctStr(d.re.pnlPct)})</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total${d.liquid.pnl < 0 ? " neg" : ""}"><span class="math-label" data-i18n="ml.net.pnl">Net PnL:</span><span class="math-calc" data-i18n="mc.bareeq.re.combined">Bareeq + Real Est. combined</span><span class="math-result">${d.liquid.pnl >= 0 ? "+" : ""}${fmt(Math.round(d.liquid.pnl))} EGP (${pctStr(d.liquid.pnlPct)})</span></div>
      </div>
    </div>

    <!-- YIELD VIEW -->
    <div id="perf-yield" style="display:none">
      <div style="font-size:22px;margin-bottom:6px">💹</div>
      <div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:800" id="s-yield" class="pos">${signedFmt(d.yield.totalMonthly)} EGP/mo</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px" class="neu" id="yield-sub">ABR ${fmt(d.abr.apyPercent)}% + NBE ${d.certTotals.weightedAvgRate.toFixed(1)}% (weighted avg)</div>
      <div class="math-section" id="math-yield">
        <div class="math-line"><span class="math-label" data-i18n="ml.bareeq">Bareeq:</span><span class="math-calc">${fmt(d.abr.value)} × ${fmt(d.abr.apyPercent)}% ÷ 12</span><span class="math-result">= ${fmt2(d.abr.monthlyYield)} EGP/mo</span></div>
        <div id="yield-cert-row" class="math-line"><span class="math-label" data-i18n="ml.nbe.certs">NBE Certs:</span><span id="yield-cert-calc" class="math-calc">${fmt(d.certTotals.totalPrincipal)} × ${d.certTotals.weightedAvgRate.toFixed(1)}% ÷ 12</span><span id="yield-cert-result" class="math-result">= ${fmt(d.certTotals.totalMonthly)} EGP/mo</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total"><span class="math-label" data-i18n="ml.total.yield">Total Yield:</span><span class="math-calc"></span><span id="yield-total-result" class="math-result">${fmt(Math.round(d.yield.totalMonthly))} EGP/mo</span></div>
      </div>
    </div>

    <!-- GROWTH VIEW -->
    <div id="perf-growth" style="display:none">
      <div style="margin-bottom:10px">
        <div id="growth-view-label" style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)" data-i18n="growth.label">Savings Growth · Month over Month</div>
        <div style="font-family:'Sora',sans-serif;font-size:26px;font-weight:800;margin-top:4px" id="growth-latest" class="pos">${fmt(d.abr.value)} EGP</div>
        <div style="font-size:10.5px;color:var(--teal);margin-top:2px" id="growth-delta"></div>
      </div>
      <div style="position:relative;width:100%">
        <svg id="sparkline-svg" width="100%" height="90" viewBox="0 0 300 90" preserveAspectRatio="none" style="overflow:visible;display:block">
          <defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f6a5e" stop-opacity=".5"></stop><stop offset="100%" stop-color="#0f6a5e" stop-opacity="0"></stop></linearGradient></defs>
          <path id="spark-fill" d="M 8 78 C 150 78, 150 14, 292 14 L 292 90 L 8 90 Z" fill="url(#sparkGrad)"></path>
          <path id="spark-line" d="M 8 78 C 150 78, 150 14, 292 14" fill="none" stroke="#0f6a5e" stroke-width="2.5" stroke-linecap="round"></path>
          <circle id="spark-dot" cx="292" cy="14" r="4" fill="#0f6a5e"></circle>
        </svg>
        <div id="spark-labels" style="display:flex;justify-content:space-between;margin-top:4px"></div>
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:9.5px;color:var(--dim)" id="growth-snapcount">${p.snapshots.length} snapshots</div>
        <button onclick="saveGrowthSnapshot()" style="border:none;background:var(--teal-soft);color:var(--teal);border-radius:8px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer" data-i18n="growth.save">+ Save Snapshot</button>
      </div>
    </div>

    <!-- TOTAL: CAPITAL VIEW — whole-wallet capital gains, shown only when Total toggle is active -->
    <div id="perf-total-capital" style="display:none">
      <div style="font-size:22px;margin-bottom:6px">💼</div>
      <div style="font-family:Sora,sans-serif;font-size:20px;font-weight:800;color:${totCapColor}">${totCapLabel}</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px;color:var(--dim)">${totCapPctStr} · <span data-i18n="perf.vs">vs</span> ${fmt(d.total.cost)} EGP <span data-i18n="perf.deployed">deployed</span></div>
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin-top:14px;margin-bottom:10px" data-i18n="perf.return.attr">Return Attribution</div>
      ${attribBar("🥇", "Gold", d.gold.pnlAvailable ? `${fmt(d.gold.gramsHeld)}g physical` : "live price pending", d.total.contributions.goldCapitalPct, goldCapLabel, goldCapColor, "attr.gold", d.gold.pnlAvailable ? undefined : "attr.price.pending")}
      ${attribBar("💧", "Liquid", "Bareeq + Real Est.", d.total.contributions.liquidCapitalPct, liquidCapLabel, liquidCapColor, "attr.liquid", "attr.liquid.sub")}
      <div style="font-size:9.5px;color:var(--dim);margin-top:4px;padding:6px 0 0;border-top:1px solid var(--edge)" data-i18n="perf.certs.note">📜 Certificates · held at face value — interest income is in the Income tab</div>
      <div class="math-section" id="math-total-capital">
        ${d.gold.pnlAvailable
          ? `<div class="math-line"><span class="math-label" data-i18n="ml.gold.pnl">Gold PnL:</span><span class="math-calc" data-i18n="mc.val.cb.minus.cost">(value + cashback) − cost</span><span class="math-result" style="color:${goldCapColor}">${goldCapLabel}</span></div>`
          : `<div class="math-line"><span class="math-label" data-i18n="ml.gold.pnl">Gold PnL:</span><span class="math-calc" data-i18n="attr.price.pending">live price pending</span><span class="math-result" style="color:var(--dim)">N/A</span></div>`}
        <div class="math-line"><span class="math-label" data-i18n="ml.liquid.pnl">Liquid PnL:</span><span class="math-calc" data-i18n="mc.bareeq.re.combined">Bareeq + Real Est. combined</span><span class="math-result" style="color:${liquidCapColor}">${liquidCapLabel}</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total${d.total.capitalPnl < 0 ? " neg" : ""}"><span class="math-label" data-i18n="ml.total.cap.pnl">Total Capital PnL:</span><span class="math-calc" data-i18n="mc.gold.plus.liquid">gold + liquid</span><span class="math-result">${totCapLabel} (${totCapPctStr})</span></div>
      </div>
    </div>

    <!-- TOTAL: INCOME VIEW — yield breakdown across all income-bearing assets -->
    <div id="perf-total-income" style="display:none">
      <div style="font-size:22px;margin-bottom:6px">💹</div>
      <div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:800;color:var(--teal)">${totIncomeMonthly} EGP/mo</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px;color:var(--dim)">ABR ${fmt(d.abr.apyPercent)}% + NBE ${d.certTotals.weightedAvgRate.toFixed(1)}% (<span data-i18n="perf.weighted.avg">weighted avg</span>)</div>
      <div style="font-size:10.5px;font-weight:700;margin-top:4px;color:var(--teal)">${d.total.blendedYieldPct.toFixed(1)}% <span data-i18n="perf.blended.on.total">blended annual yield on total wallet</span></div>
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin-top:14px;margin-bottom:10px" data-i18n="perf.income.breakdown">Income Breakdown</div>
      ${attribBar("🏦", "Bareeq", `${fmt(d.abr.apyPercent)}% APY`, d.total.contributions.abrIncomePct, `${abrAnnualIncEgp} EGP/yr`, "var(--teal)", "attr.bareeq")}
      ${attribBar("📜", "Certs", `${d.certTotals.weightedAvgRate.toFixed(1)}% avg APY`, d.total.contributions.certIncomePct, `${certAnnualIncEgp} EGP/yr`, "#8b6fb0", "attr.certs")}
      <div class="math-section" id="math-total-income">
        <div class="math-line"><span class="math-label" data-i18n="ml.bareeq">Bareeq:</span><span class="math-calc">${fmt(d.abr.value)} × ${fmt(d.abr.apyPercent)}% ÷ 12</span><span class="math-result">= ${fmt2(d.abr.monthlyYield)} EGP/mo</span></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.nbe.certs">NBE Certs:</span><span class="math-calc">${fmt(d.certTotals.totalPrincipal)} × ${d.certTotals.weightedAvgRate.toFixed(1)}% ÷ 12</span><span class="math-result">= ${fmt(d.certTotals.totalMonthly)} EGP/mo</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total"><span class="math-label" data-i18n="ml.monthly.income">Monthly Income:</span><span class="math-calc"></span><span class="math-result">${fmt(Math.round(d.yield.totalMonthly))} EGP/mo</span></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.annual.income">Annual Income:</span><span class="math-calc" data-i18n="mc.times.12">× 12</span><span class="math-result">${fmt(Math.round(d.yield.totalMonthly * 12))} EGP/yr</span></div>
        <div class="math-line"><span class="math-label" data-i18n="ml.blended.yield">Blended Yield:</span><span class="math-calc" data-i18n="mc.annual.div.total">annual income ÷ total wallet</span><span class="math-result">${d.total.blendedYieldPct.toFixed(1)}%</span></div>
      </div>
    </div>

  </div>

  <!-- ③ WALLET HEALTH -->
  <div class="card dark s-2" data-view-card="health">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-lbl"><span data-i18n="card.health">Wallet Health</span> <span class="info-icon" onclick="toggleMath('math-health')" title="Show calculation">ℹ</span></div>
      <div class="wh-grade" id="wh-grade">${healthGrade(d.health.overallScore)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <div style="flex-shrink:0">
        <div style="font-family:'Sora',sans-serif;font-size:52px;font-weight:800;line-height:1;color:var(--ink)" id="wh-arc-score">${d.health.overallScore}</div>
        <div style="font-size:9px;color:#5a7a74;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:4px" data-i18n="health.outof">out of 100</div>
      </div>
      <svg width="130" height="130" viewBox="0 0 130 130" style="flex-shrink:0">
        <defs>
          <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e05a50"></stop><stop offset="100%" stop-color="#d99a2b"></stop></linearGradient>
          <linearGradient id="rg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d99a2b"></stop><stop offset="100%" stop-color="#f0c040"></stop></linearGradient>
          <linearGradient id="rg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3dae6e"></stop><stop offset="100%" stop-color="#5bbfaf"></stop></linearGradient>
          <linearGradient id="rg4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d99a2b"></stop><stop offset="100%" stop-color="#e8b84a"></stop></linearGradient>
        </defs>
        <circle cx="65" cy="65" r="55" fill="none" stroke="#1e2e2e" stroke-width="11" stroke-dasharray="259.2 86.4" transform="rotate(-210 65 65)"></circle>
        <circle cx="65" cy="65" r="43" fill="none" stroke="#1e2e2e" stroke-width="11" stroke-dasharray="202.6 67.6" transform="rotate(-210 65 65)"></circle>
        <circle cx="65" cy="65" r="31" fill="none" stroke="#1e2e2e" stroke-width="11" stroke-dasharray="146.1 48.7" transform="rotate(-210 65 65)"></circle>
        <circle cx="65" cy="65" r="19" fill="none" stroke="#1e2e2e" stroke-width="11" stroke-dasharray="89.5 29.9" transform="rotate(-210 65 65)"></circle>
        <circle id="ring-div" cx="65" cy="65" r="55" fill="none" stroke="url(#rg1)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 345.6" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-ef" cx="65" cy="65" r="43" fill="none" stroke="url(#rg2)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 270.2" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-yield" cx="65" cy="65" r="31" fill="none" stroke="url(#rg3)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 194.8" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-liq" cx="65" cy="65" r="19" fill="none" stroke="url(#rg4)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 119.4" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
      </svg>
    </div>
    <div class="wh-metrics">
      <div class="wh-metric"><span class="wh-dot" style="background:#e05a50"></span><span class="wh-mname" data-i18n="health.diversity">Diversity</span><div class="wh-track"><div class="wh-fill" id="wh-div" style="width:0%"></div></div><span class="wh-mval" id="wh-div-v">${Math.round(d.health.diversityScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname" data-i18n="health.ef">Emergency fund</span><div class="wh-track"><div class="wh-fill" id="wh-ef" style="width:0%"></div></div><span class="wh-mval" id="wh-ef-v">${Math.round(d.health.emergencyFundScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#3dae6e"></span><span class="wh-mname" data-i18n="health.yield">Yield rate</span><div class="wh-track"><div class="wh-fill" id="wh-yield-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-yield-v">${Math.round(d.health.yieldScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname" data-i18n="health.liquidity">Liquidity</span><div class="wh-track"><div class="wh-fill" id="wh-liq-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-liq-v">${Math.round(d.health.liquidityScore)}</span></div>
    </div>
    <div class="math-section" id="math-health">
      <div class="math-line"><span class="math-label" data-i18n="ml.diversity">Diversity:</span><span class="math-calc">100 - ${d.health.goldConcentrationPct.toFixed(1)}% <span data-i18n="mc.gold.conc">gold conc.</span></span><span class="math-result">= ${Math.round(d.health.diversityScore)}</span></div>
      <div class="math-line"><span class="math-label" data-i18n="ml.emergency.fund">Emergency Fund:</span><span class="math-calc">${fmt(d.abr.costBasisTotal)} ÷ ${fmt(d.settings.emergencyFundTarget)}</span><span class="math-result">= ${Math.round(d.health.emergencyFundScore)}</span></div>
      <div class="math-line"><span class="math-label" data-i18n="ml.yield.rate">Yield Rate:</span><span class="math-calc">${d.health.blendedYieldPct.toFixed(1)}% <span data-i18n="mc.blended.benchmark">blended ÷ 27% benchmark</span></span><span class="math-result">= ${Math.round(d.health.yieldScore)}</span></div>
      <div class="math-line"><span class="math-label" data-i18n="ml.liquidity">Liquidity:</span><span class="math-calc">${fmt(d.abr.value)} <span data-i18n="mc.liquid.div.total">liquid ÷</span> ${fmt(d.total.value)} <span data-i18n="mc.total.word">total</span></span><span class="math-result">= ${Math.round(d.health.liquidityPct)}%</span></div>
      <div class="math-divider"></div>
      <div class="math-line math-total"><span class="math-label" data-i18n="ml.average">Average:</span><span class="math-calc">(${Math.round(d.health.diversityScore)}+${Math.round(d.health.emergencyFundScore)}+${Math.round(d.health.yieldScore)}+${Math.round(d.health.liquidityScore)}) ÷ 4</span><span class="math-result">= ${d.health.overallScore}</span></div>
    </div>
  </div>

  <!-- ④ WALLET SEGMENTS -->
  <div class="card s-2" style="display:flex;flex-direction:column;gap:10px" data-view-card="segments">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="card-lbl"><span data-i18n="card.segments">Wallet Segments</span> <span class="info-icon" onclick="toggleMath('alloc-detail')" title="Show concentration">ℹ</span></div>
      <div style="font-size:9.5px;color:var(--dim)" id="seg-count">4 <span data-i18n="seg.assets">assets</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <div class="donut-ring" id="donut">
        <svg width="64" height="64" viewBox="0 0 64 64" style="position:absolute;inset:0">
          ${buildDonutRing(d)}
        </svg>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex:1">
        <div class="dl-row"><span class="dl-dot" style="background:#b8893f"></span><span class="dl-name" data-i18n="seg.gold">Gold 24K</span><span class="dl-pct" id="pct-gold">${d.allocation.pctGold.toFixed(1)}%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#0f6a5e"></span><span class="dl-name" data-i18n="seg.bareeq">Bareeq</span><span class="dl-pct" id="pct-abr">${d.allocation.pctAbr.toFixed(1)}%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#e05a50"></span><span class="dl-name" data-i18n="seg.re">Real Estate</span><span class="dl-pct" id="pct-re">${d.allocation.pctRe.toFixed(1)}%</span></div>
        <div class="dl-row" id="row-cert" style="display:flex"><span class="dl-dot" style="background:#8b6fb0"></span><span class="dl-name" data-i18n="seg.certs">Certificates</span><span class="dl-pct" id="pct-cert">${d.allocation.pctCert.toFixed(1)}%</span></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0">
      <div class="seg-row"><div class="seg-icon" style="background:var(--gold-soft)">🥇</div><div class="seg-body"><div class="seg-name"><span data-i18n="seg.gold">Gold 24K</span> · ${fmt(d.gold.gramsHeld)}g</div><div class="seg-meta" id="gold-sub"><span data-i18n="seg.avg.cost">Avg cost</span> ${goldSubCost} EGP/g · <span data-i18n="seg.mkt">Mkt</span> ${goldSubMkt}</div></div><div class="seg-right"><div class="seg-val" id="seg-gold-val">${goldValueDisplay}</div><div class="seg-pct" id="seg-gold-pct" style="color:${d.gold.pnlAvailable ? (d.gold.pnlPct! >= 0 ? 'var(--teal)' : 'var(--coral)') : 'var(--dim)'}">${goldPnlPctDisplay1}${d.gold.pnlAvailable ? ' <span data-i18n="seg.vs.cost">vs cost</span>' : ''}</div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--teal-soft)">🏦</div><div class="seg-body"><div class="seg-name" data-i18n="seg.bareeq.fund">Bareeq Fund</div><div class="seg-meta" id="abr-sub">${fmt(d.abr.apyPercent)}% APY · ${fmt(d.abr.unitsHeld)} <span data-i18n="seg.certs.at">certs @</span> <span id="abr-nav-lbl">${fmt2(d.abr.nav)}</span></div></div><div class="seg-right"><div class="seg-val" id="seg-abr-val">${fmt(d.abr.costBasisTotal)}</div><div class="seg-pct pos">${pctStr(d.abr.pnlPct)} <span data-i18n="seg.vs.cost">vs cost</span></div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--coral-soft)">🏢</div><div class="seg-body"><div class="seg-name" data-i18n="seg.beltone.re">Beltone Real Estate</div><div class="seg-meta">${fmt(d.re.unitsHeld)} <span data-i18n="seg.certs.at">certs @</span> <span id="re-nav-lbl">${fmt2(d.re.nav)}</span></div></div><div class="seg-right"><div class="seg-val" id="seg-re-val">${fmt(d.re.costBasisTotal)}</div><div class="seg-pct" style="color:${d.re.pnlPct >= 0 ? "var(--teal)" : "var(--coral)"}">${pctStr(d.re.pnlPct)} <span data-i18n="seg.vs.cost">vs cost</span></div></div></div>
      <div class="seg-row" id="seg-cert-row" style="display:flex"><div class="seg-icon" style="background:#ece7f4">📜</div><div class="seg-body"><div class="seg-name" data-i18n="seg.nbe.certs">NBE Certificates</div><div class="seg-meta" id="cert-sub">${p.certificates.length} <span data-i18n="seg.nbe.certs.avg">NBE certs · avg</span> ${d.certTotals.weightedAvgRate.toFixed(1)}% APY</div></div><div class="seg-right"><div class="seg-val" id="seg-cert-val">${fmt(d.certTotals.totalPrincipal)}</div><div class="seg-pct" id="seg-cert-pct" style="color:var(--teal)">${signedFmt(d.certTotals.totalMonthly)}/mo</div></div></div>
    </div>
    <div class="math-section" id="alloc-detail" style="margin-top:auto">
      <div id="alloc-detail-text" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">${allocInsight(d)}</div>
    </div>
  </div>

  <!-- ⑤ EMERGENCY FUND PROGRESS -->
  <div class="card s-2" data-view-card="progress">
    <div class="card-lbl"><span data-i18n="card.ef">Emergency Fund · Bareeq Target</span> <span class="info-icon" onclick="toggleMath('abr-detail')" title="Show pace details">ℹ</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
      <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800" id="abr-prog-val">${fmt(d.abr.costBasisTotal)} EGP</div>
      <div style="font-size:10px;color:var(--dim);font-weight:600" id="abr-prog-pct-label">${d.health.emergencyFundPct.toFixed(1)}% of ${fmt(d.settings.emergencyFundTarget / 1000)}k</div>
    </div>
    <div class="prog-track"><div class="prog-fill" id="abr-prog-bar" style="width:0%" data-target="${Math.min(100, d.health.emergencyFundPct).toFixed(1)}"></div></div>
    <div class="prog-labels">
      <span id="abr-prog-pct">${d.health.emergencyFundPct.toFixed(1)}%</span>
      <span id="abr-prog-left-label" style="color:var(--dim)">${fmt(Math.max(0, d.settings.emergencyFundTarget - d.abr.costBasisTotal))} <span data-i18n="ef.togo">EGP to go</span></span>
    </div>
    <div class="math-section" id="abr-detail" style="margin-top:10px">
      <div id="abr-note" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">📈 <span data-i18n="ef.note.prefix">Yield only: ~</span>${d.abr.monthlyYield > 0 ? Math.ceil(Math.max(0, d.settings.emergencyFundTarget - d.abr.costBasisTotal) / d.abr.monthlyYield) : "—"} <span data-i18n="ef.note.suffix">months · add monthly deposits to go faster</span></div>
    </div>
  </div>

  <!-- ⑦ GOLD DCA (BUY-MORE SCENARIO) CALCULATOR -->
  <!-- Models buying extra gold at today's manually-entered spot prices.
       Manufacturing fees (buy side) and cashback (sell side) come from the
       fixed dealer fee schedule in goldFeeSchedule.ts — see that file's
       policy note for why those are hardcoded while spot prices are not.
       Spot buy/sell prices are typed in by hand for now — no default/
       sample values are baked in here. Once the live buy/sell gold price
       feature ships, these fields should be pre-filled (and eventually
       replaced) by that live feed, never by a hardcoded number. -->
  <div class="card s-2" data-view-card="dca">
    <div class="card-lbl" data-i18n="card.dca">🪙 Buy More Gold — Scenario Calculator</div>
    <p class="dca-sub" id="dca-sub">You hold ${fmt(d.gold.gramsHeld)}g (pure-gold-adjusted) @ ${fmt(d.gold.avgCostPerGram)} EGP/pure-g avg. Scenarios are auto-calculated from live goldbullioneg.com prices (refreshed every 5 min). Manufacturing fee on every buy, cashback on every sell — per the fixed dealer fee schedule.</p>
    <div class="dca-divider"></div>
    <div class="dca-scenarios">
      <div class="dca-scenario-card">
        <div class="dca-scenario-title" data-i18n="dca.s1.title">Scenario 1 · 1 bar (5g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub" data-i18n="dca.s1.fee">Mfg fee: 87 EGP/g</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pay">Pay</span><span class="dca-scenario-val" id="dca-s1-pay">—</span></div>
        <div class="dca-scenario-row"><span data-i18n="dca.avg">New Average</span><span class="dca-scenario-val" id="dca-s1-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s1-drop">—</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pnl">Adjusted PnL</span><span class="dca-scenario-val" id="dca-s1-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title" data-i18n="dca.s2.title">Scenario 2 · 2 bars of 5g (10g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub" data-i18n="dca.s2.fee">Mfg fee: 87 EGP/g (5g-bar rate)</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pay">Pay</span><span class="dca-scenario-val" id="dca-s2-pay">—</span></div>
        <div class="dca-scenario-row"><span data-i18n="dca.avg">New Average</span><span class="dca-scenario-val" id="dca-s2-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s2-drop">—</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pnl">Adjusted PnL</span><span class="dca-scenario-val" id="dca-s2-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title" data-i18n="dca.s3.title">Scenario 3 · 1 bar (10g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub" data-i18n="dca.s3.fee">Mfg fee: 84 EGP/g (10g-bar rate)</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pay">Pay</span><span class="dca-scenario-val" id="dca-s3-pay">—</span></div>
        <div class="dca-scenario-row"><span data-i18n="dca.avg">New Average</span><span class="dca-scenario-val" id="dca-s3-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s3-drop">—</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pnl">Adjusted PnL</span><span class="dca-scenario-val" id="dca-s3-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title" data-i18n="dca.s4.title">Scenario 4 · Gold Pound (21K, 8g)</div>
        <div class="dca-scenario-row dca-scenario-sub" data-i18n="dca.s4.fee">Mfg fee: 77 EGP/g · Cashback: 24 EGP/g</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pay">Pay</span><span class="dca-scenario-val" id="dca-s4-pay">—</span></div>
        <div class="dca-scenario-row"><span data-i18n="dca.avg">New Average</span><span class="dca-scenario-val" id="dca-s4-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s4-drop">—</div>
        <div class="dca-scenario-row"><span data-i18n="dca.pnl">Adjusted PnL</span><span class="dca-scenario-val" id="dca-s4-pnl">—</span></div>
      </div>
    </div>
    <div class="note-chip" style="margin-top:14px" id="dca-note">${d.gold.pnlAvailable ? `ℹ️ Prices from goldbullioneg.com (live). Manufacturing fees and cashback from the fixed dealer fee schedule. Refreshes every 5 min.` : `⚠️ Waiting for live gold prices from goldbullioneg.com — scenarios will appear once the first scrape completes.`}</div>
  </div>


  <!-- AI INSIGHTS VIEW -->
  <div style="grid-column:span 6;margin-top:var(--gap)" data-view-card="ai-insights">
    <div class="card" style="padding:26px 28px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">🤖</span>
          <div>
            <div style="font-weight:700;font-size:15px" data-i18n="ai.title">AI Insights</div>
            <div style="font-size:10.5px;color:var(--dim)" data-i18n="ai.subtitle">Automated analysis of your portfolio health and allocation</div>
          </div>
        </div>
        <button
          id="scraper-run-btn"
          onclick="runPriceChecker()"
          style="display:flex;align-items:center;gap:6px;background:var(--teal);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">
          🔄 <span id="scraper-btn-label">Refresh prices</span>
        </button>
      </div>

      <!-- Status line shown while scraper runs or after it completes -->
      <div id="scraper-status" style="display:none;font-size:10.5px;color:var(--dim);margin-bottom:14px;padding:8px 12px;background:var(--bg);border-radius:8px"></div>

      <!-- Portfolio health insights (always visible) -->
      <div id="ai-insights-body">
        ${buildInsights(d)}
      </div>

      <!-- Price comparison table — shown after a successful scraper run -->
      <div id="price-checker-results" style="display:none;margin-top:20px">
        <div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:10px">📊 Market Comparison</div>
        <div id="price-checker-table"></div>
      </div>
    </div>
  </div>

</div><!-- /bento -->

<!-- ROTATION VERDICT — populated async by loadRotationVerdicts() in dashboardBehavior.ts -->
<div id="rotation-verdict-section" style="margin-top:var(--gap)"></div>

<!-- CERTIFICATES DETAIL -->
<div id="certs-placeholder" style="display:none;margin-top:var(--gap)">
  <div class="card dark" style="padding:26px 28px;margin-bottom:var(--gap)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="card-lbl" style="color:var(--dim)"><span data-i18n="certs.hero.label">NBE Certificates · Total Principal</span> <span class="info-icon" onclick="toggleMath('math-certs-hero')" title="Show calculation" style="color:var(--dim);background:var(--edge)">ℹ</span></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);margin-top:10px;margin-bottom:4px" data-i18n="certs.hero.sub">Principal Balance · EGP</div>
        <div style="font-family:'Sora',sans-serif;font-size:50px;font-weight:800;line-height:1;letter-spacing:-.02em;color:var(--ink)">${fmt(d.certTotals.totalPrincipal)} <span style="font-size:22px;color:var(--dim)">EGP</span></div>
        <div style="display:flex;gap:20px;margin-top:16px;flex-wrap:wrap">
          <div><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em" data-i18n="certs.stat.count">Certificates</div><div style="font-size:16px;font-weight:800;color:var(--ink)">${p.certificates.length}</div></div>
          <div><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em" data-i18n="certs.stat.apy">Avg APY</div><div class="cert-yield-val" style="font-size:16px;font-weight:800;color:#3dae6e">+${d.certTotals.weightedAvgRate.toFixed(1)}%</div></div>
          <div><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em" data-i18n="certs.stat.annual">Annual Yield</div><div class="cert-yield-val" style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-annual-yield">${fmt(d.certTotals.annualYield)} EGP</div></div>
          <div><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em" data-i18n="certs.stat.monthly">Monthly Yield</div><div class="cert-yield-val" style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-monthly-yield">${fmt(d.certTotals.totalMonthly)} EGP</div></div>
          <div><div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em" data-i18n="certs.stat.soon">Maturing in 90d</div><div style="font-size:16px;font-weight:800;color:#d99a2b" id="cert-maturing-soon">${d.certTotals.maturingSoon} certs</div></div>
        </div>
        <div class="math-section" id="math-certs-hero" style="margin-top:14px">
          <div class="math-line"><span class="math-label" data-i18n="ml.total.principal">Total Principal:</span><span class="math-calc">${p.certificates.length} <span data-i18n="mc.certificates">certificates</span></span><span class="math-result">${fmt(d.certTotals.totalPrincipal)} EGP</span></div>
          <div class="math-line"><span class="math-label" data-i18n="ml.avg.apy">Avg APY:</span><span class="math-calc" id="math-cert-avg-calc">Σ(value × rate) ÷ ${fmt(d.certTotals.totalPrincipal)}</span><span class="math-result cert-yield-val" style="color:#3dae6e" id="math-cert-avg-result">${d.certTotals.weightedAvgRate.toFixed(1)}%</span></div>
          <div class="math-line"><span class="math-label" data-i18n="ml.annual.yield">Annual Yield:</span><span class="math-calc" id="math-cert-annual-calc">${fmt(d.certTotals.totalPrincipal)} × ${d.certTotals.weightedAvgRate.toFixed(1)}% = ${fmt(d.certTotals.annualYield)} EGP</span><span class="math-result cert-yield-val" style="color:#3dae6e" id="math-cert-annual-result">${fmt(d.certTotals.annualYield)} EGP/yr</span></div>
          <div class="math-divider"></div>
          <div class="math-line"><span class="math-label cert-yield-val" style="color:#3dae6e" data-i18n="ml.monthly.yield">Monthly yield:</span><span class="math-calc" data-i18n="mc.annual.div.12">annual ÷ 12</span><span class="math-result cert-yield-val" style="color:#3dae6e" id="math-cert-monthly-result">${fmt(d.certTotals.totalMonthly)} EGP/mo</span></div>
        </div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)">
    <div class="card"><div class="card-lbl" style="margin-bottom:12px" data-i18n="certs.timeline">Maturity Timeline</div><div id="cert-timeline"></div></div>
    <div class="card"><div class="card-lbl" style="margin-bottom:12px" data-i18n="certs.byrate">By Interest Rate</div><div id="cert-rate-breakdown"></div></div>
  </div>
  <div class="card" style="margin-top:var(--gap)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-lbl" data-i18n="certs.all.label">All Certificates · NBE</div>
      <div style="font-size:9.5px;color:var(--teal);font-weight:700" id="cert-avg-rate">Avg ${d.certTotals.weightedAvgRate.toFixed(1)}% APY</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      <button class="chip active" id="cert-chip-all" onclick="filterCerts('all')"><span data-i18n="certs.chip.all">All</span> ${p.certificates.length}</button>
      <button class="chip" id="cert-chip-high" onclick="filterCerts('high')" data-i18n="certs.chip.high">🔥 High Rate (≥20%)</button>
      <button class="chip" id="cert-chip-soon" onclick="filterCerts('soon')" data-i18n="certs.chip.soon">⚠️ Due Soon</button>
    </div>
    <table class="ah-table" id="certs-table">
      <thead><tr>
        <th class="th-sortable" onclick="sortCerts('name')"><span data-i18n="certs.th.name">Certificate</span><span class="th-arrow" id="th-arrow-name"></span></th>
        <th class="th-sortable" onclick="sortCerts('value')"><span data-i18n="certs.th.value">Value</span><span class="th-arrow" id="th-arrow-value"></span></th>
        <th class="th-sortable" onclick="sortCerts('rate')"><span data-i18n="certs.th.rate">Rate</span><span class="th-arrow" id="th-arrow-rate"></span></th>
        <th class="th-sortable" onclick="sortCerts('maturity')"><span data-i18n="certs.th.maturity">Maturity</span><span class="th-arrow" id="th-arrow-maturity"></span></th>
        <th class="th-sortable" onclick="sortCerts('monthly')"><span data-i18n="certs.th.monthly">Monthly</span><span class="th-arrow" id="th-arrow-monthly"></span></th>
      </tr></thead>
      <tbody id="certs-tbody"></tbody>
    </table>
  </div>
</div>

<!-- AI SCREENSHOT SCANNER DRAWER -->
<div class="scan-overlay" id="scan-overlay">
  <div class="scan-drawer">
    <h2><span data-i18n="scan.title">📸 AI Scanner</span> <button onclick="closeScan()" data-i18n="scan.close">Close</button></h2>
    <p class="scan-sub" data-i18n="scan.sub">Upload a screenshot and AI will read it and update your dashboard automatically.</p>
    <div class="scan-modes" id="scan-modes">
      <button class="scan-mode-btn" onclick="selectScanMode('order')" id="mode-order"><div class="scan-mode-icon" style="background:var(--teal-soft)">🧾</div><div class="scan-mode-body"><div class="scan-mode-title" data-i18n="scan.mode.order.title">Thndr Order Confirmation</div><div class="scan-mode-desc" data-i18n="scan.mode.order.desc">After buying/selling ABR or BRE — reads fund, certs, NAV, amount and updates positions.</div></div></button>
      <button class="scan-mode-btn" onclick="selectScanMode('nav')" id="mode-nav"><div class="scan-mode-icon" style="background:var(--gold-soft)">📊</div><div class="scan-mode-body"><div class="scan-mode-title" data-i18n="scan.mode.nav.title">Fund NAV Screenshot</div><div class="scan-mode-desc" data-i18n="scan.mode.nav.desc">Any fund price page — reads current NAV and updates that fund's price.</div></div></button>
    </div>
    <div class="scan-upload-area" id="scan-upload-area" onclick="document.getElementById('scan-file-input').click()">
      <img class="scan-preview" id="scan-preview" src="" alt="" style="display:none">
      <input type="file" id="scan-file-input" accept="image/*" onchange="onFileSelected(event)" style="display:none">
      <span class="scan-upload-label" id="scan-upload-label" data-i18n="scan.upload">📁 Tap to choose screenshot</span>
    </div>
    <div class="scan-processing" id="scan-processing"><div class="scan-spinner"></div><span id="scan-processing-text">AI is reading your screenshot…</span></div>
    <div class="scan-error" id="scan-error"></div>
    <div class="scan-result" id="scan-result"><div class="scan-result-title" id="scan-result-title" data-i18n="scan.result.title">Extracted Data</div><div id="scan-result-body"></div></div>
    <div id="scan-actions" style="display:none;margin-top:4px"><button class="btn btn-primary" style="width:100%" id="scan-apply-btn" onclick="applyScanResult()" data-i18n="scan.apply">Apply to Dashboard</button></div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:10px;color:var(--dim)" id="scan-key-status" data-i18n="scan.key.notset">API Key: not set</span>
      <button onclick="openApiKey()" style="border:none;background:var(--bg);border-radius:7px;padding:4px 10px;font-size:10.5px;font-weight:600;color:var(--dim);cursor:pointer" data-i18n="scan.setkey">⚙️ Set API Key</button>
    </div>
  </div>
</div>

<!-- API KEY SETUP MODAL -->
<div class="apikey-overlay" id="apikey-overlay">
  <div class="apikey-modal">
    <h2 data-i18n="apikey.title">🔑 Gemini API Key</h2>
    <p data-i18n="apikey.desc">This key is stored only in your browser (localStorage) and never sent anywhere except Google's API.</p>
    <div class="apikey-steps"><b>Get your free key:</b><br>1. Go to <b>aistudio.google.com</b><br>2. Sign in with Google<br>3. Click <b>Get API Key → Create API key</b><br>4. Copy and paste it below</div>
    <div class="modal-field" style="margin-top:12px"><label data-i18n="apikey.label">Gemini API Key</label><input type="password" id="input-gemini-key" placeholder="AIza..."></div>
    <div class="apikey-status" id="apikey-status"></div>
    <div class="modal-actions"><button class="btn btn-cancel" onclick="closeApiKey()" data-i18n="btn.cancel">Cancel</button><button class="btn btn-primary" onclick="saveApiKey()" data-i18n="apikey.save">Save Key</button></div>
  </div>
</div>

<!-- INSIGHTS DRAWER -->
<div class="insight-overlay" id="insight-overlay">
  <div class="insight-drawer">
    <h2><span data-i18n="insights.title">ℹ️ Cross-Card Intelligence</span> <button onclick="closeInsights()" data-i18n="insights.close">Close</button></h2>
    <div style="font-size:10.5px;color:var(--dim);margin-bottom:14px;line-height:1.5" id="insights-timestamp"></div>
    <div id="insights-body">
      ${buildInsights(d)}
    </div>
  </div>
</div>

<!-- ADD DATA PICKER -->
<div class="modal-overlay" id="add-modal">
  <div class="modal" style="max-width:340px">
    <h2 data-i18n="modal.add.title">➕ Add Data</h2>
    <p data-i18n="modal.add.desc">How would you like to update your dashboard?</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
      <button class="add-pick-btn" onclick="closeAdd();openScan()">
        <span class="add-pick-icon" style="background:var(--teal-soft)">📸</span>
        <span class="add-pick-body">
          <span class="add-pick-title" data-i18n="modal.add.scan.title">From a screenshot</span>
          <span class="add-pick-desc" data-i18n="modal.add.scan.desc">AI reads your Thndr order or fund NAV image and updates automatically.</span>
        </span>
      </button>
      <button class="add-pick-btn" onclick="closeAdd();openNav()">
        <span class="add-pick-icon" style="background:var(--gold-soft)">✏️</span>
        <span class="add-pick-body">
          <span class="add-pick-title" data-i18n="modal.add.manual.title">Manually</span>
          <span class="add-pick-desc" data-i18n="modal.add.manual.desc">Enter fund NAVs and units held directly.</span>
        </span>
      </button>
    </div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-cancel" onclick="closeAdd()" data-i18n="btn.cancel">Cancel</button>
    </div>
  </div>
</div>

<!-- NAV EDITOR MODAL -->
<div class="modal-overlay" id="nav-modal">
  <div class="modal">
    <h2 data-i18n="modal.nav.title">✏️ Update NAVs</h2>
    <p data-i18n="modal.nav.desc">Enter the latest fund NAVs from your app. Values are saved to the database and reflected everywhere. Gold holdings are derived from your recorded gold transactions, not editable here.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="modal-field"><label data-i18n="modal.nav.abr.nav">Bareeq NAV (EGP/cert)</label><input type="number" id="input-abr-nav" step="0.0001" placeholder="e.g. 207.80"></div>
      <div class="modal-field"><label data-i18n="modal.nav.abr.certs">Bareeq Certs held</label><input type="number" id="input-abr-certs" step="1" placeholder="e.g. 72"></div>
      <div class="modal-field"><label data-i18n="modal.nav.re.nav">Real Estate NAV</label><input type="number" id="input-re-nav" step="0.0001" placeholder="e.g. 1.91"></div>
      <div class="modal-field"><label data-i18n="modal.nav.re.certs">Real Estate Certs</label><input type="number" id="input-re-certs" step="1" placeholder="e.g. 2656"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-cancel" onclick="closeNav()" data-i18n="btn.cancel">Cancel</button>
      <button class="btn btn-primary" id="nav-apply-btn" onclick="applyNavs()" data-i18n="btn.apply">Apply &amp; Save</button>
    </div>
  </div>
</div>

<footer><span data-i18n="footer.updated">Last updated:</span> <span id="last-updated"></span> · <span data-i18n="footer.sub">Prices via open APIs · Funds: manual NAV</span></footer>

</div><!-- /dashboard-root -->
`;
}

function signedFmt(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : `${fmt(n)}`;
}

export function healthGrade(score: number, lang: Lang = 'en'): string {
  if (lang === 'ar') {
    if (score >= 75) return "ممتاز";
    if (score >= 55) return "جيد";
    if (score >= 35) return "يحتاج اهتمام";
    return "في خطر";
  }
  if (score >= 75) return "Excellent";
  if (score >= 55) return "Good";
  if (score >= 35) return "Needs attention";
  return "At risk";
}

export function allocInsight(d: Derived, lang: Lang = 'en'): string {
  if (lang === 'ar') {
    if (d.allocation.pctGold > 30) {
      return `الذهب عند ${d.allocation.pctGold.toFixed(0)}% أعلى من الحد الأقصى الموصى به 30% لأصل واحد. فكّر في التنويع نحو أدوات السيولة أو شهادات إضافية لإعادة التوازن.`;
    }
    return `توزيع محفظتك ضمن حدود التركيز الموصى بها. الذهب عند ${d.allocation.pctGold.toFixed(0)}%، متنوع جيداً مقارنةً بسائر حيازاتك.`;
  }
  if (d.allocation.pctGold > 30) {
    return `Gold at ${d.allocation.pctGold.toFixed(0)}% is above the recommended 30% max for a single asset. Consider diversifying into liquid instruments or additional certificates to rebalance.`;
  }
  return `Your portfolio allocation is within recommended concentration limits. Gold sits at ${d.allocation.pctGold.toFixed(0)}%, well diversified against your other holdings.`;
}

export function buildInsights(d: Derived, lang: Lang = 'en'): string {
  const items: string[] = [];
  if (lang === 'ar') {
    if (d.health.goldConcentrationPct > 30) {
      items.push(`<div class="insight-item"><div class="insight-icon">⚠️</div><div><div class="insight-title">تركيز ذهب مرتفع</div><div class="insight-desc">الذهب يمثل ${d.health.goldConcentrationPct.toFixed(0)}% من محفظتك — أعلى من الحد الأقصى الموصى به 30%. فكّر في إعادة التوازن نحو أدوات السيولة.</div></div></div>`);
    }
    if (d.health.liquidityPct < 20) {
      items.push(`<div class="insight-item"><div class="insight-icon">💧</div><div><div class="insight-title">سيولة منخفضة (${d.health.liquidityPct.toFixed(0)}%)</div><div class="insight-desc">فقط ${fmt(d.abr.value)} ج.م (${d.health.liquidityPct.toFixed(1)}%) سائل. احتفظ بـ15–20% على الأقل في أصول سائلة للطوارئ.</div></div></div>`);
    }
    items.push(`<div class="insight-item"><div class="insight-icon">📈</div><div><div class="insight-title">صندوق الطوارئ عند ${d.health.emergencyFundPct.toFixed(0)}%</div><div class="insight-desc">رصيد بريق يغطي ${d.health.emergencyFundPct.toFixed(0)}% من هدف ${fmt(d.settings.emergencyFundTarget)} ج.م.</div></div></div>`);
    items.push(`<div class="insight-item"><div class="insight-icon">🥇</div><div><div class="insight-title">أداء الذهب</div><div class="insight-desc">${fmt(d.gold.gramsHeld)} جم بتكلفة ${fmt(d.gold.cost)} ج.م (متوسط ${fmt(d.gold.avgCostPerGram)} ج.م/جم، شامل رسوم التصنيع). استرداد البيع ${fmt2(d.gold.cashbackPerGram)} ج.م/جم عند البيع. ${GOLD_PNL_UNAVAILABLE}.</div></div></div>`);
    items.push(`<div class="insight-item"><div class="insight-icon">💹</div><div><div class="insight-title">عائد الشهادات</div><div class="insight-desc" id="insight-cert-desc">شهاداتك الـ${d.certs.length} (البنك الأهلي) تُولّد ~${fmt(d.certTotals.totalMonthly)} ج.م/شهر (${fmt(d.certTotals.annualYield)} ج.م/سنة) بمتوسط مرجح ${d.certTotals.weightedAvgRate.toFixed(1)}% — إعادة الاستثمار في بريق يُضاعف النمو.</div></div></div>`);
  } else {
    if (d.health.goldConcentrationPct > 30) {
      items.push(`<div class="insight-item"><div class="insight-icon">⚠️</div><div><div class="insight-title">High Gold Concentration</div><div class="insight-desc">Gold represents ${d.health.goldConcentrationPct.toFixed(0)}% of your portfolio — above the recommended 30% max. Consider rebalancing into liquid instruments.</div></div></div>`);
    }
    if (d.health.liquidityPct < 20) {
      items.push(`<div class="insight-item"><div class="insight-icon">💧</div><div><div class="insight-title">Low Liquidity (${d.health.liquidityPct.toFixed(0)}%)</div><div class="insight-desc">Only ${fmt(d.abr.value)} EGP (${d.health.liquidityPct.toFixed(1)}%) is liquid. Consider keeping at least 15–20% in liquid assets for emergencies.</div></div></div>`);
    }
    items.push(`<div class="insight-item"><div class="insight-icon">📈</div><div><div class="insight-title">Emergency Fund at ${d.health.emergencyFundPct.toFixed(0)}%</div><div class="insight-desc">Your Bareeq balance covers ${d.health.emergencyFundPct.toFixed(0)}% of the ${fmt(d.settings.emergencyFundTarget)} EGP target.</div></div></div>`);
    items.push(`<div class="insight-item"><div class="insight-icon">🥇</div><div><div class="insight-title">Gold Performance</div><div class="insight-desc">${fmt(d.gold.gramsHeld)}g at a cost basis of ${fmt(d.gold.cost)} EGP (avg ${fmt(d.gold.avgCostPerGram)} EGP/g, mfg fee included). Sell cashback of ${fmt2(d.gold.cashbackPerGram)} EGP/g applies on sell. ${GOLD_PNL_UNAVAILABLE}.</div></div></div>`);
    items.push(`<div class="insight-item"><div class="insight-icon">💹</div><div><div class="insight-title">Certificate Yield</div><div class="insight-desc" id="insight-cert-desc">Your ${d.certs.length} NBE certificates generate ~${fmt(d.certTotals.totalMonthly)} EGP/month (${fmt(d.certTotals.annualYield)} EGP/yr) at a weighted average ${d.certTotals.weightedAvgRate.toFixed(1)}% APY — reinvesting into Bareeq would compound growth.</div></div></div>`);
  }
  return items.join("\n");
}
