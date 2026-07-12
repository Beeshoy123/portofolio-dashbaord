import { useEffect } from 'react';
import './portfolio.css';

const DASHBOARD_HTML = `
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

<div class="live-bar" id="live-bar" style="display:none">
  <span class="live-dot err" id="dot-gold"></span>
  <span class="live-pill">Gold 24K: <b id="live-gold">8,000</b> EGP/g <span id="gold-status" class="status-badge status-fallback">fallback</span></span>
  <span class="live-dot err" id="dot-usd"></span>
  <span class="live-pill">USD/EGP: <b id="live-usd">49.23</b> <span id="usd-status" class="status-badge status-fallback">fallback</span></span>
  <span class="live-time" id="live-time"></span>
</div>

<div class="bento">

  <!-- ① HERO TOTAL -->
  <div class="card dark s-4" style="padding:26px 28px" data-view-card="hero">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="card-lbl">Total Portfolio Value <span class="info-icon" onclick="toggleMath('math-total')" title="Show calculation">ℹ</span></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a7a74;margin-top:10px;margin-bottom:4px">Total Balance · EGP</div>
        <div style="font-family:'Sora',sans-serif;font-size:50px;font-weight:800;line-height:1;letter-spacing:-.02em" id="s-total">390,036 EGP</div>
        <div style="font-size:12px;font-weight:600;margin-top:10px;color:var(--teal)" id="s-total-chg" class="neg">▲ +13,896 vs cost (+3.7%)</div>
        <div class="math-section" id="math-total">
          <div class="math-line"><span class="math-label">Gold:</span><span class="math-calc">20g × 8,000 EGP/g</span><span class="math-result">= 160,000 EGP</span></div>
          <div class="math-line"><span class="math-label">Bareeq:</span><span class="math-calc">72 certs × 207.80</span><span class="math-result">= 14,962 EGP</span></div>
          <div class="math-line"><span class="math-label">Real Estate:</span><span class="math-calc">2656 × 1.91</span><span class="math-result">= 5,074 EGP</span></div>
          <div class="math-line"><span class="math-label">Certificates:</span><span id="math-cert-calc" class="math-calc">25 certs · weighted avg —%</span><span class="math-result">= 210,000 EGP</span></div>
          <div class="math-divider"></div>
          <div class="math-line math-total"><span class="math-label">Total Value:</span><span class="math-calc"></span><span class="math-result">390,036 EGP</span></div>
          <div class="math-line"><span class="math-label">Total Cost:</span><span class="math-calc"></span><span class="math-result">376,140 EGP</span></div>
          <div class="math-line math-total"><span class="math-label">P&amp;L:</span><span class="math-calc"></span><span class="math-result">+13,896 (+3.7%)</span></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:#5a7a74;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:4px">Live Rates</div>
        <div style="font-size:11px;color:#c8d4cf;line-height:1.9" id="rate-box">Gold: 8,000 EGP/g<br>USD/EGP: 49.23</div>
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
      <div style="font-family:Sora,sans-serif;font-size:28px;font-weight:800;color:var(--teal)" id="gold-pnl" class="neg">+14,370 EGP</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px;color:var(--teal)" class="neg" id="gold-pnl-pct">+9.4% · +570 cashback</div>
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
        <div class="pnl-row"><div><div class="pnl-row-name">🥇 Gold 24K</div><div class="pnl-row-sub">20g physical</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:var(--teal)">+13,800 EGP</div><div style="font-size:9.5px;color:var(--teal);font-weight:600">+9.4%</div></div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">🏦 Bareeq</div><div class="pnl-row-sub">ABR · money market</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:var(--teal)">+42 EGP</div><div style="font-size:9.5px;color:var(--teal);font-weight:600">+0.3%</div></div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">🏢 Real Est.</div><div class="pnl-row-sub">BRE · property fund</div></div><div style="text-align:right"><div class="pnl-row-val" style="color:var(--teal)">+54 EGP</div><div style="font-size:9.5px;color:var(--teal);font-weight:600">+1.1%</div></div></div>
        <div class="pnl-row"><div><div class="pnl-row-name">📜 Certificates</div><div class="pnl-row-sub">NBE · interest income</div></div><div style="text-align:right"><div class="pnl-row-val" id="cert-pnl-val" style="color:var(--teal)">+0 EGP/yr</div><div style="font-size:9.5px;color:var(--teal);font-weight:600" id="cert-pnl-pct">+0.0% APY</div></div></div>
      </div>
      <div class="math-section" id="math-gold">
        <div class="math-line"><span class="math-label">Current Value:</span><span class="math-calc">20g × 8,000 EGP/g</span><span class="math-result">= 160,000 EGP</span></div>
        <div class="math-line"><span class="math-label">Cost Basis:</span><span class="math-calc">20g × 7,310 EGP/g</span><span class="math-result">= 146,200 EGP</span></div>
        <div class="math-line"><span class="math-label">Raw P&amp;L:</span><span class="math-calc">160,000 - 146,200</span><span class="math-result">+13,800 EGP</span></div>
        <div class="math-line"><span class="math-label">BTC Cashback:</span><span class="math-calc">20g × 28.5 EGP/g</span><span class="math-result">= +570 EGP</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total"><span class="math-label">Net P&amp;L:</span><span class="math-calc">raw + cashback</span><span class="math-result">+14,370 (+9.4%)</span></div>
      </div>
    </div>

    <!-- YIELD VIEW -->
    <div id="perf-yield" style="display:none">
      <div style="font-size:22px;margin-bottom:6px">💹</div>
      <div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:800" id="s-yield" class="pos">+286.8 EGP/mo</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:5px" class="neu" id="yield-sub">ABR 23% + NBE certs</div>
      <div class="math-section" id="math-yield">
        <div class="math-line"><span class="math-label">Bareeq:</span><span class="math-calc">14,962 × 23% ÷ 12</span><span class="math-result">= 286.77 EGP/mo</span></div>
        <div class="math-line"><span class="math-label">NBE Certs:</span><span id="yield-cert-calc" class="math-calc">25 certs · weighted avg</span><span id="yield-cert-result" class="math-result">= — EGP/mo</span></div>
        <div class="math-divider"></div>
        <div class="math-line math-total"><span class="math-label">Total Yield:</span><span class="math-calc"></span><span id="yield-total-result" class="math-result">— EGP/mo</span></div>
      </div>
    </div>

    <!-- GROWTH VIEW -->
    <div id="perf-growth" style="display:none">
      <div style="margin-bottom:10px">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)">Savings Growth · Month over Month</div>
        <div style="font-family:'Sora',sans-serif;font-size:26px;font-weight:800;margin-top:4px" id="growth-latest" class="pos">14,962 EGP</div>
        <div style="font-size:10.5px;color:var(--teal);margin-top:2px" id="growth-delta">▲ +5,026 EGP (+50.6%) vs last month</div>
      </div>
      <div style="position:relative;width:100%">
        <svg id="sparkline-svg" width="100%" height="90" viewBox="0 0 300 90" preserveAspectRatio="none" style="overflow:visible;display:block">
          <defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f6a5e" stop-opacity=".5"></stop><stop offset="100%" stop-color="#0f6a5e" stop-opacity="0"></stop></linearGradient></defs>
          <path id="spark-fill" d="M 8 78 C 150 78, 150 14, 292 14 L 292 90 L 8 90 Z" fill="url(#sparkGrad)"></path>
          <path id="spark-line" d="M 8 78 C 150 78, 150 14, 292 14" fill="none" stroke="#0f6a5e" stroke-width="2.5" stroke-linecap="round"></path>
          <circle id="spark-dot" cx="292" cy="14" r="4" fill="#0f6a5e"></circle>
        </svg>
        <div id="spark-labels" style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:9px;color:var(--dim);font-weight:600">Jun 26</span>
          <span style="font-size:9px;color:var(--dim);font-weight:600">Jul 26</span>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--edge);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:9.5px;color:var(--dim)" id="growth-snapcount">2 snapshots</div>
        <button onclick="saveGrowthSnapshot()" style="border:none;background:var(--teal-soft);color:var(--teal);border-radius:8px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer">+ Save Snapshot</button>
      </div>
    </div>
  </div>

  <!-- ③ WALLET HEALTH -->
  <div class="card dark s-2" data-view-card="health">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-lbl">Wallet Health <span class="info-icon" onclick="toggleMath('math-health')" title="Show calculation">ℹ</span></div>
      <div class="wh-grade" id="wh-grade">Needs attention</div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <div style="flex-shrink:0">
        <div style="font-family:'Sora',sans-serif;font-size:52px;font-weight:800;line-height:1;color:#e8eaed" id="wh-arc-score">33</div>
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
        <circle id="ring-div" cx="65" cy="65" r="55" fill="none" stroke="url(#rg1)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 259.2" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-ef" cx="65" cy="65" r="43" fill="none" stroke="url(#rg2)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 202.6" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-yield" cx="65" cy="65" r="31" fill="none" stroke="url(#rg3)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 146.1" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
        <circle id="ring-liq" cx="65" cy="65" r="19" fill="none" stroke="url(#rg4)" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 89.5" transform="rotate(-210 65 65)" style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.2,.64,1)"></circle>
      </svg>
    </div>
    <div class="wh-metrics">
      <div class="wh-metric"><span class="wh-dot" style="background:#e05a50"></span><span class="wh-mname">Diversity</span><div class="wh-track"><div class="wh-fill" id="wh-div" style="width:0%"></div></div><span class="wh-mval" id="wh-div-v" style="color:#d99a2b">59</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname">Emergency fund</span><div class="wh-track"><div class="wh-fill" id="wh-ef" style="width:0%"></div></div><span class="wh-mval" id="wh-ef-v" style="color:#e05a50">25</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#3dae6e"></span><span class="wh-mname">Yield rate</span><div class="wh-track"><div class="wh-fill" id="wh-yield-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-yield-v" style="color:#d99a2b">43</span></div>
      <div class="wh-metric"><span class="wh-dot" style="background:#d99a2b"></span><span class="wh-mname">Liquidity</span><div class="wh-track"><div class="wh-fill" id="wh-liq-bar" style="width:0%"></div></div><span class="wh-mval" id="wh-liq-v" style="color:#e05a50">4</span></div>
    </div>
    <div class="math-section" id="math-health">
      <div class="math-line"><span class="math-label">Diversity:</span><span class="math-calc">100 - 41.0% gold conc.</span><span class="math-result">= 59</span></div>
      <div class="math-line"><span class="math-label">Emergency Fund:</span><span class="math-calc">14,962 ÷ 60,000</span><span class="math-result">= 25</span></div>
      <div class="math-line"><span class="math-label">Yield Rate:</span><span class="math-calc">11.6% blended ÷ 27% benchmark</span><span class="math-result">= 43</span></div>
      <div class="math-line"><span class="math-label">Liquidity:</span><span class="math-calc">14,962 liquid ÷ 390,036 total</span><span class="math-result">= 4%</span></div>
      <div class="math-divider"></div>
      <div class="math-line math-total"><span class="math-label">Average:</span><span class="math-calc">(59+25+43+4) ÷ 4</span><span class="math-result">= 33</span></div>
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
          <circle cx="32" cy="32" r="28" fill="none" stroke="#b8893f" stroke-width="9" stroke-dasharray="70.06 175.93" stroke-dashoffset="0" transform="rotate(-90 32 32)"></circle>
          <circle cx="32" cy="32" r="28" fill="none" stroke="#0f6a5e" stroke-width="9" stroke-dasharray="4.64 175.93" stroke-dashoffset="-72.17" transform="rotate(-90 32 32)"></circle>
          <circle cx="32" cy="32" r="28" fill="none" stroke="#e05a50" stroke-width="9" stroke-dasharray="0.18 175.93" stroke-dashoffset="-78.92" transform="rotate(-90 32 32)"></circle>
          <circle cx="32" cy="32" r="28" fill="none" stroke="#8b6fb0" stroke-width="9" stroke-dasharray="92.61 175.93" stroke-dashoffset="-81.21" transform="rotate(-90 32 32)"></circle>
        </svg>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex:1">
        <div class="dl-row"><span class="dl-dot" style="background:#b8893f"></span><span class="dl-name">Gold 24K</span><span class="dl-pct" id="pct-gold">41.0%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#0f6a5e"></span><span class="dl-name">Bareeq</span><span class="dl-pct" id="pct-abr">3.8%</span></div>
        <div class="dl-row"><span class="dl-dot" style="background:#e05a50"></span><span class="dl-name">Real Estate</span><span class="dl-pct" id="pct-re">1.3%</span></div>
        <div class="dl-row" id="row-cert" style="display:flex"><span class="dl-dot" style="background:#8b6fb0"></span><span class="dl-name">Certificates</span><span class="dl-pct" id="pct-cert">53.8%</span></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0">
      <div class="seg-row"><div class="seg-icon" style="background:var(--gold-soft)">🥇</div><div class="seg-body"><div class="seg-name">Gold 24K · 20g</div><div class="seg-meta" id="gold-sub">Avg cost 7,310 · Mkt 8,000/g</div></div><div class="seg-right"><div class="seg-val" id="seg-gold-val">160,000</div><div class="seg-pct" id="seg-gold-pct" style="color:var(--teal)">+9.4%</div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--teal-soft)">🏦</div><div class="seg-body"><div class="seg-name">Bareeq Fund</div><div class="seg-meta" id="abr-sub">23% APY · 72 certs @ <span id="abr-nav-lbl">207.80</span></div></div><div class="seg-right"><div class="seg-val" id="seg-abr-val">14,962</div><div class="seg-pct pos">+0.05% today</div></div></div>
      <div class="seg-row"><div class="seg-icon" style="background:var(--coral-soft)">🏢</div><div class="seg-body"><div class="seg-name">Beltone Real Estate</div><div class="seg-meta">2,656 certs @ <span id="re-nav-lbl">1.91</span></div></div><div class="seg-right"><div class="seg-val" id="seg-re-val">5,074</div><div class="seg-pct" style="color:var(--coral)">-3.94% vs cost</div></div></div>
      <div class="seg-row" id="seg-cert-row" style="display:flex"><div class="seg-icon" style="background:#ece7f4">📜</div><div class="seg-body"><div class="seg-name">NBE Certificates</div><div class="seg-meta" id="cert-sub">25 NBE certs · avg 19.6% APY</div></div><div class="seg-right"><div class="seg-val" id="seg-cert-val">210,000</div><div class="seg-pct" id="seg-cert-pct" style="color:var(--teal)">+3,357/mo</div></div></div>
    </div>
    <div class="math-section" id="alloc-detail" style="margin-top:auto">
      <div id="alloc-detail-text" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">Gold at 41% is above the recommended 30% max for a single asset. Consider diversifying into liquid instruments or additional certificates to rebalance.</div>
    </div>
  </div>

  <!-- ⑤ EMERGENCY FUND PROGRESS -->
  <div class="card s-2" data-view-card="progress">
    <div class="card-lbl">Emergency Fund · Bareeq Target <span class="info-icon" onclick="toggleMath('abr-detail')" title="Show pace details">ℹ</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
      <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800" id="abr-prog-val">14,962 EGP</div>
      <div style="font-size:10px;color:var(--dim);font-weight:600" id="abr-prog-pct-label">24.9% of 60k</div>
    </div>
    <div class="prog-track"><div class="prog-fill" id="abr-prog-bar" style="width:0%"></div></div>
    <div class="prog-labels">
      <span id="abr-prog-pct">24.9%</span>
      <span id="abr-prog-left-label" style="color:var(--dim)">45,038 EGP to go</span>
    </div>
    <div class="math-section" id="abr-detail" style="margin-top:10px">
      <div id="abr-note" style="padding:2px 4px;line-height:1.5;font-size:11px;color:var(--ink)">📈 Yield only: ~158 months · add monthly deposits to go faster</div>
    </div>
  </div>

  <!-- ⑥ HOLDINGS HEATMAP -->
  <div class="card s-2" data-view-card="heatmap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="card-lbl" id="heatmap-label">Holdings Heatmap</div>
      <div style="font-size:9px;color:var(--dim)">size = value · color = return</div>
    </div>
    <div id="heatmap-container" style="width:100%;aspect-ratio:1/1;position:relative;border-radius:8px;overflow:hidden">
      <div class="hm-cell" id="hm-cert-cell" style="left:3px;top:3px;width:43%;height:50%;background:#e07060;animation-delay:0ms"><div class="hm-name">Certificates</div><div class="hm-pct" id="hm-cert-pct">+0.0%</div></div>
      <div class="hm-cell" style="left:47%;top:3px;width:50%;height:44%;background:#1a6b5a;animation-delay:80ms"><div class="hm-name">Gold 24K</div><div class="hm-pct">+9.4%</div></div>
      <div class="hm-cell" style="left:47%;top:49%;width:37%;height:48%;background:#2a8a70;animation-delay:160ms"><div class="hm-name">Bareeq</div><div class="hm-pct">+0.3%</div></div>
      <div class="hm-cell" style="left:86%;top:49%;width:11%;height:48%;background:#1a6b5a;animation-delay:240ms"><div class="hm-name" style="font-size:8px">RE</div><div class="hm-pct" style="font-size:8px">+1.1%</div></div>
      <div class="hm-cell" id="hm-cert2-cell" style="left:3px;top:55%;width:43%;height:42%;background:#8b50a0;animation-delay:40ms"><div class="hm-name">Certificates</div><div class="hm-pct" id="hm-cert2-pct">NBE 25</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
      <span style="font-size:9px;color:var(--dim)">Loss</span>
      <div style="flex:1;height:6px;border-radius:3px;background:linear-gradient(90deg,#c94035,#e07060,#c8c0b0,#2a8a70,#1a6b5a)"></div>
      <span style="font-size:9px;color:var(--dim)">Gain</span>
    </div>
  </div>

  <!-- ⑦ DCA CALCULATOR -->
  <div class="card s-2 r-2" data-view-card="dca">
    <div class="card-lbl">⚖️ DCA Calculator</div>
    <p class="dca-sub">Calculate how much to invest monthly to reach your target.</p>
    <div class="dca-inputs">
      <div class="dca-field"><label>Target Amount (EGP)</label><input type="number" id="dca-target" value="60000" step="1000"></div>
      <div class="dca-field"><label>Current Balance (EGP)</label><input type="number" id="dca-current" value="9940" step="100"></div>
      <div class="dca-field"><label>Expected APY (%)</label><input type="number" id="dca-apy" value="23" step="0.1"></div>
      <div class="dca-field"><label>Timeframe (Months)</label><input type="number" id="dca-months" value="24" step="1"></div>
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="calcDCA()">Calculate</button>
    <div class="dca-divider"></div>
    <div class="dca-results">
      <div class="dca-result-card"><div class="dca-result-lbl">Monthly Investment</div><div class="dca-result-val pos" id="dca-monthly">—</div><div class="dca-result-sub neu" id="dca-monthly-sub">per month</div></div>
      <div class="dca-result-card"><div class="dca-result-lbl">Total Invested</div><div class="dca-result-val" id="dca-invested">—</div><div class="dca-result-sub neu" id="dca-invested-sub">principal</div></div>
      <div class="dca-result-card"><div class="dca-result-lbl">Interest Earned</div><div class="dca-result-val pos" id="dca-interest">—</div><div class="dca-result-sub neu" id="dca-interest-sub">compound gain</div></div>
      <div class="dca-result-card"><div class="dca-result-lbl">Final Balance</div><div class="dca-result-val" id="dca-final">—</div><div class="dca-result-sub neu" id="dca-final-sub">at end</div></div>
    </div>
    <div class="note-chip" style="margin-top:14px" id="dca-note">ℹ️ This assumes constant monthly deposits with compound interest.</div>
  </div>

</div><!-- /bento -->

<!-- CERTIFICATES DETAIL -->
<div id="certs-placeholder" style="display:none;margin-top:var(--gap)">
  <div class="card dark" style="padding:26px 28px;margin-bottom:var(--gap)">
    <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5a7a74;margin-bottom:4px">NBE Certificates · Total Principal</div>
    <div style="font-family:'Sora',sans-serif;font-size:46px;font-weight:800;line-height:1;color:#e8eaed">210,000 <span style="font-size:20px;color:#5a7a74">EGP</span></div>
    <div style="display:flex;gap:20px;margin-top:14px;flex-wrap:wrap">
      <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Certificates</div><div style="font-size:16px;font-weight:800;color:#e8eaed">25</div></div>
      <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Annual Yield</div><div style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-annual-yield">41,160 EGP</div></div>
      <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Monthly Yield</div><div style="font-size:16px;font-weight:800;color:#3dae6e" id="cert-monthly-yield">3,430 EGP</div></div>
      <div><div style="font-size:9px;color:#5a7a74;text-transform:uppercase;letter-spacing:.06em">Maturing in 90d</div><div style="font-size:16px;font-weight:800;color:#d99a2b" id="cert-maturing-soon">3 certs</div></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)">
    <div class="card"><div class="card-lbl" style="margin-bottom:12px">Maturity Timeline</div><div id="cert-timeline"></div></div>
    <div class="card"><div class="card-lbl" style="margin-bottom:12px">By Interest Rate</div><div id="cert-rate-breakdown"></div></div>
  </div>
  <div class="card" style="margin-top:var(--gap)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="card-lbl">All Certificates · NBE</div>
      <div style="font-size:9.5px;color:var(--teal);font-weight:700" id="cert-avg-rate">Avg — APY</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      <button class="chip active" id="cert-chip-all" onclick="filterCerts('all')">All 25</button>
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
          <tr><td><div class="ah-asset-name">Gold 24K</div><div class="ah-asset-sub">20g physical</div></td><td>160,000.00</td><td style="color:var(--dim)">~146,200</td><td style="color:var(--teal)">+9.44%</td></tr>
          <tr><td><div class="ah-asset-name">Bareeq Fund</div><div class="ah-asset-sub">ABR · 72 certs</div></td><td>14,961.79</td><td style="color:var(--dim)">~14,920</td><td style="color:var(--teal)">+0.28%</td></tr>
          <tr><td><div class="ah-asset-name">Beltone Real Estate Fund</div><div class="ah-asset-sub">BRE · 2,656 certs</div></td><td>5,073.94</td><td style="color:var(--dim)">~5,020</td><td style="color:var(--teal)">+1.08%</td></tr>
          <tr><td><div class="ah-asset-name">NBE Certificates</div><div class="ah-asset-sub">Fixed · 25 certs</div></td><td>210,000.00</td><td style="color:var(--dim)">~210,000</td><td id="cert-return-cell" style="color:var(--teal)">+0.00%</td></tr>
          <tr style="border-top:2px solid var(--edge)"><td><div class="ah-asset-name" style="color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em">Total</div></td><td style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px">390,035.73</td><td style="color:var(--dim);font-weight:700">~376,140</td><td style="color:var(--teal);font-weight:800">+3.69%</td></tr>
        </tbody>
      </table>
    </div>
    <div id="panel-transactions" style="display:none">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        <button class="chip active" id="chip-all" onclick="filterTx('all')">All</button>
        <button class="chip" id="chip-gold" onclick="filterTx('gold')">🥇 Gold</button>
        <button class="chip" id="chip-abr" onclick="filterTx('abr')">🏦 Bareeq</button>
        <button class="chip" id="chip-re" onclick="filterTx('re')">🏢 Real Estate</button>
      </div>
      <div id="tx-list">
        <div class="tx-entry" data-type="abr"><div class="tx-entry-icon" style="background:var(--teal-soft)">🏦</div><div class="tx-entry-body"><div class="tx-entry-name">Bareeq Fund</div><div class="tx-entry-meta">Sat 05 Jul 2026 · 12:09 PM · 24 units @ EGP 207.695</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--teal)">+4,984.80</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="abr"><div class="tx-entry-icon" style="background:var(--teal-soft)">🏦</div><div class="tx-entry-body"><div class="tx-entry-name">Bareeq Fund</div><div class="tx-entry-meta">Fri 26 Jun 2026 · 11:20 AM · 48 units @ EGP 206.988</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--teal)">+9,935.52</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="re"><div class="tx-entry-icon" style="background:var(--coral-soft)">🏢</div><div class="tx-entry-body"><div class="tx-entry-name">Beltone Real Estate Fund</div><div class="tx-entry-meta">Tue 16 Jun 2026 · 01:40 PM · 2,656 units @ EGP 1.888</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--teal)">+5,019.84</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="gold"><div class="tx-entry-icon" style="background:var(--gold-soft)">🥇</div><div class="tx-entry-body"><div class="tx-entry-name">Gold 24K — 5g bar</div><div class="tx-entry-meta">Sat 17 Apr 2026 · 09:00 AM · 1 bar × 5g · avg 8,140 EGP/g</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--coral)">40,700.00</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="gold"><div class="tx-entry-icon" style="background:var(--gold-soft)">🥇</div><div class="tx-entry-body"><div class="tx-entry-name">Gold 24K — 5g bar</div><div class="tx-entry-meta">Thu 02 Apr 2026 · 03:15 PM · 1 bar × 5g · avg 7,740 EGP/g</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--coral)">38,700.00</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="gold"><div class="tx-entry-icon" style="background:var(--gold-soft)">🥇</div><div class="tx-entry-body"><div class="tx-entry-name">Gold 24K — 5g bar</div><div class="tx-entry-meta">Mon 16 Mar 2026 · 11:00 AM · 1 bar × 5g · avg 7,280 EGP/g</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--coral)">36,400.00</div><div class="tx-entry-badge">BUY</div></div></div>
        <div class="tx-entry" data-type="gold"><div class="tx-entry-icon" style="background:var(--gold-soft)">🥇</div><div class="tx-entry-body"><div class="tx-entry-name">Gold 24K — 5g bar</div><div class="tx-entry-meta">Mon 16 Mar 2026 · 10:00 AM · 1 bar × 5g · avg 6,080 EGP/g</div></div><div class="tx-entry-right"><div class="tx-entry-amount" style="color:var(--coral)">30,400.00</div><div class="tx-entry-badge">BUY</div></div></div>
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
      <div class="insight-item"><div class="insight-icon">⚠️</div><div><div class="insight-title">High Gold Concentration</div><div class="insight-desc">Gold represents 41% of your portfolio — above the recommended 30% max. Consider rebalancing into liquid instruments.</div></div></div>
      <div class="insight-item"><div class="insight-icon">💧</div><div><div class="insight-title">Low Liquidity (4%)</div><div class="insight-desc">Only 14,962 EGP (3.8%) is liquid. Consider keeping at least 15–20% in liquid assets for emergencies.</div></div></div>
      <div class="insight-item"><div class="insight-icon">📈</div><div><div class="insight-title">Emergency Fund at 25%</div><div class="insight-desc">Your Bareeq balance covers 25% of the 60,000 EGP target. At current yield-only growth, ~158 months to reach it. Monthly deposits will accelerate this significantly.</div></div></div>
      <div class="insight-item"><div class="insight-icon">🏆</div><div><div class="insight-title">Gold Performance</div><div class="insight-desc">Your gold position is up +9.4% (14,370 EGP including BTC cashback). This is your strongest performing asset.</div></div></div>
      <div class="insight-item"><div class="insight-icon">💹</div><div><div class="insight-title">Certificate Yield</div><div class="insight-desc" id="insight-cert-desc">Your 25 NBE certificates generate yield monthly — reinvesting into Bareeq would compound growth.</div></div></div>
    </div>
  </div>
</div>

<!-- NAV EDITOR MODAL -->
<div class="modal-overlay" id="nav-modal">
  <div class="modal">
    <h2>✏️ Update NAVs</h2>
    <p>Enter the latest fund NAVs from your app. Values are saved to this browser and restored on next visit.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="modal-field"><label>Bareeq NAV (EGP/cert)</label><input type="number" id="input-abr-nav" step="0.0001" placeholder="e.g. 207.80"></div>
      <div class="modal-field"><label>Bareeq Certs held</label><input type="number" id="input-abr-certs" step="1" placeholder="e.g. 72"></div>
      <div class="modal-field"><label>Real Estate NAV</label><input type="number" id="input-re-nav" step="0.0001" placeholder="e.g. 1.91"></div>
      <div class="modal-field"><label>Real Estate Certs</label><input type="number" id="input-re-certs" step="1" placeholder="e.g. 2656"></div>
      <div class="modal-field"><label>Gold Price (EGP/g)</label><input type="number" id="input-gold-price" step="10" placeholder="e.g. 8000"></div>
      <div class="modal-field"><label>Gold Grams held</label><input type="number" id="input-gold-grams" step="1" placeholder="e.g. 20"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-cancel" onclick="closeNav()">Cancel</button>
      <button class="btn btn-primary" onclick="applyNavs()">Apply &amp; Recalculate</button>
    </div>
  </div>
</div>

<footer>Last updated: <span id="last-updated"></span> · Prices via open APIs · Funds: manual NAV</footer>

</div><!-- /dashboard-root -->
`;

