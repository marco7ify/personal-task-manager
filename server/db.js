import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STORE_TABLE = process.env.SUPABASE_STORE_TABLE || 'app_store';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing Supabase configuration. Set SUPABASE_URL and a Supabase key (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY) in your environment.'
  );
}

/**
 * Build a client scoped to the calling user's JWT so RLS policies apply.
 * Works with the publishable key; a service-role key also works (bypasses RLS).
 */
function clientFor(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined
  });
}

const KEYS = [
  'items',
  'projects',
  'settings',
  'propertyDefs',
  'viewConfigs',
  'pages',
  'semesters',
  'jobs',
  'resumes'
];

export async function getAll(userId, accessToken) {
  const { data, error } = await clientFor(accessToken)
    .from(STORE_TABLE)
    .select('key, value')
    .eq('user_id', userId)
    .in('key', KEYS);

  if (error) throw error;

  const rowsByKey = new Map((data || []).map((row) => [row.key, row.value]));
  const result = {};

  for (const key of KEYS) {
    result[key] = rowsByKey.has(key) ? rowsByKey.get(key) : null;
  }

  return result;
}

export async function setAll(userId, payload, accessToken) {
  const rows = KEYS
    .filter((key) => payload[key] !== undefined)
    .map((key) => ({
      user_id: userId,
      key,
      value: payload[key]
    }));

  if (rows.length === 0) return;

  const { error } = await clientFor(accessToken)
    .from(STORE_TABLE)
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) throw error;
}
