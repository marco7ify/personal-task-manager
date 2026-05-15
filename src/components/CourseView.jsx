import { useState, useRef, useEffect, useMemo } from 'react';
import { Store } from '../utils/store';
import {
  getCourseById,
  getSemesters,
  getCourseItemsByType,
  computeExamProgress,
  buildNewClassTime,
  buildNewSchoolItem,
  getNotebookTopic,
  setNotebookTopic,
  getCourseTopics,
  getExamSubItems,
  COURSE_STATUSES,
  COURSE_ICONS,
  DAYS_OF_WEEK,
  SCHOOL_ITEM_TYPES,
  SCHOOL_ITEM_LABELS,
  SCHOOL_ITEM_ICONS
} from '../utils/school';
import { createPage, getChildrenMap, getDescendantPageIds } from '../utils/pages';
import { collectPagesForScope, getMasteryBreakdown } from '../utils/mastery';
import { formatLocalYMD } from '../utils/store';

const ALL_TOPICS_KEY = '__all__';
const NO_TOPIC_KEY = '__none__';

const COURSE_COLORS = [
  '#2383E2', '#E22383', '#45A557', '#F59E0B',
  '#9B59B6', '#FF5555', '#14B8A6', '#A855F7',
  '#0EA5E9', '#F97316'
];

