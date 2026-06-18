import { Store } from './store';
import { BLOCK_TYPES, createBlock, createPage } from './pages';
import { getAiInboxRules } from './aiInboxRules';
import { authHeaders } from './api';

export const OPENAI_API_KEY_STORAGE_KEY = 'ut_openai_api_key_v1';

export const AI_MODEL_PRESETS = [
  { id: 'gpt-5.5', label: 'Best', model: 'gpt-5.5', note: 'Highest accuracy' },
  { id: 'gpt-5.4', label: 'Balanced', model: 'gpt-5.4', note: 'Strong, lower cost' },
  { id: 'gpt-5.4-mini', label: 'Low cost', model: 'gpt-5.4-mini', note: 'Efficient organizing' },
  { id: 'gpt-5.4-nano', label: 'Cheapest', model: 'gpt-5.4-nano', note: 'Fast classification' },
  { id: 'custom', label: 'Custom', model: 'custom', note: 'Use your own model ID' }
];

const VALID_ACTIONS = new Set([
  'create_item',
  'append_subtask',
  'create_parent_with_subtasks',
  'create_job',
  'create_page'
]);

const VALID_KINDS = new Set(['task', 'event', 'job', 'page']);
const VALID_ITEM_TYPES = new Set(['task', 'event', 'exam', 'assignment', 'quiz', 'homework', 'study_session']);

