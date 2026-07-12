import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPortfolio,
  useUpdateFund,
  useCreateGrowthSnapshot,
  getGetPortfolioQueryKey,
  ApiError,
  type Portfolio,
} from '@workspace/api-client-react';

import './portfolio.css';
import { computeDerived } from './lib/portfolioMath';
import { buildDashboardHtml } from './lib/dashboardHtml';
import { initDashboardBehavior } from './lib/dashboardBehavior';

// Shown only in place of real data when the database has no rows yet, so the
// full widget/card/heatmap layout can still be previewed with its real CSS —
// every figure here is a zero/empty placeholder, never a fabricated balance.
const EMPTY_PORTFOLIO: Portfolio = {
  gold: {
    gramsHeld: 0,
    costBasis: 0,
    avgCostPerGram: 0,
    cashbackPerGram: 0,
    livePricePerGram: null,
    currentValue: null,
    pnl: null,
    buyPrice24k: null,
    sellPrice24k: null,
    buyPrice21k: null,
    sellPrice21k: null,
    goldPriceStatus: null,
    transactions: [],
  },
  funds: [],
  certificates: [],
  transactions: [],
  snapshots: [],
  settings: {
    emergencyFundTarget: 0,
    usdEgpRate: 0,
    usdEgpStatus: null,
  },
};

export default function App() {
  const { data: portfolio, isLoading, isError, error } = useGetPortfolio();
  const queryClient = useQueryClient();
  const updateFundMutation = useUpdateFund();
  const createSnapshotMutation = useCreateGrowthSnapshot();
  const containerRef = useRef<HTMLDivElement>(null);

  const notSeeded =
    isError &&
    error instanceof ApiError &&
    error.status === 404 &&
    (error.data as { error?: string } | null)?.error === 'NOT_SEEDED';

  // When the database is empty, render the full dashboard layout anyway
  // using zeroed placeholder data, so every widget/card/heatmap keeps its
  // real styling instead of being replaced by a blank state.
  const dataToRender = portfolio ?? (notSeeded ? EMPTY_PORTFOLIO : undefined);

  useEffect(() => {
    if (!dataToRender || !containerRef.current) return;

    const derived = computeDerived(dataToRender);
    containerRef.current.innerHTML = buildDashboardHtml(dataToRender, derived);

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });

    const cleanup = initDashboardBehavior(dataToRender, derived, {
      updateFund: async (key, body) => {
        if (notSeeded) return; // no real fund rows to edit yet
        await updateFundMutation.mutateAsync({ key, data: body });
        await invalidate();
      },
      createSnapshot: async (value) => {
        if (notSeeded) return; // no portfolio row to snapshot yet
        await createSnapshotMutation.mutateAsync({ data: { value } });
        await invalidate();
      },
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataToRender]);

  if (isLoading) {
    return (
      <div className="portfolio-loading-screen">
        <div className="portfolio-loading-spinner" />
        <div>Loading your portfolio…</div>
      </div>
    );
  }

  if (isError && !notSeeded) {
    return (
      <div className="portfolio-loading-screen">
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div>Couldn't load your portfolio.</div>
        <div style={{ fontSize: 12, color: '#8a9a95' }}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <>
      {notSeeded && (
        <div className="portfolio-alert-banner">
          ⚠️ No data found — the database is empty. Every widget below is
          showing placeholder zeros, not real figures.
        </div>
      )}
      <div ref={containerRef} />
    </>
  );
}
