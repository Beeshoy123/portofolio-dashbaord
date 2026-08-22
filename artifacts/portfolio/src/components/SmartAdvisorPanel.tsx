import { useEffect, useState } from 'react';
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

interface BotStatusResponse {
  runId: number | null;
}

const STORAGE_KEY = 'advisor_last_generation_time';
const AUTO_GENERATION_COOLDOWN_HOURS = 1; // Auto-generate at most once per hour
const DRAWDOWN_ALERT_THRESHOLD_PERCENT = 10;

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
  const [alerts, setAlerts] = useState<Record<string, AlertContext>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);
  const [drawdown, setDrawdown] = useState<AlertSummaryResponse['portfolio'] extends { drawdown?: infer T } ? T : undefined>();

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
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const botStatus = await requestJson<BotStatusResponse>(
          '/api/ai-bot/status',
          {},
          'Failed to fetch AI Bot status',
        );
        const recommendationsPath = botStatus.runId === null
          ? '/api/advisor/recommendations'
          : `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`;
        const [recRes, alertRes] = await Promise.all([
          requestJson<AdvisorRecommendation[]>(recommendationsPath, {}, 'Failed to fetch recommendations'),
          requestJson<AlertSummaryResponse>(
            '/api/alerts/summary',
            {},
            'Failed to fetch alerts',
          ),
        ]);

        setRecommendations(Array.isArray(recRes) ? recRes : []);
        setAlerts(alertRes.alerts || {});
        setDrawdown(alertRes.portfolio?.drawdown);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRecommendations([]);
        setAlerts({});
        setDrawdown(undefined);
      } finally {
        setLoading(false);
      }
    };

    // Load last generation time from localStorage
    const savedTime = localStorage.getItem(STORAGE_KEY);
    if (savedTime) {
      setLastGenerationTime(parseInt(savedTime, 10));
    }

    fetchData();
    // Refetch every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-generate recommendations on mount if cooldown has passed
  useEffect(() => {
    const autoGenerate = async () => {
      if (!canAutoGenerate() || generating) return;

      try {
        setGenerating(true);
        await requestJson('/api/advisor/generate', { method: 'POST' }, 'Failed to generate recommendations');
        recordGenerationTime();

        const botStatus = await requestJson<BotStatusResponse>('/api/ai-bot/status', {}, 'Failed to fetch AI Bot status');
        const data = await requestJson<AdvisorRecommendation[]>(
          botStatus.runId === null ? '/api/advisor/recommendations' : `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
          {},
          'Failed to fetch recommendations',
        );
        setRecommendations(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
        console.error('Auto-generation failed:', err);
      } finally {
        setGenerating(false);
      }
    };

    // Trigger auto-generation after initial fetch completes
    if (!loading && canAutoGenerate()) {
      autoGenerate();
    }
  }, [loading]); // Only run once after initial load

  // Generate new recommendations (manual)
  const handleGenerateRecommendations = async () => {
    try {
      setGenerating(true);
      setError(null);

      await requestJson('/api/advisor/generate', { method: 'POST' }, 'Failed to generate recommendations');

      recordGenerationTime();

      // Refetch after generation
      const botStatus = await requestJson<BotStatusResponse>('/api/ai-bot/status', {}, 'Failed to fetch AI Bot status');
      const data = await requestJson<AdvisorRecommendation[]>(
        botStatus.runId === null ? '/api/advisor/recommendations' : `/api/advisor/recommendations?runId=${encodeURIComponent(botStatus.runId)}`,
        {},
        'Failed to fetch recommendations',
      );
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const activeTimeStops = Object.values(alerts).filter((alert) => alert.timeStop?.is_stagnant).length;
  const activeTheses = Object.values(alerts).filter((alert) => alert.thesis?.has_reversal).length;
  const drawdownPercent = drawdown?.current_drawdown_percent ?? drawdown?.drawdown_percent;
  const activeDrawdown = drawdownPercent !== null && drawdownPercent !== undefined && drawdownPercent >= DRAWDOWN_ALERT_THRESHOLD_PERCENT ? 1 : 0;
  const activeAlertCount = activeTimeStops + activeTheses + activeDrawdown;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <div>
                <CardTitle>Smart Advisor</CardTitle>
                <CardDescription>AI-powered investment recommendations</CardDescription>
              </div>
            </div>
            <Button
              size="sm"
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
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 border-b pb-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Active alerts</div>
              <div className="mt-1 text-xl font-bold">{activeAlertCount}</div>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <div className="text-xs text-yellow-800">Warnings</div>
              <div className="mt-1 text-xl font-bold text-yellow-800">{activeTimeStops}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-xs text-red-800">Critical</div>
              <div className="mt-1 text-xl font-bold text-red-800">{activeTheses + activeDrawdown}</div>
            </div>
          </div>
          {(activeAlertCount > 0 || drawdownPercent !== undefined && drawdownPercent !== null) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {activeTimeStops > 0 && (
                <span className="rounded-full bg-yellow-100 px-2 py-1 font-medium text-yellow-800">
                  {activeTimeStops} time-stop {activeTimeStops === 1 ? 'review' : 'reviews'}
                </span>
              )}
              {activeTheses > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-800">
                  {activeTheses} thesis {activeTheses === 1 ? 'risk' : 'risks'}
                </span>
              )}
              {drawdownPercent !== undefined && (
                <span className={`rounded-full px-2 py-1 font-medium ${activeDrawdown ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>
                  Portfolio drawdown: {Number(drawdownPercent).toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generation info */}
          {lastGenerationTime && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
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
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <Brain className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No recommendations yet.</p>
              <p className="text-sm">Click "Generate" to create AI recommendations for your holdings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.ticker}
                  className="rounded-lg border bg-muted/30 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{rec.ticker}</h3>
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(rec.generated_at).toLocaleDateString()} •{' '}
                        {rec.model_used}
                      </p>
                    </div>

                    {/* Alert badges */}
                    {alerts[rec.ticker] && (
                      <div className="flex gap-2">
                        {alerts[rec.ticker].timeStop?.is_stagnant && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            <Zap className="h-3 w-3" />
                            Time Stop
                          </span>
                        )}
                        {alerts[rec.ticker].thesis?.has_reversal && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                            <TrendingDown className="h-3 w-3" />
                            Thesis
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-card-foreground">
                    {rec.recommendation_text}
                  </p>

                  {/* Alert details */}
                  {alerts[rec.holding_ticker] && (
                    <div className="mt-3 space-y-2 border-t pt-2">
                      {alerts[rec.holding_ticker].timeStop?.is_alert && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Time Stop:</span> Stagnant for{' '}
                          {alerts[rec.holding_ticker].timeStop.days_stagnant} days
                        </div>
                      )}
                      {alerts[rec.holding_ticker].thesis?.is_alert && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Thesis Check:</span> Signal reversed,
                          current return {(alerts[rec.holding_ticker].thesis.current_return || 0).toFixed(2)}%
                        </div>
                      )}
                      {alerts[rec.holding_ticker].portfolio?.is_alert && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Portfolio Drawdown:</span>{' '}
                          {(alerts[rec.holding_ticker].portfolio.drawdown_percent || 0).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
