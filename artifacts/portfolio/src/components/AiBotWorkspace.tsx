import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, Brain, ChevronDown, Eye, Gauge, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { type Lang, getSavedLang, translateEntityName, translateSector } from '../lib/i18n';

type Snapshot = {
  id?: number;
  ticker: string;
  name: string;
  entity_type: string;
  is_held: boolean;
  sector: string | null;
  manager?: string | null;
  nav_or_price: number | string | null;
  return_30d_percent: number | string | null;
  return_60d_percent: number | string | null;
  return_ytd_percent: number | string | null;
  return_1y_percent: number | string | null;
  cagr_percent: number | string | null;
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
  market_cap: number | string | null;
  sector_rank: number | null;
  beta: number | string | null;
};

type Candle = { date: string; open: number; high: number; low: number; close: number; volume?: number | null };
type TechnicalSignal = {
  watchlist_id?: number;
  run_id?: number;
  ticker: string;
  name?: string;
  entity_type?: string;
  trend: string;
  confidence: number | string | null;
  candle_date: string | null;
  patterns: Array<{ name: string; date?: string; direction: string }>;
  reversal_risk?: "none" | "watch" | "elevated";
  raw_fetch_ok?: boolean;
  candles: Candle[];
  created_at?: string;
};
type ComparisonEntry = {
  ticker: string;
  name?: string;
  asset_role?: string;
  return_percent: number | null;
  sector_rank?: number | null;
  stock_signal?: string | null;
  gap_percent: number | null;
  computed_risk_tier: 'Low' | 'Medium' | 'High' | null;
  risk_mismatch: boolean;
  foudalens_risk_level: string | null;
  fundamentals?: {
    pe_ratio: number | null;
    forward_pe: number | null;
    debt_to_equity: number | null;
    current_ratio: number | null;
    roe_percent: number | null;
    free_cash_flow: number | null;
    net_income: number | null;
    net_income_growth_percent: number | null;
    revenue_growth_percent: number | null;
    dividend_yield_percent: number | null;
    beta: number | null;
    analyst_rating: string | null;
    price_target_upside_percent: number | null;
    shares_change_percent: number | null;
    flags: Array<{ flag: string; detail: string }>;
  } | null;
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
  holding_portfolio_weight_percent?: number | null;
  portfolio_total_value_egp?: number | null;
  holding_risk_tier?: 'Low' | 'Medium' | 'High' | null;
  holding_asset_role?: string;
  is_held?: boolean;
  return_period?: 'return_1y' | 'return_6m' | 'return_3m';
  signal: string;
  performance_grade?: 'Strong' | 'Mixed' | 'Weak' | 'Insufficient Data';
  financial_health_grade?: 'Red Flag' | 'Weak' | 'Strong' | 'Neutral' | 'Insufficient Data';
  financial_health_reason?: 'not_applicable_fund' | 'insufficient_peers' | 'missing_own_fundamentals';
  technical_grade?: 'Red Flag' | 'Weak' | 'Strong' | 'Neutral' | 'Insufficient Data';
  technical_reason?: 'no_chart_data' | 'insufficient_trend_history';
  final_label?: 'Excellent' | 'Solid' | 'Caution' | 'Avoid' | 'Insufficient Data';
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
    pe_ratio?: number | null;
    forward_pe?: number | null;
    debt_to_equity?: number | null;
    current_ratio?: number | null;
    roe_percent?: number | null;
    free_cash_flow?: number | null;
    net_income?: number | null;
    net_income_growth_percent?: number | null;
    revenue_growth_percent?: number | null;
    dividend_yield_percent?: number | null;
    beta?: number | null;
    analyst_rating?: string | null;
    price_target_upside_percent?: number | null;
    shares_change_percent?: number | null;
    flags?: Array<{ flag: string; detail: string }>;
  } | null;
};
export type StructuredRecommendation = {
  decision: 'consider_entry' | 'consider_rotation' | 'watch_and_wait' | 'hold';
  confidence: number;
  summary: string;
  thesis_risk: string;
  evidence: string[];
  risks: string[];
  next_review_days: number;
  watch_trigger: string;
  do_not_act_reasons: string[];
};

export type Recommendation = {
  ticker: string;
  recommendation_text: string;
  model_used: string;
  generated_at: string;
  structured?: StructuredRecommendation | null;
};

export type TimeStopAlert = {
  watchlist_id?: number;
  ticker?: string;
  is_stagnant: boolean;
  days_in_current_state?: number;
  stagnant_days?: number | null;
  threshold_days?: number;
  stagnant_since?: string | null;
  current_signal?: string | null;
  current_flags?: string[];
  message?: string;
};

export type ThesisAlert = {
  watchlist_id?: number;
  ticker?: string;
  has_reversal: boolean;
  signal_degraded?: boolean;
  prior_signal?: string;
  current_signal?: string;
  compared_signal?: string | null;
  compared_at?: string | null;
  newly_appeared_flags?: string[];
  message?: string;
};

export type DrawdownAlert = {
  current_drawdown_percent?: number | null;
  drawdown_percent?: number | null;
  peak_value?: number;
  current_value?: number;
  is_elevated?: boolean;
  is_alert?: boolean;
};

export type AlertsSummary = {
  generatedAt?: string;
  timeStops?: TimeStopAlert[];
  theses?: ThesisAlert[];
  drawdown?: DrawdownAlert | null;
  alerts?: Record<string, { timeStop?: TimeStopAlert; thesis?: ThesisAlert }>;
  portfolio?: {
    drawdown?: DrawdownAlert | null;
  };
};
type DataLoadErrors = Partial<Record<'signals' | 'verdicts' | 'recommendations' | 'summary' | 'opportunities' | 'alerts', string>>;

type PortfolioSummary = {
  id?: number;
  run_id?: number;
  summary_text: string;
  excellent_count: number;
  solid_count: number;
  caution_count: number;
  avoid_count: number;
  insufficient_data_count: number;
  flagged_count?: number | null;
  avg_coverage_percent?: number | null;
  reversal_risk_count?: number | null;
  divergence_count?: number | null;
  excellent_value_percent?: number | null;
  solid_value_percent?: number | null;
  caution_value_percent?: number | null;
  avoid_value_percent?: number | null;
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
    risk_tier?: string | null;
    signal: string;
    coverage_percent?: number | null;
    comparables_beaten?: number;
    comparables_total?: number;
    absolute_return_positive?: boolean;
    fundamentals_flags?: string[];
    confidence_tier?: "high" | "moderate" | "low";
  }>;
  persisted_opportunities?: Array<{
    ticker: string;
    name: string;
    opportunity_text: string;
    model_used: string;
    generated_at: string;
    opportunity_type: string;
  }>;
  sector_concentration_in_opportunities?: Array<{
    sector: string;
    count: number;
    tickers: string[];
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
  sectors_no_strong_exposure?: Array<{
    sector: string;
    held_strong_count: number;
    held_caution_count?: number;
    held_avoid_count?: number;
    held_insufficient_data_count?: number;
    held_mixed_count?: number;
    held_weak_count?: number;
    unheld_strong_entities: Array<{ ticker: string; name: string; return_percent: number | null; signal?: string }>;
  }>;
  unheld_outperforming_held?: Array<{
    unheld_ticker: string;
    unheld_name: string;
    unheld_return: number | null;
    held_ticker: string;
    held_name: string;
    held_return: number | null;
    gap_percent: number;
    risk_comparison: string;
  }>;
  risk_tier_comparison?: {
    portfolio_avg_risk: string;
    opportunities_avg_risk: string;
    higher_risk_opportunities: number;
  };
  analysis_summary?: string;
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

const GRID_GLOSSARY = {
  labels: {
    Excellent: {
      en: 'Performance is strong and the financial-health and technical checks do not show a material weakness.',
      ar: 'الأداء قوي ولا تظهر فحوصات الصحة المالية والفنية ضعفاً جوهرياً.',
    },
    Solid: {
      en: 'The holding passed the main checks, but one category did not clear the higher Excellent bar.',
      ar: 'اجتازت الحيازة الفحوصات الأساسية، لكن إحدى الفئات لم تصل إلى مستوى ممتاز.',
    },
    Caution: {
      en: 'Performance is not enough on its own; the result includes a meaningful weakness that needs attention.',
      ar: 'الأداء وحده لا يكفي؛ تتضمن النتيجة نقطة ضعف مهمة تحتاج إلى الانتباه.',
    },
    Avoid: {
      en: 'Financial Health or Technical shows a serious red flag. A good price return cannot override that warning.',
      ar: 'تظهر الصحة المالية أو المؤشرات الفنية علامة حمراء خطيرة. لا يمكن لعائد سعري جيد تجاوز هذا التحذير.',
    },
    'Insufficient Data': {
      en: 'There is not enough usable comparison data to support a reliable combined label.',
      ar: 'لا توجد بيانات مقارنة صالحة كافية لدعم تصنيف موحد موثوق.',
    },
  },
  categories: {
    Performance: {
      en: 'Compares the 1-year price return against similar funds, stocks, and benchmarks.',
      ar: 'تقارن عائد السعر لسنة واحدة بالصناديق والأسهم والمؤشرات المماثلة.',
    },
    'Financial Health': {
      en: 'Compares profitability, debt, revenue growth, liquidity, cash flow, and share changes against peers.',
      ar: 'تقارن الربحية والديون ونمو الإيرادات والسيولة والتدفق النقدي وتغير الأسهم بالنظراء.',
    },
    Technical: {
      en: 'Reads the recent price chart for trend direction and warning patterns.',
      ar: 'تقرأ الرسم البياني الحديث لمعرفة الاتجاه وأنماط التحذير.',
    },
  },
  reasons: {
    not_applicable_fund: {
      en: 'Not applicable — this metric applies to individual stocks, not funds.',
      ar: 'غير منطبق — هذا المقياس ينطبق على الأسهم الفردية وليس الصناديق.',
    },
    insufficient_peers: {
      en: 'Not enough comparable peers with financial data yet.',
      ar: 'لا يوجد عدد كافٍ من النظراء المماثلين الذين تتوفر لديهم بيانات مالية حتى الآن.',
    },
    missing_own_fundamentals: {
      en: 'Fundamentals data is not yet available for this stock.',
      ar: 'بيانات الأساسيات غير متاحة لهذا السهم حتى الآن.',
    },
    no_chart_data: {
      en: 'No usable OHLC or chart data is available for this holding.',
      ar: 'لا تتوفر بيانات شموع أو رسم بياني صالحة لهذه الحيازة.',
    },
    insufficient_trend_history: {
      en: 'There is not enough candle history to establish a trend yet.',
      ar: 'لا يوجد تاريخ كافٍ للشموع لتحديد الاتجاه حتى الآن.',
    },
  },
  cap: {
    en: 'If Financial Health or Technical shows a serious red flag, the final label is capped at Avoid; a good price return alone cannot earn a high rating.',
    ar: 'إذا أظهرت الصحة المالية أو المؤشرات الفنية علامة حمراء خطيرة، يتم تحديد التصنيف النهائي عند تجنب؛ لا يكفي عائد سعري جيد وحده للحصول على تصنيف مرتفع.',
  },
} as const;

function GlossaryHint({ text, lang }: { text: string; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ai-bot-glossary-hint">
      <button
        type="button"
        className="ai-bot-glossary-button info-icon"
        aria-label={lang === 'ar' ? 'شرح التصنيف' : 'Explain this grade'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title={lang === 'ar' ? 'شرح التصنيف' : 'Explain this grade'}
      >
        ℹ
      </button>
      {open && <span className="ai-bot-glossary-popover">{text}</span>}
    </span>
  );
}

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
  const request = async (accessToken?: string) => {
    const headers = new Headers();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(url, { headers, cache: 'no-store' });
  };

  let sessionToken: string | undefined;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    sessionToken = data.session?.access_token;
  }

  let response = await request(sessionToken);
  if (response.status === 401 && supabase) {
    const { data } = await supabase.auth.refreshSession();
    sessionToken = data.session?.access_token;
    if (sessionToken) response = await request(sessionToken);
  }
  if (!response.ok) throw new Error(`AI Bot request failed: ${url} (${response.status})`);
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string): Promise<T> {
  let sessionToken: string | undefined;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    sessionToken = data.session?.access_token;
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  let response = await fetch(url, { method: 'POST', headers, cache: 'no-store' });
  if (response.status === 401 && supabase) {
    const { data } = await supabase.auth.refreshSession();
    sessionToken = data.session?.access_token;
    if (sessionToken) {
      headers.set('Authorization', `Bearer ${sessionToken}`);
      response = await fetch(url, { method: 'POST', headers, cache: 'no-store' });
    }
  }
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
    if (signal === 'Excellent') return 'ممتاز';
    if (signal === 'Solid') return 'متين';
    if (signal === 'Caution') return 'حذر';
    if (signal === 'Avoid') return 'تجنب';
    if (signal === 'Insufficient Data') return 'بيانات غير كافية';
    return signal;
  }
  return signal;
}

