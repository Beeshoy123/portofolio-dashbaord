import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Brain, Gauge, List, RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { supabase } from '../lib/supabaseClient';

type Snapshot = {
  ticker: string;
  name: string;
  entity_type: string;
  is_held: boolean;
  sector: string | null;
  nav_or_price: number | string | null;
  return_30d_percent: number | string | null;
  return_ytd_percent: number | string | null;
  return_1y_percent: number | string | null;
  total_score: number | string | null;
  risk_level: string | null;
  signal: string | null;
  scraped_at: string | null;
  raw_fetch_ok: boolean;
  pe_ratio: number | string | null;
  forward_pe: number | string | null;
  roe_percent: number | string | null;
  debt_to_equity: number | string | null;
  current_ratio: number | string | null;
  revenue_growth_percent: number | string | null;
  dividend_yield_percent: number | string | null;
  beta: number | string | null;
};

type Candle = { date: string; open: number; high: number; low: number; close: number };
type TechnicalSignal = { ticker: string; trend: string; confidence: number | string | null; candle_date: string | null; patterns: Array<{ name: string; direction: string }>; reversal_risk?: "none" | "watch" | "elevated"; candles: Candle[] };
type ComparisonEntry = {
  ticker: string;
  return_percent: number | null;
  gap_percent: number | null;
  computed_risk_tier: 'Low' | 'Medium' | 'High' | null;
  risk_mismatch: boolean;
  foudalens_risk_level: string | null;
};

type ComparisonGroup = {
  group_type: 'sector_sibling' | 'manager_sibling' | 'direct_stock' | 'benchmark';
  you_beat_count: number;
  you_lose_count: number;
  incomplete_count: number;
  entries: ComparisonEntry[];
};

type Verdict = {
  holding_ticker: string;
  holding_name?: string;
  holding_return_percent: number | null;
  holding_current_value_egp?: number | null;
  holding_risk_tier?: 'Low' | 'Medium' | 'High' | null;
  holding_asset_role?: string;
  is_held?: boolean;
  return_period?: 'return_1y' | 'return_6m' | 'return_3m';
  signal: string;
  coverage_percent: number | null;
  comparables_beaten?: number;
  comparables_total?: number;
  flags?: string[];
  groups?: ComparisonGroup[];
  technical_signal?: {
    trend: string;
    confidence: number | null;
    reversal_risk?: 'none' | 'watch' | 'elevated';
    patterns: Array<{ name: string; direction: string }>;
  } | null;
  data_quality?: {
    comparable_with_return_count: number;
    comparable_count: number;
    holding_snapshot_status?: 'fresh' | 'stale' | 'missing' | 'failed';
    holding_snapshot_age_hours?: number | null;
  };
  data_completeness_warning?: boolean;
  fundamentals_flags_found?: boolean;
};
type StructuredRecommendation = {
  decision: 'consider_entry' | 'consider_rotation' | 'watch_and_wait' | 'hold';
  confidence: number;
  summary: string;
  evidence: string[];
  risks: string[];
  next_review_days: number;
  watch_trigger: string;
  do_not_act_reasons: string[];
};

type Recommendation = {
  ticker: string;
  recommendation_text: string;
  model_used: string;
  generated_at: string;
  structured?: StructuredRecommendation | null;
};

type TimeStopAlert = {
  watchlist_id?: number;
  ticker: string;
  is_stagnant: boolean;
  days_in_current_state: number;
  threshold_days: number;
  message?: string;
};

type ThesisAlert = {
  watchlist_id?: number;
  ticker: string;
  has_reversal: boolean;
  prior_signal?: string;
  current_signal?: string;
  message?: string;
};

type DrawdownAlert = {
  current_drawdown_percent: number;
  drawdown_percent?: number;
  peak_value?: number;
  current_value?: number;
  is_elevated?: boolean;
};

type AlertsSummary = {
  timeStops: TimeStopAlert[];
  theses: ThesisAlert[];
  drawdown: DrawdownAlert | null;
};
type PortfolioSummary = {
  summary_text: string;
  strong_count: number;
  mixed_count: number;
  weak_count: number;
  insufficient_data_count: number;
  flagged_count?: number | null;
  avg_coverage_percent?: number | null;
  reversal_risk_count?: number | null;
  divergence_count?: number | null;
  strong_value_percent?: number | null;
  mixed_value_percent?: number | null;
  weak_value_percent?: number | null;
  insufficient_value_percent?: number | null;
  // Decision-structured fields (present on rows from migration 022+; null on older rows)
  decision?: "hold" | "watch" | "rebalance" | null;
  confidence?: number | null;
  evidence?: string[] | null;
  risks?: string[] | null;
  next_review_days?: number | null;
  model_used: string;
  generated_at: string;
};

type OpportunitiesAnalysis = {
  strong_unheld: Array<{
    holding_ticker: string;
    holding_name: string;
    holding_return_percent: number | null;
    signal: string;
    coverage_percent?: number | null;
  }>;
  underrepresented_sectors: Array<{
    sector: string;
    portfolio_allocation_percent: number;
    strong_candidates: Array<{
      holding_ticker: string;
      holding_name: string;
      holding_return_percent: number | null;
      signal: string;
      coverage_percent?: number | null;
    }>;
  }>;
};

const VERDICT_FLAG_MAP: Record<string, { label: string; category: 'info' | 'warning' }> = {
  thin_comparable_sample: { label: 'Thin sample', category: 'info' },
  underperforming_comparables: { label: 'Underperforming peers', category: 'warning' },
  incomplete_comparison_data: { label: 'Incomplete data', category: 'info' },
  risk_mismatch: { label: 'Risk mismatch', category: 'warning' },
  technical_divergence: { label: 'Diverging from trend', category: 'warning' },
  reversal_risk_elevated: { label: 'Reversal risk', category: 'warning' },
  no_comparable_return_data: { label: 'No peer returns', category: 'warning' },
  missing_return_1y_return: { label: 'Missing 1Y return', category: 'info' },
  missing_return_6m_return: { label: 'Missing 6M return', category: 'info' },
  missing_return_3m_return: { label: 'Missing 3M return', category: 'info' },
};

function getVerdictFlagMeta(flag: string): { label: string; category: 'info' | 'warning' } {
  if (VERDICT_FLAG_MAP[flag]) {
    return VERDICT_FLAG_MAP[flag];
  }
  const label = flag.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    label,
    category: flag.includes('warning') || flag.includes('risk') || flag.includes('underperforming') || flag.includes('divergence') ? 'warning' : 'info',
  };
}

