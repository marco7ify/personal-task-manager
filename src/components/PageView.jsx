import { useEffect, useMemo, useRef, useState } from 'react';
import { Store } from '../utils/store';
import {
  BLOCK_TYPES,
  createBlock,
  createPage,
  detectMarkdownShortcut,
  getChildrenMap,
  getPageBreadcrumb,
  getDescendantPageIds
} from '../utils/pages';
import { Block } from './Block';
import { SlashMenu } from './SlashMenu';
import { FormattingToolbar } from './FormattingToolbar';
import { CreateFromHighlightModal } from './CreateFromHighlightModal';
import { MasteryBar } from './MasteryBar';
import { getCaretOffset, htmlToPlain, escapeHtml } from '../utils/richText';

const PAGE_ICONS = ['📓', '📄', '📕', '📘', '📗', '📙', '📚', '📒', '📔', '🗂️', '🗒️', '📝', '🧠', '💡', '⭐', '🚀', '🎯', '🔥'];

export function PageView({
  pageId,
  onNavigate,
  onNavigateBack,
  backButtonLabel,
  backButtonIcon,
  onUpdate,
  onOpenItem
}) {
  const [renderTick, setRenderTick] = useState(0);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [slashOpenForBlockId, setSlashOpenForBlockId] = useState(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [createModal, setCreateModal] = useState(null);
  const [tasksCollapsed, setTasksCollapsed] = useState(true);
  const blockRefs = useRef(new Map());
  const tasksSectionRef = useRef(null);

  const page = (Store.pages || []).find((p) => p.id === pageId);

  const childPages = useMemo(() => {
    if (!page) return [];
    const map = getChildrenMap(Store.pages);
    return map.get(page.id) || [];
  }, [page, Store.pages.length]);

  const breadcrumb = useMemo(() => {
    if (!page) return [];
    return getPageBreadcrumb(Store.pages, page.id);
  }, [page]);

  const pageById = useMemo(
    () => new Map((Store.pages || []).map((p) => [p.id, p])),
    [Store.pages, Store.pages.length]
  );

  const descendantPageIds = useMemo(() => {
    if (!page) return [];
    return getDescendantPageIds(Store.pages, page.id);
  }, [page, Store.pages, Store.pages.length]);

  /**
   * Items + subtasks captured from highlights on THIS page.
   * - "items": Store.items where sourcePageId === page.id
   * - "subtasks": flattened {parentItem, subtask, idx} entries whose
   *   subtask.sourcePageId === page.id
   */
  const linkedItems = useMemo(() => {
    if (!page) return { items: [], subtasks: [] };
    const items = (Store.items || []).filter((it) => it.sourcePageId === page.id);
    const subtasks = [];
    for (const parent of Store.items || []) {
      const subs = Array.isArray(parent.subtasks) ? parent.subtasks : [];
      subs.forEach((st, idx) => {
        if (st && st.sourcePageId === page.id) {
          subtasks.push({ parent, subtask: st, idx });
        }
      });
    }
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    subtasks.sort((a, b) => (b.subtask.createdAt || 0) - (a.subtask.createdAt || 0));
    return { items, subtasks };
  }, [page, Store.items.length, Store.items, renderTick]);

  /**
   * Notebook rollup: includes this page + ALL descendants.
   */
  const notebookLinkedItems = useMemo(() => {
    if (!page) return { items: [], subtasks: [] };
    const validPageIds = new Set([page.id, ...descendantPageIds]);
    const items = (Store.items || []).filter(
      (it) => it.sourcePageId && validPageIds.has(it.sourcePageId)
    );
    const subtasks = [];
    for (const parent of Store.items || []) {
      const subs = Array.isArray(parent.subtasks) ? parent.subtasks : [];
      subs.forEach((st, idx) => {
        if (st && st.sourcePageId && validPageIds.has(st.sourcePageId)) {
          subtasks.push({ parent, subtask: st, idx });
        }
      });
    }
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    subtasks.sort((a, b) => (b.subtask.createdAt || 0) - (a.subtask.createdAt || 0));
    return { items, subtasks };
  }, [page, descendantPageIds, Store.items, Store.items.length, renderTick]);

  const hasPageLinkedItems = linkedItems.items.length > 0 || linkedItems.subtasks.length > 0;
  const hasNotebookLinkedItems =
    descendantPageIds.length > 0 &&
    (notebookLinkedItems.items.length > 0 || notebookLinkedItems.subtasks.length > 0);
  const hasAnyLinkedItems = hasPageLinkedItems || hasNotebookLinkedItems;

  useEffect(() => {
    if (!page) return;
    if (!Array.isArray(page.blocks) || page.blocks.length === 0) {
      page.blocks = [createBlock(BLOCK_TYPES.PARAGRAPH)];
      Store.save();
      setRenderTick((n) => n + 1);
    }
  }, [page]);

  useEffect(() => {
    // For both notebooks and pages, keep tasks in the same top collapsible UI.
    setTasksCollapsed(true);
  }, [pageId]);

  if (!page) {
    return (
      <div className="page-view-empty">
        <p>Page not found.</p>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (onNavigateBack && backButtonLabel) onNavigateBack();
            else onNavigate?.('tasks', 'all');
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const persist = () => {
    page.updatedAt = Date.now();
    Store.save();
    onUpdate?.();
    setRenderTick((n) => n + 1);
  };

  const handleTitleChange = (value) => {
    page.title = value;
    persist();
  };

  const handleIconPick = (icon) => {
    page.icon = icon;
    setShowIconPicker(false);
    persist();
  };

  const handleAddSubpage = () => {
    const newPage = createPage({ parentId: page.id });
    Store.pages.push(newPage);
    page.expanded = true;
    Store.save();
    onUpdate?.();
    onNavigate?.('page', null, null, newPage.id);
  };

  const handleBlockTextChange = (blockId, text) => {
    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const isCode = block.type === BLOCK_TYPES.CODE;
    block.text = text;
    const plain = isCode ? text : htmlToPlain(text);

    if (plain.startsWith('/')) {
      setSlashOpenForBlockId(blockId);
      setSlashQuery(plain.slice(1));
    } else if (slashOpenForBlockId === blockId) {
      setSlashOpenForBlockId(null);
      setSlashQuery('');
    }

    const shortcut = !isCode ? detectMarkdownShortcut(plain) : null;
    if (shortcut) {
      block.text = isCode ? shortcut.remaining : escapeHtml(shortcut.remaining);
      block.type = shortcut.type;
      if (shortcut.type === BLOCK_TYPES.TODO && block.checked === undefined) block.checked = false;
      if (shortcut.type === BLOCK_TYPES.CODE && !block.language) block.language = 'plaintext';
      if (shortcut.type === BLOCK_TYPES.CALLOUT && !block.emoji) block.emoji = '💡';
      if (shortcut.type === BLOCK_TYPES.TOGGLE) {
        block.collapsed = false;
        block.body = block.body || '';
      }
      if (shortcut.type === BLOCK_TYPES.DIVIDER) {
        block.text = '';
        const newPara = createBlock(BLOCK_TYPES.PARAGRAPH);
        const idx = page.blocks.findIndex((b) => b.id === blockId);
        page.blocks.splice(idx + 1, 0, newPara);
        setActiveBlockId(newPara.id);
      }
    }

    persist();
  };

  const handleBlockFieldChange = (blockId, field, value) => {
    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) return;
    block[field] = value;
    persist();
  };

  const handleTurnIntoBlock = (blockId, type) => {
    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) return;
    block.type = type;
    if (type === BLOCK_TYPES.TODO && block.checked === undefined) block.checked = false;
    if (type === BLOCK_TYPES.CALLOUT && !block.emoji) block.emoji = '💡';
    if (type === BLOCK_TYPES.TOGGLE) {
      block.collapsed = false;
      block.body = block.body || '';
    }
    if (type === BLOCK_TYPES.DIVIDER) {
      block.text = '';
    }
    persist();
  };

  const handlePickFromSlashMenu = (type) => {
    const blockId = slashOpenForBlockId;
    if (!blockId) return;
    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) return;
    block.type = type;
    block.text = '';
    if (type === BLOCK_TYPES.TODO) block.checked = false;
    if (type === BLOCK_TYPES.CODE && !block.language) block.language = 'plaintext';
    if (type === BLOCK_TYPES.CALLOUT && !block.emoji) block.emoji = '💡';
    if (type === BLOCK_TYPES.TOGGLE) {
      block.collapsed = false;
      block.body = block.body || '';
    }
    if (type === BLOCK_TYPES.DIVIDER) {
      block.text = '';
      const newPara = createBlock(BLOCK_TYPES.PARAGRAPH);
      const idx = page.blocks.findIndex((b) => b.id === blockId);
      page.blocks.splice(idx + 1, 0, newPara);
      setActiveBlockId(newPara.id);
    }
    setSlashOpenForBlockId(null);
    setSlashQuery('');
    persist();
  };

  const focusBlock = (blockId) => {
    setActiveBlockId(blockId);
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(blockId);
      if (!el) return;
      if (typeof el.focus === 'function') {
        el.focus();
        if (typeof el.setSelectionRange === 'function') {
          const len = (el.value || '').length;
          el.setSelectionRange(len, len);
        }
      }
    });
  };

  const insertBlockAfter = (blockId, type = BLOCK_TYPES.PARAGRAPH) => {
    const idx = page.blocks.findIndex((b) => b.id === blockId);
    const newBlock = createBlock(type);
    page.blocks.splice(idx + 1, 0, newBlock);
    persist();
    focusBlock(newBlock.id);
  };

  const removeBlockBackspace = (blockId) => {
    if (page.blocks.length <= 1) {
      const block = page.blocks[0];
      if (block.type !== BLOCK_TYPES.PARAGRAPH) {
        block.type = BLOCK_TYPES.PARAGRAPH;
        persist();
      }
      return;
    }
    const idx = page.blocks.findIndex((b) => b.id === blockId);
    if (idx <= 0) return;
    const previous = page.blocks[idx - 1];
    page.blocks.splice(idx, 1);
    persist();
    focusBlock(previous.id);
  };

  const handleBlockKeyDown = (e, block) => {
    const isCode = block.type === BLOCK_TYPES.CODE;
    const target = e.target;
    const plain = isCode ? (block.text || '') : htmlToPlain(block.text || '');

    const caretInfo = () => {
      if (isCode) {
        return {
          start: typeof target.selectionStart === 'number' ? target.selectionStart : 0,
          end: typeof target.selectionEnd === 'number' ? target.selectionEnd : 0,
          length: (block.text || '').length,
        };
      }
      const offset = getCaretOffset(target);
      return { start: offset, end: offset, length: plain.length };
    };

    if (e.key === 'Enter' && !e.shiftKey && block.type !== BLOCK_TYPES.CODE) {
      if (slashOpenForBlockId === block.id) return;
      e.preventDefault();
      const isList =
        block.type === BLOCK_TYPES.BULLET ||
        block.type === BLOCK_TYPES.NUMBERED ||
        block.type === BLOCK_TYPES.TODO;
      if (isList && !plain) {
        block.type = BLOCK_TYPES.PARAGRAPH;
        persist();
        return;
      }
      const nextType = isList ? block.type : BLOCK_TYPES.PARAGRAPH;
      insertBlockAfter(block.id, nextType);
      return;
    }

    if (e.key === 'Backspace') {
      const { start, end } = caretInfo();
      const isAtStart = start === 0 && end === 0;
      if (isAtStart && plain === '') {
        e.preventDefault();
        removeBlockBackspace(block.id);
        return;
      }
      if (isAtStart && block.type !== BLOCK_TYPES.PARAGRAPH) {
        e.preventDefault();
        block.type = BLOCK_TYPES.PARAGRAPH;
        persist();
        return;
      }
    }

    if (e.key === 'ArrowUp') {
      const idx = page.blocks.findIndex((b) => b.id === block.id);
      const { start } = caretInfo();
      if (idx > 0 && start === 0) {
        e.preventDefault();
        focusBlock(page.blocks[idx - 1].id);
      }
    }

    if (e.key === 'ArrowDown') {
      const idx = page.blocks.findIndex((b) => b.id === block.id);
      const { start, length } = caretInfo();
      if (idx < page.blocks.length - 1 && start >= length) {
        e.preventDefault();
        focusBlock(page.blocks[idx + 1].id);
      }
    }
  };

  const handleCreateFromSelection = ({ text, blockId, type }) => {
    const cleaned = (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    const nextType = type === 'event' ? 'event' : type === 'subtask' ? 'subtask' : 'task';
    setCreateModal({ text: cleaned, blockId: blockId || null, type: nextType });
  };

  const handleToggleLinkedSubtask = (parentId, idx, checked) => {
    const parent = Store.items.find((i) => i.id === parentId);
    if (!parent) return;
    const subs = Array.isArray(parent.subtasks) ? parent.subtasks : [];
    parent.subtasks = subs.map((st, i) => (i === idx ? { ...st, done: checked } : st));
    Store.save();
    onUpdate?.();
    setRenderTick((n) => n + 1);
  };

  const handleToggleLinkedItemDone = (itemId) => {
    const item = Store.items.find((i) => i.id === itemId);
    if (!item) return;
    item.done = !item.done;
    Store.save();
    onUpdate?.();
    setRenderTick((n) => n + 1);
  };

  const formatItemMeta = (item) => {
    const parts = [];
    const proj = item.pid ? Store.projects.find((p) => p.id === item.pid) : null;
    parts.push(proj ? `${proj.icon} ${proj.name}` : '📥 No folder');
    if (item.subfolder) parts.push(`📂 ${item.subfolder}`);
    if (item.date) parts.push(`📅 ${item.date}${item.time ? ` ${item.time}` : ''}`);
    return parts.join(' · ');
  };

  const getSourcePageLabel = (sourcePageId) => {
    if (!sourcePageId) return 'Unknown page';
    const sourcePage = pageById.get(sourcePageId);
    return sourcePage?.title || 'Untitled';
  };

  const renderLinkedSection = ({ title, items, subtasks, includeSourceLabel = false, keyPrefix }) => (
    <div className="page-linked">
      <div className="page-linked-title">
        {title}
        <span className="page-linked-count">{items.length + subtasks.length}</span>
      </div>
      <div className="page-linked-list">
        {items.map((item) => {
          const proj = item.pid ? Store.projects.find((p) => p.id === item.pid) : null;
          const accent = proj?.color || 'var(--accent)';
          return (
            <div
              key={`${keyPrefix}-item-${item.id}`}
              className={`page-linked-row ${item.done ? 'done' : ''}`}
              style={{ borderLeftColor: accent }}
            >
              <input
                type="checkbox"
                className="page-linked-check"
                checked={!!item.done}
                onChange={() => handleToggleLinkedItemDone(item.id)}
                aria-label="Toggle complete"
              />
              <div className="page-linked-body">
                <div className="page-linked-text">
                  <span className="page-linked-type">{item.type === 'event' ? '📅' : '📋'}</span>
                  <span className="page-linked-title-text">{item.text}</span>
                </div>
                <div className="page-linked-meta">
                  {formatItemMeta(item)}
                  {includeSourceLabel ? ` · From: ${getSourcePageLabel(item.sourcePageId)}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="page-linked-open"
                onClick={() => onOpenItem?.(item.id)}
                title="Open details"
              >
                Open
              </button>
            </div>
          );
        })}
        {subtasks.map(({ parent, subtask, idx }) => {
          const proj = parent.pid ? Store.projects.find((p) => p.id === parent.pid) : null;
          const accent = proj?.color || 'var(--accent)';
          return (
            <div
              key={`${keyPrefix}-sub-${parent.id}-${idx}`}
              className={`page-linked-row subtask ${subtask.done ? 'done' : ''}`}
              style={{ borderLeftColor: accent }}
            >
              <input
                type="checkbox"
                className="page-linked-check"
                checked={!!subtask.done}
                onChange={(e) => handleToggleLinkedSubtask(parent.id, idx, e.target.checked)}
                aria-label="Toggle subtask complete"
              />
              <div className="page-linked-body">
                <div className="page-linked-text">
                  <span className="page-linked-type">↳</span>
                  <span className="page-linked-title-text">{subtask.text}</span>
                </div>
                <div className="page-linked-meta">
                  Subtask of <strong>{parent.text}</strong> · {formatItemMeta(parent)}
                  {includeSourceLabel ? ` · From: ${getSourcePageLabel(subtask.sourcePageId)}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="page-linked-open"
                onClick={() => onOpenItem?.(parent.id)}
                title="Open parent task"
              >
                Open parent
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTaskSections = () => {
    if (!hasAnyLinkedItems) return null;
    return (
      <div ref={tasksSectionRef} className="page-linked-sections">
        {hasPageLinkedItems &&
          renderLinkedSection({
            title: '✨ Tasks & events from this page',
            items: linkedItems.items,
            subtasks: linkedItems.subtasks,
            includeSourceLabel: false,
            keyPrefix: 'page',
          })}
        {hasNotebookLinkedItems &&
          renderLinkedSection({
            title: '🧭 Tasks & events in this notebook',
            items: notebookLinkedItems.items,
            subtasks: notebookLinkedItems.subtasks,
            includeSourceLabel: true,
            keyPrefix: 'notebook',
          })}
      </div>
    );
  };

  let numberedCounter = 0;
  const blocksWithMeta = page.blocks.map((b) => {
    if (b.type === BLOCK_TYPES.NUMBERED) {
      numberedCounter += 1;
      return { ...b, __index: numberedCounter };
    }
    numberedCounter = 0;
    return b;
  });

  const fullBreadcrumb = [];
  if (backButtonLabel) {
    fullBreadcrumb.push({
      key: '__ctx__',
      label: backButtonLabel,
      icon: backButtonIcon || '↩',
      onClick: () => onNavigateBack?.()
    });
  }
  if (breadcrumb.length > 1) {
    breadcrumb.slice(0, -1).forEach((p) => {
      fullBreadcrumb.push({
        key: p.id,
        label: p.title || 'Untitled',
        icon: p.icon || '📄',
        onClick: () => onNavigate?.('page', null, null, p.id)
      });
    });
  }

  return (
    <div className="page-view">
      <div className="page-breadcrumb">
        {fullBreadcrumb.map((segment, idx) => (
          <span key={segment.key} className="page-breadcrumb-segment">
            <button
              type="button"
              className="page-breadcrumb-link"
              onClick={segment.onClick}
            >
              {segment.icon} {segment.label}
            </button>
            {idx < fullBreadcrumb.length - 1 && <span className="page-breadcrumb-sep">/</span>}
          </span>
        ))}
      </div>

      <div className="page-header">
        {backButtonLabel && (
          <button
            type="button"
            className="page-back-btn"
            onClick={() => onNavigateBack?.()}
            title={`Back to ${backButtonLabel}`}
          >
            ← {backButtonIcon ? `${backButtonIcon} ` : ''}{backButtonLabel}
          </button>
        )}
        <div className="page-icon-wrapper">
          <button
            type="button"
            className="page-icon"
            onClick={() => setShowIconPicker((v) => !v)}
            title="Change icon"
          >
            {page.icon || '📄'}
          </button>
          {showIconPicker && (
            <div className="page-icon-picker">
              {PAGE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`page-icon-option ${page.icon === icon ? 'active' : ''}`}
                  onClick={() => handleIconPick(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          className="page-title-input"
          value={page.title || ''}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleAddSubpage}
        >
          + Subpage
        </button>
      </div>

      {Store.settings.masteryEnabled && (
        <MasteryBar
          page={page}
          onUpdate={() => {
            setRenderTick((n) => n + 1);
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {hasAnyLinkedItems && (
        <div className="page-tasks-collapsible">
          <button
            type="button"
            className="page-tasks-collapse-toggle"
            onClick={() => setTasksCollapsed((v) => !v)}
            aria-expanded={!tasksCollapsed}
            aria-label={tasksCollapsed ? 'Expand page tasks' : 'Collapse page tasks'}
          >
            <span>{tasksCollapsed ? '▸' : '▾'}</span>
            <span>Tasks &amp; events</span>
            <span className="page-linked-count">
              {(hasPageLinkedItems ? linkedItems.items.length + linkedItems.subtasks.length : 0) +
                (hasNotebookLinkedItems ? notebookLinkedItems.items.length + notebookLinkedItems.subtasks.length : 0)}
            </span>
          </button>
          {!tasksCollapsed && renderTaskSections()}
        </div>
      )}

      <div className="page-blocks">
        {blocksWithMeta.map((block) => (
          <div
            key={block.id}
            className="page-block-wrapper"
            data-block-id={block.id}
          >
            <Block
              block={block}
              ref={(el) => {
                if (el) blockRefs.current.set(block.id, el);
                else blockRefs.current.delete(block.id);
              }}
              autoFocus={activeBlockId === block.id}
              onChange={(value) => handleBlockTextChange(block.id, value)}
              onKeyDown={handleBlockKeyDown}
              onFocus={() => setActiveBlockId(block.id)}
              onUpdateField={(field, value) =>
                handleBlockFieldChange(block.id, field, value)
              }
            />
            {slashOpenForBlockId === block.id && (
              <div className="slash-menu-anchor">
                <SlashMenu
                  query={slashQuery}
                  onPick={handlePickFromSlashMenu}
                  onClose={() => {
                    setSlashOpenForBlockId(null);
                    setSlashQuery('');
                  }}
                />
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          className="page-block-add"
          onClick={() => {
            const last = page.blocks[page.blocks.length - 1];
            insertBlockAfter(last?.id || null);
          }}
        >
          + Add block
        </button>
      </div>

      <FormattingToolbar
        onTurnInto={handleTurnIntoBlock}
        onCreateFromSelection={handleCreateFromSelection}
      />

      {childPages.length > 0 && (
        <div className="page-subpages">
          <div className="page-subpages-title-row">
            <div className="page-subpages-title">Subpages</div>
          </div>
          <div className="page-subpages-list">
            {childPages.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className="page-subpages-item"
                onClick={() => onNavigate?.('page', null, null, sub.id)}
              >
                <span className="page-subpages-icon">{sub.icon || '📄'}</span>
                <span className="page-subpages-name">{sub.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CreateFromHighlightModal
        isOpen={!!createModal}
        initialText={createModal?.text || ''}
        initialType={createModal?.type || 'task'}
        sourcePageId={page.id}
        sourceBlockId={createModal?.blockId || null}
        onClose={() => setCreateModal(null)}
        onCreated={() => {
          onUpdate?.();
          setRenderTick((n) => n + 1);
        }}
      />
    </div>
  );
}