function unavailableValue(lang: Lang): string {
  return lang === 'ar' ? 'غير متاح' : 'Unavailable';
}

function marketDataValue(value: number | string | null | undefined, lang: Lang, suffix = ''): string {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return unavailableValue(lang);
  }
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function marketDataText(value: string | null | undefined, lang: Lang): string {
  return value?.trim() ? value : unavailableValue(lang);
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

  const m1 = text.match(/Portfolio summary could not be generated by AI for this run\. Evaluated (\d+) of (\d+) holdings: (\d+) Excellent, (\d+) Solid, (\d+) Caution, (\d+) Avoid, (\d+) Insufficient Data\./i);
  if (m1) {
    const [, succeeded, total, excellent, solid, caution, avoid, insufficient] = m1;
    return `تعذر إنشاء ملخص المحفظة عبر الذكاء الاصطناعي لهذا التشغيل. تم تقييم ${succeeded} من أصل ${total} من الحيازات: ${excellent} ممتاز، ${solid} متين، ${caution} حذر، ${avoid} تجنب، ${insufficient} بيانات غير كافية.`;
  }

  const m2 = text.match(/Only (\d+) of (\d+) holdings could be judged this run — not enough data for a reliable portfolio summary\. Retry the run for a complete picture\./i);
  if (m2) {
    const [, succeeded, total] = m2;
    return `تم تقييم ${succeeded} فقط من أصل ${total} من الحيازات في هذا التشغيل — لا توجد بيانات كافية لإنشاء ملخص موثوق للمحفظة. أعد تشغيل التحليل للحصول على صورة كاملة.`;
  }

  return text;
}

