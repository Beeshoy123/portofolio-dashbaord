import { useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Coins,
  Droplets,
  Award,
  Activity,
  Shield,
  Layers,
} from "lucide-react";

// ── Real portfolio data ───────────────────────────────────────────────────────
const PORTFOLIO = {
  costBasis: 376140,
  marketValue: 363535,
  pnl: -12605,
  pnlPct: -3.4,
};

const GOLD = {
  grams: 20,
  karat: "24K",
  costBasis: 146200,
  marketValue: 133500,
  pnl: -12700,
  pnlPct: -8.7,
  livePrice: 6675,
  avgCost: 7310,
  bars: [
    { qty: 2, weight: "5g", spot: 6600, fee: 80, date: "Dec 15, 2025" },
    { qty: 1, weight: "5g", spot: 7658, fee: 82, date: "Feb 12, 2026" },
    { qty: 1, weight: "5g", spot: 8069, fee: 71, date: "Apr 17, 2026" },
  ],
};

const FUNDS = [
  {
    key: "abr",
    name: "Bareeq",
    ticker: "ABR",
    units: 72,
    nav: 207.80,
    value: 14962,
    cost: 14920,
    pnl: 42,
    pnlPct: 0.3,
    color: "#00b69b",
    icon: Droplets,
  },
  {
    key: "re",
    name: "Real Estate",
    ticker: "BRE",
    units: 2656,
    nav: 1.91,
    value: 5073,
    cost: 5020,
    pnl: 53,
    pnlPct: 1.1,
    color: "#7c6af5",
    icon: Layers,
  },
];

const CERTS = [
  { id: 7, name: "NBE Cert #7", value: 6000, rate: 19.0, maturity: "2026-07-13", daysLeft: -1 },
  { id: 8, name: "NBE Cert #8", value: 2000, rate: 19.0, maturity: "2026-08-07", daysLeft: 24 },
  { id: 9, name: "NBE Cert #9", value: 2000, rate: 19.0, maturity: "2026-08-14", daysLeft: 31 },
  { id: 10, name: "NBE Cert #10", value: 6000, rate: 19.0, maturity: "2026-09-04", daysLeft: 52 },
  { id: 11, name: "NBE Cert #11", value: 3000, rate: 19.0, maturity: "2026-10-10", daysLeft: 88 },
  { id: 12, name: "NBE Cert #12", value: 1000, rate: 19.0, maturity: "2026-10-15", daysLeft: 93 },
  { id: 13, name: "NBE Cert #13", value: 5000, rate: 19.0, maturity: "2026-10-22", daysLeft: 100 },
  { id: 14, name: "NBE Cert #14", value: 15000, rate: 19.0, maturity: "2026-10-25", daysLeft: 103 },
  { id: 15, name: "NBE Cert #15", value: 5000, rate: 19.0, maturity: "2026-11-09", daysLeft: 118 },
  { id: 16, name: "NBE Cert #16", value: 2000, rate: 19.0, maturity: "2026-11-13", daysLeft: 122 },
  { id: 17, name: "NBE Cert #17", value: 4000, rate: 19.0, maturity: "2026-11-29", daysLeft: 138 },
  { id: 18, name: "NBE Cert #18", value: 4000, rate: 19.0, maturity: "2027-01-02", daysLeft: 172 },
  { id: 19, name: "NBE Cert #19", value: 3000, rate: 25.0, maturity: "2027-03-11", daysLeft: 240 },
  { id: 20, name: "NBE Cert #20", value: 3000, rate: 19.25, maturity: "2027-04-08", daysLeft: 268 },
  { id: 21, name: "NBE Cert #21", value: 5000, rate: 21.5, maturity: "2027-04-16", daysLeft: 276 },
  { id: 22, name: "NBE Cert #22", value: 3000, rate: 21.5, maturity: "2027-05-14", daysLeft: 304 },
  { id: 23, name: "NBE Cert #23", value: 3000, rate: 21.5, maturity: "2027-05-20", daysLeft: 310 },
  { id: 24, name: "NBE Cert #24", value: 3000, rate: 21.5, maturity: "2027-06-13", daysLeft: 334 },
  { id: 1, name: "NBE Cert #1", value: 15000, rate: 19.0, maturity: "2027-04-06", daysLeft: 266 },
  { id: 2, name: "NBE Cert #2", value: 36000, rate: 19.0, maturity: "2027-04-13", daysLeft: 273 },
  { id: 3, name: "NBE Cert #3", value: 30000, rate: 19.0, maturity: "2027-04-18", daysLeft: 278 },
  { id: 4, name: "NBE Cert #4", value: 3000, rate: 19.0, maturity: "2027-04-18", daysLeft: 278 },
  { id: 5, name: "NBE Cert #5", value: 16000, rate: 19.0, maturity: "2027-04-27", daysLeft: 287 },
  { id: 6, name: "NBE Cert #6", value: 5000, rate: 19.0, maturity: "2027-04-30", daysLeft: 290 },
  { id: 25, name: "NBE Cert #25", value: 30000, rate: 18.5, maturity: "2028-06-17", daysLeft: 703 },
];
const CERTS_TOTAL = CERTS.reduce((s, c) => s + c.value, 0); // 210,000

