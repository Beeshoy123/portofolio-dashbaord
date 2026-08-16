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
    const client = supabase;
    if (!client) {
      setAuthTokenGetter(async () => null);
      setLoading(false);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    setAuthTokenGetter(async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setSubmitting(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="portfolio-loading-screen">
        <div className="portfolio-loading-spinner" />
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">Portfolio setup</div>
          <h1>Portfolio · Beeshoy</h1>
          <p className="auth-subtitle">
            Authentication is not connected in this environment yet.
          </p>
          <div className="auth-error">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.
          </div>
          <p className="auth-help">
            The app is ready to run once its Supabase project is connected. No
            placeholder credentials are used.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">Portfolio access</div>
          <h1>Portfolio · Beeshoy</h1>
          <p className="auth-subtitle">Sign in to continue</p>

          <form onSubmit={handleLogin} className="auth-form">
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {loginError && <div className="auth-error">{loginError}</div>}

            <button type="submit" disabled={submitting} className="auth-button">
              {submitting ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  (window as unknown as { logoutFromPortfolio?: () => void }).logoutFromPortfolio = handleLogout;

  return <>{children}</>;
}
