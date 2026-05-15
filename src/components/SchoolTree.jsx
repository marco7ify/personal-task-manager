import { useState } from 'react';
import { Store, getToday, getWeekEnd } from '../utils/store';
import {
  getCourses,
  getSemesters,
  getCoursesBySemester,
  getCourseItemsByType,
  buildNewCourse,
  UNASSIGNED_SEMESTER_ID,
  SCHOOL_ITEM_TYPES,
  SCHOOL_ITEM_ICONS
} from '../utils/school';
import { SemesterModal } from './SemesterModal';

/**
 * Sidebar "School" section: lists courses, expandable to show
 * upcoming exams. Mirrors the UX of NotebooksTree.
 */
export function SchoolTree({
  currentView,
  currentCourseId,
  currentExamId,
  currentSemesterId,
  onNavigate,
  onUpdate
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [editingSemesterId, setEditingSemesterId] = useState(null);
  const [semesterModalMode, setSemesterModalMode] = useState(null);

  const courses = getCourses();
  const semesters = getSemesters();
  const unassignedCourses = getCoursesBySemester(null);
  const today = getToday();
  const weekEnd = getWeekEnd();

  const handleAddCourse = (semesterId = null) => {
    const course = buildNewCourse({
      semesterId: semesterId === UNASSIGNED_SEMESTER_ID ? null : semesterId
    });
    Store.projects.push(course);
    Store.save();
    onUpdate?.();
    onNavigate?.('course', null, course.id);
  };

  const handleAddSemester = () => {
    setEditingSemesterId(null);
    setSemesterModalMode('add');
  };

  const handleEditSemester = (e, semesterId) => {
    e.stopPropagation();
    setEditingSemesterId(semesterId);
    setSemesterModalMode('edit');
  };

  const closeSemesterModal = () => {
    setEditingSemesterId(null);
    setSemesterModalMode(null);
  };

  const toggleExpanded = (e, id) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteCourse = (e, course) => {
    e.stopPropagation();
    const itemCount = (Store.items || []).filter((i) => i.pid === course.id).length;
    const msg =
      itemCount > 0
        ? `Delete course "${course.name}" and unlink ${itemCount} item(s)?`
        : `Delete course "${course.name}"?`;
    if (!confirm(msg)) return;

    Store.projects = Store.projects.filter((p) => p.id !== course.id);
    Store.items = (Store.items || []).filter((i) => i.pid !== course.id);
    Store.save();
    if (currentCourseId === course.id) onNavigate?.('tasks', 'all');
    onUpdate?.();
  };

  const renderCourse = (course, depth = 1) => {
    const expanded = expandedIds.has(course.id);
    const isActive =
      (currentView === 'course' && currentCourseId === course.id) ||
      (currentView === 'examDetail' && currentCourseId === course.id);
    const isHovered = hoveredId === course.id;

    const exams = getCourseItemsByType(course.id, SCHOOL_ITEM_TYPES.EXAM)
      .slice()
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

    const upcoming = exams.filter(
      (e) => !e.done && e.date && e.date >= today && e.date <= weekEnd
    ).length;

    return (
      <div key={course.id}>
        <div
          className={`school-tree-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => onNavigate?.('course', null, course.id)}
          onMouseEnter={() => setHoveredId(course.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <button
            type="button"
            className={`school-tree-toggle ${exams.length === 0 ? 'empty' : ''}`}
            onClick={(e) => {
              if (exams.length === 0) {
                e.stopPropagation();
                return;
              }
              toggleExpanded(e, course.id);
            }}
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse exams' : 'Expand exams'}
          >
            {exams.length === 0 ? '·' : expanded ? '▾' : '▸'}
          </button>
          <span className="school-tree-icon">{course.icon || '📚'}</span>
          <span className="school-tree-title">{course.name || 'Untitled course'}</span>
          {upcoming > 0 && (
            <span
              className="school-tree-badge upcoming"
              title={`${upcoming} exam(s) this week`}
            >
              ⚠ {upcoming}
            </span>
          )}
          {isHovered && (
            <button
              type="button"
              className="school-tree-toggle"
              onClick={(e) => handleDeleteCourse(e, course)}
              title="Delete course"
              aria-label="Delete course"
              style={{ color: 'var(--text-sub)' }}
            >
              ✕
            </button>
          )}
        </div>

        {expanded && exams.length > 0 && (
          <div className="school-tree-children">
            {exams.map((exam) => {
              const isExamActive =
                currentView === 'examDetail' && currentExamId === exam.id;
              return (
                <div
                  key={exam.id}
                  className={`school-tree-subrow ${isExamActive ? 'active' : ''}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onNavigate?.('examDetail', null, course.id, null, exam.id);
                  }}
                  title={exam.text}
                >
                  <span className="school-tree-subrow-icon">
                    {SCHOOL_ITEM_ICONS[SCHOOL_ITEM_TYPES.EXAM]}
                  </span>
                  <span className="school-tree-subrow-title">
                    {exam.text || 'Untitled exam'}
                  </span>
                  {exam.date && (
                    <span className="school-tree-subrow-date">{exam.date.slice(5)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSemester = (semester) => {
    const semesterId = semester?.id || UNASSIGNED_SEMESTER_ID;
    const isUnassigned = semesterId === UNASSIGNED_SEMESTER_ID;
    const semesterCourses = isUnassigned
      ? unassignedCourses
      : getCoursesBySemester(semesterId);
    if (isUnassigned && semesterCourses.length === 0) return null;

    const expanded = expandedIds.has(semesterId);
    const activeCourseInSemester = semesterCourses.some((c) => c.id === currentCourseId);
    const isActiveSemester =
      currentView === 'semester' &&
      ((isUnassigned && (currentSemesterId === UNASSIGNED_SEMESTER_ID || !currentSemesterId)) ||
        (!isUnassigned && currentSemesterId === semesterId));
    const rowClass = [
      'school-tree-row',
      'school-semester-row',
      isUnassigned ? 'unassigned-folder' : '',
      isActiveSemester ? 'active' : '',
      !isActiveSemester && activeCourseInSemester ? 'active-parent' : ''
    ].filter(Boolean).join(' ');

    return (
      <div key={semesterId}>
        <div
          className={rowClass}
          onClick={() => onNavigate?.('semester', null, semesterId)}
          onMouseEnter={() => setHoveredId(semesterId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <button
            type="button"
            className={`school-tree-toggle ${semesterCourses.length === 0 ? 'empty' : ''}`}
            onClick={(e) => toggleExpanded(e, semesterId)}
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse semester' : 'Expand semester'}
          >
            {semesterCourses.length === 0 ? '·' : expanded ? '▾' : '▸'}
          </button>
          <span className="school-tree-icon">{isUnassigned ? '📭' : '📚'}</span>
          <span className="school-tree-title">
            {isUnassigned ? 'Unassigned' : semester.name || 'Untitled Semester'}
          </span>
          {!isUnassigned && hoveredId === semesterId && (
            <button
              type="button"
              className="school-tree-toggle"
              onClick={(e) => handleEditSemester(e, semesterId)}
              title="Edit semester"
              aria-label="Edit semester"
            >
              ⚙
            </button>
          )}
          <button
            type="button"
            className="school-tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              handleAddCourse(semesterId);
            }}
            title="Add course"
            aria-label="Add course"
          >
            +
          </button>
        </div>
        {expanded && semesterCourses.length > 0 && (
          <div className="school-tree-children school-semester-children">
            {semesterCourses.map((course) => renderCourse(course, 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="school-tree">
      <div className="sidebar-header">
        <span>🎓 School</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-add-btn"
            onClick={handleAddSemester}
            title="Add semester"
            aria-label="Add semester"
          >
            +
          </button>
        </div>
      </div>
      {courses.length === 0 && (
        <button
          type="button"
          className="school-tree-empty"
          onClick={handleAddSemester}
        >
          + Add your first semester
        </button>
      )}
      {renderSemester({ id: UNASSIGNED_SEMESTER_ID })}
      {semesters.map((semester) => renderSemester(semester))}

      {semesterModalMode && (
        <SemesterModal
          semesterId={editingSemesterId}
          mode={semesterModalMode}
          onClose={closeSemesterModal}
          onSave={() => {
            closeSemesterModal();
            onUpdate?.();
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
