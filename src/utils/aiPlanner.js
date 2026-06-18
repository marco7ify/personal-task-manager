import { Store, formatLocalYMD, getToday } from './store';
import { getCourses, nextClassDate } from './school';
import { getConfiguredModel, getOpenAiOverrideHeaders } from './aiIntake';
import { authHeaders } from './api';

export {
  RESCHEDULE_ACTION_LABELS,
  applyRescheduleSuggestion,
  buildRescheduleContext,
  suggestRescheduleWithAi
} from './aiReschedule';

export const PLANNER_CATEGORY_KEYS = ['tasks', 'events', 'classes', 'study', 'jobs'];

export function getPlannerInclude() {
  return {
    tasks: Store.settings.plannerInclude?.tasks !== false,
    events: Store.settings.plannerInclude?.events !== false,
    classes: Store.settings.plannerInclude?.classes !== false,
    study: Store.settings.plannerInclude?.study !== false,
    jobs: Store.settings.plannerInclude?.jobs !== false
  };
}

export function addDaysYMD(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalYMD(date);
}

export function buildProtectedTimeForRange(startDate = getToday(), days = 1) {
  const sleepStart = Store.settings.plannerSleepStart || '23:00';
  const sleepEnd = Store.settings.plannerSleepEnd || '07:00';
  const shifts = Array.isArray(Store.settings.plannerWorkShifts)
    ? Store.settings.plannerWorkShifts
    : [];
  const blocks = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDaysYMD(startDate, offset);
    const day = new Date(`${date}T00:00:00`).getDay();
    blocks.push({
      date,
      kind: 'sleep',
      label: 'Sleep / unavailable',
      start: sleepStart,
      end: sleepEnd
    });

    shifts
      .filter((shift) => shift.enabled && Number(shift.day) === day)
      .forEach((shift) => {
        blocks.push({
          date,
          kind: 'work',
          label: 'Work shift',
          start: shift.start || '09:00',
          end: shift.end || '17:00'
        });
      });
  }

  return blocks;
}

export function buildPlannerContext({ startDate = getToday(), days = 1, include = getPlannerInclude() } = {}) {
  const endDate = addDaysYMD(startDate, Math.max(0, days - 1));
  const projectsById = new Map((Store.projects || []).map((project) => [project.id, project]));
  const activeItems = (Store.items || []).filter((item) => !item.done && !item.archived);
  const inRange = (item) => item.date && item.date >= startDate && item.date <= endDate;
  const overdue = (item) => item.date && item.date < startDate;

  const taskItems = include.tasks
    ? activeItems
        .filter((item) => ['task', 'assignment', 'quiz', 'homework'].includes(item.type || 'task'))
        .filter((item) => inRange(item) || overdue(item) || !item.date)
        .slice(0, 120)
        .map((item) => summarizeItem(item, projectsById))
    : [];

  const eventItems = include.events
    ? activeItems
        .filter((item) => (item.type || 'task') === 'event' && inRange(item))
        .slice(0, 80)
        .map((item) => summarizeItem(item, projectsById))
    : [];

  const studyItems = include.study
    ? activeItems
        .filter((item) => ['exam', 'study_session'].includes(item.type))
        .filter((item) => inRange(item) || overdue(item))
        .slice(0, 80)
        .map((item) => summarizeItem(item, projectsById))
    : [];

  const classes = include.classes
    ? getCourses().flatMap((course) =>
        (course.classTimes || [])
          .map((slot) => ({
            courseId: course.id,
            courseName: course.name,
            nextDate: nextClassDate(slot, new Date(`${startDate}T00:00:00`)),
            days: slot.days || [],
            start: slot.start || '',
            end: slot.end || '',
            location: slot.location || ''
          }))
          .filter((slot) => slot.nextDate && slot.nextDate >= startDate && slot.nextDate <= endDate)
      )
    : [];

  const jobs = include.jobs
    ? (Store.jobs || [])
        .filter((job) => !['accepted', 'rejected'].includes(job.status))
        .filter((job) =>
          (job.followUpDate && job.followUpDate <= endDate) ||
          (job.interviewDate && job.interviewDate >= startDate && job.interviewDate <= endDate)
        )
        .slice(0, 80)
        .map((job) => ({
          id: job.id,
          company: job.company,
          role: job.role,
          status: job.status,
          followUpDate: job.followUpDate || '',
          interviewDate: job.interviewDate || '',
          nextAction: job.nextAction || ''
        }))
    : [];

  return {
    startDate,
    endDate,
    days,
    include,
    scheduleHours: {
      startHour: Store.settings.startHour,
      endHour: Store.settings.endHour
    },
    protectedTime: buildProtectedTimeForRange(startDate, days),
    tasks: taskItems,
    events: eventItems,
    study: studyItems,
    classes,
    jobs
  };
}

