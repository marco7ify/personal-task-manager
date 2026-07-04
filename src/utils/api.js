import { hasSupabaseConfig, supabase } from './supabaseClient';

const TOKEN_KEY = 'ut_auth_token';
const OFFLINE_KEY = 'ut_offline_mode';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function storeToken(token) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function isAuthenticated() { return !!getToken(); }

/** Local-only mode: skip server auth/sync entirely and use localStorage. */
export function isOfflineMode() { return localStorage.getItem(OFFLINE_KEY) === '1'; }
export function enableOfflineMode() { localStorage.setItem(OFFLINE_KEY, '1'); }
export function disableOfflineMode() { localStorage.removeItem(OFFLINE_KEY); }

export async function refreshAuthToken() {
  if (!hasSupabaseConfig) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    clearToken();
    return null;
  }

  storeToken(data.session.access_token);
  return data.session.access_token;
}

export function subscribeToAuthChanges(onChange) {
  if (!hasSupabaseConfig) return { unsubscribe: () => {} };

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) storeToken(session.access_token);
    else clearToken();
    onChange?.(session);
  });

  return data.subscription;
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email, password) {
  if (!hasSupabaseConfig) {
    throw new Error('Missing Supabase frontend configuration.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.session?.access_token) throw new Error('No session returned.');

  storeToken(data.session.access_token);
}

export async function signUp(email, password) {
  if (!hasSupabaseConfig) {
    throw new Error('Missing Supabase frontend configuration.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error('Check your email to confirm your account before signing in.');
  }

  storeToken(data.session.access_token);
}

export async function logout() {
  if (hasSupabaseConfig) await supabase.auth.signOut();
  clearToken();
}

export async function verifyToken() {
  try {
    if (!getToken()) await refreshAuthToken();
    const res = await fetch('/api/auth/verify', { headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchData() {
  const res = await fetch('/api/data', { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export async function saveData(payload) {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}