function MiniCandleChart({ candles, lang, limit = 24, full = false }: { candles: Candle[]; lang: Lang; limit?: number; full?: boolean }) {
  const visible = candles.slice(-limit);
  if (!visible.length) return <div className="ai-bot-chart-empty">{lang === 'ar' ? 'لا توجد بيانات أسعار تاريخية متاحة.' : 'No OHLC history available.'}</div>;
  const values = visible.flatMap((candle) => [candle.high, candle.low]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const y = (value: number) => 10 + ((max - value) / range) * 130;
  return (
    <div className={`ai-bot-chart ${full ? 'ai-bot-chart-full' : ''}`}>
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
      {full && visible.some((candle) => candle.volume !== null && candle.volume !== undefined) && (
        <div className="ai-bot-volume-bars" aria-label={lang === 'ar' ? 'بيانات حجم التداول' : 'Volume data'}>
          {visible.map((candle) => {
            const volumes = visible.map((item) => item.volume ?? 0);
            const maxVolume = Math.max(...volumes, 1);
            return <i key={`${candle.date}-volume`} style={{ height: `${Math.max(2, ((candle.volume ?? 0) / maxVolume) * 38)}px` }} title={`${candle.date}: ${candle.volume?.toLocaleString() ?? unavailableValue(lang)}`} />;
          })}
        </div>
      )}
      <div className="ai-bot-chart-dates"><span>{visible[0].date}</span><span>{visible[visible.length - 1].date}</span></div>
    </div>
  );
}

function technicalRiskLabel(risk: TechnicalSignal['reversal_risk'], lang: Lang): string {
  if (!risk) return unavailableValue(lang);
  if (lang === 'ar') {
    if (risk === 'none') return 'لا يوجد';
    if (risk === 'watch') return 'مراقبة';
    return 'مرتفع';
  }
  return risk === 'none' ? 'None' : risk === 'watch' ? 'Watch' : 'Elevated';
}

function TechnicalEvidence({ signal, lang, open, onToggle }: { signal: TechnicalSignal | null; lang: Lang; open: boolean; onToggle: (open: boolean) => void }) {
  const [range, setRange] = useState(90);
  const candles = signal?.candles ?? [];
  const visibleCandles = candles.slice(-range);
  const patterns = signal?.patterns ?? [];
  const rangeOptions = [30, 90, 365];

  return (
    <details className="ai-bot-technical-evidence" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>{lang === 'ar' ? 'الدليل الفني' : 'Technical Evidence'}</summary>
      <div className="ai-bot-technical-controls">
        <span>{lang === 'ar' ? 'النطاق الزمني' : 'Time range'}</span>
        <div role="group" aria-label={lang === 'ar' ? 'النطاق الزمني للرسم البياني' : 'Chart time range'}>
          {rangeOptions.map((option) => (
            <button key={option} type="button" className={range === option ? 'is-active' : ''} onClick={() => setRange(option)}>
              {option === 365 ? (lang === 'ar' ? 'سنة' : '1Y') : `${option}D`}
            </button>
          ))}
        </div>
      </div>
      <MiniCandleChart candles={visibleCandles} lang={lang} limit={visibleCandles.length || 1} full />
      <div className="ai-bot-technical-stats">
        <span><label>{lang === 'ar' ? 'الاتجاه' : 'Trend'}</label><b>{signal ? formatTrend(signal.trend, lang) : unavailableValue(lang)}</b></span>
        <span><label>{lang === 'ar' ? 'الثقة' : 'Confidence'}</label><b>{signal?.confidence === null || signal?.confidence === undefined ? unavailableValue(lang) : `${(Math.abs(Number(signal.confidence)) <= 1 ? Number(signal.confidence) * 100 : Number(signal.confidence)).toFixed(0)}%`}</b></span>
        <span><label>{lang === 'ar' ? 'تاريخ الشمعة' : 'Candle date'}</label><b>{signal?.candle_date || unavailableValue(lang)}</b></span>
        <span><label>{lang === 'ar' ? 'مخاطر الانعكاس' : 'Reversal risk'}</label><b>{technicalRiskLabel(signal?.reversal_risk, lang)}</b></span>
        <span><label>{lang === 'ar' ? 'حالة الجلب الخام' : 'Raw fetch status'}</label><b>{signal?.raw_fetch_ok === undefined ? unavailableValue(lang) : signal.raw_fetch_ok ? (lang === 'ar' ? 'تم بنجاح' : 'Fetched') : (lang === 'ar' ? 'فشل الجلب' : 'Fetch failed')}</b></span>
      </div>
      <div className="ai-bot-patterns">
        <strong>{lang === 'ar' ? 'النماذج المكتشفة' : 'Detected patterns'}</strong>
        {patterns.length ? (
          <div className="ai-bot-pattern-list">
            {patterns.map((pattern, index) => (
              <div key={`${pattern.name}-${pattern.date ?? 'undated'}-${index}`}>
                <b>{pattern.name || unavailableValue(lang)}</b>
                <span>{pattern.direction || unavailableValue(lang)}</span>
                <time>{pattern.date || unavailableValue(lang)}</time>
              </div>
            ))}
          </div>
        ) : <span className="ai-bot-technical-unavailable">{unavailableValue(lang)}</span>}
      </div>
    </details>
  );
}

function MarketComparison({ snapshots, lang }: { snapshots: Snapshot[]; lang: Lang }) {
  const groups = [
    [lang === 'ar' ? 'صناديق' : 'Funds', snapshots.filter((snapshot) => snapshot.entity_type === 'fund')],
    [lang === 'ar' ? 'أسهم' : 'Stocks', snapshots.filter((snapshot) => snapshot.entity_type === 'stock')],
    [lang === 'ar' ? 'مؤشرات' : 'Indices', snapshots.filter((snapshot) => snapshot.entity_type === 'index')],
  ] as const;
  const value = (number: number | string | null, suffix = '') => number === null ? '—' : `${Number(number).toFixed(1)}${suffix}`;
  const shortReturn = (snapshot: Snapshot) => snapshot.entity_type === 'index' ? snapshot.return_60d_percent : snapshot.return_30d_percent;
  
  // Sort each group by YTD return (highest first), nulls last
  const sortedGroups: Array<readonly [string, Snapshot[]]> = groups.map(([label, group]) => [
    label,
    [...group].sort((a, b) => {
      const ytdA = a.return_ytd_percent !== null ? Number(a.return_ytd_percent) : -Infinity;
      const ytdB = b.return_ytd_percent !== null ? Number(b.return_ytd_percent) : -Infinity;
      if (ytdA === -Infinity && ytdB === -Infinity) return 0;
      if (ytdA === -Infinity) return 1;
      if (ytdB === -Infinity) return -1;
      return ytdB - ytdA;
    }),
  ]);
  return (
    <div className="ai-bot-market-comparison">
      <div className="ai-bot-market-comparison-heading">
        <div>
          <span>{lang === 'ar' ? 'مقارنة السوق' : 'Market Comparison'}</span>
          <strong>{lang === 'ar' ? 'لقطة شاملة لقائمة المراقبة' : 'Full watchlist snapshot'}</strong>
        </div>
        <small>{lang === 'ar' ? 'مرتبة حسب نوع الأصل وأعلى YTD' : 'Sorted by entity group, highest YTD first'}</small>
      </div>
      {sortedGroups.map(([label, group]) => group.length > 0 && (
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
                  <th>{lang === 'ar' ? '30 يوم / 60 للمؤشرات' : '30d / 60d indices'}</th>
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
                    <td className={Number(shortReturn(snapshot)) >= 0 ? 'ai-positive' : 'ai-negative'}>{value(shortReturn(snapshot), '%')}</td>
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

function PortfolioAlerts({ alertsData, lang }: { alertsData: AlertsSummary | null; lang: Lang }) {
  const drawdown = alertsData?.portfolio?.drawdown ?? alertsData?.drawdown;
  const alertEntries = Object.entries(alertsData?.alerts ?? {});
  const drawdownPercent = drawdown?.current_drawdown_percent ?? drawdown?.drawdown_percent;
  return (
    <article className="ai-bot-panel ai-bot-alerts-panel">
      <div className="ai-bot-alert-evidence-grid">
        {drawdown && (
          <section className={`ai-bot-alert-evidence-card ${(drawdown.is_elevated || drawdown.is_alert) ? 'is-alert' : 'is-ok'}`}>
            <h4>{lang === 'ar' ? 'التراجع' : 'Drawdown'}</h4>
            <div className="ai-bot-alert-state">{drawdown.is_elevated || drawdown.is_alert ? (lang === 'ar' ? 'مرتفع' : 'Elevated') : (lang === 'ar' ? 'طبيعي' : 'Normal')}</div>
            <dl>
              <div><dt>{lang === 'ar' ? 'التراجع الحالي' : 'Current drawdown'}</dt><dd>{drawdownPercent == null ? unavailableValue(lang) : `${Number(drawdownPercent).toFixed(1)}%`}</dd></div>
              <div><dt>{lang === 'ar' ? 'قيمة الذروة' : 'Peak value'}</dt><dd>{drawdown.peak_value ?? unavailableValue(lang)}</dd></div>
              <div><dt>{lang === 'ar' ? 'القيمة الحالية' : 'Current value'}</dt><dd>{drawdown.current_value ?? unavailableValue(lang)}</dd></div>
            </dl>
          </section>
        )}
      </div>
      {alertEntries.length > 0 ? (
        <div className="ai-bot-alert-summary">
          <strong>{lang === 'ar' ? 'ملخص تنبيهات المحفظة' : 'Portfolio Alert Summary'}</strong>
          <div className="ai-bot-alert-table-wrap">
            <table>
              <thead><tr><th>{lang === 'ar' ? 'الرمز' : 'Ticker'}</th><th>{lang === 'ar' ? 'الوقف الزمني' : 'Time Stop'}</th><th>{lang === 'ar' ? 'الأطروحة' : 'Thesis'}</th><th>{lang === 'ar' ? 'الإشارة الحالية' : 'Current signal'}</th></tr></thead>
              <tbody>{alertEntries.map(([ticker, alert]) => <tr key={ticker}>
                <td><b>{ticker}</b></td>
                <td>{alert.timeStop ? (alert.timeStop.is_stagnant ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')) : unavailableValue(lang)}</td>
                <td>{alert.thesis ? (alert.thesis.has_reversal || alert.thesis.signal_degraded ? (lang === 'ar' ? 'متدهورة' : 'Degraded') : (lang === 'ar' ? 'سليمة' : 'Intact')) : unavailableValue(lang)}</td>
                <td>{alert.thesis?.current_signal ? formatSignal(alert.thesis.current_signal, lang) : unavailableValue(lang)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : !drawdown && <p>{lang === 'ar' ? 'لا توجد تنبيهات للمحفظة متاحة.' : 'No portfolio alerts are available.'}</p>}
    </article>
  );
}

function EntityAlerts({ entity, timeStop, thesis, drawdown, lang }: { entity: Snapshot; timeStop?: TimeStopAlert; thesis?: ThesisAlert; drawdown?: DrawdownAlert | null; lang: Lang }) {
  const hasDrawdownAlert = Boolean(drawdown);
  return (
    <article className="ai-bot-panel ai-bot-alerts-panel">
      <div className="ai-bot-alert-evidence-grid">
        {timeStop && <section className={`ai-bot-alert-evidence-card ${timeStop.is_stagnant ? 'is-alert' : 'is-ok'}`}><h4>{lang === 'ar' ? 'وقف زمني' : 'Time Stop'}</h4><div className="ai-bot-alert-state">{timeStop.is_stagnant ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}</div><p>{timeStop.message || unavailableValue(lang)}</p></section>}
        {thesis && <section className={`ai-bot-alert-evidence-card ${(thesis.has_reversal || thesis.signal_degraded) ? 'is-alert' : 'is-ok'}`}><h4>{lang === 'ar' ? 'فحص الأطروحة' : 'Thesis Check'}</h4><div className="ai-bot-alert-state">{thesis.has_reversal || thesis.signal_degraded ? (lang === 'ar' ? 'متدهورة' : 'Degraded') : (lang === 'ar' ? 'سليمة' : 'Intact')}</div><p>{thesis.message || unavailableValue(lang)}</p></section>}
        {hasDrawdownAlert && <section className={`ai-bot-alert-evidence-card ${(drawdown?.is_elevated || drawdown?.is_alert) ? 'is-alert' : 'is-ok'}`}><h4>{lang === 'ar' ? 'التراجع' : 'Drawdown'}</h4><div className="ai-bot-alert-state">{drawdown?.is_elevated || drawdown?.is_alert ? (lang === 'ar' ? 'مرتفع' : 'Elevated') : (lang === 'ar' ? 'طبيعي' : 'Normal')}</div><p>{drawdown?.current_drawdown_percent ?? drawdown?.drawdown_percent ?? unavailableValue(lang)}{drawdown?.current_drawdown_percent !== undefined || drawdown?.drawdown_percent !== undefined ? '%' : ''}</p></section>}
      </div>
      {!timeStop && !thesis && !hasDrawdownAlert && <p>{lang === 'ar' ? 'لا توجد تنبيهات متاحة لهذا الأصل.' : `No alerts are available for ${entity.ticker}.`}</p>}
    </article>
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
  const [opportunityAnalysisSummary, setOpportunityAnalysisSummary] = useState<string | null>(null);
  const [isGeneratingOpportunityReport, setIsGeneratingOpportunityReport] = useState(false);
  const [alertsData, setAlertsData] = useState<AlertsSummary | null>(null);
  const [dataLoadErrors, setDataLoadErrors] = useState<DataLoadErrors>({});
  const [runId, setRunId] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<'held' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isOpportunitiesExpanded, setIsOpportunitiesExpanded] = useState(true);
  const [isRawMarketDataExpanded, setIsRawMarketDataExpanded] = useState(false);
  const [isTechnicalEvidenceExpanded, setIsTechnicalEvidenceExpanded] = useState(false);
  const [isFocusedDeskExpanded, setIsFocusedDeskExpanded] = useState(false);
  const [isEntityComparisonExpanded, setIsEntityComparisonExpanded] = useState(false);
  const [isEntityAdvisorExpanded, setIsEntityAdvisorExpanded] = useState(false);
  const [isEntityAlertsExpanded, setIsEntityAlertsExpanded] = useState(false);
  const [isPortfolioMarketExpanded, setIsPortfolioMarketExpanded] = useState(false);
  const [isPortfolioComparisonExpanded, setIsPortfolioComparisonExpanded] = useState(false);
  const [isPortfolioAlertsExpanded, setIsPortfolioAlertsExpanded] = useState(false);
  const [isPortfolioAdvisorExpanded, setIsPortfolioAdvisorExpanded] = useState(false);
  const [pipelineScope, setPipelineScope] = useState<'entity' | 'portfolio'>('entity');
  const hasEntityDataRef = useRef(false);

  const focusPipelineScope = (scope: 'entity' | 'portfolio') => {
    setPipelineScope(scope);
  };

  const generateOpportunityReport = async () => {
    if (runId === null || isGeneratingOpportunityReport) return;
    setIsGeneratingOpportunityReport(true);
    try {
      const result = await postJson<{ analysis_summary?: string }>(`/api/advisor/generate-opportunities?runId=${encodeURIComponent(runId)}`);
      setOpportunityAnalysisSummary(result.analysis_summary ?? null);
    } catch (reportError) {
      setDataLoadErrors((current) => ({
        ...current,
        opportunities: reportError instanceof Error ? reportError.message : 'Opportunity report unavailable',
      }));
    } finally {
      setIsGeneratingOpportunityReport(false);
    }
  };

  useEffect(() => {
    const syncVisibility = (view: string) => {
      const mount = document.getElementById('ai-bot-workspace-mount');
      if (mount) mount.style.display = view === 'ai' ? '' : 'none';
    };
    const handleViewChange = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string }>).detail;
      syncVisibility(detail?.view ?? document.querySelector('.bento')?.getAttribute('data-view') ?? 'total');
    };
    syncVisibility(document.querySelector('.bento')?.getAttribute('data-view') ?? 'total');
    window.addEventListener('portfolio-view-changed', handleViewChange);
    return () => window.removeEventListener('portfolio-view-changed', handleViewChange);
  }, []);

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
        const loadErrors: DataLoadErrors = {};
        const status = await json<{ runId: number | null }>('/api/ai-bot/status');
        setRunId(status.runId);
        const suffix = status.runId === null ? '' : `?runId=${encodeURIComponent(status.runId)}`;
        const [snapshotData, signalData, verdictData, recommendationData, summaryData, oppData, alertSummary] = await Promise.all([
          json<{ snapshots: Snapshot[] }>(`/api/scraper/snapshots${suffix}`),
          json<{ signals: TechnicalSignal[] }>(`/api/technical-signals${suffix}`).catch((loadError) => { loadErrors.signals = loadError instanceof Error ? loadError.message : 'Technical signals unavailable'; return { signals: [] }; }),
          json<Verdict[]>(`/api/rotation-verdicts${suffix}${suffix ? '&' : '?'}all=true`).catch((loadError) => { loadErrors.verdicts = loadError instanceof Error ? loadError.message : 'Comparison results unavailable'; return []; }),
          status.runId === null ? Promise.resolve([] as Recommendation[]) : json<Recommendation[]>(`/api/advisor/recommendations${suffix}`).catch((loadError) => { loadErrors.recommendations = loadError instanceof Error ? loadError.message : 'Recommendations unavailable'; return []; }),
          status.runId === null ? Promise.resolve(null) : json<PortfolioSummary>(`/api/portfolio-summary${suffix}`).catch((loadError) => { loadErrors.summary = loadError instanceof Error ? loadError.message : 'Portfolio summary unavailable'; return null; }),
          status.runId === null ? Promise.resolve(null) : json<OpportunitiesAnalysis>(`/api/advisor/opportunities${suffix}`).catch((loadError) => { loadErrors.opportunities = loadError instanceof Error ? loadError.message : 'Opportunities unavailable'; return null; }),
          status.runId === null ? Promise.resolve({ timeStops: [], theses: [], drawdown: null } as AlertsSummary) : json<AlertsSummary>(`/api/alerts/summary${suffix}`).catch((loadError) => { loadErrors.alerts = loadError instanceof Error ? loadError.message : 'Alerts unavailable'; return { timeStops: [], theses: [], drawdown: null }; }),
        ]);
        const entitySnapshots = snapshotData.snapshots.filter((snapshot) => snapshot.entity_type === 'fund' || snapshot.entity_type === 'stock' || snapshot.entity_type === 'index');
        if (entitySnapshots.length > 0) hasEntityDataRef.current = true;
        setSnapshots(entitySnapshots);
        setSignals(signalData.signals);
        setVerdicts(verdictData);
        setRecommendations(recommendationData);
        setPortfolioSummary(summaryData);
        setOpportunitiesData(Array.isArray(oppData) ? { strong_unheld: [], underrepresented_sectors: [] } : oppData);
        setAlertsData(alertSummary);
        setDataLoadErrors(loadErrors);
      } catch (loadError) {
        if (!hasEntityDataRef.current) {
          setError(loadError instanceof Error ? loadError.message : 'AI Bot workspace unavailable');
          setDataLoadErrors({});
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

  const allEntities = useMemo(() => snapshots, [snapshots]);
  const heldEntities = useMemo(() => allEntities.filter((snapshot) => snapshot.is_held), [allEntities]);
  const displayedEntities = filterMode === 'held' ? heldEntities : allEntities;
  const entity = displayedEntities[selectedIndex] ?? null;
  const hasFailedGathererSnapshot = snapshots.some((snapshot) => !snapshot.raw_fetch_ok);
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
      finalLabel?: string,
    ): 'high' | 'moderate' | 'low' => {
      const cov = coverage ?? 0;
      const winRate = total && total > 0 && beaten !== undefined ? beaten / total : 0;
      const tier = cov >= 70 && winRate >= 0.75
        ? 'high'
        : cov < 50 || winRate < 0.65
          ? 'low'
          : 'moderate';
      if (finalLabel === 'Solid' && tier === 'high') return 'moderate';
      if (finalLabel === 'Excellent' && tier === 'low') return 'moderate';
      return tier;
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
          v.signal,
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
      .filter((v) => (v.signal === 'Excellent' || v.signal === 'Solid') && !allEntities.find((e) => e.ticker === v.holding_ticker && e.is_held))
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
          v.signal,
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

  const sectorConcentrationNote = useMemo(() => {
    const groups = opportunitiesData?.sector_concentration_in_opportunities ?? [];
    if (groups.length === 0) return null;

    const phrases = groups.map((group) => {
      const sectorLabel = translateSector(group.sector, lang);
      return `${group.count} of these opportunities are in the ${sectorLabel} sector`;
    });

    if (lang === 'ar') {
      return `ملاحظة: ${phrases.join('; ')} — فكر فيها كأفكار مترابطة، لا كأفكار مستقلة.`;
    }

    return `Note: ${phrases.join('; ')} — consider them as related, not independent, ideas.`;
  }, [lang, opportunitiesData?.sector_concentration_in_opportunities]);

  const opportunityReason = matchingSector
    ? (lang === 'ar'
        ? `يسد فجوة في قطاع ${translateSector(matchingSector.sector, lang)} (يمثل حالياً ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% فقط من المحفظة)`
        : `Fills gap in ${translateSector(matchingSector.sector, lang)} (currently only ${Number(matchingSector.portfolio_allocation_percent).toFixed(1)}% of portfolio)`)
    : verdict?.coverage_percent !== null && verdict?.coverage_percent !== undefined
      ? (lang === 'ar'
            ? `إشارة ممتازة أو متينة بتغطية مقارنة بنسبة ${Number(verdict.coverage_percent).toFixed(1)}%.`
            : `Excellent/Solid signal with ${Number(verdict.coverage_percent).toFixed(1)}% comparable coverage.`)
      : (lang === 'ar'
            ? 'تم رصد تصنيف ممتاز أو متين. مرشح للدراسة قبل إضافته للمحفظة.'
            : 'Excellent/Solid signal detected. Research before considering portfolio inclusion.');

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
  const portfolioHeldVerdicts = verdicts.filter((item) => item.is_held);

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
            <span className="ai-bot-workspace-icon"><Eye /></span>
            <div>
              <h2>{pipelineScope === 'entity' ? (lang === 'ar' ? 'بطاقة التركيز' : 'Focus card') : (lang === 'ar' ? 'مكتب تحليل المحفظة' : 'Portfolio analysis desk')}</h2>
            </div>
          </div>
          <div className="ai-bot-engine-actions">
            <div className="ai-bot-run-state">
              <span />
              <span>{lang === 'ar' ? `تشغيل ${runId ?? 'الأحدث'}` : `Run ${runId ?? 'latest'}`}</span>
            </div>
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsFocusedDeskExpanded((expanded) => !expanded)} aria-expanded={isFocusedDeskExpanded} aria-label={isFocusedDeskExpanded ? 'Collapse focused desk' : 'Expand focused desk'} title={isFocusedDeskExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
          </div>
        </header>
        <section className="ai-bot-engine ai-bot-focused-engine">
          {loading ? <div className="ai-bot-workspace-loading" role="status"><span className="ai-bot-loading-spinner" />{lang === 'ar' ? 'جارٍ تحميل بيانات بوت الذكاء الاصطناعي…' : 'Loading AI Bot data…'}</div> : error || hasFailedGathererSnapshot ? <div className="ai-bot-workspace-state ai-bot-gatherer-failed" role="alert"><strong>{lang === 'ar' ? 'فشل جامع البيانات' : 'Gatherer failed'}</strong><span>{error || (lang === 'ar' ? 'تعذر جلب بيانات سوقية مكتملة لهذا التشغيل.' : 'The gatherer did not return completed market data for this run.')}</span></div> : <div className="ai-bot-workspace-state"><span>{lang === 'ar' ? 'لا تتوفر بيانات سوقية مكتملة لهذا التشغيل.' : 'No completed market data is available for this run.'}</span></div>}
        </section>
        <section className="ai-bot-engine ai-bot-chart-engine"><div className="ai-bot-engine-header"><div><h3>{lang === 'ar' ? 'قارئ الرسم البياني' : 'Chart Reader'}</h3><p>{lang === 'ar' ? 'الاتجاه والشموع والنماذج الفنية.' : 'Trend, candles, and technical patterns.'}</p></div><TrendingUp /></div><article className="ai-bot-panel"><p>{loading ? (lang === 'ar' ? 'جارٍ تحميل الإشارات الفنية…' : 'Loading technical signals…') : dataLoadErrors.signals ? (lang === 'ar' ? 'تعذر تحميل بيانات الرسم البياني.' : 'Chart Reader data failed to load.') : (lang === 'ar' ? 'لا توجد إشارات فنية متاحة.' : 'No technical signals available.')}</p></article></section>
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
        <section className="ai-bot-engine ai-bot-alerts-engine"><div className="ai-bot-engine-header"><div><h3>{lang === 'ar' ? 'التنبيهات' : 'Alerts'}</h3><p>{lang === 'ar' ? 'وقف زمني وسلامة الأطروحة وتراجع المحفظة.' : 'Time Stop, Thesis Check, and portfolio drawdown.'}</p></div><Activity /></div><article className="ai-bot-panel"><p>{loading ? (lang === 'ar' ? 'جارٍ تحميل التنبيهات…' : 'Loading alerts…') : dataLoadErrors.alerts ? (lang === 'ar' ? 'تعذر تحميل التنبيهات.' : 'Alerts failed to load.') : (lang === 'ar' ? 'لا توجد تنبيهات متاحة.' : 'No alerts available.')}</p></article></section>
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
    <section className="ai-bot-workspace" data-pipeline-scope={pipelineScope}>
      <header className="ai-bot-workspace-header">
        <div className="ai-bot-workspace-brand">
          <span className="ai-bot-workspace-icon"><Eye /></span>
          <div>
            <h2>{pipelineScope === 'entity' ? (lang === 'ar' ? 'بطاقة التركيز' : 'Focus card') : (lang === 'ar' ? 'مكتب تحليل المحفظة' : 'Portfolio analysis desk')}</h2>
          </div>
        </div>
        <div className="ai-bot-engine-actions">
          <div className="ai-bot-run-state">
            <span />
            <span>{lang === 'ar' ? `تشغيل ${runId ?? 'الأحدث'}` : `Run ${runId ?? 'latest'}`}</span>
          </div>
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsFocusedDeskExpanded((expanded) => !expanded)} aria-expanded={isFocusedDeskExpanded} aria-label={isFocusedDeskExpanded ? 'Collapse focused desk' : 'Expand focused desk'} title={isFocusedDeskExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
        </div>
        <div className="ai-bot-pipeline-scope" role="group" aria-label={lang === 'ar' ? 'نطاق عرض خط التحليل' : 'Pipeline display scope'}>
          <button type="button" className={pipelineScope === 'entity' ? 'is-active' : ''} onClick={() => focusPipelineScope('entity')}>{lang === 'ar' ? 'حسب الأصل' : 'Per Entity'}</button>
          <button type="button" className={pipelineScope === 'portfolio' ? 'is-active' : ''} onClick={() => focusPipelineScope('portfolio')}>{lang === 'ar' ? 'حسب المحفظة' : 'Per Portfolio'}</button>
        </div>
      </header>

      <nav className="ai-bot-entity-nav" data-pipeline-section="entity" aria-label={lang === 'ar' ? 'التنقل بين الأصول' : 'Entity navigation'}>
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
          <strong>{entity?.name ? translateEntityName(entity.name, lang) : (lang === 'ar' ? 'لم يتم تحديد أي أصل' : 'No entity selected')}</strong>
          <small>{entity?.ticker || '—'}</small>
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

      <div className="ai-bot-entity-summary" data-pipeline-section="entity">
        <div>
          <span>{lang === 'ar' ? 'سعر السوق / NAV' : 'Market price / NAV'}</span>
          <strong>{entity.nav_or_price === null ? '—' : Number(entity.nav_or_price).toLocaleString()}</strong>
        </div>
        <div>
          <span>{entity.entity_type === 'index' ? (lang === 'ar' ? 'عائد 60 يوم' : '60 day return') : (lang === 'ar' ? 'عائد 30 يوم' : '30 day return')}</span>
          <strong className={Number(entity.entity_type === 'index' ? entity.return_60d_percent : entity.return_30d_percent) >= 0 ? 'ai-positive' : 'ai-negative'}>{pct(entity.entity_type === 'index' ? entity.return_60d_percent : entity.return_30d_percent)}</strong>
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
      {Object.keys(dataLoadErrors).length > 0 && (
        <div className="ai-bot-data-load-warning" data-pipeline-section="entity" role="status">
          <strong>{lang === 'ar' ? 'بيانات جزئية' : 'Partial data'}</strong>
          <span>{Object.keys(dataLoadErrors).map((key) => {
            const labels: Record<string, string> = { signals: lang === 'ar' ? 'الرسم البياني' : 'Chart Reader', verdicts: lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge', recommendations: lang === 'ar' ? 'المستشار' : 'Smart Advisor', summary: lang === 'ar' ? 'ملخص المحفظة' : 'Portfolio summary', opportunities: lang === 'ar' ? 'الفرص' : 'Opportunities', alerts: lang === 'ar' ? 'التنبيهات' : 'Alerts' };
            return labels[key] || key;
          }).join(lang === 'ar' ? '، ' : ', ')} {lang === 'ar' ? 'تعذر تحميلها.' : 'could not be loaded.'}</span>
        </div>
      )}

      <section className={`ai-bot-engine ai-bot-focused-engine ${isFocusedDeskExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="entity">
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
            <details className="ai-bot-raw-market-data" open={isRawMarketDataExpanded} onToggle={(event) => setIsRawMarketDataExpanded(event.currentTarget.open)}>
              <summary>{lang === 'ar' ? 'بيانات السوق الخام' : 'Raw Market Data'}</summary>
              <div className="ai-bot-raw-market-grid">
                <div className="ai-bot-raw-market-group">
                  <strong>{lang === 'ar' ? 'الأداء' : 'Performance'}</strong>
                  <span><label>{lang === 'ar' ? 'عائد 30 يوماً' : '30-day return'}</label><b>{marketDataValue(entity.return_30d_percent, lang, '%')}</b></span>
                  <span><label>{lang === 'ar' ? 'عائد 60 يوماً' : '60-day return'}</label><b>{marketDataValue(entity.return_60d_percent, lang, '%')}</b></span>
                  <span><label>YTD</label><b>{marketDataValue(entity.return_ytd_percent, lang, '%')}</b></span>
                  <span><label>{lang === 'ar' ? 'عائد سنة واحدة' : '1-year return'}</label><b>{marketDataValue(entity.return_1y_percent, lang, '%')}</b></span>
                  <span><label>CAGR</label><b>{marketDataValue(entity.cagr_percent, lang, '%')}</b></span>
                </div>
                <div className="ai-bot-raw-market-group">
                  <strong>{lang === 'ar' ? 'التقييم والسوق' : 'Valuation & market'}</strong>
                  <span><label>{lang === 'ar' ? 'صافي قيمة الأصول / السعر' : 'NAV / price'}</label><b>{marketDataValue(entity.nav_or_price, lang)}</b></span>
                  <span><label>FoudaLens score</label><b>{marketDataValue(entity.total_score, lang, '/100')}</b></span>
                  <span><label>{lang === 'ar' ? 'مستوى المخاطر' : 'Risk level'}</label><b>{marketDataText(entity.risk_level, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'الإشارة' : 'Signal'}</label><b>{marketDataText(entity.signal, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'القيمة السوقية' : 'Market cap'}</label><b>{marketDataValue(entity.market_cap, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'ترتيب القطاع' : 'Sector rank'}</label><b>{marketDataValue(entity.sector_rank, lang)}</b></span>
                </div>
                <div className="ai-bot-raw-market-group">
                  <strong>{lang === 'ar' ? 'التصنيف والمصدر' : 'Classification & source'}</strong>
                  <span><label>{lang === 'ar' ? 'نوع الكيان' : 'Entity type'}</label><b>{marketDataText(entity.entity_type, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'القطاع' : 'Sector'}</label><b>{marketDataText(entity.sector, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'المدير' : 'Manager'}</label><b>{marketDataText(entity.manager, lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'حالة الجلب' : 'Fetch status'}</label><b>{entity.raw_fetch_ok ? (lang === 'ar' ? 'تم بنجاح' : 'Fetched') : (lang === 'ar' ? 'فشل الجلب' : 'Fetch failed')}</b></span>
                  <span><label>{lang === 'ar' ? 'وقت الاستخراج' : 'Scrape timestamp'}</label><b>{entity.scraped_at ? new Date(entity.scraped_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : unavailableValue(lang)}</b></span>
                </div>
              </div>
            </details>
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
            <TechnicalEvidence signal={signal ?? null} lang={lang} open={isTechnicalEvidenceExpanded} onToggle={setIsTechnicalEvidenceExpanded} />
          </article>
        </div>
        <article className={`ai-bot-panel ai-bot-verdict-panel ${isEntityComparisonExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="entity">
          <div className="ai-bot-panel-heading">
            <div>
              <h3>{lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge'}</h3>
            </div>
            <div className="ai-bot-engine-actions">
              <button type="button" className="ai-bot-section-toggle" onClick={() => setIsEntityComparisonExpanded((expanded) => !expanded)} aria-expanded={isEntityComparisonExpanded} aria-label={isEntityComparisonExpanded ? 'Collapse Comparison Judge' : 'Expand Comparison Judge'} title={isEntityComparisonExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
              <Activity />
            </div>
          </div>
          {verdict ? (
            <>
              {/* Feature 5: Holding Metadata Header */}
              <div className="ai-bot-verdict-section ai-bot-verdict-header-section">
                <div className="comparison-holding-header">
                  <div>
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

              <div className="ai-bot-verdict-section ai-bot-verdict-breakdown-section">
                <div className="ai-bot-breakdown-grid">
                  <div><span>{lang === 'ar' ? 'التصنيف النهائي' : 'Final label'}</span><strong className={`ai-bot-verdict-pill ai-bot-verdict-${slugify(verdict.final_label || verdict.signal)}`}>{formatSignal(verdict.final_label || verdict.signal, lang)}</strong></div>
                  <div><span>{lang === 'ar' ? 'دور الأصل' : 'Holding asset role'}</span><b>{verdict.holding_asset_role || unavailableValue(lang)}</b></div>
                  <div><span>{lang === 'ar' ? 'قيمة المحفظة' : 'Portfolio value'}</span><b>{verdict.holding_current_value_egp === null || verdict.holding_current_value_egp === undefined ? unavailableValue(lang) : `${Number(verdict.holding_current_value_egp).toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`}</b></div>
                  <div><span>{lang === 'ar' ? 'وزن المحفظة' : 'Portfolio weight'}</span><b>{verdict.holding_portfolio_weight_percent === null || verdict.holding_portfolio_weight_percent === undefined ? unavailableValue(lang) : `${Number(verdict.holding_portfolio_weight_percent).toFixed(1)}%`}</b></div>
                </div>
                <div className="ai-bot-holding-fundamentals">
                  <strong>{lang === 'ar' ? 'أساسيات الحيازة' : 'Holding fundamentals'}</strong>
                  {verdict.holding_fundamentals ? (
                    <div className="ai-bot-fundamental-concerns">
                      {verdict.holding_fundamentals.flags?.length ? verdict.holding_fundamentals.flags.map((flag) => <span key={flag.flag}>{getVerdictFlagMeta(flag.flag, lang).label}</span>) : <span>{lang === 'ar' ? 'لا توجد مخاوف مسجلة' : 'No concerns recorded'}</span>}
                    </div>
                  ) : <span className="comparison-pending-label">{unavailableValue(lang)}</span>}
                </div>
                <div className="ai-bot-data-completeness">
                  <span>{lang === 'ar' ? 'اكتمال البيانات' : 'Data completeness'}</span>
                  <b>{verdict.data_quality ? `${verdict.data_quality.comparable_with_return_count} / ${verdict.data_quality.comparable_count} ${lang === 'ar' ? 'نظراء لديهم عوائد قابلة للاستخدام' : 'peers with usable returns'}` : unavailableValue(lang)}</b>
                </div>
              </div>

              {/* Features 3, 2, 6: Signal Verdict Pill, Win/Loss Tally, Coverage */}
              <div className="ai-bot-verdict-section ai-bot-verdict-signal-section">
                <div className="ai-bot-verdict-signal-row">
                  <div className={`ai-bot-verdict-pill ai-bot-verdict-${slugify(verdict.signal)}`}>
                    {formatSignal(verdict.signal, lang)}
                  </div>
                  <GlossaryHint text={GRID_GLOSSARY.labels[verdict.signal as keyof typeof GRID_GLOSSARY.labels]?.[lang] ?? GRID_GLOSSARY.labels['Insufficient Data'][lang]} lang={lang} />
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
                    ? 'يقيس الأداء التفوق المباشر مقارنة بالنظراء. تقيس التغطية نسبة النظراء الذين تتوفر لديهم بيانات عوائد صالحة — التغطية الأعلى تعني موثوقية إحصائية أكبر.'
                    : 'Performance measures the head-to-head result against comparable peers. Coverage measures the percentage of peers with usable return data — higher coverage indicates greater statistical reliability.'}
                </p>
              </div>

              <div className="ai-bot-verdict-section ai-bot-grid-grades-section">
                <div className="ai-bot-grid-grade-header">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'تفصيل شبكة التقييم' : 'Grid Grade Breakdown'}</span>
                  <GlossaryHint text={GRID_GLOSSARY.cap[lang]} lang={lang} />
                </div>
                <div className="ai-bot-grid-grades">
                  {([
                    ['Performance', verdict.performance_grade],
                    ['Financial Health', verdict.financial_health_grade],
                    ['Technical', verdict.technical_grade],
                  ] as const).map(([category, grade]) => {
                    const reason = category === 'Financial Health'
                      ? verdict.financial_health_reason
                      : category === 'Technical'
                        ? verdict.technical_reason
                        : undefined;
                    const reasonText = grade === 'Insufficient Data' && reason
                      ? GRID_GLOSSARY.reasons[reason][lang]
                      : null;
                    return (
                    <div className="ai-bot-grid-grade" key={category}>
                      <div className="ai-bot-grid-grade-label">
                        <span>{lang === 'ar' ? (category === 'Performance' ? 'الأداء' : category === 'Financial Health' ? 'الصحة المالية' : 'فني') : category}</span>
                        <GlossaryHint text={GRID_GLOSSARY.categories[category][lang]} lang={lang} />
                      </div>
                      <strong>{reasonText ?? formatSignal(grade, lang)}</strong>
                      {reasonText && <GlossaryHint text={GRID_GLOSSARY.categories[category][lang]} lang={lang} />}
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Feature 8: Technical Divergence Warning Callout */}
              {(verdict.flags?.includes('technical_divergence') ||
                ((verdict.signal === 'Excellent' || verdict.signal === 'Solid') && (verdict.technical_signal?.trend === 'downtrend' || signal?.trend === 'downtrend'))) && (
                <div className="comparison-warning ai-bot-callout-warning">
                  <span>⚠️</span>
                  <div>
                    <strong>{lang === 'ar' ? 'تباعد فني:' : 'Technical Divergence:'}</strong>
                    <p>
                      {lang === 'ar'
                        ? 'يتفوق هذا الأصل على نظرائه في العوائد، لكن الرسم البياني في مسار هابط. ترسل بيانات أداء النظراء وحركة السعر إشارات متضاربة — انتظر تأكيد الرسم البياني قبل اتخاذ قرار بناءً على التقييم القوي.'
                        : 'This holding beats its peers on returns, but the price chart is in a downtrend. Peer performance data and price action are sending conflicting signals — wait for the chart to confirm before acting on the positive final label.'}
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
                          : 'Bearish candlestick patterns detected in an active uptrend. Consider this a caution flag even if the Performance grade is strong.'}
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
                                    <div className="comparison-peer-identity">
                                      <strong className="comparison-ticker">{peer.ticker || unavailableValue(lang)}</strong>
                                      <span className="comparison-peer-name">{peer.name ? translateEntityName(peer.name, lang) : unavailableValue(lang)}</span>
                                    </div>
                                    <div className="comparison-peer-metadata">
                                      <span><label>{lang === 'ar' ? 'الدور' : 'Asset role'}</label><b>{peer.asset_role || unavailableValue(lang)}</b></span>
                                      <span><label>{lang === 'ar' ? 'العائد' : 'Return'}</label><b className={hasReturn ? (Number(peer.return_percent) >= 0 ? 'ai-positive' : 'ai-negative') : ''}>{hasReturn ? pct(peer.return_percent) : unavailableValue(lang)}</b></span>
                                      <span><label>{lang === 'ar' ? 'الفجوة' : 'Gap'}</label><b className={gapMeta.className}>{gapMeta.text === '—' ? unavailableValue(lang) : gapMeta.text}</b></span>
                                      <span><label>{lang === 'ar' ? 'مستوى المخاطر' : 'Risk tier'}</label><b>{peer.computed_risk_tier ? formatRiskTier(peer.computed_risk_tier, lang) : unavailableValue(lang)}</b></span>
                                      <span><label>{lang === 'ar' ? 'ترتيب القطاع' : 'Sector rank'}</label><b>{peer.sector_rank === null || peer.sector_rank === undefined ? unavailableValue(lang) : peer.sector_rank}</b></span>
                                      <span><label>{lang === 'ar' ? 'إشارة السهم' : 'Stock signal'}</label><b>{peer.stock_signal || unavailableValue(lang)}</b></span>
                                      <span><label>{lang === 'ar' ? 'مخاوف الأساسيات' : 'Fundamentals concerns'}</label><b>{peer.fundamentals?.flags?.length ? peer.fundamentals.flags.map((flag) => getVerdictFlagMeta(flag.flag, lang).label).join(', ') : unavailableValue(lang)}</b></span>
                                    </div>
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
              <div className="ai-bot-verdict-section ai-bot-second-opinion-section">
                <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'فحوصات الرأي الثاني' : 'Second-opinion checks'}</span>
                <div className="ai-bot-second-opinion-grid">
                  <span><label>{lang === 'ar' ? 'الفحص الفني' : 'Technical check'}</label><b>{verdict.technical_signal ? `${formatTrend(verdict.technical_signal.trend, lang)}${verdict.technical_signal.reversal_risk ? ` · ${technicalRiskLabel(verdict.technical_signal.reversal_risk, lang)}` : ''}` : unavailableValue(lang)}</b></span>
                  <span><label>{lang === 'ar' ? 'فحص الأساسيات' : 'Fundamentals check'}</label><b>{verdict.holding_fundamentals ? (verdict.holding_fundamentals.flags?.length ? (lang === 'ar' ? 'مخاوف موجودة' : 'Concerns found') : (lang === 'ar' ? 'لا توجد مخاوف' : 'No concerns')) : unavailableValue(lang)}</b></span>
                </div>
              </div>

              {/* Feature 9: Opportunity Candidate Banner (for un-held entities with Strong signal) */}
              {!entity?.is_held && (verdict.signal === 'Excellent' || verdict.signal === 'Solid') && (
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

      <section className={`ai-bot-engine ai-bot-market-engine ${isPortfolioMarketExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="portfolio">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'مقارنة السوق' : 'Market Comparison'}</h3>
            <p>{lang === 'ar' ? 'لقطة كاملة لقائمة المتابعة.' : 'Full watchlist snapshot across all entities.'}</p>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsPortfolioMarketExpanded((expanded) => !expanded)} aria-expanded={isPortfolioMarketExpanded} aria-label={isPortfolioMarketExpanded ? 'Collapse Market Comparison' : 'Expand Market Comparison'} title={isPortfolioMarketExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <Activity />
          </div>
        </div>
        <MarketComparison snapshots={snapshots} lang={lang} />
      </section>

      <section className={`ai-bot-engine ai-bot-comparison-engine ${isPortfolioComparisonExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="portfolio">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'حكم المقارنة' : 'Comparison Judge'}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsPortfolioComparisonExpanded((expanded) => !expanded)} aria-expanded={isPortfolioComparisonExpanded} aria-label={isPortfolioComparisonExpanded ? 'Collapse portfolio Comparison Judge' : 'Expand portfolio Comparison Judge'} title={isPortfolioComparisonExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <Activity />
          </div>
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
                      <span className="ai-bot-label-excellent">{portfolioSummary.excellent_count} {lang === 'ar' ? 'ممتاز' : 'Excellent'}</span>,{' '}
                      <span className="ai-bot-label-solid">{portfolioSummary.solid_count} {lang === 'ar' ? 'متين' : 'Solid'}</span>,{' '}
                      <span className="ai-bot-label-caution">{portfolioSummary.caution_count} {lang === 'ar' ? 'حذر' : 'Caution'}</span>,{' '}
                      <span className="ai-bot-label-avoid">{portfolioSummary.avoid_count} {lang === 'ar' ? 'تجنب' : 'Avoid'}</span>,{' '}
                      {portfolioSummary.insufficient_data_count > 0 && <span className="ai-bot-label-insufficient">, {portfolioSummary.insufficient_data_count} {lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'}</span>}
                    </span>
                  </div>
                  {portfolioSummary.excellent_value_percent !== null && portfolioSummary.excellent_value_percent !== undefined ? (
                    <div className="ai-bot-summary-row">
                      <span className="text-xs font-semibold text-muted-foreground mr-1.5">{lang === 'ar' ? 'حسب القيمة:' : 'By value:'}</span>
                      <span className="ai-bot-summary-holdings">
                        <span className="ai-bot-label-excellent">{Number(portfolioSummary.excellent_value_percent).toFixed(1)}% {lang === 'ar' ? 'ممتاز' : 'Excellent'}</span>,{' '}
                        <span className="ai-bot-label-solid">{Number(portfolioSummary.solid_value_percent).toFixed(1)}% {lang === 'ar' ? 'متين' : 'Solid'}</span>,{' '}
                        <span className="ai-bot-label-caution">{Number(portfolioSummary.caution_value_percent).toFixed(1)}% {lang === 'ar' ? 'حذر' : 'Caution'}</span>,{' '}
                        <span className="ai-bot-label-avoid">{Number(portfolioSummary.avoid_value_percent).toFixed(1)}% {lang === 'ar' ? 'تجنب' : 'Avoid'}</span>,{' '}
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
              <div className="ai-bot-portfolio-judge-transparency">
                <h4>{lang === 'ar' ? 'مصدر وتغطية حكم المقارنة' : 'Comparison Judge provenance and coverage'}</h4>
                <div className="ai-bot-advisor-meta">
                  <span>{lang === 'ar' ? 'المصدر' : 'Source'} <b>{formatModelName(portfolioSummary.model_used, lang)}</b></span>
                  <span>{lang === 'ar' ? 'التشغيل' : 'Run'} <b>{portfolioSummary.run_id ?? runId ?? unavailableValue(lang)}</b></span>
                  <span>{lang === 'ar' ? 'التحديث' : 'Generated'} <b>{portfolioSummary.generated_at ? new Date(portfolioSummary.generated_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : unavailableValue(lang)}</b></span>
                  <span>{lang === 'ar' ? 'تم تقييم' : 'Evaluated'} <b>{portfolioHeldVerdicts.length} {lang === 'ar' ? 'حيازة' : 'holdings'}</b></span>
                  <span>{lang === 'ar' ? 'قيم متاحة' : 'Values available'} <b>{portfolioHeldVerdicts.filter((item) => item.holding_current_value_egp !== null && item.holding_current_value_egp !== undefined && Number(item.holding_current_value_egp) > 0).length}/{portfolioHeldVerdicts.length}</b></span>
                </div>
                <div className="ai-bot-portfolio-judge-table-wrap">
                  <table>
                    <thead><tr><th>{lang === 'ar' ? 'الحيازة' : 'Holding'}</th><th>{lang === 'ar' ? 'النتيجة' : 'Final'}</th><th>{lang === 'ar' ? 'الأداء' : 'Performance'}</th><th>{lang === 'ar' ? 'الصحة المالية' : 'Financial health'}</th><th>{lang === 'ar' ? 'الفني' : 'Technical'}</th><th>{lang === 'ar' ? 'التغطية' : 'Coverage'}</th><th>{lang === 'ar' ? 'النظراء' : 'Peers'}</th><th>{lang === 'ar' ? 'جودة البيانات' : 'Data quality'}</th><th>{lang === 'ar' ? 'التنبيهات' : 'Flags'}</th></tr></thead>
                    <tbody>{portfolioHeldVerdicts.length > 0 ? portfolioHeldVerdicts.map((item) => <tr key={item.holding_ticker}>
                      <td><b>{item.holding_ticker}</b><br /><small>{translateEntityName(item.holding_name || item.holding_ticker, lang)}</small></td>
                      <td>{item.final_label || item.signal || unavailableValue(lang)}</td>
                      <td>{item.performance_grade || unavailableValue(lang)}</td>
                      <td>{item.financial_health_grade || unavailableValue(lang)}{item.financial_health_reason ? ` · ${item.financial_health_reason}` : ''}</td>
                      <td>{item.technical_grade || unavailableValue(lang)}{item.technical_reason ? ` · ${item.technical_reason}` : ''}{item.technical_signal?.trend ? ` · ${item.technical_signal.trend}` : ''}{item.technical_signal?.confidence !== null && item.technical_signal?.confidence !== undefined ? ` · ${Math.round(Number(item.technical_signal.confidence) * 100)}%` : ''}</td>
                      <td>{item.coverage_percent === null || item.coverage_percent === undefined ? unavailableValue(lang) : `${Number(item.coverage_percent).toFixed(1)}%`}</td>
                      <td>{item.comparables_beaten ?? 0}/{item.comparables_total ?? 0}</td>
                      <td>{item.data_quality?.holding_snapshot_status || unavailableValue(lang)}{item.data_quality?.holding_snapshot_age_hours !== null && item.data_quality?.holding_snapshot_age_hours !== undefined ? ` · ${Number(item.data_quality.holding_snapshot_age_hours).toFixed(0)}h` : ''}{item.data_completeness_warning ? ' · incomplete' : ''}</td>
                      <td>{item.flags?.length ? item.flags.map((flag) => getVerdictFlagMeta(flag, lang).label).join(', ') : unavailableValue(lang)}</td>
                    </tr>) : <tr><td colSpan={9}>{lang === 'ar' ? 'لا توجد نتائج حيازة متاحة لهذا التشغيل.' : 'No holding verdicts are available for this run.'}</td></tr>}</tbody>
                  </table>
                </div>
              </div>
              </>
          ) : (
            <p>{lang === 'ar' ? 'سيظهر ملخص المحفظة بعد اكتمال تشغيل حكم المقارنة.' : 'Portfolio summary will appear after Comparison Judge completes for this run.'}</p>
          )}
        </article>
      </section>
      <section className={`ai-bot-engine ai-bot-opportunity-engine ${isOpportunitiesExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="portfolio">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'ماسح الفرص' : 'Opportunity Scanner'}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsOpportunitiesExpanded((expanded) => !expanded)} aria-expanded={isOpportunitiesExpanded} aria-label={isOpportunitiesExpanded ? 'Collapse Opportunity Scanner' : 'Expand Opportunity Scanner'} title={isOpportunitiesExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <Activity />
          </div>
        </div>
        {opportunitiesData ? (
          <div className="ai-bot-opportunities-section" data-pipeline-role="opportunity-scanner">
                  <>
                      {sectorConcentrationNote && (
                        <div
                          className="ai-bot-opportunity-context-note"
                          style={{
                            marginBottom: '10px',
                            fontSize: '12px',
                            opacity: 0.8,
                            lineHeight: 1.4,
                          }}
                        >
                          {sectorConcentrationNote}
                        </div>
                      )}
                      <div className="ai-bot-opportunities-list">
                        {opportunities.length > 0 ? opportunities.map((opp) => (
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
                                  ? 'Excellent/Solid · High Confidence'
                                  : opp.confidence_tier === 'low'
                                    ? 'Excellent/Solid · Low Confidence'
                                    : 'Excellent/Solid · Moderate Confidence')}
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
                        )) : <p className="comparison-pending-label">{lang === 'ar' ? 'لم يتم العثور على مرشحين ممتازين أو متينين غير محتفظ بهم في هذا التشغيل.' : 'No Excellent/Solid unheld candidates were detected for this run.'}</p>}
                      </div>
                      <div className="ai-bot-opportunity-workspace">
                          <section className="ai-bot-opportunity-block">
                            <h5>{lang === 'ar' ? 'تفاصيل المرشحين غير المحتفظ بهم' : 'Unheld Candidate Details'}</h5>
                            <div className="ai-bot-opportunity-table-wrap">
                              <table>
                                <thead><tr><th>{lang === 'ar' ? 'الرمز' : 'Ticker'}</th><th>{lang === 'ar' ? 'الاسم' : 'Name'}</th><th>{lang === 'ar' ? 'التصنيف' : 'Grade'}</th><th>{lang === 'ar' ? 'العائد' : 'Return'}</th><th>{lang === 'ar' ? 'التغطية' : 'Coverage'}</th><th>{lang === 'ar' ? 'النظراء' : 'Peers'}</th><th>{lang === 'ar' ? 'فني' : 'Technical'}</th><th>{lang === 'ar' ? 'الصحة المالية' : 'Financial health'}</th><th>{lang === 'ar' ? 'المخاطر' : 'Risk'}</th><th>{lang === 'ar' ? 'قيمة المحفظة' : 'Portfolio value'}</th><th>{lang === 'ar' ? 'الوزن' : 'Weight'}</th><th>{lang === 'ar' ? 'الحالة' : 'Status'}</th><th>{lang === 'ar' ? 'مخاوف الأساسيات' : 'Fundamentals flags'}</th></tr></thead>
                                <tbody>{opportunitiesData.strong_unheld.map((candidate) => { const matchedVerdict = verdicts.find((item) => item.holding_ticker === candidate.holding_ticker); const technical = matchedVerdict?.technical_signal; const flags = matchedVerdict?.holding_fundamentals?.flags ?? []; return <tr key={candidate.holding_ticker}>
                                  <td><b>{candidate.holding_ticker}</b></td>
                                  <td>{translateEntityName(candidate.holding_name, lang)}</td>
                                  <td>{candidate.signal || unavailableValue(lang)}</td>
                                  <td className={candidate.holding_return_percent !== null && candidate.holding_return_percent >= 0 ? 'ai-positive' : 'ai-negative'}>{candidate.holding_return_percent === null ? unavailableValue(lang) : `${Number(candidate.holding_return_percent).toFixed(1)}%`}</td>
                                  <td>{matchedVerdict?.coverage_percent === null || matchedVerdict?.coverage_percent === undefined ? unavailableValue(lang) : `${Number(matchedVerdict.coverage_percent).toFixed(1)}%`}</td>
                                  <td>{matchedVerdict ? `${matchedVerdict.comparables_beaten ?? 0}/${matchedVerdict.comparables_total ?? 0}` : unavailableValue(lang)}</td>
                                  <td>{matchedVerdict?.technical_grade || unavailableValue(lang)}{technical ? ` · ${technical.trend}` : ''}{technical?.confidence !== null && technical?.confidence !== undefined ? ` · ${Math.round(Number(technical.confidence) * 100)}%` : ''}{technical?.reversal_risk ? ` · ${technical.reversal_risk}` : ''}{technical?.patterns?.length ? ` · ${technical.patterns.map((pattern) => pattern.name).join(', ')}` : ''}</td>
                                  <td>{matchedVerdict?.financial_health_grade || unavailableValue(lang)}</td>
                                  <td>{matchedVerdict?.holding_risk_tier || candidate.risk_tier || unavailableValue(lang)}</td>
                                  <td>{matchedVerdict?.holding_current_value_egp === null || matchedVerdict?.holding_current_value_egp === undefined ? unavailableValue(lang) : `${Number(matchedVerdict.holding_current_value_egp).toLocaleString()} EGP`}</td>
                                  <td>{matchedVerdict?.holding_portfolio_weight_percent === null || matchedVerdict?.holding_portfolio_weight_percent === undefined ? unavailableValue(lang) : `${Number(matchedVerdict.holding_portfolio_weight_percent).toFixed(1)}%`}</td>
                                  <td>{matchedVerdict?.data_quality?.holding_snapshot_status || unavailableValue(lang)}{matchedVerdict?.data_quality?.holding_snapshot_age_hours !== null && matchedVerdict?.data_quality?.holding_snapshot_age_hours !== undefined ? ` · ${Number(matchedVerdict.data_quality.holding_snapshot_age_hours).toFixed(0)}h` : ''}{matchedVerdict?.data_completeness_warning ? ' · incomplete' : ''}{matchedVerdict?.flags?.length ? ` · ${matchedVerdict.flags.join(', ')}` : ''}</td>
                                  <td>{flags.length ? flags.map((flag) => getVerdictFlagMeta(flag.flag, lang).label + (flag.detail ? `: ${flag.detail}` : '')).join(' · ') : candidate.fundamentals_flags?.length ? candidate.fundamentals_flags.map((flag) => getVerdictFlagMeta(flag, lang).label).join(', ') : unavailableValue(lang)}</td>
                                </tr>; })}</tbody>
                              </table>
                            </div>
                          </section>
                          <div className="ai-bot-opportunity-analysis-grid">
                            <section className="ai-bot-opportunity-block">
                              <h5>{lang === 'ar' ? 'فجوات وتركيز القطاعات' : 'Sector Gaps & Concentration'}</h5>
                              {opportunitiesData.sector_concentration_in_opportunities?.length ? opportunitiesData.sector_concentration_in_opportunities.map((group) => <div className="ai-bot-opportunity-line" key={`concentration-${group.sector}`}><span>{translateSector(group.sector, lang)}</span><b>{group.count}</b><small>{group.tickers.join(', ')}</small></div>) : <p className="comparison-pending-label">{unavailableValue(lang)}</p>}
                              {opportunitiesData.underrepresented_sectors?.length ? <>
                                <h6>{lang === 'ar' ? 'القطاعات الأقل تمثيلاً' : 'Underrepresented sectors'}</h6>
                                {opportunitiesData.underrepresented_sectors.map((sector) => <div className="ai-bot-opportunity-line" key={`under-${sector.sector}`}><span>{translateSector(sector.sector, lang)}</span><b>{Number(sector.portfolio_allocation_percent).toFixed(1)}%</b><small>{lang === 'ar' ? 'قوي' : 'Strong'} {sector.held_strong_count ?? 0} · {lang === 'ar' ? 'حذر' : 'Caution'} {sector.held_caution_count ?? 0} · {lang === 'ar' ? 'تجنب' : 'Avoid'} {sector.held_avoid_count ?? 0} · {lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'} {sector.held_insufficient_data_count ?? 0}</small><small>{sector.strong_candidates.map((candidate) => { const v = verdicts.find((item) => item.holding_ticker === candidate.holding_ticker); return `${candidate.holding_ticker} ${candidate.holding_return_percent === null ? '' : `${Number(candidate.holding_return_percent).toFixed(1)}%`} ${candidate.signal || ''} · ${v?.coverage_percent === null || v?.coverage_percent === undefined ? unavailableValue(lang) : `${Number(v.coverage_percent).toFixed(1)}% coverage`} · ${v?.financial_health_grade || unavailableValue(lang)} / ${v?.technical_grade || unavailableValue(lang)} · ${v?.holding_risk_tier || unavailableValue(lang)}`; }).join(' · ') || unavailableValue(lang)}</small></div>)}
                              </> : null}
                            </section>
                            <section className="ai-bot-opportunity-block">
                              <h5>{lang === 'ar' ? 'لا يوجد تعرض ممتاز أو متين' : 'No Excellent/Solid Exposure'}</h5>
                              {opportunitiesData.sectors_no_strong_exposure?.length ? opportunitiesData.sectors_no_strong_exposure.map((sector) => <div className="ai-bot-opportunity-line" key={`no-strong-${sector.sector}`}><span>{translateSector(sector.sector, lang)}</span><b>{sector.unheld_strong_entities.length} {lang === 'ar' ? 'مرشح' : 'candidates'}</b><small>{lang === 'ar' ? 'قوي' : 'Strong'} {sector.held_strong_count ?? 0} · {lang === 'ar' ? 'حذر' : 'Caution'} {sector.held_caution_count ?? 0} · {lang === 'ar' ? 'تجنب' : 'Avoid'} {sector.held_avoid_count ?? 0} · {lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'} {sector.held_insufficient_data_count ?? 0}</small><small>{sector.unheld_strong_entities.map((candidate) => { const v = verdicts.find((item) => item.holding_ticker === candidate.ticker); return `${candidate.ticker} ${candidate.return_percent === null ? '' : `${Number(candidate.return_percent).toFixed(1)}%`} ${candidate.signal || ''} · ${v?.coverage_percent === null || v?.coverage_percent === undefined ? unavailableValue(lang) : `${Number(v.coverage_percent).toFixed(1)}% coverage`} · ${v?.financial_health_grade || unavailableValue(lang)} / ${v?.technical_grade || unavailableValue(lang)} · ${v?.holding_risk_tier || unavailableValue(lang)}`; }).join(' · ')}</small></div>) : <p className="comparison-pending-label">{unavailableValue(lang)}</p>}
                            </section>
                          </div>
                          {opportunitiesData.unheld_outperforming_held?.length ? <section className="ai-bot-opportunity-block"><h5>{lang === 'ar' ? 'فجوات العائد: غير محتفظ به مقابل محتفظ به' : 'Unheld vs Held Return Gaps'}</h5><div className="ai-bot-opportunity-table-wrap"><table><thead><tr><th>{lang === 'ar' ? 'غير محتفظ به' : 'Unheld'}</th><th>{lang === 'ar' ? 'محتفظ به' : 'Held'}</th><th>{lang === 'ar' ? 'فجوة العائد' : 'Return gap'}</th><th>{lang === 'ar' ? 'مقارنة المخاطر' : 'Risk comparison'}</th></tr></thead><tbody>{opportunitiesData.unheld_outperforming_held.map((pair, index) => <tr key={`${pair.unheld_ticker}-${pair.held_ticker}-${index}`}><td><b>{pair.unheld_ticker}</b> · {translateEntityName(pair.unheld_name, lang)}<br /><small>{pair.unheld_return === null ? unavailableValue(lang) : `${Number(pair.unheld_return).toFixed(1)}%`}</small></td><td><b>{pair.held_ticker}</b> · {translateEntityName(pair.held_name, lang)}<br /><small>{pair.held_return === null ? unavailableValue(lang) : `${Number(pair.held_return).toFixed(1)}%`}</small></td><td className="ai-positive">{Number(pair.gap_percent).toFixed(1)} pp</td><td>{pair.risk_comparison || unavailableValue(lang)}</td></tr>)}</tbody></table></div></section> : null}
                          {opportunitiesData.risk_tier_comparison && <section className="ai-bot-opportunity-risk"><h5>{lang === 'ar' ? 'مقارنة المخاطر' : 'Risk Comparison'}</h5><span>{lang === 'ar' ? 'متوسط مخاطر المحفظة' : 'Portfolio average risk'} <b>{opportunitiesData.risk_tier_comparison.portfolio_avg_risk || unavailableValue(lang)}</b></span><span>{lang === 'ar' ? 'متوسط مخاطر الفرص' : 'Opportunity average risk'} <b>{opportunitiesData.risk_tier_comparison.opportunities_avg_risk || unavailableValue(lang)}</b></span><span>{lang === 'ar' ? 'فرص أعلى مخاطرة' : 'Higher-risk opportunities'} <b>{opportunitiesData.risk_tier_comparison.higher_risk_opportunities}</b></span></section>}
                          <section className="ai-bot-opportunity-block">
                            <h5>{lang === 'ar' ? 'الفرص المحفوظة' : 'Persisted Opportunities'}</h5>
                            {opportunitiesData.persisted_opportunities?.length ? <div className="ai-bot-opportunity-table-wrap"><table><thead><tr><th>{lang === 'ar' ? 'الرمز' : 'Ticker'}</th><th>{lang === 'ar' ? 'النوع' : 'Type'}</th><th>{lang === 'ar' ? 'النص' : 'Opportunity'}</th><th>{lang === 'ar' ? 'المصدر' : 'Source'}</th><th>{lang === 'ar' ? 'التاريخ' : 'Generated'}</th></tr></thead><tbody>{opportunitiesData.persisted_opportunities.map((item, index) => <tr key={`${item.ticker}-${item.opportunity_type}-${index}`}><td><b>{item.ticker}</b><br /><small>{translateEntityName(item.name, lang)}</small></td><td>{item.opportunity_type}</td><td>{item.opportunity_text}</td><td>{item.model_used}</td><td>{item.generated_at ? new Date(item.generated_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : unavailableValue(lang)}</td></tr>)}</tbody></table></div> : <p className="comparison-pending-label">{unavailableValue(lang)}</p>}
                          </section>
                          <section className="ai-bot-opportunity-block">
                            <h5>{lang === 'ar' ? 'ملخص التحليل المنشأ' : 'Generated Analysis Summary'}</h5>
                            <button type="button" className="ai-bot-market-button" onClick={generateOpportunityReport} disabled={isGeneratingOpportunityReport || runId === null}>{isGeneratingOpportunityReport ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Generating…') : (lang === 'ar' ? 'إنشاء ملخص التحليل' : 'Generate analysis summary')}</button>
                            {opportunityAnalysisSummary && <pre className="ai-bot-opportunity-summary">{opportunityAnalysisSummary}</pre>}
                          </section>
                        </div>
                  </>
                </div>
          ) : (
            <div className="ai-bot-opportunities-section" data-pipeline-role="opportunity-scanner">
              <p className="comparison-pending-label">
                {dataLoadErrors.opportunities
                  ? (lang === 'ar' ? 'تعذر تحميل بيانات ماسح الفرص لهذا التشغيل.' : 'Opportunity Scanner data failed to load for this run.')
                  : (lang === 'ar' ? 'لا توجد بيانات فرص متاحة لهذا التشغيل.' : 'No opportunity data is available for this run.')}
              </p>
            </div>
                    )}
              
      </section>
      <section className={`ai-bot-engine ai-bot-alerts-engine ${isPortfolioAlertsExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="portfolio">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'تنبيهات المحفظة' : 'Portfolio Alerts'}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsPortfolioAlertsExpanded((expanded) => !expanded)} aria-expanded={isPortfolioAlertsExpanded} aria-label={isPortfolioAlertsExpanded ? 'Collapse portfolio alerts' : 'Expand portfolio alerts'} title={isPortfolioAlertsExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <AlertTriangle />
          </div>
        </div>
        <PortfolioAlerts alertsData={alertsData} lang={lang} />
      </section>
      <section className={`ai-bot-engine ai-bot-advisor-engine ai-bot-portfolio-advisor-engine ${isPortfolioAdvisorExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="portfolio">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'المستشار الذكي للمحفظة' : 'Portfolio Smart Advisor'}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsPortfolioAdvisorExpanded((expanded) => !expanded)} aria-expanded={isPortfolioAdvisorExpanded} aria-label={isPortfolioAdvisorExpanded ? 'Collapse portfolio Smart Advisor' : 'Expand portfolio Smart Advisor'} title={isPortfolioAdvisorExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <Brain />
          </div>
        </div>
        <article className="ai-bot-panel ai-bot-advice-panel">
          {portfolioSummary ? (
            <>
              {portfolioSummary.decision && (
                <div className="ai-bot-portfolio-decision-row">
                  <div className={`ai-bot-decision-pill ai-bot-decision-${portfolioSummary.decision}`}>{getDecisionMeta(portfolioSummary.decision, lang).label}</div>
                  {portfolioSummary.confidence !== null && portfolioSummary.confidence !== undefined && <span className="ai-bot-portfolio-confidence">{lang === 'ar' ? `الثقة: ${portfolioSummary.confidence}%` : `Confidence: ${portfolioSummary.confidence}%`}</span>}
                </div>
              )}
              <p className="ai-bot-recommendation">{formatSummaryText(portfolioSummary.summary_text, lang)}</p>
              <div className="ai-bot-advisor-transparency">
                <h4>{lang === 'ar' ? 'مصدر التوصية وبياناتها' : 'Recommendation provenance and data'}</h4>
                <div className="ai-bot-advisor-meta">
                  <span>{lang === 'ar' ? 'المصدر' : 'Source'} <b>{formatModelName(portfolioSummary.model_used, lang)}</b></span>
                  <span>{lang === 'ar' ? 'التشغيل' : 'Run'} <b>{portfolioSummary.run_id ?? runId ?? unavailableValue(lang)}</b></span>
                  <span>{lang === 'ar' ? 'التحديث' : 'Generated'} <b>{portfolioSummary.generated_at ? new Date(portfolioSummary.generated_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') : unavailableValue(lang)}</b></span>
                  <span>{lang === 'ar' ? 'الحالة' : 'Status'} <b>{portfolioSummary.model_used?.toLowerCase().includes('fallback') ? (lang === 'ar' ? 'بديل حتمي' : 'Deterministic fallback') : (lang === 'ar' ? 'ناتج النموذج' : 'Model output')}</b></span>
                </div>
                <div className="ai-bot-advisor-metrics">
                  <span>{lang === 'ar' ? 'ممتاز' : 'Excellent'} <b>{portfolioSummary.excellent_count}</b></span>
                  <span>{lang === 'ar' ? 'متين' : 'Solid'} <b>{portfolioSummary.solid_count}</b></span>
                  <span>{lang === 'ar' ? 'حذر' : 'Caution'} <b>{portfolioSummary.caution_count}</b></span>
                  <span>{lang === 'ar' ? 'تجنب' : 'Avoid'} <b>{portfolioSummary.avoid_count}</b></span>
                  <span>{lang === 'ar' ? 'بيانات غير كافية' : 'Insufficient Data'} <b>{portfolioSummary.insufficient_data_count}</b></span>
                  <span>{lang === 'ar' ? 'عليه تنبيه' : 'Flagged'} <b>{portfolioSummary.flagged_count ?? 0}</b></span>
                  <span>{lang === 'ar' ? 'متوسط التغطية' : 'Avg coverage'} <b>{portfolioSummary.avg_coverage_percent === null || portfolioSummary.avg_coverage_percent === undefined ? unavailableValue(lang) : `${Number(portfolioSummary.avg_coverage_percent).toFixed(1)}%`}</b></span>
                  <span>{lang === 'ar' ? 'مخاطر انعكاس' : 'Reversal risk'} <b>{portfolioSummary.reversal_risk_count ?? 0}</b></span>
                  <span>{lang === 'ar' ? 'تباعد فني' : 'Divergence'} <b>{portfolioSummary.divergence_count ?? 0}</b></span>
                </div>
                <div className="ai-bot-advisor-value-metrics">
                  {([['Excellent', portfolioSummary.excellent_value_percent], ['Solid', portfolioSummary.solid_value_percent], ['Caution', portfolioSummary.caution_value_percent], ['Avoid', portfolioSummary.avoid_value_percent], ['Insufficient Data', portfolioSummary.insufficient_value_percent]] as const).map(([label, value]) => <span key={label}>{label} <b>{value === null || value === undefined ? unavailableValue(lang) : `${Number(value).toFixed(1)}%`}</b></span>)}
                </div>
              </div>
              <div className="ai-bot-portfolio-list-section"><span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--evidence">{lang === 'ar' ? 'الأدلة' : 'Evidence'}</span>{portfolioSummary.evidence && portfolioSummary.evidence.length > 0 ? <ul className="ai-bot-portfolio-list">{portfolioSummary.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="ai-bot-advisor-empty-state">{lang === 'ar' ? 'لا توجد أدلة منظمة متاحة لهذا التشغيل.' : 'No structured evidence is available for this run.'}</p>}</div>
              <div className="ai-bot-portfolio-list-section"><span className="ai-bot-portfolio-list-label ai-bot-portfolio-list-label--risks">{lang === 'ar' ? 'المخاطر' : 'Risks'}</span>{portfolioSummary.risks && portfolioSummary.risks.length > 0 ? <ul className="ai-bot-portfolio-list ai-bot-portfolio-list--risks">{portfolioSummary.risks.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="ai-bot-advisor-empty-state">{lang === 'ar' ? 'لا توجد مخاطر منظمة متاحة لهذا التشغيل.' : 'No structured risks are available for this run.'}</p>}</div>
              <div className="ai-bot-advisor-opportunities">
                <h4>{lang === 'ar' ? 'سياق ماسح الفرص' : 'Opportunity Scanner context'}</h4>
                <p>{lang === 'ar' ? `مرشحون غير محتفظ بهم: ${opportunitiesData?.strong_unheld.length ?? 0}` : `Unheld candidates: ${opportunitiesData?.strong_unheld.length ?? 0}`}</p>
                <p>{lang === 'ar' ? `فجوات القطاعات: ${opportunitiesData?.underrepresented_sectors.length ?? 0} · فجوات التعرض: ${opportunitiesData?.sectors_no_strong_exposure?.length ?? 0}` : `Underrepresented sectors: ${opportunitiesData?.underrepresented_sectors.length ?? 0} · No-strong-exposure sectors: ${opportunitiesData?.sectors_no_strong_exposure?.length ?? 0}`}</p>
                <p>{lang === 'ar' ? `فجوات العائد: ${opportunitiesData?.unheld_outperforming_held?.length ?? 0} · فرص محفوظة: ${opportunitiesData?.persisted_opportunities?.length ?? 0}` : `Return-gap pairs: ${opportunitiesData?.unheld_outperforming_held?.length ?? 0} · Persisted opportunities: ${opportunitiesData?.persisted_opportunities?.length ?? 0}`}</p>
                {opportunityAnalysisSummary ? <pre className="ai-bot-opportunity-summary">{opportunityAnalysisSummary}</pre> : <p className="ai-bot-advisor-empty-state">{lang === 'ar' ? 'لم يتم إنشاء ملخص تحليل الفرص بعد. افتح ماسح الفرص وأنشئ الملخص لرؤية النص الكامل.' : 'No generated opportunity analysis summary yet. Open Opportunity Scanner and generate the summary to see the full analysis.'}</p>}
              </div>
              {portfolioSummary.next_review_days !== null && portfolioSummary.next_review_days !== undefined && <p className="ai-bot-portfolio-next-review">{lang === 'ar' ? `مراجعة المحفظة القادمة: خلال ${portfolioSummary.next_review_days} يوم` : `Next portfolio review: in ${portfolioSummary.next_review_days} day${portfolioSummary.next_review_days === 1 ? '' : 's'}`}</p>}
            </>
          ) : <p>{dataLoadErrors.summary ? (lang === 'ar' ? `تعذر تحميل مستشار المحفظة: ${dataLoadErrors.summary}` : `Portfolio Smart Advisor failed to load: ${dataLoadErrors.summary}`) : (lang === 'ar' ? 'سيظهر مستشار المحفظة بعد اكتمال التشغيل.' : 'Portfolio Smart Advisor will appear after the run completes.')}</p>}
        </article>
      </section>
      <section className={`ai-bot-engine ai-bot-alerts-engine ${isEntityAlertsExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="entity">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? `تنبيهات الأصل: ${entity.ticker}` : `Entity Alerts: ${entity.ticker}`}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsEntityAlertsExpanded((expanded) => !expanded)} aria-expanded={isEntityAlertsExpanded} aria-label={isEntityAlertsExpanded ? 'Collapse entity alerts' : 'Expand entity alerts'} title={isEntityAlertsExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <AlertTriangle />
          </div>
        </div>
        {entity && <EntityAlerts entity={entity} timeStop={entityTimeStop} thesis={entityThesis} drawdown={portfolioDrawdown} lang={lang} />}
      </section>
      <section className={`ai-bot-engine ai-bot-advisor-engine ${isEntityAdvisorExpanded ? '' : 'ai-bot-card-collapsed'}`} data-pipeline-section="entity">
        <div className="ai-bot-engine-header">
          <div>
            <h3>{lang === 'ar' ? 'المستشار الذكي' : 'Smart Advisor'}</h3>
          </div>
          <div className="ai-bot-engine-actions">
            <button type="button" className="ai-bot-section-toggle" onClick={() => setIsEntityAdvisorExpanded((expanded) => !expanded)} aria-expanded={isEntityAdvisorExpanded} aria-label={isEntityAdvisorExpanded ? 'Collapse Smart Advisor' : 'Expand Smart Advisor'} title={isEntityAdvisorExpanded ? 'Collapse' : 'Expand'}><ChevronDown /></button>
            <Brain />
          </div>
        </div>
        <article className="ai-bot-panel ai-bot-advice-panel">
          {recommendation?.model_used === 'error' ? (
            <div className="ai-bot-advisor-error-state" role="status">
              <strong>{lang === 'ar' ? 'تعذر إنشاء التوصية لهذا الأصل' : 'Recommendation generation failed'}</strong>
              <p>
                {lang === 'ar'
                  ? 'تعذر على المستشار الذكي إنشاء توصية لهذا الأصل في هذا التشغيل — ستتم المحاولة في التشغيل القادم.'
                  : 'Smart Advisor could not generate a recommendation for this entity this run — it will retry next run.'}
              </p>
            </div>
          ) : recommendation ? (
            <div className="ai-bot-advice-report-card">
              {/* 3.1: Decision Pill & Confidence Header */}
              {(() => {
                const inferredDecision = entity?.is_held
                  ? (verdict?.signal === 'Avoid' || verdict?.signal === 'Caution' ? 'consider_rotation' : 'hold')
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
                {recommendation.structured?.thesis_risk && (
                  <p className="ai-bot-recommendation-risk" style={{ marginTop: '8px', marginBottom: '10px', color: '#9ca3af', fontSize: '12px', lineHeight: 1.5 }}>
                    <strong style={{ color: '#d1d5db' }}>{lang === 'ar' ? 'مخاطرة:' : 'Risk:'}</strong> {recommendation.structured.thesis_risk}
                  </p>
                )}

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
                <div className="ai-bot-advice-section ai-bot-advice-safety-section ai-bot-legacy-safety-section">
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
                  <div className="ai-bot-alert-evidence-grid">
                    {entityTimeStop && (
                      <section className={`ai-bot-alert-evidence-card ${entityTimeStop.is_stagnant ? 'is-alert' : 'is-ok'}`}>
                        <h4>{lang === 'ar' ? 'وقف زمني' : 'Time Stop'}</h4>
                        <div className="ai-bot-alert-state">{entityTimeStop.is_stagnant ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}</div>
                        <dl>
                          <div><dt>{lang === 'ar' ? 'أيام الركود' : 'Stagnant days'}</dt><dd>{entityTimeStop.days_in_current_state ?? entityTimeStop.stagnant_days ?? unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'أيام العتبة' : 'Threshold days'}</dt><dd>{entityTimeStop.threshold_days ?? unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'تاريخ بدء الركود' : 'Stagnant since'}</dt><dd>{entityTimeStop.stagnant_since || unavailableValue(lang)}</dd></div>
                        </dl>
                        <p>{entityTimeStop.message || unavailableValue(lang)}</p>
                      </section>
                    )}
                    {entityThesis && (
                      <section className={`ai-bot-alert-evidence-card ${(entityThesis.has_reversal || entityThesis.signal_degraded) ? 'is-alert' : 'is-ok'}`}>
                        <h4>{lang === 'ar' ? 'فحص الأطروحة' : 'Thesis Check'}</h4>
                        <div className="ai-bot-alert-state">{entityThesis.has_reversal || entityThesis.signal_degraded ? (lang === 'ar' ? 'متدهورة' : 'Degraded') : (lang === 'ar' ? 'سليمة' : 'Intact')}</div>
                        <dl>
                          <div><dt>{lang === 'ar' ? 'الإشارة السابقة' : 'Prior signal'}</dt><dd>{entityThesis.prior_signal ? formatSignal(entityThesis.prior_signal, lang) : unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'الإشارة الحالية' : 'Current signal'}</dt><dd>{entityThesis.current_signal ? formatSignal(entityThesis.current_signal, lang) : unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'تمت المقارنة في' : 'Compared at'}</dt><dd>{entityThesis.compared_at || unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'الأعلام الجديدة' : 'New flags'}</dt><dd>{entityThesis.newly_appeared_flags?.length ? entityThesis.newly_appeared_flags.join(', ') : unavailableValue(lang)}</dd></div>
                        </dl>
                        <p>{entityThesis.message || unavailableValue(lang)}</p>
                      </section>
                    )}
                    {portfolioDrawdown && (
                      <section className={`ai-bot-alert-evidence-card ${(portfolioDrawdown.is_elevated || portfolioDrawdown.is_alert) ? 'is-alert' : 'is-ok'}`}>
                        <h4>{lang === 'ar' ? 'التراجع' : 'Drawdown'}</h4>
                        <div className="ai-bot-alert-state">{portfolioDrawdown.is_elevated || portfolioDrawdown.is_alert ? (lang === 'ar' ? 'مرتفع' : 'Elevated') : (lang === 'ar' ? 'طبيعي' : 'Normal')}</div>
                        <dl>
                          <div><dt>{lang === 'ar' ? 'التراجع الحالي' : 'Current drawdown'}</dt><dd>{portfolioDrawdown.current_drawdown_percent ?? portfolioDrawdown.drawdown_percent ?? unavailableValue(lang)}{portfolioDrawdown.current_drawdown_percent !== null && portfolioDrawdown.current_drawdown_percent !== undefined || portfolioDrawdown.drawdown_percent !== null && portfolioDrawdown.drawdown_percent !== undefined ? '%' : ''}</dd></div>
                          <div><dt>{lang === 'ar' ? 'قيمة الذروة' : 'Peak portfolio value'}</dt><dd>{portfolioDrawdown.peak_value ?? unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'القيمة الحالية' : 'Current portfolio value'}</dt><dd>{portfolioDrawdown.current_value ?? unavailableValue(lang)}</dd></div>
                          <div><dt>{lang === 'ar' ? 'عتبة التنبيه' : 'Alert threshold'}</dt><dd>{portfolioDrawdown.is_alert === undefined ? unavailableValue(lang) : '10%'}</dd></div>
                        </dl>
                      </section>
                    )}
                  </div>
                  {alertsData?.alerts && Object.keys(alertsData.alerts).length > 0 && (
                    <div className="ai-bot-alert-summary">
                      <strong>{lang === 'ar' ? 'ملخص تنبيهات المحفظة' : 'Portfolio Alert Summary'}</strong>
                      <div className="ai-bot-alert-table-wrap">
                        <table>
                          <thead><tr><th>{lang === 'ar' ? 'الرمز' : 'Ticker'}</th><th>{lang === 'ar' ? 'الوقف الزمني' : 'Time Stop'}</th><th>{lang === 'ar' ? 'الأطروحة' : 'Thesis'}</th><th>{lang === 'ar' ? 'الإشارة الحالية' : 'Current signal'}</th></tr></thead>
                          <tbody>{Object.entries(alertsData.alerts).map(([ticker, alert]) => <tr key={ticker}>
                            <td><b>{ticker}</b></td>
                            <td>{alert.timeStop ? (alert.timeStop.is_stagnant ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')) : unavailableValue(lang)}</td>
                            <td>{alert.thesis ? (alert.thesis.has_reversal || alert.thesis.signal_degraded ? (lang === 'ar' ? 'متدهورة' : 'Degraded') : (lang === 'ar' ? 'سليمة' : 'Intact')) : unavailableValue(lang)}</td>
                            <td>{alert.thesis?.current_signal ? formatSignal(alert.thesis.current_signal, lang) : unavailableValue(lang)}</td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3.6: Watchlist & Opportunity Candidate Hub (for unheld entities) */}
              {!entity?.is_held && (
                <div className="ai-bot-advice-section ai-bot-advice-watchlist-section">
                  <span className="comparison-holding-eyebrow">{lang === 'ar' ? 'تقييم قائمة المراقبة' : 'Watchlist Evaluation'}</span>
                  {(strongUnheldMatch || verdict?.signal === 'Excellent' || verdict?.signal === 'Solid') ? (
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
                  ) : verdict?.signal === 'Avoid' ? (
                    <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
                      <strong>{lang === 'ar' ? '⛔ غير موصى به' : '⛔ Not Recommended'}</strong>
                      <p>{lang === 'ar' ? 'أداؤه دون مجموعته النظيرة. غير موصى به للإضافة للمحفظة حالياً.' : 'Underperforming its peer group. Not recommended for portfolio inclusion at this time.'}</p>
                    </div>
                  ) : verdict?.signal === 'Caution' ? (
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
          ) : (strongUnheldMatch || verdict?.signal === 'Excellent' || verdict?.signal === 'Solid') ? (
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
          ) : verdict?.signal === 'Avoid' ? (
            <div className="ai-bot-watchlist-status ai-bot-watchlist-weak">
              <strong>{lang === 'ar' ? '⛔ غير موصى به' : '⛔ Not Recommended'}</strong>
              <p>{lang === 'ar' ? 'أصل قائمة المراقبة دون أداء مجموعته النظيرة. غير موصى به للإضافة للمحفظة حالياً.' : 'Watchlist asset underperforming its peer group. Not recommended for portfolio inclusion at this time.'}</p>
            </div>
          ) : verdict?.signal === 'Caution' ? (
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