export async function planScheduleWithAi({ range = 'day', context, model = getConfiguredModel() }) {
  const res = await fetch('/api/ai/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOpenAiOverrideHeaders(),
      ...authHeaders()
    },
    body: JSON.stringify({
      model,
      range,
      context
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `AI planner failed (${res.status}).`);
  return normalizePlan(data);
}

export function normalizePlan(raw = {}) {
  return {
    summary: String(raw.summary || '').trim(),
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((warning) => String(warning || '').trim()).filter(Boolean)
      : [],
    blocks: Array.isArray(raw.blocks)
      ? raw.blocks
          .map((block, index) => ({
            id: String(block.id || `plan_block_${index + 1}`),
            date: normalizeDate(block.date),
            start: normalizeTime(block.start),
            end: normalizeTime(block.end),
            title: String(block.title || 'Planned block').trim(),
            itemId: block.itemId == null || block.itemId === '' ? null : String(block.itemId),
            kind: ['task', 'event', 'study', 'job', 'break', 'focus'].includes(block.kind)
              ? block.kind
              : 'focus',
            reason: String(block.reason || '').trim(),
            confidence: Number.isFinite(block.confidence) ? block.confidence : 0.75
          }))
          .filter((block) => block.date && block.start && block.end)
      : []
  };
}

export function applyPlanBlocks(blocks) {
  let applied = 0;
  for (const block of blocks || []) {
    if (!block.itemId) continue;
    const item = (Store.items || []).find((candidate) => String(candidate.id) === String(block.itemId));
    if (!item || item.done || item.archived) continue;
    item.date = block.date;
    item.time = block.start;
    item.customProps = {
      ...(item.customProps || {}),
      aiPlannedAt: Date.now(),
      aiPlannedEnd: block.end,
      aiPlanReason: block.reason
    };
    applied += 1;
  }
  if (applied > 0) Store.save();
  return applied;
}

export async function cleanupTaskWithAi({ taskContext, model = getConfiguredModel() }) {
  const res = await fetch('/api/ai/task-cleanup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOpenAiOverrideHeaders(),
      ...authHeaders()
    },
    body: JSON.stringify({
      model,
      taskContext
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `AI task cleanup failed (${res.status}).`);
  return normalizeTaskCleanup(data, taskContext);
}

export function normalizeTaskCleanup(raw = {}, taskContext = {}) {
  const projectIds = new Set((taskContext.availableProjects || []).map((project) => String(project.id)));
  const projectId = raw.projectId == null ? '' : String(raw.projectId);
  return {
    title: String(raw.title || '').trim(),
    priority: ['low', 'medium', 'high'].includes(raw.priority) ? raw.priority : '',
    projectId: projectId && projectIds.has(projectId) ? projectId : '',
    subfolder: String(raw.subfolder || '').trim(),
    date: normalizeDate(raw.date),
    time: normalizeTime(raw.time),
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map((subtask) => String(subtask || '').trim()).filter(Boolean)
      : [],
    reason: String(raw.reason || '').trim(),
    confidence: Number.isFinite(raw.confidence) ? raw.confidence : 0.75,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((warning) => String(warning || '').trim()).filter(Boolean)
      : []
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

function summarizeItem(item, projectsById) {
  const project = item.pid ? projectsById.get(item.pid) : null;
  return {
    id: String(item.id),
    title: item.text || 'Untitled',
    type: item.type || 'task',
    priority: item.priority || 'low',
    projectId: item.pid || null,
    projectName: project?.name || '',
    date: item.date || '',
    time: item.time || '',
    subfolder: item.subfolder || '',
    parentExamId: item.parentExamId || null
  };
}
