import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const app        = express();
const PORT       = process.env.PORT || 3005;
const PASSWORD   = process.env.APP_PASSWORD  || 'changeme';
const JWT_SECRET = process.env.JWT_SECRET    || 'dev-secret-change-in-production';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

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
const ORGANIZER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions', 'warnings'],
  properties: {
    warnings: {
      type: 'array',
      items: { type: 'string' }
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'kind',
          'action',
          'title',
          'notes',
          'confidence',
          'destination',
          'createNewDestination',
          'projectId',
          'projectName',
          'subfolder',
          'date',
          'time',
          'recurrence',
          'subtasks',
          'existingTaskId',
          'company',
          'role',
          'link',
          'status',
          'payRate',
          'schedule',
          'location',
          'notebookId',
          'notebookTitle',
          'pageTitle',
          'blockFormat',
          'blocks'
        ],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['task', 'event', 'job', 'page'] },
          action: {
            type: 'string',
            enum: ['create_item', 'append_subtask', 'create_parent_with_subtasks', 'create_job', 'create_page']
          },
          title: { type: 'string' },
          notes: { type: 'string' },
          confidence: { type: 'number' },
          destination: { type: 'string' },
          createNewDestination: { type: 'boolean' },
          projectId: { type: ['string', 'null'] },
          projectName: { type: ['string', 'null'] },
          subfolder: { type: ['string', 'null'] },
          date: { type: ['string', 'null'] },
          time: { type: ['string', 'null'] },
          recurrence: { type: ['string', 'null'], enum: ['none', 'daily', 'weekly', 'monthly', null] },
          subtasks: {
            type: 'array',
            items: { type: 'string' }
          },
          existingTaskId: { type: ['string', 'null'] },
          company: { type: ['string', 'null'] },
          role: { type: ['string', 'null'] },
          link: { type: ['string', 'null'] },
          status: {
            type: ['string', 'null'],
            enum: ['interested', 'applied', 'interviewing', 'accepted', 'rejected', null]
          },
          payRate: { type: ['string', 'null'] },
          schedule: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
          notebookId: { type: ['string', 'null'] },
          notebookTitle: { type: ['string', 'null'] },
          pageTitle: { type: ['string', 'null'] },
          blockFormat: {
            type: 'string',
            enum: ['bullet', 'todo', 'hyphen_text', 'plain_text']
          },
          blocks: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
};

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function buildOrganizerPrompt({ inputText, options, context }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return [
    'You organize messy personal capture text for a task manager.',
    'Return only structured JSON matching the schema.',
    `Today is ${today} in America/Chicago. Use YYYY-MM-DD dates.`,
    '',
    'Rules:',
    '- Respect enabled categories. Do not suggest disabled categories.',
    '- Do not warn that a disabled category cannot be used unless the content has no reasonable enabled-category interpretation.',
    '- If pages/notebooks are disabled but tasks are enabled, convert ideas and concept lists into tasks with subtasks instead of page suggestions.',
    '- If only pages/notebooks are enabled, convert idea/reference/task-list content into create_page suggestions, not task/project suggestions.',
    '- Prefer existing destinations by id when possible.',
    '- If allowNewDestinations is false, do not set createNewDestination true.',
    '- Use append_subtask when a new item clearly belongs under an existing open task.',
    '- Use create_parent_with_subtasks when several new items are clearly parts of one outcome.',
    '- Use event only when the text is an appointment, scheduled call, class, meeting, or time-bound event.',
    '- Extract date/time only when clear. Tomorrow/tmrw/tmmrw/tomoroow mean the day after today. Otherwise leave date/time null and preserve timing in notes.',
    '- Jobs should include company/role/link/status/payRate/schedule/location when available.',
    '- Ideas, references, concepts, website/app/business ideas should become notebook pages or blocks.',
    '- For notebook pages, default blockFormat to bullet unless the user asks for plain text, hyphen text, or a to-do/checklist page.',
    '- For notebookTitle, use an explicit Notebook: heading when present. If no notebook heading exists, leave notebookTitle null instead of guessing a broad folder like Personal.',
    '- Keep titles short and user-facing.',
    '',
    `Options: ${JSON.stringify(options)}`,
    `Existing context: ${JSON.stringify(context)}`,
    '',
    'Raw input:',
    inputText
  ].join('\n');
}

app.post('/api/ai/organize', async (req, res) => {
  const apiKey = req.headers['x-openai-api-key'] || req.body?.apiKey;
  const inputText = String(req.body?.inputText || '').trim();
  const model = String(req.body?.model || 'gpt-5.5').trim();
  const options = req.body?.options || {};
  const context = req.body?.context || {};

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'OpenAI API key is required.' });
  }
  if (!inputText) {
    return res.status(400).json({ error: 'Paste some text to organize first.' });
  }

  try {
    const openaiRes = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content:
              'You are a careful information organizer for a personal task manager. Produce precise, conservative suggestions.'
          },
          {
            role: 'user',
            content: buildOrganizerPrompt({ inputText, options, context })
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_intake_suggestions',
            strict: true,
            schema: ORGANIZER_SCHEMA
          },
          verbosity: 'low'
        }
      })
    });

    const data = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: data?.error?.message || 'OpenAI request failed.'
      });
    }

    const text = extractResponseText(data);
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('AI organizer error:', err);
    res.status(500).json({ error: err?.message || 'AI organizer failed.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '../dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`✅  Server running → http://localhost:${PORT}`)
);
