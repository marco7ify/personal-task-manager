import { useState } from 'react';
import { Store } from '../utils/store';
import { buildNewSemester, getCoursesBySemester, getSemesterById } from '../utils/school';

export function SemesterModal({ semesterId, mode = 'add', onClose, onSave, onNavigate }) {
  const semester = mode === 'edit' ? getSemesterById(semesterId) : null;
  const [name, setName] = useState(semester?.name || '');

  const isEdit = mode === 'edit';
  const courseCount = isEdit ? getCoursesBySemester(semesterId).length : 0;

  const handleSave = () => {
    const nextName = name.trim();
    if (!nextName) return;

    if (isEdit && semester) {
      semester.name = nextName;
    } else {
      const newSemester = buildNewSemester(nextName);
      Store.semesters.push(newSemester);
    }

    Store.save();
    onSave?.();
  };

  const handleDelete = () => {
    if (!isEdit || !semester) return;

    const message = courseCount > 0
      ? `Delete "${semester.name}"? ${courseCount} course(s) will move to Unassigned.`
      : `Delete "${semester.name}"?`;
    if (!confirm(message)) return;

    Store.semesters = (Store.semesters || []).filter((s) => s.id !== semester.id);
    Store.projects = (Store.projects || []).map((project) => {
      if (project.kind === 'course' && project.semesterId === semester.id) {
        return { ...project, semesterId: null };
      }
      return project;
    });
    Store.save();
    onSave?.();
    onNavigate?.('tasks', 'all');
  };

  if (isEdit && !semester) {
    return (
      <div className="semester-modal-backdrop" onMouseDown={onClose}>
        <div className="semester-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="semester-modal-header">
            <h2>Semester not found</h2>
            <button type="button" className="semester-modal-close" onClick={onClose}>x</button>
          </div>
          <p className="semester-modal-help">This semester may have been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="semester-modal-backdrop" onMouseDown={onClose}>
      <div className="semester-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="semester-modal-header">
          <h2>{isEdit ? 'Edit Semester' : 'Add Semester'}</h2>
          <button type="button" className="semester-modal-close" onClick={onClose}>x</button>
        </div>

        <label className="semester-modal-label" htmlFor="semester-name">
          Semester name
        </label>
        <input
          id="semester-name"
          type="text"
          className="semester-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose?.();
          }}
          placeholder="e.g. Fall 2026"
          autoFocus
        />

        {isEdit && (
          <p className="semester-modal-help">
            {courseCount === 0
              ? 'No courses are assigned to this semester.'
              : `${courseCount} course(s) are assigned to this semester.`}
          </p>
        )}

        <div className="semester-modal-actions">
          {isEdit && (
            <button
              type="button"
              className="school-btn semester-modal-danger"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <span className="semester-modal-spacer" />
          <button type="button" className="school-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="school-btn primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