const TXS = [
  { name: "Bareeq Fund", meta: "24 units @ 207.695", amount: 4984.80, type: "buy", date: "Jul 5, 2026", asset: "abr" },
  { name: "Bareeq Fund", meta: "48 units @ 206.988", amount: 9935.52, type: "buy", date: "Jun 26, 2026", asset: "abr" },
  { name: "Real Estate", meta: "2,656 units @ 1.888", amount: 5019.84, type: "buy", date: "Jun 16, 2026", asset: "re" },
  { name: "Gold 24K", meta: "1 bar × 5g @ 8,069/g", amount: 40700, type: "buy", date: "Apr 17, 2026", asset: "gold" },
  { name: "Gold 24K", meta: "1 bar × 5g @ 7,658/g", amount: 38700, type: "buy", date: "Feb 12, 2026", asset: "gold" },
  { name: "Gold 24K", meta: "2 bars × 5g @ 6,600/g", amount: 66800, type: "buy", date: "Dec 15, 2025", asset: "gold" },
];

const HEALTH = { score: 34, diversity: 63, emergencyFund: 25, yieldRate: 45, liquidity: 4 };

// ── Helpers ───────────────────────────────────────────────────────────────────
const egp = (n: number, dec = 0) =>
  n.toLocaleString("en-EG", { maximumFractionDigits: dec, minimumFractionDigits: dec });

const assetIcon: Record<string, string> = { gold: "🥇", abr: "💧", re: "🏢", cert: "🏦" };

const daysColor = (d: number) =>
  d < 0 ? "#ff4d6d" : d < 90 ? "#f59e0b" : "#4ade80";

const healthColor = (v: number) =>
  v >= 70 ? "#4ade80" : v >= 40 ? "#f59e0b" : "#ff4d6d";

// ── Sub-components ────────────────────────────────────────────────────────────
function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const up = pnl >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: up ? "#4ade80" : "#ff6b6b",
        background: up ? "rgba(74,222,128,0.12)" : "rgba(255,107,107,0.12)",
        borderRadius: 8,
        padding: "3px 8px",
      }}
    >
      <Icon size={11} />
      {up ? "+" : ""}{egp(pnl)} EGP &nbsp;({up ? "+" : ""}{pct.toFixed(1)}%)
    </span>
  );
}

function ExpandToggle({ open }: { open: boolean }) {
  return (
    <span style={{ color: "#444", display: "flex", alignItems: "center" }}>
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </span>
  );
}

