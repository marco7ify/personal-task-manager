import { useEffect, useState } from 'react';
import { Store, getToday } from '../utils/store';
import { getInlineProperties, getPropertyValue, setPropertyValue, getOption, PROPERTY_TYPES, ENTITY_TYPES } from '../utils/properties';
import '../styles/Task.css';

export function TaskRow({
  item,
  onToggle,
  onDelete,
  onEdit,
  showProject = false,
  onUpdate,
  showInlineNotes = false,
  showInboxReasons = false
}) {
  const project = item.pid ? Store.projects.find(p => p.id === item.pid) : null;
  const accentColor = item.type === 'event'
    ? 'var(--event-color)'
    : (project?.color || 'var(--border)');

  const isVirtual = !!item.__virtual;
  const inlineProperties = getInlineProperties(ENTITY_TYPES.TASK);
  const noteText = String(item.customProps?.prop_notes || item.notes || '').trim();
  const notePreview = noteText.replace(/\s+/g, ' ');
  const noteTitle = notePreview.length > 160
    ? `Notes: ${notePreview.slice(0, 160)}...`
    : `Notes: ${notePreview}`;

  const getDueBadge = () => {
    if (!item.date || item.done) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(item.date + 'T00:00:00');
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="task-badge badge-overdue">⚠️ Overdue {Math.abs(diffDays)}d</span>;
    }
    if (diffDays === 0) {
      return <span className="task-badge badge-today">📍 Today</span>;
    }
    if (diffDays === 1) {
      return <span className="task-badge">📅 Tomorrow</span>;
    }
    return <span className="task-badge">📅 {diffDays}d</span>;
  };

  const renderCustomPropertyBadge = (propertyDef) => {
    if (propertyDef.id === 'prop_notes') {
      return null;
    }

    const value = item.customProps?.[propertyDef.id];
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return null;
    }

    switch (propertyDef.type) {
      case PROPERTY_TYPES.SELECT: {
        const option = getOption(propertyDef, value);
        if (!option) return null;
        return (
          <span 
            key={propertyDef.id}
            className="task-badge task-badge-custom"
            style={{ 
              backgroundColor: option.color ? `${option.color}20` : undefined,
              color: option.color || undefined
            }}
            title={propertyDef.name}
          >
            {option.value}
          </span>
        );
      }

      case PROPERTY_TYPES.MULTI_SELECT: {
        if (!Array.isArray(value) || value.length === 0) return null;
        return value.map(v => {
          const option = getOption(propertyDef, v);
          if (!option) return null;
          return (
            <span 
              key={`${propertyDef.id}-${v}`}
              className="task-badge task-badge-custom"
              style={{ 
                backgroundColor: option.color ? `${option.color}20` : undefined,
                color: option.color || undefined
              }}
              title={propertyDef.name}
            >
              {option.value}
            </span>
          );
        });
      }

      case PROPERTY_TYPES.URL: {
        return (
          <a 
            key={propertyDef.id}
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="task-badge task-badge-link"
            title={propertyDef.name}
            onClick={(e) => e.stopPropagation()}
          >
            🔗 Link
          </a>
        );
      }

      case PROPERTY_TYPES.TEXT:
      case PROPERTY_TYPES.NUMBER: {
        return (
          <span 
            key={propertyDef.id}
            className="task-badge task-badge-custom"
            title={propertyDef.name}
          >
            {value}
          </span>
        );
      }

      case PROPERTY_TYPES.DATE: {
        return (
          <span 
            key={propertyDef.id}
            className="task-badge task-badge-custom"
            title={propertyDef.name}
          >
            📅 {value}
          </span>
        );
      }

      case PROPERTY_TYPES.TIME: {
        return (
          <span 
            key={propertyDef.id}
            className="task-badge task-badge-custom"
            title={propertyDef.name}
          >
            🕐 {value}
          </span>
        );
      }

      default:
        return null;
    }
  };

  const priority = item.priority || 'low';
  const subtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
  const doneSubtasks = subtasks.filter((st) => st.done).length;
  const inboxReasons = showInboxReasons ? getInboxReasonBadges(item, subtasks) : [];
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [notesPopupOpen, setNotesPopupOpen] = useState(false);

  useEffect(() => {
    if (!notesPopupOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setNotesPopupOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notesPopupOpen]);

  const handleAddSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    const task = Store.items.find(i => i.id === item.id);
    if (!task) return;
    const current = Array.isArray(task.subtasks) ? task.subtasks : [];
    task.subtasks = [...current, { text, done: false }];
    Store.save();
    setNewSubtask('');
    setShowInlineAdd(false);
    setSubtasksExpanded(true);
    onUpdate?.();
  };

  const handleToggleSubtask = (idx, checked) => {
    const task = Store.items.find(i => i.id === item.id);
    if (!task) return;
    const current = Array.isArray(task.subtasks) ? task.subtasks : [];
    task.subtasks = current.map((st, i) => (i === idx ? { ...st, done: checked } : st));
    Store.save();
    onUpdate?.();
  };

  const handleDeleteSubtask = (idx) => {
    const task = Store.items.find(i => i.id === item.id);
    if (!task) return;
    const current = Array.isArray(task.subtasks) ? task.subtasks : [];
    task.subtasks = current.filter((_, i) => i !== idx);
    Store.save();
    onUpdate?.();
  };

  return (
    <div
      className={`task-row prio-${priority} ${item.type === 'event' ? 'is-event' : ''} ${item.done ? 'done' : ''}`}
      style={{ '--row-accent': accentColor }}
      data-id={item.id}
      data-virtual={isVirtual ? '1' : undefined}
    >
      {item.type === 'task' ? (
        <div
          className="task-checkbox"
          onClick={() => onToggle(item.id, isVirtual ? item.__baseId : null, isVirtual ? item.date : null)}
          role="checkbox"
          aria-checked={item.done}
          aria-label={`Mark "${item.text}" as ${item.done ? 'incomplete' : 'complete'}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle(item.id, isVirtual ? item.__baseId : null, isVirtual ? item.date : null);
            }
          }}
        >
          {item.done ? '✓' : ''}
        </div>
      ) : (
        <div className="event-indicator" />
      )}

      <div className="task-content">
        <input
          type="text"
          className="task-text"
          value={item.text}
          readOnly={isVirtual}
          onChange={(e) => {
            if (!isVirtual) {
              const task = Store.items.find(i => i.id === item.id);
              if (task) {
                task.text = e.target.value;
                Store.save();
                onUpdate?.();
              }
            }
          }}
        />
        <div className="task-badges">
          <span className={`task-badge badge-${priority}`}>{priority}</span>
          {getDueBadge()}
          {item.recurrence && item.recurrence !== 'none' && (
            <span className="task-badge">🔁 {item.recurrence}</span>
          )}
          {item.time && <span className="task-badge">🕐 {item.time}</span>}
          {noteText && (
            <button
              type="button"
              className="task-badge task-badge-note"
              title={noteTitle}
              onClick={(e) => {
                e.stopPropagation();
                setNotesPopupOpen(true);
              }}
            >
              Note
            </button>
          )}
          {inboxReasons.map((reason) => (
            <span
              key={reason.label}
              className={`task-badge task-inbox-reason tone-${reason.tone}`}
              title={reason.title}
            >
              {reason.label}
            </span>
          ))}
          {showProject && (project || !showInboxReasons) && (
            <span className="task-badge" title={project ? project.name : 'No folder'}>
              {project ? `${project.icon} ${project.name}` : '📥 No folder'}
            </span>
          )}
          {item.subfolder && (
            <span className="task-badge" title="Project subfolder">
              📂 {item.subfolder}
            </span>
          )}
          {subtasks.length > 0 && (
            <>
              <span className="task-badge" title="Subtasks progress">
                ☑ {doneSubtasks}/{subtasks.length}
              </span>
              <button
                type="button"
                className="task-subtasks-toggle"
                onClick={() => setSubtasksExpanded((v) => !v)}
                title={subtasksExpanded ? 'Hide subtasks' : 'Show subtasks'}
              >
                {subtasksExpanded ? '▾ Subtasks' : `▸ ${subtasks.length} subtasks`}
              </button>
            </>
          )}
          {/* Custom property badges */}
          {inlineProperties.map(prop => renderCustomPropertyBadge(prop))}
        </div>
        {showInlineNotes && noteText && (
          <div className="task-inline-note">
            {noteText}
          </div>
        )}
        {(subtasks.length > 0 && subtasksExpanded) && (
          <div className="task-subtasks">
            {subtasks.map((st, idx) => (
              <div key={`subtask-${idx}`} className="task-subtask-item">
                <input
                  type="checkbox"
                  checked={!!st.done}
                  onChange={(e) => handleToggleSubtask(idx, e.target.checked)}
                  disabled={isVirtual}
                />
                <span className={`task-subtask-text ${st.done ? 'done' : ''}`}>
                  {st.text}
                </span>
                {!isVirtual && (
                  <button
                    type="button"
                    className="task-subtask-remove"
                    title="Remove subtask"
                    onClick={() => handleDeleteSubtask(idx)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {showInlineAdd && !isVirtual && (
          <div className="task-subtask-inline-add">
            <input
              type="text"
              className="task-control"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
                if (e.key === 'Escape') {
                  setShowInlineAdd(false);
                  setNewSubtask('');
                }
              }}
              placeholder="Add subtask..."
              autoFocus
            />
            <button type="button" className="task-edit" onClick={handleAddSubtask}>
              Add
            </button>
            <button
              type="button"
              className="task-delete"
              onClick={() => {
                setShowInlineAdd(false);
                setNewSubtask('');
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {!isVirtual && (
        <div className="task-controls">
          <select
            className="task-control"
            value={priority}
            onChange={(e) => {
              const task = Store.items.find(i => i.id === item.id);
              if (task) {
                task.priority = e.target.value;
                Store.save();
                onUpdate?.();
              }
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            className="task-control"
            value={item.date || ''}
            onChange={(e) => {
              const task = Store.items.find(i => i.id === item.id);
              if (task) {
                task.date = e.target.value || null;
                Store.save();
                onUpdate?.();
              }
            }}
          />
          <input
            type="time"
            className="task-control"
            value={item.time || ''}
            style={{ width: '90px' }}
            onChange={(e) => {
              const task = Store.items.find(i => i.id === item.id);
              if (task) {
                task.time = e.target.value || null;
                Store.save();
                onUpdate?.();
              }
            }}
          />
          <button className="task-edit" onClick={() => onEdit(item.id)} title="Edit">
            ✏️
          </button>
          <button
            className="task-subtask-add"
            onClick={() => {
              setShowInlineAdd((v) => !v);
              setSubtasksExpanded(true);
            }}
            title="Quick add subtask"
          >
            ☑+
          </button>
          <button className="task-delete" onClick={() => onDelete(item.id)} title="Delete">
            🗑
          </button>
        </div>
      )}

      {notesPopupOpen && (
        <div className="task-note-popup-overlay" onClick={() => setNotesPopupOpen(false)}>
          <div className="task-note-popup" onClick={(e) => e.stopPropagation()}>
            <div className="task-note-popup-header">
              <div>
                <div className="task-note-popup-label">Notes</div>
                <div className="task-note-popup-title">{item.text}</div>
              </div>
              <button
                type="button"
                className="task-note-popup-close"
                onClick={() => setNotesPopupOpen(false)}
                aria-label="Close notes"
              >
                x
              </button>
            </div>
            <div className="task-note-popup-body">{noteText}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function getInboxReasonBadges(item, subtasks) {
  const badges = [];
  const metadata = item.customProps?.prop_ai_intake || {};
  const confidence = Number(metadata.confidence);
  const matchedRules = Array.isArray(metadata.matchedRuleIds) ? metadata.matchedRuleIds : [];
  const text = [
    item.text,
    item.notes,
    item.customProps?.prop_notes,
    item.subfolder,
    ...subtasks.map((subtask) => subtask.text)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!item.pid) {
    badges.push({
      label: 'No project',
      tone: 'warning',
      title: 'Assign a project to route this item out of the global inbox.'
    });
  }

  if (!item.date) {
    badges.push({
      label: 'No date',
      tone: 'warning',
      title: 'Schedule this item or leave it intentionally in the backlog.'
    });
  }

  const aiRule = matchedRules.find((rule) =>
    ['job_application', 'interview', 'appointment', 'exam', 'notebook_idea', 'task'].includes(rule)
  );
  if (aiRule) {
    badges.push({
      label: `AI: ${formatAiRuleLabel(aiRule)}`,
      tone: 'ai',
      title: 'AI Intake matched this routing rule when the item was created.'
    });
  } else if (looksLikeJobLead(text)) {
    badges.push({
      label: 'AI: Job',
      tone: 'ai',
      title: 'This item looks like a job, application, interview, or recruiter follow-up.'
    });
  }

  if (Number.isFinite(confidence) && confidence > 0 && confidence < 0.65) {
    badges.push({
      label: 'Low confidence',
      tone: 'danger',
      title: 'AI Intake had low confidence in its classification. Review the destination.'
    });
  } else if (!item.pid && !item.date && !aiRule) {
    badges.push({
      label: 'Needs review',
      tone: 'neutral',
      title: 'Choose a project, date, or destination to clear this item from the inbox.'
    });
  }

  if ((looksLikeJobLead(text) || aiRule === 'job_application' || aiRule === 'interview') && !item.date) {
    badges.push({
      label: 'Missing follow-up',
      tone: 'danger',
      title: 'Job-related inbox items should usually have a follow-up date.'
    });
  }

  if (subtasks.length > 0) {
    badges.push({
      label: `Has ${subtasks.length} subtasks`,
      tone: 'neutral',
      title: 'This inbox item already has child work attached.'
    });
  }

  return dedupeBadges(badges);
}

function looksLikeJobLead(text) {
  return /\b(job|apply|application|resume|recruiter|interview|hiring|position|role|company|hospital|rn|nurse|linkedin)\b/.test(text);
}

function formatAiRuleLabel(rule) {
  const labels = {
    job_application: 'Job',
    interview: 'Interview',
    appointment: 'Event',
    exam: 'Exam',
    notebook_idea: 'Note',
    task: 'Task'
  };
  return labels[rule] || rule;
}

function dedupeBadges(badges) {
  const seen = new Set();
  return badges.filter((badge) => {
    if (seen.has(badge.label)) return false;
    seen.add(badge.label);
    return true;
  });
}
