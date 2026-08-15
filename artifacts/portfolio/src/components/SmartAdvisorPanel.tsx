import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Spinner } from './ui/spinner';
import { AlertCircle, Brain, Zap, TrendingDown, RefreshCw } from 'lucide-react';

interface AdvisorRecommendation {
  holding_ticker: string;
  recommendation_text: string;
  generated_at: string;
  model_used: string;
}

interface AlertContext {
  ticker: string;
  timeStop?: {
    is_alert: boolean;
    days_stagnant: number;
    last_signal_date: string;
  };
  thesis?: {
    is_alert: boolean;
    thesis_reversed: boolean;
    current_return: number;
  };
  portfolio?: {
    drawdown_percent: number;
    is_alert: boolean;
  };
}

const STORAGE_KEY = 'advisor_last_generation_time';
const AUTO_GENERATION_COOLDOWN_HOURS = 1; // Auto-generate at most once per hour

export function SmartAdvisorPanel() {
  const [recommendations, setRecommendations] = useState<AdvisorRecommendation[]>([]);
  const [alerts, setAlerts] = useState<Record<string, AlertContext>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);

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

        const [recRes, alertRes] = await Promise.all([
          fetch('/api/advisor/recommendations'),
          fetch('/api/alerts/summary'),
        ]);

        if (!recRes.ok) throw new Error('Failed to fetch recommendations');
        if (!alertRes.ok) throw new Error('Failed to fetch alerts');

        const recData = await recRes.json();
        const alertData = await alertRes.json();

        setRecommendations(Array.isArray(recData) ? recData : []);
        setAlerts(alertData.alerts || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRecommendations([]);
        setAlerts({});
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
        const res = await fetch('/api/advisor/generate', { method: 'POST' });
        
        if (res.ok) {
          recordGenerationTime();
          
          // Refetch after generation
          const recRes = await fetch('/api/advisor/recommendations');
          if (recRes.ok) {
            const data = await recRes.json();
            setRecommendations(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
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

      const res = await fetch('/api/advisor/generate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate recommendations');

      recordGenerationTime();

      // Refetch after generation
      const recRes = await fetch('/api/advisor/recommendations');
      if (recRes.ok) {
        const data = await recRes.json();
        setRecommendations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

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
                  key={rec.holding_ticker}
                  className="rounded-lg border bg-muted/30 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{rec.holding_ticker}</h3>
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(rec.generated_at).toLocaleDateString()} •{' '}
                        {rec.model_used}
                      </p>
                    </div>

                    {/* Alert badges */}
                    {alerts[rec.holding_ticker] && (
                      <div className="flex gap-2">
                        {alerts[rec.holding_ticker].timeStop?.is_alert && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            <Zap className="h-3 w-3" />
                            Time Stop
                          </span>
                        )}
                        {alerts[rec.holding_ticker].thesis?.is_alert && (
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
