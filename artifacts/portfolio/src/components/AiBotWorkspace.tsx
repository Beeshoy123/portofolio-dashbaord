import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Brain, Gauge, List, RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { supabase } from '../lib/supabaseClient';
import { type Lang, getSavedLang, translateEntityName, translateSector } from '../lib/i18n';

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
  holding_fundamentals?: {
    flags?: Array<{ flag: string; detail: string }>;
  } | null;
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
  ticker?: string;
  is_stagnant: boolean;
  days_in_current_state?: number;
  stagnant_days?: number | null;
  threshold_days?: number;
  message?: string;
};

type ThesisAlert = {
  watchlist_id?: number;
  ticker?: string;
  has_reversal: boolean;
  signal_degraded?: boolean;
  prior_signal?: string;
  current_signal?: string;
  message?: string;
};

type DrawdownAlert = {
  current_drawdown_percent?: number | null;
  drawdown_percent?: number | null;
  peak_value?: number;
  current_value?: number;
  is_elevated?: boolean;
  is_alert?: boolean;
};

type AlertsSummary = {
  timeStops?: TimeStopAlert[];
  theses?: ThesisAlert[];
  drawdown?: DrawdownAlert | null;
  alerts?: Record<string, { timeStop?: TimeStopAlert; thesis?: ThesisAlert }>;
  portfolio?: {
    drawdown?: DrawdownAlert | null;
  };
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
    comparables_beaten?: number;
    comparables_total?: number;
    absolute_return_positive?: boolean;
    fundamentals_flags?: string[];
    confidence_tier?: "high" | "moderate" | "low";
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
      comparables_beaten?: number;
      comparables_total?: number;
      absolute_return_positive?: boolean;
      fundamentals_flags?: string[];
      confidence_tier?: "high" | "moderate" | "low";
    }>;
  }>;
};

const VERDICT_FLAG_MAP: Record<string, { en: string; ar: string; category: 'info' | 'warning' }> = {
  thin_comparable_sample: { en: 'Thin sample', ar: 'عينة محدودة', category: 'info' },
  underperforming_comparables: { en: 'Underperforming peers', ar: 'أداء دون النظراء', category: 'warning' },
  incomplete_comparison_data: { en: 'Incomplete data', ar: 'بيانات غير مكتملة', category: 'info' },
  risk_mismatch: { en: 'Risk mismatch', ar: 'عدم تطابق المخاطر', category: 'warning' },
  technical_divergence: { en: 'Diverging from trend', ar: 'تباعد عن الاتجاه', category: 'warning' },
  reversal_risk_elevated: { en: 'Reversal risk', ar: 'مخاطر انعكاس', category: 'warning' },
  no_comparable_return_data: { en: 'No peer returns', ar: 'لا توجد عوائد للنظراء', category: 'warning' },
  missing_return_1y_return: { en: 'Missing 1Y return', ar: 'عائد سنة مفقود', category: 'info' },
  missing_return_6m_return: { en: 'Missing 6M return', ar: 'عائد 6 أشهر مفقود', category: 'info' },
  missing_return_3m_return: { en: 'Missing 3M return', ar: 'عائد 3 أشهر مفقود', category: 'info' },
  high_debt_load: { en: 'High debt', ar: 'ديون مرتفعة', category: 'warning' },
  weak_short_term_liquidity: { en: 'Weak liquidity', ar: 'سيولة ضعيفة', category: 'warning' },
  negative_free_cash_flow: { en: 'Negative FCF', ar: 'تدفق نقدي حر سالب', category: 'warning' },
  high_pe_priced_for_growth: { en: 'High P/E', ar: 'مكرر ربحية مرتفع', category: 'warning' },
  shareholder_dilution: { en: 'Dilution', ar: 'تخفيف الأسهم', category: 'warning' },
  low_return_on_equity: { en: 'Low ROE', ar: 'عائد منخفض على الملكية', category: 'warning' },
  shrinking_revenue: { en: 'Shrinking revenue', ar: 'انكماش الإيرادات', category: 'warning' },
};

