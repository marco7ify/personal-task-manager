import { useEffect, useRef, useState } from 'react';
import { applyLinkToSelection } from '../utils/richText';
import { BLOCK_TYPES, BLOCK_DEFINITIONS } from '../utils/pages';

const TEXT_COLORS = [
  { id: 'default', label: 'Default', color: null },
  { id: 'gray',    label: 'Gray',    color: '#9ca3af' },
  { id: 'brown',   label: 'Brown',   color: '#a16207' },
  { id: 'orange',  label: 'Orange',  color: '#f59e0b' },
  { id: 'yellow',  label: 'Yellow',  color: '#eab308' },
  { id: 'green',   label: 'Green',   color: '#10b981' },
  { id: 'blue',    label: 'Blue',    color: '#3b82f6' },
  { id: 'purple',  label: 'Purple',  color: '#a855f7' },
  { id: 'pink',    label: 'Pink',    color: '#ec4899' },
  { id: 'red',     label: 'Red',     color: '#ef4444' },
];

const HIGHLIGHT_COLORS = [
  { id: 'h-default', label: 'No background', color: null },
  { id: 'h-gray',    label: 'Gray',     color: '#374151' },
  { id: 'h-brown',   label: 'Brown',    color: '#78350f' },
  { id: 'h-orange',  label: 'Orange',   color: '#7c2d12' },
  { id: 'h-yellow',  label: 'Yellow',   color: '#78350f' },
  { id: 'h-green',   label: 'Green',    color: '#064e3b' },
  { id: 'h-blue',    label: 'Blue',     color: '#1e3a8a' },
  { id: 'h-purple',  label: 'Purple',   color: '#581c87' },
  { id: 'h-pink',    label: 'Pink',     color: '#831843' },
  { id: 'h-red',     label: 'Red',      color: '#7f1d1d' },
];

// "Turn into" target list. Notion-like, but per user request we EXCLUDE
// "Code" and "Block equation" / inline equation.
const TURN_INTO_TARGETS = BLOCK_DEFINITIONS.filter(
  (d) => d.type !== BLOCK_TYPES.CODE && d.type !== BLOCK_TYPES.DIVIDER
);

/**
 * Floating formatting toolbar that follows the current text selection.
 * Activates whenever there is a non-empty selection inside `.page-view`.
 *
 * `onCreateFromSelection({ text, blockId, type })` — when provided, exposes a
 *   "+ Task / + Event / + Subtask" capture action that the parent uses to spawn a
 *   create-from-highlight modal.
 */
