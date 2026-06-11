import { Store, getToday } from './store';
import { getConfiguredModel, getStoredOpenAiKey } from './aiIntake';

const ACTIONS = ['move_tomorrow', 'move_later_week', 'split_subtasks', 'archive', 'keep_inbox'];

export const RESCHEDULE_ACTION_LABELS = {
  move_tomorrow: 'Move to tomorrow',
  move_later_week: 'Move later this week',
  split_subtasks: 'Split into subtasks',
  archive: 'Archive',
  keep_inbox: 'Keep in inbox'
};

export function addDaysYMD(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildRescheduleContext(items, { today = getToday() } = {}) {
  const tomorrow = addDaysYMD(today, 1);
  const weekEnd = addDaysYMD(today, 6);
  const projectsById = new Map((Store.projects || []).map((project) => [project.id, project]));
  const activeItems = (Store.items || []).filter((item) => !item.done && !item.archived);

  return {
    today,
    tomorrow,
    weekEnd,
    workload: {
      today: activeItems.filter((item) => item.date === today).length,
      tomorrow: activeItems.filter((item) => item.date === tomorrow).length,
      laterThisWeek: activeItems.filter((item) => item.date && item.date > tomorrow && item.date <= weekEnd).length,
      unscheduled: activeItems.filter((item) => !item.date).length,
      overdue: activeItems.filter((item) => item.date && item.date < today).length
    },
    items: (items || []).slice(0, 80).map((item) => {
      const project = item.pid ? projectsById.get(item.pid) : null;
      return {
        id: String(item.id),
        title: item.text || 'Untitled item',
        type: item.type || 'task',
        priority: item.priority || 'low',
        date: item.date || '',
        time: item.time || '',
        projectId: item.pid || '',
        projectName: project?.name || '',
        subfolder: item.subfolder || '',
        notes: item.customProps?.prop_notes || item.notes || '',
        subtasks: Array.isArray(item.subtasks) ? item.subtasks.map((subtask) => subtask.text || '') : []
      };
    })
  };
}

export async function suggestRescheduleWithAi({ items, model = getConfiguredModel() }) {
  const apiKey = getStoredOpenAiKey();
  if (!apiKey) throw new Error('Add your OpenAI API key in Settings first.');

  const context = buildRescheduleContext(items);
  const res = await fetch('/api/ai/reschedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openai-api-key': apiKey
    },
    body: JSON.stringify({ model, context })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `AI rescheduler failed (${res.status}).`);
  return normalizeRescheduleResponse(data, context);
}

export function normalizeRescheduleResponse(raw = {}, context = {}) {
  const itemIds = new Set((context.items || []).map((item) => String(item.id)));
  return {
    summary: String(raw.summary || '').trim(),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((warning) => String(warning || '').trim()).filter(Boolean)
      : [],
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions
          .map((suggestion, index) => normalizeSuggestion(suggestion, index + 1))
          .filter((suggestion) => itemIds.has(String(suggestion.itemId)))
      : []
  };
}

export function applyRescheduleSuggestion(suggestion) {
  const item = (Store.items || []).find((candidate) => String(candidate.id) === String(suggestion.itemId));
  if (!item || item.done || item.archived) return false;
  const today = getToday();

  if (suggestion.action === 'archive') {
    item.archived = true;
    item.reschedule = false;
    Store.save();
    return true;
  }

  if (suggestion.action === 'keep_inbox') {
    item.date = null;
    item.time = null;
    item.reschedule = false;
    Store.save();
    return true;
  }

  if (suggestion.action === 'split_subtasks') {
    const current = Array.isArray(item.subtasks) ? item.subtasks : [];
    const existing = new Set(current.map((subtask) => String(subtask.text || '').trim().toLowerCase()));
    const additions = (suggestion.subtasks || [])
      .map((text) => String(text || '').trim())
      .filter((text) => text && !existing.has(text.toLowerCase()))
      .map((text) => ({ text, done: false }));
    item.subtasks = [...current, ...additions];
  }

  if (suggestion.date) {
    item.date = suggestion.date;
  } else if (suggestion.action === 'move_tomorrow') {
    item.date = addDaysYMD(today, 1);
  } else if (suggestion.action === 'move_later_week') {
    item.date = addDaysYMD(today, 3);
  }
  if (suggestion.time) item.time = suggestion.time;
  item.reschedule = false;
  Store.save();
  return true;
}

function normalizeSuggestion(raw, index) {
  const action = ACTIONS.includes(raw?.action) ? raw.action : 'keep_inbox';
  return {
    id: String(raw?.id || `reschedule_${index}`),
    itemId: raw?.itemId == null ? '' : String(raw.itemId),
    action,
    date: normalizeDate(raw?.date),
    time: normalizeTime(raw?.time),
    subtasks: Array.isArray(raw?.subtasks)
      ? raw.subtasks.map((subtask) => String(subtask || '').trim()).filter(Boolean)
      : [],
    reason: String(raw?.reason || '').trim(),
    confidence: Number.isFinite(raw?.confidence) ? raw.confidence : 0.75
  };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : '';
}
