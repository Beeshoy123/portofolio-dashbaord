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

function buildHoldingsRows(p: Portfolio, d: Derived): string {
  return `
    <tr data-asset-group="gold"><td><div class="ah-asset-name">Gold 24K</div><div class="ah-asset-sub">${fmt(d.gold.gramsHeld)}g physical</div></td><td>${d.gold.value !== null ? fmt2(d.gold.value) : `${fmt2(d.gold.cost)} <span style="font-size:9px;color:var(--dim)">(at cost)</span>`}</td><td style="color:var(--dim)">~${fmt(d.gold.cost)}</td><td style="color:var(--dim)">${d.gold.pnlAvailable ? pctStr(d.gold.pnlPct!, 2) : "N/A"}</td></tr>
    <tr data-asset-group="liquid"><td><div class="ah-asset-name">Bareeq Fund</div><div class="ah-asset-sub">ABR · ${fmt(d.abr.unitsHeld)} certs</div></td><td>${fmt2(d.abr.value)}</td><td style="color:var(--dim)">~${fmt(d.abr.costBasisTotal)}</td><td style="color:var(--teal)">${pctStr(d.abr.pnlPct, 2)}</td></tr>
    <tr data-asset-group="liquid"><td><div class="ah-asset-name">Beltone Real Estate Fund</div><div class="ah-asset-sub">BRE · ${fmt(d.re.unitsHeld)} certs</div></td><td>${fmt2(d.re.value)}</td><td style="color:var(--dim)">~${fmt(d.re.costBasisTotal)}</td><td style="color:${d.re.pnlPct >= 0 ? "var(--teal)" : "var(--coral)"}">${pctStr(d.re.pnlPct, 2)}</td></tr>
    <tr data-asset-group="certs"><td><div class="ah-asset-name">NBE Certificates</div><div class="ah-asset-sub">Fixed · ${p.certificates.length} certs</div></td><td>${fmt2(d.certTotals.totalPrincipal)}</td><td style="color:var(--dim)">~${fmt(d.certTotals.totalPrincipal)}</td><td id="cert-return-cell" style="color:var(--teal)">+0.00%</td></tr>
    <tr class="holdings-total-row" style="border-top:2px solid var(--edge)"><td><div class="ah-asset-name" style="color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em">Total</div></td><td style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px">${fmt2(d.total.value)}</td><td style="color:var(--dim);font-weight:700">~${fmt(d.total.cost)}</td><td style="color:var(--teal);font-weight:800">${pctStr(d.total.pnlPct, 2)}</td></tr>`;
}

const TX_ICON: Record<string, { bg: string; icon: string }> = {
  gold: { bg: "var(--gold-soft)", icon: "🥇" },
  abr: { bg: "var(--teal-soft)", icon: "🏦" },
  re: { bg: "var(--coral-soft)", icon: "🏢" },
};

function buildTransactions(p: Portfolio): string {
  return p.transactions
    .map((tx) => {
      const iconMeta = TX_ICON[tx.assetType] ?? TX_ICON.abr;
      const date = new Date(tx.occurredAt);
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const amountColor = tx.txType === "buy" && tx.assetType === "gold" ? "var(--coral)" : "var(--teal)";
      return `<div class="tx-entry" data-type="${tx.assetType}"><div class="tx-entry-icon" style="background:${iconMeta.bg}">${iconMeta.icon}</div><div class="tx-entry-body"><div class="tx-entry-name">${tx.name}</div><div class="tx-entry-meta">${dateStr} · ${timeStr} · ${tx.meta}</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:${amountColor}">${fmt2(tx.amount)}</div><div class="tx-entry-badge">${tx.txType.toUpperCase()}</div></div></div>`;
    })
    .join("\n");
}

const GOLD_PRICE_UNAVAILABLE = "Live price unavailable";
const GOLD_PNL_UNAVAILABLE = "PnL unavailable — live price pending";