function initDashboard() {
  // ── State ────────────────────────────────────────────────────────────
  let currentView = 'total';
  let currentPerf = 'pnl';
  let currentSortKey: string | null = null;
  let sortDesc = false;
  let scanMode: string | null = null;
  let scanResult: Record<string, unknown> | null = null;

  const CERTS_DATA = [
    { name: 'NBE Cert #1',  value: 10000, rate: 20, maturity: '2026-09-15', monthly: 167 },
    { name: 'NBE Cert #2',  value: 10000, rate: 20, maturity: '2026-10-01', monthly: 167 },
    { name: 'NBE Cert #3',  value: 10000, rate: 19, maturity: '2026-11-10', monthly: 158 },
    { name: 'NBE Cert #4',  value: 8000,  rate: 19, maturity: '2026-11-20', monthly: 127 },
    { name: 'NBE Cert #5',  value: 8000,  rate: 19, maturity: '2026-12-05', monthly: 127 },
    { name: 'NBE Cert #6',  value: 10000, rate: 20, maturity: '2027-01-15', monthly: 167 },
    { name: 'NBE Cert #7',  value: 10000, rate: 20, maturity: '2027-01-15', monthly: 167 },
    { name: 'NBE Cert #8',  value: 8000,  rate: 19, maturity: '2027-02-10', monthly: 127 },
    { name: 'NBE Cert #9',  value: 8000,  rate: 19, maturity: '2027-02-10', monthly: 127 },
    { name: 'NBE Cert #10', value: 10000, rate: 20, maturity: '2027-03-01', monthly: 167 },
    { name: 'NBE Cert #11', value: 10000, rate: 20, maturity: '2027-03-01', monthly: 167 },
    { name: 'NBE Cert #12', value: 8000,  rate: 19, maturity: '2027-04-15', monthly: 127 },
    { name: 'NBE Cert #13', value: 8000,  rate: 19, maturity: '2027-04-15', monthly: 127 },
    { name: 'NBE Cert #14', value: 10000, rate: 20, maturity: '2027-05-01', monthly: 167 },
    { name: 'NBE Cert #15', value: 10000, rate: 20, maturity: '2027-05-01', monthly: 167 },
    { name: 'NBE Cert #16', value: 8000,  rate: 18, maturity: '2027-06-10', monthly: 120 },
    { name: 'NBE Cert #17', value: 8000,  rate: 18, maturity: '2027-06-10', monthly: 120 },
    { name: 'NBE Cert #18', value: 10000, rate: 20, maturity: '2027-07-01', monthly: 167 },
    { name: 'NBE Cert #19', value: 10000, rate: 20, maturity: '2027-07-01', monthly: 167 },
    { name: 'NBE Cert #20', value: 8000,  rate: 19, maturity: '2027-08-15', monthly: 127 },
    { name: 'NBE Cert #21', value: 8000,  rate: 19, maturity: '2027-08-15', monthly: 127 },
    { name: 'NBE Cert #22', value: 10000, rate: 20, maturity: '2027-09-01', monthly: 167 },
    { name: 'NBE Cert #23', value: 10000, rate: 20, maturity: '2027-09-01', monthly: 167 },
    { name: 'NBE Cert #24', value: 8000,  rate: 20, maturity: '2027-10-15', monthly: 133 },
    { name: 'NBE Cert #25', value: 8000,  rate: 20, maturity: '2027-10-15', monthly: 133 },
  ];

  // ── Helpers ──────────────────────────────────────────────────────────
  const el = (id: string) => document.getElementById(id);
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  function updateTime() {
    const now = new Date();
    const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const lt = el('live-time'); if (lt) lt.textContent = t;
    const lu = el('last-updated'); if (lu) lu.textContent = t;
  }

  // ── View management ──────────────────────────────────────────────────
  const VIEW_CONFIG: Record<string, { label: string; cards: string[] }> = {
    total:  { label: 'All assets · full portfolio', cards: ['hero','perf','health','segments','progress','heatmap','dca','activity'] },
    gold:   { label: 'Gold 24K · physical position', cards: ['hero','perf','dca','heatmap','activity'] },
    liquid: { label: 'Liquid assets · Bareeq & funds', cards: ['hero','perf','progress','segments','activity'] },
    certs:  { label: 'NBE Certificates · fixed income', cards: ['hero','segments','progress','activity'] },
  };

  (window as Record<string, unknown>).setView = (view: string) => {
    currentView = view;
    const cfg = VIEW_CONFIG[view] || VIEW_CONFIG.total;
    el('view-label')!.textContent = cfg.label;

    // Toggle buttons
    ['total','gold','liquid','certs'].forEach(v => {
      el(`view-btn-${v}`)?.classList.toggle('active', v === view);
    });

    // Show/hide bento cards
    document.querySelectorAll('[data-view-card]').forEach(card => {
      const tags = (card.getAttribute('data-view-card') || '').split(',');
      (card as HTMLElement).style.display = tags.some(t => cfg.cards.includes(t.trim())) ? '' : 'none';
    });

    // Certs section
    const cp = el('certs-placeholder');
    if (cp) cp.style.display = view === 'certs' ? 'block' : 'none';

    // Slide the toggle slider
    const btns = ['total','gold','liquid','certs'];
    const idx = btns.indexOf(view);
    const bar = el('view-toggle-bar');
    const slider = el('view-toggle-slider');
    if (bar && slider) {
      const btnWidth = bar.offsetWidth / 4;
      slider.style.left = (3 + idx * btnWidth) + 'px';
      slider.style.width = (btnWidth - 4) + 'px';
    }
  };

  // ── Perf switch ──────────────────────────────────────────────────────
  (window as Record<string, unknown>).switchPerf = (type: string) => {
    currentPerf = type;
    ['pnl','yield','growth'].forEach(t => {
      el(`perf-${t}`)!.style.display = t === type ? 'block' : 'none';
      el(`pill-${t}`)?.classList.toggle('active', t === type);
    });
  };

  // ── Tab switch ───────────────────────────────────────────────────────
  (window as Record<string, unknown>).switchTab = (tab: string) => {
    el('panel-holdings')!.style.display = tab === 'holdings' ? 'block' : 'none';
    el('panel-transactions')!.style.display = tab === 'transactions' ? 'block' : 'none';
    el('tab-holdings')?.classList.toggle('active', tab === 'holdings');
    el('tab-transactions')?.classList.toggle('active', tab === 'transactions');
  };

  // ── Filter transactions ───────────────────────────────────────────────
  (window as Record<string, unknown>).filterTx = (type: string) => {
    ['all','gold','abr','re'].forEach(t => el(`chip-${t}`)?.classList.toggle('active', t === type));
    document.querySelectorAll('#tx-list .tx-entry').forEach(entry => {
      const dtype = entry.getAttribute('data-type') || '';
      (entry as HTMLElement).style.display = (type === 'all' || dtype === type) ? 'flex' : 'none';
    });
  };

  // ── Math toggles ─────────────────────────────────────────────────────
  (window as Record<string, unknown>).toggleMath = (id: string) => {
    const sec = el(id);
    if (sec) sec.classList.toggle('open');
  };

  (window as Record<string, unknown>).togglePerfMath = () => {
    const id = `math-${currentPerf === 'pnl' ? 'gold' : currentPerf}`;
    const sec = el(id);
    if (sec) sec.classList.toggle('open');
  };

  // ── Dark mode ────────────────────────────────────────────────────────
  (window as Record<string, unknown>).toggleDark = () => {
    document.body.classList.toggle('light');
    const knob = el('dark-toggle-knob');
    if (knob) knob.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
  };

  // ── Dismiss warning ──────────────────────────────────────────────────
  (window as Record<string, unknown>).dismissWarning = () => {
    const w = el('api-warning'); if (w) w.style.display = 'none';
  };

  // ── Refresh prices ───────────────────────────────────────────────────
  (window as Record<string, unknown>).doRefresh = async () => {
    const btn = el('refresh-btn');
    if (btn) btn.textContent = '⏳';
    el('live-bar')!.style.display = 'flex';

    // Try to fetch USD/EGP via a public CORS-friendly endpoint
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json() as { rates?: { EGP?: number } };
        const rate = data?.rates?.EGP;
        if (rate) {
          const usdEl = el('live-usd'); if (usdEl) usdEl.textContent = rate.toFixed(2);
          const dotUsd = el('dot-usd'); if (dotUsd) dotUsd.className = 'live-dot ok';
          const usdStatus = el('usd-status'); if (usdStatus) { usdStatus.textContent = 'live'; usdStatus.className = 'status-badge status-live'; }
          const w = el('api-warning'); if (w) w.style.display = 'none';
        }
      }
    } catch (_) { /* CORS or network — keep fallback */ }

    if (btn) btn.textContent = '🔄';
    updateTime();
  };

  // ── Sort menu ────────────────────────────────────────────────────────
  (window as Record<string, unknown>).toggleSortMenu = (e: MouseEvent) => {
    e.stopPropagation();
    const pop = el('pnl-sort-popover');
    if (pop) pop.classList.toggle('open');
  };

  document.addEventListener('click', () => el('pnl-sort-popover')?.classList.remove('open'));

  (window as Record<string, unknown>).setSortKey = (key: string) => {
    if (currentSortKey === key) sortDesc = !sortDesc;
    else { currentSortKey = key; sortDesc = false; }

    document.querySelectorAll('.sort-option').forEach(opt => {
      const k = opt.getAttribute('data-key');
      opt.classList.remove('active','active-desc');
      if (k === key) opt.classList.add(sortDesc ? 'active-desc' : 'active');
    });

    const label = el('pnl-sort-label');
    const labels: Record<string, string> = { value: 'By Value', pnl: 'By P&L', pct: 'By %', name: 'By Name' };
    if (label) label.textContent = labels[key] || 'Default';

    el('pnl-sort-popover')?.classList.remove('open');
  };

  // ── DCA Calculator ────────────────────────────────────────────────────
  (window as Record<string, unknown>).calcDCA = () => {
    const target = parseFloat((el('dca-target') as HTMLInputElement).value) || 0;
    const current = parseFloat((el('dca-current') as HTMLInputElement).value) || 0;
    const apy = parseFloat((el('dca-apy') as HTMLInputElement).value) || 0;
    const months = parseInt((el('dca-months') as HTMLInputElement).value) || 1;

    const r = apy / 100 / 12;
    let monthly: number;
    if (r === 0) {
      monthly = Math.max(0, (target - current * 1) / months);
    } else {
      // FV of lump = current * (1+r)^n
      const fvLump = current * Math.pow(1 + r, months);
      const needed = target - fvLump;
      if (needed <= 0) { monthly = 0; }
      else { monthly = needed * r / (Math.pow(1 + r, months) - 1); }
    }

    const totalInvested = monthly * months + current;
    const finalBalance = target;
    const interest = Math.max(0, finalBalance - totalInvested);

    (el('dca-monthly') as HTMLElement).textContent = fmt(Math.ceil(monthly)) + ' EGP';
    (el('dca-invested') as HTMLElement).textContent = fmt(Math.round(totalInvested)) + ' EGP';
    (el('dca-interest') as HTMLElement).textContent = fmt(Math.round(interest)) + ' EGP';
    (el('dca-final') as HTMLElement).textContent = fmt(Math.round(target)) + ' EGP';
    (el('dca-monthly-sub') as HTMLElement).textContent = `for ${months} months`;
    (el('dca-note') as HTMLElement).textContent = monthly <= 0
      ? '✅ Current balance + yield alone will exceed the target!'
      : `ℹ️ This assumes constant monthly deposits with ${apy}% APY compound interest.`;
  };

  // ── Growth snapshot ───────────────────────────────────────────────────
  (window as Record<string, unknown>).saveGrowthSnapshot = () => {
    const snapshots: { date: string; value: number }[] = JSON.parse(localStorage.getItem('portfolio_snapshots') || '[]');
    snapshots.push({ date: new Date().toISOString().slice(0,10), value: 14962 });
    localStorage.setItem('portfolio_snapshots', JSON.stringify(snapshots));
    const sc = el('growth-snapcount');
    if (sc) sc.textContent = snapshots.length + ' snapshots';
    alert('Snapshot saved! (' + snapshots.length + ' total)');
  };

  // ── Overlays ──────────────────────────────────────────────────────────
  (window as Record<string, unknown>).openInsights = () => {
    const ts = el('insights-timestamp');
    if (ts) ts.textContent = 'Generated: ' + new Date().toLocaleString();
    el('insight-overlay')?.classList.add('open');
  };
  (window as Record<string, unknown>).closeInsights = () => el('insight-overlay')?.classList.remove('open');

  (window as Record<string, unknown>).openScan = () => el('scan-overlay')?.classList.add('open');
  (window as Record<string, unknown>).closeScan = () => el('scan-overlay')?.classList.remove('open');

  (window as Record<string, unknown>).openNav = () => {
    el('nav-modal')?.classList.add('open');
    // Pre-fill with current values
    (el('input-abr-nav') as HTMLInputElement).value = '207.80';
    (el('input-abr-certs') as HTMLInputElement).value = '72';
    (el('input-re-nav') as HTMLInputElement).value = '1.91';
    (el('input-re-certs') as HTMLInputElement).value = '2656';
    (el('input-gold-price') as HTMLInputElement).value = '8000';
    (el('input-gold-grams') as HTMLInputElement).value = '20';
  };
  (window as Record<string, unknown>).closeNav = () => el('nav-modal')?.classList.remove('open');

  (window as Record<string, unknown>).applyNavs = () => {
    const abrNav = parseFloat((el('input-abr-nav') as HTMLInputElement).value) || 207.80;
    const abrCerts = parseFloat((el('input-abr-certs') as HTMLInputElement).value) || 72;
    const reNav = parseFloat((el('input-re-nav') as HTMLInputElement).value) || 1.91;
    // const reCerts = parseFloat((el('input-re-certs') as HTMLInputElement).value) || 2656;
    const goldPrice = parseFloat((el('input-gold-price') as HTMLInputElement).value) || 8000;
    // const goldGrams = parseFloat((el('input-gold-grams') as HTMLInputElement).value) || 20;

    // Update visible NAV labels
    const abrLbl = el('abr-nav-lbl'); if (abrLbl) abrLbl.textContent = abrNav.toFixed(2);
    const reLbl = el('re-nav-lbl'); if (reLbl) reLbl.textContent = reNav.toFixed(2);
    const abvSub = el('abr-sub'); if (abvSub) abvSub.innerHTML = `23% APY · ${abrCerts} certs @ <span id="abr-nav-lbl">${abrNav.toFixed(2)}</span>`;
    const liveGold = el('live-gold'); if (liveGold) liveGold.textContent = fmt(goldPrice);
    const rateBox = el('rate-box'); if (rateBox) rateBox.innerHTML = `Gold: ${fmt(goldPrice)} EGP/g<br>USD/EGP: 49.23`;

    closeNav();
  };
  const closeNav = () => el('nav-modal')?.classList.remove('open');

  (window as Record<string, unknown>).openApiKey = () => {
    el('apikey-overlay')?.classList.add('open');
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    (el('input-gemini-key') as HTMLInputElement).value = savedKey ? '••••••••' : '';
  };
  (window as Record<string, unknown>).closeApiKey = () => el('apikey-overlay')?.classList.remove('open');

  (window as Record<string, unknown>).saveApiKey = () => {
    const key = (el('input-gemini-key') as HTMLInputElement).value.trim();
    if (key && !key.startsWith('•')) {
      localStorage.setItem('gemini_api_key', key);
      const status = el('scan-key-status'); if (status) status.textContent = 'API Key: set ✓';
    }
    el('apikey-overlay')?.classList.remove('open');
  };

  // ── Scan ──────────────────────────────────────────────────────────────
  (window as Record<string, unknown>).selectScanMode = (mode: string) => {
    scanMode = mode;
    ['order','nav','stock'].forEach(m => el(`mode-${m}`)?.classList.toggle('selected', m === mode));
  };

  (window as Record<string, unknown>).onFileSelected = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const preview = el('scan-preview') as HTMLImageElement;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target?.result as string;
      preview.style.display = 'block';
      (el('scan-upload-label') as HTMLElement).style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  (window as Record<string, unknown>).applyScanResult = () => {
    if (scanResult) {
      alert('Data applied to dashboard! (In a full build, this would update your positions.)');
    }
    el('scan-overlay')?.classList.remove('open');
  };

  // ── Filter certificates ───────────────────────────────────────────────
  (window as Record<string, unknown>).filterCerts = (type: string) => {
    ['all','high','soon'].forEach(t => el(`cert-chip-${t}`)?.classList.toggle('active', t === type));
    const tbody = el('certs-tbody');
    if (!tbody) return;

    const today = new Date();
    const in90 = new Date(); in90.setDate(in90.getDate() + 90);

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const matStr = row.getAttribute('data-maturity') || '';
      const rate = parseFloat(row.getAttribute('data-rate') || '0');
      const matDate = new Date(matStr);
      let show = true;
      if (type === 'high') show = rate >= 20;
      else if (type === 'soon') show = matDate <= in90 && matDate >= today;
      (row as HTMLElement).style.display = show ? '' : 'none';
    });

    const chip = el('cert-chip-all');
    if (chip) chip.textContent = `All ${CERTS_DATA.length}`;
  };

  // ── Render certificates ───────────────────────────────────────────────
  function renderCerts() {
    const tbody = el('certs-tbody');
    if (!tbody) return;

    // Build timeline
    const timeline = el('cert-timeline');
    const rateBreak = el('cert-rate-breakdown');
    const today = new Date();

    const sorted = [...CERTS_DATA].sort((a, b) => new Date(a.maturity).getTime() - new Date(b.maturity).getTime());

    if (timeline) {
      timeline.innerHTML = sorted.slice(0, 6).map(c => {
        const mat = new Date(c.maturity);
        const daysLeft = Math.ceil((mat.getTime() - today.getTime()) / 86400000);
        const color = daysLeft < 90 ? 'var(--coral)' : daysLeft < 180 ? '#d99a2b' : 'var(--teal)';
        return `<div class="cert-timeline-item">
          <div class="cert-timeline-dot" style="background:${color}"></div>
          <div><div class="cert-timeline-name">${c.name}</div><div class="cert-timeline-date">${mat.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} · ${daysLeft}d left</div><div class="cert-timeline-amount">${fmt(c.value)} EGP @ ${c.rate}%</div></div>
        </div>`;
      }).join('') + (sorted.length > 6 ? `<div style="font-size:10px;color:var(--dim);padding:8px 0">+ ${sorted.length - 6} more certificates</div>` : '');
    }

    if (rateBreak) {
      const byRate: Record<number, { count: number; total: number }> = {};
      CERTS_DATA.forEach(c => {
        if (!byRate[c.rate]) byRate[c.rate] = { count: 0, total: 0 };
        byRate[c.rate].count++;
        byRate[c.rate].total += c.value;
      });
      rateBreak.innerHTML = Object.entries(byRate).sort(([a],[b]) => +b - +a).map(([rate, info]) => `
        <div class="cert-rate-row">
          <div><div style="font-size:12px;font-weight:700;color:var(--ink)">${rate}% APY</div><div style="font-size:10px;color:var(--dim)">${info.count} certificate${info.count>1?'s':''}</div></div>
          <div style="text-align:right"><div style="font-size:12px;font-weight:700;color:var(--teal)">${fmt(info.total)} EGP</div><div style="font-size:10px;color:var(--dim)">${fmt(Math.round(info.total * +rate / 100 / 12))}/mo</div></div>
        </div>`).join('');
    }

    // Table
    tbody.innerHTML = sorted.map(c => {
      const mat = new Date(c.maturity);
      const daysLeft = Math.ceil((mat.getTime() - today.getTime()) / 86400000);
      const badge = daysLeft < 90 ? '<span style="background:var(--coral-soft);color:var(--coral);font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px">Soon</span>' : '';
      return `<tr data-maturity="${c.maturity}" data-rate="${c.rate}">
        <td><div class="ah-asset-name">${c.name}</div></td>
        <td style="font-weight:700">${fmt(c.value)} EGP</td>
        <td style="color:var(--teal);font-weight:700">${c.rate}%</td>
        <td>${mat.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })} ${badge}</td>
        <td style="color:var(--teal);font-weight:700">${fmt(c.monthly)} EGP</td>
      </tr>`;
    }).join('');

    // ── Weighted-average APY & yield totals ──────────────────────────
    const totalPrincipal   = CERTS_DATA.reduce((s, c) => s + c.value,           0);
    const weightedRateSum  = CERTS_DATA.reduce((s, c) => s + c.value * c.rate,  0);
    const weightedAvgRate  = (weightedRateSum / totalPrincipal).toFixed(1);
    const totalMonthly     = CERTS_DATA.reduce((s, c) => s + c.monthly,          0);
    const certAnnualYield  = totalMonthly * 12;

    // ── Heatmap: color reflects yield, not 0% ──────────────────────────
    // A ~19.5% APY maps to a strong green; use same scale as gold (+9.4% = deep green)
    const certHmColor = '#1a7a5e'; // rich teal-green — better than the neutral purple/red
    const certHmCell  = el('hm-cert-cell');
    const certHmCell2 = el('hm-cert2-cell');
    const certHmPct   = el('hm-cert-pct');
    const certHmPct2  = el('hm-cert2-pct');
    if (certHmCell)  certHmCell.style.background  = certHmColor;
    if (certHmCell2) certHmCell2.style.background = certHmColor;
    if (certHmPct)   certHmPct.textContent         = `+${weightedAvgRate}% APY`;
    if (certHmPct2)  certHmPct2.textContent        = `NBE · ${weightedAvgRate}%`;

    // ── Performance P&L row ────────────────────────────────────────────
    const cpv = el('cert-pnl-val');
    const cpp = el('cert-pnl-pct');
    if (cpv) cpv.textContent = `+${fmt(certAnnualYield)} EGP/yr`;
    if (cpp) cpp.textContent = `+${weightedAvgRate}% APY`;

    // ── Holdings table return cell ─────────────────────────────────────
    const crc = el('cert-return-cell');
    if (crc) crc.textContent = `+${weightedAvgRate}%`;

    // ── Yield tab: total = Bareeq + certs ─────────────────────────────
    const abrMonthly   = 286.77;                              // 14,962 × 23% ÷ 12
    const totalYield   = abrMonthly + totalMonthly;
    const syEl         = el('s-yield');
    if (syEl) syEl.textContent = `+${fmt(totalYield)} EGP/mo`;
    const ysubEl = el('yield-sub');
    if (ysubEl) ysubEl.textContent = `ABR 23% + NBE ${weightedAvgRate}% (weighted avg)`;
    const ycalcEl  = el('yield-cert-calc');
    const yresEl   = el('yield-cert-result');
    const ytotalEl = el('yield-total-result');
    if (ycalcEl)  ycalcEl.textContent  = `210,000 × ${weightedAvgRate}% ÷ 12`;
    if (yresEl)   yresEl.textContent   = `= ${fmt(totalMonthly)} EGP/mo`;
    if (ytotalEl) ytotalEl.textContent = `${fmt(Math.round(totalYield))} EGP/mo`;

    // ── Hero math cert line ────────────────────────────────────────────
    const mcc = el('math-cert-calc');
    if (mcc) mcc.textContent = `25 certs · weighted avg ${weightedAvgRate}% APY`;

    // ── Wallet segments subtitle & cert header avg rate ────────────────
    const avgRateEl  = el('cert-avg-rate');
    if (avgRateEl)  avgRateEl.textContent  = `Avg ${weightedAvgRate}% APY`;
    const certSubEl  = el('cert-sub');
    if (certSubEl)  certSubEl.textContent  = `${CERTS_DATA.length} NBE certs · avg ${weightedAvgRate}% APY`;

    // ── Segment card monthly yield badge ──────────────────────────────
    const segCertPct = el('seg-cert-pct');
    if (segCertPct) segCertPct.textContent = `+${fmt(totalMonthly)}/mo`;

    // ── Insights description ───────────────────────────────────────────
    const insightDesc = el('insight-cert-desc');
    if (insightDesc) insightDesc.textContent = `Your ${CERTS_DATA.length} NBE certificates generate ~${fmt(totalMonthly)} EGP/month (${fmt(certAnnualYield)} EGP/yr) at a weighted average ${weightedAvgRate}% APY — reinvesting into Bareeq would compound growth.`;
    const myEl = el('cert-monthly-yield'); if (myEl) myEl.textContent = fmt(totalMonthly) + ' EGP';
    const ayEl = el('cert-annual-yield'); if (ayEl) ayEl.textContent = fmt(totalMonthly * 12) + ' EGP';
    const soon = CERTS_DATA.filter(c => {
      const mat = new Date(c.maturity);
      const d = Math.ceil((mat.getTime() - today.getTime()) / 86400000);
      return d >= 0 && d <= 90;
    }).length;
    const msEl = el('cert-maturing-soon'); if (msEl) msEl.textContent = soon + ' cert' + (soon !== 1 ? 's' : '');
  }

  // ── Animate health rings ──────────────────────────────────────────────
  function animateRings() {
    const scores = { div: 59, ef: 25, yield: 43, liq: 4 };
    const maxArc = { div: 259.2, ef: 202.6, yield: 146.1, liq: 89.5 };
    const bars = { div: 'wh-div', ef: 'wh-ef', yield: 'wh-yield-bar', liq: 'wh-liq-bar' };
    const colors = { div: '#d99a2b', ef: '#e05a50', yield: '#d99a2b', liq: '#e05a50' };

    setTimeout(() => {
      (Object.keys(scores) as (keyof typeof scores)[]).forEach(key => {
        const score = scores[key];
        const arc = maxArc[key];
        const fill = arc * score / 100;
        const rem = arc - fill;
        const ring = el(`ring-${key}`);
        if (ring) ring.setAttribute('stroke-dasharray', `${fill} ${rem}`);
        const bar = el(bars[key]);
        if (bar) { bar.style.width = score + '%'; bar.style.background = colors[key]; }
      });
    }, 300);
  }

  // ── Animate progress bar ──────────────────────────────────────────────
  function animateProgress() {
    setTimeout(() => {
      const pb = el('abr-prog-bar');
      if (pb) pb.style.width = '24.9%';
    }, 400);
  }

  // ── Init view slider ──────────────────────────────────────────────────
  function initSlider() {
    setTimeout(() => {
      (window as Record<string, unknown>).setView('total');
    }, 50);
  }

  // ── Restore from localStorage ─────────────────────────────────────────
  function restoreState() {
    const snapshots: { date: string; value: number }[] = JSON.parse(localStorage.getItem('portfolio_snapshots') || '[]');
    const sc = el('growth-snapcount');
    if (sc && snapshots.length) sc.textContent = snapshots.length + ' snapshots';
    const apiKey = localStorage.getItem('gemini_api_key');
    const ks = el('scan-key-status');
    if (ks && apiKey) ks.textContent = 'API Key: set ✓';
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────
  updateTime();
  setInterval(updateTime, 1000);
  animateRings();
  animateProgress();
  initSlider();
  renderCerts();
  restoreState();
}

export default function App() {
  useEffect(() => {
    initDashboard();
  }, []);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: DASHBOARD_HTML }}
    />
  );
}
