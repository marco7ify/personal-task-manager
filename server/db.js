import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use DATA_DIR env var for Railway volume, otherwise local data/ folder
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'tasks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch())
  )
`);

const stmtGet    = db.prepare('SELECT value FROM store WHERE key = ?');
const stmtUpsert = db.prepare(
  'INSERT OR REPLACE INTO store (key, value, updated_at) VALUES (?, ?, unixepoch())'
);

const KEYS = ['items', 'projects', 'settings', 'propertyDefs', 'viewConfigs', 'pages', 'semesters'];

export function getAll() {
  const result = {};
  for (const key of KEYS) {
    const row = stmtGet.get(key);
    result[key] = row ? JSON.parse(row.value) : null;
  }
  return result;
}

export const setAll = db.transaction((data) => {
  for (const key of KEYS) {
    if (data[key] !== undefined) {
      stmtUpsert.run(key, JSON.stringify(data[key]));
    }
  }
});
