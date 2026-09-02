import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Spinner } from './ui/spinner';
import { AlertCircle, Brain, Zap, TrendingDown, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface AdvisorRecommendation {
  ticker: string;
  recommendation_text: string;
  generated_at: string;
  model_used: string;
}

interface AlertContext {
  ticker: string;
  timeStop?: {
    is_stagnant: boolean;
    stagnant_days: number | null;
    stagnant_since: string | null;
  };
  thesis?: {
    has_reversal: boolean;
    signal_degraded: boolean;
    compared_at: string | null;
  };
}

interface AlertSummaryResponse {
  alerts?: Record<string, AlertContext>;
  portfolio?: {
    drawdown?: {
      is_alert?: boolean;
      current_drawdown_percent?: number | null;
      drawdown_percent?: number | null;
    };
  };
}

interface DrawdownAlert {
  is_alert?: boolean;
  current_drawdown_percent?: number | null;
  drawdown_percent?: number | null;
}

interface BotStatusResponse {
  runId: number | null;
}

interface GenerationResult {
  ticker: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
}

interface GenerationResponse {
  success: boolean;
  results?: GenerationResult[];
  message?: string;
}

interface ComparisonVerdict {
  holding_ticker: string;
  holding_return_percent: number | null;
  holding_asset_role: string;
  return_period: string;
  signal: 'Excellent' | 'Solid' | 'Caution' | 'Avoid' | 'Insufficient Data';
  coverage_percent: number | null;
  data_completeness_warning: boolean;
  data_quality?: {
    holding_snapshot_status: 'fresh' | 'stale' | 'missing' | 'failed';
    holding_snapshot_age_hours: number | null;
    comparable_count: number;
    comparable_with_return_count: number;
  };
}

interface PortfolioOpportunity {
  ticker: string;
  name: string;
  opportunity_text: string;
  generated_at: string;
  model_used: string;
  opportunity_type: 'strong_unheld' | 'sector_gap' | 'underrepresented';
}

function recommendationAgeLabel(generatedAt: string): string {
  const ageHours = Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 3_600_000);
  if (ageHours < 1) return 'Generated less than 1 hour ago';
  if (ageHours < 24) return `Generated ${Math.floor(ageHours)} hours ago`;
  return `Generated ${Math.floor(ageHours / 24)} days ago`;
}

const STORAGE_KEY = 'advisor_last_generation_time';
const AUTO_GENERATION_COOLDOWN_HOURS = 1; // Auto-generate at most once per hour
const DRAWDOWN_ALERT_THRESHOLD_PERCENT = 10;

function describeAdvisorError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('gemini_api_key') || normalized.includes('api key')) {
    return 'The AI service is not configured on the server. Add GEMINI_API_KEY to the API environment, then try again.';
  }
  if (normalized.includes('429') || normalized.includes('rate limit')) {
    return 'The AI service is rate-limiting requests. Wait a moment and try Generate again.';
  }
  if (normalized.includes('timeout') || normalized.includes('aborted')) {
    return 'The AI service took too long to respond. Try Generate again; completed holdings will be kept.';
  }
  if (normalized.includes('no return data') || normalized.includes('no holdings')) {
    return 'There is not enough completed comparison data yet. Run the price checker and Comparison Judge first.';
  }
  if (normalized.includes('(409')) {
    return 'Another Smart Advisor generation is already running. Wait for it to finish before trying again.';
  }
  if (normalized.includes('(401') || normalized.includes('(403')) {
    return 'Your session is not authorized for Smart Advisor. Sign in again and retry.';
  }
  if (normalized.includes('(500') || normalized.includes('(502') || normalized.includes('(503')) {
    return 'The Smart Advisor server could not complete this request. Check that the backend is running, then try again.';
  }
  return message || 'Smart Advisor could not complete this request. Try again.';
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!supabase) return fetch(input, init);

  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  const token = data.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fallbackMessage: string,
): Promise<T> {
  const response = await authenticatedFetch(input, init);
  if (!response.ok) {
    const body = await response.text();
    let detail = body.trim();

    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      detail = parsed.message || parsed.error || detail;
    } catch {
      // Keep the raw response when the API did not return JSON.
    }

    throw new Error(
      `${fallbackMessage} (${response.status}${detail ? `: ${detail}` : ''})`,
    );
  }

  return response.json() as Promise<T>;
}

