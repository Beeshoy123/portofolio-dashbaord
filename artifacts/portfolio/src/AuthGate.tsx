import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setSubmitting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="portfolio-loading-screen">
        <div className="portfolio-loading-spinner" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="portfolio-loading-screen">
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
          <h2 style={{ marginBottom: 8 }}>Portfolio · Beeshoy</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {loginError && <div style={{ color: '#e5533d', fontSize: 12.5 }}>{loginError}</div>}
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    );
  }

  (window as unknown as { logoutFromPortfolio?: () => void }).logoutFromPortfolio = handleLogout;

  return <>{children}</>;
}
