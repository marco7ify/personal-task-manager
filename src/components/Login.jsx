import { useState } from 'react';
import { login } from '../utils/api';
import '../styles/Login.css';

export function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(password);
      onLogin();
    } catch {
      setError('Wrong password. Try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">⚡</div>
        <h1 className="login-title">Ultimate Tasks</h1>
        <p className="login-subtitle">Sign in to your workspace</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className={`login-input${error ? ' error' : ''}`}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-btn"
            disabled={loading || !password.trim()}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
