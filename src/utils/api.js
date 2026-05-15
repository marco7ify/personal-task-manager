const TOKEN_KEY = 'ut_auth_token';

export function getToken()          { return localStorage.getItem(TOKEN_KEY); }
export function storeToken(token)   { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken()        { localStorage.removeItem(TOKEN_KEY); }
export function isAuthenticated()   { return !!getToken(); }

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Wrong password');
  const { token } = await res.json();
  storeToken(token);
}

export async function verifyToken() {
  try {
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