function getVerdictFlagMeta(flag: string, lang: Lang): { label: string; category: 'info' | 'warning' } {
  if (VERDICT_FLAG_MAP[flag]) {
    const item = VERDICT_FLAG_MAP[flag];
    return {
      label: lang === 'ar' ? item.ar : item.en,
      category: item.category,
    };
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

function getGroupTypeLabel(type: string, lang: Lang): string {
  if (lang === 'ar') {
    switch (type) {
      case 'sector_sibling':
        return 'نظراء القطاع (صناديق في نفس القطاع)';
      case 'manager_sibling':
        return 'أصول نفس المدير (نفس مدير الصندوق)';
      case 'direct_stock':
        return 'بدائل الأسهم (أسهم مباشرة)';
      case 'benchmark':
        return 'مؤشرات السوق (المؤشرات القياسية)';
      default:
        return type.replace(/_/g, ' ');
    }
  }
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

function formatGap(gap: number | null | undefined, lang: Lang): { text: string; className: string } {
  if (gap === null || gap === undefined || !Number.isFinite(Number(gap))) {
    return { text: '—', className: '' };
  }
  const num = Number(gap);
  const isAhead = num >= 0;
  const unit = lang === 'ar' ? 'نقطة مئوية' : 'pp';
  const direction = isAhead ? (lang === 'ar' ? 'متقدم' : 'ahead') : (lang === 'ar' ? 'متأخر' : 'behind');
  return {
    text: `${isAhead ? '+' : ''}${num.toFixed(1)} ${unit} ${direction}`,
    className: isAhead ? 'comparison-gap-ahead' : 'comparison-gap-behind',
  };
}

function formatPeriodLabel(period?: string, lang: Lang = 'en'): string {
  if (lang === 'ar') {
    if (period === 'return_6m') return 'عائد 6 أشهر';
    if (period === 'return_3m') return 'عائد 3 أشهر';
    return 'عائد سنة واحدة';
  }
  if (period === 'return_6m') return '6-Month Return';
  if (period === 'return_3m') return '3-Month Return';
  return '1-Year Return';
}

function getDecisionMeta(decision?: string, lang: Lang = 'en'): { label: string; className: string } {
  if (lang === 'ar') {
    switch (decision) {
      case 'consider_entry':
        return { label: 'دراسة الدخول', className: 'ai-bot-decision-entry' };
      case 'consider_rotation':
        return { label: 'دراسة التدوير', className: 'ai-bot-decision-rotation' };
      case 'watch_and_wait':
        return { label: 'المراقبة والانتظار', className: 'ai-bot-decision-watch' };
      case 'hold':
        return { label: 'احتفاظ', className: 'ai-bot-decision-hold' };
      case 'watch':
        return { label: 'مراقبة', className: 'ai-bot-decision-watch' };
      case 'rebalance':
        return { label: 'إعادة توازن', className: 'ai-bot-decision-rotation' };
      default:
        return { label: decision ? decision.replace(/_/g, ' ') : 'احتفاظ', className: 'ai-bot-decision-hold' };
    }
  }
  switch (decision) {
    case 'consider_entry':
      return { label: 'Consider Entry', className: 'ai-bot-decision-entry' };
    case 'consider_rotation':
      return { label: 'Consider Rotation', className: 'ai-bot-decision-rotation' };
    case 'watch_and_wait':
      return { label: 'Watch & Wait', className: 'ai-bot-decision-watch' };
    case 'hold':
      return { label: 'Hold', className: 'ai-bot-decision-hold' };
    case 'watch':
      return { label: 'Watch', className: 'ai-bot-decision-watch' };
    case 'rebalance':
      return { label: 'Rebalance', className: 'ai-bot-decision-rotation' };
    default:
      return { label: decision ? decision.replace(/_/g, ' ') : 'Hold', className: 'ai-bot-decision-hold' };
  }
}

function formatConfidenceLevel(confidence?: number | null, lang: Lang = 'en'): { label: string; className: string } {
  if (confidence === null || confidence === undefined) return { label: lang === 'ar' ? 'غير مقيَّم' : 'Unrated', className: 'ai-bot-confidence-unrated' };
  if (confidence >= 70) return { label: lang === 'ar' ? `${confidence}% (ثقة عالية)` : `${confidence}% (High Conviction)`, className: 'ai-bot-confidence-high' };
  if (confidence >= 45) return { label: lang === 'ar' ? `${confidence}% (ثقة متوسطة)` : `${confidence}% (Moderate Conviction)`, className: 'ai-bot-confidence-medium' };
  return { label: lang === 'ar' ? `${confidence}% (ثقة منخفضة / بيانات محدودة)` : `${confidence}% (Low Conviction / Data Limited)`, className: 'ai-bot-confidence-low' };
}

function formatTrend(trend: string | undefined, lang: Lang): string {
  if (lang === 'ar') {
    switch (trend) {
      case 'uptrend': return 'اتجاه صاعد';
      case 'downtrend': return 'اتجاه هابط';
      case 'sideways': return 'اتجاه عرضي';
      default: return 'لا يوجد اتجاه واضح';
    }
  }
  switch (trend) {
    case 'uptrend': return 'Uptrend';
    case 'downtrend': return 'Downtrend';
    case 'sideways': return 'Sideways';
    default: return trend || 'No trend';
  }
}

function formatRiskTier(tier: string | null | undefined, lang: Lang): string {
  if (!tier) return '—';
  if (lang === 'ar') {
    if (tier === 'Low') return 'منخفض';
    if (tier === 'Medium') return 'متوسط';
    if (tier === 'High') return 'مرتفع';
    return tier;
  }
  return tier;
}

function formatSignal(signal: string | null | undefined, lang: Lang): string {
  if (!signal) return '—';
  if (lang === 'ar') {
    if (signal === 'Strong') return 'قوي';
    if (signal === 'Mixed') return 'مختلط';
    if (signal === 'Weak') return 'ضعيف';
    if (signal === 'Insufficient Data') return 'بيانات غير كافية';
    return signal;
  }
  return signal;
}

function formatModelName(model?: string | null, lang: Lang = 'en'): string {
  if (!model) return '';
  if (lang === 'ar') {
    if (model === 'fallback') return 'وضع احتياطي';
    if (model === 'deterministic-fallback') return 'تحليل حسابي احتياطي';
  }
  return model;
}

function formatSummaryText(text: string | undefined | null, lang: Lang): string {
  if (!text) return '';
  if (lang !== 'ar') return text;

  const m1 = text.match(/Portfolio summary could not be generated by AI for this run\. Evaluated (\d+) of (\d+) holdings: (\d+) Strong, (\d+) Mixed, (\d+) Weak, (\d+) Insufficient Data\./i);
  if (m1) {
    const [, succeeded, total, strong, mixed, weak, insufficient] = m1;
    return `تعذر إنشاء ملخص المحفظة عبر الذكاء الاصطناعي لهذا التشغيل. تم تقييم ${succeeded} من أصل ${total} من الحيازات: ${strong} قوي، ${mixed} مختلط، ${weak} ضعيف، ${insufficient} بيانات غير كافية.`;
  }

  const m2 = text.match(/Only (\d+) of (\d+) holdings could be judged this run — not enough data for a reliable portfolio summary\. Retry the run for a complete picture\./i);
  if (m2) {
    const [, succeeded, total] = m2;
    return `تم تقييم ${succeeded} فقط من أصل ${total} من الحيازات في هذا التشغيل — لا توجد بيانات كافية لإنشاء ملخص موثوق للمحفظة. أعد تشغيل التحليل للحصول على صورة كاملة.`;
  }

  return text;
}

function MiniCandleChart({ candles, lang }: { candles: Candle[]; lang: Lang }) {
  const visible = candles.slice(-24);
  if (!visible.length) return <div className="ai-bot-chart-empty">{lang === 'ar' ? 'لا توجد بيانات أسعار تاريخية متاحة.' : 'No OHLC history available.'}</div>;
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

function MarketComparison({ snapshots, lang }: { snapshots: Snapshot[]; lang: Lang }) {
  const groups = [
    [lang === 'ar' ? 'صناديق' : 'Funds', snapshots.filter((snapshot) => snapshot.entity_type === 'fund')],
    [lang === 'ar' ? 'أسهم' : 'Stocks', snapshots.filter((snapshot) => snapshot.entity_type === 'stock')],
    [lang === 'ar' ? 'مؤشرات' : 'Indices', snapshots.filter((snapshot) => snapshot.entity_type === 'index')],
  ] as const;
  const value = (number: number | string | null, suffix = '') => number === null ? '—' : `${Number(number).toFixed(1)}${suffix}`;
  return (
    <div className="ai-bot-market-comparison">
      <div className="ai-bot-market-comparison-heading">
        <div>
          <span>{lang === 'ar' ? 'مقارنة السوق' : 'Market Comparison'}</span>
          <strong>{lang === 'ar' ? 'لقطة شاملة لقائمة المراقبة' : 'Full watchlist snapshot'}</strong>
        </div>
        <small>{lang === 'ar' ? 'مرتبة حسب نوع الأصل' : 'Sorted by entity group'}</small>
      </div>
      {groups.map(([label, group]) => group.length > 0 && (
        <div className="ai-bot-market-group" key={label}>
          <h4>
            {label}
            <small>{group.length} {lang === 'ar' ? 'أصل' : 'entities'}</small>
          </h4>
          <div className="ai-bot-market-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الرمز' : 'Ticker'}</th>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'السعر / NAV' : 'Price / NAV'}</th>
                  <th>{lang === 'ar' ? '30 يوم' : '30d'}</th>
                  <th>{lang === 'ar' ? 'من بداية العام' : 'YTD'}</th>
                  <th>{lang === 'ar' ? 'التقييم' : 'Score'}</th>
                </tr>
              </thead>
              <tbody>
                {group.map((snapshot) => (
                  <tr key={snapshot.ticker}>
                    <td>
                      <strong>{snapshot.ticker}</strong>
                      {snapshot.is_held && <em>{lang === 'ar' ? 'محتفظ به' : 'HELD'}</em>}
                    </td>
                    <td>{translateEntityName(snapshot.name || snapshot.ticker, lang)}</td>
                    <td>{snapshot.nav_or_price === null ? '—' : Number(snapshot.nav_or_price).toLocaleString()}</td>
                    <td className={Number(snapshot.return_30d_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{value(snapshot.return_30d_percent, '%')}</td>
                    <td className={Number(snapshot.return_ytd_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{value(snapshot.return_ytd_percent, '%')}</td>
                    <td>{snapshot.total_score === null ? '—' : `${Number(snapshot.total_score).toFixed(0)}/100`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AiBotWorkspace() {
  const [lang, setLang] = useState<Lang>(() => getSavedLang());
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isOpportunitiesExpanded, setIsOpportunitiesExpanded] = useState(false);
  const hasEntityDataRef = useRef(false);

  const toggleGroupCollapse = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  useEffect(() => {
    const handleLangChange = (event: Event) => {
      const detail = (event as CustomEvent<{ lang?: Lang }>).detail;
      if (detail?.lang === 'ar' || detail?.lang === 'en') {
        setLang(detail.lang);
      } else {
        setLang(getSavedLang());
      }
    };
    window.addEventListener('portfolio-lang-changed', handleLangChange);
    window.addEventListener('storage', handleLangChange);
    return () => {
      window.removeEventListener('portfolio-lang-changed', handleLangChange);
      window.removeEventListener('storage', handleLangChange);
    };
  }, []);

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
  const entityAlertGroup = entity && alertsData?.alerts
    ? (alertsData.alerts[entity.ticker] ||
       alertsData.alerts[entity.ticker.toUpperCase()] ||
       alertsData.alerts[entity.ticker.toLowerCase()] ||
       Object.entries(alertsData.alerts).find(([k]) => k.toUpperCase() === entity.ticker.toUpperCase())?.[1])
    : undefined;
  const entityTimeStop = entity && alertsData
    ? (entityAlertGroup?.timeStop ?? alertsData.timeStops?.find((ts) => ts.ticker?.toUpperCase() === entity.ticker.toUpperCase()))
    : undefined;
  const entityThesis = entity && alertsData
    ? (entityAlertGroup?.thesis ?? alertsData.theses?.find((t) => t.ticker?.toUpperCase() === entity.ticker.toUpperCase()))
    : undefined;
  const portfolioDrawdown = alertsData?.portfolio?.drawdown ?? alertsData?.drawdown;
  const trendDown = signal?.trend === 'downtrend';

  // Analyze strong unheld entities as opportunities
  const opportunities = useMemo(() => {
    const tierWeight: Record<'high' | 'moderate' | 'low', number> = {
      high: 3,
      moderate: 2,
      low: 1,
    };

    const getConfidenceTier = (
      coverage: number | null | undefined,
      beaten: number | undefined,
      total: number | undefined,
    ): 'high' | 'moderate' | 'low' => {
      const cov = coverage ?? 0;
      const winRate = total && total > 0 && beaten !== undefined ? beaten / total : 0;
      if (cov >= 70 && winRate >= 0.75) return 'high';
      if (cov < 50 || winRate < 0.65) return 'low';
      return 'moderate';
    };

    if (opportunitiesData?.strong_unheld && opportunitiesData.strong_unheld.length > 0) {
      return opportunitiesData.strong_unheld.map((v) => {
        const snap = allEntities.find((e) => e.ticker === v.holding_ticker);
        const returnPercent = v.holding_return_percent !== null && v.holding_return_percent !== undefined
          ? v.holding_return_percent
          : (snap?.return_1y_percent !== undefined && snap?.return_1y_percent !== null ? Number(snap.return_1y_percent) : null);
        const isPositive = v.absolute_return_positive !== undefined
          ? v.absolute_return_positive
          : (returnPercent !== null && !isNaN(returnPercent) && returnPercent > 0);
        const matchedVerdict = verdicts.find((item) => item.holding_ticker === v.holding_ticker);
        const fundamentalsFlags = v.fundamentals_flags ?? (matchedVerdict?.holding_fundamentals?.flags?.map((f) => f.flag) ?? []);
        const confidenceTier = v.confidence_tier ?? getConfidenceTier(
          v.coverage_percent ?? matchedVerdict?.coverage_percent,
          v.comparables_beaten ?? matchedVerdict?.comparables_beaten,
          v.comparables_total ?? matchedVerdict?.comparables_total,
        );

        return {
          ticker: v.holding_ticker,
          name: snap?.name || v.holding_name || v.holding_ticker,
          entityType: snap?.entity_type || 'unknown',
          sector: snap?.sector || null,
          score: snap?.total_score ?? null,
          signal: v.signal,
          return_percent: returnPercent,
          absolute_return_positive: isPositive,
          fundamentals_flags: fundamentalsFlags,
          confidence_tier: confidenceTier,
        };
      }).sort((a, b) => {
        if (tierWeight[b.confidence_tier] !== tierWeight[a.confidence_tier]) {
          return tierWeight[b.confidence_tier] - tierWeight[a.confidence_tier];
        }
        if (a.absolute_return_positive === b.absolute_return_positive) return 0;
        return a.absolute_return_positive ? -1 : 1;
      });
    }
    const strongUnheld = verdicts
      .filter((v) => v.signal === 'Strong' && !allEntities.find((e) => e.ticker === v.holding_ticker && e.is_held))
      .map((v) => {
        const snap = allEntities.find((e) => e.ticker === v.holding_ticker);
        const returnPercent = v.holding_return_percent !== null && v.holding_return_percent !== undefined
          ? v.holding_return_percent
          : (snap?.return_1y_percent !== undefined && snap?.return_1y_percent !== null ? Number(snap.return_1y_percent) : null);
        const isPositive = returnPercent !== null && !isNaN(returnPercent) && returnPercent > 0;
        const fundamentalsFlags = v.holding_fundamentals?.flags?.map((f) => f.flag) ?? [];
        const confidenceTier = getConfidenceTier(
          v.coverage_percent,
          v.comparables_beaten,
          v.comparables_total,
        );
        return {
          ticker: v.holding_ticker,
          name: snap?.name || v.holding_ticker,
          entityType: snap?.entity_type || 'unknown',
          sector: snap?.sector || null,
          score: snap?.total_score ?? null,
          signal: v.signal,
          return_percent: returnPercent,
          absolute_return_positive: isPositive,
          fundamentals_flags: fundamentalsFlags,
          confidence_tier: confidenceTier,
        };
      })
      .sort((a, b) => {
        if (tierWeight[b.confidence_tier] !== tierWeight[a.confidence_tier]) {
          return tierWeight[b.confidence_tier] - tierWeight[a.confidence_tier];
        }
        if (a.absolute_return_positive === b.absolute_return_positive) return 0;
        return a.absolute_return_positive ? -1 : 1;
      });
    return strongUnheld;
  }, [opportunitiesData, verdicts, allEntities]);

  const strongUnheldMatch = entity && !entity.is_held
    ? opportunitiesData?.strong_unheld?.find(
        (item) => item.holding_ticker?.toUpperCase() === entity.ticker?.toUpperCase()
      )
    : undefined;

  const matchingSector = strongUnheldMatch
    ? opportunitiesData?.underrepresented_sectors?.find((sec) =>
        sec.strong_candidates?.some(
          (cand) => cand.holding_ticker?.toUpperCase() === entity.ticker?.toUpperCase()
        )
      )
    : undefined;

  const opportunityReason = matchingSector
    ? (lang === 'ar'
        ? `يسد فجوة في قطاع ${translateSector(matchingSector.sector, lang)} (يمثل حالياً ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% فقط من المحفظة)`
        : `Fills gap in ${translateSector(matchingSector.sector, lang)} (currently only ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% of portfolio)`)
    : verdict?.coverage_percent !== null && verdict?.coverage_percent !== undefined
      ? (lang === 'ar'
          ? `إشارة قوية بتغطية مقارنة بنسبة ${Number(verdict.coverage_percent).toFixed(1)}%.`
          : `Strong signal with ${Number(verdict.coverage_percent).toFixed(1)}% comparable coverage.`)
      : (lang === 'ar'
          ? 'تم رصد إشارة قوية. مرشح للنظر في إضافته للمحفظة.'
          : 'Strong signal detected. Consider for portfolio inclusion.');

  const fundamentals = entity?.entity_type === 'stock' ? [
    [lang === 'ar' ? 'مكرر الربحية (P/E)' : 'P/E', metric(entity.pe_ratio)],
    [lang === 'ar' ? 'مكرر الربحية المستقبلي' : 'Forward P/E', metric(entity.forward_pe)],
    [lang === 'ar' ? 'العائد على حقوق الملكية' : 'ROE', metric(entity.roe_percent, '%')],
    [lang === 'ar' ? 'الديون / حقوق الملكية' : 'Debt / Equity', metric(entity.debt_to_equity)],
    [lang === 'ar' ? 'نسبة التداول' : 'Current ratio', metric(entity.current_ratio)],
    [lang === 'ar' ? 'نمو الإيرادات' : 'Revenue growth', metric(entity.revenue_growth_percent, '%')],
    [lang === 'ar' ? 'عائد التوزيعات' : 'Dividend yield', metric(entity.dividend_yield_percent, '%')],
    [lang === 'ar' ? 'معامل بيتا' : 'Beta', metric(entity.beta)],
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
          <div className="ai-bot-workspace-brand">
            <span className="ai-bot-workspace-icon"><Brain /></span>
            <div>
              <span className="ai-bot-eyebrow">{lang === 'ar' ? 'بوت الذكاء الاصطناعي / تحليل الأصول' : 'AI Bot / entity intelligence'}</span>
              <h2>{lang === 'ar' ? 'مكتب التوصيات المركّز' : 'Focused recommendation desk'}</h2>
              <p>{lang === 'ar' ? 'السعر والرسم البياني والمقارنة والتوصيات لكل أصل على حدة.' : 'Price, chart, comparison, and advice for one entity at a time.'}</p>
            </div>
          </div>
          <div className="ai-bot-run-state">
            <span />
            <span>{lang === 'ar' ? `تشغيل ${runId ?? 'الأحدث'}` : `Run ${runId ?? 'latest'}`}</span>
          </div>
        </header>
        <section className="ai-bot-engine ai-bot-market-engine">
          <div className="ai-bot-engine-header">
            <div><h3>{lang === 'ar' ? 'ذكاء السوق' : 'Market Intelligence'}</h3></div>
            <Gauge />
          </div>
          {error && <div className="ai-bot-workspace-state"><span>{error}</span></div>}
        </section>
        <section className="ai-bot-engine ai-bot-comparison-engine">
          <div className="ai-bot-engine-header">
            <div>
              <h3>{lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge'}</h3>
              <p>{lang === 'ar' ? 'المركز النسبي مقارنة بالنظراء والمؤشرات القياسية.' : 'Relative position against peers and benchmarks.'}</p>
            </div>
            <Activity />
          </div>
          <article className="ai-bot-panel ai-bot-verdict-panel">
            <p>{lang === 'ar' ? 'ستظهر نتائج المقارنة هنا عندما يوفر هذا التشغيل بيانات سوقية قابلة للاستخدام.' : 'Comparison results will appear here when this run provides usable market data.'}</p>
          </article>
        </section>
        <section className="ai-bot-engine ai-bot-advisor-engine">
          <div className="ai-bot-engine-header">
            <div>
              <h3>{lang === 'ar' ? 'المستشار الذكي' : 'Smart Advisor'}</h3>
              <p>{lang === 'ar' ? 'التوصية النهائية بناءً على التحليل المكتمل.' : 'Final recommendation based on the completed analysis.'}</p>
            </div>
            <Brain />
          </div>
          <article className="ai-bot-panel ai-bot-advice-panel">
            <p>{lang === 'ar' ? 'ستظهر التوصيات بعد اكتمال حكم المقارنة.' : 'Recommendations will appear after the Comparison Judge completes.'}</p>
          </article>
        </section>
      </section>
    );
  }

  return (
    <section className="ai-bot-workspace">
      <header className="ai-bot-workspace-header">
        <div className="ai-bot-workspace-brand">
          <span className="ai-bot-workspace-icon"><Brain /></span>
          <div>
            <span className="ai-bot-eyebrow">{lang === 'ar' ? 'بوت الذكاء الاصطناعي / تحليل الأصول' : 'AI Bot / entity intelligence'}</span>
            <h2>{lang === 'ar' ? 'مكتب التوصيات المركّز' : 'Focused recommendation desk'}</h2>
            <p>{lang === 'ar' ? 'السعر والرسم البياني والمقارنة والتوصيات لكل أصل على حدة.' : 'Price, chart, comparison, and advice for one entity at a time.'}</p>
          </div>
        </div>
        <div className="ai-bot-run-state">
          <span />
          <span>{lang === 'ar' ? `تشغيل ${runId ?? 'الأحدث'}` : `Run ${runId ?? 'latest'}`}</span>
        </div>
      </header>

      <nav className="ai-bot-entity-nav" aria-label={lang === 'ar' ? 'التنقل بين الأصول' : 'Entity navigation'}>
        <div className="ai-bot-entity-filters">
          <button
            type="button"
            className={`ai-bot-filter-btn ${filterMode === 'held' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('held')}
          >
            {lang === 'ar' ? `المحتفظ بها (${heldEntities.length})` : `Held (${heldEntities.length})`}
          </button>
          <button
            type="button"
            className={`ai-bot-filter-btn ${filterMode === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            {lang === 'ar' ? `الكل (${allEntities.length})` : `All (${allEntities.length})`}
          </button>
        </div>
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={selectedIndex === 0}
          aria-label={lang === 'ar' ? 'الأصل السابق' : 'Previous entity'}
        >
          {lang === 'ar' ? <ArrowRight /> : <ArrowLeft />}
        </button>
        <div className="ai-bot-entity-current">
          <span>{lang === 'ar' ? `أصل ${selectedIndex + 1} من ${displayedEntities.length}` : `Entity ${selectedIndex + 1} of ${displayedEntities.length}`}</span>
          <strong>{entity?.ticker || '—'}</strong>
          <small>{entity?.name ? translateEntityName(entity.name, lang) : (lang === 'ar' ? 'لم يتم تحديد أي أصل' : 'No entity selected')}</small>
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={selectedIndex === displayedEntities.length - 1}
          aria-label={lang === 'ar' ? 'الأصل التالي' : 'Next entity'}
        >
          {lang === 'ar' ? <ArrowLeft /> : <ArrowRight />}
        </button>
      </nav>

      <div className="ai-bot-entity-summary">
        <div>
          <span>{lang === 'ar' ? 'سعر السوق / NAV' : 'Market price / NAV'}</span>
          <strong>{entity.nav_or_price === null ? '—' : Number(entity.nav_or_price).toLocaleString()}</strong>
        </div>
        <div>
          <span>{lang === 'ar' ? 'عائد 30 يوم' : '30 day return'}</span>
          <strong className={Number(entity.return_30d_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{pct(entity.return_30d_percent)}</strong>
        </div>
        <div>
          <span>{lang === 'ar' ? 'العائد منذ بداية العام' : 'YTD return'}</span>
          <strong className={Number(entity.return_ytd_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{pct(entity.return_ytd_percent)}</strong>
        </div>
        <div>
          <span>{lang === 'ar' ? 'المخاطر / الإشارة' : 'Risk / signal'}</span>
          <strong>
            {formatRiskTier(entity.risk_level, lang)}{' '}
            <em>{formatSignal(entity.signal, lang)}</em>
          </strong>
        </div>
      </div>

      <section className="ai-bot-engine ai-bot-market-engine">
        <div className="ai-bot-engine-header">
          <div><h3>{lang === 'ar' ? 'ذكاء السوق' : 'Market Intelligence'}</h3></div>
          <div className="ai-bot-engine-actions">
            <button
              type="button"
              className="ai-bot-market-button"
              onClick={() => setShowMarketComparison((visible) => !visible)}
            >
              {showMarketComparison ? <X /> : <List />} {showMarketComparison ? (lang === 'ar' ? 'إغلاق المقارنة' : 'Close comparison') : (lang === 'ar' ? 'مقارنة السوق' : 'Market comparison')}
            </button>
            <Gauge />
          </div>
        </div>
        {fundamentals.length > 0 && (
          <section className="ai-bot-fundamentals">
            <div className="ai-bot-fundamentals-heading">
              <div>
                <span>{lang === 'ar' ? 'البيانات الأساسية' : 'Fundamentals'}</span>
                <strong>{lang === 'ar' ? 'لقطة تحليل الأسهم' : 'StockAnalysis snapshot'}</strong>
              </div>
              <small>{lang === 'ar' ? 'أحدث بيانات الإفصاح المتاحة' : 'Latest available filing data'}</small>
            </div>
            <div className="ai-bot-fundamentals-grid">
              {fundamentals.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="ai-bot-analysis-grid">
          <article className="ai-bot-panel ai-bot-price-panel">
            <div className="ai-bot-panel-heading">
              <div>
                <h3>{lang === 'ar' ? 'فاحص الأسعار' : 'Price Checker'}</h3>
                <span>{lang === 'ar' ? 'لقطة السوق' : 'Market snapshot'}</span>
              </div>
              <Gauge />
            </div>
            <div className="ai-bot-price-main">
              <strong>{pct(entity.return_1y_percent)}</strong>
              <span>{lang === 'ar' ? 'عائد سنة واحدة' : '1 year return'}</span>
            </div>
            <div className="ai-bot-price-details">
              <span>{lang === 'ar' ? 'القطاع' : 'Sector'} <b>{translateSector(entity.sector, lang)}</b></span>
              <span>{lang === 'ar' ? 'التقييم' : 'Score'} <b>{entity.total_score === null ? '—' : `${Number(entity.total_score).toFixed(0)}/100`}</b></span>
              <span>{lang === 'ar' ? 'تم التحديث' : 'Updated'} <b>{entity.scraped_at ? new Date(entity.scraped_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '—'}</b></span>
            </div>
          </article>
          <article className="ai-bot-panel ai-bot-chart-panel">
            <div className="ai-bot-panel-heading">
              <div>
                <h3>{lang === 'ar' ? 'قارئ الرسم البياني' : 'Chart Reader'}</h3>
                <span>{lang === 'ar' ? 'سياق الشموع اليابانية' : 'Candlestick context'}</span>
              </div>
              {trendDown ? <TrendingDown /> : <TrendingUp />}
            </div>
            <MiniCandleChart candles={signal?.candles ?? []} lang={lang} />
            <div className="ai-bot-chart-footer">
              <span
                className={trendDown ? 'ai-negative' : 'ai-positive'}
                title={signal?.reversal_risk && signal.reversal_risk !== 'none' ? (lang === 'ar' ? 'ملاحظة مبنية على النماذج الفنية وليست توقعاً حتمياً.' : 'Pattern-based observation, not a prediction.') : undefined}
              >
                {formatTrend(signal?.trend, lang)}
                {signal?.reversal_risk && signal.reversal_risk !== 'none'
                  ? ` · ${lang === 'ar' ? (signal.reversal_risk === 'watch' ? 'مراقبة انعكاس' : 'تحذير انعكاس') : `Reversal ${signal.reversal_risk === 'watch' ? 'Watch' : 'Alert'}`}`
                  : ''}
              </span>
              <span>{signal?.candle_date ?? (lang === 'ar' ? 'لا يوجد تاريخ شمعة' : 'No candle date')}</span>
            </div>
          </article>
        </div>
        <Dialog open={showMarketComparison} onOpenChange={setShowMarketComparison}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <MarketComparison snapshots={snapshots} lang={lang} />
          </DialogContent>
        </Dialog>
        <article className="ai-bot-panel ai-bot-verdict-panel">
          <div className="ai-bot-panel-heading">
            <div>
              <h3>{lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge'}</h3>
              <span>{lang === 'ar' ? 'الأصل المحدد' : 'Selected entity'}</span>
            </div>
            <Activity />
          </div>
          {verdict ? (
            <>
              {/* Feature 5: Holding Metadata Header */}
              <div className="ai-bot-verdict-section ai-bot-verdict-header-section">
                <div className="comparison-holding-header">
                  <div>
                    <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'الأصل المُقيَّم' : 'Evaluated Asset'}</span>
                    <h4 className="comparison-holding-name">
                      {translateEntityName(verdict.holding_name || entity.name || verdict.holding_ticker, lang)} <span>({verdict.holding_ticker})</span>
                    </h4>
                    <div className="comparison-holding-meta">
                      <span><b>{formatPeriodLabel(verdict.return_period, lang)}:</b> <strong>{pct(verdict.holding_return_percent)}</strong></span>
                      {verdict.holding_risk_tier && (
                        <span><b>{lang === 'ar' ? 'مستوى المخاطر:' : 'Risk Tier:'}</b> {formatRiskTier(verdict.holding_risk_tier, lang)}</span>
                      )}
                      {verdict.holding_current_value_egp !== null && verdict.holding_current_value_egp !== undefined && (
                        <span><b>{lang === 'ar' ? 'المركز:' : 'Position:'}</b> {Number(verdict.holding_current_value_egp).toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                      )}
                      {verdict.data_quality?.holding_snapshot_status && (
                        <span className={`ai-bot-snapshot-badge ai-bot-snapshot-${verdict.data_quality.holding_snapshot_status}`}>
                          {lang === 'ar'
                            ? `اللقطة: ${verdict.data_quality.holding_snapshot_status === 'fresh' ? 'حديثة' : verdict.data_quality.holding_snapshot_status === 'stale' ? 'قديمة' : verdict.data_quality.holding_snapshot_status === 'missing' ? 'مفقودة' : 'فاشلة'}${verdict.data_quality.holding_snapshot_age_hours !== null && verdict.data_quality.holding_snapshot_age_hours !== undefined ? ` (منذ ${verdict.data_quality.holding_snapshot_age_hours.toFixed(0)} س)` : ''}`
                            : `Snapshot: ${verdict.data_quality.holding_snapshot_status}${verdict.data_quality.holding_snapshot_age_hours !== null && verdict.data_quality.holding_snapshot_age_hours !== undefined ? ` (${verdict.data_quality.holding_snapshot_age_hours.toFixed(0)}h ago)` : ''}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="ai-bot-verdict-caption">
                  {lang === 'ar'
                    ? `المؤشرات الأساسية لهذه الحيازة خلال فترة التقييم (${formatPeriodLabel(verdict.return_period, lang)}).`
                    : `Baseline metrics for this holding over the ${formatPeriodLabel(verdict.return_period, 'en').toLowerCase()} evaluation window.`}
                </p>
              </div>

              {/* Features 3, 2, 6: Signal Verdict Pill, Win/Loss Tally, Coverage */}
              <div className="ai-bot-verdict-section ai-bot-verdict-signal-section">
                <div className="ai-bot-verdict-signal-row">
                  <div className={`ai-bot-verdict-pill ai-bot-verdict-${slugify(verdict.signal)}`}>
                    {formatSignal(verdict.signal, lang)}
                  </div>
                  {verdict.coverage_percent !== null && (
                    <span className="ai-bot-coverage-badge">
                      {lang === 'ar' ? `تغطية ${verdict.coverage_percent.toFixed(1)}%` : `${verdict.coverage_percent.toFixed(1)}% Coverage`}
                    </span>
                  )}
                </div>

                {verdict.comparables_total !== undefined && verdict.comparables_total > 0 ? (
                  <div className="ai-bot-verdict-peers-tally">
                    <span className="ai-bot-tally-chip ai-bot-tally-win">
                      {lang === 'ar' ? `✅ تفوق على ${verdict.comparables_beaten ?? 0}` : `✅ ${verdict.comparables_beaten ?? 0} Beat`}
                    </span>
                    <span className="ai-bot-tally-chip ai-bot-tally-loss">
                      {lang === 'ar'
                        ? `❌ تأخر عن ${Math.max(0, (verdict.comparables_total ?? 0) - (verdict.comparables_beaten ?? 0))}`
                        : `❌ ${Math.max(0, (verdict.comparables_total ?? 0) - (verdict.comparables_beaten ?? 0))} Lost`}
                    </span>
                    <span className="ai-bot-tally-text">
                      {lang === 'ar'
                        ? `من إجمالي ${verdict.comparables_total} من النظراء المماثلين ببيانات عوائد`
                        : `out of ${verdict.comparables_total} comparable peers with return data`}
                    </span>
                  </div>
                ) : (
                  <p className="ai-bot-verdict-peers">
                    {lang === 'ar'
                      ? 'لم يتم العثور على نظراء مماثلين لديهم بيانات عوائد لفترة التقييم هذه.'
                      : 'No comparable peers with return data found for this evaluation period.'}
                  </p>
                )}

                <p className="ai-bot-verdict-caption">
                  {lang === 'ar'
                    ? 'تُشتق الإشارة من نسبة التفوق المباشر مقارنة بالنظراء (≥60% فوز = قوي، 40–59% = مختلط، <40% = ضعيف). تقيس التغطية نسبة النظراء الذين تتوفر لديهم بيانات عوائد صالحة — التغطية الأعلى تعني موثوقية إحصائية أكبر.'
                    : 'Signal is derived from the head-to-head win rate against comparable peers (≥60% wins = Strong, 40–59% = Mixed, <40% = Weak). Coverage measures the percentage of peers with usable return data — higher coverage indicates greater statistical reliability.'}
                </p>
              </div>

              {/* Feature 8: Technical Divergence Warning Callout */}
              {(verdict.flags?.includes('technical_divergence') ||
                (verdict.signal === 'Strong' && (verdict.technical_signal?.trend === 'downtrend' || signal?.trend === 'downtrend'))) && (
                <div className="comparison-warning ai-bot-callout-warning">
                  <span>⚠️</span>
                  <div>
                    <strong>{lang === 'ar' ? 'تباعد فني:' : 'Technical Divergence:'}</strong>
                    <p>
                      {lang === 'ar'
                        ? 'يتفوق هذا الأصل على نظرائه في العوائد، لكن الرسم البياني في مسار هابط. ترسل بيانات أداء النظراء وحركة السعر إشارات متضاربة — انتظر تأكيد الرسم البياني قبل اتخاذ قرار بناءً على التقييم القوي.'
                        : 'This holding beats its peers on returns, but the price chart is in a downtrend. Peer performance data and price action are sending conflicting signals — wait for the chart to confirm before acting on the Strong verdict.'}
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
                      <strong>
                        {lang === 'ar'
                          ? `مخاطر انعكاس الرسم البياني: ${isElevated ? 'مرتفعة' : 'مراقبة'}`
                          : `Chart Reversal Risk: ${isElevated ? 'Elevated' : 'Watch'}`}
                      </strong>
                      <p>
                        {lang === 'ar'
                          ? 'تم اكتشاف نماذج شموع هبوطية أثناء اتجاه صاعد نشط. اعتبر هذا تنبيهاً احترازياً حتى لو كانت المقارنة بالنظراء قوية.'
                          : 'Bearish candlestick patterns detected in an active uptrend. Consider this a caution flag even if the peer comparison is strong.'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Feature 4: Diagnostic Warning Flags */}
              {verdict.flags && verdict.flags.length > 0 && (
                <div className="ai-bot-verdict-section ai-bot-verdict-flags-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'تنبيهات تشخيصية' : 'Diagnostic Alerts'}</span>
                  <div className="ai-bot-verdict-flags">
                    {verdict.flags.map((flag) => {
                      const meta = getVerdictFlagMeta(flag, lang);
                      return (
                        <span key={flag} className={`ai-bot-flag-chip ai-bot-flag-${meta.category}`}>
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="ai-bot-verdict-caption">
                    {lang === 'ar'
                      ? 'تظهر هذه التنبيهات التشخيصية تلقائياً عندما يكتشف النظام فجوات في البيانات أو قيوداً على حجم العينة أو تعارضاً في الإشارات.'
                      : 'These diagnostic alerts are raised automatically when the system detects data gaps, sample size limitations, or signal conflicts.'}
                  </p>
                  <p className="ai-bot-verdict-data-quality">
                    {lang === 'ar'
                      ? `اكتمال البيانات: ${verdict.data_quality?.comparable_with_return_count ?? 0} من ${verdict.data_quality?.comparable_count ?? 0} أصل مماثل لديه تاريخ عوائد قابل للاستخدام.`
                      : `Data completeness: ${verdict.data_quality?.comparable_with_return_count ?? 0} of ${verdict.data_quality?.comparable_count ?? 0} comparable assets have usable return history.`}
                  </p>
                </div>
              )}
              {/* Feature 1: Peer Group Breakdown Cards */}
              <div className="ai-bot-verdict-section ai-bot-verdict-groups-section">
                <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'تفصيل مجموعات النظراء' : 'Peer Group Breakdown'}</span>
                <p className="ai-bot-verdict-caption">
                  {lang === 'ar'
                    ? 'يتم تصنيف النظراء حسب نوع العلاقة. يوضح كل صف عائد النظير وكم نقطة مئوية تتقدم (+) أو تتأخر (−) عنه.'
                    : "Peers are grouped by relationship type. Each row shows a peer's return and how many percentage points ahead (+) or behind (−) you are."}
                </p>

                {verdict.groups && verdict.groups.length > 0 ? (
                  <div className="ai-bot-groups-list">
                    {verdict.groups.map((group) => {
                      const totalRated = group.you_beat_count + group.you_lose_count;
                      const groupKey = `${entity?.ticker || ''}_${group.group_type}`;
                      const isExpanded = Boolean(expandedGroups[groupKey]);
                      const isCollapsed = !isExpanded;
                      return (
                        <div key={group.group_type} className="comparison-group">
                          <div
                            className="comparison-group-header"
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => toggleGroupCollapse(groupKey)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-label={`${getGroupTypeLabel(group.group_type, lang)} - ${isExpanded ? (lang === 'ar' ? 'طي المجموعة' : 'Collapse group') : (lang === 'ar' ? 'توسيع المجموعة' : 'Expand group')}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleGroupCollapse(groupKey);
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="comparison-group-collapse-btn"
                                aria-hidden="true"
                                title={isCollapsed ? (lang === 'ar' ? 'توسيع المجموعة' : 'Expand group') : (lang === 'ar' ? 'طي المجموعة' : 'Collapse group')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupCollapse(groupKey);
                                }}
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: isCollapsed ? (lang === 'ar' ? 'rotate(90deg)' : 'rotate(-90deg)') : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                  }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              <span className="comparison-group-label">{getGroupTypeLabel(group.group_type, lang)}</span>
                            </div>
                            <div className="comparison-group-summary">
                              <span className="ai-bot-tally-chip ai-bot-tally-win">
                                {lang === 'ar' ? `تفوق ${group.you_beat_count} / ${totalRated}` : `Beat ${group.you_beat_count} / ${totalRated}`}
                              </span>
                              {group.incomplete_count > 0 && (
                                <span className="ai-bot-flag-chip ai-bot-flag-info">
                                  {lang === 'ar' ? `${group.incomplete_count} معلق` : `${group.incomplete_count} Pending`}
                                </span>
                              )}
                            </div>
                          </div>

                          {!isCollapsed && (
                            group.entries && group.entries.length > 0 ? (
                              [...group.entries]
                                .sort((a, b) => {
                                  const gapA = a.gap_percent !== null && a.gap_percent !== undefined ? Number(a.gap_percent) : null;
                                  const gapB = b.gap_percent !== null && b.gap_percent !== undefined ? Number(b.gap_percent) : null;
                                  if (gapA !== null && gapB !== null) {
                                    return gapA - gapB;
                                  }
                                  if (gapA !== null) return -1;
                                  if (gapB !== null) return 1;
                                  return a.ticker.localeCompare(b.ticker);
                                })
                                .map((peer) => {
                                const hasReturn = peer.return_percent !== null && peer.return_percent !== undefined;
                                const gapMeta = formatGap(peer.gap_percent, lang);
                                return (
                                  <div
                                    key={peer.ticker}
                                    className={`comparison-evidence-row ${!hasReturn ? 'comparison-evidence-pending' : ''}`}
                                  >
                                    <strong className="comparison-ticker">{peer.ticker}</strong>
                                    <span className="comparison-peer-name" style={{ fontSize: '9px', color: 'var(--dim)', marginInlineStart: '4px' }}>{translateEntityName(peer.ticker, lang)}</span>
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
                                              {formatRiskTier(peer.computed_risk_tier, lang)} {lang === 'ar' ? 'مخاطر' : 'Risk'}
                                            </span>
                                          )}
                                          {peer.risk_mismatch && (
                                            <span
                                              className="ai-bot-flag-chip ai-bot-flag-warning"
                                              title={lang === 'ar' ? 'عدم تطابق في مستوى المخاطر مقارنة بالحيازة' : 'Risk tier mismatch compared to holding'}
                                            >
                                              {lang === 'ar' ? 'عدم تطابق' : 'Mismatch'}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="comparison-pending-label">
                                        {lang === 'ar' ? 'لا توجد بيانات عوائد متاحة بعد لفترة التقييم هذه' : 'No return data available yet for this evaluation window'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="comparison-pending-label" style={{ padding: '8px 0' }}>
                                {lang === 'ar' ? 'لا يوجد نظراء معينون لهذه المجموعة.' : 'No peers assigned to this bucket.'}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="comparison-pending-label" style={{ marginTop: '8px' }}>
                    {lang === 'ar' ? 'لا توجد مجموعات مقارنة نظراء متاحة لهذا الأصل.' : 'No peer comparison groups available for this entity.'}
                  </p>
                )}
              </div>

              {verdict.technical_signal && (
                <div className="ai-bot-inline-signal">
                  {lang === 'ar' ? 'دليل الرسم البياني:' : 'Chart evidence:'} <b>{formatTrend(verdict.technical_signal.trend, lang)}</b>{verdict.technical_signal.patterns.length ? ` / ${verdict.technical_signal.patterns[0].name}` : ''}
                </div>
              )}

              {/* Feature 9: Opportunity Candidate Banner (for un-held entities with Strong signal) */}
              {!entity?.is_held && verdict.signal === 'Strong' && (
                <div className="ai-bot-callout-box ai-bot-callout-opportunity">
                  <strong>{lang === 'ar' ? '💡 فرصة استثمارية مرشحة' : '💡 Opportunity Candidate'}</strong>
                  <p>{opportunityReason}</p>
                  <small className="ai-bot-verdict-caption">
                    {lang === 'ar'
                      ? 'ظهر هذا الأصل لأنه يتفوق على مجموعته النظيرة وقد يوفر فرصة ممتازة للتدوير أو تنويع المحفظة.'
                      : 'Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.'}
                  </small>
                </div>
              )}
            </>
          ) : (
            <p>{lang === 'ar' ? 'لا توجد نتيجة مقارنة متاحة لهذا الأصل بعد.' : 'No comparison result is available for this entity yet.'}</p>
          )}
        </article>
      </section>

      <section className="ai-bot-engine ai-bot-comparison-engine">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge'}</h3>
            <p>{lang === 'ar' ? 'نظرة شاملة على جميع حيازات المحفظة.' : 'Portfolio-wide view across all holdings.'}</p>
          </div>
          <Activity />
        </div>
        <article className="ai-bot-panel ai-bot-verdict-panel">
          {portfolioSummary ? (
            <>
              <div className="ai-bot-summary-section">
                <h4 className="ai-bot-summary-title">{lang === 'ar' ? 'حالة الحيازات' : 'Holdings Status'}</h4>
                <div className="ai-bot-summary-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="ai-bot-summary-row">
                    <span className="text-xs font-semibold text-muted-foreground mr-1.5">{lang === 'ar' ? 'حسب العدد:' : 'By count:'}</span>
                    <span className="ai-bot-summary-holdings">
                      <span className="ai-bot-label-strong">{portfolioSummary.strong_count} {lang === 'ar' ? 'قوي' : 'Strong'}</span>,{' '}
                      <span className="ai-bot-label-mixed">{portfolioSummary.mixed_count} {lang === 'ar' ? 'مختلط' : 'Mixed'}</span>,{' '}
                      <span className="ai-bot-label-weak">{portfolioSummary.weak_count} {lang === 'ar' ? 'ضعيف' : 'Weak'}</span>
                      {portfolioSummary.insufficient_data_count > 0 && <span className="ai-bot-label-insufficient">, {portfolioSummary.insufficient_data_count} {lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'}</span>}
                    </span>
                  </div>
                  {portfolioSummary.strong_value_percent !== null && portfolioSummary.strong_value_percent !== undefined ? (
                    <div className="ai-bot-summary-row">
                      <span className="text-xs font-semibold text-muted-foreground mr-1.5">{lang === 'ar' ? 'حسب القيمة:' : 'By value:'}</span>
                      <span className="ai-bot-summary-holdings">
                        <span className="ai-bot-label-strong">{Number(portfolioSummary.strong_value_percent).toFixed(1)}% {lang === 'ar' ? 'قوي' : 'Strong'}</span>,{' '}
                        <span className="ai-bot-label-mixed">{Number(portfolioSummary.mixed_value_percent).toFixed(1)}% {lang === 'ar' ? 'مختلط' : 'Mixed'}</span>,{' '}
                        <span className="ai-bot-label-weak">{Number(portfolioSummary.weak_value_percent).toFixed(1)}% {lang === 'ar' ? 'ضعيف' : 'Weak'}</span>
                        {Number(portfolioSummary.insufficient_value_percent) > 0 && <span className="ai-bot-label-insufficient">, {Number(portfolioSummary.insufficient_value_percent).toFixed(1)}% {lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'}</span>}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {lang === 'ar'
                        ? 'العرض المرجح بالقيمة غير متاح — قيم الحيازات غير متوفرة لهذا التشغيل'
                        : 'Value-weighted view unavailable — holding values not available for this run'}
                    </p>
                  )}
                </div>
                <div className="ai-bot-summary-aggregates" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '11px', opacity: 0.85 }}>
                  <span className="ai-bot-aggregate-pill">⚑ {portfolioSummary.flagged_count ?? 0} {lang === 'ar' ? 'عليه تنبيه' : 'flagged'}</span>
                  {portfolioSummary.avg_coverage_percent !== null && portfolioSummary.avg_coverage_percent !== undefined && (
                    <span className="ai-bot-aggregate-pill">📊 {lang === 'ar' ? `متوسط تغطية ${Number(portfolioSummary.avg_coverage_percent).toFixed(1)}%` : `avg ${Number(portfolioSummary.avg_coverage_percent).toFixed(1)}% coverage`}</span>
                  )}
                  <span className="ai-bot-aggregate-pill">↩ {portfolioSummary.reversal_risk_count ?? 0} {lang === 'ar' ? 'مخاطر انعكاس' : 'reversal risk'}</span>
                  <span className="ai-bot-aggregate-pill">⚠ {portfolioSummary.divergence_count ?? 0} {lang === 'ar' ? 'تباعد فني' : 'diverging'}</span>
                </div>
              </div>
              
              {opportunities.length > 0 && (
                <div className="ai-bot-opportunities-section">
                  <div
                    className="comparison-group-header"
                    style={{ cursor: 'pointer', userSelect: 'none', marginBottom: isOpportunitiesExpanded ? '10px' : '0' }}
                    onClick={() => setIsOpportunitiesExpanded((prev) => !prev)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpportunitiesExpanded}
                    aria-label={`${lang === 'ar' ? 'الفرص الاستثمارية' : 'Investment Opportunities'} - ${isOpportunitiesExpanded ? (lang === 'ar' ? 'طي القسم' : 'Collapse section') : (lang === 'ar' ? 'توسيع القسم' : 'Expand section')}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpportunitiesExpanded((prev) => !prev);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        tabIndex={-1}
                        className="comparison-group-collapse-btn"
                        aria-hidden="true"
                        title={!isOpportunitiesExpanded ? (lang === 'ar' ? 'توسيع الفرص' : 'Expand opportunities') : (lang === 'ar' ? 'طي الفرص' : 'Collapse opportunities')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpportunitiesExpanded((prev) => !prev);
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: !isOpportunitiesExpanded ? (lang === 'ar' ? 'rotate(90deg)' : 'rotate(-90deg)') : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <h4 className="ai-bot-summary-title" style={{ margin: 0 }}>
                        {lang === 'ar' ? '🎯 الفرص' : '🎯 Opportunities'}
                      </h4>
                    </div>
                    <div className="comparison-group-summary">
                      <span className="ai-bot-tally-chip ai-bot-tally-win">
                        {lang === 'ar' ? `${opportunities.length} مرشحة` : `${opportunities.length} Available`}
                      </span>
                    </div>
                  </div>

                  {isOpportunitiesExpanded && (
                    <div className="ai-bot-opportunities-list">
                      {opportunities.map((opp) => (
                        <div
                          key={opp.ticker}
                          className="ai-bot-opportunity-item"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            const targetIndex = allEntities.findIndex((e) => e.ticker.toUpperCase() === opp.ticker.toUpperCase());
                            if (targetIndex !== -1) {
                              setFilterMode('all');
                              setSelectedIndex(targetIndex);
                            }
                          }}
                          title={lang === 'ar' ? `عرض تحليل ${opp.ticker}` : `View ${opp.ticker} analysis`}
                        >
                          <span className="ai-bot-opp-ticker">{opp.ticker}</span>
                          <span className="ai-bot-opp-name">{translateEntityName(opp.name || opp.ticker, lang)}</span>
                          <span className={`ai-bot-opp-badge ai-bot-opp-badge--${opp.confidence_tier}`}>
                            {lang === 'ar'
                              ? (opp.confidence_tier === 'high'
                                  ? 'إشارة قوية · ثقة عالية'
                                  : opp.confidence_tier === 'low'
                                    ? 'إشارة قوية · ثقة منخفضة'
                                    : 'إشارة قوية · ثقة متوسطة')
                              : (opp.confidence_tier === 'high'
                                  ? 'Strong Signal · High Confidence'
                                  : opp.confidence_tier === 'low'
                                    ? 'Strong Signal · Low Confidence'
                                    : 'Strong Signal · Moderate Confidence')}
                          </span>
                          {!opp.absolute_return_positive && (
                            <span className="ai-bot-opp-subnote">
                              {lang === 'ar' ? 'تفوق على النظراء لكن العائد هابط' : 'Beat peers, but down overall'}
                            </span>
                          )}
                          {opp.fundamentals_flags && opp.fundamentals_flags.length > 0 && (
                            <span
                              className="ai-bot-opp-fundamentals-warning"
                              title={opp.fundamentals_flags.map((f) => getVerdictFlagMeta(f, lang).label).join(', ')}
                            >
                              ⚠ {lang === 'ar'
                                ? `${opp.fundamentals_flags.length} ${opp.fundamentals_flags.length === 1 ? 'ملاحظة مالية' : 'ملاحظات مالية'}`
                                : `${opp.fundamentals_flags.length} fundamentals concern${opp.fundamentals_flags.length === 1 ? '' : 's'}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="ai-bot-summary-analysis">
                <h4 className="ai-bot-summary-title">{lang === 'ar' ? 'قراءة المستشار الشاملة للمحفظة' : 'Portfolio-wide Advisor Read'}</h4>
                {portfolioSummary.decision ? (
                  <>
                    <div className="ai-bot-portfolio-decision-row">
                      <div className={`ai-bot-decision-pill ai-bot-decision-${portfolioSummary.decision}`}>
                        {getDecisionMeta(portfolioSummary.decision, lang).label}
                      </div>
                      {portfolioSummary.confidence !== null && portfolioSummary.confidence !== undefined && (
                        <span className="ai-bot-portfolio-confidence">
                          {lang === 'ar' ? `الثقة: ${portfolioSummary.confidence}%` : `Confidence: ${portfolioSummary.confidence}%`}
                        </span>
                      )}
                    </div>
                    <p className="ai-bot-recommendation">{formatSummaryText(portfolioSummary.summary_text, lang)}</p>
                    {portfolioSummary.evidence && portfolioSummary.evidence.length > 0 && (
                      <div className="ai-bot-portfolio-list-section">
                        <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--evidence">{lang === 'ar' ? 'الأدلة' : 'Evidence'}</span>
                        <ul className="ai-bot-portfolio-list">
                          {portfolioSummary.evidence.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {portfolioSummary.risks && portfolioSummary.risks.length > 0 && (
                      <div className="ai-bot-portfolio-list-section">
                        <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--risks">{lang === 'ar' ? 'المخاطر' : 'Risks'}</span>
                        <ul className="ai-bot-portfolio-list ai-bot-portfolio-list--risks">
                          {portfolioSummary.risks.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {portfolioSummary.next_review_days !== null && portfolioSummary.next_review_days !== undefined && (
                      <p className="ai-bot-portfolio-next-review">
                        {lang === 'ar'
                          ? `مراجعة المحفظة القادمة: خلال ${portfolioSummary.next_review_days} يوم`
                          : `Next portfolio review: in ${portfolioSummary.next_review_days} day${portfolioSummary.next_review_days === 1 ? '' : 's'}`}
                      </p>
                    )}
                  </>
                ) : (
                  // Pre-migration row or fallback path — render summary text only, no pill
                  <p className="ai-bot-recommendation">{formatSummaryText(portfolioSummary.summary_text, lang)}</p>
                )}
              </div>
              
              <small className="ai-bot-summary-meta">{formatModelName(portfolioSummary.model_used, lang)} / {new Date(portfolioSummary.generated_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</small>
            </>
          ) : (
            <p>{lang === 'ar' ? 'سيظهر ملخص المحفظة بعد اكتمال تشغيل حكم المقارنة.' : 'Portfolio summary will appear after Comparison Judge completes for this run.'}</p>
          )}
        </article>
      </section>
      <section className="ai-bot-engine ai-bot-advisor-engine">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'المستشار الذكي' : 'Smart Advisor'}</h3>
            <p>{lang === 'ar' ? 'التوصية النهائية بناءً على التحليل المكتمل.' : 'Final recommendation based on the completed analysis.'}</p>
          </div>
          <Brain />
        </div>
        <article className="ai-bot-panel ai-bot-advice-panel">
          {recommendation ? (
            <div className="ai-bot-advice-report-card">
              {/* 3.1: Decision Pill & Confidence Header */}
              {(() => {
                const inferredDecision = entity?.is_held
                  ? (verdict?.signal === 'Weak' ? 'consider_rotation' : verdict?.signal === 'Mixed' ? 'watch_and_wait' : 'hold')
                  : 'consider_entry';
                const decision = recommendation.structured?.decision || inferredDecision;
                const decisionMeta = getDecisionMeta(decision, lang);
                const confidence = recommendation.structured?.confidence ?? null;
                const confidenceMeta = formatConfidenceLevel(confidence, lang);

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
                      {lang === 'ar'
                        ? 'توصية تنفيذية مُصاغة من مقارنة أداء النظراء وأدلة الرسم البياني ومستوى تحمل المخاطر.'
                        : 'Action recommendation synthesized from relative peer performance, chart evidence, and portfolio risk tolerance.'}
                    </p>
                  </div>
                );
              })()}

              {/* 3.2: Core Advisory Synthesis & Evidence / Risk Bullets */}
              <div className="ai-bot-advice-section ai-bot-advice-narrative-section">
                <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'أطروحة التوصية' : 'Advisory Thesis'}</span>
                <p className="ai-bot-recommendation">
                  {recommendation.structured?.summary || recommendation.recommendation_text}
                </p>

                {recommendation.structured?.evidence && recommendation.structured.evidence.length > 0 && (
                  <div className="ai-bot-portfolio-list-section">
                    <span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--evidence">
                      {lang === 'ar' ? 'أهم الأدلة الموثقة' : 'Key Grounded Evidence'}
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
                      {lang === 'ar' ? 'مخاطر الهبوط والاعتبارات' : 'Downside Risks & Considerations'}
                    </span>
                    <ul className="ai-bot-portfolio-list ai-bot-portfolio-list--risks">
                      {recommendation.structured.risks.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <small className="ai-bot-summary-meta">
                  {formatModelName(recommendation.model_used, lang)} · {new Date(recommendation.generated_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                </small>
              </div>

              {/* 3.3: Watch Trigger & Next Review Horizon */}
              {(recommendation.structured?.watch_trigger || recommendation.structured?.next_review_days != null) && (
                <div className="ai-bot-advice-section ai-bot-advice-trigger-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'شرط التفعيل وأفق المراجعة' : 'Watch Trigger & Review Horizon'}</span>
                  {recommendation.structured?.watch_trigger && (
                    <div className="ai-bot-trigger-box">
                      <strong>{lang === 'ar' ? '⚡ شرط التفعيل' : '⚡ Trigger Condition'}</strong>
                      <p>{recommendation.structured.watch_trigger}</p>
                    </div>
                  )}
                  {recommendation.structured?.next_review_days != null && (
                    <div className="ai-bot-review-horizon">
                      {lang === 'ar' ? (
                        <>🗓️ المراجعة القادمة خلال <strong>{recommendation.structured.next_review_days} يوم</strong></>
                      ) : (
                        <>🗓️ Next review in <strong>{recommendation.structured.next_review_days} day{recommendation.structured.next_review_days === 1 ? '' : 's'}</strong></>
                      )}
                    </div>
                  )}
                  <p className="ai-bot-verdict-caption">
                    {lang === 'ar'
                      ? 'المعيار المحدد الذي يجب تحققه قبل تعديل حجم المركز أو الخروج.'
                      : 'Concrete threshold that must trigger before adjusting position size or exiting.'}
                  </p>
                </div>
              )}

              {/* 3.4: Behavioral Guardrails — "Why NOT to Act Yet" */}
              {recommendation.structured?.do_not_act_reasons && recommendation.structured.do_not_act_reasons.length > 0 && (
                <div className="ai-bot-advice-section ai-bot-advice-guardrails-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'ضوابط سلوكية' : 'Behavioral Guardrails'}</span>
                  <div className="ai-bot-guardrail-box">
                    <strong>{lang === 'ar' ? '🛑 أسباب لعدم اتخاذ إجراء الآن' : '🛑 Reasons NOT to Act Yet'}</strong>
                    <ul className="ai-bot-guardrail-list">
                      {recommendation.structured.do_not_act_reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="ai-bot-verdict-caption">
                    {lang === 'ar'
                      ? 'ضوابط مخاطر مصممة لمنع الصفقات المتسرعة قبل تأكيد الإشارة.'
                      : 'Risk guardrails designed to prevent impulsive trades before signal confirmation.'}
                  </p>
                </div>
              )}

              {/* 3.5: Automated Safety & Alert Checks — Time Stop, Thesis, Drawdown */}
              {(entityTimeStop || entityThesis || portfolioDrawdown) && (
                <div className="ai-bot-advice-section ai-bot-advice-safety-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'فحوصات الأمان الآلية' : 'Automated Safety Checks'}</span>
                  <div className="ai-bot-safety-grid">

                    {/* Time Stop */}
                    {entityTimeStop && (
                      <div className={`ai-bot-safety-card ${entityTimeStop.is_stagnant ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>{lang === 'ar' ? 'وقف زمني' : 'Time Stop'}</span>
                        <strong>
                          {entityTimeStop.is_stagnant
                            ? (lang === 'ar' ? `⏱️ راكد: ${entityTimeStop.days_in_current_state ?? entityTimeStop.stagnant_days ?? 0} يوم` : `⏱️ Stagnant: ${entityTimeStop.days_in_current_state ?? entityTimeStop.stagnant_days ?? 0}d`)
                            : (lang === 'ar' ? '✅ زخم نشط' : '✅ Active Momentum')}
                        </strong>
                        {entityTimeStop.is_stagnant && entityTimeStop.message && (
                          <em>{entityTimeStop.message}</em>
                        )}
                      </div>
                    )}

                    {/* Thesis Integrity */}
                    {entityThesis && (
                      <div className={`ai-bot-safety-card ${(entityThesis.has_reversal || entityThesis.signal_degraded) ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>{lang === 'ar' ? 'سلامة الأطروحة' : 'Thesis Integrity'}</span>
                        <strong>
                          {(entityThesis.has_reversal || entityThesis.signal_degraded)
                            ? (lang === 'ar' ? '⚠️ تراجعت الإشارة' : '⚠️ Signal Degraded')
                            : (lang === 'ar' ? '✅ الأطروحة سليمة' : '✅ Thesis Intact')}
                        </strong>
                        {entityThesis.has_reversal && entityThesis.prior_signal && entityThesis.current_signal && (
                          <em>{formatSignal(entityThesis.prior_signal, lang)} → {formatSignal(entityThesis.current_signal, lang)}</em>
                        )}
                      </div>
                    )}

                    {/* Drawdown */}
                    {portfolioDrawdown && (
                      <div className={`ai-bot-safety-card ${(portfolioDrawdown.is_elevated || portfolioDrawdown.is_alert || Math.abs(portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? 0) >= 10) ? 'ai-bot-safety-alert' : 'ai-bot-safety-ok'}`}>
                        <span>{lang === 'ar' ? 'مخاطر التراجع' : 'Drawdown Risk'}</span>
                        <strong>
                          📉 {lang === 'ar' ? `تراجع ${Math.abs(portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? 0).toFixed(1)}%` : `${Math.abs(portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? 0).toFixed(1)}% Drawdown`}
                        </strong>
                        {(portfolioDrawdown.is_elevated || portfolioDrawdown.is_alert) && <em>{lang === 'ar' ? 'مرتفع — راجع المركز' : 'Elevated — review position'}</em>}
                      </div>
                    )}

                  </div>
                  <p className="ai-bot-verdict-caption">
                    {lang === 'ar'
                      ? 'مؤشرات مخاطر آلية تُقيَّم في كل دورة لحماية رأس المال.'
                      : 'Automated risk monitors evaluated on every pipeline cycle to protect capital.'}
                  </p>
                </div>
              )}

              {/* 3.6: Watchlist & Opportunity Candidate Hub (for unheld entities) */}
              {!entity?.is_held && (
                <div className="ai-bot-advice-section ai-bot-advice-watchlist-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'تقييم قائمة المراقبة' : 'Watchlist Evaluation'}</span>
                  {(strongUnheldMatch || verdict?.signal === 'Strong') ? (
                    <div className="ai-bot-watchlist-opportunity">
                      <strong>{lang === 'ar' ? '💡 فرصة استثمارية مرشحة' : '💡 Opportunity Candidate'}</strong>
                      <p>{opportunityReason}</p>
                      {matchingSector && (
                        <div className="ai-bot-sector-gap-row">
                          <span>{lang === 'ar' ? 'فجوة قطاعية' : 'Sector Gap'}</span>
                          <strong>{translateSector(matchingSector.sector, lang)}</strong>
                          <em>{lang === 'ar' ? `النسبة الحالية ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}%` : `${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% current allocation`}</em>
                        </div>
                      )}
                      <p className="ai-bot-verdict-caption">
                        {lang === 'ar'
                          ? 'ظهر هذا الأصل لأنه يتفوق على مجموعته النظيرة وقد يوفر فرصة ممتازة للتدوير أو تنويع المحفظة.'
                          : 'Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.'}
                      </p>
                    </div>
                  ) : verdict?.signal === 'Weak' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
                      <strong>{lang === 'ar' ? '⛔ غير موصى به' : '⛔ Not Recommended'}</strong>
                      <p>{lang === 'ar' ? 'أداؤه دون مجموعته النظيرة. غير موصى به للإضافة للمحفظة حالياً.' : 'Underperforming its peer group. Not recommended for portfolio inclusion at this time.'}</p>
                    </div>
                  ) : verdict?.signal === 'Mixed' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-mixed">
                      <strong>{lang === 'ar' ? '👁️ للمراقبة فقط' : '👁️ Monitor Only'}</strong>
                      <p>{lang === 'ar' ? 'أداء متباين مقارنة بالنظراء. انتظر تأكيد الاتجاه قبل دراسة الدخول.' : 'Mixed peer performance. Wait for trend confirmation before considering entry.'}</p>
                    </div>
                  ) : verdict?.signal === 'Insufficient Data' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
                      <strong>{lang === 'ar' ? '📊 بيانات غير كافية' : '📊 Insufficient Data'}</strong>
                      <p>{lang === 'ar' ? 'لا يوجد تاريخ مقارنة نظراء كافٍ لصياغة أطروحة دخول.' : 'Not enough peer comparison history to formulate an entry thesis.'}</p>
                    </div>
                  ) : (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
                      <strong>{lang === 'ar' ? '📋 لا توجد أطروحة نشطة' : '📋 No Active Thesis'}</strong>
                      <p>{lang === 'ar' ? 'لا توجد أطروحة دخول أو تدوير نشطة لأصل قائمة المراقبة هذا.' : 'No active entry or rotation thesis for this watchlist asset.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : entity?.is_held ? (
            <p>{lang === 'ar' ? 'التوصية غير متاحة لهذا التشغيل بعد.' : 'Recommendation is not available for this run yet.'}</p>
          ) : (strongUnheldMatch || verdict?.signal === 'Strong') ? (
            <div className="ai-bot-watchlist-opportunity">
              <strong>{lang === 'ar' ? '💡 فرصة استثمارية مرشحة' : '💡 Opportunity Candidate'}</strong>
              <p>{opportunityReason}</p>
              {matchingSector && (
                <div className="ai-bot-sector-gap-row">
                  <span>{lang === 'ar' ? 'فجوة قطاعية' : 'Sector Gap'}</span>
                  <strong>{translateSector(matchingSector.sector, lang)}</strong>
                  <em>{lang === 'ar' ? `النسبة الحالية ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}%` : `${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% current allocation`}</em>
                </div>
              )}
              <p className="ai-bot-verdict-caption">
                {lang === 'ar'
                  ? 'ظهر هذا الأصل لأنه يتفوق على مجموعته النظيرة وقد يوفر فرصة ممتازة للتدوير أو تنويع المحفظة.'
                  : 'Surfaced because this unheld asset exhibits outperformance relative to its peer group and may offer favorable portfolio rotation or diversification potential.'}
              </p>
            </div>
          ) : verdict?.signal === 'Weak' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
              <strong>{lang === 'ar' ? '⛔ غير موصى به' : '⛔ Not Recommended'}</strong>
              <p>{lang === 'ar' ? 'أصل قائمة المراقبة دون أداء مجموعته النظيرة. غير موصى به للإضافة للمحفظة حالياً.' : 'Watchlist asset underperforming its peer group. Not recommended for portfolio inclusion at this time.'}</p>
            </div>
          ) : verdict?.signal === 'Mixed' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-mixed">
              <strong>{lang === 'ar' ? '👁️ للمراقبة فقط' : '👁️ Monitor Only'}</strong>
              <p>{lang === 'ar' ? 'أصل قائمة المراقبة يظهر أداءً متبايناً. راقب لتأكيد الاتجاه قبل دراسة الدخول.' : 'Watchlist asset showing mixed peer performance. Monitor for trend confirmation before considering entry.'}</p>
            </div>
          ) : verdict?.signal === 'Insufficient Data' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
              <strong>{lang === 'ar' ? '📊 بيانات غير كافية' : '📊 Insufficient Data'}</strong>
              <p>{lang === 'ar' ? 'تاريخ مقارنة النظراء غير كافٍ لصياغة أطروحة دخول.' : 'Insufficient peer comparison history to formulate an entry thesis.'}</p>
            </div>
          ) : (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-info">
              <strong>{lang === 'ar' ? '📋 لا توجد أطروحة نشطة' : '📋 No Active Thesis'}</strong>
              <p>{lang === 'ar' ? 'لا توجد أطروحة دخول أو تدوير نشطة لأصل قائمة المراقبة هذا.' : 'No active entry or rotation thesis for this watchlist asset.'}</p>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
