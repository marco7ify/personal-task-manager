import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import '../styles/Modal.css';
import '../styles/Button.css';

/**
 * Choose which folders/projects are hidden from global views (All, Today, Week, Month, etc.).
 * Inbox & “No folder assigned” always show all matching tasks.
 */
export function ViewProjectsSettingsModal({ onClose, onSave }) {
  const [hidden, setHidden] = useState(new Set());

  useEffect(() => {
    const ids = Store.settings.viewExcludedProjectIds || [];
    setHidden(new Set(ids));
  }, []);

  const toggle = (projectId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const showAll = () => setHidden(new Set());

  const handleSave = () => {
    Store.settings.viewExcludedProjectIds = Array.from(hidden);
    Store.save();
    onSave?.();
    onClose();
  };

  return (
    <div
      className="modal-overlay visible"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Global view projects"
    >
      <div className="modal view-projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📊 Projects in global views</div>
          <button type="button" className="btn-icon" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <p className="view-projects-intro">
          Checked folders are <strong>hidden</strong> from All Items, Today, Week, Month, Reschedule, Done,
          and Archived when you’re not inside a single project.{' '}
          <strong>Inbox</strong> and <strong>No folder assigned</strong> are unchanged.
        </p>
        <div className="view-projects-actions-top">
          <button type="button" className="btn btn-secondary btn-sm" onClick={showAll}>
            Show all projects
          </button>
        </div>
        <div className="view-projects-list">
          {Store.projects.length === 0 ? (
            <p className="view-projects-empty">No projects yet. Add one under Projects.</p>
          ) : (
            Store.projects.map((p) => (
              <label key={p.id} className="view-projects-row">
                <input
                  type="checkbox"
                  checked={hidden.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span>
                  {p.icon} {p.name}
                </span>
                <span className="view-projects-hint">hidden when checked</span>
              </label>
            ))
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
