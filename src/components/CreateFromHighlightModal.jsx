import { useEffect, useMemo, useState } from 'react';
import { Store, getToday } from '../utils/store';
import '../styles/Modal.css';
import '../styles/Recurrence.css';
import '../styles/Button.css';
import '../styles/Input.css';

/**
 * Create a task / event from a text highlight inside a page.
 * If `parentItemId` is selected, adds the new entry as a subtask of that item
 * (subtasks store {text, done, sourcePageId?, sourceBlockId?}).
 * Otherwise pushes a standalone item to Store.items with sourcePageId tracking.
 */
export function CreateFromHighlightModal({
  isOpen,
  initialText = '',
  initialType = 'task',
  defaultProjectId = null,
  sourcePageId = null,
  sourceBlockId = null,
  onClose,
  onCreated
}) {
  const forceSubtask = initialType === 'subtask';
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('low');
  const [pid, setPid] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [parentItemId, setParentItemId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = (initialText || '').replace(/\s+/g, ' ').trim();
    setText(trimmed.slice(0, 500));
    setType(initialType === 'event' ? 'event' : 'task');
    setPriority('low');
    setPid(defaultProjectId || '');
    setSubfolder('');
    setParentItemId('');
    setDate('');
    setTime('');
  }, [isOpen, initialText, initialType, defaultProjectId]);

  const projectSubfolders = useMemo(() => {
    if (!pid) return [];
    return Array.from(
      new Set(
        Store.items
          .filter((i) => i.pid === pid && i.subfolder)
          .map((i) => i.subfolder.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [pid, isOpen]);

  /** Parent picker shows in-progress items, optionally narrowed to the selected project */
  const parentCandidates = useMemo(() => {
    let pool = Store.items.filter((i) => !i.archived && !i.done);
    if (pid) pool = pool.filter((i) => i.pid === pid);
    return pool
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 200);
  }, [pid, isOpen]);

  const parentItem = parentItemId
    ? Store.items.find((i) => String(i.id) === String(parentItemId))
    : null;
  const isSubtaskMode = forceSubtask || !!parentItem;

  const resolveNotebookAndPageNames = () => {
    const pages = Array.isArray(Store.pages) ? Store.pages : [];
    const byId = new Map(pages.map((p) => [p.id, p]));
    const currentPage = sourcePageId ? byId.get(sourcePageId) : null;
    if (!currentPage) return null;
    let root = currentPage;
    while (root?.parentId && byId.get(root.parentId)) {
      root = byId.get(root.parentId);
    }
    const notebookName = String(root?.title || '').trim();
    const pageName = String(currentPage?.title || '').trim();
    if (!notebookName || !pageName) return null;
    return { notebookName, pageName };
  };

  const ensureDefaultNotebookProject = () => {
    const names = resolveNotebookAndPageNames();
    if (!names) return { projectId: pid || null, subfolderName: subfolder.trim() || null };
    const { notebookName, pageName } = names;
    let project = Store.projects.find(
      (p) => String(p.name || '').trim().toLowerCase() === notebookName.toLowerCase()
    );
    if (!project) {
      project = {
        id: 'p' + Date.now(),
        name: notebookName,
        icon: '📓',
        color: '#2383E2',
        customProps: {},
        showInboxBadge: Store.settings.defaultShowInboxBadge !== false,
        showTodayBadge: Store.settings.defaultShowTodayBadge !== false
      };
      Store.projects.push(project);
    }
    return { projectId: project.id, subfolderName: pageName };
  };

  const handleSubmit = (useDefaultNotebookPath = false) => {
    const finalText = text.trim();
    if (!finalText) return;
    if (forceSubtask && !parentItem) return;

    if (isSubtaskMode) {
      const parent = Store.items.find((i) => i.id === parentItem.id);
      if (!parent) return;
      const current = Array.isArray(parent.subtasks) ? parent.subtasks : [];
      parent.subtasks = [
        ...current,
        {
          text: finalText,
          done: false,
          sourcePageId: sourcePageId || null,
          sourceBlockId: sourceBlockId || null,
          createdAt: Date.now()
        }
      ];
      Store.save();
      onCreated?.({ kind: 'subtask', parentId: parent.id });
      onClose?.();
      return;
    }

    const defaults = useDefaultNotebookPath ? ensureDefaultNotebookProject() : null;
    const effectivePid = defaults ? defaults.projectId : pid || null;
    const effectiveSubfolder = defaults ? defaults.subfolderName : (pid ? (subfolder.trim() || null) : null);

    const newItem = {
      id: Date.now(),
      text: finalText,
      type,
      priority,
      pid: effectivePid,
      subfolder: effectiveSubfolder,
      date: date || null,
      time: time || null,
      recurrence: 'none',
      recurDetails: null,
      done: false,
      archived: false,
      reschedule: false,
      createdAt: Date.now(),
      subtasks: [],
      sourcePageId: sourcePageId || null,
      sourceBlockId: sourceBlockId || null
    };

    Store.items.push(newItem);
    Store.save();
    onCreated?.({ kind: 'item', itemId: newItem.id });
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay visible"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create from selection"
    >
      <div className="modal create-from-highlight-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            ✨ Create {isSubtaskMode ? 'subtask' : type === 'event' ? 'event' : 'task'} from selection
          </div>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="highlight-source-strip" title="Captured selection">
          <span className="highlight-source-label">From page</span>
          <span className="highlight-source-quote">"{(initialText || '').slice(0, 220)}{(initialText || '').length > 220 ? '…' : ''}"</span>
        </div>

        <div className="modal-grid">
          <div className="full">
            <label htmlFor="cfh-text">Title</label>
            <textarea
              id="cfh-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to happen?"
              autoFocus
            />
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isSubtaskMode}
            >
              <option value="task">📋 Task</option>
              <option value="event">📅 Event</option>
            </select>
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isSubtaskMode}
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
            </select>
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Project</label>
            <select
              value={pid}
              onChange={(e) => {
                setPid(e.target.value);
                setSubfolder('');
                setParentItemId('');
              }}
              disabled={isSubtaskMode}
            >
              <option value="">📁 No Project (Inbox)</option>
              {Store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Subfolder</label>
            <input
              type="text"
              list="cfh-subfolder-options"
              placeholder={pid ? 'e.g. Research' : 'Pick a project first'}
              value={subfolder}
              onChange={(e) => setSubfolder(e.target.value)}
              disabled={!pid || isSubtaskMode}
            />
            <datalist id="cfh-subfolder-options">
              {projectSubfolders.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubtaskMode}
            />
          </div>

          <div className={isSubtaskMode ? 'cfh-disabled' : ''}>
            <label>Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={isSubtaskMode}
            />
          </div>

          <div className={`full ${isSubtaskMode ? 'cfh-disabled' : ''}`}>
            <label>Quick set</label>
            <div className="cfh-quickset">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDate(getToday())}
                disabled={isSubtaskMode}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDate(`${y}-${m}-${day}`);
                }}
                disabled={isSubtaskMode}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setDate('');
                  setTime('');
                }}
                disabled={isSubtaskMode}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="full">
            <label>Add as subtask of (optional)</label>
            <select
              value={parentItemId}
              onChange={(e) => setParentItemId(e.target.value)}
            >
              <option value="">
                {forceSubtask ? '— Select parent task/event —' : '— None (create as standalone) —'}
              </option>
              {parentCandidates.map((it) => {
                const proj = it.pid ? Store.projects.find((p) => p.id === it.pid) : null;
                const projLabel = proj ? `${proj.icon} ${proj.name}` : '📥 No folder';
                const fldr = it.subfolder ? ` / 📂 ${it.subfolder}` : '';
                const typeIcon = it.type === 'event' ? '📅' : '📋';
                return (
                  <option key={it.id} value={it.id}>
                    {typeIcon} {it.text} — {projLabel}{fldr}
                  </option>
                );
              })}
            </select>
            {isSubtaskMode && parentItem && (
              <div className="cfh-subtask-hint">
                Will be added as a subtask of <strong>{parentItem.text}</strong>. Project, folder,
                date, and priority are inherited from the parent.
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!isSubtaskMode && (
            <button
              className="btn btn-secondary"
              onClick={() => handleSubmit(true)}
              disabled={!text.trim()}
              title="Create using Notebook name as Project and Page name as Subfolder"
            >
              Default Add
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => handleSubmit(false)}
            disabled={!text.trim() || (forceSubtask && !parentItem)}
          >
            {isSubtaskMode ? 'Add subtask' : `Create ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
}
