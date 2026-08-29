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
type Verdict = { holding_ticker: string; holding_return_percent: number | null; signal: string; coverage_percent: number | null; technical_signal?: { trend: string; confidence: number | null; patterns: Array<{ name: string; direction: string }> } | null; data_quality?: { comparable_with_return_count: number; comparable_count: number } };
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
  model_used: string;
  generated_at: string;
};

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
  const [runId, setRunId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<'held' | 'all'>('held');
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
        const [snapshotData, signalData, verdictData, recommendationData, summaryData] = await Promise.all([
          json<{ snapshots: Snapshot[] }>(`/api/scraper/snapshots${suffix}`),
          json<{ signals: TechnicalSignal[] }>(`/api/technical-signals${suffix}`).catch(() => ({ signals: [] })),
          json<Verdict[]>(`/api/rotation-verdicts${suffix}${suffix ? '&' : '?'}all=true`).catch(() => []),
          status.runId === null ? Promise.resolve([] as Recommendation[]) : json<Recommendation[]>(`/api/advisor/recommendations${suffix}`).catch(() => []),
          status.runId === null ? Promise.resolve(null) : json<PortfolioSummary>(`/api/portfolio-summary${suffix}`).catch(() => null),
        ]);
        const entitySnapshots = snapshotData.snapshots.filter((snapshot) => snapshot.entity_type === 'fund' || snapshot.entity_type === 'stock' || snapshot.entity_type === 'index');
        if (entitySnapshots.length > 0) hasEntityDataRef.current = true;
        setSnapshots(entitySnapshots);
        setSignals(signalData.signals);
        setVerdicts(verdictData);
        setRecommendations(recommendationData);
        setPortfolioSummary(summaryData);
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
  const trendDown = signal?.trend === 'downtrend';

  // Analyze strong unheld entities as opportunities
  const opportunities = useMemo(() => {
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
  }, [verdicts, allEntities]);
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
          {verdict ? <><div className={`ai-bot-verdict-pill ai-bot-verdict-${slugify(verdict.signal)}`}>{verdict.signal}{verdict.coverage_percent !== null ? ` (${verdict.coverage_percent.toFixed(1)}% coverage)` : ''}</div><p>{verdict.data_quality?.comparable_with_return_count ?? 0} of {verdict.data_quality?.comparable_count ?? 0} comparable results have usable returns.</p>{verdict.technical_signal && <div className="ai-bot-inline-signal">Chart evidence: <b>{verdict.technical_signal.trend}</b>{verdict.technical_signal.patterns.length ? ` / ${verdict.technical_signal.patterns[0].name}` : ''}</div>}</> : <p>No comparison result is available for this entity yet.</p>}
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
                <h4 className="ai-bot-summary-title">Analysis</h4>
                <p className="ai-bot-recommendation">{portfolioSummary.summary_text}</p>
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
        <article className="ai-bot-panel ai-bot-advice-panel">{recommendation ? <><p className="ai-bot-recommendation">{recommendation.recommendation_text}</p><small>{recommendation.model_used} / {new Date(recommendation.generated_at).toLocaleDateString()}</small></> : entity?.is_held ? <p>Recommendation is not available for this run yet.</p> : verdict?.signal === 'Strong' ? <><p className="ai-bot-opportunity-label">💡 Opportunity Candidate</p><p>{verdict?.coverage_percent !== null ? `Strong signal with ${verdict.coverage_percent.toFixed(1)}% comparable coverage.` : 'Strong signal detected. Consider for portfolio inclusion.'}</p></> : <p>Smart Advisor recommendations are generated for held positions only.</p>}</article>
      </section>
    </section>
  );
}
