import { useMemo, useState } from 'react';
import { Store, formatLocalYMD } from '../utils/store';
import {
  getSemesterById,
  getCoursesBySemester,
  getCourseSummary,
  getSemesterStats,
  getUpcomingSemesterItems,
  getSemesterItemsByType,
  buildNewCourse,
  formatClassTime,
  COURSE_STATUSES,
  SCHOOL_ITEM_TYPES,
  SCHOOL_ITEM_LABELS,
  SCHOOL_ITEM_ICONS,
  UNASSIGNED_SEMESTER_ID
} from '../utils/school';
import { SemesterModal } from './SemesterModal';
import { collectPagesForScope, getMasteryConfig, pageReviewStatus } from '../utils/mastery';

/**
 * Dashboard page for a single semester:
 * - Stats cards across the top
 * - Course cards (one per class) with schedule + counts + open/upcoming actions
 * - Quick-view lists for upcoming exams, assignments, quizzes, and progress
 */
export function SemesterView({ semesterId, onNavigate, onUpdate, onOpenItemPanel }) {
  const [editingSemester, setEditingSemester] = useState(false);
  const [calendarView, setCalendarView] = useState('month'); // month | week | 3day | day | activity
  const [calendarFilters, setCalendarFilters] = useState({
    classes: true,
    exams: true,
    assignments: true,
    quizzes: true
  });
  const [focusDate, setFocusDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [, forceRender] = useState(0);

  const isUnassigned = semesterId === UNASSIGNED_SEMESTER_ID || !semesterId;
  const semester = isUnassigned ? null : getSemesterById(semesterId);

  if (!isUnassigned && !semester) {
    return (
      <div className="page-view-empty">
        <p>Semester not found.</p>
        <button className="btn btn-secondary" onClick={() => onNavigate?.('tasks', 'all')}>
          ← Back
        </button>
      </div>
    );
  }

  const persist = () => {
    Store.save();
    onUpdate?.();
    forceRender((n) => n + 1);
  };

  const courses = isUnassigned
    ? getCoursesBySemester(null)
    : getCoursesBySemester(semesterId);
  const stats = getSemesterStats(isUnassigned ? null : semesterId);
  const upcomingExams       = getUpcomingSemesterItems(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.EXAM,       { limit: 6 });
  const upcomingAssignments = getUpcomingSemesterItems(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.ASSIGNMENT, { limit: 6 });
  const upcomingQuizzes     = getUpcomingSemesterItems(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.QUIZ,       { limit: 6 });
  const upcomingHomework    = getUpcomingSemesterItems(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.HOMEWORK,   { limit: 6 });

  /** Up-for-review: pages across all linked notebooks of this semester's courses. */
  const [reviewClassFilter, setReviewClassFilter] = useState('__all__');
  const todayYMD = formatLocalYMD(new Date());

  const reviewItems = useMemo(() => {
    if (!Store.settings.masteryEnabled) return [];
    const items = [];
    for (const course of courses) {
      if (reviewClassFilter !== '__all__' && course.id !== reviewClassFilter) continue;
      const pages = collectPagesForScope({ rootPageIds: course.linkedPageIds || [] });
      for (const p of pages) {
        const status = pageReviewStatus(p, todayYMD);
        if (status === 'missed' || status === 'due_today') {
          items.push({ page: p, course, status });
        }
      }
    }
    return items.sort((a, b) => {
      if (a.status === 'missed' && b.status !== 'missed') return -1;
      if (a.status !== 'missed' && b.status === 'missed') return 1;
      const aDate = a.page.mastery?.nextReview || '9999-99-99';
      const bDate = b.page.mastery?.nextReview || '9999-99-99';
      return aDate.localeCompare(bDate);
    });
  }, [courses, reviewClassFilter, todayYMD, Store.pages]);
  const calendarItems = [
    ...getSemesterItemsByType(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.ASSIGNMENT),
    ...getSemesterItemsByType(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.QUIZ),
    ...getSemesterItemsByType(isUnassigned ? null : semesterId, SCHOOL_ITEM_TYPES.EXAM)
  ].filter((it) => !!it.date && !it.archived);

  const toYmd = (year, monthIdx, day) =>
    `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const formatYmd = (dateObj) =>
    toYmd(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const addDays = (dateObj, delta) => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + delta);
    return next;
  };
  const fmtShort = (dateObj) =>
    dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmtLong = (dateObj) =>
    dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const monthMeta = useMemo(() => {
    const year = focusDate.getFullYear();
    const month = focusDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { year, month, firstWeekday, daysInMonth };
  }, [focusDate]);

  const getClassEventsForDate = (dateObj) => {
    if (!calendarFilters.classes) return [];
    const dateStr = formatYmd(dateObj);
    const weekday = dateObj.getDay();
    const events = [];
    for (const course of courses) {
      for (const slot of course.classTimes || []) {
        if (!(slot.days || []).includes(weekday)) continue;
        if (slot.startDate && dateStr < slot.startDate) continue;
        if (slot.endDate && dateStr > slot.endDate) continue;
        events.push({
          kind: 'class',
          id: `${course.id}_${slot.id}_${dateStr}`,
          date: dateStr,
          courseId: course.id,
          courseName: course.name || 'Untitled course',
          courseIcon: course.icon || '📚',
          start: slot.start || '',
          end: slot.end || '',
          location: slot.location || ''
        });
      }
    }
    return events.sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));
  };

  const getSchoolItemsForDate = (dateStr) =>
    calendarItems
      .filter((it) => it.date === dateStr)
      .filter((it) => {
        if (it.type === SCHOOL_ITEM_TYPES.EXAM) return calendarFilters.exams;
        if (it.type === SCHOOL_ITEM_TYPES.QUIZ) return calendarFilters.quizzes;
        if (it.type === SCHOOL_ITEM_TYPES.ASSIGNMENT) return calendarFilters.assignments;
        return true;
      })
      .sort((a, b) => getTypeOrder(a.type) - getTypeOrder(b.type));

  const getDayItems = (dateObj) => {
    const dateStr = formatYmd(dateObj);
    const classItems = getClassEventsForDate(dateObj);
    const schoolItems = getSchoolItemsForDate(dateStr);
    return [...classItems, ...schoolItems];
  };

  const shiftCalendar = (delta) => {
    setFocusDate((prev) => {
      if (calendarView === 'month') return new Date(prev.getFullYear(), prev.getMonth() + delta, prev.getDate());
      if (calendarView === 'week') return addDays(prev, 7 * delta);
      if (calendarView === '3day') return addDays(prev, 3 * delta);
      return addDays(prev, delta);
    });
  };

  const rangeLabel = (() => {
    if (calendarView === 'month') {
      return new Date(focusDate.getFullYear(), focusDate.getMonth(), 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
      });
    }
    if (calendarView === 'week') {
      const start = addDays(focusDate, -focusDate.getDay());
      const end = addDays(start, 6);
      return `${fmtShort(start)} – ${fmtShort(end)}`;
    }
    if (calendarView === '3day') {
      const start = new Date(focusDate);
      const end = addDays(start, 2);
      return `${fmtShort(start)} – ${fmtShort(end)}`;
    }
    return fmtLong(focusDate);
  })();

  const toggleCalendarFilter = (key) => {
    setCalendarFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getTypeOrder = (type) => {
    if (type === SCHOOL_ITEM_TYPES.EXAM) return 0;
    if (type === SCHOOL_ITEM_TYPES.QUIZ) return 1;
    return 2;
  };

  const openCalendarItem = (item) => {
    if (item.kind === 'class') {
      onNavigate?.('course', null, item.courseId);
      return;
    }
    if (item.type === SCHOOL_ITEM_TYPES.EXAM) {
      onNavigate?.('examDetail', null, item.pid, null, item.id);
    } else {
      onOpenItemPanel?.(item.id);
    }
  };

  const handleAddCourse = () => {
    const course = buildNewCourse({
      semesterId: isUnassigned ? null : semesterId
    });
    Store.projects.push(course);
    Store.save();
    onUpdate?.();
    onNavigate?.('course', null, course.id);
  };

  const handleToggleItem = (item) => {
    const it = Store.items.find((x) => x.id === item.id);
    if (!it) return;
    it.done = !it.done;
    persist();
  };

  const courseLabel = (courseId) =>
    Store.projects.find((p) => p.id === courseId)?.name || '';

  const examLabel = (examId) => {
    if (examId == null) return '';
    const id = typeof examId === 'number' ? examId : parseInt(examId, 10);
    if (Number.isNaN(id)) return '';
    return Store.items.find((it) => it.id === id && it.type === SCHOOL_ITEM_TYPES.EXAM)?.text || '';
  };

  const renderItemContext = (item) => {
    const cls = courseLabel(item.pid);
    const exm = examLabel(item.parentExamId);
    if (cls && exm) return `${cls} · 📘 ${exm}`;
    return cls || exm;
  };

  const renderQuickList = (label, type, items) => (
    <div className="semester-quick-card">
      <div className="semester-quick-header">
        <span className="semester-quick-icon">{SCHOOL_ITEM_ICONS[type]}</span>
        <span className="semester-quick-title">{label}</span>
        <span className="semester-quick-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="semester-quick-empty">Nothing scheduled.</div>
      ) : (
        <div className="semester-quick-list">
          {items.map((item) => {
            const isExam = item.type === SCHOOL_ITEM_TYPES.EXAM;
            return (
              <div
                key={item.id}
                className={`semester-quick-row ${item.done ? 'done' : ''}`}
              >
                <input
                  type="checkbox"
                  className="school-item-checkbox"
                  checked={!!item.done}
                  onChange={() => handleToggleItem(item)}
                />
                <button
                  type="button"
                  className="semester-quick-text"
                  onClick={() => {
                    if (isExam) {
                      onNavigate?.('examDetail', null, item.pid, null, item.id);
                    } else {
                      onOpenItemPanel?.(item.id);
                    }
                  }}
                  title={item.text}
                >
                  <span className="semester-quick-row-title">
                    {item.text || `Untitled ${SCHOOL_ITEM_LABELS[item.type]}`}
                  </span>
                  <span className="semester-quick-row-meta">
                    {renderItemContext(item)}
                  </span>
                </button>
                <span className="semester-quick-row-date">
                  {item.date ? item.date.slice(5) : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const title = isUnassigned ? 'Unassigned Courses' : (semester?.name || 'Semester');

  return (
    <div className="semester-view">
      <div className="semester-header">
        <div className="semester-header-main">
          <span className="semester-header-icon">{isUnassigned ? '📭' : '🎓'}</span>
          <h1 className="semester-title">{title}</h1>
        </div>
        <div className="semester-header-actions">
          <button type="button" className="school-btn" onClick={handleAddCourse}>
            + Add Course
          </button>
          {!isUnassigned && (
            <button
              type="button"
              className="school-btn"
              onClick={() => setEditingSemester(true)}
            >
              Manage
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate?.('tasks', 'all')}
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="semester-stats-grid">
        <div className="semester-stat-card">
          <span className="semester-stat-label">Classes</span>
          <span className="semester-stat-value">{stats.courseCount}</span>
        </div>
        <div className="semester-stat-card">
          <span className="semester-stat-label">Open Assignments</span>
          <span className="semester-stat-value">{stats.openAssignments}</span>
          <span className="semester-stat-sub">{stats.upcomingAssignments} this week</span>
        </div>
        <div className="semester-stat-card">
          <span className="semester-stat-label">Open Quizzes</span>
          <span className="semester-stat-value">{stats.openQuizzes}</span>
          <span className="semester-stat-sub">{stats.upcomingQuizzes} this week</span>
        </div>
        <div className="semester-stat-card">
          <span className="semester-stat-label">Upcoming Exams</span>
          <span className="semester-stat-value">{stats.openExams}</span>
          <span className="semester-stat-sub">{stats.upcomingExams} this week</span>
        </div>
        <div className="semester-stat-card semester-progress-card">
          <span className="semester-stat-label">Semester Progress</span>
          <span className="semester-stat-value">{stats.progress}%</span>
          <div className="semester-progress-bar">
            <div
              className="semester-progress-fill"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <span className="semester-stat-sub">
            {stats.completed} of {stats.totalTrackable} done
          </span>
        </div>
      </div>

      <div className="semester-section">
        <div className="semester-section-header semester-calendar-header">
          <h2 className="semester-section-title">Calendar</h2>
          <div className="semester-calendar-controls">
            <button type="button" className="school-btn" onClick={() => shiftCalendar(-1)}>
              ← Prev
            </button>
            <span className="semester-calendar-label">{rangeLabel}</span>
            <button type="button" className="school-btn" onClick={() => shiftCalendar(1)}>
              Next →
            </button>
            <button type="button" className="school-btn" onClick={() => setFocusDate(new Date())}>
              Today
            </button>
          </div>
        </div>
        <div className="semester-calendar-viewmodes">
          {[
            { id: 'month', label: 'Month' },
            { id: 'week', label: 'Week' },
            { id: '3day', label: '3-Day' },
            { id: 'day', label: 'Single Day' },
            { id: 'activity', label: 'Activity' }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`semester-calendar-filter ${calendarView === mode.id ? 'active' : ''}`}
              onClick={() => setCalendarView(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="semester-calendar-filters">
          <button
            type="button"
            className={`semester-calendar-filter ${calendarFilters.classes ? 'active' : ''}`}
            onClick={() => toggleCalendarFilter('classes')}
          >
            📚 Classes
          </button>
          <button
            type="button"
            className={`semester-calendar-filter ${calendarFilters.exams ? 'active' : ''}`}
            onClick={() => toggleCalendarFilter('exams')}
          >
            📘 Exams
          </button>
          <button
            type="button"
            className={`semester-calendar-filter ${calendarFilters.assignments ? 'active' : ''}`}
            onClick={() => toggleCalendarFilter('assignments')}
          >
            📝 Assignments
          </button>
          <button
            type="button"
            className={`semester-calendar-filter ${calendarFilters.quizzes ? 'active' : ''}`}
            onClick={() => toggleCalendarFilter('quizzes')}
          >
            ✏️ Quizzes
          </button>
        </div>

        {calendarView === 'month' && (
        <div className="semester-calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dow) => (
            <div key={dow} className="semester-calendar-dow">{dow}</div>
          ))}

          {Array.from({ length: monthMeta.firstWeekday }, (_, idx) => (
            <div key={`empty-${idx}`} className="semester-calendar-cell muted" />
          ))}

          {Array.from({ length: monthMeta.daysInMonth }, (_, idx) => {
            const day = idx + 1;
            const dateStr = toYmd(monthMeta.year, monthMeta.month, day);
            const dayItems = getDayItems(new Date(monthMeta.year, monthMeta.month, day));

            return (
              <div key={dateStr} className="semester-calendar-cell">
                <div className="semester-calendar-date">{day}</div>
                <div className="semester-calendar-items">
                  {dayItems.length === 0 ? (
                    <div className="semester-calendar-empty">—</div>
                  ) : (
                    dayItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`semester-calendar-item ${item.kind === 'class' ? 'class' : ''} ${item.done ? 'done' : ''}`}
                        onClick={() => openCalendarItem(item)}
                        title={
                          item.kind === 'class'
                            ? `Class · ${item.courseName}${item.start ? ` · ${item.start}${item.end ? `-${item.end}` : ''}` : ''}${item.location ? ` · ${item.location}` : ''}`
                            : `${SCHOOL_ITEM_LABELS[item.type]} · ${item.text || 'Untitled'}`
                        }
                      >
                        <span className="semester-calendar-item-icon">
                          {item.kind === 'class' ? item.courseIcon : SCHOOL_ITEM_ICONS[item.type]}
                        </span>
                        <span className="semester-calendar-item-text">
                          {item.kind === 'class'
                            ? `${item.start ? `${item.start} ` : ''}${item.courseName}`
                            : (item.text || `Untitled ${SCHOOL_ITEM_LABELS[item.type]}`)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {(calendarView === 'week' || calendarView === '3day' || calendarView === 'day') && (
          <div
            className={`semester-range-grid ${calendarView === 'day' ? 'single' : ''}`}
            style={{
              gridTemplateColumns: `repeat(${calendarView === 'week' ? 7 : (calendarView === '3day' ? 3 : 1)}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: calendarView === 'week' ? 7 : (calendarView === '3day' ? 3 : 1) }, (_, idx) => {
              const base = calendarView === 'week'
                ? addDays(focusDate, -focusDate.getDay() + idx)
                : addDays(focusDate, idx);
              const dayItems = getDayItems(base);
              return (
                <div key={formatYmd(base)} className="semester-range-col">
                  <div className="semester-range-col-head">{fmtLong(base)}</div>
                  <div className="semester-range-col-body">
                    {dayItems.length === 0 ? (
                      <div className="semester-calendar-empty">No items</div>
                    ) : dayItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`semester-calendar-item ${item.kind === 'class' ? 'class' : ''} ${item.done ? 'done' : ''}`}
                        onClick={() => openCalendarItem(item)}
                      >
                        <span className="semester-calendar-item-icon">
                          {item.kind === 'class' ? item.courseIcon : SCHOOL_ITEM_ICONS[item.type]}
                        </span>
                        <span className="semester-calendar-item-text">
                          {item.kind === 'class'
                            ? `${item.start ? `${item.start} ` : ''}${item.courseName}`
                            : (item.text || `Untitled ${SCHOOL_ITEM_LABELS[item.type]}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {calendarView === 'activity' && (
          <div className="semester-activity-view">
            <div className="semester-range-col-head">{fmtLong(focusDate)}</div>
            <div className="semester-activity-list">
              {getDayItems(focusDate).length === 0 ? (
                <div className="semester-calendar-empty">No activity for this day.</div>
              ) : (
                getDayItems(focusDate).map((item) => (
                  <div key={item.id} className="semester-activity-row">
                    <span className="semester-activity-time">
                      {item.kind === 'class' ? (item.start || 'Class') : (item.time || 'Due')}
                    </span>
                    <button
                      type="button"
                      className={`semester-calendar-item ${item.kind === 'class' ? 'class' : ''} ${item.done ? 'done' : ''}`}
                      onClick={() => openCalendarItem(item)}
                    >
                      <span className="semester-calendar-item-icon">
                        {item.kind === 'class' ? item.courseIcon : SCHOOL_ITEM_ICONS[item.type]}
                      </span>
                      <span className="semester-calendar-item-text">
                        {item.kind === 'class'
                          ? `${item.courseName}${item.location ? ` · ${item.location}` : ''}`
                          : (item.text || `Untitled ${SCHOOL_ITEM_LABELS[item.type]}`)}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="semester-section">
        <div className="semester-section-header">
          <h2 className="semester-section-title">Classes</h2>
          <span className="semester-section-meta">{courses.length} course(s)</span>
        </div>
        {courses.length === 0 ? (
          <div className="semester-empty-card">
            No courses yet. <button type="button" className="link-btn" onClick={handleAddCourse}>Add a course</button> to get started.
          </div>
        ) : (
          <div className="semester-course-grid">
            {courses.map((course) => {
              const summary = getCourseSummary(course);
              const status = COURSE_STATUSES.find((s) => s.id === (course.courseStatus || 'in_progress'))
                || COURSE_STATUSES[1];
              const accent = course.color || 'var(--accent)';
              return (
                <div
                  key={course.id}
                  className="semester-course-card"
                  style={{ borderLeft: `4px solid ${accent}` }}
                >
                  <div className="semester-course-head">
                    <span className="semester-course-icon">{course.icon || '📚'}</span>
                    <button
                      type="button"
                      className="semester-course-name"
                      onClick={() => onNavigate?.('course', null, course.id)}
                    >
                      {course.name || 'Untitled course'}
                    </button>
                    <span
                      className="semester-course-status"
                      style={{ background: status.color }}
                      title={status.label}
                    >
                      {status.label}
                    </span>
                  </div>

                  {(course.classTimes || []).length > 0 && (
                    <div className="semester-course-schedule">
                      {(course.classTimes || []).map((ct) => (
                        <span key={ct.id} className="semester-course-slot">
                          🕐 {formatClassTime(ct) || 'Unscheduled'}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="semester-course-counts">
                    <span title="Open assignments">
                      📝 <strong>{summary.assignments}</strong> assignments
                    </span>
                    <span title="Open quizzes">
                      ✏️ <strong>{summary.quizzes}</strong> quizzes
                    </span>
                    <span title="Open exams">
                      📘 <strong>{summary.exams}</strong> exams
                    </span>
                  </div>

                  <div className="semester-course-progress">
                    <div className="semester-course-progress-bar">
                      <div
                        className="semester-course-progress-fill"
                        style={{ width: `${summary.progress}%`, background: accent }}
                      />
                    </div>
                    <span className="semester-course-progress-label">
                      {summary.done}/{summary.total} done · {summary.progress}%
                    </span>
                  </div>

                  <div className="semester-course-actions">
                    <button
                      type="button"
                      className="school-btn primary"
                      onClick={() => onNavigate?.('course', null, course.id)}
                    >
                      Open Course
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="semester-quick-grid">
        {renderQuickList('Upcoming Exams',         SCHOOL_ITEM_TYPES.EXAM,       upcomingExams)}
        {renderQuickList('Assignments Due Soon',   SCHOOL_ITEM_TYPES.ASSIGNMENT, upcomingAssignments)}
        {renderQuickList('Quizzes',                SCHOOL_ITEM_TYPES.QUIZ,       upcomingQuizzes)}
        {renderQuickList('Homework',               SCHOOL_ITEM_TYPES.HOMEWORK,   upcomingHomework)}
        {Store.settings.masteryEnabled && (
          <div className="semester-quick-card semester-review-card">
            <div className="semester-quick-header">
              <span className="semester-quick-icon">🎯</span>
              <span className="semester-quick-title">Up for Review</span>
              <span className="semester-quick-count">{reviewItems.length}</span>
            </div>
            <div className="semester-review-filter">
              <select
                className="school-btn"
                value={reviewClassFilter}
                onChange={(e) => setReviewClassFilter(e.target.value)}
              >
                <option value="__all__">All classes</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || '📚'} {c.name}</option>
                ))}
              </select>
            </div>
            {reviewItems.length === 0 ? (
              <div className="semester-quick-empty">Nothing to review.</div>
            ) : (
              <div className="semester-quick-list">
                {reviewItems.slice(0, 8).map(({ page, course, status }) => {
                  const config = getMasteryConfig(page.mastery?.level);
                  return (
                    <div
                      key={page.id}
                      className={`semester-quick-row ${status === 'missed' ? 'missed' : ''}`}
                    >
                      <span
                        className="mastery-level-chip small"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.label}
                      </span>
                      <button
                        type="button"
                        className="semester-quick-text"
                        onClick={() => onNavigate?.('page', null, null, page.id)}
                        title={page.title}
                      >
                        <span className="semester-quick-row-title">
                          {page.icon || '📄'} {page.title || 'Untitled'}
                        </span>
                        <span className="semester-quick-row-meta">
                          {course.icon || '📚'} {course.name}
                        </span>
                      </button>
                      <span className={`semester-quick-row-date ${status === 'missed' ? 'missed' : ''}`}>
                        {status === 'missed' ? 'overdue' : 'today'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {editingSemester && !isUnassigned && (
        <SemesterModal
          semesterId={semesterId}
          mode="edit"
          onClose={() => setEditingSemester(false)}
          onSave={() => {
            setEditingSemester(false);
            onUpdate?.();
            forceRender((n) => n + 1);
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
