import type { Portfolio } from "@workspace/api-client-react";
import type { Derived, DerivedCertificate } from "./portfolioMath";
import { fmt, fmt2 } from "./portfolioMath";
import {
  MFG_FEE_5G_24K_PER_GRAM,
  MFG_FEE_10G_24K_PER_GRAM,
  MFG_FEE_GOLD_POUND_21K_PER_GRAM,
  CASHBACK_21K_PER_GRAM,
  purityFraction,
  GOLD_POUND_GRAMS,
  BAR_5G_GRAMS,
  BAR_10G_GRAMS,
} from "./goldFeeSchedule";

export interface DashboardCallbacks {
  updateFund: (
    key: "abr" | "re",
    body: { unitsHeld?: number; nav?: number },
  ) => Promise<void>;
  createSnapshot: (value: number) => Promise<void>;
}

type WindowFns = Record<string, unknown>;

// Wires up all the interactive behavior for the dashboard markup produced by
// buildDashboardHtml(). Returns a cleanup function that removes the global
// handlers this installs, so re-renders don't leak listeners.
export function initDashboardBehavior(
  portfolio: Portfolio,
  derived: Derived,
  callbacks: DashboardCallbacks,
): () => void {
  let currentView = "total";
  let currentPerf = "pnl";
  let currentSortKey: string | null = null;
  let sortDesc = false;

  const el = (id: string) => document.getElementById(id);
  const win = window as unknown as WindowFns;

  const CERTS_DATA: DerivedCertificate[] = derived.certs;

  function updateTime() {
    const now = new Date();
    const t = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const lt = el("live-time");
    if (lt) lt.textContent = t;
    const lu = el("last-updated");
    if (lu) lu.textContent = t;
  }

  const VIEW_CONFIG: Record<
    string,
    { label: string; cards: string[]; assetGroup: string | null }
  > = {
    total: {
      label: "All assets · full portfolio",
      cards: ["hero", "perf", "health", "segments", "progress", "heatmap"],
      assetGroup: null,
    },
    gold: {
      label: "Gold 24K · physical position",
      cards: ["hero", "perf", "dca", "activity"],
      assetGroup: "gold",
    },
    liquid: {
      label: "Liquid assets · Bareeq & funds",
      cards: ["hero", "perf", "progress", "activity"],
      assetGroup: "liquid",
    },
    certs: {
      label: "NBE Certificates · fixed income",
      cards: [],
      assetGroup: "certs",
    },
  };

  const ml = (label: string, calc: string, result: string, cls = "") =>
    `<div class="math-line ${cls}"><span class="math-label">${label}</span><span class="math-calc">${calc}</span><span class="math-result">${result}</span></div>`;
  const divider = () => `<div class="math-divider"></div>`;

  function heroMath(view: string): string {
    if (view === "gold") {
      if (derived.gold.pnlAvailable) {
        return [
          ml("Sell Price:", "24K · goldbullioneg.com", `${fmt(derived.gold.livePricePerGram!)} EGP/g`),
          ml("Current Value:", `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.livePricePerGram!)} EGP/g`, `= ${fmt(derived.gold.value!)} EGP`),
          ml("Cost Basis:", `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`, `= ${fmt(derived.gold.cost)} EGP (mfg fee incl.)`),
          ml("Raw P&amp;L:", "value − cost", `${derived.gold.rawPnl! >= 0 ? "+" : ""}${fmt(derived.gold.rawPnl!)} EGP`),
          ml("Sell Cashback:", `${fmt(derived.gold.gramsHeld)}g × ${fmt2(derived.gold.cashbackPerGram)} EGP/g`, `= ${fmt(derived.gold.cashback!)} EGP (refunded on sell)`),
          divider(),
          ml("Net P&amp;L:", "(value + cashback) − cost", `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP`, "math-total"),
        ].join("");
      }
      return [
        ml(
          "Current Value:",
          `${fmt(derived.gold.gramsHeld)}g × live price`,
          "Live gold price unavailable — feature in development",
        ),
        ml(
          "Cost Basis:",
          `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`,
          `= ${fmt(derived.gold.cost)} EGP (mfg fee included, paid at purchase)`,
        ),
        ml("Raw P&amp;L:", "value − cost", "N/A"),
        ml(
          "Sell Cashback:",
          `${fmt(derived.gold.gramsHeld)}g × ${derived.gold.cashbackPerGram} EGP/g`,
          "refunded on sell, added to value — not the cost basis",
        ),
        divider(),
        ml(
          "Net P&amp;L:",
          "(value + cashback) − cost",
          "PnL unavailable — live price feature in development",
          "math-total",
        ),
      ].join("");
    }
    if (view === "liquid") {
      return [
        ml(
          "Bareeq:",
          `${fmt(derived.abr.unitsHeld)} certs × ${derived.abr.nav.toFixed(2)}`,
          `= ${fmt(derived.abr.value)} EGP`,
        ),
        ml(
          "Real Estate:",
          `${fmt(derived.re.unitsHeld)} certs × ${derived.re.nav.toFixed(2)}`,
          `= ${fmt(derived.re.value)} EGP`,
        ),
        divider(),
        ml(
          "Combined NAV:",
          `${fmt(derived.abr.value)} + ${fmt(derived.re.value)}`,
          `= ${fmt(derived.liquid.value)} EGP`,
          "math-total",
        ),
        ml(
          "Cost Basis:",
          `${fmt(derived.abr.costBasisTotal)} + ${fmt(derived.re.costBasisTotal)}`,
          `= ${fmt(derived.liquid.cost)} EGP`,
        ),
        ml(
          "P&amp;L:",
          `${fmt(derived.liquid.value)} − ${fmt(derived.liquid.cost)}`,
          `${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} EGP (${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%)`,
          "math-total",
        ),
      ].join("");
    }
    return [
      derived.gold.pnlAvailable
        ? ml(
            "Gold 24K (live sell price):",
            `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.livePricePerGram!)} EGP/g`,
            `= ${fmt(derived.gold.value!)} EGP`,
          )
        : ml(
            "Gold (at cost, live price pending):",
            `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`,
            `= ${fmt(derived.gold.cost)} EGP (mfg fee included)`,
          ),
      ml(
        "Bareeq:",
        `${fmt(derived.abr.unitsHeld)} certs × ${derived.abr.nav.toFixed(2)}`,
        `= ${fmt(derived.abr.value)} EGP`,
      ),
      ml(
        "Real Estate:",
        `${fmt(derived.re.unitsHeld)} × ${derived.re.nav.toFixed(2)}`,
        `= ${fmt(derived.re.value)} EGP`,
      ),
      ml(
        "Certificates:",
        `${CERTS_DATA.length} certs · avg ${derived.certTotals.weightedAvgRate.toFixed(1)}% APY`,
        `= ${fmt(derived.certTotals.totalPrincipal)} EGP`,
      ),
      divider(),
      ml("Total Value:", "", `${fmt(derived.total.value)} EGP`, "math-total"),
      ml("Total Cost:", "", `~${fmt(derived.total.cost)} EGP`),
      ml(
        "P&amp;L:",
        "",
        `${derived.total.pnl >= 0 ? "+" : ""}${fmt(derived.total.pnl)} (${derived.total.pnlPct >= 0 ? "+" : ""}${derived.total.pnlPct.toFixed(1)}%)`,
        "math-total",
      ),
    ].join("");
  }

  // `sentiment` drives both the arrow (▲/▼) and the color of the hero
  // "chg" line — "up" and "down" are true P&L signals, "neutral" is used
  // for the certificates view (a fixed-rate yield line, not a P&L figure)
  // where an up/down arrow would be misleading.
  const HERO_CFG: Record<
    string,
    {
      title: string;
      sub: string;
      val: string;
      chg: string;
      rates: string;
      sentiment: "up" | "down" | "neutral";
    }
  > = {
    total: {
      title: "Total Portfolio Value",
      sub: "Total Cost Basis · EGP",
      val: `${fmt(derived.total.cost)} EGP`,
      chg: `Market Value: ${fmt(derived.total.value)} EGP (net P&L ${derived.total.pnl >= 0 ? "+" : ""}${fmt(derived.total.pnl)} EGP, ${derived.total.pnlPct >= 0 ? "+" : ""}${derived.total.pnlPct.toFixed(1)}%)`,
      rates: derived.gold.pnlAvailable
        ? `Sell: ${fmt(derived.gold.livePricePerGram!)} EGP/g · Buy: ${fmt((portfolio.gold as any).buyPrice24k)} EGP/g<br>USD/EGP: ${derived.settings.usdEgpRate.toFixed(2)}`
        : `Gold: Live price unavailable<br>USD/EGP: ${derived.settings.usdEgpRate.toFixed(2)}`,
      sentiment: derived.total.pnl >= 0 ? "up" : "down",
    },
    gold: {
      title: "Gold 24K · Physical",
      sub: "Cost Basis · EGP (mfg fee incl.)",
      val: `${fmt(derived.gold.cost)} EGP`,
      chg: derived.gold.pnlAvailable
        ? `Market Value: ${fmt(derived.gold.value!)} EGP (net P&L ${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP, ${derived.gold.pnlPct!.toFixed(1)}% + cashback)`
        : "PnL unavailable — live price feature in development",
      rates: derived.gold.pnlAvailable
        ? `Sell: ${fmt(derived.gold.livePricePerGram!)} EGP/g · Buy: ${fmt((portfolio.gold as any).buyPrice24k)} EGP/g<br>Cashback: ${fmt2(derived.gold.cashbackPerGram)} EGP/g on sell`
        : `Avg cost: ${fmt(derived.gold.avgCostPerGram)} EGP/g (mfg fee incl.)<br>Market: Live price unavailable<br>Cashback: ${fmt2(derived.gold.cashbackPerGram)} EGP/g on sell`,
      sentiment: !derived.gold.pnlAvailable
        ? "neutral"
        : derived.gold.netPnl! >= 0
          ? "up"
          : "down",
    },
    liquid: {
      title: "Liquid Assets · Funds",
      sub: "Cost Basis · EGP",
      val: `${fmt(derived.liquid.cost)} EGP`,
      chg: `Market Value: ${fmt(derived.liquid.value)} EGP (net P&L ${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} EGP, ${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%)`,
      rates: `Bareeq NAV: ${derived.abr.nav.toFixed(2)}/cert<br>Real Estate: ${derived.re.nav.toFixed(2)}/cert`,
      sentiment: derived.liquid.pnl >= 0 ? "up" : "down",
    },
    certs: {
      title: "NBE Certificates",
      sub: "Principal Balance · EGP",
      val: `${fmt(derived.certTotals.totalPrincipal)} EGP`,
      chg: `${derived.certTotals.weightedAvgRate.toFixed(1)}% avg APY · +${fmt(derived.certTotals.totalMonthly)} EGP/mo`,
      rates: `Avg APY: ${derived.certTotals.weightedAvgRate.toFixed(1)}%<br>Monthly yield: ${fmt(derived.certTotals.totalMonthly)} EGP`,
      sentiment: "neutral",
    },
  };

  const SENTIMENT_ARROW: Record<"up" | "down" | "neutral", string> = {
    up: "▲",
    down: "▼",
    neutral: "↑",
  };
  const SENTIMENT_COLOR: Record<"up" | "down" | "neutral", string> = {
    up: "var(--teal)",
    down: "var(--coral)",
    neutral: "var(--teal)",
  };

  win.setView = (view: string) => {
    currentView = view;
    const cfg = VIEW_CONFIG[view] || VIEW_CONFIG.total;
    el("view-label")!.textContent = cfg.label;

    ["total", "gold", "liquid", "certs"].forEach((v) => {
      el(`view-btn-${v}`)?.classList.toggle("active", v === view);
    });

    document.querySelectorAll("[data-view-card]").forEach((card) => {
      const tags = (card.getAttribute("data-view-card") || "")
        .split(",")
        .map((t) => t.trim());
      const visible = tags.some((t) => cfg.cards.includes(t));
      (card as HTMLElement).style.display = visible ? "" : "none";
    });

    const cp = el("certs-placeholder");
    if (cp) cp.style.display = view === "certs" ? "block" : "none";

    const btns = ["total", "gold", "liquid", "certs"];
    const idx = btns.indexOf(view);
    const bar = el("view-toggle-bar");
    const slider = el("view-toggle-slider");
    if (bar && slider) {
      const btnWidth = bar.offsetWidth / 4;
      slider.style.left = 3 + idx * btnWidth + "px";
      slider.style.width = btnWidth - 4 + "px";
    }

    const hcfg = HERO_CFG[view] || HERO_CFG.total;
    const heroTitle = el("hero-title");
    if (heroTitle) heroTitle.textContent = hcfg.title;
    const heroSub = el("hero-sublabel");
    if (heroSub) heroSub.textContent = hcfg.sub;
    const heroVal = el("s-total");
    if (heroVal) heroVal.textContent = hcfg.val;
    const heroChg = el("s-total-chg");
    if (heroChg) {
      heroChg.textContent = `${SENTIMENT_ARROW[hcfg.sentiment]} ${hcfg.chg}`;
      heroChg.style.color = SENTIMENT_COLOR[hcfg.sentiment];
      heroChg.classList.toggle("pos", hcfg.sentiment !== "down");
      heroChg.classList.toggle("neg", hcfg.sentiment === "down");
    }
    const rateBox = el("rate-box");
    if (rateBox) rateBox.innerHTML = hcfg.rates;
    const mathBody = el("hero-math-body");
    if (mathBody) mathBody.innerHTML = heroMath(view);

    updatePerfPnlForView(view);
    updatePerfTabsForView(view);
    renderHoldingsForView(view);
    applyTxChipsForView(view);
  };

  // Physical gold isn't yield-bearing or tracked for growth — it just sits
  // until it's sold — so the Yield/Growth tabs of the Performance card only
  // make sense outside the gold view. Hide them there and fall back to P&L.
  function updatePerfTabsForView(view: string) {
    const isGold = view === "gold";
    const pillYield = el("pill-yield");
    const pillGrowth = el("pill-growth");
    if (pillYield) pillYield.style.display = isGold ? "none" : "";
    if (pillGrowth) pillGrowth.style.display = isGold ? "none" : "";
    if (isGold && currentPerf !== "pnl") {
      (win.switchPerf as (type: string) => void)("pnl");
    }
  }

  // The P&L tab of the Performance card defaults to a portfolio-wide
  // headline (gold P&L) with every position in the breakdown — that stays
  // as-is for the "total" (and "certs") views. For "gold" and "liquid" we
  // narrow both the headline figure and the breakdown rows to just that
  // asset group, so the widget reflects the toggle you're looking at.
  function updatePerfPnlForView(view: string) {
    const icon = el("perf-pnl-icon");
    const headline = el("gold-pnl");
    const sub = el("gold-pnl-pct");
    const rows = document.querySelectorAll<HTMLElement>(
      "#pnl-rows .pnl-row[data-perf-group]",
    );

    if (view === "gold") {
      if (icon) icon.textContent = "🥇";
      if (headline) {
        headline.textContent = derived.gold.pnlAvailable
          ? `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP net`
          : "PnL unavailable";
        (headline as HTMLElement).style.color = derived.gold.pnlAvailable
          ? derived.gold.netPnl! >= 0
            ? "var(--teal)"
            : "var(--coral)"
          : "var(--dim)";
      }
      if (sub) {
        sub.textContent = derived.gold.pnlAvailable
          ? `${derived.gold.pnlPct! >= 0 ? "+" : ""}${derived.gold.pnlPct!.toFixed(1)}% raw · ${fmt2(derived.gold.cashbackPerGram)} EGP/g cashback on sell`
          : `Cashback rate on file: ${fmt2(derived.gold.cashbackPerGram)} EGP/g (applied on sell)`;
      }
      rows.forEach((row) => {
        row.style.display =
          row.getAttribute("data-perf-group") === "gold" ? "flex" : "none";
      });
    } else if (view === "liquid") {
      if (icon) icon.textContent = "💧";
      if (headline) {
        headline.textContent = `${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} EGP net`;
        (headline as HTMLElement).style.color =
          derived.liquid.pnl >= 0 ? "var(--teal)" : "var(--coral)";
      }
      if (sub) {
        sub.textContent = `${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}% · Bareeq + Real Estate combined`;
      }
      rows.forEach((row) => {
        row.style.display =
          row.getAttribute("data-perf-group") === "liquid" ? "flex" : "none";
      });
    } else {
      // total / certs: restore the default portfolio-wide headline and show
      // every position in the breakdown.
      if (icon) icon.textContent = "🥇";
      if (headline) {
        headline.textContent = derived.gold.pnlAvailable
          ? `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP net`
          : "PnL unavailable";
        (headline as HTMLElement).style.color = derived.gold.pnlAvailable
          ? derived.gold.netPnl! >= 0
            ? "var(--teal)"
            : "var(--coral)"
          : "var(--dim)";
      }
      if (sub) {
        sub.textContent = derived.gold.pnlAvailable
          ? `${derived.gold.pnlPct! >= 0 ? "+" : ""}${derived.gold.pnlPct!.toFixed(1)}% raw · ${fmt2(derived.gold.cashbackPerGram)} EGP/g cashback on sell`
          : `Cashback rate on file: ${fmt2(derived.gold.cashbackPerGram)} EGP/g (applied on sell)`;
      }
      rows.forEach((row) => {
        row.style.display = "flex";
      });
    }
  }

  win.switchPerf = (type: string) => {
    currentPerf = type;
    ["pnl", "yield", "growth"].forEach((t) => {
      el(`perf-${t}`)!.style.display = t === type ? "block" : "none";
      el(`pill-${t}`)?.classList.toggle("active", t === type);
    });
  };

  win.switchTab = (tab: string) => {
    el("panel-holdings")!.style.display = tab === "holdings" ? "block" : "none";
    el("panel-transactions")!.style.display =
      tab === "transactions" ? "block" : "none";
    el("tab-holdings")?.classList.toggle("active", tab === "holdings");
    el("tab-transactions")?.classList.toggle("active", tab === "transactions");
  };

  function txTypesForView(view: string): string[] {
    if (view === "gold") return ["gold"];
    if (view === "liquid") return ["abr", "re"];
    return ["gold", "abr", "re"];
  }

  function applyTxChipsForView(view: string) {
    const valid = txTypesForView(view);
    const chipBar = el("tx-chip-bar");
    if (!chipBar) return;

    if (view === "gold") {
      chipBar.style.display = "none";
    } else {
      chipBar.style.display = "flex";
      const chipAll = el("chip-all");
      if (chipAll) chipAll.style.display = "";
      const chipMap: Record<string, string> = {
        gold: "chip-gold",
        abr: "chip-abr",
        re: "chip-re",
      };
      Object.entries(chipMap).forEach(([type, chipId]) => {
        const c = el(chipId);
        if (c) c.style.display = valid.includes(type) ? "" : "none";
      });
    }

    if (view === "gold") {
      applyTxFilter("gold", valid);
    } else {
      ["all", "gold", "abr", "re"].forEach((t) =>
        el(`chip-${t}`)?.classList.remove("active"),
      );
      el("chip-all")?.classList.add("active");
      applyTxFilter("all", valid);
    }
  }

  function applyTxFilter(type: string, validTypes: string[]) {
    document.querySelectorAll("#tx-list .tx-entry").forEach((entry) => {
      const dtype = entry.getAttribute("data-type") || "";
      const inScope = validTypes.includes(dtype);
      const matchesFilter = type === "all" || dtype === type;
      (entry as HTMLElement).style.display =
        inScope && matchesFilter ? "flex" : "none";
    });
  }

  win.filterTx = (type: string) => {
    const valid = txTypesForView(currentView);
    ["all", "gold", "abr", "re"].forEach((t) =>
      el(`chip-${t}`)?.classList.toggle("active", t === type),
    );
    applyTxFilter(type, valid);
  };

  function renderHoldingsForView(view: string) {
    const rows = document.querySelectorAll(
      "#holdings-tbody tr[data-asset-group]",
    );
    const totalRow = document.querySelector(
      "#holdings-tbody tr.holdings-total-row",
    ) as HTMLElement | null;

    rows.forEach((row) => {
      const group = row.getAttribute("data-asset-group") || "";
      let visible = true;
      if (view === "gold") visible = group === "gold";
      if (view === "liquid") visible = group === "liquid";
      if (view === "certs") visible = group === "certs";
      (row as HTMLElement).style.display = visible ? "" : "none";
    });

    if (totalRow) totalRow.style.display = view === "total" ? "" : "none";
  }

  win.toggleMath = (id: string) => {
    const sec = el(id);
    if (sec) sec.classList.toggle("open");
  };

  win.togglePerfMath = () => {
    const id = `math-${currentPerf === "pnl" ? "gold" : currentPerf}`;
    const sec = el(id);
    if (sec) sec.classList.toggle("open");
  };

  win.toggleDark = () => {
    document.body.classList.toggle("light");
    const knob = el("dark-toggle-knob");
    if (knob)
      knob.textContent = document.body.classList.contains("light")
        ? "☀️"
        : "🌙";
  };

  win.dismissWarning = () => {
    const w = el("api-warning");
    if (w) w.style.display = "none";
  };

  win.doRefresh = async () => {
    const btn = el("refresh-btn");
    if (btn) btn.textContent = "⏳";
    el("live-bar")!.style.display = "flex";

    // 1. Fetch USD/EGP rate from the backend cache (open.er-api.com fetch
    //    runs server-side; the Replit preview iframe blocks external
    //    browser fetches to that domain).
    let usdLive = false;
    try {
      const usdResp = await fetch("/api/portfolio/usd-rate", {
        signal: AbortSignal.timeout(8_000),
      });
      if (usdResp.ok) {
        const data = (await usdResp.json()) as { rate?: number; status?: string };
        const rate = data?.rate;
        const status = data?.status ?? "unavailable";
        if (rate && rate > 0) {
          const usdEl = el("live-usd");
          if (usdEl) usdEl.textContent = rate.toFixed(2);
          const dotUsd = el("dot-usd");
          if (dotUsd) dotUsd.className = status === "live" ? "live-dot ok" : "live-dot warn";
          const usdStatusEl = el("usd-status");
          if (usdStatusEl) {
            usdStatusEl.textContent = status;
            usdStatusEl.className = status === "live" ? "status-badge status-live" : "status-badge status-fallback";
          }
          usdLive = status === "live";
        }
      }
    } catch {
      /* keep fallback */
    }

    // 2. Fetch gold prices from the backend scraper cache.
    //    goldbullioneg.com does not support CORS so the scrape must be
    //    server-side; this endpoint just returns the in-memory cache.
    let goldLive = false;
    try {
      const goldResp = await fetch("/api/portfolio/gold-prices", {
        signal: AbortSignal.timeout(10_000),
      });
      if (goldResp.ok) {
        const gp = (await goldResp.json()) as {
          buyPrice24k?: number;
          sellPrice24k?: number;
          buyPrice21k?: number;
          sellPrice21k?: number;
          status?: string;
        };
        const status = gp.status ?? "unavailable";
        const isLive = status === "live";
        const hasPrices = !!gp.sellPrice24k;

        const dotGold = el("dot-gold");
        if (dotGold)
          dotGold.className = isLive && hasPrices ? "live-dot ok" : "live-dot warn";
        const goldStatus = el("gold-status");
        if (goldStatus) {
          goldStatus.textContent = status;
          goldStatus.className =
            isLive && hasPrices
              ? "status-badge status-live"
              : "status-badge status-fallback";
        }
        if (hasPrices && gp.sellPrice24k) {
          const goldEl = el("live-gold");
          if (goldEl) goldEl.textContent = `${fmt(gp.sellPrice24k)} EGP/g`;
        }
        // Update the live price object so calcGoldDca uses fresh numbers.
        if (gp.buyPrice24k) liveGoldPrices.buyPrice24k = gp.buyPrice24k;
        if (gp.sellPrice24k) liveGoldPrices.sellPrice24k = gp.sellPrice24k;
        if (gp.buyPrice21k) liveGoldPrices.buyPrice21k = gp.buyPrice21k;
        if (gp.sellPrice21k) liveGoldPrices.sellPrice21k = gp.sellPrice21k;
        goldLive = isLive && hasPrices;
      }
    } catch {
      /* keep fallback */
    }

    // Hide the warning banner once both feeds are live.
    if (usdLive || goldLive) {
      const w = el("api-warning");
      if (w) w.style.display = "none";
    }

    // Re-run DCA calculator with updated prices.
    (win.calcGoldDca as () => void)();

    if (btn) btn.textContent = "🔄";
    updateTime();
  };

  win.toggleSortMenu = (e: MouseEvent) => {
    e.stopPropagation();
    const pop = el("pnl-sort-popover");
    if (pop) pop.classList.toggle("open");
  };

  const closeSortPopover = () => el("pnl-sort-popover")?.classList.remove("open");
  document.addEventListener("click", closeSortPopover);

  win.setSortKey = (key: string) => {
    if (currentSortKey === key) sortDesc = !sortDesc;
    else {
      currentSortKey = key;
      sortDesc = false;
    }
    document.querySelectorAll(".sort-option").forEach((opt) => {
      const k = opt.getAttribute("data-key");
      opt.classList.remove("active", "active-desc");
      if (k === key) opt.classList.add(sortDesc ? "active-desc" : "active");
    });
    const label = el("pnl-sort-label");
    const labels: Record<string, string> = {
      value: "By Value",
      pnl: "By P&L",
      pct: "By %",
      name: "By Name",
    };
    if (label) label.textContent = labels[key] || "Default";
    el("pnl-sort-popover")?.classList.remove("open");
  };

  // Buy-more-gold scenario calculator. Prices come from the backend
  // scraper (goldbullioneg.com) and are kept in this mutable object.
  // calcGoldDca() reads from here; doRefresh() updates it then re-runs
  // the calc. Manufacturing fees (buy) and cashback (sell) come from the
  // fixed dealer fee schedule in goldFeeSchedule.ts — hardcoded on
  // purpose (see that file's policy note).
  //
  // Positions of different karats are blended using PURE gold grams
  // (physicalGrams × karat/24), per the user's own reconciliation rule:
  // average cost = total EGP spent ÷ total pure grams. The existing
  // position is 100% 24K, so its pure grams equal its physical grams.
  const liveGoldPrices: {
    buyPrice24k: number | null;
    sellPrice24k: number | null;
    buyPrice21k: number | null;
    sellPrice21k: number | null;
  } = {
    buyPrice24k: (portfolio.gold as any).buyPrice24k ?? null,
    sellPrice24k: (portfolio.gold as any).sellPrice24k ?? null,
    buyPrice21k: (portfolio.gold as any).buyPrice21k ?? null,
    sellPrice21k: (portfolio.gold as any).sellPrice21k ?? null,
  };

  interface GoldScenarioInput {
    prefix: "s1" | "s2" | "s3" | "s4";
    physicalGrams: number;
    karat: 21 | 24;
    buyPrice: number;
    sellPrice: number;
    mfgFeePerGram: number;
    cashbackPerGram: number;
  }

  function renderGoldDcaScenario(
    scenario: GoldScenarioInput,
    existingSellPrice: number,
  ) {
    const { prefix, physicalGrams, karat, buyPrice, sellPrice, mfgFeePerGram, cashbackPerGram } =
      scenario;
    const pay = physicalGrams * (buyPrice + mfgFeePerGram);

    const currentPureGrams = derived.gold.gramsHeld; // existing position is 100% 24K
    const currentCost = derived.gold.cost;
    const currentAvg = derived.gold.avgCostPerGram;

    const newPureGrams = currentPureGrams + physicalGrams * purityFraction(karat);
    const newCost = currentCost + pay;
    const newAvg = newPureGrams > 0 ? newCost / newPureGrams : buyPrice + mfgFeePerGram;
    const avgDrop = currentAvg - newAvg;

    // Blended PnL values the existing (24K) holdings at the 24K sell price
    // and this scenario's new grams at its own sell price, each with its
    // own cashback rate, then compares the combined total against the
    // combined cost.
    const existingValue = derived.gold.gramsHeld * existingSellPrice;
    const existingCashback = derived.gold.gramsHeld * derived.gold.cashbackPerGram;
    const newValue = physicalGrams * sellPrice;
    const newCashback = physicalGrams * cashbackPerGram;
    const adjustedPnl = existingValue + existingCashback + newValue + newCashback - newCost;
    const adjustedPnlPct = newCost > 0 ? (adjustedPnl / newCost) * 100 : 0;

    (el(`dca-${prefix}-pay`) as HTMLElement).textContent = `${fmt(Math.round(pay))} EGP`;
    (el(`dca-${prefix}-avg`) as HTMLElement).textContent = `${fmt2(newAvg)} EGP/pure-g`;
    (el(`dca-${prefix}-drop`) as HTMLElement).textContent =
      avgDrop >= 0
        ? `↓ drops ${fmt2(avgDrop)} EGP/pure-g from current avg`
        : `↑ rises ${fmt2(-avgDrop)} EGP/pure-g from current avg`;
    const pnlEl = el(`dca-${prefix}-pnl`) as HTMLElement;
    pnlEl.textContent = `${adjustedPnl >= 0 ? "+" : ""}${fmt(Math.round(adjustedPnl))} EGP (${adjustedPnlPct >= 0 ? "+" : ""}${adjustedPnlPct.toFixed(1)}%)`;
    pnlEl.classList.toggle("pos", adjustedPnl >= 0);
    pnlEl.classList.toggle("neg", adjustedPnl < 0);
  }

  function clearGoldDcaScenario(prefix: "s1" | "s2" | "s3" | "s4") {
    (el(`dca-${prefix}-pay`) as HTMLElement).textContent = "—";
    (el(`dca-${prefix}-avg`) as HTMLElement).textContent = "—";
    (el(`dca-${prefix}-drop`) as HTMLElement).textContent = "—";
    (el(`dca-${prefix}-pnl`) as HTMLElement).textContent = "—";
  }

  win.calcGoldDca = () => {
    const { buyPrice24k: buyPrice24, sellPrice24k: sellPrice24, buyPrice21k: buyPrice21, sellPrice21k: sellPrice21 } = liveGoldPrices;
    const note = el("dca-note") as HTMLElement;

    if (buyPrice24 === null || sellPrice24 === null) {
      (["s1", "s2", "s3", "s4"] as const).forEach(clearGoldDcaScenario);
      if (note) note.textContent = "⚠️ Waiting for live gold prices from goldbullioneg.com — scenarios will appear once the first scrape completes.";
      return;
    }

    renderGoldDcaScenario(
      { prefix: "s1", physicalGrams: BAR_5G_GRAMS, karat: 24, buyPrice: buyPrice24, sellPrice: sellPrice24, mfgFeePerGram: MFG_FEE_5G_24K_PER_GRAM, cashbackPerGram: derived.gold.cashbackPerGram },
      sellPrice24,
    );
    renderGoldDcaScenario(
      { prefix: "s2", physicalGrams: BAR_5G_GRAMS * 2, karat: 24, buyPrice: buyPrice24, sellPrice: sellPrice24, mfgFeePerGram: MFG_FEE_5G_24K_PER_GRAM, cashbackPerGram: derived.gold.cashbackPerGram },
      sellPrice24,
    );
    renderGoldDcaScenario(
      { prefix: "s3", physicalGrams: BAR_10G_GRAMS, karat: 24, buyPrice: buyPrice24, sellPrice: sellPrice24, mfgFeePerGram: MFG_FEE_10G_24K_PER_GRAM, cashbackPerGram: derived.gold.cashbackPerGram },
      sellPrice24,
    );

    if (buyPrice21 === null || sellPrice21 === null) {
      clearGoldDcaScenario("s4");
    } else {
      renderGoldDcaScenario(
        { prefix: "s4", physicalGrams: GOLD_POUND_GRAMS, karat: 21, buyPrice: buyPrice21, sellPrice: sellPrice21, mfgFeePerGram: MFG_FEE_GOLD_POUND_21K_PER_GRAM, cashbackPerGram: CASHBACK_21K_PER_GRAM },
        sellPrice24,
      );
    }

    if (note) note.textContent = "ℹ️ Prices from goldbullioneg.com (live, auto-refreshed every 5 min). Manufacturing fees and cashback from the fixed dealer fee schedule.";
  };

  win.saveGrowthSnapshot = async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      "#perf-growth button",
    );
    if (btn) btn.disabled = true;
    try {
      await callbacks.createSnapshot(derived.abr.value);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  win.openInsights = () => {
    const ts = el("insights-timestamp");
    if (ts) ts.textContent = "Generated: " + new Date().toLocaleString();
    el("insight-overlay")?.classList.add("open");
  };
  win.closeInsights = () => el("insight-overlay")?.classList.remove("open");
  win.openScan = () => el("scan-overlay")?.classList.add("open");
  win.closeScan = () => el("scan-overlay")?.classList.remove("open");

  win.openNav = () => {
    el("nav-modal")?.classList.add("open");
    (el("input-abr-nav") as HTMLInputElement).value =
      derived.abr.nav.toFixed(4);
    (el("input-abr-certs") as HTMLInputElement).value = String(
      derived.abr.unitsHeld,
    );
    (el("input-re-nav") as HTMLInputElement).value = derived.re.nav.toFixed(4);
    (el("input-re-certs") as HTMLInputElement).value = String(
      derived.re.unitsHeld,
    );
  };
  win.closeNav = () => el("nav-modal")?.classList.remove("open");

  win.applyNavs = async () => {
    const abrNav =
      parseFloat((el("input-abr-nav") as HTMLInputElement).value) ||
      derived.abr.nav;
    const abrCerts =
      parseFloat((el("input-abr-certs") as HTMLInputElement).value) ||
      derived.abr.unitsHeld;
    const reNav =
      parseFloat((el("input-re-nav") as HTMLInputElement).value) ||
      derived.re.nav;
    const reCerts =
      parseFloat((el("input-re-certs") as HTMLInputElement).value) ||
      derived.re.unitsHeld;

    const btn = el("nav-apply-btn") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    try {
      await Promise.all([
        callbacks.updateFund("abr", { nav: abrNav, unitsHeld: abrCerts }),
        callbacks.updateFund("re", { nav: reNav, unitsHeld: reCerts }),
      ]);
      el("nav-modal")?.classList.remove("open");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Apply & Save";
      }
    }
  };

  win.openApiKey = () => {
    el("apikey-overlay")?.classList.add("open");
    const savedKey = localStorage.getItem("gemini_api_key") || "";
    (el("input-gemini-key") as HTMLInputElement).value = savedKey
      ? "••••••••"
      : "";
  };
  win.closeApiKey = () => el("apikey-overlay")?.classList.remove("open");

  win.saveApiKey = () => {
    const key = (el("input-gemini-key") as HTMLInputElement).value.trim();
    if (key && !key.startsWith("•")) {
      localStorage.setItem("gemini_api_key", key);
      const status = el("scan-key-status");
      if (status) status.textContent = "API Key: set ✓";
    }
    el("apikey-overlay")?.classList.remove("open");
  };

  win.selectScanMode = (mode: string) => {
    ["order", "nav", "stock"].forEach((m) =>
      el(`mode-${m}`)?.classList.toggle("selected", m === mode),
    );
  };

  win.onFileSelected = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const preview = el("scan-preview") as HTMLImageElement;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target?.result as string;
      preview.style.display = "block";
      (el("scan-upload-label") as HTMLElement).style.display = "none";
    };
    reader.readAsDataURL(file);
  };

  win.applyScanResult = () => {
    el("scan-overlay")?.classList.remove("open");
  };

  win.filterCerts = (type: string) => {
    ["all", "high", "soon"].forEach((t) =>
      el(`cert-chip-${t}`)?.classList.toggle("active", t === type),
    );
    const tbody = el("certs-tbody");
    if (!tbody) return;
    const today = new Date();
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const matStr = row.getAttribute("data-maturity") || "";
      const rate = parseFloat(row.getAttribute("data-rate") || "0");
      const matDate = new Date(matStr);
      let show = true;
      if (type === "high") show = rate >= 20;
      else if (type === "soon") show = matDate <= in90 && matDate >= today;
      (row as HTMLElement).style.display = show ? "" : "none";
    });
  };

  function renderCerts() {
    const tbody = el("certs-tbody");
    if (!tbody) return;
    const timeline = el("cert-timeline");
    const rateBreak = el("cert-rate-breakdown");
    const today = new Date();
    const sorted = [...CERTS_DATA].sort(
      (a, b) => new Date(a.maturity).getTime() - new Date(b.maturity).getTime(),
    );
    if (timeline) {
      timeline.innerHTML =
        sorted
          .slice(0, 6)
          .map((c) => {
            const mat = new Date(c.maturity);
            const daysLeft = Math.ceil(
              (mat.getTime() - today.getTime()) / 86400000,
            );
            const color =
              daysLeft < 90
                ? "var(--coral)"
                : daysLeft < 180
                  ? "#d99a2b"
                  : "var(--teal)";
            return `<div class="cert-timeline-item">
          <div class="cert-timeline-dot" style="background:${color}"></div>
          <div><div class="cert-timeline-name">${c.name}</div><div class="cert-timeline-date">${mat.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${daysLeft}d left</div><div class="cert-timeline-amount">${fmt(c.value)} EGP @ ${c.rate}%</div></div>
        </div>`;
          })
          .join("") +
        (sorted.length > 6
          ? `<div style="font-size:10px;color:var(--dim);padding:8px 0">+ ${sorted.length - 6} more certificates</div>`
          : "");
    }
    if (rateBreak) {
      const byRate: Record<number, { count: number; total: number }> = {};
      CERTS_DATA.forEach((c) => {
        if (!byRate[c.rate]) byRate[c.rate] = { count: 0, total: 0 };
        byRate[c.rate].count++;
        byRate[c.rate].total += c.value;
      });
      rateBreak.innerHTML = Object.entries(byRate)
        .sort(([a], [b]) => +b - +a)
        .map(
          ([rate, info]) => `
        <div class="cert-rate-row">
          <div><div style="font-size:12px;font-weight:700;color:var(--ink)">${rate}% APY</div><div style="font-size:10px;color:var(--dim)">${info.count} certificate${info.count > 1 ? "s" : ""}</div></div>
          <div style="text-align:right"><div style="font-size:12px;font-weight:700;color:var(--teal)">${fmt(info.total)} EGP</div><div style="font-size:10px;color:var(--dim)">${fmt(Math.round((info.total * +rate) / 100 / 12))}/mo</div></div>
        </div>`,
        )
        .join("");
    }
    tbody.innerHTML = sorted
      .map((c) => {
        const mat = new Date(c.maturity);
        const daysLeft = Math.ceil(
          (mat.getTime() - today.getTime()) / 86400000,
        );
        const badge =
          daysLeft < 90
            ? '<span style="background:var(--coral-soft);color:var(--coral);font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px">Soon</span>'
            : "";
        return `<tr data-maturity="${c.maturity}" data-rate="${c.rate}">
        <td><div class="ah-asset-name">${c.name}</div></td>
        <td style="font-weight:700">${fmt(c.value)} EGP</td>
        <td style="color:var(--teal);font-weight:700">${c.rate}%</td>
        <td>${mat.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${badge}</td>
        <td style="color:var(--teal);font-weight:700">${fmt(c.monthly)} EGP</td>
      </tr>`;
      })
      .join("");
  }

  function renderGrowthSparkline() {
    const snaps = [...portfolio.snapshots].sort(
      (a, b) =>
        new Date(a.snapshotDate).getTime() -
        new Date(b.snapshotDate).getTime(),
    );
    if (snaps.length === 0) return;

    const latest = snaps[snaps.length - 1];
    const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
    const latestEl = el("growth-latest");
    if (latestEl) latestEl.textContent = `${fmt(latest.value)} EGP`;
    const deltaEl = el("growth-delta");
    if (deltaEl) {
      if (prev) {
        const delta = latest.value - prev.value;
        const pct = prev.value > 0 ? (delta / prev.value) * 100 : 0;
        deltaEl.textContent = `${delta >= 0 ? "▲" : "▼"} ${delta >= 0 ? "+" : ""}${fmt(delta)} EGP (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%) vs last snapshot`;
      } else {
        deltaEl.textContent = "First snapshot recorded";
      }
    }

    const values = snaps.map((s) => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 300;
    const height = 90;
    const padX = 8;
    const padTop = 14;
    const padBottom = 12;
    const points = snaps.map((s, i) => {
      const x =
        snaps.length === 1
          ? width / 2
          : padX + (i / (snaps.length - 1)) * (width - padX * 2);
      const y =
        height -
        padBottom -
        ((s.value - min) / range) * (height - padTop - padBottom);
      return { x, y };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    const lineEl = el("spark-line");
    if (lineEl) lineEl.setAttribute("d", linePath);
    const fillEl = el("spark-fill");
    if (fillEl) fillEl.setAttribute("d", fillPath);
    const dotEl = el("spark-dot");
    if (dotEl) {
      dotEl.setAttribute("cx", String(points[points.length - 1].x));
      dotEl.setAttribute("cy", String(points[points.length - 1].y));
    }

    const labels = el("spark-labels");
    if (labels) {
      const fmtDate = (s: string) =>
        new Date(s).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
      labels.innerHTML = `<span style="font-size:9px;color:var(--dim);font-weight:600">${fmtDate(snaps[0].snapshotDate)}</span><span style="font-size:9px;color:var(--dim);font-weight:600">${fmtDate(snaps[snaps.length - 1].snapshotDate)}</span>`;
    }
  }

  function animateRings() {
    const scores = {
      div: derived.health.diversityScore,
      ef: derived.health.emergencyFundScore,
      yield: derived.health.yieldScore,
      liq: derived.health.liquidityScore,
    };
    const maxArc = { div: 259.2, ef: 202.6, yield: 146.1, liq: 89.5 };
    const fullC = { div: 345.6, ef: 270.2, yield: 194.8, liq: 119.4 };
    const bars = {
      div: "wh-div",
      ef: "wh-ef",
      yield: "wh-yield-bar",
      liq: "wh-liq-bar",
    };
    const colors = { div: "#d99a2b", ef: "#e05a50", yield: "#d99a2b", liq: "#e05a50" };
    setTimeout(() => {
      (Object.keys(scores) as (keyof typeof scores)[]).forEach((key) => {
        const score = scores[key];
        const fill = (maxArc[key] * score) / 100;
        const rem = fullC[key] - fill;
        const ring = el(`ring-${key}`);
        if (ring)
          ring.setAttribute(
            "stroke-dasharray",
            `${fill.toFixed(2)} ${rem.toFixed(2)}`,
          );
        const bar = el(bars[key]);
        if (bar) {
          (bar as HTMLElement).style.width = score + "%";
          (bar as HTMLElement).style.background = colors[key];
        }
      });
    }, 300);
  }

  function animateProgress() {
    setTimeout(() => {
      const pb = el("abr-prog-bar") as HTMLElement | null;
      if (pb) {
        const target = pb.getAttribute("data-target") || "0";
        pb.style.width = `${target}%`;
      }
    }, 400);
  }

  updateTime();
  const timeInterval = setInterval(updateTime, 1000);
  animateRings();
  animateProgress();
  (win.setView as (view: string) => void)("total");
  renderCerts();
  renderGrowthSparkline();

  // Init gold price display from the prices baked into the initial
  // portfolio fetch. Sets the live-bar badge and pre-fills DCA inputs
  // so the user sees the correct status without clicking Refresh.
  const goldExt = portfolio.gold as typeof portfolio.gold & {
    buyPrice24k: number | null;
    sellPrice24k: number | null;
    buyPrice21k: number | null;
    sellPrice21k: number | null;
    goldPriceStatus: string | null;
  };
  if (goldExt.goldPriceStatus) {
    const lb = el("live-bar");
    if (lb) lb.style.display = "flex";
    const dot = el("dot-gold");
    if (dot)
      dot.className =
        goldExt.goldPriceStatus === "live" ? "live-dot ok" : "live-dot warn";
    const badge = el("gold-status");
    if (badge) {
      badge.textContent = goldExt.goldPriceStatus;
      badge.className =
        goldExt.goldPriceStatus === "live"
          ? "status-badge status-live"
          : "status-badge status-fallback";
    }
    if (goldExt.sellPrice24k) {
      const goldVal = el("live-gold");
      if (goldVal) goldVal.textContent = `${fmt(goldExt.sellPrice24k)} EGP/g`;
    }
    if (goldExt.goldPriceStatus === "live") {
      const w = el("api-warning");
      if (w) w.style.display = "none";
    }
  }
  // Auto-run the DCA calculator with whatever prices came in the
  // initial portfolio fetch (liveGoldPrices already seeded above).
  (win.calcGoldDca as () => void)();

  return () => {
    clearInterval(timeInterval);
    document.removeEventListener("click", closeSortPopover);
  };
}
