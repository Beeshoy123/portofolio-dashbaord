import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Spinner } from './ui/spinner';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

type Candle = { date: string; open: number; high: number; low: number; close: number };
type Signal = {
  ticker: string;
  name: string;
  trend: 'uptrend' | 'downtrend' | 'sideways' | 'unknown';
  patterns: Array<{ name: string; date: string; direction: 'bullish' | 'bearish' | 'neutral' }>;
  confidence: number | string | null;
  candle_date: string | null;
  raw_fetch_ok: boolean;
  candles: Candle[];
};

async function authorizedJson<T>(url: string): Promise<T> {
  const headers = new Headers();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Chart Reader unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

function CandleChart({ candles }: { candles: Candle[] }) {
  const visible = candles.slice(-30);
  if (visible.length === 0) return <div className="py-6 text-center text-sm text-muted-foreground">No OHLC history available.</div>;
  const values = visible.flatMap((candle) => [candle.high, candle.low]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const y = (value: number) => 12 + ((max - value) / range) * 146;
  return (
    <div className="overflow-x-auto rounded-lg border bg-background p-3">
      <div className="flex h-44 min-w-[520px] items-stretch gap-1">
        {visible.map((candle) => {
          const bullish = candle.close >= candle.open;
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));
          return (
            <div key={candle.date} className="relative flex-1" title={`${candle.date}: ${candle.close.toFixed(2)}`}>
              <div className="absolute left-1/2 w-px -translate-x-1/2 bg-muted-foreground" style={{ top: y(candle.high), height: Math.max(1, y(candle.low) - y(candle.high)) }} />
              <div className={`absolute left-1/2 w-3 -translate-x-1/2 rounded-sm ${bullish ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ top: bodyTop, height: bodyHeight }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{visible[0].date}</span><span>{visible[visible.length - 1].date}</span></div>
    </div>
  );
}

export function ChartReaderPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await authorizedJson<{ runId: number | null }>('/api/ai-bot/status');
        if (status.runId === null) return;
        const result = await authorizedJson<{ signals: Signal[] }>(`/api/technical-signals?runId=${encodeURIComponent(status.runId)}`);
        const usableSignals = result.signals.filter((signal) => signal.raw_fetch_ok);
        setSignals(usableSignals);
        const mount = document.getElementById('chart-reader-mount');
        if (mount) {
          mount.setAttribute('data-technical-ready', String(usableSignals.length > 0));
          const view = document.querySelector('.bento')?.getAttribute('data-view');
          mount.style.display = view === 'ai' && usableSignals.length > 0 ? '' : 'none';
        }
        const pipelineStage = document.getElementById('ai-stage-chart-reader');
        const pipelineState = pipelineStage?.querySelector('span');
        if (pipelineStage && pipelineState) {
          pipelineState.textContent = usableSignals.length > 0 ? 'Completed' : 'Waiting';
          pipelineStage.style.borderColor = usableSignals.length > 0 ? 'var(--pnl-up)' : 'var(--edge)';
          pipelineState.style.color = usableSignals.length > 0 ? 'var(--pnl-up)' : 'var(--dim)';
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Chart Reader unavailable');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <div className="flex items-center justify-center p-6"><Spinner className="h-5 w-5" /></div>;
  if (error) return <Card><CardContent className="p-4 text-sm text-muted-foreground">{error}</CardContent></Card>;
  if (signals.length === 0) return <Card><CardContent className="p-4 text-sm text-muted-foreground">No candlestick data is available for the latest Chart Reader run.</CardContent></Card>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2"><Activity className="h-5 w-5" /><div><h2 className="font-semibold">Chart Reader</h2><p className="text-xs text-muted-foreground">Candlestick patterns, trend, and momentum context</p></div></div>
      {signals.map((signal) => {
        const confidence = signal.confidence === null ? null : Number(signal.confidence);
        const TrendIcon = signal.trend === 'downtrend' ? TrendingDown : TrendingUp;
        return (
          <Card key={signal.ticker}>
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{signal.ticker}</CardTitle><CardDescription>{signal.name}</CardDescription></div><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium"><TrendIcon className="mr-1 inline h-3 w-3" />{signal.trend}</span></div></CardHeader>
            <CardContent className="space-y-3"><CandleChart candles={signal.candles} /><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Confidence: {confidence === null ? 'unavailable' : `${Math.round(confidence * 100)}%`}</span><span>As of: {signal.candle_date ?? 'unavailable'}</span></div>{signal.patterns.length > 0 ? <div className="flex flex-wrap gap-2">{signal.patterns.map((pattern) => <span key={`${pattern.name}-${pattern.date}`} className={`rounded-full px-2 py-1 text-xs font-medium ${pattern.direction === 'bullish' ? 'bg-emerald-100 text-emerald-800' : pattern.direction === 'bearish' ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>{pattern.name} · {pattern.date}</span>)}</div> : <p className="text-xs text-muted-foreground">No recent candlestick pattern detected.</p>}</CardContent>
          </Card>
        );
      })}
    </div>
  );
}
