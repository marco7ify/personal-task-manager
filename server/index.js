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
          'itemType',
          'matchedRuleIds',
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
          'contactName',
          'contactEmail',
          'applicationDate',
          'interviewDate',
          'followUpDate',
          'nextAction',
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
          itemType: {
            type: 'string',
            enum: ['task', 'event', 'exam', 'assignment', 'quiz', 'homework', 'study_session']
          },
          matchedRuleIds: {
            type: 'array',
            items: { type: 'string' }
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
          contactName: { type: ['string', 'null'] },
          contactEmail: { type: ['string', 'null'] },
          applicationDate: { type: ['string', 'null'] },
          interviewDate: { type: ['string', 'null'] },
          followUpDate: { type: ['string', 'null'] },
          nextAction: { type: ['string', 'null'] },
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

const PLANNER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'warnings', 'blocks'],
  properties: {
    summary: { type: 'string' },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'date', 'start', 'end', 'title', 'itemId', 'kind', 'reason', 'confidence'],
        properties: {
          id: { type: 'string' },
          date: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          title: { type: 'string' },
          itemId: { type: ['string', 'null'] },
          kind: { type: 'string', enum: ['task', 'event', 'study', 'job', 'break', 'focus'] },
          reason: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    }
  }
};

const RESCHEDULER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'warnings', 'suggestions'],
  properties: {
    summary: { type: 'string' },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'itemId', 'action', 'date', 'time', 'subtasks', 'reason', 'confidence'],
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string' },
          action: {
            type: 'string',
            enum: ['move_tomorrow', 'move_later_week', 'split_subtasks', 'archive', 'keep_inbox']
          },
          date: { type: ['string', 'null'] },
          time: { type: ['string', 'null'] },
          subtasks: {
            type: 'array',
            items: { type: 'string' }
          },
          reason: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    }
  }
};

