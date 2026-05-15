/**
 * School module: courses, class times, and academic items.
 *
 * Courses are stored as projects with `kind: 'course'` so they
 * inherit all of the existing item/project plumbing (Today/Week/
 * Calendar filters, badges, PropertyPanel, etc.). The Sidebar
 * filters them out of the regular Projects section and renders
 * them in their own tree.
 *
 * School items live in `Store.items` like every other task, but
 * use one of the dedicated `type` values below. Exam items get an
 * `examMeta = { studyGuide, linkedPageIds }` blob, and any sub-task
 * tied to an exam (homework / assignment / study session) carries
 * `parentExamId` so we can build per-exam progress.
 */

import { Store } from './store';

export const COURSE_KIND = 'course';
export const UNASSIGNED_SEMESTER_ID = '__unassigned__';

export const SCHOOL_ITEM_TYPES = {
  ASSIGNMENT: 'assignment',
  QUIZ: 'quiz',
  EXAM: 'exam',
  HOMEWORK: 'homework'
};

export const SCHOOL_ITEM_TYPE_VALUES = Object.values(SCHOOL_ITEM_TYPES);

export const SCHOOL_ITEM_LABELS = {
  [SCHOOL_ITEM_TYPES.ASSIGNMENT]: 'Assignment',
  [SCHOOL_ITEM_TYPES.QUIZ]: 'Quiz',
  [SCHOOL_ITEM_TYPES.EXAM]: 'Exam',
  [SCHOOL_ITEM_TYPES.HOMEWORK]: 'Homework'
};

export const SCHOOL_ITEM_ICONS = {
  [SCHOOL_ITEM_TYPES.ASSIGNMENT]: '📝',
  [SCHOOL_ITEM_TYPES.QUIZ]: '✏️',
  [SCHOOL_ITEM_TYPES.EXAM]: '📘',
  [SCHOOL_ITEM_TYPES.HOMEWORK]: '📒'
};

export const COURSE_STATUSES = [
  { id: 'planned',    label: 'Planned',     color: '#9B9B9B' },
  { id: 'in_progress', label: 'In Progress', color: '#2383E2' },
  { id: 'completed',  label: 'Completed',   color: '#45A557' },
  { id: 'dropped',    label: 'Dropped',     color: '#FF5555' }
];

/** Sun=0 → Sat=6, matching JS Date.getDay() */
export const DAYS_OF_WEEK = [
  { id: 0, short: 'Sun', label: 'Sunday' },
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' }
];

export const COURSE_ICONS = [
  '📚', '📐', '🧪', '🧬', '🧮', '🧠', '🎓', '📖', '📕', '📗',
  '📘', '📙', '🔬', '⚗️', '🌍', '🗿', '🎨', '🎭', '🎵', '💻',
  '⚙️', '⚖️', '💼', '🏛'
];

/** True if the project should be treated as a course. */
export function isCourseProject(project) {
  return !!project && project.kind === COURSE_KIND;
}

