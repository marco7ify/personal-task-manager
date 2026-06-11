import { useState, useEffect, useRef, useMemo } from 'react';
import { Store, formatLocalYMD } from '../utils/store';
import {
  getCourseById,
  getExamById,
  getExamSubItems,
  computeExamProgress,
  buildNewSchoolItem,
  SCHOOL_ITEM_TYPES,
  SCHOOL_ITEM_LABELS,
  SCHOOL_ITEM_ICONS
} from '../utils/school';
import { StudySection } from './StudySection';
import { collectPagesForScope, getMasteryBreakdown } from '../utils/mastery';
import { createPage } from '../utils/pages';

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalYMD(d);
}

function daysBetween(startYMD, endYMD) {
  const start = new Date(`${startYMD}T00:00:00`).getTime();
  const end = new Date(`${endYMD}T00:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

function uniquePlanDates(todayYMD, examDate, targetCount) {
  const daysUntil = daysBetween(todayYMD, examDate);
  if (!examDate || daysUntil <= 0) return [];
  const usableDays = Math.max(1, daysUntil - 1);
  const count = Math.min(targetCount, usableDays);
  const dates = new Set();
  for (let i = 1; i <= count; i += 1) {
    const offset = Math.max(0, Math.round((usableDays * i) / count) - 1);
    dates.add(addDays(todayYMD, offset));
  }
  return Array.from(dates).sort();
}

export function ExamView({ examId, courseId, onNavigate, onUpdate, onOpenItemPanel }) {
  const exam = getExamById(examId);
  const course = getCourseById(courseId || exam?.pid);
  const [, forceRender] = useState(0);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [newSubType, setNewSubType] = useState(SCHOOL_ITEM_TYPES.HOMEWORK);
  const [newNotebookName, setNewNotebookName] = useState('');
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

  if (!exam) {
    return (
      <div className="page-view-empty">
        <p>Exam not found.</p>
        <button className="btn btn-secondary" onClick={() => onNavigate?.('tasks', 'all')}>
          ← Back
        </button>
      </div>
    );
  }

  if (!exam.examMeta || typeof exam.examMeta !== 'object') {
    exam.examMeta = { studyGuide: '', linkedPageIds: [] };
  }

  const persist = () => {
    Store.save();
    onUpdate?.();
    forceRender((n) => n + 1);
  };

  const setField = (key, value) => {
    exam[key] = value;
    persist();
  };

  const setMeta = (key, value) => {
    exam.examMeta = { ...exam.examMeta, [key]: value };
    persist();
  };

  const handleAddSub = () => {
    const item = buildNewSchoolItem({
      courseId: exam.pid,
      type: newSubType,
      text: `New ${SCHOOL_ITEM_LABELS[newSubType]}`,
      parentExamId: exam.id
    });
    Store.items.push(item);
    persist();
  };

  const handleToggleSub = (id) => {
    const it = Store.items.find((x) => x.id === id);
    if (!it) return;
    it.done = !it.done;
    persist();
  };

  const handleUpdateSub = (id, key, value) => {
    const it = Store.items.find((x) => x.id === id);
    if (!it) return;
    it[key] = value || null;
    persist();
  };

  const handleDeleteSub = (id) => {
    if (!confirm('Delete this study item?')) return;
    Store.items = Store.items.filter((x) => x.id !== id);
    persist();
  };

  const handleGenerateStudyPlan = () => {
    if (!exam.date) {
      alert('Set an exam date before generating a study plan.');
      return;
    }

    const today = formatLocalYMD(new Date());
    const daysUntil = daysBetween(today, exam.date);
    if (daysUntil <= 0) {
      alert('The exam date needs to be in the future.');
      return;
    }

    const pages = collectPagesForScope({ rootPageIds: exam.examMeta.linkedPageIds || [] });
    const mastery = getMasteryBreakdown(pages, today, {
      ignoreUntracked: Store.settings.masteryIgnoreUntracked
    });
    const openExisting = getExamSubItems(exam.id).filter((item) => !item.done).length;
    const weakPages = [
      ...mastery.buckets.missed,
      ...mastery.buckets.dueToday,
      ...mastery.buckets.notStarted
    ];
    const desiredSessions =
      mastery.totalPages === 0
        ? 3
        : mastery.score < 40
          ? 5
          : mastery.score < 70
            ? 4
            : 3;
    const dates = uniquePlanDates(today, exam.date, Math.max(2, desiredSessions));
    if (dates.length === 0) return;

    Store.items = Store.items.filter(
      (item) => !(item.parentExamId === exam.id && item.customProps?.studyPlanGenerated)
    );

    dates.forEach((date, index) => {
      const weakPage = weakPages[index % Math.max(weakPages.length, 1)];
      const focus = weakPage?.title
        ? `Review ${weakPage.title}`
        : index === dates.length - 1
          ? 'Final mixed review'
          : 'Study exam topics';
      Store.items.push({
        id: Date.now() + index + Math.floor(Math.random() * 1000),
        text: `${focus} for ${exam.text || 'exam'}`,
        type: SCHOOL_ITEM_TYPES.STUDY_SESSION,
        priority: index >= dates.length - 2 || mastery.score < 50 ? 'high' : 'medium',
        pid: exam.pid || courseId || null,
        date,
        time: null,
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        parentExamId: exam.id,
        createdAt: Date.now(),
        customProps: {
          studyPlanGenerated: true,
          prop_notes: [
            `Generated for ${exam.text || 'this exam'}.`,
            mastery.totalPages > 0 ? `Mastery score at generation: ${mastery.score}%.` : '',
            openExisting > 0 ? `${openExisting} open exam task(s) existed when this was generated.` : ''
          ].filter(Boolean).join(' ')
        }
      });
    });

    persist();
  };

  const handleCreateAndLinkNotebook = () => {
    const name = newNotebookName.trim() || 'New Notebook';
    const page = createPage({ icon: '📓', title: name });
    if (!Array.isArray(Store.pages)) Store.pages = [];
    Store.pages.push(page);
    setMeta('linkedPageIds', [...(exam.examMeta.linkedPageIds || []), page.id]);
    setNewNotebookName('');
    setShowPagePicker(false);
  };

  const handleLinkPage = (pageId) => {
    if (!pageId) return;
    const ids = exam.examMeta.linkedPageIds || [];
    if (ids.includes(pageId)) return;
    setMeta('linkedPageIds', [...ids, pageId]);
    setShowPagePicker(false);
  };

  const handleUnlinkPage = (pageId) => {
    setMeta(
      'linkedPageIds',
      (exam.examMeta.linkedPageIds || []).filter((id) => id !== pageId)
    );
  };

  const subItems = getExamSubItems(exam.id);
  const progress = computeExamProgress(exam.id);
  const linkedPages = (exam.examMeta.linkedPageIds || [])
    .map((id) => (Store.pages || []).find((p) => p.id === id))
    .filter(Boolean);
  const availablePages = (Store.pages || []).filter(
    (p) => !(exam.examMeta.linkedPageIds || []).includes(p.id)
  );

  const studyPages = useMemo(() => {
    return collectPagesForScope({ rootPageIds: exam.examMeta.linkedPageIds || [] });
  }, [exam.examMeta.linkedPageIds, Store.pages]);

  const doneCount = subItems.filter((s) => s.done).length;
  const generatedStudyCount = subItems.filter((s) => s.customProps?.studyPlanGenerated).length;

  return (
    <div className="exam-view">
      <div className="exam-breadcrumb">
        <button
          type="button"
          className="exam-breadcrumb-link"
          onClick={() => onNavigate?.('tasks', 'all')}
        >
          🎓 School
        </button>
        <span style={{ opacity: 0.5 }}> / </span>
        {course && (
          <>
            <button
              type="button"
              className="exam-breadcrumb-link"
              onClick={() => onNavigate?.('course', null, course.id)}
            >
              {course.icon} {course.name}
            </button>
            <span style={{ opacity: 0.5 }}> / </span>
          </>
        )}
        <span>{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]} Exam</span>
      </div>

      <div className="exam-header">
        <div className="exam-icon">{SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]}</div>
        <input
          type="text"
          className="exam-title-input"
          value={exam.text || ''}
          onChange={(e) => setField('text', e.target.value)}
          placeholder="Untitled exam"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            course
              ? onNavigate?.('course', null, course.id)
              : onNavigate?.('tasks', 'all')
          }
        >
          ← Back
        </button>
      </div>

      <div className="exam-meta-row">
        <div className="course-meta-item" style={{ minWidth: 180 }}>
          <span className="course-meta-label">Exam Date</span>
          <input
            type="date"
            className="course-text-input"
            value={exam.date || ''}
            onChange={(e) => setField('date', e.target.value)}
          />
        </div>
        <div className="course-meta-item" style={{ minWidth: 140 }}>
          <span className="course-meta-label">Time</span>
          <input
            type="time"
            className="course-text-input"
            value={exam.time || ''}
            onChange={(e) => setField('time', e.target.value)}
          />
        </div>
        <div className="course-meta-item" style={{ minWidth: 140 }}>
          <span className="course-meta-label">Priority</span>
          <select
            className="course-status-select"
            value={exam.priority || 'high'}
            onChange={(e) => setField('priority', e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="exam-progress-wrap">
          <span className="course-meta-label">Study Progress</span>
          <div className="exam-progress-bar">
            <div
              className="exam-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="exam-progress-label">
            <span>{doneCount} of {subItems.length} complete</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Study / Mastery section */}
      {Store.settings.masteryEnabled && (
        <div className="school-section">
          <div className="school-section-header">
            <div className="school-section-title">
              <span>🎯</span>
              <span>Study Progress</span>
            </div>
          </div>
          <StudySection
            pages={studyPages}
            onOpenPage={(pageId) => onNavigate?.('page', null, null, pageId)}
            onUpdate={() => {
              forceRender((n) => n + 1);
              if (onUpdate) onUpdate();
            }}
          />
        </div>
      )}

      {/* Study guide */}
      <div className="school-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>📝</span>
            <span>Study Guide</span>
          </div>
        </div>
        <textarea
          className="exam-study-guide"
          value={exam.examMeta.studyGuide || ''}
          onChange={(e) => setMeta('studyGuide', e.target.value)}
          placeholder="Outline topics to review, key formulas, chapters, practice problems…"
        />
      </div>

      <div className="school-section study-planner-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>Study</span>
            <span>Study Planner</span>
          </div>
          <div className="school-section-actions">
            <button
              type="button"
              className="school-btn primary"
              onClick={handleGenerateStudyPlan}
            >
              Generate study plan
            </button>
          </div>
        </div>
        <div className="study-planner-grid">
          <div>
            <span className="study-planner-label">Exam date</span>
            <strong>{exam.date || 'Set a date first'}</strong>
          </div>
          <div>
            <span className="study-planner-label">Linked pages</span>
            <strong>{studyPages.length}</strong>
          </div>
          <div>
            <span className="study-planner-label">Generated sessions</span>
            <strong>{generatedStudyCount}</strong>
          </div>
        </div>
      </div>

      {/* Linked notebooks */}
      <div className="school-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>📓</span>
            <span>Linked Notebooks</span>
          </div>
          <div className="school-section-actions">
            <div className="page-picker" ref={pickerRef}>
              <button
                type="button"
                className="school-btn"
                onClick={() => setShowPagePicker((v) => !v)}
              >
                + Link notebook
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
                      }}
                    />
                    <button
                      type="button"
                      className="school-btn primary"
                      onClick={handleCreateAndLinkNotebook}
                    >
                      + Create
                    </button>
                  </div>
                  <div className="page-picker-divider">or link existing</div>
                  {availablePages.length === 0 ? (
                    <div className="page-picker-empty">
                      No notebooks available.
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
                          flex: 1, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
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
        {linkedPages.length === 0 ? (
          <div className="linked-pages-empty">
            No notebooks linked. Use "+ Link notebook" to attach study notes.
          </div>
        ) : (
          <div className="linked-pages-grid">
            {linkedPages.map((p) => (
              <div key={p.id} className="linked-page-card">
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => onNavigate?.('page', null, null, p.id)}
                >
                  <span className="linked-page-icon">{p.icon || '📄'}</span>
                  <span className="linked-page-name">{p.title || 'Untitled'}</span>
                </span>
                <button
                  type="button"
                  className="linked-page-remove"
                  onClick={() => handleUnlinkPage(p.id)}
                  title="Unlink"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Homework / assignments / study tasks */}
      <div className="school-section">
        <div className="school-section-header">
          <div className="school-section-title">
            <span>✅</span>
            <span>Homework & Study Tasks</span>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--text-sub)',
              fontWeight: 400
            }}>
              ({subItems.length})
            </span>
          </div>
          <div className="school-section-actions">
            <select
              className="school-btn"
              value={newSubType}
              onChange={(e) => setNewSubType(e.target.value)}
              style={{ paddingRight: 24 }}
            >
              <option value={SCHOOL_ITEM_TYPES.HOMEWORK}>Homework</option>
              <option value={SCHOOL_ITEM_TYPES.ASSIGNMENT}>Assignment</option>
              <option value={SCHOOL_ITEM_TYPES.QUIZ}>Practice Quiz</option>
              <option value={SCHOOL_ITEM_TYPES.STUDY_SESSION}>Study Session</option>
            </select>
            <button
              type="button"
              className="school-btn primary"
              onClick={handleAddSub}
            >
              + Add
            </button>
          </div>
        </div>
        {subItems.length === 0 ? (
          <div className="school-item-empty">
            No tasks yet. Add homework, practice problems, or anything you need to complete before this exam.
          </div>
        ) : (
          <div className="school-item-list">
            {subItems
              .slice()
              .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
              .map((it) => (
                <div key={it.id} className={`school-item-row ${it.done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    className="school-item-checkbox"
                    checked={!!it.done}
                    onChange={() => handleToggleSub(it.id)}
                  />
                  <span className="school-item-icon">
                    {SCHOOL_ITEM_ICONS[it.type] || '📒'}
                  </span>
                  <input
                    type="text"
                    className="school-item-text"
                    value={it.text || ''}
                    onChange={(e) => handleUpdateSub(it.id, 'text', e.target.value)}
                    placeholder={`Untitled ${SCHOOL_ITEM_LABELS[it.type] || 'task'}`}
                  />
                  <div className="school-item-meta">
                    <input
                      type="date"
                      className="school-item-date-input"
                      value={it.date || ''}
                      onChange={(e) => handleUpdateSub(it.id, 'date', e.target.value)}
                      title="Due date"
                    />
                    <button
                      type="button"
                      className="school-item-open"
                      onClick={() => onOpenItemPanel?.(it.id)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="school-item-delete"
                      onClick={() => handleDeleteSub(it.id)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
