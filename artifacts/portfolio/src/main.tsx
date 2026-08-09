import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import AuthGate from './AuthGate';
import { ApiError } from '@workspace/api-client-react';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry client errors (e.g. 404 "not seeded yet") — only
        // retry on transient/server failures.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthGate>
      <App />
    </AuthGate>
  </QueryClientProvider>,
);