export function FormattingToolbar({ containerSelector = '.page-view', onTurnInto, onCreateFromSelection }) {
  const [position, setPosition] = useState(null);
  const [activeStates, setActiveStates] = useState({});
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const savedRangeRef = useRef(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    const handler = () => updatePosition();
    document.addEventListener('selectionchange', handler);
    document.addEventListener('mouseup', handler);
    document.addEventListener('keyup', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      document.removeEventListener('mouseup', handler);
      document.removeEventListener('keyup', handler);
    };
  }, []);

  const updatePosition = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPosition(null);
      setOpenSubmenu(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = document.querySelector(containerSelector);
    if (!container || !container.contains(range.commonAncestorContainer)) {
      // Selection isn't inside the page editor → keep toolbar as-is if a
      // submenu is open (so clicking a submenu button doesn't dismiss it),
      // otherwise hide.
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        return;
      }
      setPosition(null);
      setOpenSubmenu(null);
      return;
    }

    const editable = findClosest(range.startContainer, '[contenteditable="true"]');
    if (!editable) {
      setPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    savedRangeRef.current = range.cloneRange();

    setPosition({
      top: rect.top + window.scrollY - 48,
      left: rect.left + window.scrollX + rect.width / 2,
    });

    setActiveStates({
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: queryState('underline'),
      strikethrough: queryState('strikeThrough'),
    });
  };

  const restoreSelection = () => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const exec = (command, value = null) => {
    restoreSelection();
    document.execCommand(command, false, value);
    triggerInput();
    updatePosition();
  };

  const triggerInput = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const editable = findClosest(sel.getRangeAt(0).startContainer, '[contenteditable="true"]');
    if (!editable) return;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const handleLink = () => {
    const savedRange = savedRangeRef.current?.cloneRange();
    const url = window.prompt('Enter URL:', 'https://');
    if (!url) return;
    if (savedRange) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }
    applyLinkToSelection(url);
    triggerInput();
    updatePosition();
  };

  const handleClearLink = () => {
    exec('unlink');
  };

  const handleColor = (color) => {
    if (color === null) {
      exec('foreColor', 'inherit');
    } else {
      exec('foreColor', color);
    }
    setOpenSubmenu(null);
  };

  const handleHighlight = (color) => {
    if (color === null) {
      exec('hiliteColor', 'transparent');
    } else {
      exec('hiliteColor', color);
    }
    setOpenSubmenu(null);
  };

  const handleTurnInto = (type) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const editable = findClosest(sel.getRangeAt(0).startContainer, '[contenteditable="true"]');
    if (!editable) return;
    const wrapper = editable.closest('[data-block-id]');
    if (!wrapper) return;
    const blockId = wrapper.getAttribute('data-block-id');
    if (!blockId) return;
    onTurnInto?.(blockId, type);
    setOpenSubmenu(null);
    setPosition(null);
  };

  const handleDelete = () => {
    exec('delete');
  };

  const handleCreateFromSelection = (type) => {
    if (!onCreateFromSelection) return;
    const range = savedRangeRef.current;
    if (!range) return;
    const text = range.toString();
    if (!text || !text.trim()) return;
    const editable = findClosest(range.startContainer, '[contenteditable="true"]');
    const wrapper = editable ? editable.closest('[data-block-id]') : null;
    const blockId = wrapper?.getAttribute('data-block-id') || null;
    onCreateFromSelection({ text, blockId, type });
    setOpenSubmenu(null);
    setPosition(null);
  };

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      className="formatting-toolbar"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="formatting-toolbar-row">
        <button
          type="button"
          className="ft-btn ft-turn-into"
          onClick={() => setOpenSubmenu(openSubmenu === 'turn' ? null : 'turn')}
          title="Turn into"
        >
          <span className="ft-turn-into-label">Text</span>
          <span className="ft-caret">▾</span>
        </button>
        <span className="ft-divider" />
        <button
          type="button"
          className={`ft-btn ${activeStates.bold ? 'active' : ''}`}
          onClick={() => exec('bold')}
          title="Bold"
        ><b>B</b></button>
        <button
          type="button"
          className={`ft-btn ${activeStates.italic ? 'active' : ''}`}
          onClick={() => exec('italic')}
          title="Italic"
        ><i>I</i></button>
        <button
          type="button"
          className={`ft-btn ${activeStates.underline ? 'active' : ''}`}
          onClick={() => exec('underline')}
          title="Underline"
        ><u>U</u></button>
        <button
          type="button"
          className={`ft-btn ${activeStates.strikethrough ? 'active' : ''}`}
          onClick={() => exec('strikeThrough')}
          title="Strikethrough"
        ><s>S</s></button>
        <span className="ft-divider" />
        <button
          type="button"
          className="ft-btn"
          onClick={handleLink}
          title="Link"
        >🔗</button>
        <button
          type="button"
          className="ft-btn"
          onClick={handleClearLink}
          title="Remove link"
        >⛓️‍💥</button>
        <span className="ft-divider" />
        <button
          type="button"
          className="ft-btn ft-color-trigger"
          onClick={() => setOpenSubmenu(openSubmenu === 'color' ? null : 'color')}
          title="Color"
        >
          <span className="ft-color-letter">A</span>
          <span className="ft-caret">▾</span>
        </button>
        {onCreateFromSelection && (
          <>
            <span className="ft-divider" />
            <button
              type="button"
              className="ft-btn ft-create"
              onClick={() => handleCreateFromSelection('task')}
              title="Create task from selection"
            >
              <span className="ft-create-icon">＋</span>
              <span className="ft-create-label">Task</span>
            </button>
            <button
              type="button"
              className="ft-btn ft-create"
              onClick={() => handleCreateFromSelection('event')}
              title="Create event from selection"
            >
              <span className="ft-create-icon">📅</span>
              <span className="ft-create-label">Event</span>
            </button>
            <button
              type="button"
              className="ft-btn ft-create"
              onClick={() => handleCreateFromSelection('subtask')}
              title="Create subtask from selection"
            >
              <span className="ft-create-icon">↳</span>
              <span className="ft-create-label">Subtask</span>
            </button>
          </>
        )}
        <span className="ft-divider" />
        <button
          type="button"
          className="ft-btn"
          onClick={handleDelete}
          title="Delete"
        >🗑️</button>
      </div>

      {openSubmenu === 'turn' && (
        <div className="formatting-toolbar-submenu">
          <div className="ft-submenu-title">Turn into</div>
          {TURN_INTO_TARGETS.map((def) => (
            <button
              key={def.type}
              type="button"
              className="ft-submenu-item"
              onClick={() => handleTurnInto(def.type)}
            >
              <span className="ft-submenu-icon">{def.icon}</span>
              <span className="ft-submenu-label">{def.label}</span>
            </button>
          ))}
        </div>
      )}

      {openSubmenu === 'color' && (
        <div className="formatting-toolbar-submenu">
          <div className="ft-submenu-title">Text color</div>
          {TEXT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ft-submenu-item"
              onClick={() => handleColor(c.color)}
            >
              <span
                className="ft-color-swatch"
                style={c.color ? { color: c.color } : { color: 'inherit' }}
              >A</span>
              <span className="ft-submenu-label">{c.label} text</span>
            </button>
          ))}
          <div className="ft-submenu-divider" />
          <div className="ft-submenu-title">Background</div>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ft-submenu-item"
              onClick={() => handleHighlight(c.color)}
            >
              <span
                className="ft-color-swatch"
                style={c.color ? { backgroundColor: c.color } : { backgroundColor: 'transparent', border: '1px solid var(--border)' }}
              >A</span>
              <span className="ft-submenu-label">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function queryState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function findClosest(node, selector) {
  let el = node;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentNode;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    if (el.matches?.(selector)) return el;
    el = el.parentNode;
  }
  return null;
}