export function SmartAdvisorPanel() {
  const [recommendations, setRecommendations] = useState<AdvisorRecommendation[]>([]);
  const [opportunities, setOpportunities] = useState<PortfolioOpportunity[]>([]);
  const [alerts, setAlerts] = useState<Record<string, AlertContext>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingOpportunities, setGeneratingOpportunities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);
  const [lastOpportunitiesGenerationTime, setLastOpportunitiesGenerationTime] = useState<number | null>(null);
  const [drawdown, setDrawdown] = useState<DrawdownAlert | undefined>();
  const [generationResults, setGenerationResults] = useState<GenerationResult[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, ComparisonVerdict>>({});
  const [regeneratingTicker, setRegeneratingTicker] = useState<string | null>(null);
  const manualRequestRef = useRef<AbortController | null>(null);

  // Check if enough time has passed for auto-generation
  const canAutoGenerate = () => {
    if (!lastGenerationTime) return true;
    const now = Date.now();
    const cooldownMs = AUTO_GENERATION_COOLDOWN_HOURS * 60 * 60 * 1000;
    return now - lastGenerationTime > cooldownMs;
  };

  // Save generation time to localStorage
  const recordGenerationTime = () => {
    const now = Date.now();
    setLastGenerationTime(now);
    localStorage.setItem(STORAGE_KEY, now.toString());
  };

  // Fetch recommendations and alerts
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const botStatus = await requestJson<BotStatusResponse>(
          '/api/ai-bot/status',
          { signal: controller.signal },
          'Failed to fetch AI Bot status',
        );
        const recommendationsRequest = botStatus.runId === null
          ? Promise.resolve<AdvisorRecommendation[]>([])
          : requestJson<AdvisorRecommendation[]>(
            `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
            { signal: controller.signal },
            'Failed to fetch recommendations',
          );
        const opportunitiesRequest = botStatus.runId === null
          ? Promise.resolve<PortfolioOpportunity[]>([])
          : requestJson<PortfolioOpportunity[]>(
            `/api/advisor/opportunities?runId=${encodeURIComponent(botStatus.runId)}`,
            { signal: controller.signal },
            'Failed to fetch opportunities',
          ).catch(() => []);
        const alertsRequest = botStatus.runId === null
          ? Promise.resolve<AlertSummaryResponse>({ alerts: {} })
          : requestJson<AlertSummaryResponse>(
            `/api/alerts/summary?runId=${encodeURIComponent(botStatus.runId)}`,
            { signal: controller.signal },
            'Failed to fetch alerts',
          ).catch((): AlertSummaryResponse => ({ alerts: {} }));
        const verdictsRequest = botStatus.runId === null
          ? Promise.resolve<ComparisonVerdict[]>([])
          : requestJson<ComparisonVerdict[]>(
            `/api/rotation-verdicts?runId=${encodeURIComponent(botStatus.runId)}`,
            { signal: controller.signal },
            'Failed to fetch comparison evidence',
          ).catch(() => []);
        const [recRes, oppRes, alertRes, verdictRes] = await Promise.all([
          recommendationsRequest,
          opportunitiesRequest,
          alertsRequest,
          verdictsRequest,
        ]);

        setRecommendations(Array.isArray(recRes) ? recRes : []);
        setOpportunities(Array.isArray(oppRes) ? oppRes : []);
        setVerdicts(Object.fromEntries(verdictRes.map((verdict) => [verdict.holding_ticker, verdict])));
        setAlerts(alertRes.alerts || {});
        setDrawdown(alertRes.portfolio?.drawdown);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(describeAdvisorError(err));
        setRecommendations([]);
        setOpportunities([]);
        setAlerts({});
        setDrawdown(undefined);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // Load last generation time from localStorage
    const savedTime = localStorage.getItem(STORAGE_KEY);
    if (savedTime) {
      setLastGenerationTime(parseInt(savedTime, 10));
    }
    const savedOpportunitiesTime = localStorage.getItem(STORAGE_KEY + '_opportunities');
    if (savedOpportunitiesTime) {
      setLastOpportunitiesGenerationTime(parseInt(savedOpportunitiesTime, 10));
    }

    fetchData();
    // Refetch every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(interval);
      manualRequestRef.current?.abort();
    };
  }, []);

  // Auto-generate recommendations on mount if cooldown has passed
  useEffect(() => {
    const controller = new AbortController();
    const autoGenerate = async () => {
      if (!canAutoGenerate() || generating) return;

      try {
        setGenerating(true);
        const botStatus = await requestJson<BotStatusResponse>('/api/ai-bot/status', { signal: controller.signal }, 'Failed to fetch AI Bot status');
        if (botStatus.runId === null) return;
        const generation = await requestJson<GenerationResponse>(
          `/api/advisor/generate?runId=${encodeURIComponent(botStatus.runId)}`,
          { method: 'POST', signal: controller.signal },
          'Failed to generate recommendations',
        );
        setGenerationResults(generation.results ?? []);
        recordGenerationTime();

        const data = await requestJson<AdvisorRecommendation[]>(
          `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
          { signal: controller.signal },
          'Failed to fetch recommendations',
        );
        setRecommendations(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(describeAdvisorError(err));
        console.error('Auto-generation failed:', err);
      } finally {
        setGenerating(false);
      }
    };

    // Trigger auto-generation after initial fetch completes
    if (!loading && canAutoGenerate()) {
      autoGenerate();
    }
    return () => controller.abort();
  }, [loading]); // Only run once after initial load

  // Generate new recommendations (manual)
  const handleGenerateRecommendations = async () => {
    manualRequestRef.current?.abort();
    const controller = new AbortController();
    manualRequestRef.current = controller;
    try {
      setGenerating(true);
      setError(null);

      const botStatus = await requestJson<BotStatusResponse>('/api/ai-bot/status', { signal: controller.signal }, 'Failed to fetch AI Bot status');
      if (botStatus.runId === null) {
        throw new Error('Run the AI Bot pipeline before generating recommendations.');
      }
      const generation = await requestJson<GenerationResponse>(
        `/api/advisor/generate?runId=${encodeURIComponent(botStatus.runId)}`,
        { method: 'POST', signal: controller.signal },
        'Failed to generate recommendations',
      );
      setGenerationResults(generation.results ?? []);

      recordGenerationTime();

      // Refetch after generation
      const data = await requestJson<AdvisorRecommendation[]>(
        `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
        { signal: controller.signal },
        'Failed to fetch recommendations',
      );
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(describeAdvisorError(err));
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
      if (manualRequestRef.current === controller) manualRequestRef.current = null;
    }
  };

  const handleRegenerate = async (ticker: string) => {
    setRegeneratingTicker(ticker);
    setError(null);
    try {
      const botStatus = await requestJson<BotStatusResponse>(
        '/api/ai-bot/status',
        {},
        'Failed to fetch AI Bot status',
      );
      if (botStatus.runId === null) throw new Error('Run the AI Bot pipeline before generating recommendations.');
      const generation = await requestJson<GenerationResponse>(
        `/api/advisor/generate?runId=${encodeURIComponent(botStatus.runId)}&ticker=${encodeURIComponent(ticker)}`,
        { method: 'POST' },
        `Failed to regenerate ${ticker}`,
      );
      setGenerationResults(generation.results ?? []);
      const updated = await requestJson<AdvisorRecommendation[]>(
        `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
        {},
        'Failed to refresh recommendations',
      );
      setRecommendations(Array.isArray(updated) ? updated : []);
      recordGenerationTime();
    } catch (err) {
      setError(describeAdvisorError(err));
    } finally {
      setRegeneratingTicker(null);
    }
  };

  // Generate opportunities recommendations
  const handleGenerateOpportunities = async () => {
    try {
      setGeneratingOpportunities(true);
      setError(null);

      const botStatus = await requestJson<BotStatusResponse>('/api/ai-bot/status', {}, 'Failed to fetch AI Bot status');
      if (botStatus.runId === null) {
        throw new Error('Run the AI Bot pipeline before generating opportunities.');
      }
      const generation = await requestJson<GenerationResponse>(
        `/api/advisor/generate-opportunities?runId=${encodeURIComponent(botStatus.runId)}`,
        { method: 'POST' },
        'Failed to generate opportunities',
      );
      setGenerationResults(generation.results ?? []);

      recordOpportunitiesGenerationTime();

      // Refetch after generation
      const data = await requestJson<PortfolioOpportunity[]>(
        `/api/advisor/opportunities?runId=${encodeURIComponent(botStatus.runId)}`,
        {},
        'Failed to fetch opportunities',
      );
      setOpportunities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(describeAdvisorError(err));
    } finally {
      setGeneratingOpportunities(false);
    }
  };

  // Save opportunities generation time to localStorage
  const recordOpportunitiesGenerationTime = () => {
    const now = Date.now();
    setLastOpportunitiesGenerationTime(now);
    localStorage.setItem(STORAGE_KEY + '_opportunities', now.toString());
  };

  const activeTimeStops = Object.values(alerts).filter((alert) => alert.timeStop?.is_stagnant).length;
  const activeTheses = Object.values(alerts).filter((alert) => alert.thesis?.has_reversal).length;
  const drawdownPercent = drawdown?.current_drawdown_percent ?? drawdown?.drawdown_percent;
  const activeDrawdown = drawdownPercent !== null && drawdownPercent !== undefined && drawdownPercent >= DRAWDOWN_ALERT_THRESHOLD_PERCENT ? 1 : 0;
  const activeAlertCount = activeTimeStops + activeTheses + activeDrawdown;

  const confidenceFor = (verdict: ComparisonVerdict | undefined) => {
    if (!verdict || verdict.data_completeness_warning || verdict.data_quality?.holding_snapshot_status !== 'fresh' || verdict.signal === 'Insufficient Data') return 'Limited';
    if (verdict.data_quality.comparable_with_return_count < 3 || verdict.signal === 'Caution') return 'Moderate';
    return 'High';
  };

  return (
    <div className="smart-advisor-panel">
      <Card className="smart-advisor-card">
        <CardHeader className="smart-advisor-header">
          <div className="smart-advisor-heading">
            <div className="smart-advisor-mark">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="smart-advisor-kicker">Portfolio intelligence</div>
              <CardTitle>Smart Advisor</CardTitle>
              <CardDescription>AI recommendations grounded in your comparison data</CardDescription>
            </div>
          </div>
          <div className="smart-advisor-action">
            <span className="smart-advisor-live"><span /> Live analysis</span>
          </div>
        </CardHeader>

        <CardContent className="smart-advisor-content">
          {error && (
            <Alert className="smart-advisor-error" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Holding advisor</div>
                  <h3 className="mt-1 text-lg font-semibold">Entity recommendations</h3>
                </div>
                <Button
                  size="sm"
                  className="smart-advisor-generate"
                  onClick={handleGenerateRecommendations}
                  disabled={generating || loading}
                  variant="outline"
                >
                  {generating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              <div className="smart-advisor-metrics">
                <div className="advisor-metric advisor-metric-total">
                  <span className="advisor-metric-label">Active alerts</span>
                  <strong>{activeAlertCount}</strong>
                  <span className="advisor-metric-note">Across your portfolio</span>
                </div>
                <div className="advisor-metric advisor-metric-warning">
                  <span className="advisor-metric-label">Warnings</span>
                  <strong>{activeTimeStops}</strong>
                  <span className="advisor-metric-note">Time-stop reviews</span>
                </div>
                <div className="advisor-metric advisor-metric-critical">
                  <span className="advisor-metric-label">Critical</span>
                  <strong>{activeTheses + activeDrawdown}</strong>
                  <span className="advisor-metric-note">Thesis and drawdown risk</span>
                </div>
              </div>

              {(activeAlertCount > 0 || (drawdownPercent !== undefined && drawdownPercent !== null)) && (
                <div className="smart-advisor-status-row">
                  {activeTimeStops > 0 && (
                    <span className="advisor-status advisor-status-warning">
                      {activeTimeStops} time-stop {activeTimeStops === 1 ? 'review' : 'reviews'}
                    </span>
                  )}
                  {activeTheses > 0 && (
                    <span className="advisor-status advisor-status-critical">
                      {activeTheses} thesis {activeTheses === 1 ? 'risk' : 'risks'}
                    </span>
                  )}
                  {drawdownPercent !== undefined && (
                    <span className={`advisor-status ${activeDrawdown ? 'advisor-status-critical' : 'advisor-status-neutral'}`}>
                      Portfolio drawdown: {Number(drawdownPercent).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}

              {generationResults.length > 0 && (
                <div className="smart-advisor-run-status">
                  <span className="smart-advisor-run-label">Latest run</span>
                  {(['success', 'skipped', 'failed'] as const).map((resultStatus) => {
                    const count = generationResults.filter((result) => result.status === resultStatus).length;
                    if (count === 0) return null;
                    const label = resultStatus === 'success'
                      ? 'generated'
                      : resultStatus === 'skipped'
                        ? 'skipped'
                        : 'failed';
                    return (
                      <span
                        key={resultStatus}
                        className={`advisor-status ${
                          resultStatus === 'success'
                            ? 'advisor-status-success'
                            : resultStatus === 'skipped'
                              ? 'advisor-status-neutral'
                              : 'advisor-status-critical'
                        }`}
                      >
                        {count} {label}
                      </span>
                    );
                  })}
                </div>
              )}

              {lastGenerationTime && (
                <div className="smart-advisor-generation-info">
                  Last generated:{' '}
                  {new Date(lastGenerationTime).toLocaleTimeString()}
                  {!canAutoGenerate() && (
                    <div className="mt-1">
                      Next auto-generation:{' '}
                      {new Date(
                        lastGenerationTime + AUTO_GENERATION_COOLDOWN_HOURS * 60 * 60 * 1000
                      ).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="smart-advisor-loading">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : recommendations.length === 0 ? (
                <div className="smart-advisor-empty">
                  <Brain className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No recommendations yet.</p>
                  <p className="text-sm">Click "Generate" to create AI recommendations for your holdings.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => {
                    const verdict = verdicts[rec.ticker];
                    const confidence = confidenceFor(verdict);
                    const snapshotStatus = verdict?.data_quality?.holding_snapshot_status;
                    const needsRefresh = snapshotStatus === 'stale' || snapshotStatus === 'missing' || snapshotStatus === 'failed';

                    return (
                      <div key={rec.ticker} className="advisor-recommendation">
                        <div className="advisor-recommendation-topline">
                          <div>
                            <div className="advisor-ticker-line">
                              <h3>{rec.ticker}</h3>
                              <span className={`advisor-confidence advisor-confidence-${confidence.toLowerCase()}`}>
                                {confidence} confidence
                              </span>
                            </div>
                            <p className="advisor-recommendation-meta">
                              Generated {new Date(rec.generated_at).toLocaleDateString()} •{' '}
                              {rec.model_used}
                            </p>
                            <p className={`advisor-recommendation-age ${needsRefresh ? 'advisor-needs-refresh' : ''}`}>
                              {recommendationAgeLabel(rec.generated_at)}
                              {needsRefresh && ' · Refresh comparison data'}
                            </p>
                          </div>

                          <Button
                            className="advisor-regenerate"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRegenerate(rec.ticker)}
                            disabled={generating || regeneratingTicker !== null}
                          >
                            {regeneratingTicker === rec.ticker ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            <span className="sr-only">Regenerate {rec.ticker}</span>
                          </Button>

                          {alerts[rec.ticker] && (
                            <div className="advisor-alert-badges">
                              {alerts[rec.ticker].timeStop?.is_stagnant && (
                                <span className="advisor-status advisor-status-warning">
                                  <Zap className="h-3 w-3" />
                                  Time Stop
                                </span>
                              )}
                              {alerts[rec.ticker].thesis?.has_reversal && (
                                <span className="advisor-status advisor-status-critical">
                                  <TrendingDown className="h-3 w-3" />
                                  Thesis
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="advisor-recommendation-text">
                          {rec.recommendation_text}
                        </p>

                        {verdict && (
                          <div className="advisor-evidence">
                            <span>Signal: <strong>{verdict.signal}</strong></span>
                            <span>Period: {verdict.return_period.replace('return_', '')}</span>
                            <span>Evidence: {verdict.data_quality?.comparable_with_return_count ?? 0}/{verdict.data_quality?.comparable_count ?? 0} usable comparisons</span>
                            <span>Snapshot: {verdict.data_quality?.holding_snapshot_status ?? 'unknown'}</span>
                          </div>
                        )}

                        {alerts[rec.ticker] && (
                          <div className="advisor-alert-details">
                            {alerts[rec.ticker].timeStop?.is_stagnant && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Time Stop:</span> Stagnant for{' '}
                                {alerts[rec.ticker].timeStop?.stagnant_days ?? 'an unknown number of'} days
                              </div>
                            )}
                            {alerts[rec.ticker].thesis?.has_reversal && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Thesis Check:</span> Signal reversed.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Portfolio advisor</div>
                  <h3 className="mt-1 text-lg font-semibold">Opportunity analysis</h3>
                </div>
                <Button
                  size="sm"
                  className="smart-advisor-generate"
                  onClick={handleGenerateOpportunities}
                  disabled={generatingOpportunities || loading}
                  variant="outline"
                >
                  {generatingOpportunities ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {lastOpportunitiesGenerationTime && (
                <div className="smart-advisor-generation-info">
                  Last analyzed:{' '}
                  {new Date(lastOpportunitiesGenerationTime).toLocaleTimeString()}
                </div>
              )}

              {loading ? (
                <div className="smart-advisor-loading">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : opportunities.length === 0 ? (
                <div className="smart-advisor-empty">
                  <Brain className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No opportunities identified yet.</p>
                  <p className="text-sm">Click "Generate" to analyze strong unheld entities and sector gaps in your portfolio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {opportunities.map((opp) => (
                    <div key={`${opp.ticker}-${opp.opportunity_type}`} className="advisor-recommendation">
                      <div className="advisor-recommendation-topline">
                        <div>
                          <div className="advisor-ticker-line">
                            <h3>{opp.ticker}</h3>
                            <span className={`advisor-confidence advisor-confidence-${opp.opportunity_type === 'strong_unheld' ? 'high' : 'moderate'}`}>
                              {opp.opportunity_type === 'strong_unheld' ? 'Strong candidate' : opp.opportunity_type === 'sector_gap' ? 'Sector gap' : 'Underrepresented'}
                            </span>
                          </div>
                          <p className="advisor-recommendation-meta">
                            Generated {new Date(opp.generated_at).toLocaleDateString()} •{' '}
                            {opp.model_used}
                          </p>
                          <p className="advisor-recommendation-age">
                            {recommendationAgeLabel(opp.generated_at)}
                          </p>
                        </div>
                      </div>

                      <p className="advisor-recommendation-text">
                        {opp.opportunity_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