async function json<T>(url: string): Promise<T> {
  const headers = new Headers();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`AI Bot request failed: ${url} (${response.status})`);
  return response.json() as Promise<T>;
}

function pct(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
}

function metric(value: number | string | null | undefined, suffix = '') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(2) : '—'}${suffix}`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

function getGroupTypeLabel(type: string): string {
  switch (type) {
    case 'sector_sibling':
      return 'Sector Peers (Funds in Same Sector)';
    case 'manager_sibling':
      return 'Manager Siblings (Same Fund Manager)';
    case 'direct_stock':
      return 'Stock Alternatives (Direct Equities)';
    case 'benchmark':
      return 'Market Benchmarks (Indices)';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatGap(gap: number | null | undefined): { text: string; className: string } {
  if (gap === null || gap === undefined || !Number.isFinite(Number(gap))) {
    return { text: '—', className: '' };
  }
  const num = Number(gap);
  const isAhead = num >= 0;
  return {
    text: `${isAhead ? '+' : ''}${num.toFixed(1)} pp ${isAhead ? 'ahead' : 'behind'}`,
    className: isAhead ? 'comparison-gap-ahead' : 'comparison-gap-behind',
  };
}

function formatPeriodLabel(period?: string): string {
  if (period === 'return_6m') return '6-Month Return';
  if (period === 'return_3m') return '3-Month Return';
  return '1-Year Return';
}

function getDecisionMeta(decision?: string): { label: string; className: string } {
  switch (decision) {
    case 'consider_entry':
      return { label: 'Consider Entry', className: 'ai-bot-decision-entry' };
    case 'consider_rotation':
      return { label: 'Consider Rotation', className: 'ai-bot-decision-rotation' };
    case 'watch_and_wait':
      return { label: 'Watch & Wait', className: 'ai-bot-decision-watch' };
    case 'hold':
      return { label: 'Hold', className: 'ai-bot-decision-hold' };
    default:
      return { label: decision ? decision.replace(/_/g, ' ') : 'Hold', className: 'ai-bot-decision-hold' };
  }
}

function formatConfidenceLevel(confidence?: number | null): { label: string; className: string } {
  if (confidence === null || confidence === undefined) return { label: 'Unrated', className: 'ai-bot-confidence-unrated' };
  if (confidence >= 70) return { label: `${confidence}% (High Conviction)`, className: 'ai-bot-confidence-high' };
  if (confidence >= 45) return { label: `${confidence}% (Moderate Conviction)`, className: 'ai-bot-confidence-medium' };
  return { label: `${confidence}% (Low Conviction / Data Limited)`, className: 'ai-bot-confidence-low' };
}

function MiniCandleChart({ candles }: { candles: Candle[] }) {
  const visible = candles.slice(-24);
  if (!visible.length) return <div className="ai-bot-chart-empty">No OHLC history available.</div>;
  const values = visible.flatMap((candle) => [candle.high, candle.low]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const y = (value: number) => 10 + ((max - value) / range) * 130;
  return (
    <div className="ai-bot-chart">
      <div className="ai-bot-chart-grid"><span /><span /><span /><span /></div>
      <div className="ai-bot-candles">
        {visible.map((candle) => {
          const up = candle.close >= candle.open;
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(3, Math.abs(y(candle.open) - y(candle.close)));
          return <div className="ai-bot-candle" key={candle.date} title={`${candle.date}: ${candle.close.toFixed(2)}`}>
            <i style={{ top: y(candle.high), height: Math.max(1, y(candle.low) - y(candle.high)) }} />
            <b className={up ? 'is-up' : 'is-down'} style={{ top: bodyTop, height: bodyHeight }} />
          </div>;
        })}
      </div>
      <div className="ai-bot-chart-dates"><span>{visible[0].date}</span><span>{visible[visible.length - 1].date}</span></div>
    </div>
  );
}

function MarketComparison({ snapshots }: { snapshots: Snapshot[] }) {
  const groups = [
    ['Funds', snapshots.filter((snapshot) => snapshot.entity_type === 'fund')],
    ['Stocks', snapshots.filter((snapshot) => snapshot.entity_type === 'stock')],
    ['Indices', snapshots.filter((snapshot) => snapshot.entity_type === 'index')],
  ] as const;
  const value = (number: number | string | null, suffix = '') => number === null ? '—' : `${Number(number).toFixed(1)}${suffix}`;
  return <div className="ai-bot-market-comparison"><div className="ai-bot-market-comparison-heading"><div><span>Market Comparison</span><strong>Full watchlist snapshot</strong></div><small>Sorted by entity group</small></div>{groups.map(([label, group]) => group.length > 0 && <div className="ai-bot-market-group" key={label}><h4>{label}<small>{group.length} entities</small></h4><div className="ai-bot-market-table-wrap"><table><thead><tr><th>Ticker</th><th>Name</th><th>Price / NAV</th><th>30d</th><th>YTD</th><th>Score</th></tr></thead><tbody>{group.map((snapshot) => <tr key={snapshot.ticker}><td><strong>{snapshot.ticker}</strong>{snapshot.is_held && <em>HELD</em>}</td><td>{snapshot.name}</td><td>{snapshot.nav_or_price === null ? '—' : Number(snapshot.nav_or_price).toLocaleString()}</td><td className={Number(snapshot.return_30d_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{value(snapshot.return_30d_percent, '%')}</td><td className={Number(snapshot.return_ytd_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{value(snapshot.return_ytd_percent, '%')}</td><td>{snapshot.total_score === null ? '—' : `${Number(snapshot.total_score).toFixed(0)}/100`}</td></tr>)}</tbody></table></div></div>)}</div>;
}

export function AiBotWorkspace() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [signals, setSignals] = useState<TechnicalSignal[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [opportunitiesData, setOpportunitiesData] = useState<OpportunitiesAnalysis | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsSummary | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<'held' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMarketComparison, setShowMarketComparison] = useState(false);
  const hasEntityDataRef = useRef(false);

  useEffect(() => {
    const handleSnapshotUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ snapshots?: Snapshot[]; runId?: number | null }>).detail;
      const incoming = (detail?.snapshots ?? []).filter((snapshot) => snapshot.entity_type === 'fund' || snapshot.entity_type === 'stock' || snapshot.entity_type === 'index');
      if (detail?.runId !== undefined) setRunId(detail.runId ?? null);
      if (incoming.length === 0) return;
      hasEntityDataRef.current = true;
      setError(null);
      setLoading(false);
      setSnapshots((current) => {
        const byTicker = new Map(current.map((snapshot) => [snapshot.ticker, snapshot]));
        incoming.forEach((snapshot) => byTicker.set(snapshot.ticker, snapshot));
        return Array.from(byTicker.values());
      });
    };
    window.addEventListener('ai-bot-snapshots-updated', handleSnapshotUpdate);

    const load = async () => {
      try {
        if (!hasEntityDataRef.current) setLoading(true);
        const status = await json<{ runId: number | null }>('/api/ai-bot/status');
        setRunId(status.runId);
        const suffix = status.runId === null ? '' : `?runId=${encodeURIComponent(status.runId)}`;
        const [snapshotData, signalData, verdictData, recommendationData, summaryData, oppData, alertSummary] = await Promise.all([
          json<{ snapshots: Snapshot[] }>(`/api/scraper/snapshots${suffix}`),
          json<{ signals: TechnicalSignal[] }>(`/api/technical-signals${suffix}`).catch(() => ({ signals: [] })),
          json<Verdict[]>(`/api/rotation-verdicts${suffix}${suffix ? '&' : '?'}all=true`).catch(() => []),
          status.runId === null ? Promise.resolve([] as Recommendation[]) : json<Recommendation[]>(`/api/advisor/recommendations${suffix}`).catch(() => []),
          status.runId === null ? Promise.resolve(null) : json<PortfolioSummary>(`/api/portfolio-summary${suffix}`).catch(() => null),
          status.runId === null ? Promise.resolve(null) : json<OpportunitiesAnalysis>(`/api/advisor/opportunities${suffix}`).catch(() => null),
          status.runId === null ? Promise.resolve({ timeStops: [], theses: [], drawdown: null } as AlertsSummary) : json<AlertsSummary>(`/api/alerts/summary${suffix}`).catch(() => ({ timeStops: [], theses: [], drawdown: null })),
        ]);
        const entitySnapshots = snapshotData.snapshots.filter((snapshot) => snapshot.entity_type === 'fund' || snapshot.entity_type === 'stock' || snapshot.entity_type === 'index');
        if (entitySnapshots.length > 0) hasEntityDataRef.current = true;
        setSnapshots(entitySnapshots);
        setSignals(signalData.signals);
        setVerdicts(verdictData);
        setRecommendations(recommendationData);
        setPortfolioSummary(summaryData);
        setOpportunitiesData(oppData);
        setAlertsData(alertSummary);
      } catch (loadError) {
        if (!hasEntityDataRef.current) {
          setError(loadError instanceof Error ? loadError.message : 'AI Bot workspace unavailable');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
    let pollAttempts = 0;
    const poll = window.setInterval(async () => {
      pollAttempts += 1;
      if (pollAttempts > 36) {
        window.clearInterval(poll);
        return;
      }
      try {
        const status = await json<{ running: boolean }>('/api/ai-bot/status');
        if (status.running) {
          await load();
        } else {
          await load();
          window.clearInterval(poll);
        }
      } catch {
        // Keep the current entity view usable while a background run settles.
      }
    }, 5000);
    return () => {
      window.removeEventListener('ai-bot-snapshots-updated', handleSnapshotUpdate);
      window.clearInterval(poll);
    };
  }, []);

  const allEntities = useMemo(() => snapshots.filter((snapshot) => snapshot.raw_fetch_ok), [snapshots]);
  const heldEntities = useMemo(() => allEntities.filter((snapshot) => snapshot.is_held), [allEntities]);
  const displayedEntities = filterMode === 'held' ? heldEntities : allEntities;
  const entity = displayedEntities[selectedIndex] ?? null;
  const signal = entity ? signals.find((item) => item.ticker === entity.ticker) : undefined;
  const verdict = entity ? verdicts.find((item) => item.holding_ticker === entity.ticker) : undefined;
  const recommendation = entity ? recommendations.find((item) => item.ticker === entity.ticker) : undefined;
  const entityTimeStop = entity && alertsData ? alertsData.timeStops?.find((ts) => ts.ticker.toUpperCase() === entity.ticker.toUpperCase()) : undefined;
  const entityThesis = entity && alertsData ? alertsData.theses?.find((t) => t.ticker.toUpperCase() === entity.ticker.toUpperCase()) : undefined;
  const portfolioDrawdown = alertsData?.drawdown;
  const trendDown = signal?.trend === 'downtrend';

  // Analyze strong unheld entities as opportunities
  const opportunities = useMemo(() => {
    if (opportunitiesData?.strong_unheld && opportunitiesData.strong_unheld.length > 0) {
      return opportunitiesData.strong_unheld.map((v) => {
        const snap = allEntities.find((e) => e.ticker === v.holding_ticker);
        return {
          ticker: v.holding_ticker,
          name: snap?.name || v.holding_name || v.holding_ticker,
          entityType: snap?.entity_type || 'unknown',
          sector: snap?.sector || null,
          score: snap?.total_score ?? null,
          signal: v.signal,
        };
      });
    }
    const strongUnheld = verdicts
      .filter((v) => v.signal === 'Strong' && !allEntities.find((e) => e.ticker === v.holding_ticker && e.is_held))
      .map((v) => {
        const snap = allEntities.find((e) => e.ticker === v.holding_ticker);
        return {
          ticker: v.holding_ticker,
          name: snap?.name || v.holding_ticker,
          entityType: snap?.entity_type || 'unknown',
          sector: snap?.sector || null,
          score: snap?.total_score ?? null,
          signal: v.signal,
        };
      });
    return strongUnheld;
  }, [opportunitiesData, verdicts, allEntities]);

  const strongUnheldMatch = entity && !entity.is_held
    ? opportunitiesData?.strong_unheld?.find(
        (item) => item.holding_ticker.toUpperCase() === entity.ticker.toUpperCase()
      )
    : undefined;

  const matchingSector = strongUnheldMatch
    ? opportunitiesData?.underrepresented_sectors?.find((sec) =>
        sec.strong_candidates?.some(
          (cand) => cand.holding_ticker.toUpperCase() === entity.ticker.toUpperCase()
        )
      )
    : undefined;

  const opportunityReason = matchingSector
    ? `Fills gap in ${matchingSector.sector} (currently only ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% of portfolio)`
    : verdict?.coverage_percent !== null && verdict?.coverage_percent !== undefined
      ? `Strong signal with ${Number(verdict.coverage_percent).toFixed(1)}% comparable coverage.`
      : 'Strong signal detected. Consider for portfolio inclusion.';

  const fundamentals = entity?.entity_type === 'stock' ? [
    ['P/E', metric(entity.pe_ratio)],
    ['Forward P/E', metric(entity.forward_pe)],
    ['ROE', metric(entity.roe_percent, '%')],
    ['Debt / Equity', metric(entity.debt_to_equity)],
    ['Current ratio', metric(entity.current_ratio)],
    ['Revenue growth', metric(entity.revenue_growth_percent, '%')],
    ['Dividend yield', metric(entity.dividend_yield_percent, '%')],
    ['Beta', metric(entity.beta)],
  ] : [];

  const move = (direction: number) => setSelectedIndex((index) => Math.min(Math.max(index + direction, 0), Math.max(displayedEntities.length - 1, 0)));

  // Reset to first entity when filter mode changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterMode]);

  if (error || !entity) {
    return (
      <section className="ai-bot-workspace">
        <header className="ai-bot-workspace-header">
          <div className="ai-bot-workspace-brand"><span className="ai-bot-workspace-icon"><Brain /></span><div><span className="ai-bot-eyebrow">AI Bot / entity intelligence</span><h2>Focused recommendation desk</h2><p>Price, chart, comparison, and advice for one entity at a time.</p></div></div>
          <div className="ai-bot-run-state"><span /><span>Run {runId ?? 'latest'}</span></div>
        </header>
        <section className="ai-bot-engine ai-bot-market-engine">
          <div className="ai-bot-engine-header"><div><h3>Market Intelligence</h3></div><Gauge /></div>
          {error && <div className="ai-bot-workspace-state"><span>{error}</span></div>}
        </section>
        <section className="ai-bot-engine ai-bot-comparison-engine">
          <div className="ai-bot-engine-header"><div><h3>Comparison Judge</h3><p>Relative position against peers and benchmarks.</p></div><Activity /></div>
          <article className="ai-bot-panel ai-bot-verdict-panel"><p>Comparison results will appear here when this run provides usable market data.</p></article>
        </section>
        <section className="ai-bot-engine ai-bot-advisor-engine">
          <div className="ai-bot-engine-header"><div><h3>Smart Advisor</h3><p>Final recommendation based on the completed analysis.</p></div><Brain /></div>
          <article className="ai-bot-panel ai-bot-advice-panel"><p>Recommendations will appear after the Comparison Judge completes.</p></article>
        </section>
      </section>
    );
  }

  return (
    <section className="ai-bot-workspace">
      <header className="ai-bot-workspace-header">
        <div className="ai-bot-workspace-brand"><span className="ai-bot-workspace-icon"><Brain /></span><div><span className="ai-bot-eyebrow">AI Bot / entity intelligence</span><h2>Focused recommendation desk</h2><p>Price, chart, comparison, and advice for one entity at a time.</p></div></div>
        <div className="ai-bot-run-state"><span /><span>Run {runId ?? 'latest'}</span></div>
      </header>

      <nav className="ai-bot-entity-nav" aria-label="Entity navigation">
        <div className="ai-bot-entity-filters">
          <button type="button" className={`ai-bot-filter-btn ${filterMode === 'held' ? 'is-active' : ''}`} onClick={() => setFilterMode('held')}>Held ({heldEntities.length})</button>
          <button type="button" className={`ai-bot-filter-btn ${filterMode === 'all' ? 'is-active' : ''}`} onClick={() => setFilterMode('all')}>All ({allEntities.length})</button>
        </div>
        <button type="button" onClick={() => move(-1)} disabled={selectedIndex === 0} aria-label="Previous entity"><ArrowLeft /></button>
        <div className="ai-bot-entity-current"><span>Entity {selectedIndex + 1} of {displayedEntities.length}</span><strong>{entity?.ticker || '—'}</strong><small>{entity?.name || 'No entity selected'}</small></div>
        <button type="button" onClick={() => move(1)} disabled={selectedIndex === displayedEntities.length - 1} aria-label="Next entity"><ArrowRight /></button>
      </nav>

      <div className="ai-bot-entity-summary">
        <div><span>Market price / NAV</span><strong>{entity.nav_or_price === null ? '—' : Number(entity.nav_or_price).toLocaleString()}</strong></div>
        <div><span>30 day return</span><strong className={Number(entity.return_30d_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{pct(entity.return_30d_percent)}</strong></div>
        <div><span>YTD return</span><strong className={Number(entity.return_ytd_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{pct(entity.return_ytd_percent)}</strong></div>
        <div><span>Risk / signal</span><strong>{entity.risk_level ?? 'Unknown'} <em>{entity.signal ?? 'Review'}</em></strong></div>
      </div>

      <section className="ai-bot-engine ai-bot-market-engine">
        <div className="ai-bot-engine-header"><div><h3>Market Intelligence</h3></div><div className="ai-bot-engine-actions"><button type="button" className="ai-bot-market-button" onClick={() => setShowMarketComparison((visible) => !visible)}>{showMarketComparison ? <X /> : <List />} {showMarketComparison ? 'Close comparison' : 'Market comparison'}</button><Gauge /></div></div>
        {fundamentals.length > 0 && <section className="ai-bot-fundamentals"><div className="ai-bot-fundamentals-heading"><div><span>Fundamentals</span><strong>StockAnalysis snapshot</strong></div><small>Latest available filing data</small></div><div className="ai-bot-fundamentals-grid">{fundamentals.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>}
        <div className="ai-bot-analysis-grid">
          <article className="ai-bot-panel ai-bot-price-panel"><div className="ai-bot-panel-heading"><div><h3>Price Checker</h3><span>Market snapshot</span></div><Gauge /></div><div className="ai-bot-price-main"><strong>{pct(entity.return_1y_percent)}</strong><span>1 year return</span></div><div className="ai-bot-price-details"><span>Sector <b>{entity.sector ?? 'Unclassified'}</b></span><span>Score <b>{entity.total_score === null ? '—' : `${Number(entity.total_score).toFixed(0)}/100`}</b></span><span>Updated <b>{entity.scraped_at ? new Date(entity.scraped_at).toLocaleDateString() : '—'}</b></span></div></article>
          <article className="ai-bot-panel ai-bot-chart-panel"><div className="ai-bot-panel-heading"><div><h3>Chart Reader</h3><span>Candlestick context</span></div>{trendDown ? <TrendingDown /> : <TrendingUp />}</div><MiniCandleChart candles={signal?.candles ?? []} /><div className="ai-bot-chart-footer"><span className={trendDown ? 'ai-negative' : 'ai-positive'} title={signal?.reversal_risk && signal.reversal_risk !== 'none' ? 'Pattern-based observation, not a prediction.' : undefined}>{signal?.trend ?? 'No trend'}{signal?.reversal_risk && signal.reversal_risk !== 'none' ? ` · Reversal ${signal.reversal_risk === 'watch' ? 'Watch' : 'Alert'}` : ''}</span><span>{signal?.candle_date ?? 'No candle date'}</span></div></article>
        </div>
        <Dialog open={showMarketComparison} onOpenChange={setShowMarketComparison}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <MarketComparison snapshots={snapshots} />
          </DialogContent>
        </Dialog>
        <article className="ai-bot-panel ai-bot-verdict-panel">
          <div className="ai-bot-panel-heading"><div><h3>Comparison Judge</h3><span>Selected entity</span></div><Activity /></div>
          {verdict ? (
            <>
              {/* Feature 5: Holding Metadata Header */}
              <div className="ai-bot-verdict-section ai-bot-verdict-header-section">
                <div className="comparison-holding-header">
                  <div>
                    <span className="comparison-holding-eyebrow">Evaluated Asset</span>
                    <h4 className="comparison-holding-name">
                      {verdict.holding_name || entity.name || verdict.holding_ticker} <span>({verdict.holding_ticker})</span>
                    </h4>
                    <div className="comparison-holding-meta">
                      <span><b>{formatPeriodLabel(verdict.return_period)}:</b> <strong>{pct(verdict.holding_return_percent)}</strong></span>
                      {verdict.holding_risk_tier && (
                        <span><b>Risk Tier:</b> {verdict.holding_risk_tier}</span>
                      )}
                      {verdict.holding_current_value_egp !== null && verdict.holding_current_value_egp !== undefined && (
                        <span><b>Position:</b> {Number(verdict.holding_current_value_egp).toLocaleString()} EGP</span>
                      )}
                      {verdict.data_quality?.holding_snapshot_status && (
                        <span className={`ai-bot-snapshot-badge ai-bot-snapshot-${verdict.data_quality.holding_snapshot_status}`}>
                          Snapshot: {verdict.data_quality.holding_snapshot_status}
                          {verdict.data_quality.holding_snapshot_age_hours !== null && verdict.data_quality.holding_snapshot_age_hours !== undefined
                            ? ` (${verdict.data_quality.holding_snapshot_age_hours.toFixed(0)}h ago)`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="ai-bot-verdict-caption">
                  Baseline metrics for this holding over the {formatPeriodLabel(verdict.return_period).toLowerCase()} evaluation window.
                </p>
              </div>

              {/* Features 3, 2, 6: Signal Verdict Pill, Win/Loss Tally, Coverage */}
              <div className="ai-bot-verdict-section ai-bot-verdict-signal-section">
                <div className="ai-bot-verdict-signal-row">
                  <div className={`ai-bot-verdict-pill ai-bot-verdict-${slugify(verdict.signal)}`}>
                    {verdict.signal}
                  </div>
                  {verdict.coverage_percent !== null && (
                    <span className="ai-bot-coverage-badge">
                      {verdict.coverage_percent.toFixed(1)}% Coverage
                    </span>
                  )}
                </div>

                {verdict.comparables_total !== undefined && verdict.comparables_total > 0 ? (
                  <div className="ai-bot-verdict-peers-tally">
                    <span className="ai-bot-tally-chip ai-bot-tally-win">
                      ✅ {verdict.comparables_beaten ?? 0} Beat
                    </span>
                    <span className="ai-bot-tally-chip ai-bot-tally-loss">
                      ❌ {Math.max(0, (verdict.comparables_total ?? 0) - (verdict.comparables_beaten ?? 0))} Lost
                    </span>
                    <span className="ai-bot-tally-text">
                      out of {verdict.comparables_total} comparable peers with return data
                    </span>
                  </div>
                ) : (
                  <p className="ai-bot-verdict-peers">
                    No comparable peers with return data found for this evaluation period.
                  </p>
                )}

                <p className="ai-bot-verdict-caption">
                  Signal is derived from the head-to-head win rate against comparable peers (≥60% wins = Strong, 40–59% = Mixed, &lt;40% = Weak). Coverage measures the percentage of peers with usable return data — higher coverage indicates greater statistical reliability.
                </p>
              </div>

              {/* Feature 8: Technical Divergence Warning Callout */}
              {(verdict.flags?.includes('technical_divergence') ||
                (verdict.signal === 'Strong' && (verdict.technical_signal?.trend === 'downtrend' || signal?.trend === 'downtrend'))) && (
                <div className="comparison-warning ai-bot-callout-warning">
                  <span>⚠️</span>
                  <div>
                    <strong>Technical Divergence:</strong>
                    <p>
                      This holding beats its peers on returns, but the price chart is in a downtrend. Peer performance data and price action are sending conflicting signals — wait for the chart to confirm before acting on the Strong verdict.
                    </p>
                  </div>
                </div>
              )}

              {/* Feature 7: Chart Reversal Risk */}
              {(() => {
                const reversalRisk = verdict.technical_signal?.reversal_risk || signal?.reversal_risk;
                if (!reversalRisk || reversalRisk === 'none') return null;
                const isElevated = reversalRisk === 'elevated';
                return (
                  <div className={`comparison-warning ${isElevated ? 'ai-bot-callout-warning' : 'ai-bot-callout-info'}`}>
                    <span>{isElevated ? '⚠️' : '👁️'}</span>
                    <div>
                      <strong>Chart Reversal Risk: {isElevated ? 'Elevated' : 'Watch'}</strong>
                      <p>
                        Bearish candlestick patterns detected in an active uptrend. Consider this a caution flag even if the peer comparison is strong.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Feature 4: Diagnostic Warning Flags */}
              {verdict.flags && verdict.flags.length > 0 && (
                <div className="ai-bot-verdict-section ai-bot-verdict-flags-section">
                  <span className="comparison-holding-eyebrow">Diagnostic Alerts</span>
                  <div className="ai-bot-verdict-flags">
                    {verdict.flags.map((flag) => {
                      const meta = getVerdictFlagMeta(flag);
                      return (
                        <span key={flag} className={`ai-bot-flag-chip ai-bot-flag-${meta.category}`}>
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="ai-bot-verdict-caption">
                    These diagnostic alerts are raised automatically when the system detects data gaps, sample size limitations, or signal conflicts.
                  </p>
                  <p className="ai-bot-verdict-data-quality">
                    Data completeness: {verdict.data_quality?.comparable_with_return_count ?? 0} of {verdict.data_quality?.comparable_count ?? 0} comparable assets have usable return history.
                  </p>
                </div>
              )}
              {/* Feature 1: Peer Group Breakdown Cards */}
              <div className="ai-bot-verdict-section ai-bot-verdict-groups-section">
                <span className="comparison-holding-eyebrow">Peer Group Breakdown</span>
                <p className="ai-bot-verdict-caption">
                  Peers are grouped by relationship type. Each row shows a peer's return and how many percentage points ahead (+) or behind (−) you are.
                </p>

                {verdict.groups && verdict.groups.length > 0 ? (
                  <div className="ai-bot-groups-list">
                    {verdict.groups.map((group) => {
                      const totalRated = group.you_beat_count + group.you_lose_count;
                      return (
                        <div key={group.group_type} className="comparison-group">
                          <div className="comparison-group-header">
                            <span className="comparison-group-label">{getGroupTypeLabel(group.group_type)}</span>
                            <div className="comparison-group-summary">
                              <span className="ai-bot-tally-chip ai-bot-tally-win">
                                Beat {group.you_beat_count} / {totalRated}
                              </span>
                              {group.incomplete_count > 0 && (
                                <span className="ai-bot-flag-chip ai-bot-flag-info">
                                  {group.incomplete_count} Pending
                                </span>
                              )}
                            </div>
                          </div>

                          {group.entries && group.entries.length > 0 ? (
                            group.entries.map((peer) => {
                              const hasReturn = peer.return_percent !== null && peer.return_percent !== undefined;
                              const gapMeta = formatGap(peer.gap_percent);
                              return (
                                <div
                                  key={peer.ticker}
                                  className={`comparison-evidence-row ${!hasReturn ? 'comparison-evidence-pending' : ''}`}
                                >
                                  <strong className="comparison-ticker">{peer.ticker}</strong>
                                  {hasReturn ? (
                                    <>
                                      <span className={`comparison-return ${Number(peer.return_percent) >= 0 ? 'ai-positive' : 'ai-negative'}`}>
                                        {pct(peer.return_percent)}
                                      </span>
                                      <span className="comparison-evidence-spacer" />
                                      <span className={`comparison-gap ${gapMeta.className}`}>
                                        {gapMeta.text}
                                      </span>
                                      <div className="comparison-risk">
                                        {peer.computed_risk_tier && (
                                          <span className="ai-bot-flag-chip ai-bot-flag-info">
                                            {peer.computed_risk_tier} Risk
                                          </span>
                                        )}
                                        {peer.risk_mismatch && (
                                          <span className="ai-bot-flag-chip ai-bot-flag-warning" title="Risk tier mismatch compared to holding">
                                            Mismatch
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="comparison-pending-label">
                                      No return data available yet for this evaluation window
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="comparison-pending-label" style={{ padding: '8px 0' }}>
                              No peers assigned to this bucket.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="comparison-pending-label" style={{ marginTop: '8px' }}>
                    No peer comparison groups available for this entity.
                  </p>
                )}
              </div>

              {verdict.technical_signal && (
                <div className="ai-bot-inline-signal">
                  Chart evidence: <b>{verdict.technical_signal.trend}</b>{verdict.technical_signal.patterns.length ? ` / ${verdict.technical_signal.patterns[0].name}` : ''}
                </div>
              )}

              {/* Feature 9: Opportunity Candidate Banner (for un-held entities with Strong signal) */}
              {!entity?.is_held && verdict.signal === 'Strong' && (
                <div className="ai-bot-callout-box ai-bot-callout-opportunity">
                  <strong>💡 Opportunity Candidate</strong>
                  <p>{opportunityReason}</p>
                  <small className="ai-bot-verdict-caption">
                    Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.
                  </small>
                </div>
              )}
            </>
          ) : (
            <p>No comparison result is available for this entity yet.</p>
          )}
        </article>
      </section>

      <section className="ai-bot-engine ai-bot-comparison-engine">
        <div className="ai-bot-engine-header"><div><h3>Comparison Judge</h3><p>Portfolio-wide view across all holdings.</p></div><Activity /></div>
        <article className="ai-bot-panel ai-bot-verdict-panel">
          {portfolioSummary ? (
            <>
              <div className="ai-bot-summary-section">
                <h4 className="ai-bot-summary-title">Holdings Status</h4>
                <div className="ai-bot-summary-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="ai-bot-summary-row">
                    <span className="text-xs font-semibold text-muted-foreground mr-1.5">By count:</span>
                    <span className="ai-bot-summary-holdings">
                      <span className="ai-bot-label-strong">{portfolioSummary.strong_count} Strong</span>,{' '}
                      <span className="ai-bot-label-mixed">{portfolioSummary.mixed_count} Mixed</span>,{' '}
                      <span className="ai-bot-label-weak">{portfolioSummary.weak_count} Weak</span>
                      {portfolioSummary.insufficient_data_count > 0 && <span className="ai-bot-label-insufficient">, {portfolioSummary.insufficient_data_count} Insufficient Data</span>}
                    </span>
                  </div>
                  {portfolioSummary.strong_value_percent !== null && portfolioSummary.strong_value_percent !== undefined ? (
                    <div className="ai-bot-summary-row">
                      <span className="text-xs font-semibold text-muted-foreground mr-1.5">By value:</span>
                      <span className="ai-bot-summary-holdings">
                        <span className="ai-bot-label-strong">{Number(portfolioSummary.strong_value_percent).toFixed(1)}% Strong</span>,{' '}
                        <span className="ai-bot-label-mixed">{Number(portfolioSummary.mixed_value_percent).toFixed(1)}% Mixed</span>,{' '}
                        <span className="ai-bot-label-weak">{Number(portfolioSummary.weak_value_percent).toFixed(1)}% Weak</span>
                        {Number(portfolioSummary.insufficient_value_percent) > 0 && <span className="ai-bot-label-insufficient">, {Number(portfolioSummary.insufficient_value_percent).toFixed(1)}% Insufficient Data</span>}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Value-weighted view unavailable — holding values not available for this run
                    </p>
                  )}
                </div>
                <div className="ai-bot-summary-aggregates" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '11px', opacity: 0.85 }}>
                  <span className="ai-bot-aggregate-pill">⚑ {portfolioSummary.flagged_count ?? 0} flagged</span>
                  {portfolioSummary.avg_coverage_percent !== null && portfolioSummary.avg_coverage_percent !== undefined && (
                    <span className="ai-bot-aggregate-pill">📊 avg {Number(portfolioSummary.avg_coverage_percent).toFixed(1)}% coverage</span>
                  )}
                  <span className="ai-bot-aggregate-pill">↩ {portfolioSummary.reversal_risk_count ?? 0} reversal risk</span>
                  <span className="ai-bot-aggregate-pill">⚠ {portfolioSummary.divergence_count ?? 0} diverging</span>
                </div>
              </div>
              
              {opportunities.length > 0 && (
                <div className="ai-bot-opportunities-section">
                  <h4 className="ai-bot-summary-title">🎯 Opportunities</h4>
                  <div className="ai-bot-opportunities-list">
                    {opportunities.map((opp) => (
                      <div key={opp.ticker} className="ai-bot-opportunity-item">
                        <span className="ai-bot-opp-ticker">{opp.ticker}</span>
                        <span className="ai-bot-opp-name">{opp.name}</span>
                        <span className="ai-bot-opp-badge">Strong Signal</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="ai-bot-summary-analysis">
                <h4 className="ai-bot-summary-title">Portfolio-wide Advisor Read</h4>
                {portfolioSummary.decision ? (
                  <>
                    <div className="ai-bot-portfolio-decision-row">
                      <div className={`ai-bot-decision-pill ai-bot-decision-${portfolioSummary.decision}`}>
                        {portfolioSummary.decision === 'hold' ? 'Hold' : portfolioSummary.decision === 'watch' ? 'Watch' : 'Rebalance'}
                      </div>
                      {portfolioSummary.confidence !== null && portfolioSummary.confidence !== undefined && (
                        <span className="ai-bot-portfolio-confidence">Confidence: {portfolioSummary.confidence}%</span>
                      )}
                    </div>
                    <p className="ai-bot-recommendation">{portfolioSummary.summary_text}</p>
                    {portfolioSummary.evidence && portfolioSummary.evidence.length > 0 && (
                      <div className="ai-bot-portfolio-list-section">
                        <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--evidence">Evidence</span>
                        <ul className="ai-bot-portfolio-list">
                          {portfolioSummary.evidence.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {portfolioSummary.risks && portfolioSummary.risks.length > 0 && (
                      <div className="ai-bot-portfolio-list-section">
                        <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--risks">Risks</span>
                        <ul className="ai-bot-portfolio-list ai-bot-portfolio-list--risks">
                          {portfolioSummary.risks.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {portfolioSummary.next_review_days !== null && portfolioSummary.next_review_days !== undefined && (
                      <p className="ai-bot-portfolio-next-review">Next portfolio review: in {portfolioSummary.next_review_days} day{portfolioSummary.next_review_days === 1 ? '' : 's'}</p>
                    )}
                  </>
                ) : (
                  // Pre-migration row or fallback path — render summary text only, no pill
                  <p className="ai-bot-recommendation">{portfolioSummary.summary_text}</p>
                )}
              </div>
              
              <small className="ai-bot-summary-meta">{portfolioSummary.model_used} / {new Date(portfolioSummary.generated_at).toLocaleDateString()}</small>
            </>
          ) : (
            <p>Portfolio summary will appear after Comparison Judge completes for this run.</p>
          )}
        </article>
      </section>
      <section className="ai-bot-engine ai-bot-advisor-engine">
        <div className="ai-bot-engine-header"><div><h3>Smart Advisor</h3><p>Final recommendation based on the completed analysis.</p></div><Brain /></div>
        <article className="ai-bot-panel ai-bot-advice-panel">
          {recommendation ? (
            <div className="ai-bot-advice-report-card">
              {/* 3.1: Decision Pill & Confidence Header */}
              {(() => {
                const inferredDecision = entity?.is_held
                  ? (verdict?.signal === 'Weak' ? 'consider_rotation' : verdict?.signal === 'Mixed' ? 'watch_and_wait' : 'hold')
                  : 'consider_entry';
                const decision = recommendation.structured?.decision || inferredDecision;
                const decisionMeta = getDecisionMeta(decision);
                const confidence = recommendation.structured?.confidence ?? null;
                const confidenceMeta = formatConfidenceLevel(confidence);

                return (
                  <div className="ai-bot-advice-section ai-bot-advice-decision-section">
                    <div className="ai-bot-decision-row">
                      <div className={`ai-bot-decision-pill ${decisionMeta.className}`}>
                        {decisionMeta.label}
                      </div>
                      {confidence !== null && (
                        <span className={`ai-bot-confidence-badge ${confidenceMeta.className}`}>
                          {confidenceMeta.label}
                        </span>
                      )}
                    </div>
                    <p className="ai-bot-verdict-caption">
                      Action recommendation synthesized from relative peer performance, chart evidence, and portfolio risk tolerance.
                    </p>
                  </div>
                );
              })()}

              {/* 3.2: Core Advisory Synthesis & Evidence / Risk Bullets */}
              <div className="ai-bot-advice-section ai-bot-advice-narrative-section">
                <span className="comparison-holding-eyebrow">Advisory Thesis</span>
                <p className="ai-bot-recommendation">
                  {recommendation.structured?.summary || recommendation.recommendation_text}
                </p>

                {recommendation.structured?.evidence && recommendation.structured.evidence.length > 0 && (
                  <div className="ai-bot-portfolio-list-section">
                    <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--evidence">
                      Key Grounded Evidence
                    </span>
                    <ul className="ai-bot-portfolio-list">
                      {recommendation.structured.evidence.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendation.structured?.risks && recommendation.structured.risks.length > 0 && (
                  <div className="ai-bot-portfolio-list-section">
                    <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--risks">
                      Downside Risks &amp; Considerations
                    </span>
                    <ul className="ai-bot-portfolio-list ai-bot-portfolio-list--risks">
                      {recommendation.structured.risks.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <small className="ai-bot-summary-meta">
                  {recommendation.model_used} · {new Date(recommendation.generated_at).toLocaleDateString()}
                </small>
              </div>

              {/* 3.3: Watch Trigger & Next Review Horizon */}
              {(recommendation.structured?.watch_trigger || recommendation.structured?.next_review_days != null) && (
                <div className="ai-bot-advice-section ai-bot-advice-trigger-section">
                  <span className="comparison-holding-eyebrow">Watch Trigger &amp; Review Horizon</span>
                  {recommendation.structured?.watch_trigger && (
                    <div className="ai-bot-trigger-box">
                      <strong>⚡ Trigger Condition</strong>
                      <p>{recommendation.structured.watch_trigger}</p>
                    </div>
                  )}
                  {recommendation.structured?.next_review_days != null && (
                    <div className="ai-bot-review-horizon">
                      🗓️ Next review in <strong>{recommendation.structured.next_review_days} day{recommendation.structured.next_review_days === 1 ? '' : 's'}</strong>
                    </div>
                  )}
                  <p className="ai-bot-verdict-caption">
                    Concrete threshold that must trigger before adjusting position size or exiting.
                  </p>
                </div>
              )}

              {/* 3.4: Behavioral Guardrails — "Why NOT to Act Yet" */}
              {recommendation.structured?.do_not_act_reasons && recommendation.structured.do_not_act_reasons.length > 0 && (
                <div className="ai-bot-advice-section ai-bot-advice-guardrails-section">
                  <span className="comparison-holding-eyebrow">Behavioral Guardrails</span>
                  <div className="ai-bot-guardrail-box">
                    <strong>🛑 Reasons NOT to Act Yet</strong>
                    <ul className="ai-bot-guardrail-list">
                      {recommendation.structured.do_not_act_reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="ai-bot-verdict-caption">
                    Risk guardrails designed to prevent impulsive trades before signal confirmation.
                  </p>
                </div>
              )}

              {/* 3.5: Automated Safety & Alert Checks — Time Stop, Thesis, Drawdown */}
              {(entityTimeStop || entityThesis || portfolioDrawdown) && (
                <div className="ai-bot-advice-section ai-bot-advice-safety-section">
                  <span className="comparison-holding-eyebrow">Automated Safety Checks</span>
                  <div className="ai-bot-safety-grid">

                    {/* Time Stop */}
                    {entityTimeStop && (
                      <div className={`ai-bot-safety-card ${entityTimeStop.is_stagnant ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>Time Stop</span>
                        <strong>
                          {entityTimeStop.is_stagnant
                            ? `⏱️ Stagnant: ${entityTimeStop.days_in_current_state}d`
                            : '✅ Active Momentum'}
                        </strong>
                        {entityTimeStop.is_stagnant && entityTimeStop.message && (
                          <em>{entityTimeStop.message}</em>
                        )}
                      </div>
                    )}

                    {/* Thesis Integrity */}
                    {entityThesis && (
                      <div className={`ai-bot-safety-card ${entityThesis.has_reversal ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>Thesis Integrity</span>
                        <strong>
                          {entityThesis.has_reversal ? '⚠️ Signal Degraded' : '✅ Thesis Intact'}
                        </strong>
                        {entityThesis.has_reversal && entityThesis.prior_signal && entityThesis.current_signal && (
                          <em>{entityThesis.prior_signal} → {entityThesis.current_signal}</em>
                        )}
                      </div>
                    )}

                    {/* Drawdown */}
                    {portfolioDrawdown && (
                      <div className={`ai-bot-safety-card ${(portfolioDrawdown.is_elevated || Math.abs(portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? 0) >= 10) ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>Drawdown Risk</span>
                        <strong>
                          📉 {Math.abs(portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? 0).toFixed(1)}% Drawdown
                        </strong>
                        {portfolioDrawdown.is_elevated && <em>Elevated — review position</em>}
                      </div>
                    )}

                  </div>
                  <p className="ai-bot-verdict-caption">
                    Automated risk monitors evaluated on every pipeline cycle to protect capital.
                  </p>
                </div>
              )}

              {/* 3.6: Watchlist & Opportunity Candidate Hub (for unheld entities) */}
              {!entity?.is_held && (
                <div className="ai-bot-advice-section ai-bot-advice-watchlist-section">
                  <span className="comparison-holding-eyebrow">Watchlist Evaluation</span>
                  {(strongUnheldMatch || verdict?.signal === 'Strong') ? (
                    <div className="ai-bot-watchlist-opportunity">
                      <strong>💡 Opportunity Candidate</strong>
                      <p>{opportunityReason}</p>
                      {matchingSector && (
                        <div className="ai-bot-sector-gap-row">
                          <span>Sector Gap</span>
                          <strong>{matchingSector.sector}</strong>
                          <em>{Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% current allocation</em>
                        </div>
                      )}
                      <p className="ai-bot-verdict-caption">
                        Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.
                      </p>
                    </div>
                  ) : verdict?.signal === 'Weak' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
                      <strong>⛔ Not Recommended</strong>
                      <p>Underperforming its peer group. Not recommended for portfolio inclusion at this time.</p>
                    </div>
                  ) : verdict?.signal === 'Mixed' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-mixed">
                      <strong>👁️ Monitor Only</strong>
                      <p>Mixed peer performance. Wait for trend confirmation before considering entry.</p>
                    </div>
                  ) : verdict?.signal === 'Insufficient Data' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
                      <strong>📊 Insufficient Data</strong>
                      <p>Not enough peer comparison history to formulate an entry thesis.</p>
                    </div>
                  ) : (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
                      <strong>📋 No Active Thesis</strong>
                      <p>No active entry or rotation thesis for this watchlist asset.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : entity?.is_held ? (
            <p>Recommendation is not available for this run yet.</p>
          ) : (strongUnheldMatch || verdict?.signal === 'Strong') ? (
            <div className="ai-bot-watchlist-opportunity">
              <strong>💡 Opportunity Candidate</strong>
              <p>{opportunityReason}</p>
              {matchingSector && (
                <div className="ai-bot-sector-gap-row">
                  <span>Sector Gap</span>
                  <strong>{matchingSector.sector}</strong>
                  <em>{Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% current allocation</em>
                </div>
              )}
              <p className="ai-bot-verdict-caption">
                Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.
              </p>
            </div>
          ) : verdict?.signal === 'Weak' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
              <strong>⛔ Not Recommended</strong>
              <p>Watchlist asset underperforming its peer group. Not recommended for portfolio inclusion at this time.</p>
            </div>
          ) : verdict?.signal === 'Mixed' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-mixed">
              <strong>👁️ Monitor Only</strong>
              <p>Watchlist asset showing mixed peer performance. Monitor for trend confirmation before considering entry.</p>
            </div>
          ) : verdict?.signal === 'Insufficient Data' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
              <strong>📊 Insufficient Data</strong>
              <p>Insufficient peer comparison history to formulate an entry thesis.</p>
            </div>
          ) : (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
              <strong>📋 No Active Thesis</strong>
              <p>No active entry or rotation thesis for this watchlist asset.</p>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