const TASK_CLEANUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'priority', 'projectId', 'subfolder', 'date', 'time', 'subtasks', 'reason', 'confidence', 'warnings'],
  properties: {
    title: { type: ['string', 'null'] },
    priority: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
    projectId: { type: ['string', 'null'] },
    subfolder: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    time: { type: ['string', 'null'] },
    subtasks: {
      type: 'array',
      items: { type: 'string' }
    },
    reason: { type: 'string' },
    confidence: { type: 'number' },
    warnings: {
      type: 'array',
      items: { type: 'string' }
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
    '- Use inboxRules from Existing context as reusable classification guidance. Include matchedRuleIds for every suggestion.',
    '- Always fill itemType. For job and page suggestions, use itemType task unless a task/event item is also being created.',
    '- Do not warn that a disabled category cannot be used unless the content has no reasonable enabled-category interpretation.',
    '- If pages/notebooks are disabled but tasks are enabled, convert ideas and concept lists into tasks with subtasks instead of page suggestions.',
    '- If only pages/notebooks are enabled, convert idea/reference/task-list content into create_page suggestions, not task/project suggestions.',
    '- Prefer existing destinations by id when possible.',
    '- If allowNewDestinations is false, do not set createNewDestination true.',
    '- Use append_subtask when a new item clearly belongs under an existing open task.',
    '- Use create_parent_with_subtasks when several new items are clearly parts of one outcome.',
    '- Use event only when the text is an appointment, scheduled call, class, meeting, or time-bound event.',
    '- For exams, tests, midterms, finals, or practicals, use kind task, action create_item, itemType exam, priority-worthy concise title, and matchedRuleIds including exam.',
    '- For assignments, quizzes, homework, or study sessions, use kind task, action create_item, and the matching itemType.',
    '- For interviews, phone screens, recruiter calls, or hiring manager calls, use create_job, status interviewing, and fill interviewDate/followUpDate/nextAction when clear.',
    '- For job applications or job leads, use create_job and fill company/role/link/applicationDate/followUpDate/nextAction when available.',
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

function buildPlannerPrompt({ context, range }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return [
    'You are a conservative scheduling assistant for a personal task manager.',
    'Return only structured JSON matching the schema.',
    `Today is ${today} in America/Chicago. Use YYYY-MM-DD dates and 24-hour HH:MM times.`,
    '',
    'Goal:',
    `Create a realistic ${range === 'week' ? 'weekly' : 'daily'} plan using the provided context.`,
    '',
    'Rules:',
    '- Never schedule inside protectedTime blocks, including work shifts and sleep/unavailable time.',
    '- Respect scheduleHours. Do not schedule outside the visible planning window unless unavoidable; warn if unavoidable.',
    '- Prefer existing itemId values for tasks, study sessions, exams, and job follow-ups.',
    '- Do not schedule class blocks unless they are already fixed class times; include them only if helpful as protected/context blocks.',
    '- Keep blocks practical and not overpacked. Leave breathing room.',
    '- Prioritize overdue, high-priority, due-today, exams, study, and job follow-ups.',
    '- Use kind "job" for job follow-ups/interview preparation even though they are not task items.',
    '- Use kind "break" only for intentional rest blocks.',
    '- If a task is too vague, schedule a short clarify/next-action block and mention that in reason.',
    '- For itemId null blocks, make them non-mutating suggestions such as break, job prep, or focus time.',
    '',
    `Planner context: ${JSON.stringify(context)}`
  ].join('\n');
}

function buildReschedulerPrompt({ context }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return [
    'You are a conservative AI rescheduler for a personal task manager.',
    'Return only structured JSON matching the schema.',
    `Today is ${today} in America/Chicago. Use YYYY-MM-DD dates and 24-hour HH:MM times.`,
    '',
    'Goal:',
    'For each provided overdue, unscheduled, due-today, or flagged task, suggest one review action.',
    '',
    'Allowed actions:',
    '- move_tomorrow: use when the task should be scheduled tomorrow. Include date and optional time.',
    '- move_later_week: use when the task should be scheduled later this week. Include date and optional time.',
    '- split_subtasks: use when the task is too broad. Include useful subtasks and, if helpful, date/time for the parent.',
    '- archive: use when the item looks stale, irrelevant, duplicated, or no longer actionable.',
    '- keep_inbox: use when the task needs clarification or should stay unscheduled.',
    '',
    'Rules:',
    '- Return at most one suggestion for each input item.',
    '- Do not invent itemId values. Use only item ids from context.items.',
    '- Consider priority, due date, project/course, existing subtasks, notes, and today/tomorrow workload.',
    '- Avoid overloading tomorrow if workload.tomorrow is already high; use later this week for low/medium priority items.',
    '- High priority overdue items should usually move to tomorrow unless they need clarification.',
    '- Leave time null if no reasonable time is implied. Prefer practical times like 09:00, 13:00, 16:00, or 18:00 when assigning a time.',
    '- Keep reasons short and specific.',
    '- If an item is already clear and date-free but belongs in Inbox, use keep_inbox.',
    '',
    `Reschedule context: ${JSON.stringify(context)}`
  ].join('\n');
}

function buildTaskCleanupPrompt({ taskContext }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return [
    'You clean up one task in a personal task manager.',
    'Return only structured JSON matching the schema.',
    `Today is ${today} in America/Chicago. Use YYYY-MM-DD dates and 24-hour HH:MM times.`,
    '',
    'Goal:',
    'Improve a vague or messy task into clearer fields without changing the original intent.',
    '',
    'Rules:',
    '- Keep notes unchanged. Do not return cleaned notes.',
    '- Use only existing project ids from availableProjects. Do not invent a project id or create a new project.',
    '- If no existing project clearly fits, return projectId null.',
    '- Prefer concise, action-oriented titles.',
    '- Return null or empty string for fields that are already good or not obvious.',
    '- Do not invent dates or times. Extract date/time only when the task title or notes make timing obvious.',
    '- Suggested priority must be low, medium, or high. Use medium for school/admin tasks with clear effort but no emergency.',
    '- Extract subtasks when the title/notes imply multiple concrete steps. Do not duplicate existing subtasks.',
    '- Subfolder can be plain text when useful, but keep it short.',
    '- Keep reason short and specific.',
    '',
    `Task context: ${JSON.stringify(taskContext)}`
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

app.post('/api/ai/plan', async (req, res) => {
  const apiKey = req.headers['x-openai-api-key'] || req.body?.apiKey;
  const model = String(req.body?.model || 'gpt-5.5').trim();
  const context = req.body?.context || {};
  const range = req.body?.range === 'week' ? 'week' : 'day';

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'OpenAI API key is required.' });
  }
  if (!context || typeof context !== 'object') {
    return res.status(400).json({ error: 'Planner context is required.' });
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
              'You are a careful personal scheduling assistant. Produce conservative, conflict-aware plans.'
          },
          {
            role: 'user',
            content: buildPlannerPrompt({ context, range })
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_planner_schedule',
            strict: true,
            schema: PLANNER_SCHEMA
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
    console.error('AI planner error:', err);
    res.status(500).json({ error: err?.message || 'AI planner failed.' });
  }
});

app.post('/api/ai/reschedule', async (req, res) => {
  const apiKey = req.headers['x-openai-api-key'] || req.body?.apiKey;
  const model = String(req.body?.model || 'gpt-5.5').trim();
  const context = req.body?.context || {};

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'OpenAI API key is required.' });
  }
  if (!context || typeof context !== 'object' || !Array.isArray(context.items)) {
    return res.status(400).json({ error: 'Reschedule context is required.' });
  }
  if (context.items.length === 0) {
    return res.status(400).json({ error: 'No items were provided to reschedule.' });
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
              'You are a careful task triage assistant. Produce conservative reschedule suggestions only.'
          },
          {
            role: 'user',
            content: buildReschedulerPrompt({ context })
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_reschedule_suggestions',
            strict: true,
            schema: RESCHEDULER_SCHEMA
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
    console.error('AI rescheduler error:', err);
    res.status(500).json({ error: err?.message || 'AI rescheduler failed.' });
  }
});

app.post('/api/ai/task-cleanup', async (req, res) => {
  const apiKey = req.headers['x-openai-api-key'] || req.body?.apiKey;
  const model = String(req.body?.model || 'gpt-5.5').trim();
  const taskContext = req.body?.taskContext || {};

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'OpenAI API key is required.' });
  }
  if (!taskContext || typeof taskContext !== 'object' || !String(taskContext.title || '').trim()) {
    return res.status(400).json({ error: 'Task context with a title is required.' });
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
              'You are a careful task cleanup assistant. Produce conservative field-level suggestions only.'
          },
          {
            role: 'user',
            content: buildTaskCleanupPrompt({ taskContext })
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_task_cleanup',
            strict: true,
            schema: TASK_CLEANUP_SCHEMA
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
    console.error('AI task cleanup error:', err);
    res.status(500).json({ error: err?.message || 'AI task cleanup failed.' });
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
