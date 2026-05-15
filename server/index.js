import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const app        = express();
const PORT       = process.env.PORT || 3001;
const PASSWORD   = process.env.APP_PASSWORD  || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET    || 'dev-secret-change-in-production';

app.use(express.json({ limit: '20mb' }));

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.get('/api/auth/verify', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// ── Data routes ──────────────────────────────────────────────────────────────
app.get('/api/data', requireAuth, (_req, res) => {
  try {
    res.json(db.getAll());
  } catch (err) {
    console.error('DB read error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/data', requireAuth, (req, res) => {
  try {
    db.setAll(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('DB write error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Serve frontend in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '../dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`✅  Server running → http://localhost:${PORT}`)
);