export function buildDashboardHtml(p: Portfolio, d: Derived): string {
  const goldSubCost = fmt(d.gold.avgCostPerGram);
  const goldSubMkt = d.gold.livePricePerGram !== null
    ? `${fmt(d.gold.livePricePerGram)} EGP/g`
    : GOLD_PRICE_UNAVAILABLE;
  // "Value" always falls back to cost basis when the live price isn't
  // available yet, so we never fabricate a market value.
  const goldValueDisplay = fmt2(d.gold.value ?? d.gold.cost);
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
  // Gold row in the P&L breakdown list.
  const goldPnlRowRight = d.gold.pnlAvailable
    ? `<div class="pnl-row-val" style="color:${d.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"}">${d.gold.netPnl! >= 0 ? "+" : ""}${fmt(d.gold.netPnl!)} EGP</div><div style="font-size:9.5px;color:${d.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"};font-weight:600">${pctStr(d.gold.pnlPct!)} (sell + cashback)</div>`
    : `<div class="pnl-row-val" style="color:var(--dim)">N/A</div><div style="font-size:9.5px;color:var(--dim);font-weight:600">live price pending</div>`;
  // math-gold expandable section.
  const mathGoldRows = d.gold.pnlAvailable
    ? `<div class="math-line"><span class="math-label">Sell Price:</span><span class="math-calc">24K · goldbullioneg.com</span><span class="math-result">${fmt(d.gold.livePricePerGram!)} EGP/g</span></div>
  <div class="math-line"><span class="math-label">Current Value:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt(d.gold.livePricePerGram!)} EGP/g</span><span class="math-result">= ${fmt(d.gold.value!)} EGP</span></div>
  <div class="math-line"><span class="math-label">Cost Basis:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubCost} EGP/g</span><span class="math-result">= ${fmt(d.gold.cost)} EGP (mfg fee included)</span></div>
  <div class="math-line"><span class="math-label">Raw P&amp;L:</span><span class="math-calc">value − cost</span><span class="math-result">${d.gold.rawPnl! >= 0 ? "+" : ""}${fmt(d.gold.rawPnl!)} EGP</span></div>
  <div class="math-line"><span class="math-label">Sell Cashback:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt2(d.gold.cashbackPerGram)} EGP/g</span><span class="math-result">= ${fmt(d.gold.cashback!)} EGP (refunded on sell)</span></div>
  <div class="math-divider"></div>
  <div class="math-line math-total"><span class="math-label">Net P&amp;L:</span><span class="math-calc">(value + cashback) − cost</span><span class="math-result">${d.gold.netPnl! >= 0 ? "+" : ""}${fmt(d.gold.netPnl!)} EGP</span></div>`
    : `<div class="math-line"><span class="math-label">Current Value:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubMkt}</span><span class="math-result">${GOLD_PRICE_UNAVAILABLE}</span></div>
  <div class="math-line"><span class="math-label">Cost Basis:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${goldSubCost} EGP/g</span><span class="math-result">= ${fmt(d.gold.cost)} EGP (mfg fee included)</span></div>
  <div class="math-line"><span class="math-label">Raw P&amp;L:</span><span class="math-calc">value − cost</span><span class="math-result">N/A</span></div>
  <div class="math-line"><span class="math-label">Sell Cashback:</span><span class="math-calc">${fmt(d.gold.gramsHeld)}g × ${fmt2(d.gold.cashbackPerGram)} EGP/g</span><span class="math-result">added on sell, not cost basis</span></div>
  <div class="math-divider"></div>
  <div class="math-line math-total"><span class="math-label">Net P&amp;L:</span><span class="math-calc">(value + cashback) − cost</span><span class="math-result">${GOLD_PNL_UNAVAILABLE}</span></div>`;

  return `
<div id="dashboard-root">

<div class="header">
  <h1>📊 Portfolio · Beeshoy</h1>
  <button class="dark-toggle" onclick="toggleDark()" id="dark-btn" title="Dark mode" aria-label="Toggle dark mode">
    <span class="dark-toggle-track"><span class="dark-toggle-knob" id="dark-toggle-knob">🌙</span></span>
  </button>
  <button class="icon-btn" onclick="doRefresh()" id="refresh-btn" title="Refresh live prices">🔄</button>
  <button class="icon-btn" onclick="openInsights()" title="Insights &amp; Actions">💡</button>
  <button class="icon-btn" onclick="openScan()" title="AI Screenshot Scanner">📸</button>
  <button class="icon-btn" onclick="openNav()" title="Update NAVs">✏️</button>
</div>

<div class="view-toggle-bar" id="view-toggle-bar">
  <span class="view-toggle-slider" id="view-toggle-slider"></span>
  <button class="view-btn active" id="view-btn-total" onclick="setView('total')">📊 Total</button>
  <button class="view-btn gold-view" id="view-btn-gold" onclick="setView('gold')">🥇 Gold</button>
  <button class="view-btn liquid-view" id="view-btn-liquid" onclick="setView('liquid')">💧 Liquid</button>
  <button class="view-btn cert-view" id="view-btn-certs" onclick="setView('certs')">🏦 Certificates</button>
</div>
<div class="view-label" id="view-label">All assets · full portfolio</div>

<div class="api-warning" id="api-warning" style="display:flex">
  ⚠️
  <span id="api-warning-text">USD exchange rate &amp; Gold price unavailable — using fallback estimates. Prices may be inaccurate.</span>
  <button onclick="doRefresh()" style="margin-left:8px;background:var(--card);border:1px solid var(--edge);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;cursor:pointer">Retry</button>
  <button onclick="dismissWarning()" style="margin-left:4px;background:transparent;border:none;font-size:14px;cursor:pointer;padding:0 4px">×</button>
</div>

<div class="live-bar" id="live-bar" style="${liveBarStyle}">
  <span class="${goldDotClass}" id="dot-gold"></span>
  <span class="live-pill">Gold 24K: <b id="live-gold">${goldSubMkt}</b> <span id="gold-status" class="${goldBadgeClass}">${goldBadgeText}</span></span>
  <span class="${usdDotClass}" id="dot-usd"></span>
  <span class="live-pill">USD/EGP: <b id="live-usd">${fmt2(d.settings.usdEgpRate)}</b> <span id="usd-status" class="${usdBadgeClass}">${usdBadgeText}</span></span>
  <span class="live-time" id="live-time"></span>
</div>

<div class="bento">

  <!-- ① HERO TOTAL -->
  <div class="card dark s-4" style="padding:26px 28px" data-view-card="hero">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="card-lbl"><span id="hero-title">Total Portfolio Value</span> <span class="info-icon" onclick="toggleMath('math-total')" title="Show calculation">ℹ</span></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a7a74;margin-top:10px;margin-bottom:4px" id="hero-sublabel">Total Balance · EGP</div>
        <div style="font-family:'Sora',sans-serif;font-size:50px;font-weight:800;line-height:1;letter-spacing:-.02em" id="s-total">${fmt(d.total.value)} EGP</div>
        <div style="font-size:12px;font-weight:600;margin-top:10px;color:var(--teal)" id="s-total-chg" class="neg">▲ ${signedFmt(d.total.pnl)} vs cost (${pctStr(d.total.pnlPct)})</div>
        <div class="math-section" id="math-total"><div id="hero-math-body"></div></div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:#5a7a74;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:4px">Live Rates</div>
        <div style="font-size:11px;color:#c8d4cf;line-height:1.9" id="rate-box">${rateBoxContent}</div>
      </div>
    </div>
  </div>

  <!-- ② PERFORMANCE -->
  <div class="card s-2" data-view-card="perf">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-lbl">Performance <span class="info-icon" id="perf-info-btn" onclick="togglePerfMath()" title="Show calculation">ℹ</span></div>
      <div style="display:flex;gap:0;background:var(--bg);border-radius:20px;padding:3px">
        <button class="perf-pill active" id="pill-pnl" onclick="switchPerf('pnl')">P&amp;L</button>
        <button class="perf-pill" id="pill-yield" onclick="switchPerf('yield')">Yield</button>
        <button class="perf-pill" id="pill-growth" onclick="switchPerf('growth')">Growth</button>
      </div>
    </div>

    <!-- P&L VIEW -->
    <div id="perf-pnl">
      <div style="font-size:22px;margin-bottom:6px">🥇</div>
      <div style="font-family:Sora,sans-serif;font-size:20px;font-weight:800;color:${goldPnlColor}" id="gold-pnl">${goldPnlLabel}</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px;color:var(--dim)" id="gold-pnl-pct">${goldPnlSubLabel}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;position:relative">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)">Breakdown</div>
        <button class="sort-btn" id="pnl-sort-btn" onclick="toggleSortMenu(event)" title="Sort positions">
          <span class="sort-btn-icon">⇅</span><span id="pnl-sort-label">Default</span>
        </button>
        <div class="sort-popover" id="pnl-sort-popover">
          <div class="sort-popover-hint">Tap a parameter to sort all your positions by it.</div>
          <button class="sort-option" id="sort-opt-value" data-key="value" onclick="setSortKey('value')"><span>Market Value</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-pnl" data-key="pnl" onclick="setSortKey('pnl')"><span>Unrealized PnL Value</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-pct" data-key="pct" onclick="setSortKey('pct')"><span>Unrealized PnL %</span><span class="sort-option-arrow"></span></button>
          <button class="sort-option" id="sort-opt-name" data-key="name" onclick="setSortKey('name')"><span>Alphabetical</span><span class="sort-option-arrow"></span></button>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px" id="pnl-rows">
        <div class="pnl-row"><div><div class="pnl-row-name">🥇 Gold 24K</div><div class="pnl-row-sub">${fmt(d.gold.gramsHeld)}g physical</div></div><div style="text-align:right">${goldPnlRowRight}</div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">🏦 Bareeq</div><div class="pnl-row-sub">ABR · money market</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:var(--teal)">${signedFmt(d.abr.pnl)} EGP</div><div style="font-size:9.5px;color:var(--teal);font-weight:600">${pctStr(d.abr.pnlPct)}</div></div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">🏢 Real Est.</div><div class="pnl-row-sub">BRE · property fund</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:${d.re.pnl >= 0 ? "var(--teal)" : "var(--coral)"}">${signedFmt(d.re.pnl)} EGP</div><div style="font-size:9.5px;color:${d.re.pnl >= 0 ? "var(--teal)" : "var(--coral)"};font-weight:600">${pctStr(d.re.pnlPct)}</div></div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">📜 Certificates</div><div class="pnl-row-sub">NBE · interest income</div></div><div style="text-align:right"><div class="pnl-row-val" id="cert-pnl-val" style="color:var(--teal)">${signedFmt(d.certTotals.annualYield)} EGP/yr</div><div style="font-size:9.5px;color:var(--teal);font-weight:600" id="cert-pnl-pct">${pctStr(d.certTotals.weightedAvgRate)} APY</div></div></div>
      </div>
      <div class="math-section" id="math-gold">
        ${mathGoldRows}
      </div>
    </div>

    <!-- YIELD VIEW -->
    <div id="perf-yield" style="display:none">
      <div style="font-size:22px;margin-bottom:6px">💹</div>
      <div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:800" id="s-yield" class="pos">${signedFmt(d.yield.totalMonthly)} EGP/mo</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px" class="neu" id="yield-sub">ABR ${fmt(d.abr.apyPercent)}% + NBE ${d.certTotals.weightedAvgRate.toFixed(1)}% (weighted avg)</div>
      <div class="math-section" id="math-yield">
        <div class="math-line"><span class="math-label">Bareeq:</span><span class="math-calc">${fmt(d.abr.value)} × ${fmt(d.abr.apyPercent)}% ÷ 12</span><span class="math-result">= ${fmt2(d.abr.monthlyYield)} EGP/mo</span></div>
        <div class="math-line"><span class="math-label">NBE Certs:</span><span id="yield-cert-calc" class="math-calc">${fmt(d.certTotals.totalPrincipal)} × ${d.certTotals.weightedAvgRate.toFixed(1)}% ÷ 12</span><span id="yield-cert-result" class="math-result">= ${fmt(d.certTotals.totalMonthly)} EGP/mo</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total"><span class="math-label">Total Yield:</span><span class="math-calc"></span><span id="yield-total-result" class="math-result">${fmt(Math.round(d.yield.totalMonthly))} EGP/mo</span></div>
      </div>
    </div>

    <!-- GROWTH VIEW -->
    <div id="perf-growth" style="display:none">
      <div style="margin-bottom:10px">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)">Savings Growth · Month over Month</div>
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
        <button onclick="saveGrowthSnapshot()" style="border:none;background:var(--teal-soft);color:var(--teal);border-radius:8px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer">+ Save Snapshot</button>
      </div>
    </div>
  </div>

  <!-- ③ WALLET HEALTH -->
  <div class="card dark s-2" data-view-card="health">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-lbl">Wallet Health <span class="info-icon" onclick="toggleMath('math-health')" title="Show calculation">ℹ</span></div>
      <div class="wh-grade" id="wh-grade">${healthGrade(d.health.overallScore)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <div style="flex-shrink:0">
        <div style="font-family:'Sora',sans-serif;font-size:52px;font-weight:800;line-height:1;color:#e8eaed" id="wh-arc-score">${d.health.overallScore}</div>
        <div style="font-size:9px;color:#5a7a74;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">out of 100</div>
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
      <div class="wh-metric"><span class="wh-dot" style="background:#e05a50"></span><span class="wh-mname">Diversity</span><div class="wh-track"><div class="wh-fill" id="wh-div" style="width:0%"></div></div><span class="wh-mval" id="wh-div-v">${Math.round(d.health.diversityScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname">Emergency fund</span><div class="wh-track"><div class="wh-fill" id="wh-ef" style="width:0%"></div></div><span class="wh-mval" id="wh-ef-v">${Math.round(d.health.emergencyFundScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#3dae6e"></span><span class="wh-mname">Yield rate</span><div class="wh-track"><div class="wh-fill" id="wh-yield-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-yield-v">${Math.round(d.health.yieldScore)}</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname">Liquidity</span><div class="wh-track"><div class="wh-fill" id="wh-liq-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-liq-v">${Math.round(d.health.liquidityScore)}</span></div>
    </div>
    <div class="math-section" id="math-health">
      <div class="math-line"><span class="math-label">Diversity:</span><span class="math-calc">100 - ${d.health.goldConcentrationPct.toFixed(1)}% gold conc.</span><span class="math-result">= ${Math.round(d.health.diversityScore)}</span></div>
      <div class="math-line"><span class="math-label">Emergency Fund:</span><span class="math-calc">${fmt(d.abr.value)} ÷ ${fmt(d.settings.emergencyFundTarget)}</span><span class="math-result">= ${Math.round(d.health.emergencyFundScore)}</span></div>
      <div class="math-line"><span class="math-label">Yield Rate:</span><span class="math-calc">${d.health.blendedYieldPct.toFixed(1)}% blended ÷ 27% benchmark</span><span class="math-result">= ${Math.round(d.health.yieldScore)}</span></div>
      <div class="math-line"><span class="math-label">Liquidity:</span><span class="math-calc">${fmt(d.abr.value)} liquid ÷ ${fmt(d.total.value)} total</span><span class="math-result">= ${Math.round(d.health.liquidityPct)}%</span></div>
      <div class="math-divider"></div>
      <div class="math-line math-total"><span class="math-label">Average:</span><span class="math-calc">(${Math.round(d.health.diversityScore)}+${Math.round(d.health.emergencyFundScore)}+${Math.round(d.health.yieldScore)}+${Math.round(d.health.liquidityScore)}) ÷ 4</span><span class="math-result">= ${d.health.overallScore}</span></div>
    </div>
  </div>

  <!-- ④ WALLET SEGMENTS -->
  <div class="card s-2 r-2" style="display:flex;flex-direction:column;gap:10px" data-view-card="segments">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="card-lbl">Wallet Segments <span class="info-icon" onclick="toggleMath('alloc-detail')" title="Show concentration">ℹ</span></div>
      <div style="font-size:9.5px;color:var(--dim)" id="seg-count">4 assets</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <div class="donut-ring" id="donut">
        <svg width="64" height="64" viewBox="0 0 64 64" style="position:absolute;inset:0">
          ${buildDonutRing(d)}
        </svg>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex:1">
        <div class="dl-row"><span class="dl-dot" style="background:#b8893f"></span><span class="dl-name">Gold 24K</span><span class="dl-pct" id="pct-gold">${d.allocation.pctGold.toFixed(1)}%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#0f6a5e"></span><span class="dl-name">Bareeq</span><span class="dl-pct" id="pct-abr">${d.allocation.pctAbr.toFixed(1)}%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#e05a50"></span><span class="dl-name">Real Estate</span><span class="dl-pct" id="pct-re">${d.allocation.pctRe.toFixed(1)}%</span></div>
        <div class="dl-row" id="row-cert" style="display:flex"><span class="dl-dot" style="background:#8b6fb0"></span><span class="dl-name">Certificates</span><span class="dl-pct" id="pct-cert">${d.allocation.pctCert.toFixed(1)}%</span></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0">
      <div class="seg-row"><div class="seg-icon" style="background:var(--gold-soft)">🥇</div><div class="seg-body"><div class="seg-name">Gold 24K · ${fmt(d.gold.gramsHeld)}g</div><div class="seg-meta" id="gold-sub">Avg cost ${goldSubCost} EGP/g · Mkt ${goldSubMkt}</div></div><div class="seg-right"><div class="seg-val" id="seg-gold-val">${goldValueDisplay}</div><div class="seg-pct" id="seg-gold-pct" style="color:var(--dim)">${goldPnlPctDisplay1}</div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--teal-soft)">🏦</div><div class="seg-body"><div class="seg-name">Bareeq Fund</div><div class="seg-meta" id="abr-sub">${fmt(d.abr.apyPercent)}% APY · ${fmt(d.abr.unitsHeld)} certs @ <span id="abr-nav-lbl">${fmt2(d.abr.nav)}</span></div></div><div class="seg-right"><div class="seg-val" id="seg-abr-val">${fmt(d.abr.value)}</div><div class="seg-pct pos">${pctStr(d.abr.pnlPct)} vs cost</div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--coral-soft)">🏢</div><div class="seg-body"><div class="seg-name">Beltone Real Estate</div><div class="seg-meta">${fmt(d.re.unitsHeld)} certs @ <span id="re-nav-lbl">${fmt2(d.re.nav)}</span></div></div><div class="seg-right"><div class="seg-val" id="seg-re-val">${fmt(d.re.value)}</div><div class="seg-pct" style="color:${d.re.pnlPct >= 0 ? "var(--teal)" : "var(--coral)"}">${pctStr(d.re.pnlPct)} vs cost</div></div></div>
      <div class="seg-row" id="seg-cert-row" style="display:flex"><div class="seg-icon" style="background:#ece7f4">📜</div><div class="seg-body"><div class="seg-name">NBE Certificates</div><div class="seg-meta" id="cert-sub">${p.certificates.length} NBE certs · avg ${d.certTotals.weightedAvgRate.toFixed(1)}% APY</div></div><div class="seg-right"><div class="seg-val" id="seg-cert-val">${fmt(d.certTotals.totalPrincipal)}</div><div class="seg-pct" id="seg-cert-pct" style="color:var(--teal)">${signedFmt(d.certTotals.totalMonthly)}/mo</div></div></div>
    </div>
    <div class="math-section" id="alloc-detail" style="margin-top:auto">
      <div id="alloc-detail-text" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">${allocInsight(d)}</div>
    </div>
  </div>

  <!-- ⑤ EMERGENCY FUND PROGRESS -->
  <div class="card s-2" data-view-card="progress">
    <div class="card-lbl">Emergency Fund · Bareeq Target <span class="info-icon" onclick="toggleMath('abr-detail')" title="Show pace details">ℹ</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
      <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800" id="abr-prog-val">${fmt(d.abr.value)} EGP</div>
      <div style="font-size:10px;color:var(--dim);font-weight:600" id="abr-prog-pct-label">${d.health.emergencyFundPct.toFixed(1)}% of ${fmt(d.settings.emergencyFundTarget / 1000)}k</div>
    </div>
    <div class="prog-track"><div class="prog-fill" id="abr-prog-bar" style="width:0%" data-target="${Math.min(100, d.health.emergencyFundPct).toFixed(1)}"></div></div>
    <div class="prog-labels">
      <span id="abr-prog-pct">${d.health.emergencyFundPct.toFixed(1)}%</span>
      <span id="abr-prog-left-label" style="color:var(--dim)">${fmt(Math.max(0, d.settings.emergencyFundTarget - d.abr.value))} EGP to go</span>
    </div>
    <div class="math-section" id="abr-detail" style="margin-top:10px">
      <div id="abr-note" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">📈 Yield only: ~${d.abr.monthlyYield > 0 ? Math.ceil(Math.max(0, d.settings.emergencyFundTarget - d.abr.value) / d.abr.monthlyYield) : "—"} months · add monthly deposits to go faster</div>
    </div>
  </div>

  <!-- ⑥ HOLDINGS HEATMAP -->
  <div class="card s-2" data-view-card="heatmap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="card-lbl" id="heatmap-label">Holdings Heatmap</div>
      <div style="font-size:9px;color:var(--dim)">size = value · color = return</div>
    </div>
    <div id="heatmap-container" style="width:100%;aspect-ratio:1/1;position:relative;border-radius:8px;overflow:hidden">
      <div class="hm-cell" id="hm-cert-cell" style="left:3px;top:3px;width:43%;height:94%;background:${heatColor(0)};animation-delay:0ms"><div class="hm-name">Certificates</div><div class="hm-pct" id="hm-cert-pct">+0.0%</div></div>
      <div class="hm-cell" style="left:47%;top:3px;width:50%;height:55%;background:${heatColor(goldHeatPct)};animation-delay:80ms"><div class="hm-name">Gold 24K</div><div class="hm-pct">${goldPnlPctDisplay1}</div></div>
      <div class="hm-cell" style="left:47%;top:60%;width:37%;height:37%;background:${heatColor(d.abr.pnlPct)};animation-delay:160ms"><div class="hm-name">Bareeq</div><div class="hm-pct">${pctStr(d.abr.pnlPct)}</div></div>
      <div class="hm-cell" style="left:86%;top:60%;width:11%;height:37%;background:${heatColor(d.re.pnlPct)};animation-delay:240ms"><div class="hm-name" style="font-size:8px">RE</div><div class="hm-pct" style="font-size:8px">${pctStr(d.re.pnlPct)}</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
      <span style="font-size:9px;color:var(--dim)">Loss</span>
      <div style="flex:1;height:6px;border-radius:3px;background:linear-gradient(90deg,#c94035,#e07060,#c8c0b0,#2a8a70,#1a6b5a)"></div>
      <span style="font-size:9px;color:var(--dim)">Gain</span>
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
  <div class="card s-2 r-2" data-view-card="dca">
    <div class="card-lbl">🪙 Buy More Gold — Scenario Calculator</div>
    <p class="dca-sub">You hold ${fmt(d.gold.gramsHeld)}g (pure-gold-adjusted) @ ${fmt(d.gold.avgCostPerGram)} EGP/pure-g avg. Scenarios are auto-calculated from live goldbullioneg.com prices (refreshed every 5 min). Manufacturing fee on every buy, cashback on every sell — per the fixed dealer fee schedule.</p>
    <div class="dca-divider"></div>
    <div class="dca-scenarios">
      <div class="dca-scenario-card">
        <div class="dca-scenario-title">Scenario 1 · 1 bar (5g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub">Mfg fee: 87 EGP/g</div>
        <div class="dca-scenario-row"><span>Pay</span><span class="dca-scenario-val" id="dca-s1-pay">—</span></div>
        <div class="dca-scenario-row"><span>New Average</span><span class="dca-scenario-val" id="dca-s1-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s1-drop">—</div>
        <div class="dca-scenario-row"><span>Adjusted PnL</span><span class="dca-scenario-val" id="dca-s1-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title">Scenario 2 · 2 bars of 5g (10g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub">Mfg fee: 87 EGP/g (5g-bar rate)</div>
        <div class="dca-scenario-row"><span>Pay</span><span class="dca-scenario-val" id="dca-s2-pay">—</span></div>
        <div class="dca-scenario-row"><span>New Average</span><span class="dca-scenario-val" id="dca-s2-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s2-drop">—</div>
        <div class="dca-scenario-row"><span>Adjusted PnL</span><span class="dca-scenario-val" id="dca-s2-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title">Scenario 3 · 1 bar (10g, 24K)</div>
        <div class="dca-scenario-row dca-scenario-sub">Mfg fee: 84 EGP/g (10g-bar rate)</div>
        <div class="dca-scenario-row"><span>Pay</span><span class="dca-scenario-val" id="dca-s3-pay">—</span></div>
        <div class="dca-scenario-row"><span>New Average</span><span class="dca-scenario-val" id="dca-s3-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s3-drop">—</div>
        <div class="dca-scenario-row"><span>Adjusted PnL</span><span class="dca-scenario-val" id="dca-s3-pnl">—</span></div>
      </div>
      <div class="dca-scenario-card">
        <div class="dca-scenario-title">Scenario 4 · Gold Pound (21K, 8g)</div>
        <div class="dca-scenario-row dca-scenario-sub">Mfg fee: 77 EGP/g · Cashback: 24 EGP/g</div>
        <div class="dca-scenario-row"><span>Pay</span><span class="dca-scenario-val" id="dca-s4-pay">—</span></div>
        <div class="dca-scenario-row"><span>New Average</span><span class="dca-scenario-val" id="dca-s4-avg">—</span></div>
        <div class="dca-scenario-row dca-scenario-sub" id="dca-s4-drop">—</div>
        <div class="dca-scenario-row"><span>Adjusted PnL</span><span class="dca-scenario-val" id="dca-s4-pnl">—</span></div>
      </div>
    </div>
    <div class="note-chip" style="margin-top:14px" id="dca-note">${d.gold.pnlAvailable ? `ℹ️ Prices from goldbullioneg.com (live). Manufacturing fees and cashback from the fixed dealer fee schedule. Refreshes every 5 min.` : `⚠️ Waiting for live gold prices from goldbullioneg.com — scenarios will appear once the first scrape completes.`}</div>
  </div>

</div><!-- /bento -->

<!-- CERTIFICATES DETAIL -->
<div id="certs-placeholder" style="display:none;margin-top:var(--gap)">
  <div class="card dark" style="padding:26px 28px;margin-bottom:var(--gap)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="card-lbl" style="color:#5a7a74">NBE Certificates · Total Principal <span class="info-icon" onclick="toggleMath('math-certs-hero')" title="Show calculation" style="color:#5a7a74;background:rgba(255,255,255,.06)">ℹ</span></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a7a74;margin-top:10px;margin-bottom:4px">Principal Balance · EGP</div>
        <div style="font-family:'Sora',sans-serif;font-size:50px;font-weight:800;line-height:1;letter-spacing:-.02em;color:#e8eaed">${fmt(d.certTotals.totalPrincipal)} <span style="font-size:22px;color:#5a7a74">EGP</span></div>
        <div style="font-size:12px;font-weight:600;margin-top:10px;color:#3dae6e" id="cert-hero-chg">↑ ${d.certTotals.weightedAvgRate.toFixed(1)}% avg APY · ${signedFmt(d.certTotals.totalMonthly)} EGP/mo</div>
        <div style="display:flex;gap:20px;margin-top:16px;flex-wrap:wrap">
          <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Certificates</div><div style="font-size:16px;font-weight:800;color:#e8eaed">${p.certificates.length}</div></div>
          <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Annual Yield</div><div style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-annual-yield">${fmt(d.certTotals.annualYield)} EGP</div></div>
          <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Monthly Yield</div><div style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-monthly-yield">${fmt(d.certTotals.totalMonthly)} EGP</div></div>
          <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Maturing in 90d</div><div style="font-size:16px;font-weight:800;color:#d99a2b" id="cert-maturing-soon">${d.certTotals.maturingSoon} certs</div></div>
        </div>
        <div class="math-section" id="math-certs-hero" style="margin-top:14px">
          <div class="math-line"><span class="math-label" style="color:#5a7a74">Total Principal:</span><span class="math-calc" style="color:#5a7a74">${p.certificates.length} certificates</span><span class="math-result" style="color:#e8eaed">${fmt(d.certTotals.totalPrincipal)} EGP</span></div>
          <div class="math-line"><span class="math-label" style="color:#5a7a74">Avg APY:</span><span class="math-calc" id="math-cert-avg-calc" style="color:#5a7a74">Σ(value × rate) ÷ ${fmt(d.certTotals.totalPrincipal)}</span><span class="math-result" style="color:#3dae6e" id="math-cert-avg-result">${d.certTotals.weightedAvgRate.toFixed(1)}%</span></div>
          <div class="math-line"><span class="math-label" style="color:#5a7a74">Annual Yield:</span><span class="math-calc" id="math-cert-annual-calc" style="color:#5a7a74">${fmt(d.certTotals.totalPrincipal)} × ${d.certTotals.weightedAvgRate.toFixed(1)}% = ${fmt(d.certTotals.annualYield)} EGP</span><span class="math-result" style="color:#3dae6e" id="math-cert-annual-result">${fmt(d.certTotals.annualYield)} EGP/yr</span></div>
          <div class="math-divider" style="background:rgba(255,255,255,.06)"></div>
          <div class="math-line"><span class="math-label" style="color:#3dae6e">Monthly yield:</span><span class="math-calc" style="color:#5a7a74">annual ÷ 12</span><span class="math-result" style="color:#3dae6e" id="math-cert-monthly-result">${fmt(d.certTotals.totalMonthly)} EGP/mo</span></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:#5a7a74;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:6px">Live Rates</div>
        <div style="font-size:11px;color:#c8d4cf;line-height:2" id="cert-hero-rates">Avg APY: ${d.certTotals.weightedAvgRate.toFixed(1)}%<br>Monthly yield: ${fmt(d.certTotals.totalMonthly)} EGP</div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)">
    <div class="card"><div class="card-lbl" style="margin-bottom:12px">Maturity Timeline</div><div id="cert-timeline"></div></div>
    <div class="card"><div class="card-lbl" style="margin-bottom:12px">By Interest Rate</div><div id="cert-rate-breakdown"></div></div>
  </div>
  <div class="card" style="margin-top:var(--gap)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-lbl">All Certificates · NBE</div>
      <div style="font-size:9.5px;color:var(--teal);font-weight:700" id="cert-avg-rate">Avg ${d.certTotals.weightedAvgRate.toFixed(1)}% APY</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      <button class="chip active" id="cert-chip-all" onclick="filterCerts('all')">All ${p.certificates.length}</button>
      <button class="chip" id="cert-chip-high" onclick="filterCerts('high')">🔥 High Rate (≥20%)</button>
      <button class="chip" id="cert-chip-soon" onclick="filterCerts('soon')">⚠️ Due Soon</button>
    </div>
    <table class="ah-table" id="certs-table">
      <thead><tr><th>Certificate</th><th>Value</th><th>Rate</th><th>Maturity</th><th>Monthly</th></tr></thead>
      <tbody id="certs-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ACTIVITY & HOLDINGS -->
<div style="margin-top:var(--gap)" data-view-card="activity">
  <div class="card" style="width:100%">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-lbl">Activity &amp; Holdings</div>
      <div style="font-size:9.5px;color:var(--teal);font-weight:700">All orders · Fulfilled ✓</div>
    </div>
    <div style="display:flex;gap:0;border-bottom:2px solid var(--edge);margin-bottom:16px">
      <button class="ah-tab active" id="tab-holdings" onclick="switchTab('holdings')">📊 Holdings</button>
      <button class="ah-tab" id="tab-transactions" onclick="switchTab('transactions')">🧾 Transactions</button>
    </div>
    <div id="panel-holdings">
      <table class="ah-table">
        <thead><tr><th>Asset</th><th>Value (EGP)</th><th>Cost</th><th>Return</th></tr></thead>
        <tbody id="holdings-tbody">
          ${buildHoldingsRows(p, d)}
        </tbody>
      </table>
    </div>
    <div id="panel-transactions" style="display:none">
      <div id="tx-chip-bar" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        <button class="chip active" id="chip-all" onclick="filterTx('all')">All</button>
        <button class="chip" id="chip-gold" onclick="filterTx('gold')">🥇 Gold</button>
        <button class="chip" id="chip-abr" onclick="filterTx('abr')">🏦 Bareeq</button>
        <button class="chip" id="chip-re" onclick="filterTx('re')">🏢 Real Estate</button>
      </div>
      <div id="tx-list">
        ${buildTransactions(p)}
      </div>
    </div>
  </div>
</div>

<!-- AI SCREENSHOT SCANNER DRAWER -->
<div class="scan-overlay" id="scan-overlay">
  <div class="scan-drawer">
    <h2>📸 AI Scanner <button onclick="closeScan()">Close</button></h2>
    <p class="scan-sub">Upload a screenshot and AI will read it and update your dashboard automatically.</p>
    <div class="scan-modes" id="scan-modes">
      <button class="scan-mode-btn" onclick="selectScanMode('order')" id="mode-order"><div class="scan-mode-icon" style="background:var(--teal-soft)">🧾</div><div class="scan-mode-body"><div class="scan-mode-title">Thndr Order Confirmation</div><div class="scan-mode-desc">After buying/selling ABR or BRE — reads fund, certs, NAV, amount and updates positions.</div></div></button>
      <button class="scan-mode-btn" onclick="selectScanMode('nav')" id="mode-nav"><div class="scan-mode-icon" style="background:var(--gold-soft)">📊</div><div class="scan-mode-body"><div class="scan-mode-title">Fund NAV Screenshot</div><div class="scan-mode-desc">Any fund price page — reads current NAV and updates that fund's price.</div></div></button>
    </div>
    <div class="scan-upload-area" id="scan-upload-area" onclick="document.getElementById('scan-file-input').click()">
      <img class="scan-preview" id="scan-preview" src="" alt="" style="display:none">
      <input type="file" id="scan-file-input" accept="image/*" onchange="onFileSelected(event)" style="display:none">
      <span class="scan-upload-label" id="scan-upload-label">📁 Tap to choose screenshot</span>
    </div>
    <div class="scan-processing" id="scan-processing"><div class="scan-spinner"></div><span id="scan-processing-text">AI is reading your screenshot…</span></div>
    <div class="scan-error" id="scan-error"></div>
    <div class="scan-result" id="scan-result"><div class="scan-result-title" id="scan-result-title">Extracted Data</div><div id="scan-result-body"></div></div>
    <div id="scan-actions" style="display:none;margin-top:4px"><button class="btn btn-primary" style="width:100%" id="scan-apply-btn" onclick="applyScanResult()">Apply to Dashboard</button></div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:10px;color:var(--dim)" id="scan-key-status">API Key: not set</span>
      <button onclick="openApiKey()" style="border:none;background:var(--bg);border-radius:7px;padding:4px 10px;font-size:10.5px;font-weight:600;color:var(--dim);cursor:pointer">⚙️ Set API Key</button>
    </div>
  </div>
</div>

<!-- API KEY SETUP MODAL -->
<div class="apikey-overlay" id="apikey-overlay">
  <div class="apikey-modal">
    <h2>🔑 Gemini API Key</h2>
    <p>This key is stored only in your browser (localStorage) and never sent anywhere except Google's API.</p>
    <div class="apikey-steps"><b>Get your free key:</b><br>1. Go to <b>aistudio.google.com</b><br>2. Sign in with Google<br>3. Click <b>Get API Key → Create API key</b><br>4. Copy and paste it below</div>
    <div class="modal-field" style="margin-top:12px"><label>Gemini API Key</label><input type="password" id="input-gemini-key" placeholder="AIza..."></div>
    <div class="apikey-status" id="apikey-status"></div>
    <div class="modal-actions"><button class="btn btn-cancel" onclick="closeApiKey()">Cancel</button><button class="btn btn-primary" onclick="saveApiKey()">Save Key</button></div>
  </div>
</div>

<!-- INSIGHTS DRAWER -->
<div class="insight-overlay" id="insight-overlay">
  <div class="insight-drawer">
    <h2>💡 Cross-Card Intelligence <button onclick="closeInsights()">Close</button></h2>
    <div style="font-size:10.5px;color:var(--dim);margin-bottom:14px;line-height:1.5" id="insights-timestamp"></div>
    <div id="insights-body">
      ${buildInsights(d)}
    </div>
  </div>
</div>

<!-- NAV EDITOR MODAL -->
<div class="modal-overlay" id="nav-modal">
  <div class="modal">
    <h2>✏️ Update NAVs</h2>
    <p>Enter the latest fund NAVs from your app. Values are saved to the database and reflected everywhere. Gold holdings are derived from your recorded gold transactions, not editable here.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="modal-field"><label>Bareeq NAV (EGP/cert)</label><input type="number" id="input-abr-nav" step="0.0001" placeholder="e.g. 207.80"></div>
      <div class="modal-field"><label>Bareeq Certs held</label><input type="number" id="input-abr-certs" step="1" placeholder="e.g. 72"></div>
      <div class="modal-field"><label>Real Estate NAV</label><input type="number" id="input-re-nav" step="0.0001" placeholder="e.g. 1.91"></div>
      <div class="modal-field"><label>Real Estate Certs</label><input type="number" id="input-re-certs" step="1" placeholder="e.g. 2656"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-cancel" onclick="closeNav()">Cancel</button>
      <button class="btn btn-primary" id="nav-apply-btn" onclick="applyNavs()">Apply &amp; Save</button>
    </div>
  </div>
</div>

<footer>Last updated: <span id="last-updated"></span> · Prices via open APIs · Funds: manual NAV</footer>

</div><!-- /dashboard-root -->
`;
}