/** Returns all courses (projects with kind='course') sorted by createdAt. */
export function getCourses() {
  return (Store.projects || [])
    .filter(isCourseProject)
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/** Returns all school semesters sorted by creation date. */
export function getSemesters() {
  return (Store.semesters || [])
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function getSemesterById(semesterId) {
  if (!semesterId || semesterId === UNASSIGNED_SEMESTER_ID) return null;
  return (Store.semesters || []).find((s) => s.id === semesterId) || null;
}

/** Returns courses in a semester. Use null for unassigned courses. */
export function getCoursesBySemester(semesterId = null) {
  const expected = semesterId === UNASSIGNED_SEMESTER_ID ? null : semesterId;
  return getCourses().filter((course) => (course.semesterId || null) === (expected || null));
}

export function getCourseById(courseId) {
  if (!courseId) return null;
  const course = (Store.projects || []).find((p) => p.id === courseId);
  return isCourseProject(course) ? course : null;
}

export function getCourseStatus(course) {
  return COURSE_STATUSES.find((s) => s.id === (course?.courseStatus || 'in_progress'))
      || COURSE_STATUSES[1];
}

/** All school items belonging to a course. */
export function getCourseItems(courseId) {
  if (!courseId) return [];
  return (Store.items || []).filter((it) => it.pid === courseId);
}

/** Items of a particular school type for a course (excludes archived). */
export function getCourseItemsByType(courseId, type) {
  return getCourseItems(courseId).filter(
    (it) => it.type === type && !it.archived
  );
}

/** All items linked to an exam as study material / homework / etc. */
export function getExamSubItems(examId) {
  if (examId == null) return [];
  return (Store.items || []).filter(
    (it) => it.parentExamId === examId && !it.archived
  );
}

/** Returns the exam item by id, or null. */
export function getExamById(examId) {
  if (examId == null) return null;
  const id = typeof examId === 'number' ? examId : parseInt(examId, 10);
  if (Number.isNaN(id)) return null;
  return (Store.items || []).find(
    (it) => it.id === id && it.type === SCHOOL_ITEM_TYPES.EXAM
  ) || null;
}

/** % of sub-items completed (0..100). Returns 0 when there are no sub-items. */
export function computeExamProgress(examId) {
  const subs = getExamSubItems(examId);
  if (subs.length === 0) return 0;
  const done = subs.filter((s) => s.done).length;
  return Math.round((done / subs.length) * 100);
}

/** Initialize a new course and return it (does not save). */
export function buildNewCourse({
  name = 'New Course',
  icon = '📚',
  color = '#2383E2',
  semester = '',
  semesterId = null,
  courseStatus = 'in_progress'
} = {}) {
  return {
    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
    kind: COURSE_KIND,
    name,
    icon,
    color,
    courseStatus,
    semester,
    semesterId: semesterId || null,
    classTimes: [],
    linkedPageIds: [],
    notebookMetadata: {},
    customProps: {},
    showInboxBadge: false,
    showTodayBadge: true,
    createdAt: Date.now()
  };
}

/** Initialize a new semester and return it (does not save). */
export function buildNewSemester(name = 'New Semester') {
  return {
    id: 'sem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    createdAt: Date.now(),
    expanded: true
  };
}

/** Initialize a new class-time slot (does not save). */
export function buildNewClassTime() {
  return {
    id: 'ct' + Date.now() + Math.random().toString(36).slice(2, 6),
    days: [1, 3], // Mon, Wed default
    start: '10:00',
    end: '10:50',
    startDate: '',
    endDate: '',
    location: ''
  };
}

/** Initialize a new school-related task (assignment/quiz/exam/homework). */
export function buildNewSchoolItem({
  courseId,
  type,
  text = '',
  date = null,
  parentExamId = null
} = {}) {
  const item = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    text,
    type,
    priority: type === SCHOOL_ITEM_TYPES.EXAM ? 'high' : 'medium',
    pid: courseId || null,
    date: date || null,
    time: null,
    done: false,
    archived: false,
    recurrence: 'none',
    recurDetails: null,
    createdAt: Date.now(),
    customProps: {}
  };
  if (type === SCHOOL_ITEM_TYPES.EXAM) {
    item.examMeta = { studyGuide: '', linkedPageIds: [] };
  }
  if (parentExamId != null) {
    item.parentExamId = parentExamId;
  }
  return item;
}

/** Pretty-print a class time slot, e.g. "MWF · 10:00–10:50 · Room 201" */
export function formatClassTime(slot) {
  if (!slot) return '';
  const dayChars = (slot.days || [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => {
      const map = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
      return map[d] || '?';
    })
    .join('');
  const time =
    slot.start && slot.end
      ? `${slot.start}–${slot.end}`
      : slot.start || slot.end || '';
  const dateRange = slot.startDate || slot.endDate
    ? `${slot.startDate || '...'}→${slot.endDate || '...'}`
    : '';
  const parts = [dayChars, time, dateRange, slot.location].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Returns the next occurrence date (YYYY-MM-DD) for a class time slot,
 * relative to a base date. Useful for surfacing "next class" hints.
 */
export function nextClassDate(slot, baseDate = new Date()) {
  if (!slot || !Array.isArray(slot.days) || slot.days.length === 0) return null;
  const base = new Date(baseDate);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);
    if (slot.days.includes(candidate.getDay())) {
      const y = candidate.getFullYear();
      const m = String(candidate.getMonth() + 1).padStart(2, '0');
      const d = String(candidate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

/** All school items (any type) belonging to courses inside a semester. */
export function getSemesterItems(semesterId) {
  const courses = getCoursesBySemester(semesterId);
  const ids = new Set(courses.map((c) => c.id));
  if (ids.size === 0) return [];
  return (Store.items || []).filter((it) => ids.has(it.pid));
}

/** Filter helper for semester quick-view lists. */
export function getSemesterItemsByType(semesterId, type) {
  return getSemesterItems(semesterId).filter(
    (it) => it.type === type && !it.archived
  );
}

/**
 * Items of `type` whose due-date is on/after `today`, sorted ascending.
 * Pass limit to cap the list size for sidebars/dashboards.
 */
export function getUpcomingSemesterItems(semesterId, type, { limit = 10, includeOverdue = true } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const items = getSemesterItemsByType(semesterId, type)
    .filter((it) => !it.done)
    .filter((it) => {
      if (!it.date) return false;
      return includeOverdue ? true : it.date >= today;
    })
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return limit > 0 ? items.slice(0, limit) : items;
}

/** Aggregated stats for the semester dashboard. */
export function getSemesterStats(semesterId) {
  const courses = getCoursesBySemester(semesterId);
  const items = getSemesterItems(semesterId);
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const isOpen = (it) => !it.done && !it.archived;
  const inWeek = (it) =>
    it.date && it.date >= today && it.date <= weekEndStr && isOpen(it);

  const assignments = items.filter((i) => i.type === SCHOOL_ITEM_TYPES.ASSIGNMENT);
  const quizzes     = items.filter((i) => i.type === SCHOOL_ITEM_TYPES.QUIZ);
  const exams       = items.filter((i) => i.type === SCHOOL_ITEM_TYPES.EXAM);
  const homework    = items.filter((i) => i.type === SCHOOL_ITEM_TYPES.HOMEWORK);

  const trackable = items.filter(
    (it) => !it.archived && SCHOOL_ITEM_TYPE_VALUES.includes(it.type)
  );
  const completed = trackable.filter((it) => it.done).length;
  const progress = trackable.length === 0
    ? 0
    : Math.round((completed / trackable.length) * 100);

  return {
    courseCount: courses.length,
    openAssignments: assignments.filter(isOpen).length,
    openQuizzes:     quizzes.filter(isOpen).length,
    openExams:       exams.filter(isOpen).length,
    openHomework:    homework.filter(isOpen).length,
    upcomingAssignments: assignments.filter(inWeek).length,
    upcomingQuizzes:     quizzes.filter(inWeek).length,
    upcomingExams:       exams.filter(inWeek).length,
    completed,
    totalTrackable: trackable.length,
    progress
  };
}

/** Per-course summary used by the dashboard course cards. */
export function getCourseSummary(course) {
  if (!course) return null;
  const items = getCourseItems(course.id);
  const open = (type) =>
    items.filter((i) => i.type === type && !i.done && !i.archived).length;
  const total = items.filter(
    (i) => SCHOOL_ITEM_TYPE_VALUES.includes(i.type) && !i.archived
  ).length;
  const done = items.filter(
    (i) => SCHOOL_ITEM_TYPE_VALUES.includes(i.type) && i.done
  ).length;
  return {
    assignments: open(SCHOOL_ITEM_TYPES.ASSIGNMENT),
    quizzes:     open(SCHOOL_ITEM_TYPES.QUIZ),
    exams:       open(SCHOOL_ITEM_TYPES.EXAM),
    homework:    open(SCHOOL_ITEM_TYPES.HOMEWORK),
    total,
    done,
    progress: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

/** Read the topic label assigned to a linked notebook in this course. */
export function getNotebookTopic(course, pageId) {
  if (!course || !pageId) return '';
  const meta = course.notebookMetadata?.[pageId];
  return (meta && typeof meta.topic === 'string') ? meta.topic : '';
}

/** Set/clear the topic label for a linked notebook (mutates course in place). */
export function setNotebookTopic(course, pageId, topic) {
  if (!course || !pageId) return;
  if (!course.notebookMetadata || typeof course.notebookMetadata !== 'object') {
    course.notebookMetadata = {};
  }
  const cleaned = String(topic || '').trim();
  if (!cleaned) {
    delete course.notebookMetadata[pageId];
  } else {
    course.notebookMetadata[pageId] = {
      ...(course.notebookMetadata[pageId] || {}),
      topic: cleaned
    };
  }
}

/** All distinct, non-empty topics used by linked notebooks for this course. */
export function getCourseTopics(course) {
  if (!course) return [];
  const ids = course.linkedPageIds || [];
  const seen = new Set();
  for (const pageId of ids) {
    const t = getNotebookTopic(course, pageId);
    if (t) seen.add(t);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Group linked notebooks by their topic label.
 * Returns Map<topic, pageId[]>; un-tagged notebooks are grouped under ''.
 */
export function getNotebooksByTopic(course) {
  const result = new Map();
  if (!course) return result;
  for (const pageId of course.linkedPageIds || []) {
    const topic = getNotebookTopic(course, pageId);
    if (!result.has(topic)) result.set(topic, []);
    result.get(topic).push(pageId);
  }
  return result;
}

/** All courses that have `pageId` in their `linkedPageIds`. */
export function getCoursesLinkedToPage(pageId) {
  if (!pageId) return [];
  return getCourses().filter((c) => (c.linkedPageIds || []).includes(pageId));
}

/** Normalize a course's required fields after load. */
export function normalizeCourse(project) {
  if (!project || project.kind !== COURSE_KIND) return;
  if (!Array.isArray(project.classTimes)) project.classTimes = [];
  project.classTimes = project.classTimes.map((ct) => ({
    ...ct,
    days: Array.isArray(ct?.days) ? ct.days : [],
    start: typeof ct?.start === 'string' ? ct.start : '',
    end: typeof ct?.end === 'string' ? ct.end : '',
    startDate: typeof ct?.startDate === 'string' ? ct.startDate : '',
    endDate: typeof ct?.endDate === 'string' ? ct.endDate : '',
    location: typeof ct?.location === 'string' ? ct.location : ''
  }));
  if (!Array.isArray(project.linkedPageIds)) project.linkedPageIds = [];
  if (!project.notebookMetadata || typeof project.notebookMetadata !== 'object') {
    project.notebookMetadata = {};
  }
  if (typeof project.semester !== 'string') project.semester = '';
  if (project.semesterId === undefined) project.semesterId = null;
  if (typeof project.courseStatus !== 'string') project.courseStatus = 'in_progress';
}
