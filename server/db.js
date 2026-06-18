import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORE_TABLE = process.env.SUPABASE_STORE_TABLE || 'app_store';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

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

export async function getAll(userId) {
  const { data, error } = await supabase
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

export async function setAll(userId, payload) {
  const rows = KEYS
    .filter((key) => payload[key] !== undefined)
    .map((key) => ({
      user_id: userId,
      key,
      value: payload[key]
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from(STORE_TABLE)
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) throw error;
}