function signedFmt(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : `${fmt(n)}`;
}

function healthGrade(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 55) return "Good";
  if (score >= 35) return "Needs attention";
  return "At risk";
}

function allocInsight(d: Derived): string {
  if (d.allocation.pctGold > 30) {
    return `Gold at ${d.allocation.pctGold.toFixed(0)}% is above the recommended 30% max for a single asset. Consider diversifying into liquid instruments or additional certificates to rebalance.`;
  }
  return `Your portfolio allocation is within recommended concentration limits. Gold sits at ${d.allocation.pctGold.toFixed(0)}%, well diversified against your other holdings.`;
}

function buildInsights(d: Derived): string {
  const items: string[] = [];
  if (d.health.goldConcentrationPct > 30) {
    items.push(
      `<div class="insight-item"><div class="insight-icon">⚠️</div><div><div class="insight-title">High Gold Concentration</div><div class="insight-desc">Gold represents ${d.health.goldConcentrationPct.toFixed(0)}% of your portfolio — above the recommended 30% max. Consider rebalancing into liquid instruments.</div></div></div>`,
    );
  }
  if (d.health.liquidityPct < 20) {
    items.push(
      `<div class="insight-item"><div class="insight-icon">💧</div><div><div class="insight-title">Low Liquidity (${d.health.liquidityPct.toFixed(0)}%)</div><div class="insight-desc">Only ${fmt(d.abr.value)} EGP (${d.health.liquidityPct.toFixed(1)}%) is liquid. Consider keeping at least 15–20% in liquid assets for emergencies.</div></div></div>`,
    );
  }
  items.push(
    `<div class="insight-item"><div class="insight-icon">📈</div><div><div class="insight-title">Emergency Fund at ${d.health.emergencyFundPct.toFixed(0)}%</div><div class="insight-desc">Your Bareeq balance covers ${d.health.emergencyFundPct.toFixed(0)}% of the ${fmt(d.settings.emergencyFundTarget)} EGP target.</div></div></div>`,
  );
  items.push(
    `<div class="insight-item"><div class="insight-icon">🥇</div><div><div class="insight-title">Gold Performance</div><div class="insight-desc">${fmt(d.gold.gramsHeld)}g at a cost basis of ${fmt(d.gold.cost)} EGP (avg ${fmt(d.gold.avgCostPerGram)} EGP/g, mfg fee included). Sell cashback of ${fmt2(d.gold.cashbackPerGram)} EGP/g applies on sell. ${GOLD_PNL_UNAVAILABLE}.</div></div></div>`,
  );
  items.push(
    `<div class="insight-item"><div class="insight-icon">💹</div><div><div class="insight-title">Certificate Yield</div><div class="insight-desc" id="insight-cert-desc">Your ${d.certs.length} NBE certificates generate ~${fmt(d.certTotals.totalMonthly)} EGP/month (${fmt(d.certTotals.annualYield)} EGP/yr) at a weighted average ${d.certTotals.weightedAvgRate.toFixed(1)}% APY — reinvesting into Bareeq would compound growth.</div></div></div>`,
  );
  return items.join("\n");
}
