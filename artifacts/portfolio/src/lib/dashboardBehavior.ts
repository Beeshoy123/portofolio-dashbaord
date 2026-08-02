import type { Portfolio } from "@workspace/api-client-react";
import type { Derived, DerivedCertificate } from "./portfolioMath";
import { fmt, fmt2 } from "./portfolioMath";
import { T, type Lang, getSavedLang, saveLang } from "./i18n";
import { allocInsight, buildInsights, healthGrade } from "./dashboardHtml";
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
  let currentLang: Lang = getSavedLang();

  const el = (id: string) => document.getElementById(id);
  const win = window as unknown as WindowFns;

  const CERTS_DATA: DerivedCertificate[] = derived.certs;

  function updateTime() {
    const now = new Date();
    const t = now.toLocaleTimeString(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
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
    { label: string; labelAr: string; cards: string[]; assetGroup: string | null }
  > = {
    total: {
      label: "All assets · full portfolio",
      labelAr: "جميع الأصول · المحفظة الكاملة",
      cards: ["hero", "perf", "health", "segments", "progress", "heatmap"],
      assetGroup: null,
    },
    gold: {
      label: "Gold 24K · physical position",
      labelAr: "ذهب 24 قيراط · المركز المادي",
      cards: ["hero", "gold-cohort", "perf", "dca"],
      assetGroup: "gold",
    },
    liquid: {
      label: "Liquid assets · Bareeq & funds",
      labelAr: "الأصول السائلة · بريق والصناديق",
      cards: ["hero", "cohort", "perf", "progress"],
      assetGroup: "liquid",
    },
    certs: {
      label: "NBE Certificates · fixed income",
      labelAr: "شهادات بنك مصر · دخل ثابت",
      cards: [],
      assetGroup: "certs",
    },
    ai: {
      label: "AI Insights · portfolio analysis",
      labelAr: "رؤى الذكاء الاصطناعي · تحليل المحفظة",
      cards: ["ai-insights"],
      assetGroup: null,
    },
  };

  const ml = (label: string, calc: string, result: string, cls = "") =>
    `<div class="math-line ${cls}"><span class="math-label">${label}</span><span class="math-calc">${calc}</span><span class="math-result">${result}</span></div>`;
  const divider = () => `<div class="math-divider"></div>`;
  const t = (key: string) => T[currentLang][key] ?? T.en[key] ?? key;

  function heroMath(view: string): string {
    if (view === "gold") {
      if (derived.gold.pnlAvailable) {
        return [
          ml(t('ml.sell.price'), "24K · goldbullioneg.com", `${fmt(derived.gold.livePricePerGram!)} EGP/g`),
          ml(t('ml.curr.value'), `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.livePricePerGram!)} EGP/g`, `= ${fmt(derived.gold.value!)} EGP`),
          ml(t('ml.cost.basis'), `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`, `= ${fmt(derived.gold.cost)} EGP (${t('mc.mfg.fee.incl')})`),
          ml(t('ml.raw.pnl'), t('mc.val.minus.cost'), `${derived.gold.rawPnl! >= 0 ? "+" : ""}${fmt(derived.gold.rawPnl!)} EGP`),
          ml(t('ml.sell.cashback'), `${fmt(derived.gold.gramsHeld)}g × ${fmt2(derived.gold.cashbackPerGram)} EGP/g`, `= ${fmt(derived.gold.cashback!)} EGP (${t('mc.refunded.on.sell')})`),
          divider(),
          ml(t('ml.net.pnl'), t('mc.val.cb.minus.cost'), `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP`, derived.gold.netPnl! >= 0 ? "math-total" : "math-total neg"),
        ].join("");
      }
      return [
        ml(t('ml.curr.value'), `${fmt(derived.gold.gramsHeld)}g × ${t('mc.live.price.label')}`, t('mc.live.price.unavail')),
        ml(t('ml.cost.basis'), `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`, `= ${fmt(derived.gold.cost)} EGP (${t('mc.mfg.fee.paid')})`),
        ml(t('ml.raw.pnl'), t('mc.val.minus.cost'), "N/A"),
        ml(t('ml.sell.cashback'), `${fmt(derived.gold.gramsHeld)}g × ${derived.gold.cashbackPerGram} EGP/g`, t('mc.refunded.sell.full')),
        divider(),
        ml(t('ml.net.pnl'), t('mc.val.cb.minus.cost'), t('mc.pnl.unavail'), "math-total"),
      ].join("");
    }
    if (view === "liquid") {
      return [
        ml(t('ml.bareeq'), `${fmt(derived.abr.unitsHeld)} certs × ${derived.abr.nav.toFixed(2)}`, `= ${fmt(derived.abr.value)} EGP`),
        ml(t('ml.re'), `${fmt(derived.re.unitsHeld)} certs × ${derived.re.nav.toFixed(2)}`, `= ${fmt(derived.re.value)} EGP`),
        divider(),
        ml(t('ml.combined.nav'), `${fmt(derived.abr.value)} + ${fmt(derived.re.value)}`, `= ${fmt(derived.liquid.value)} EGP`, "math-total"),
        ml(t('ml.cost.basis'), `${fmt(derived.abr.costBasisTotal)} + ${fmt(derived.re.costBasisTotal)}`, `= ${fmt(derived.liquid.cost)} EGP`),
        ml(t('ml.pnl'), `${fmt(derived.liquid.value)} − ${fmt(derived.liquid.cost)}`, `${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} EGP (${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%)`, derived.liquid.pnl >= 0 ? "math-total" : "math-total neg"),
      ].join("");
    }
    return [
      derived.gold.pnlAvailable
        ? ml(t('ml.gold.live.price'), `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.livePricePerGram!)} EGP/g`, `= ${fmt(derived.gold.value!)} EGP`)
        : ml(t('ml.gold.at.cost'), `${fmt(derived.gold.gramsHeld)}g × ${fmt(derived.gold.avgCostPerGram)} EGP/g`, `= ${fmt(derived.gold.cost)} EGP (${t('mc.mfg.fee.incl')})`),
      ml(t('ml.bareeq'), `${fmt(derived.abr.unitsHeld)} certs × ${derived.abr.nav.toFixed(2)}`, `= ${fmt(derived.abr.value)} EGP`),
      ml(t('ml.re'), `${fmt(derived.re.unitsHeld)} × ${derived.re.nav.toFixed(2)}`, `= ${fmt(derived.re.value)} EGP`),
      ml(t('ml.certificates.label'), `${CERTS_DATA.length} ${t('mc.certs.avg.apy')} ${derived.certTotals.weightedAvgRate.toFixed(1)}% ${t('mc.apy.label')}`, `= ${fmt(derived.certTotals.totalPrincipal)} EGP`),
      divider(),
      ml(t('ml.total.value'), "", `${fmt(derived.total.value)} EGP`, "math-total"),
      ml(t('ml.total.cost'), "", `~${fmt(derived.total.cost)} EGP`),
      ml(t('ml.pnl'), "", `${derived.total.pnl >= 0 ? "+" : ""}${fmt(derived.total.pnl)} (${derived.total.pnlPct >= 0 ? "+" : ""}${derived.total.pnlPct.toFixed(1)}%)`, derived.total.pnl >= 0 ? "math-total" : "math-total neg"),
    ].join("");
  }

  // `sentiment` drives both the arrow (▲/▼) and the color of the hero
  // "chg" line — "up" and "down" are true P&L signals, "neutral" is used
  // for the certificates view (a fixed-rate yield line, not a P&L figure)
  // where an up/down arrow would be misleading.
  const HERO_CFG: Record<
    string,
    {
      title: string; titleAr: string;
      sub: string;   subAr: string;
      val: string;
      chg: string;   chgAr: string;
      rates: string;
      sentiment: "up" | "down" | "neutral";
    }
  > = {
    total: {
      title: "Total Portfolio Value",    titleAr: "إجمالي قيمة المحفظة",
      sub: "Total Cost Basis · EGP",     subAr: "إجمالي تكلفة الشراء · ج.م",
      val: `${fmt(derived.total.cost)} EGP`,
      chg:   `Market Value: ${fmt(derived.total.value)} EGP (net PnL ${derived.total.pnl >= 0 ? "+" : ""}${fmt(derived.total.pnl)} EGP, ${derived.total.pnlPct >= 0 ? "+" : ""}${derived.total.pnlPct.toFixed(1)}%)`,
      chgAr: `القيمة السوقية: ${fmt(derived.total.value)} ج.م (ر/خ صافي ${derived.total.pnl >= 0 ? "+" : ""}${fmt(derived.total.pnl)} ج.م، ${derived.total.pnlPct >= 0 ? "+" : ""}${derived.total.pnlPct.toFixed(1)}%)`,
      rates: derived.gold.pnlAvailable
        ? `Sell: ${fmt(derived.gold.livePricePerGram!)} EGP/g · Buy: ${fmt((portfolio.gold as any).buyPrice24k)} EGP/g<br>USD/EGP: ${derived.settings.usdEgpRate.toFixed(2)}`
        : `Gold: Live price unavailable<br>USD/EGP: ${derived.settings.usdEgpRate.toFixed(2)}`,
      sentiment: derived.total.pnl >= 0 ? "up" : "down",
    },
    gold: {
      title: "Gold 24K · Physical",      titleAr: "ذهب 24 قيراط · مادي",
      sub: "Cost Basis · EGP (mfg fee incl.)", subAr: "تكلفة الشراء · ج.م (شامل رسوم التصنيع)",
      val: `${fmt(derived.gold.cost)} EGP`,
      chg: derived.gold.pnlAvailable
        ? `Market Value: ${fmt(derived.gold.value!)} EGP (net PnL ${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} EGP, ${derived.gold.pnlPct!.toFixed(1)}% + cashback)`
        : "PnL unavailable — live price feature in development",
      chgAr: derived.gold.pnlAvailable
        ? `القيمة السوقية: ${fmt(derived.gold.value!)} ج.م (ر/خ صافي ${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} ج.م، ${derived.gold.pnlPct!.toFixed(1)}% + استرداد)`
        : "ر/خ غير متاح — ميزة السعر الحي قيد التطوير",
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
      title: "Liquid Assets · Funds",    titleAr: "الأصول السائلة · صناديق",
      sub: "Cost Basis · EGP",           subAr: "تكلفة الشراء · ج.م",
      val: `${fmt(derived.liquid.cost)} EGP`,
      chg:   `Market Value: ${fmt(derived.liquid.value)} EGP (net PnL ${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} EGP, ${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%)`,
      chgAr: `القيمة السوقية: ${fmt(derived.liquid.value)} ج.م (ر/خ صافي ${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} ج.م، ${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%)`,
      rates: ``,
      sentiment: derived.liquid.pnl >= 0 ? "up" : "down",
    },
    certs: {
      title: "NBE Certificates",         titleAr: "شهادات بنك مصر",
      sub: "Principal Balance · EGP",    subAr: "رصيد رأس المال · ج.م",
      val: `${fmt(derived.certTotals.totalPrincipal)} EGP`,
      chg:   `${derived.certTotals.weightedAvgRate.toFixed(1)}% avg APY · +${fmt(derived.certTotals.totalMonthly)} EGP/mo`,
      chgAr: `${derived.certTotals.weightedAvgRate.toFixed(1)}% متوسط عائد · +${fmt(derived.certTotals.totalMonthly)} ج.م/شهر`,
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
    document.querySelector(".bento")?.setAttribute("data-view", view);
    ["math-gold", "math-liquid", "math-yield", "math-total-capital", "math-total-income", "math-total"].forEach(
      (id) => el(id)?.classList.remove("open"),
    );
    const cfg = VIEW_CONFIG[view] || VIEW_CONFIG.total;
    el("view-label")!.textContent = currentLang === 'ar' ? cfg.labelAr : cfg.label;

    ["total", "gold", "liquid", "certs", "ai"].forEach((v) => {
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

    const ghs = el("gold-hero-stats");
    if (ghs) ghs.style.display = view === "gold" ? "flex" : "none";

    const btns = ["total", "gold", "liquid", "certs", "ai"];
    const idx = btns.indexOf(view);
    const bar = el("view-toggle-bar");
    const slider = el("view-toggle-slider");
    if (bar && slider) {
      const btnWidth = bar.offsetWidth / 5;
      const offset = 3 + idx * btnWidth + "px";
      if (currentLang === 'ar') {
        slider.style.right = offset;
        slider.style.left  = "";
      } else {
        slider.style.left  = offset;
        slider.style.right = "";
      }
      slider.style.width = btnWidth - 4 + "px";
    }

    const hcfg = HERO_CFG[view] || HERO_CFG.total;
    const heroTitle = el("hero-title");
    if (heroTitle) heroTitle.textContent = currentLang === 'ar' ? hcfg.titleAr : hcfg.title;
    const heroSub = el("hero-sublabel");
    if (heroSub) heroSub.textContent = currentLang === 'ar' ? hcfg.subAr : hcfg.sub;
    const heroVal = el("s-total");
    if (heroVal) heroVal.textContent = hcfg.val;
    const heroChg = el("s-total-chg");
    if (heroChg) {
      heroChg.textContent = `${SENTIMENT_ARROW[hcfg.sentiment]} ${currentLang === 'ar' ? hcfg.chgAr : hcfg.chg}`;
      heroChg.style.color = SENTIMENT_COLOR[hcfg.sentiment];
      heroChg.classList.toggle("pos", hcfg.sentiment !== "down");
      heroChg.classList.toggle("neg", hcfg.sentiment === "down");
    }
    const mathBody = el("hero-math-body");
    if (mathBody) mathBody.innerHTML = heroMath(view);

    updatePerfPnlForView(view);
    updatePerfTabsForView(view);
  };

  // Panel ID tuples — one entry per pill in [pnl, yield, growth] order.
  // Both Total and standard views share the single perf-growth panel;
  // its heading text is swapped by refreshGrowthLabel() on toggle.
  const TOTAL_PERF_PANELS: [string, string, string] = ["perf-total-capital", "perf-total-income", "perf-growth"];
  const STD_PERF_PANELS:   [string, string, string] = ["perf-pnl",           "perf-yield",        "perf-growth"];

  // ── Single source of truth for the Performance card per view ─────────────
  // To add/change a view's behaviour, edit ONE entry here.
  interface PerfViewConfig {
    /** Panel IDs mapped to [pnl, yield, growth] pills. */
    panels: [string, string, string];
    /** Display text for the three pills. */
    pillLabels: [string, string, string];
    /** Arabic display text for the three pills. */
    pillLabelsAr: [string, string, string];
    /** pill-* IDs to hide for this view. */
    hiddenPillIds: string[];
    /** Math section to open per pill; null = no section for that tab. */
    mathIds: Record<"pnl" | "yield" | "growth", string | null>;
    /** Heading shown inside the shared growth panel for this view. */
    growthLabel: string;
    /** Arabic heading for the growth panel. */
    growthLabelAr: string;
    /**
     * How to mutate the shared perf-pnl panel.
     * null = skip — this view has its own dedicated panels.
     */
    pnlUpdate: null | {
      icon: string;
      headline: () => string;
      headlineColor: () => string;
      sub: () => string;
      rowFilter: "all" | "gold" | "liquid" | "certs";
      showAvgVsSell: boolean;
    };
  }

  const PERF_CFG: Record<string, PerfViewConfig> = {
    total: {
      panels: TOTAL_PERF_PANELS,
      pillLabels: ["Capital", "Income", "Growth"],
      pillLabelsAr: ["رأس المال", "دخل", "نمو"],
      hiddenPillIds: [],
      mathIds: { pnl: "math-total-capital", yield: "math-total-income", growth: null },
      growthLabel: "Total Wallet · Month over Month",
      growthLabelAr: "المحفظة الكاملة · شهر بشهر",
      pnlUpdate: null,
    },
    gold: {
      panels: STD_PERF_PANELS,
      pillLabels: ["PnL", "Yield", "Growth"],
      pillLabelsAr: ["ر/خ", "عائد", "نمو"],
      hiddenPillIds: ["pill-yield", "pill-growth"],
      mathIds: { pnl: "math-gold", yield: "math-yield", growth: null },
      growthLabel: "Savings Growth · Month over Month",
      growthLabelAr: "نمو المدخرات · شهر بشهر",
      pnlUpdate: {
        icon: "🥇",
        headline: () => derived.gold.pnlAvailable
          ? `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} ${t('perf.egp.net')}`
          : t('perf.pnl.unavail.short'),
        headlineColor: () => derived.gold.pnlAvailable
          ? derived.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"
          : "var(--dim)",
        sub: () => derived.gold.pnlAvailable
          ? `${derived.gold.pnlPct! >= 0 ? "+" : ""}${derived.gold.pnlPct!.toFixed(1)}% ${t('perf.pnl.raw')} · ${fmt2(derived.gold.cashbackPerGram)} EGP/g ${t('perf.pnl.cb.on.sell')}`
          : `${t('perf.pnl.cb.rate')} ${fmt2(derived.gold.cashbackPerGram)} EGP/g ${t('perf.pnl.applied')}`,
        rowFilter: "gold",
        showAvgVsSell: true,
      },
    },
    liquid: {
      panels: STD_PERF_PANELS,
      pillLabels: ["PnL", "Yield", "Growth"],
      pillLabelsAr: ["ر/خ", "عائد", "نمو"],
      hiddenPillIds: [],
      mathIds: { pnl: "math-liquid", yield: "math-yield", growth: null },
      growthLabel: "Savings Growth · Month over Month",
      growthLabelAr: "نمو المدخرات · شهر بشهر",
      pnlUpdate: {
        icon: "💧",
        headline: () => `${derived.liquid.pnl >= 0 ? "+" : ""}${fmt(derived.liquid.pnl)} ${t('perf.egp.net')} · ${derived.liquid.pnlPct >= 0 ? "+" : ""}${derived.liquid.pnlPct.toFixed(1)}%`,
        headlineColor: () => derived.liquid.pnl >= 0 ? "var(--teal)" : "var(--coral)",
        sub: () => ``,
        rowFilter: "liquid",
        showAvgVsSell: false,
      },
    },
    certs: {
      // VIEW_CONFIG.certs.cards is [] — perf card is hidden for Certs.
      // This entry is defensive; it should never be reached in practice.
      panels: STD_PERF_PANELS,
      pillLabels: ["PnL", "Yield", "Growth"],
      pillLabelsAr: ["ر/خ", "عائد", "نمو"],
      hiddenPillIds: [],
      mathIds: { pnl: "math-gold", yield: "math-yield", growth: null },
      growthLabel: "Savings Growth · Month over Month",
      growthLabelAr: "نمو المدخرات · شهر بشهر",
      pnlUpdate: {
        icon: "🥇",
        headline: () => derived.gold.pnlAvailable
          ? `${derived.gold.netPnl! >= 0 ? "+" : ""}${fmt(derived.gold.netPnl!)} ${t('perf.egp.net')}`
          : t('perf.pnl.unavail.short'),
        headlineColor: () => derived.gold.pnlAvailable
          ? derived.gold.netPnl! >= 0 ? "var(--teal)" : "var(--coral)"
          : "var(--dim)",
        sub: () => derived.gold.pnlAvailable
          ? `${derived.gold.pnlPct! >= 0 ? "+" : ""}${derived.gold.pnlPct!.toFixed(1)}% ${t('perf.pnl.raw')} · ${fmt2(derived.gold.cashbackPerGram)} EGP/g ${t('perf.pnl.cb.on.sell')}`
          : `${t('perf.pnl.cb.rate')} ${fmt2(derived.gold.cashbackPerGram)} EGP/g ${t('perf.pnl.applied')}`,
        rowFilter: "all",
        showAvgVsSell: true,
      },
    },
  };

  const PILL_KEYS = ["pnl", "yield", "growth"] as const;

  /** Swaps the heading text inside the shared growth panel to match the active view and language. */
  function refreshGrowthLabel() {
    const labelEl = el("growth-view-label");
    const cfg = PERF_CFG[currentView] ?? PERF_CFG.total;
    if (labelEl) labelEl.textContent = currentLang === 'ar' ? cfg.growthLabelAr : cfg.growthLabel;
  }

  function updatePerfTabsForView(view: string) {
    const cfg = PERF_CFG[view] ?? PERF_CFG.total;
    const labels = currentLang === 'ar' ? cfg.pillLabelsAr : cfg.pillLabels;

    // 1. Relabel and show/hide pills.
    PILL_KEYS.forEach((key, i) => {
      const pill = el(`pill-${key}`);
      if (!pill) return;
      pill.innerHTML = labels[i];
      pill.style.display = cfg.hiddenPillIds.includes(`pill-${key}`) ? "none" : "";
    });

    // 2. If the active pill is now hidden, reset to pnl.
    //    switchPerf will handle the panel visibility update, so we can return.
    if (cfg.hiddenPillIds.includes(`pill-${currentPerf}`)) {
      (win.switchPerf as (type: string) => void)("pnl");
      return;
    }

    // 3. Hide all panels from both sets, then reveal the one that matches the
    //    active pill for this view.
    [...TOTAL_PERF_PANELS, ...STD_PERF_PANELS].forEach(id => {
      const p = el(id); if (p) p.style.display = "none";
    });
    const activeIdx = PILL_KEYS.indexOf(currentPerf as (typeof PILL_KEYS)[number]);
    if (activeIdx >= 0) {
      const p = el(cfg.panels[activeIdx]);
      if (p) p.style.display = "block";
    }
    // Keep growth panel label in sync whenever the view changes.
    if (currentPerf === "growth") refreshGrowthLabel();
    // Keep yield panel data scoped to the active view.
    updatePerfYieldForView(view);
  }

  function updatePerfPnlForView(view: string) {
    const cfg = PERF_CFG[view] ?? PERF_CFG.total;
    if (!cfg.pnlUpdate) return; // view has its own dedicated panels

    const { icon: iconChar, headline, headlineColor, sub, rowFilter, showAvgVsSell } = cfg.pnlUpdate;

    const iconEl    = el("perf-pnl-icon");
    const headlineEl = el("gold-pnl");
    const subEl     = el("gold-pnl-pct");
    const avgVsSell = el("gold-avg-vs-sell");
    const rows      = document.querySelectorAll<HTMLElement>("#pnl-rows .pnl-row[data-perf-group]");

    if (iconEl) iconEl.textContent = iconChar;
    if (headlineEl) {
      headlineEl.textContent = headline();
      (headlineEl as HTMLElement).style.color = headlineColor();
    }
    const subText = sub();
    if (subEl) {
      subEl.textContent = subText;
      subEl.style.display = subText ? "" : "none";
    }

    if (avgVsSell) {
      if (!showAvgVsSell) {
        avgVsSell.style.display = "none";
      } else {
        avgVsSell.style.display = "";
        const effectiveSell = derived.gold.pnlAvailable
          ? derived.gold.livePricePerGram! + derived.gold.cashbackPerGram
          : null;
        avgVsSell.textContent = effectiveSell !== null
          ? `${t('perf.my.avg')} ${fmt2(derived.gold.avgCostPerGram)} EGP/g ${t('perf.vs.sell.cb')} ${fmt2(effectiveSell)} EGP/g`
          : `${t('perf.my.avg')} ${fmt2(derived.gold.avgCostPerGram)} EGP/g ${t('perf.vs.sell.cb')} ${t('attr.price.pending')}`;
        (avgVsSell as HTMLElement).style.color = effectiveSell !== null
          ? effectiveSell >= derived.gold.avgCostPerGram ? "var(--teal)" : "var(--coral)"
          : "var(--dim)";
      }
    }

    rows.forEach((row) => {
      const group = row.getAttribute("data-perf-group");
      row.style.display = rowFilter === "all" || group === rowFilter ? "flex" : "none";
    });
  }

  function updatePerfYieldForView(view: string) {
    const yieldEl   = el("s-yield");
    const subEl     = el("yield-sub");
    const certRow   = el("yield-cert-row");
    const totalRes  = el("yield-total-result");

    if (view === "liquid") {
      // Liquid: funds-only yield (no certificates)
      const fundsMonthly = derived.abr.monthlyYield;
      if (yieldEl) yieldEl.textContent = `+${fmt(Math.round(fundsMonthly))} EGP/mo`;
      if (subEl)   subEl.textContent   = `ABR ${fmt(derived.abr.apyPercent)}% · ${t('perf.funds.only')}`;
      if (certRow) certRow.style.display = "none";
      if (totalRes) totalRes.textContent = `${fmt(Math.round(fundsMonthly))} EGP/mo`;
    } else {
      // All other views: combined fund + certificates
      if (yieldEl) yieldEl.textContent = `+${fmt(Math.round(derived.yield.totalMonthly))} EGP/mo`;
      if (subEl)   subEl.textContent   = currentLang === 'ar'
        ? `ABR ${fmt(derived.abr.apyPercent)}% + NBE ${derived.certTotals.weightedAvgRate.toFixed(1)}% (متوسط مرجح)`
        : `ABR ${fmt(derived.abr.apyPercent)}% + NBE ${derived.certTotals.weightedAvgRate.toFixed(1)}% (weighted avg)`;
      if (certRow) certRow.style.display = "";
      if (totalRes) totalRes.textContent = `${fmt(Math.round(derived.yield.totalMonthly))} EGP/mo`;
    }
  }

  win.switchPerf = (type: string) => {
    currentPerf = type;
    const cfg = PERF_CFG[currentView] ?? PERF_CFG.total;
    // Hide every panel from both sets, then reveal the one that matches the pill.
    [...TOTAL_PERF_PANELS, ...STD_PERF_PANELS].forEach(id => {
      const p = el(id); if (p) p.style.display = "none";
    });
    const activeIdx = PILL_KEYS.indexOf(type as (typeof PILL_KEYS)[number]);
    if (activeIdx >= 0) {
      const p = el(cfg.panels[activeIdx]);
      if (p) p.style.display = "block";
    }
    PILL_KEYS.forEach(t => el(`pill-${t}`)?.classList.toggle("active", t === type));
    if (type === "growth") refreshGrowthLabel();
  };

  win.toggleMath = (id: string) => {
    const sec = el(id);
    if (sec) sec.classList.toggle("open");
  };

  win.togglePerfMath = () => {
    const cfg = PERF_CFG[currentView] ?? PERF_CFG.total;
    const id = cfg.mathIds[currentPerf as (typeof PILL_KEYS)[number]];
    if (!id) return; // no math section for this tab
    // Close all math sections so only one is open at a time.
    ["math-gold", "math-liquid", "math-yield", "math-total-capital", "math-total-income"].forEach(
      (o) => { if (o !== id) el(o)?.classList.remove("open"); },
    );
    el(id)?.classList.toggle("open");
  };

  function syncDarkLabel() {
    const isDark = document.body.classList.contains("dark");
    const icon  = el("dark-mode-icon");
    const label = el("dark-mode-label");
    if (icon)  icon.textContent  = isDark ? "☀️" : "🌙";
    if (label) label.textContent = isDark
      ? (currentLang === 'ar' ? "الوضع الفاتح" : "Light mode")
      : (currentLang === 'ar' ? "الوضع الداكن" : "Dark mode");
  }

  win.toggleDark = () => {
    document.body.classList.toggle("dark");
    syncDarkLabel();
  };

  // ── Language toggle ─────────────────────────────────────────────────
  function applyLang(lang: Lang) {
    currentLang = lang;
    saveLang(lang);

    // Set dir + lang on root
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';

    // Update settings dropdown lang item
    const langIcon  = el("lang-icon");
    const langLabel = el("lang-label");
    if (langIcon)  langIcon.textContent  = lang === 'ar' ? 'EN' : 'ع';
    if (langLabel) langLabel.textContent = lang === 'ar' ? 'English' : 'العربية';
    syncDarkLabel(); // dark label text depends on currentLang

    // Update page title
    const appTitle = el("app-title");
    if (appTitle) appTitle.textContent = lang === 'ar' ? '📊 محفظة · بيشوي' : '📊 Portfolio · Beeshoy';

    // Update nav buttons
    const NAV_LABELS: Record<string, [string, string]> = {
      'view-btn-total':  ['📊 Total',        '📊 الإجمالي'],
      'view-btn-gold':   ['🥇 Gold',          '🥇 ذهب'],
      'view-btn-liquid': ['💧 Liquid',        '💧 سيولة'],
      'view-btn-certs':  ['🏦 Certificates',  '🏦 شهادات'],
      'view-btn-ai':     ['🤖 AI Insights',   '🤖 رؤى الذكاء الاصطناعي'],
    };
    Object.entries(NAV_LABELS).forEach(([id, [en, ar]]) => {
      const btn = el(id);
      if (btn) btn.textContent = lang === 'ar' ? ar : en;
    });

    // Walk all data-i18n elements
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => {
      const key = node.getAttribute('data-i18n')!;
      const text = T[lang][key] ?? T.en[key];
      if (text !== undefined) node.textContent = text;
    });

    // Refresh dynamically-generated info box content that doesn't use data-i18n
    const allocDetailText = el("alloc-detail-text");
    if (allocDetailText) allocDetailText.textContent = allocInsight(derived, lang);

    const insightsBody = el("insights-body");
    if (insightsBody) insightsBody.innerHTML = buildInsights(derived, lang);
    const aiInsightsBody = el("ai-insights-body");
    if (aiInsightsBody) aiInsightsBody.innerHTML = buildInsights(derived, lang);

    const whGrade = el("wh-grade");
    if (whGrade) whGrade.textContent = healthGrade(derived.health.overallScore, lang);

    // Re-run DCA so drop texts update
    (win.calcGoldDca as () => void)();

    // Re-run setView to refresh hero title/sub, view label, and pill labels
    (win.setView as (view: string) => void)(currentView);

    // Refresh pnl-row sub descriptions that mix live numbers with bilingual labels
    const pnlSubGold = el("pnl-row-sub-gold");
    if (pnlSubGold) pnlSubGold.innerHTML =
      `${fmt(derived.gold.gramsHeld)}g <span data-i18n="pnl.sub.physical">${lang === 'ar' ? 'مادي' : 'physical'}</span>`;

    const pnlSubAbr = el("pnl-row-sub-abr");
    if (pnlSubAbr) pnlSubAbr.innerHTML = lang === 'ar'
      ? `<span data-i18n="pnl.sub.fixed.income">دخل ثابت</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(derived.abr.nav)} ج.م · ${fmt(derived.abr.apyPercent)}% <span data-i18n="pnl.sub.apy">عائد سنوي</span>`
      : `<span data-i18n="pnl.sub.fixed.income">Fixed Income</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(derived.abr.nav)} EGP · ${fmt(derived.abr.apyPercent)}% <span data-i18n="pnl.sub.apy">APY</span>`;

    const pnlSubRe = el("pnl-row-sub-re");
    if (pnlSubRe) pnlSubRe.innerHTML = lang === 'ar'
      ? `<span data-i18n="pnl.sub.equity">صندوق أسهم</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(derived.re.nav)} ج.م`
      : `<span data-i18n="pnl.sub.equity">Equity Fund</span> · <span data-i18n="pnl.sub.nav">NAV</span> ${fmt2(derived.re.nav)} EGP`;

    // Refresh DCA sub paragraph
    const dcaSubEl = el("dca-sub");
    if (dcaSubEl) dcaSubEl.textContent = lang === 'ar'
      ? `تحتفظ بـ ${fmt(derived.gold.gramsHeld)}جم (محسوبة بالذهب النقي) بمتوسط ${fmt(derived.gold.avgCostPerGram)} ج.م/جم نقي. السيناريوهات تُحسب تلقائياً من أسعار goldbullioneg.com الحية (تتجدد كل 5 دقائق). رسوم تصنيع على كل شراء، واسترداد على كل بيع — وفق جدول رسوم الموزع الثابت.`
      : `You hold ${fmt(derived.gold.gramsHeld)}g (pure-gold-adjusted) @ ${fmt(derived.gold.avgCostPerGram)} EGP/pure-g avg. Scenarios are auto-calculated from live goldbullioneg.com prices (refreshed every 5 min). Manufacturing fee on every buy, cashback on every sell — per the fixed dealer fee schedule.`;

    // Re-render cert table and timeline (date locale, badge text, "d left", etc.)
    renderCerts();

    // Refresh PnL sort label (translates "Default" / active sort key name on lang switch)
    const sortLabel = el("pnl-sort-label");
    if (sortLabel) {
      const sortKeyMap: Record<string, string> = {
        value: 'sort.by.value', pnl: 'sort.by.pnl', pct: 'sort.by.pct', name: 'sort.by.name',
      };
      sortLabel.textContent = currentSortKey && sortKeyMap[currentSortKey]
        ? t(sortKeyMap[currentSortKey])
        : t('sort.default');
    }
  }

  win.toggleLang = () => {
    applyLang(currentLang === 'ar' ? 'en' : 'ar');
  };

  // ── Settings dropdown ────────────────────────────────────────────────
  function closeSettings() {
    el("settings-dropdown")?.classList.remove("open");
  }
  win.toggleSettings = () => {
    el("settings-dropdown")?.classList.toggle("open");
  };
  win.closeSettings = closeSettings;

  // Close when clicking outside the settings wrap
  const closeSettingsOutside = (e: MouseEvent) => {
    const wrap = document.querySelector(".settings-wrap");
    if (wrap && !wrap.contains(e.target as Node)) closeSettings();
  };
  document.addEventListener("click", closeSettingsOutside);

  win.dismissWarning = () => {
    const w = el("api-warning");
    if (w) w.style.display = "none";
  };

  win.doRefresh = async () => {
    const btn = el("refresh-btn");
    if (btn) btn.textContent = "⏳";
    el("live-bar")!.style.display = "flex";

    // 1. Fetch USD/EGP and EUR/EGP rates from the backend cache (open.er-api.com
    //    fetch runs server-side; the Replit preview iframe blocks external
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

    try {
      const eurResp = await fetch("/api/portfolio/eur-rate", {
        signal: AbortSignal.timeout(8_000),
      });
      if (eurResp.ok) {
        const data = (await eurResp.json()) as { rate?: number; status?: string };
        const rate = data?.rate;
        const status = data?.status ?? "unavailable";
        if (rate && rate > 0) {
          const eurEl = el("live-eur");
          if (eurEl) eurEl.textContent = rate.toFixed(2);
          const dotEur = el("dot-eur");
          if (dotEur) dotEur.className = status === "live" ? "live-dot ok" : "live-dot warn";
          const eurStatusEl = el("eur-status");
          if (eurStatusEl) {
            eurStatusEl.textContent = status;
            eurStatusEl.className = status === "live" ? "status-badge status-live" : "status-badge status-fallback";
          }
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
          globalGoldUsdPerOz?: number | null;
          globalGoldStatus?: string | null;
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

        // Global XAU/USD price (Swissquote — piggybacked on the same fetch).
        const xauPrice = gp.globalGoldUsdPerOz;
        const xauStatus = gp.globalGoldStatus ?? "unavailable";
        const xauIsLive = xauStatus === "live";
        const dotXau = el("dot-xau");
        if (dotXau)
          dotXau.className = xauIsLive && xauPrice ? "live-dot ok" : "live-dot warn";
        const xauEl = el("live-xau");
        if (xauEl && xauPrice)
          xauEl.textContent = xauPrice.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        const xauStatusEl = el("xau-status");
        if (xauStatusEl) {
          xauStatusEl.textContent = xauIsLive ? "live" : xauStatus;
          xauStatusEl.className = xauIsLive
            ? "status-badge status-live"
            : "status-badge status-fallback";
        }
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
    const sortKeyMap: Record<string, [string, string]> = {
      value: ['sort.by.value', 'sort.by.value'],
      pnl:   ['sort.by.pnl',   'sort.by.pnl'],
      pct:   ['sort.by.pct',   'sort.by.pct'],
      name:  ['sort.by.name',  'sort.by.name'],
    };
    if (label) label.textContent = sortKeyMap[key] ? t(sortKeyMap[key][0]) : t('sort.default');
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
    (el(`dca-${prefix}-avg`) as HTMLElement).textContent = `${fmt2(newAvg)} ${t('unit.egp.per.pure.g')}`;
    (el(`dca-${prefix}-drop`) as HTMLElement).textContent =
      avgDrop >= 0
        ? `↓ ${t('dca.avg.drops')} ${fmt2(avgDrop)} ${t('dca.avg.unit')}`
        : `↑ ${t('dca.avg.rises')} ${fmt2(-avgDrop)} ${t('dca.avg.unit')}`;
    const pnlEl = el(`dca-${prefix}-pnl`) as HTMLElement;
    pnlEl.textContent = `${adjustedPnl >= 0 ? "+" : ""}${fmt(Math.round(adjustedPnl))} EGP (${adjustedPnlPct >= 0 ? "+" : ""}${adjustedPnlPct.toFixed(1)}%)`;
    pnlEl.classList.toggle("pos", adjustedPnl >= 0);
    pnlEl.classList.toggle("neg", adjustedPnl < 0);
  }

  function clearGoldDcaScenario(prefix: "s1" | "s2" | "s3" | "s4") {
    const setText = (id: string, v: string) => { const e = el(id); if (e) e.textContent = v; };
    setText(`dca-${prefix}-pay`, "—");
    setText(`dca-${prefix}-avg`, "—");
    setText(`dca-${prefix}-drop`, "—");
    setText(`dca-${prefix}-pnl`, "—");
  }

  win.calcGoldDca = () => {
    const { buyPrice24k: buyPrice24, sellPrice24k: sellPrice24, buyPrice21k: buyPrice21, sellPrice21k: sellPrice21 } = liveGoldPrices;
    const note = el("dca-note") as HTMLElement;

    if (buyPrice24 === null || sellPrice24 === null) {
      (["s1", "s2", "s3", "s4"] as const).forEach(clearGoldDcaScenario);
      if (note) note.textContent = t('dca.note.waiting');
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

    if (note) note.textContent = t('dca.note.live');
  };

  win.saveGrowthSnapshot = async () => {
    const btn = document.querySelector<HTMLButtonElement>("#perf-growth button");
    if (btn) btn.disabled = true;
    try {
      // Total view saves the whole-wallet value; other views save ABR value.
      const snapValue = currentView === "total" ? derived.total.value : derived.abr.value;
      await callbacks.createSnapshot(snapValue);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  win.runPriceChecker = async () => {
    const btn = el("scraper-run-btn") as HTMLButtonElement | null;
    const label = el("scraper-btn-label");
    const statusEl = el("scraper-status");
    const resultsEl = el("price-checker-results");
    const tableEl = el("price-checker-table");

    if (btn) btn.disabled = true;
    if (label) label.textContent = "Running…";
    if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "⏳ Fetching prices from FoudaLens — this takes 1–2 minutes…"; }

    try {
      const runResp = await fetch("/api/scraper/run", { method: "POST" });
      if (!runResp.ok) {
        const err = await runResp.json().catch(() => ({ error: "Unknown error" }));
        if (statusEl) statusEl.textContent = `❌ Run failed: ${(err as any).error ?? runResp.statusText}`;
        return;
      }

      // Fetch the snapshots now that the run succeeded
      const snapResp = await fetch("/api/scraper/snapshots");
      if (!snapResp.ok) { if (statusEl) statusEl.textContent = "❌ Could not load snapshots after run."; return; }
      const { snapshots, lastRunAt } = (await snapResp.json()) as { snapshots: any[]; lastRunAt: string | null };

      if (statusEl) {
        const ts = lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : "just now";
        const ok = snapshots.filter((s: any) => s.raw_fetch_ok).length;
        statusEl.textContent = `✅ Done at ${ts} · ${ok}/${snapshots.length} entities fetched successfully`;
      }

      // Build comparison table grouped by entity_type
      if (tableEl && resultsEl) {
        const funds = snapshots.filter((s: any) => s.entity_type === "fund" && s.raw_fetch_ok);
        const stocks = snapshots.filter((s: any) => s.entity_type === "stock" && s.raw_fetch_ok);
        const indices = snapshots.filter((s: any) => s.entity_type === "index" && s.raw_fetch_ok);

        const fmtPct = (v: any) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";
        const fmtNum = (v: any) => v != null ? Number(v).toFixed(2) : "—";
        const heldTag = (s: any) => s.is_held ? ' <span style="background:var(--teal);color:#fff;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px">HELD</span>' : "";

        const tableRow = (s: any) => `
          <tr style="border-bottom:1px solid var(--edge)">
            <td style="padding:6px 8px;font-weight:600;white-space:nowrap">${s.ticker}${heldTag(s)}</td>
            <td style="padding:6px 8px;color:var(--dim);font-size:10px">${s.name}</td>
            <td style="padding:6px 8px;text-align:right">${fmtNum(s.nav_or_price)}</td>
            <td style="padding:6px 8px;text-align:right;color:${Number(s.return_30d_percent) >= 0 ? "var(--teal)" : "var(--coral)"}">${fmtPct(s.return_30d_percent)}</td>
            <td style="padding:6px 8px;text-align:right;color:${Number(s.return_ytd_percent) >= 0 ? "var(--teal)" : "var(--coral)"}">${fmtPct(s.return_ytd_percent)}</td>
            <td style="padding:6px 8px;text-align:right">${s.total_score != null ? Number(s.total_score).toFixed(0) + "/100" : "—"}</td>
          </tr>`;

        const sectionHeader = (title: string) => `
          <tr style="background:var(--bg)">
            <td colspan="6" style="padding:8px 8px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)">${title}</td>
          </tr>`;

        const thead = `<thead><tr style="border-bottom:2px solid var(--edge)">
          <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--dim)">Ticker</th>
          <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--dim)">Name</th>
          <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--dim)">NAV/Price</th>
          <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--dim)">30d</th>
          <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--dim)">YTD</th>
          <th style="padding:6px 8px;text-align:right;font-size:10px;color:var(--dim)">Score</th>
        </tr></thead>`;

        const rows = [
          ...(funds.length ? [sectionHeader("Funds"), ...funds.sort((a: any, b: any) => Number(b.return_30d_percent ?? -999) - Number(a.return_30d_percent ?? -999)).map(tableRow)] : []),
          ...(stocks.length ? [sectionHeader("Stocks"), ...stocks.sort((a: any, b: any) => Number(b.total_score ?? 0) - Number(a.total_score ?? 0)).map(tableRow)] : []),
          ...(indices.length ? [sectionHeader("Indices"), ...indices.map(tableRow)] : []),
        ];

        tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px">${thead}<tbody>${rows.join("")}</tbody></table>`;
        resultsEl.style.display = "block";
      }
    } catch (err: any) {
      if (statusEl) statusEl.textContent = `❌ Network error: ${err?.message ?? "Unknown"}`;
    } finally {
      if (btn) btn.disabled = false;
      if (label) label.textContent = "Refresh prices";
    }
  };

  win.openInsights = () => {
    const ts = el("insights-timestamp");
    if (ts) ts.textContent = `${t('insights.generated')} ${new Date().toLocaleString()}`;
    el("insight-overlay")?.classList.add("open");
  };
  win.closeInsights = () => el("insight-overlay")?.classList.remove("open");
  win.openAdd = () => el("add-modal")?.classList.add("open");
  win.closeAdd = () => el("add-modal")?.classList.remove("open");
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
      btn.textContent = t('btn.saving');
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
        btn.textContent = t('btn.apply');
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
      if (status) status.textContent = t('scan.key.set');
    }
    el("apikey-overlay")?.classList.remove("open");
  };

  // ── AI Scanner state ──────────────────────────────────────────────────────
  let currentScanMode = "";
  let pendingScanResult: {
    fund: "abr" | "re";
    nav?: number;
    unitsHeld?: number;
  } | null = null;

  function showScanError(msg: string) {
    const errorEl = el("scan-error");
    if (!errorEl) return;
    errorEl.textContent = "⚠️ " + msg;
    (errorEl as HTMLElement).style.display = "block";
  }

  async function runScan(dataUrl: string) {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      showScanError(t('scan.err.no.key'));
      return;
    }
    if (!currentScanMode) {
      showScanError(t('scan.err.no.mode'));
      return;
    }

    const processingEl = el("scan-processing");
    const errorEl = el("scan-error");
    const resultEl = el("scan-result");
    const actionsEl = el("scan-actions");

    // Reset UI
    if (processingEl) (processingEl as HTMLElement).style.display = "flex";
    if (errorEl) { (errorEl as HTMLElement).style.display = "none"; errorEl.textContent = ""; }
    if (resultEl) (resultEl as HTMLElement).style.display = "none";
    if (actionsEl) (actionsEl as HTMLElement).style.display = "none";
    pendingScanResult = null;

    const base64 = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";

    const prompt =
      currentScanMode === "order"
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

    try {
      const response = await fetch("/api/portfolio/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, mode: currentScanMode, apiKey }),
      });

      const data = (await response.json()) as {
        fund?: unknown;
        nav?: unknown;
        unitsHeld?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? `Scan error ${response.status}`);
      }

      if (!data.fund || !["abr", "re"].includes(data.fund as string)) {
        throw new Error(t('scan.err.no.fund'));
      }

      pendingScanResult = {
        fund: data.fund as "abr" | "re",
        nav: data.nav != null ? Number(data.nav) : undefined,
        unitsHeld: data.unitsHeld != null ? Number(data.unitsHeld) : undefined,
      };

      // Show result panel
      if (processingEl) (processingEl as HTMLElement).style.display = "none";
      if (resultEl) {
        (resultEl as HTMLElement).style.display = "block";
        const body = el("scan-result-body");
        if (body) {
          const fundName =
            pendingScanResult.fund === "abr" ? "Bareeq (ABR)" : "Real Estate (BRE)";
          body.innerHTML = [
            `<div class="scan-result-row"><span>${t('scan.result.fund')}</span><span>${fundName}</span></div>`,
            pendingScanResult.nav != null
              ? `<div class="scan-result-row"><span>${t('scan.result.nav')}</span><span>${pendingScanResult.nav.toFixed(4)}</span></div>`
              : "",
            pendingScanResult.unitsHeld != null
              ? `<div class="scan-result-row"><span>${t('scan.result.units')}</span><span>${pendingScanResult.unitsHeld.toLocaleString()}</span></div>`
              : "",
          ]
            .filter(Boolean)
            .join("");
        }
      }
      if (actionsEl) (actionsEl as HTMLElement).style.display = "block";
    } catch (err) {
      if (processingEl) (processingEl as HTMLElement).style.display = "none";
      showScanError(
        err instanceof Error ? err.message : t('scan.err.failed'),
      );
    }
  }

  win.selectScanMode = (mode: string) => {
    currentScanMode = mode;
    ["order", "nav", "stock"].forEach((m) =>
      el(`mode-${m}`)?.classList.toggle("selected", m === mode),
    );
  };

  win.onFileSelected = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const preview = el("scan-preview") as HTMLImageElement;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      preview.src = dataUrl;
      preview.style.display = "block";
      (el("scan-upload-label") as HTMLElement).style.display = "none";
      // Reset previous results before re-scanning
      const errorEl = el("scan-error");
      const resultEl = el("scan-result");
      const actionsEl = el("scan-actions");
      if (errorEl) { (errorEl as HTMLElement).style.display = "none"; errorEl.textContent = ""; }
      if (resultEl) (resultEl as HTMLElement).style.display = "none";
      if (actionsEl) (actionsEl as HTMLElement).style.display = "none";
      await runScan(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  win.applyScanResult = async () => {
    if (!pendingScanResult) return;
    const btn = el("scan-apply-btn") as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = t('scan.btn.applying'); }
    try {
      const { fund, nav, unitsHeld } = pendingScanResult;
      const body: { nav?: number; unitsHeld?: number } = {};
      if (nav != null) body.nav = nav;
      if (unitsHeld != null) body.unitsHeld = unitsHeld;
      await callbacks.updateFund(fund, body);
      pendingScanResult = null;
      el("scan-overlay")?.classList.remove("open");
    } catch (err) {
      showScanError(
        t('scan.err.save.fail') + " " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = t('scan.btn.apply.dash'); }
    }
  };

  // ── Cert table sort state ───────────────────────────────────────────
  type CertSortKey = 'name' | 'value' | 'rate' | 'maturity' | 'monthly';
  let certSortKey: CertSortKey = 'maturity';
  let certSortDir: 'asc' | 'desc' = 'asc';
  let certFilterType = 'all';

  function applyCertSort(data: typeof CERTS_DATA): typeof CERTS_DATA {
    return [...data].sort((a, b) => {
      let cmp = 0;
      if      (certSortKey === 'name')     cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
      else if (certSortKey === 'value')    cmp = a.value - b.value;
      else if (certSortKey === 'rate')     cmp = a.rate - b.rate;
      else if (certSortKey === 'maturity') cmp = new Date(a.maturity).getTime() - new Date(b.maturity).getTime();
      else if (certSortKey === 'monthly')  cmp = a.monthly - b.monthly;
      return certSortDir === 'asc' ? cmp : -cmp;
    });
  }

  function updateSortHeaders() {
    (['name','value','rate','maturity','monthly'] as CertSortKey[]).forEach(key => {
      const th = el(`th-arrow-${key}`)?.closest('th');
      const arrow = el(`th-arrow-${key}`);
      if (!th || !arrow) return;
      const isActive = key === certSortKey;
      th.classList.toggle('th-active', isActive);
      arrow.textContent = isActive ? (certSortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
    });
  }

  win.sortCerts = (key: string) => {
    if (certSortKey === key as CertSortKey) {
      certSortDir = certSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      certSortKey = key as CertSortKey;
      certSortDir = 'asc';
    }
    updateSortHeaders();
    rebuildCertTbody();
    (win.filterCerts as (t: string) => void)(certFilterType);
  };

  function rebuildCertTbody() {
    const tbody = el("certs-tbody");
    if (!tbody) return;
    const today = new Date();
    const rows = applyCertSort(CERTS_DATA);
    tbody.innerHTML = rows.map((c) => {
      const mat = new Date(c.maturity);
      const daysLeft = Math.ceil((mat.getTime() - today.getTime()) / 86400000);
      const badge = daysLeft < 90
        ? `<span style="background:var(--coral-soft);color:var(--coral);font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px">${t('cert.badge.soon')}</span>`
        : "";
      return `<tr data-maturity="${c.maturity}" data-rate="${c.rate}">
        <td><div class="ah-asset-name">${c.name}</div></td>
        <td style="font-weight:700">${fmt(c.value)} EGP</td>
        <td style="color:var(--teal);font-weight:700">${c.rate}%</td>
        <td>${mat.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { month: "short", day: "numeric", year: "numeric" })} ${badge}</td>
        <td style="color:var(--teal);font-weight:700">${fmt(c.monthly)} EGP</td>
      </tr>`;
    }).join("");
  }

  win.filterCerts = (type: string) => {
    certFilterType = type;
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
          <div><div class="cert-timeline-name">${c.name}</div><div class="cert-timeline-date">${mat.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { month: "short", day: "numeric", year: "numeric" })} · ${daysLeft}${t('cert.days.left')}</div><div class="cert-timeline-amount">${fmt(c.value)} EGP @ ${c.rate}%</div></div>
        </div>`;
          })
          .join("") +
        (sorted.length > 6
          ? `<div style="font-size:10px;color:var(--dim);padding:8px 0">+ ${sorted.length - 6} ${t('cert.more.suffix')}</div>`
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
          <div><div style="font-size:12px;font-weight:700;color:var(--ink)">${rate}% APY</div><div style="font-size:10px;color:var(--dim)">${info.count} ${info.count > 1 ? t('cert.count.plural') : t('cert.count.single')}</div></div>
          <div style="text-align:right"><div style="font-size:12px;font-weight:700;color:var(--teal)">${fmt(info.total)} EGP</div><div style="font-size:10px;color:var(--dim)">${fmt(Math.round((info.total * +rate) / 100 / 12))}/mo</div></div>
        </div>`,
        )
        .join("");
    }
    rebuildCertTbody();
  }

  type SnapRow = { snapshotDate: string; value: number };
  function renderSparklineInto(snaps: SnapRow[]) {
    if (snaps.length === 0) return;

    const latest = snaps[snaps.length - 1];
    const prev   = snaps.length > 1 ? snaps[snaps.length - 2] : null;

    const latestEl = el("growth-latest");
    if (latestEl) latestEl.textContent = `${fmt(latest.value)} EGP`;
    const deltaEl = el("growth-delta");
    if (deltaEl) {
      if (prev) {
        const delta = latest.value - prev.value;
        const pct = prev.value > 0 ? (delta / prev.value) * 100 : 0;
        deltaEl.textContent = `${delta >= 0 ? "▲" : "▼"} ${delta >= 0 ? "+" : ""}${fmt(delta)} EGP (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%) ${currentLang === 'ar' ? 'مقابل اللقطة السابقة' : 'vs last snapshot'}`;
      } else {
        deltaEl.textContent = currentLang === 'ar' ? 'أول لقطة مسجلة' : 'First snapshot recorded';
      }
    }
    const snapCountEl = el("growth-snapcount");
    if (snapCountEl) snapCountEl.textContent = currentLang === 'ar' ? `${snaps.length} لقطة` : `${snaps.length} snapshots`;

    const values = snaps.map((s) => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 300, height = 90, padX = 8, padTop = 14, padBottom = 12;
    const points = snaps.map((s, i) => ({
      x: snaps.length === 1
        ? width / 2
        : padX + (i / (snaps.length - 1)) * (width - padX * 2),
      y: height - padBottom - ((s.value - min) / range) * (height - padTop - padBottom),
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    el("spark-line")?.setAttribute("d", linePath);
    el("spark-fill")?.setAttribute("d", fillPath);
    const dotEl = el("spark-dot");
    if (dotEl) {
      dotEl.setAttribute("cx", String(points[points.length - 1].x));
      dotEl.setAttribute("cy", String(points[points.length - 1].y));
    }
    const fmtDate = (s: string) =>
      new Date(s).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const labelsEl = el("spark-labels");
    if (labelsEl) {
      labelsEl.innerHTML =
        `<span style="font-size:9px;color:var(--dim);font-weight:600">${fmtDate(snaps[0].snapshotDate)}</span>` +
        `<span style="font-size:9px;color:var(--dim);font-weight:600">${fmtDate(snaps[snaps.length - 1].snapshotDate)}</span>`;
    }
  }

  function renderGrowthSparkline() {
    const snaps = [...portfolio.snapshots].sort(
      (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime(),
    );
    renderSparklineInto(snaps);
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
  // Apply saved language before initial setView so labels render correctly
  applyLang(currentLang);
  (win.setView as (view: string) => void)("total");
  renderCerts();
  updateSortHeaders();
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

  // Fetch live prices immediately on load so the XAU/USD pill (and any
  // stale EGP prices) are updated without waiting for the user to click 🔄.
  void (win.doRefresh as () => Promise<void>)();

  return () => {
    clearInterval(timeInterval);
    document.removeEventListener("click", closeSortPopover);
    document.removeEventListener("click", closeSettingsOutside);
  };
}