export function getStoredOpenAiKey() {
  try {
    return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredOpenAiKey(value) {
  try {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
    else localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage failures; callers surface validation messages.
  }
}

export function getOpenAiOverrideHeaders() {
  const apiKey = getStoredOpenAiKey();
  return apiKey ? { 'x-openai-api-key': apiKey } : {};
}

export function getConfiguredModel() {
  const selected = Store.settings.aiDefaultModel || 'gpt-5.5';
  if (selected === 'custom') return (Store.settings.aiCustomModel || '').trim() || 'gpt-5.5';
  return selected;
}

export function buildAiContext() {
  const projectById = new Map((Store.projects || []).map((project) => [project.id, project]));
  const subfoldersByProject = new Map();
  for (const item of Store.items || []) {
    if (!item.pid || !item.subfolder) continue;
    if (!subfoldersByProject.has(item.pid)) subfoldersByProject.set(item.pid, new Set());
    subfoldersByProject.get(item.pid).add(item.subfolder);
  }

  const projects = (Store.projects || []).map((project) => ({
    id: project.id,
    name: project.name,
    kind: project.kind || 'project',
    subfolders: Array.from(subfoldersByProject.get(project.id) || []).slice(0, 30)
  }));

  const openTasks = (Store.items || [])
    .filter((item) => !item.done && !item.archived)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 80)
    .map((item) => ({
      id: String(item.id),
      title: item.text,
      type: item.type || 'task',
      projectId: item.pid || null,
      projectName: item.pid ? projectById.get(item.pid)?.name || null : null,
      subfolder: item.subfolder || null,
      subtasks: (item.subtasks || []).slice(0, 12).map((subtask) => subtask.text || '')
    }));

  const pages = (Store.pages || []).slice(0, 120).map((page) => ({
    id: page.id,
    title: page.title,
    parentId: page.parentId || null
  }));

  const jobs = (Store.jobs || []).slice(0, 80).map((job) => ({
    id: job.id,
    company: job.company,
    role: job.role,
    status: job.status
  }));

  return { projects, openTasks, pages, jobs, inboxRules: getAiInboxRules() };
}

export async function organizeWithAi({ inputText, model, categories, allowNewDestinations }) {
  const res = await fetch('/api/ai/organize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOpenAiOverrideHeaders(),
      ...authHeaders()
    },
    body: JSON.stringify({
      inputText,
      model,
      options: {
        categories,
        allowNewDestinations
      },
      context: buildAiContext()
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `AI request failed (${res.status}).`);

  return {
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    suggestions: enrichRelativeDates(normalizeSuggestions(data.suggestions), inputText)
  };
}

export function normalizeSuggestions(rawSuggestions = []) {
  return rawSuggestions
    .filter(Boolean)
    .map((raw, index) => {
      let action = VALID_ACTIONS.has(raw.action) ? raw.action : 'create_item';
      let kind = VALID_KINDS.has(raw.kind) ? raw.kind : 'task';
      if (kind === 'page') action = 'create_page';
      if (kind === 'job') action = 'create_job';
      if (action === 'create_job') kind = 'job';
      if (action === 'create_page') kind = 'page';

      return {
        id: raw.id || `suggestion_${index + 1}`,
        kind,
        action,
        itemType: normalizeItemType(raw.itemType, kind),
        matchedRuleIds: Array.isArray(raw.matchedRuleIds)
          ? raw.matchedRuleIds.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        title: String(raw.title || raw.role || raw.company || 'Untitled').trim(),
        notes: String(raw.notes || '').trim(),
        confidence: Number.isFinite(raw.confidence) ? raw.confidence : 0.75,
        destination: String(raw.destination || '').trim(),
        createNewDestination: !!raw.createNewDestination,
        projectId: raw.projectId || '',
        projectName: raw.projectName || '',
        subfolder: raw.subfolder || '',
        date: normalizeDate(raw.date),
        time: normalizeTime(raw.time),
        recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(raw.recurrence)
          ? raw.recurrence
          : 'none',
        subtasks: Array.isArray(raw.subtasks)
          ? raw.subtasks.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        existingTaskId: raw.existingTaskId ? String(raw.existingTaskId) : '',
        company: raw.company || '',
        role: raw.role || '',
        link: raw.link || '',
        status: ['interested', 'applied', 'interviewing', 'accepted', 'rejected'].includes(raw.status)
          ? raw.status
          : 'interested',
        payRate: raw.payRate || '',
        schedule: raw.schedule || '',
        location: raw.location || '',
        contactName: raw.contactName || '',
        contactEmail: raw.contactEmail || '',
        applicationDate: normalizeDate(raw.applicationDate),
        interviewDate: normalizeDate(raw.interviewDate),
        followUpDate: normalizeDate(raw.followUpDate),
        nextAction: raw.nextAction || '',
        notebookId: raw.notebookId || '',
        notebookTitle: raw.notebookTitle || '',
        pageTitle: raw.pageTitle || raw.title || 'Untitled Page',
        blockFormat: ['bullet', 'todo', 'hyphen_text', 'plain_text'].includes(raw.blockFormat)
          ? raw.blockFormat
          : 'bullet',
        blocks: Array.isArray(raw.blocks)
          ? raw.blocks.map((item) => String(item || '').trim()).filter(Boolean)
          : []
      };
    });
}

export function applyAiSuggestions(suggestions, { allowNewDestinations = false } = {}) {
  const results = [];
  let sequence = 0;

  for (const suggestion of suggestions) {
    const result = applyAiSuggestion(suggestion, { allowNewDestinations, sequence });
    sequence = result.sequence;
    results.push(result);
  }

  Store.save();
  return results;
}

export function applyAiSuggestion(suggestion, { allowNewDestinations = false, sequence = 0 } = {}) {
  const now = Date.now();
  const nextId = () => now + sequence++;

  if (suggestion.action === 'append_subtask') {
    const task = findTask(suggestion.existingTaskId);
    if (!task) return { ok: false, sequence, message: 'Choose an existing task before applying.' };
    const texts = suggestion.subtasks.length > 0 ? suggestion.subtasks : [suggestion.title];
    task.subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    for (const text of texts) {
      if (!text.trim()) continue;
      task.subtasks.push({ text: text.trim(), done: false, createdAt: nextId() });
    }
    return { ok: true, sequence, message: `Added subtask(s) to "${task.text}".` };
  }

  if (suggestion.action === 'create_job' || suggestion.kind === 'job') {
    Store.jobs = Array.isArray(Store.jobs) ? Store.jobs : [];
    const existingJob = findMatchingJob(suggestion);
    const jobPatch = {
      id: `job_${nextId()}`,
      company: String(suggestion.company || '').trim(),
      role: String(suggestion.role || suggestion.title || '').trim(),
      link: normalizeUrl(suggestion.link),
      status: suggestion.status || 'interested',
      payRate: String(suggestion.payRate || '').trim(),
      schedule: String(suggestion.schedule || '').trim(),
      location: String(suggestion.location || '').trim(),
      contactName: String(suggestion.contactName || '').trim(),
      contactEmail: String(suggestion.contactEmail || '').trim(),
      resumeVersion: '',
      applicationDate: suggestion.applicationDate || '',
      interviewDate: suggestion.interviewDate || '',
      followUpDate: suggestion.followUpDate || '',
      nextAction: String(suggestion.nextAction || '').trim(),
      notes: String(suggestion.notes || '').trim(),
      createdAt: nextId(),
      updatedAt: nextId()
    };

    if (existingJob) {
      existingJob.status = jobPatch.status || existingJob.status;
      existingJob.updatedAt = jobPatch.updatedAt;
      for (const key of [
        'link',
        'payRate',
        'schedule',
        'location',
        'contactName',
        'contactEmail',
        'applicationDate',
        'interviewDate',
        'followUpDate',
        'nextAction',
        'notes'
      ]) {
        if (jobPatch[key]) existingJob[key] = jobPatch[key];
      }
      return { ok: true, sequence, message: 'Job updated.' };
    }

    Store.jobs.push(jobPatch);
    return { ok: true, sequence, message: 'Job added.' };
  }

  if (suggestion.action === 'create_page' || suggestion.kind === 'page') {
    const parentId = resolveNotebookId(suggestion, allowNewDestinations);
    if (!parentId) {
      return { ok: false, sequence, message: 'Choose or allow a notebook destination before applying.' };
    }
    const page = createPage({
      parentId,
      title: suggestion.pageTitle || suggestion.title || 'Untitled Page',
      icon: 'AI'
    });
    const blockTexts = suggestion.blocks.length > 0
      ? suggestion.blocks
      : [suggestion.notes || suggestion.title].filter(Boolean);
    page.blocks = buildPageBlocks(blockTexts, suggestion.blockFormat);
    page.createdAt = nextId();
    page.updatedAt = page.createdAt;
    Store.pages.push(page);
    return { ok: true, sequence, message: 'Notebook page added.' };
  }

  const project = resolveProject(suggestion, allowNewDestinations);
  const subtasks =
    suggestion.action === 'create_parent_with_subtasks'
      ? suggestion.subtasks
      : suggestion.subtasks;
  Store.items.push({
    id: nextId(),
    text: suggestion.title || 'Untitled task',
    type: resolveItemType(suggestion),
    priority: getDefaultPriorityForItemType(suggestion.itemType),
    pid: project?.id || null,
    subfolder: project?.id ? (String(suggestion.subfolder || '').trim() || null) : null,
    date: suggestion.date || null,
    time: suggestion.time || null,
    recurrence: suggestion.recurrence || 'none',
    recurDetails: null,
    done: false,
    archived: false,
    reschedule: false,
    createdAt: nextId(),
    customProps: {
      ...(suggestion.notes ? { prop_notes: suggestion.notes } : {}),
      prop_ai_intake: {
        confidence: suggestion.confidence,
        matchedRuleIds: suggestion.matchedRuleIds || [],
        suggestedKind: suggestion.kind,
        createdAt: Date.now()
      }
    },
    subtasks: subtasks.map((text) => ({ text, done: false, createdAt: nextId() })),
    ...(suggestion.itemType === 'exam' ? { examMeta: { studyGuide: '', linkedPageIds: [] } } : {})
  });
  return { ok: true, sequence, message: suggestion.kind === 'event' ? 'Event added.' : 'Task added.' };
}

export function suggestionNeedsDestination(suggestion, allowNewDestinations) {
  if (suggestion.action === 'append_subtask') return !findTask(suggestion.existingTaskId);
  if (suggestion.action === 'create_page' || suggestion.kind === 'page') {
    return !hasNotebookDestination(suggestion, allowNewDestinations);
  }
  return false;
}

function findTask(id) {
  if (!id) return null;
  return (Store.items || []).find((item) => String(item.id) === String(id)) || null;
}

function findMatchingJob(suggestion) {
  const company = String(suggestion.company || '').trim().toLowerCase();
  const role = String(suggestion.role || suggestion.title || '').trim().toLowerCase();
  if (!company || !role) return null;
  return (Store.jobs || []).find((job) =>
    String(job.company || '').trim().toLowerCase() === company &&
    String(job.role || '').trim().toLowerCase() === role
  ) || null;
}

function resolveProject(suggestion, allowNewDestinations) {
  const byId = (Store.projects || []).find((project) => project.id === suggestion.projectId);
  if (byId) return byId;

  const projectName = String(suggestion.projectName || suggestion.destination || '').trim();
  if (projectName) {
    const byName = (Store.projects || []).find(
      (project) => String(project.name || '').trim().toLowerCase() === projectName.toLowerCase()
    );
    if (byName) return byName;
  }

  if (!allowNewDestinations || !projectName || !suggestion.createNewDestination) return null;

  const project = {
    id: `p${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: projectName,
    icon: 'Folder',
    color: '#2383E2',
    customProps: {},
    showInboxBadge: Store.settings.defaultShowInboxBadge !== false,
    showTodayBadge: Store.settings.defaultShowTodayBadge !== false
  };
  Store.projects.push(project);
  return project;
}

function resolveNotebookId(suggestion, allowNewDestinations) {
  if (suggestion.notebookId && (Store.pages || []).some((page) => page.id === suggestion.notebookId)) {
    return suggestion.notebookId;
  }

  const title = String(suggestion.notebookTitle || suggestion.destination || '').trim();
  if (title) {
    const existing = (Store.pages || []).find(
      (page) => !page.parentId && String(page.title || '').trim().toLowerCase() === title.toLowerCase()
    );
    if (existing) return existing.id;
  }

  if (!allowNewDestinations || !title) return '';

  const notebook = createPage({ title, icon: 'Notebook' });
  notebook.blocks = [createBlock(BLOCK_TYPES.PARAGRAPH, '')];
  Store.pages.push(notebook);
  return notebook.id;
}

function hasNotebookDestination(suggestion, allowNewDestinations) {
  if (suggestion.notebookId && (Store.pages || []).some((page) => page.id === suggestion.notebookId)) {
    return true;
  }

  const title = String(suggestion.notebookTitle || suggestion.destination || '').trim();
  if (!title) return false;

  const existing = (Store.pages || []).some(
    (page) => !page.parentId && String(page.title || '').trim().toLowerCase() === title.toLowerCase()
  );
  return existing || allowNewDestinations;
}

function buildPageBlocks(blockTexts, blockFormat = 'bullet') {
  const cleaned = blockTexts.map((text) => String(text || '').trim()).filter(Boolean);
  if (cleaned.length === 0) return [createBlock(BLOCK_TYPES.PARAGRAPH, '')];

  if (blockFormat === 'plain_text') {
    return [createBlock(BLOCK_TYPES.PARAGRAPH, escapeHtml(cleaned.join('\n')))];
  }

  if (blockFormat === 'hyphen_text') {
    return [createBlock(BLOCK_TYPES.PARAGRAPH, escapeHtml(cleaned.map((text) => `- ${text}`).join('\n')))];
  }

  if (blockFormat === 'todo') {
    return cleaned.map((text) => createBlock(BLOCK_TYPES.TODO, escapeHtml(text)));
  }

  return cleaned.map((text) => createBlock(BLOCK_TYPES.BULLET, escapeHtml(text)));
}

function normalizeItemType(value, kind) {
  const text = String(value || '').trim();
  if (VALID_ITEM_TYPES.has(text)) return text;
  if (kind === 'event') return 'event';
  return 'task';
}

function resolveItemType(suggestion) {
  const itemType = normalizeItemType(suggestion.itemType, suggestion.kind);
  if (itemType === 'event') return 'event';
  return itemType;
}

function getDefaultPriorityForItemType(itemType) {
  if (itemType === 'exam') return 'high';
  if (['assignment', 'quiz', 'homework', 'study_session'].includes(itemType)) return 'medium';
  return 'low';
}

function normalizeDate(value) {
  const str = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : '';
}

function normalizeTime(value) {
  const str = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(str) ? str : '';
}

function enrichRelativeDates(suggestions, inputText) {
  const sourceLines = String(inputText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return suggestions.map((suggestion) => {
    if (suggestion.kind !== 'task' && suggestion.kind !== 'event') return suggestion;
    if (suggestion.date && suggestion.time) return suggestion;

    const sourceText = findBestSourceText(suggestion, sourceLines);
    const fallbackDate = suggestion.date || inferRelativeDate(sourceText);
    const fallbackTime = suggestion.time || inferSimpleTime(sourceText);

    if (!fallbackDate && !fallbackTime) return suggestion;
    return {
      ...suggestion,
      date: fallbackDate || suggestion.date,
      time: fallbackTime || suggestion.time
    };
  });
}

function findBestSourceText(suggestion, lines) {
  const combined = [
    suggestion.title,
    suggestion.notes,
    suggestion.destination,
    suggestion.projectName,
    ...(suggestion.subtasks || [])
  ].join(' ');

  const normalizedSuggestion = normalizeForMatch(combined);
  const suggestionTokens = normalizedSuggestion
    .split(' ')
    .filter((token) => token.length >= 4);

  let bestLine = combined;
  let bestScore = 0;
  for (const line of lines) {
    const normalizedLine = normalizeForMatch(line);
    let score = 0;
    for (const token of suggestionTokens) {
      if (normalizedLine.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }

  return `${combined} ${bestLine}`;
}

function inferRelativeDate(text) {
  const normalized = normalizeForMatch(text);
  const today = new Date();

  if (/\b(tomorrow|tmrw|tmr|tmmrw|tmmr|tomoroow|tommorow|tomorow|2moro|2morrow)\b/.test(normalized)) {
    return formatOffsetDate(today, 1);
  }

  if (/\b(today|tdy)\b/.test(normalized)) {
    return formatOffsetDate(today, 0);
  }

  return '';
}

function inferSimpleTime(text) {
  const normalized = String(text || '').toLowerCase();
  const meridiemMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (meridiemMatch) {
    let hour = parseInt(meridiemMatch[1], 10);
    const minute = parseInt(meridiemMatch[2] || '0', 10);
    const meridiem = meridiemMatch[3];
    if (hour === 12) hour = 0;
    if (meridiem === 'pm') hour += 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  const clockMatch = normalized.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clockMatch) {
    const hour = parseInt(clockMatch[1], 10);
    const minute = parseInt(clockMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return '';
}

function formatOffsetDate(base, offsetDays) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9: ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