export function CourseView({ courseId, onNavigate, onUpdate, onOpenItemPanel }) {
  const course = getCourseById(courseId);
  const [, forceRender] = useState(0);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [expandedNotebooks, setExpandedNotebooks] = useState(() => new Set());
  const [activeTopic, setActiveTopic] = useState(ALL_TOPICS_KEY);
  const [editingTopicFor, setEditingTopicFor] = useState(null);
  const [topicDraft, setTopicDraft] = useState('');
  const [showFilters, setShowFilters] = useState({ exams: true, assignments: true, quizzes: true });
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!showPagePicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPagePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPagePicker]);

  if (!course) {
    return (
      <div className="page-view-empty">
        <p>Course not found.</p>
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

  const setField = (key, value) => {
    course[key] = value;
    persist();
  };

  const handleAddClassTime = () => {
    course.classTimes = [...(course.classTimes || []), buildNewClassTime()];
    persist();
  };

  const handleUpdateClassTime = (id, key, value) => {
    course.classTimes = (course.classTimes || []).map((ct) =>
      ct.id === id ? { ...ct, [key]: value } : ct
    );
    persist();
  };

  const handleToggleClassDay = (id, day) => {
    course.classTimes = (course.classTimes || []).map((ct) => {
      if (ct.id !== id) return ct;
      const set = new Set(ct.days || []);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...ct, days: Array.from(set).sort((a, b) => a - b) };
    });
    persist();
  };

  const handleRemoveClassTime = (id) => {
    course.classTimes = (course.classTimes || []).filter((ct) => ct.id !== id);
    persist();
  };

  const handleLinkPage = (pageId) => {
    if (!pageId) return;
    const ids = course.linkedPageIds || [];
    if (ids.includes(pageId)) return;
    course.linkedPageIds = [...ids, pageId];
    persist();
    setShowPagePicker(false);
  };

  const handleUnlinkPage = (pageId) => {
    course.linkedPageIds = (course.linkedPageIds || []).filter((id) => id !== pageId);
    if (course.notebookMetadata && course.notebookMetadata[pageId]) {
      delete course.notebookMetadata[pageId];
    }
    setExpandedNotebooks((prev) => {
      const next = new Set(prev);
      next.delete(pageId);
      return next;
    });
    persist();
  };

  const handleCreateAndLinkNotebook = () => {
    const name = newNotebookName.trim() || 'New Notebook';
    const page = createPage({ icon: '📓', title: name });
    if (!Array.isArray(Store.pages)) Store.pages = [];
    Store.pages.push(page);
    course.linkedPageIds = [...(course.linkedPageIds || []), page.id];
    setNewNotebookName('');
    setShowPagePicker(false);
    persist();
  };

  const handleCreateChildPage = (parentPageId) => {
    if (!parentPageId) return;
    const page = createPage({ parentId: parentPageId, title: 'Untitled', icon: '📄' });
    if (!Array.isArray(Store.pages)) Store.pages = [];
    Store.pages.push(page);
    const parent = Store.pages.find((p) => p.id === parentPageId);
    if (parent) parent.expanded = true;
    setExpandedNotebooks((prev) => {
      const next = new Set(prev);
      next.add(parentPageId);
      return next;
    });
    persist();
    onNavigate?.('page', null, null, page.id);
  };

  const handleDeletePageFromCourse = (pageId) => {
    const page = (Store.pages || []).find((p) => p.id === pageId);
    if (!page) return;
    const descendants = getDescendantPageIds(Store.pages, pageId);
    const total = descendants.length + 1;
    const message = total === 1
      ? `Delete "${page.title || 'Untitled'}"? This cannot be undone.`
      : `Delete "${page.title || 'Untitled'}" and ${descendants.length} nested page(s)? This cannot be undone.`;
    if (!confirm(message)) return;
    const idsToRemove = new Set([pageId, ...descendants]);
    Store.pages = Store.pages.filter((p) => !idsToRemove.has(p.id));
    course.linkedPageIds = (course.linkedPageIds || []).filter((id) => !idsToRemove.has(id));
    if (course.notebookMetadata) {
      for (const id of idsToRemove) delete course.notebookMetadata[id];
    }
    persist();
  };

  const toggleNotebookExpanded = (pageId) => {
    setExpandedNotebooks((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const startEditTopic = (pageId) => {
    setEditingTopicFor(pageId);
    setTopicDraft(getNotebookTopic(course, pageId));
  };

  const commitTopicEdit = () => {
    if (!editingTopicFor) return;
    setNotebookTopic(course, editingTopicFor, topicDraft);
    setEditingTopicFor(null);
    setTopicDraft('');
    persist();
  };

  const cancelTopicEdit = () => {
    setEditingTopicFor(null);
    setTopicDraft('');
  };

  const handleAddItem = (type) => {
    const item = buildNewSchoolItem({
      courseId,
      type,
      text: `New ${SCHOOL_ITEM_LABELS[type] || 'item'}`
    });
    Store.items.push(item);
    persist();
  };

  const handleToggleItemDone = (itemId) => {
    const it = Store.items.find((x) => x.id === itemId);
    if (!it) return;
    it.done = !it.done;
    persist();
  };

  const handleUpdateItemField = (itemId, field, value) => {
    const it = Store.items.find((x) => x.id === itemId);
    if (!it) return;
    it[field] = value || null;
    persist();
  };

  const handleDeleteItem = (itemId) => {
    if (!confirm('Delete this item?')) return;
    Store.items = Store.items.filter((x) => x.id !== itemId);
    persist();
  };

  const handleOpenExam = (examId) => {
    onNavigate?.('examDetail', null, courseId, null, examId);
  };

  const status = COURSE_STATUSES.find((s) => s.id === (course.courseStatus || 'in_progress'))
              || COURSE_STATUSES[1];

  const assignments = getCourseItemsByType(courseId, SCHOOL_ITEM_TYPES.ASSIGNMENT);
  const quizzes     = getCourseItemsByType(courseId, SCHOOL_ITEM_TYPES.QUIZ);
  const exams       = getCourseItemsByType(courseId, SCHOOL_ITEM_TYPES.EXAM);
  const semesters   = getSemesters();

  const allPages = Array.isArray(Store.pages) ? Store.pages : [];
  const childrenMap = useMemo(() => getChildrenMap(allPages), [allPages, course.linkedPageIds]);
  const linkedPages = (course.linkedPageIds || [])
    .map((id) => allPages.find((p) => p.id === id))
    .filter(Boolean);
  const availablePages = allPages.filter(
    (p) => (p.parentId == null) && !(course.linkedPageIds || []).includes(p.id)
  );
  const topics = getCourseTopics(course);
  const hasUntagged = linkedPages.some((p) => !getNotebookTopic(course, p.id));
  const filteredLinkedPages = linkedPages.filter((p) => {
    if (activeTopic === ALL_TOPICS_KEY) return true;
    const t = getNotebookTopic(course, p.id);
    if (activeTopic === NO_TOPIC_KEY) return !t;
    return t === activeTopic;
  });

  const todayYMD = formatLocalYMD(new Date());
  const ignoreUntracked = Store.settings.masteryIgnoreUntracked;

  const getExamCardStats = (exam) => {
    const subs = getExamSubItems(exam.id);
    const openCount = (type) => subs.filter((s) => s.type === type && !s.done).length;

    let mastery = { score: 0, totalPages: 0, trackedPages: 0, dueToday: 0, missed: 0 };
    if (exam?.examMeta?.linkedPageIds?.length) {
      const pages = collectPagesForScope({ rootPageIds: exam.examMeta.linkedPageIds });
      const breakdown = getMasteryBreakdown(pages, todayYMD, { ignoreUntracked });
      mastery = {
        score: breakdown.score,
        totalPages: breakdown.totalPages,
        trackedPages: breakdown.trackedPages,
        dueToday: breakdown.buckets.dueToday.length,
        missed: breakdown.buckets.missed.length
      };
    }

    return {
      mastery,
      assignments: openCount(SCHOOL_ITEM_TYPES.ASSIGNMENT),
      quizzes: openCount(SCHOOL_ITEM_TYPES.QUIZ),
      homework: openCount(SCHOOL_ITEM_TYPES.HOMEWORK),
      notebooksLinked: (exam?.examMeta?.linkedPageIds || []).length
    };
  };

  const renderItemRow = (item) => {
    const isExam = item.type === SCHOOL_ITEM_TYPES.EXAM;
    const progress = isExam ? computeExamProgress(item.id) : null;
    return (
      <div key={item.id} className={`school-item-row ${item.done ? 'done' : ''}`}>
        <input
          type="checkbox"
          className="school-item-checkbox"
          checked={!!item.done}
          onChange={() => handleToggleItemDone(item.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="school-item-icon">
          {SCHOOL_ITEM_ICONS[item.type] || '📝'}
        </span>
        <input
          type="text"
          className="school-item-text"
          value={item.text || ''}
          onChange={(e) => handleUpdateItemField(item.id, 'text', e.target.value)}
          placeholder={`Untitled ${SCHOOL_ITEM_LABELS[item.type] || 'item'}`}
        />
        <div className="school-item-meta">
          <input
            type="date"
            className="school-item-date-input"
            value={item.date || ''}
            onChange={(e) => handleUpdateItemField(item.id, 'date', e.target.value)}
            title="Due date"
          />
          {isExam && (
            <span className="school-item-progress" title="Study progress">
              {progress}%
            </span>
          )}
          {isExam ? (
            <button
              type="button"
              className="school-item-open"
              onClick={() => handleOpenExam(item.id)}
            >
              Open
            </button>
          ) : (
            <button
              type="button"
              className="school-item-open"
              onClick={() => onOpenItemPanel?.(item.id)}
              title="Open details"
            >
              Details
            </button>
          )}
          <button
            type="button"
            className="school-item-delete"
            onClick={() => handleDeleteItem(item.id)}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  const renderPageTreeNode = (page, depth, childrenMap) => {
    const children = childrenMap.get(page.id) || [];
    return (
      <div key={page.id} className="page-tree-node">
        <div
          className="page-tree-row"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <span
            className="page-tree-name"
            onClick={() => onNavigate?.('page', null, null, page.id)}
            title="Open page"
          >
            <span className="page-tree-icon">{page.icon || '📄'}</span>
            <span className="page-tree-title">{page.title || 'Untitled'}</span>
            {children.length > 0 && (
              <span className="page-tree-child-count">({children.length})</span>
            )}
          </span>
          <button
            type="button"
            className="page-tree-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleCreateChildPage(page.id);
            }}
            title="Add sub-page"
          >
            +
          </button>
          <button
            type="button"
            className="page-tree-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePageFromCourse(page.id);
            }}
            title="Delete page"
          >
            ✕
          </button>
        </div>
        {children.length > 0 && (
          <div className="page-tree-children">
            {children.map((child) => renderPageTreeNode(child, depth + 1, childrenMap))}
          </div>
        )}
      </div>
    );
  };

  const renderItemList = (label, type, items) => (
    <div className="school-section">
      <div className="school-section-header">
        <div className="school-section-title">
          <span>{SCHOOL_ITEM_ICONS[type]}</span>
          <span>{label}</span>
          <span style={{
            fontSize: '0.72rem',
            color: 'var(--text-sub)',
            fontWeight: 400
          }}>
            ({items.length})
          </span>
        </div>
        <div className="school-section-actions">
          <button
            type="button"
            className="school-btn"
            onClick={() => handleAddItem(type)}
          >
            + Add {SCHOOL_ITEM_LABELS[type]}
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="school-item-empty">
          No {label.toLowerCase()} yet. Click "+ Add {SCHOOL_ITEM_LABELS[type]}" to get started.
        </div>
      ) : (
        <div className="school-item-list">
          {items
            .slice()
            .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
            .map(renderItemRow)}
        </div>
      )}
    </div>
  );

  return (
    <div className="course-view">
      <div className="course-view-header">
        <div className="course-icon-wrapper">
          <button
            type="button"
            className="course-icon"
            onClick={() => setShowIconPicker((v) => !v)}
            title="Change icon"
          >
            {course.icon || '📚'}
          </button>
          {showIconPicker && (
            <div className="course-icon-picker">
              {COURSE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  className={`course-icon-option ${course.icon === ic ? 'active' : ''}`}
                  onClick={() => {
                    setField('icon', ic);
                    setShowIconPicker(false);
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          className="course-title-input"
          value={course.name || ''}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Untitled course"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm course-back-btn"
          onClick={() => onNavigate?.('tasks', 'all')}
        >
          ← Back
        </button>
      </div>

      <div className="course-meta-row">
        <div className="course-meta-item">
          <span className="course-meta-label">Status</span>
          <select
            className="course-status-select"
            value={course.courseStatus || 'in_progress'}
            onChange={(e) => setField('courseStatus', e.target.value)}
            style={{ borderLeft: `4px solid ${status.color}` }}
          >
            {COURSE_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="course-meta-item">
          <span className="course-meta-label">Semester</span>
          <select
            className="course-status-select course-semester-select"
            value={course.semesterId || ''}
            onChange={(e) => {
              const nextSemesterId = e.target.value || null;
              const semester = semesters.find((s) => s.id === nextSemesterId);
              course.semester = semester?.name || '';
              setField('semesterId', nextSemesterId);
            }}
          >
            <option value="">Unassigned</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.name}
              </option>
            ))}
          </select>
        </div>
        <div className="course-meta-item">
          <span className="course-meta-label">Color</span>
          <div className="course-color-row">
            {COURSE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`course-color-swatch ${course.color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setField('color', c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="course-filter-bar">
        <span className="course-filter-label">Show:</span>
        <label className="course-filter-checkbox">
          <input
            type="checkbox"
            checked={showFilters.exams}
            onChange={(e) => setShowFilters((f) => ({ ...f, exams: e.target.checked }))}
          />
          <span>{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]} Exams ({exams.length})</span>
        </label>
        <label className="course-filter-checkbox">
          <input
            type="checkbox"
            checked={showFilters.assignments}
            onChange={(e) => setShowFilters((f) => ({ ...f, assignments: e.target.checked }))}
          />
          <span>{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.ASSIGNMENT]} Assignments ({assignments.length})</span>
        </label>
        <label className="course-filter-checkbox">
          <input
            type="checkbox"
            checked={showFilters.quizzes}
            onChange={(e) => setShowFilters((f) => ({ ...f, quizzes: e.target.checked }))}
          />
          <span>{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.QUIZ]} Quizzes ({quizzes.length})</span>
        </label>
      </div>

      {/* Exam cards */}
      {showFilters.exams && (
        <div className="school-section exam-cards-section">
          <div className="school-section-header">
            <div className="school-section-title">
              <span>{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]}</span>
              <span>Exams</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 400 }}>
                ({exams.length})
              </span>
            </div>
            <div className="school-section-actions">
              <button type="button" className="school-btn" onClick={() => handleAddItem(SCHOOL_ITEM_TYPES.EXAM)}>
                + Add Exam
              </button>
            </div>
          </div>
          {exams.length === 0 ? (
            <div className="school-item-empty">
              No exams yet. Click "+ Add Exam" to get started.
            </div>
          ) : (
            <div className="exam-cards-grid">
              {exams.map((exam) => {
                const stats = getExamCardStats(exam);
                const mastery = stats.mastery;
                const progress = computeExamProgress(exam.id);
                const formatDate = (d) => {
                  if (!d) return 'No date';
                  const date = new Date(d + 'T00:00:00');
                  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                };
                const accent = course.color || 'var(--accent)';
                return (
                  <div
                    key={exam.id}
                    className={`exam-card ${exam.done ? 'done' : ''}`}
                    style={{ borderLeft: `4px solid ${accent}` }}
                    onClick={() => handleOpenExam(exam.id)}
                  >
                    <div className="exam-card-header">
                      <input
                        type="checkbox"
                        className="exam-card-checkbox"
                        checked={!!exam.done}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleItemDone(exam.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="exam-card-icon">{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]}</span>
                      <span className="exam-card-title">{exam.text || 'Untitled Exam'}</span>
                      <button
                        type="button"
                        className="exam-card-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(exam.id);
                        }}
                        title="Delete exam"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="exam-card-date">
                      <span>📅</span> {formatDate(exam.date)}
                    </div>

                    <div className="exam-card-counts">
                      <span title="Open assignments tied to this exam">
                        {SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.ASSIGNMENT]} <strong>{stats.assignments}</strong> assignments
                      </span>
                      <span title="Open quizzes tied to this exam">
                        {SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.QUIZ]} <strong>{stats.quizzes}</strong> quizzes
                      </span>
                      <span title="Open homework tied to this exam">
                        {SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.HOMEWORK]} <strong>{stats.homework}</strong> homework
                      </span>
                      <span title="Linked notebooks">
                        📓 <strong>{stats.notebooksLinked}</strong> notebooks
                      </span>
                      {Store.settings.masteryEnabled && (
                        <span title="Total pages including descendants">
                          📄 <strong>{mastery.totalPages}</strong> pages
                        </span>
                      )}
                    </div>

                    {Store.settings.masteryEnabled && mastery.totalPages > 0 && (
                      <div className="exam-card-stats">
                        <div className="exam-card-stat">
                          <span className="exam-card-stat-value">{mastery.score}%</span>
                          <span className="exam-card-stat-label">Mastery</span>
                        </div>
                        {mastery.dueToday > 0 && (
                          <div className="exam-card-stat due">
                            <span className="exam-card-stat-value">{mastery.dueToday}</span>
                            <span className="exam-card-stat-label">Due today</span>
                          </div>
                        )}
                        {mastery.missed > 0 && (
                          <div className="exam-card-stat missed">
                            <span className="exam-card-stat-value">{mastery.missed}</span>
                            <span className="exam-card-stat-label">Missed</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="exam-card-progress">
                      <div className="exam-card-progress-bar">
                        <div className="exam-card-progress-fill" style={{ width: `${progress}%`, background: accent }} />
                      </div>
                      <span className="exam-card-progress-label">{progress}% complete</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Class times */}
      <div className="school-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>🕐</span>
            <span>Class Schedule</span>
          </div>
          <div className="school-section-actions">
            <button type="button" className="school-btn" onClick={handleAddClassTime}>
              + Add time slot
            </button>
          </div>
        </div>
        {(course.classTimes || []).length === 0 ? (
          <div className="class-time-empty">
            No class times set. Add one for each meeting (e.g. MWF lecture, T/Th lab).
          </div>
        ) : (
          <div className="class-time-list">
            {(course.classTimes || []).map((ct) => (
              <div key={ct.id} className="class-time-row">
                <div className="class-time-days">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`class-day-btn ${(ct.days || []).includes(d.id) ? 'active' : ''}`}
                      onClick={() => handleToggleClassDay(ct.id, d.id)}
                      title={d.label}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
                <div className="class-time-times">
                  <input
                    type="time"
                    className="class-time-input"
                    value={ct.start || ''}
                    onChange={(e) => handleUpdateClassTime(ct.id, 'start', e.target.value)}
                  />
                  <span style={{ color: 'var(--text-sub)' }}>–</span>
                  <input
                    type="time"
                    className="class-time-input"
                    value={ct.end || ''}
                    onChange={(e) => handleUpdateClassTime(ct.id, 'end', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="class-time-remove"
                  onClick={() => handleRemoveClassTime(ct.id)}
                  title="Remove"
                >
                  ✕
                </button>
                <div className="class-time-row-bottom">
                  <span className="class-meta-label">From</span>
                  <input
                    type="date"
                    className="class-date-input"
                    value={ct.startDate || ''}
                    onChange={(e) => handleUpdateClassTime(ct.id, 'startDate', e.target.value)}
                    title="Start date"
                  />
                  <span className="class-meta-label">To</span>
                  <input
                    type="date"
                    className="class-date-input"
                    value={ct.endDate || ''}
                    onChange={(e) => handleUpdateClassTime(ct.id, 'endDate', e.target.value)}
                    title="End date"
                  />
                  <span className="class-meta-label">Location</span>
                  <input
                    type="text"
                    className="class-location-input"
                    placeholder="e.g. Room 201"
                    value={ct.location || ''}
                    onChange={(e) => handleUpdateClassTime(ct.id, 'location', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked notebooks */}
      <div className="school-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>📓</span>
            <span>Linked Notebooks</span>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--text-sub)',
              fontWeight: 400
            }}>
              ({linkedPages.length})
            </span>
          </div>
          <div className="school-section-actions">
            <div className="page-picker" ref={pickerRef}>
              <button
                type="button"
                className="school-btn"
                onClick={() => setShowPagePicker((v) => !v)}
              >
                + Add notebook
              </button>
              {showPagePicker && (
                <div className="page-picker-menu">
                  <div className="page-picker-create">
                    <input
                      type="text"
                      className="page-picker-create-input"
                      placeholder="New notebook name..."
                      value={newNotebookName}
                      onChange={(e) => setNewNotebookName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateAndLinkNotebook();
                        if (e.key === 'Escape') setShowPagePicker(false);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="page-picker-create-btn"
                      onClick={handleCreateAndLinkNotebook}
                      title="Create and link new notebook"
                    >
                      + Create
                    </button>
                  </div>
                  <div className="page-picker-divider">Or link existing</div>
                  {availablePages.length === 0 ? (
                    <div className="page-picker-empty">
                      No other notebooks available.
                    </div>
                  ) : (
                    availablePages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="page-picker-item"
                        onClick={() => handleLinkPage(p.id)}
                      >
                        <span>{p.icon || '📄'}</span>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.title || 'Untitled'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {(topics.length > 0 || (hasUntagged && linkedPages.length > 1)) && (
          <div className="notebook-tabs">
            <button
              type="button"
              className={`notebook-tab ${activeTopic === ALL_TOPICS_KEY ? 'active' : ''}`}
              onClick={() => setActiveTopic(ALL_TOPICS_KEY)}
            >
              All <span className="notebook-tab-count">{linkedPages.length}</span>
            </button>
            {topics.map((topic) => {
              const count = linkedPages.filter((p) => getNotebookTopic(course, p.id) === topic).length;
              return (
                <button
                  key={topic}
                  type="button"
                  className={`notebook-tab ${activeTopic === topic ? 'active' : ''}`}
                  onClick={() => setActiveTopic(topic)}
                >
                  {topic} <span className="notebook-tab-count">{count}</span>
                </button>
              );
            })}
            {hasUntagged && (
              <button
                type="button"
                className={`notebook-tab ${activeTopic === NO_TOPIC_KEY ? 'active' : ''}`}
                onClick={() => setActiveTopic(NO_TOPIC_KEY)}
              >
                Untagged <span className="notebook-tab-count">
                  {linkedPages.filter((p) => !getNotebookTopic(course, p.id)).length}
                </span>
              </button>
            )}
          </div>
        )}

        {linkedPages.length === 0 ? (
          <div className="linked-pages-empty">
            No notebooks linked yet. Use "+ Add notebook" to create or link one.
          </div>
        ) : filteredLinkedPages.length === 0 ? (
          <div className="linked-pages-empty">
            No notebooks in this topic.
          </div>
        ) : (
          <div className="linked-notebooks-list">
            {filteredLinkedPages.map((p) => {
              const isExpanded = expandedNotebooks.has(p.id);
              const children = childrenMap.get(p.id) || [];
              const topic = getNotebookTopic(course, p.id);
              const isEditingTopic = editingTopicFor === p.id;
              return (
                <div key={p.id} className="linked-notebook-card">
                  <div className="linked-notebook-header">
                    <button
                      type="button"
                      className={`notebook-expand-toggle ${children.length === 0 ? 'empty' : ''}`}
                      onClick={() => toggleNotebookExpanded(p.id)}
                      title={children.length === 0 ? 'No pages yet' : isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {children.length === 0 ? '·' : isExpanded ? '▾' : '▸'}
                    </button>
                    <span
                      className="linked-notebook-name"
                      onClick={() => onNavigate?.('page', null, null, p.id)}
                      title="Open notebook"
                    >
                      <span className="linked-page-icon">{p.icon || '📓'}</span>
                      <span className="linked-page-name">{p.title || 'Untitled'}</span>
                      <span className="notebook-page-count">
                        {children.length} {children.length === 1 ? 'page' : 'pages'}
                      </span>
                    </span>
                    {isEditingTopic ? (
                      <input
                        type="text"
                        className="notebook-topic-input"
                        value={topicDraft}
                        onChange={(e) => setTopicDraft(e.target.value)}
                        onBlur={commitTopicEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitTopicEdit();
                          if (e.key === 'Escape') cancelTopicEdit();
                        }}
                        placeholder="Topic..."
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className={`notebook-topic-tag ${topic ? 'has-topic' : ''}`}
                        onClick={() => startEditTopic(p.id)}
                        title="Click to set topic"
                      >
                        {topic || '+ Topic'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="notebook-action-btn"
                      onClick={() => handleCreateChildPage(p.id)}
                      title="Add page inside"
                    >
                      + Page
                    </button>
                    <button
                      type="button"
                      className="linked-page-remove"
                      onClick={() => handleUnlinkPage(p.id)}
                      title="Unlink notebook (does not delete pages)"
                    >
                      ✕
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="notebook-page-tree">
                      {children.length === 0 ? (
                        <div className="notebook-page-tree-empty">
                          No pages yet.{' '}
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => handleCreateChildPage(p.id)}
                          >
                            Add the first page
                          </button>
                        </div>
                      ) : (
                        children.map((child) =>
                          renderPageTreeNode(child, 1, childrenMap)
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showFilters.assignments && renderItemList('Assignments', SCHOOL_ITEM_TYPES.ASSIGNMENT, assignments)}
      {showFilters.quizzes && renderItemList('Quizzes', SCHOOL_ITEM_TYPES.QUIZ, quizzes)}
    </div>
  );
}
