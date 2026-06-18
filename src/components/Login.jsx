import { useState } from 'react';
import { hasSupabaseConfig } from '../utils/supabaseClient';
import { login, signUp } from '../utils/api';
import '../styles/Login.css';

export function Login({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState('signin');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') await signUp(email.trim(), password);
      else await login(email.trim(), password);
      onLogin();
    } catch (err) {
      setError(err?.message || 'Unable to sign in. Try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">⚡</div>
          <h1 className="login-title">Ultimate Tasks</h1>
          <p className="login-error">
            Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">⚡</div>
        <h1 className="login-title">Ultimate Tasks</h1>
        <p className="login-subtitle">
          {mode === 'signup' ? 'Create your workspace account' : 'Sign in to your workspace'}
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="email"
            className={`login-input${error ? ' error' : ''}`}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
          <input
            type="password"
            className={`login-input${error ? ' error' : ''}`}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-btn"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className="login-link-btn"
            disabled={loading}
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setError('');
            }}
          >
            {mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}
