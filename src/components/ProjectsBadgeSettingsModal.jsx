import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import '../styles/Modal.css';
import '../styles/Button.css';

/**
 * Global defaults: which sidebar badges are shown for all newly created projects.
 * Each project can override these in its own ⚙️ settings.
 */
export function ProjectsBadgeSettingsModal({ onClose, onSave }) {
  const [showInbox, setShowInbox] = useState(true);
  const [showToday, setShowToday] = useState(true);

  useEffect(() => {
    setShowInbox(Store.settings.defaultShowInboxBadge !== false);
    setShowToday(Store.settings.defaultShowTodayBadge !== false);
  }, []);

  const handleSave = () => {
    Store.settings.defaultShowInboxBadge = showInbox;
    Store.settings.defaultShowTodayBadge = showToday;
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
      aria-label="Project badge defaults"
    >
      <div className="modal project-badge-defaults-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🏷 Project badge defaults</div>
          <button type="button" className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="badge-defaults-intro">
            Choose which badges appear next to every project name in the sidebar.
            These are the <strong>defaults for new projects</strong>. Open a project's ⚙️ to override per-project.
          </p>

          <label className="badge-defaults-row">
            <span className="badge-defaults-icon">📥</span>
            <span className="badge-defaults-label">
              <strong>Inbox badge</strong>
              <span>Unscheduled items count. Turns red when a new item arrives from the global inbox.</span>
            </span>
            <input
              type="checkbox"
              className="badge-defaults-toggle"
              checked={showInbox}
              onChange={(e) => setShowInbox(e.target.checked)}
              aria-label="Show inbox badge by default"
            />
          </label>

          <label className="badge-defaults-row">
            <span className="badge-defaults-icon">❗</span>
            <span className="badge-defaults-label">
              <strong>Today badge</strong>
              <span>Number of items due today in this project.</span>
            </span>
            <input
              type="checkbox"
              className="badge-defaults-toggle"
              checked={showToday}
              onChange={(e) => setShowToday(e.target.checked)}
              aria-label="Show today badge by default"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Save defaults</button>
        </div>
      </div>
    </div>
  );
}
