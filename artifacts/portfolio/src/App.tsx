import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPortfolio,
  useUpdateFund,
  useCreateGrowthSnapshot,
  getGetPortfolioQueryKey,
  ApiError,
} from '@workspace/api-client-react';

import './portfolio.css';
import { computeDerived } from './lib/portfolioMath';
import { buildDashboardHtml } from './lib/dashboardHtml';
import { initDashboardBehavior } from './lib/dashboardBehavior';

export default function App() {
  const { data: portfolio, isLoading, isError, error } = useGetPortfolio();
  const queryClient = useQueryClient();
  const updateFundMutation = useUpdateFund();
  const createSnapshotMutation = useCreateGrowthSnapshot();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!portfolio || !containerRef.current) return;

    const derived = computeDerived(portfolio);
    containerRef.current.innerHTML = buildDashboardHtml(portfolio, derived);

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });

    const cleanup = initDashboardBehavior(portfolio, derived, {
      updateFund: async (key, body) => {
        await updateFundMutation.mutateAsync({ key, data: body });
        await invalidate();
      },
      createSnapshot: async (value) => {
        await createSnapshotMutation.mutateAsync({ data: { value } });
        await invalidate();
      },
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

  if (isLoading) {
    return (
      <div className="portfolio-loading-screen">
        <div className="portfolio-loading-spinner" />
        <div>Loading your portfolio…</div>
      </div>
    );
  }

  if (isError || !portfolio) {
    const notSeeded =
      error instanceof ApiError &&
      error.status === 404 &&
      (error.data as { error?: string } | null)?.error === 'NOT_SEEDED';

    if (notSeeded) {
      return (
        <div className="portfolio-loading-screen">
          <div style={{ fontSize: 32 }}>📭</div>
          <div>No portfolio data found — please import your data.</div>
          <div style={{ fontSize: 12, color: '#8a9a95' }}>
            The database is empty. Restore your data from a SQL backup, then
            reload this page.
          </div>
        </div>
      );
    }

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

  return <div ref={containerRef} />;
}