function MiniBar({ value, max, color = "#00b69b" }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ height: 3, borderRadius: 99, background: "#2a2a2a", overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", borderRadius: 99, background: color }} />
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  children,
  style = {},
  onClick,
  expanded,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  expanded?: boolean;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: "#161616",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "flex 0.35s cubic-bezier(0.4,0,0.2,1)",
        ...style,
      }}
    >
      {children}
      {onClick && (
        <div style={{ position: "absolute", top: 14, right: 14 }}>
          <ExpandToggle open={!!expanded} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BentoDashboard() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: string) =>
    setExpanded((prev) => (prev === key ? null : key));

  const isOpen = (key: string) => expanded === key;

  const GAP = 3;

  // Allocation %
  const goldPct = Math.round((GOLD.marketValue / PORTFOLIO.marketValue) * 100);
  const abrPct = Math.round((FUNDS[0].value / PORTFOLIO.marketValue) * 100);
  const rePct = Math.round((FUNDS[1].value / PORTFOLIO.marketValue) * 100);
  const certPct = Math.round((CERTS_TOTAL / PORTFOLIO.marketValue) * 100);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0c0c0c",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: GAP,
        boxSizing: "border-box",
        gap: GAP,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px",
          background: "#161616",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>
            Portfolio<span style={{ color: "#00b69b" }}>·</span>Beeshoy
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["Total", "Gold", "Liquid", "Certs"].map((t) => (
            <button
              key={t}
              style={{
                background: t === "Total" ? "#00b69b" : "transparent",
                color: t === "Total" ? "#000" : "#666",
                border: "none",
                borderRadius: 10,
                padding: "5px 12px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#444", textAlign: "right" }}>
            <span style={{ color: "#4ade80", fontSize: 9 }}>●</span> Gold 24K:{" "}
            <span style={{ color: "#888" }}>6,675 EGP/g LIVE</span>
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "#00b69b22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ⚙️
          </div>
        </div>
      </div>

      {/* ── Body: 3-column bento ── */}
      <div
        style={{
          display: "flex",
          gap: GAP,
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* ── LEFT COLUMN (flex: 5) ── */}
        <div style={{ flex: 5, display: "flex", flexDirection: "column", gap: GAP, minWidth: 0 }}>

          {/* TOTAL VALUE card */}
          <Card
            onClick={() => toggle("total")}
            expanded={isOpen("total")}
            style={{
              flex: isOpen("total") ? 3 : 2,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* bg decoration */}
            <div style={{
              position: "absolute", right: -30, top: -30,
              width: 180, height: 180, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,182,155,0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                Total Portfolio Value
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
                {egp(PORTFOLIO.marketValue)}
                <span style={{ fontSize: 16, color: "#444", fontWeight: 400, marginLeft: 4 }}>EGP</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <PnlBadge pnl={PORTFOLIO.pnl} pct={PORTFOLIO.pnlPct} />
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                Cost basis: {egp(PORTFOLIO.costBasis)} EGP
              </div>
            </div>

            {/* Allocation mini-bars */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: "#444", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Allocation
              </div>
              <div style={{ display: "flex", gap: 0, height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${goldPct}%`, background: "#f5c842" }} />
                <div style={{ width: `${certPct}%`, background: "#00b69b" }} />
                <div style={{ width: `${abrPct}%`, background: "#7c6af5" }} />
                <div style={{ width: `${rePct}%`, background: "#f97316" }} />
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[
                  { label: "Gold", pct: goldPct, color: "#f5c842" },
                  { label: "Certs", pct: certPct, color: "#00b69b" },
                  { label: "ABR", pct: abrPct, color: "#7c6af5" },
                  { label: "RE", pct: rePct, color: "#f97316" },
                ].map((a) => (
                  <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                    <span style={{ fontSize: 10, color: "#666" }}>{a.label} {a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expanded detail */}
            {isOpen("total") && (
              <div style={{
                marginTop: 16, paddingTop: 14,
                borderTop: "1px solid #222",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px",
                animation: "fadeIn 0.25s",
              }}>
                {[
                  { label: "Gold", val: egp(GOLD.marketValue), sub: `${GOLD.grams}g @ ${egp(GOLD.livePrice)}/g` },
                  { label: "Certificates", val: egp(CERTS_TOTAL), sub: `${CERTS.length} certs · 19–25%` },
                  { label: "Bareeq (ABR)", val: egp(FUNDS[0].value), sub: `${FUNDS[0].units} units @ ${FUNDS[0].nav.toFixed(2)}` },
                  { label: "Real Estate (RE)", val: egp(FUNDS[1].value), sub: `${egp(FUNDS[1].units)} units @ ${FUNDS[1].nav.toFixed(2)}` },
                ].map((r) => (
                  <div key={r.label}>
                    <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#ddd" }}>{r.val} <span style={{ fontSize: 9, color: "#444" }}>EGP</span></div>
                    <div style={{ fontSize: 10, color: "#444" }}>{r.sub}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* CERTIFICATES card */}
          <Card
            onClick={() => toggle("certs")}
            expanded={isOpen("certs")}
            style={{
              flex: isOpen("certs") ? 4 : 2,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingRight: 20 }}>
              <Award size={14} style={{ color: "#00b69b" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ccc" }}>Bank Certificates</span>
              <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>
                {egp(CERTS_TOTAL)} EGP · {CERTS.length} certs
              </span>
            </div>

            {/* Top 5 certs always visible */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(isOpen("certs") ? CERTS.slice(0, 12) : CERTS.slice(0, 4)).map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6,
                      background: `${daysColor(c.daysLeft)}22`, color: daysColor(c.daysLeft),
                      minWidth: 34, textAlign: "center",
                    }}
                  >
                    {c.daysLeft < 0 ? "DUE" : `${c.daysLeft}d`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#bbb", fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "#444" }}>{c.maturity} · {c.rate}%</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textAlign: "right" }}>
                    {egp(c.value)}
                    <span style={{ fontSize: 9, color: "#444" }}> EGP</span>
                  </div>
                </div>
              ))}
              {!isOpen("certs") && CERTS.length > 4 && (
                <div style={{ fontSize: 10, color: "#444", textAlign: "center", marginTop: 4 }}>
                  +{CERTS.length - 4} more — click to expand
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── MIDDLE COLUMN (flex: 4) ── */}
        <div style={{ flex: 4, display: "flex", flexDirection: "column", gap: GAP, minWidth: 0 }}>

          {/* GOLD card */}
          <Card
            onClick={() => toggle("gold")}
            expanded={isOpen("gold")}
            style={{
              flex: isOpen("gold") ? 3 : 2,
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* gold glow */}
            <div style={{
              position: "absolute", right: -20, top: -20,
              width: 120, height: 120, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,200,66,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingRight: 20 }}>
                <span style={{ fontSize: 18 }}>🥇</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#ccc" }}>Gold {GOLD.grams}g · {GOLD.karat}</div>
                  <div style={{ fontSize: 10, color: "#555" }}>Live: {egp(GOLD.livePrice)} EGP/g</div>
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#f5c842", letterSpacing: "-0.8px" }}>
                {egp(GOLD.marketValue)}
                <span style={{ fontSize: 13, color: "#665a20", fontWeight: 400, marginLeft: 4 }}>EGP</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <PnlBadge pnl={GOLD.pnl} pct={GOLD.pnlPct} />
              </div>
            </div>

            {isOpen("gold") && (
              <div style={{ marginTop: 14, borderTop: "1px solid #222", paddingTop: 14, animation: "fadeIn 0.25s" }}>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Purchase History
                </div>
                {GOLD.bars.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < GOLD.bars.length - 1 ? "1px solid #1e1e1e" : "none" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#bbb", fontWeight: 600 }}>{b.qty}× {b.weight} bar{b.qty > 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 10, color: "#444" }}>{b.date} · fee {b.fee}/g</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textAlign: "right" }}>
                      {egp(b.spot)}/g
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                  <span style={{ fontSize: 10, color: "#444" }}>Avg cost/g</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>{egp(GOLD.avgCost)}</span>
                </div>
              </div>
            )}
          </Card>

          {/* FUND cards */}
          {FUNDS.map((f) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.key}
                onClick={() => toggle(f.key)}
                expanded={isOpen(f.key)}
                style={{
                  flex: isOpen(f.key) ? 2.5 : 1.5,
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingRight: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    background: `${f.color}22`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={16} style={{ color: f.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ccc" }}>{f.name} <span style={{ color: "#444" }}>({f.ticker})</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: f.color, letterSpacing: "-0.5px", marginTop: 2 }}>
                      {egp(f.value)}
                      <span style={{ fontSize: 11, color: "#444", fontWeight: 400, marginLeft: 3 }}>EGP</span>
                    </div>
                    <PnlBadge pnl={f.pnl} pct={f.pnlPct} />
                  </div>
                </div>

                {isOpen(f.key) && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #222", paddingTop: 12, animation: "fadeIn 0.25s" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Units Held", val: egp(f.units) },
                        { label: "NAV / unit", val: `${f.nav.toFixed(f.key === "abr" ? 2 : 4)} EGP` },
                        { label: "Cost Basis", val: `${egp(f.cost)} EGP` },
                        { label: "P&L", val: `${f.pnl >= 0 ? "+" : ""}${egp(f.pnl)} EGP` },
                      ].map((r) => (
                        <div key={r.label}>
                          <div style={{ fontSize: 9, color: "#444", marginBottom: 2, textTransform: "uppercase", fontWeight: 700 }}>{r.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>{r.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* ── RIGHT COLUMN (flex: 3) ── */}
        <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: GAP, minWidth: 0 }}>

          {/* TRANSACTIONS card */}
          <Card
            onClick={() => toggle("txs")}
            expanded={isOpen("txs")}
            style={{
              flex: 3,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingRight: 20 }}>
              <Activity size={13} style={{ color: "#7c6af5" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ccc" }}>Recent Transactions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflowY: "auto" }}>
              {TXS.map((tx, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    borderBottom: i < TXS.length - 1 ? "1px solid #1e1e1e" : "none",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: "#222", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>
                    {assetIcon[tx.asset]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tx.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tx.meta}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ff6b6b" }}>
                      -{egp(tx.amount)}
                    </div>
                    <div style={{ fontSize: 9, color: "#444" }}>{tx.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* WALLET HEALTH card */}
          <Card
            onClick={() => toggle("health")}
            expanded={isOpen("health")}
            style={{
              flex: isOpen("health") ? 2.5 : 2,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingRight: 20 }}>
              <Shield size={13} style={{ color: "#f97316" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ccc" }}>Wallet Health</span>
              <span
                style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6,
                  background: "rgba(249,115,22,0.15)", color: "#f97316", marginLeft: "auto",
                }}
              >
                AT RISK
              </span>
            </div>

            {/* Score gauge — simple arc */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ position: "relative", width: 64, height: 36, flexShrink: 0 }}>
                <svg width="64" height="36" viewBox="0 0 64 36">
                  <path d="M 4 34 A 28 28 0 0 1 60 34" fill="none" stroke="#222" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M 4 34 A 28 28 0 0 1 60 34"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(HEALTH.score / 100) * 88} 88`}
                  />
                </svg>
                <div style={{
                  position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                  fontSize: 16, fontWeight: 900, color: "#f97316",
                }}>
                  {HEALTH.score}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#444" }}>out of 100</div>
              </div>
            </div>

            {isOpen("health") && (
              <div style={{ marginTop: 12, borderTop: "1px solid #222", paddingTop: 12, animation: "fadeIn 0.25s" }}>
                {[
                  { label: "Diversity", val: HEALTH.diversity },
                  { label: "Emergency Fund", val: HEALTH.emergencyFund },
                  { label: "Yield Rate", val: HEALTH.yieldRate },
                  { label: "Liquidity", val: HEALTH.liquidity },
                ].map((h) => (
                  <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#555", width: 90, flexShrink: 0 }}>{h.label}</div>
                    <MiniBar value={h.val} max={100} color={healthColor(h.val)} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: healthColor(h.val), width: 28, textAlign: "right", flexShrink: 0 }}>
                      {h.val}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        * { box-sizing: border-box; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
