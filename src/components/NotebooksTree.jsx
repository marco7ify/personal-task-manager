import { useState } from 'react';
import { Store } from '../utils/store';
import {
  createPage,
  getChildrenMap,
  getDescendantPageIds
} from '../utils/pages';
import { PAGE_TEMPLATES, createPageFromTemplate } from '../utils/templates';
import { getCoursesLinkedToPage } from '../utils/school';

/**
 * Notion-style sidebar tree of notebooks/pages.
 * Top-level pages act as notebooks. Nested pages create infinite hierarchy.
 */
export function NotebooksTree({
  currentPageId,
  onNavigate,
  onUpdate,
  sectionTitle = 'Notebooks',
  schoolMode = 'all', // 'all' | 'regular' | 'school'
  allowAddRoot = true,
  emptyLabel = '+ New notebook'
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [showRootTemplates, setShowRootTemplates] = useState(false);

  const pages = Array.isArray(Store.pages) ? Store.pages : [];
  const childrenMap = getChildrenMap(pages);
  const allRootPages = childrenMap.get('__root__') || [];
  const rootPages = allRootPages.filter((p) => {
    const isSchoolNotebook = getCoursesLinkedToPage(p.id).length > 0;
    if (schoolMode === 'regular') return !isSchoolNotebook;
    if (schoolMode === 'school') return isSchoolNotebook;
    return true;
  });
  const pageTaskCounts = new Map();

  for (const item of Store.items || []) {
    if (item?.sourcePageId) {
      pageTaskCounts.set(item.sourcePageId, (pageTaskCounts.get(item.sourcePageId) || 0) + 1);
    }
    const subtasks = Array.isArray(item?.subtasks) ? item.subtasks : [];
    for (const subtask of subtasks) {
      if (subtask?.sourcePageId) {
        pageTaskCounts.set(subtask.sourcePageId, (pageTaskCounts.get(subtask.sourcePageId) || 0) + 1);
      }
    }
  }

  const handleAddRoot = () => {
    const page = createPage({ icon: '📓', title: 'New Notebook' });
    Store.pages.push(page);
    Store.save();
    onUpdate?.();
    onNavigate?.('page', null, null, page.id);
  };

  const handleAddChild = (e, parentId) => {
    e.stopPropagation();
    const page = createPage({ parentId });
    Store.pages.push(page);
    const parent = Store.pages.find((p) => p.id === parentId);
    if (parent) parent.expanded = true;
    Store.save();
    onUpdate?.();
    onNavigate?.('page', null, null, page.id);
  };

  const handleAddRootTemplate = (template) => {
    const page = createPageFromTemplate(template);
    Store.pages.push(page);
    Store.save();
    setShowRootTemplates(false);
    onUpdate?.();
    onNavigate?.('page', null, null, page.id);
  };

  const handleToggleExpand = (e, page) => {
    e.stopPropagation();
    page.expanded = !page.expanded;
    Store.save();
    onUpdate?.();
  };

  const handleDelete = (e, page) => {
    e.stopPropagation();
    const descendants = getDescendantPageIds(Store.pages, page.id);
    const total = descendants.length + 1;
    const message =
      total === 1
        ? `Delete "${page.title || 'Untitled'}"? This cannot be undone.`
        : `Delete "${page.title || 'Untitled'}" and ${descendants.length} nested page(s)? This cannot be undone.`;
    if (!confirm(message)) return;
    const idsToRemove = new Set([page.id, ...descendants]);
    Store.pages = Store.pages.filter((p) => !idsToRemove.has(p.id));
    Store.save();
    if (idsToRemove.has(currentPageId)) {
      onNavigate?.('tasks', 'all');
    }
    onUpdate?.();
  };

  const renderPage = (page, depth) => {
    const children = childrenMap.get(page.id) || [];
    const isActive = currentPageId === page.id;
    const isHovered = hoveredId === page.id;
    const expanded = page.expanded !== false;
    const linkedCount = pageTaskCounts.get(page.id) || 0;
    const linkedCourses = depth === 0 ? getCoursesLinkedToPage(page.id) : [];

    return (
      <div key={page.id} className="notebook-tree-node">
        <div
          className={`notebook-tree-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onMouseEnter={() => setHoveredId(page.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onNavigate?.('page', null, null, page.id)}
        >
          <button
            type="button"
            className={`notebook-tree-toggle ${children.length === 0 ? 'empty' : ''}`}
            onClick={(e) => {
              if (children.length === 0) {
                e.stopPropagation();
                return;
              }
              handleToggleExpand(e, page);
            }}
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {children.length === 0 ? '·' : expanded ? '▾' : '▸'}
          </button>
          <span className="notebook-tree-icon">{page.icon || '📄'}</span>
          <span className="notebook-tree-title">
            {page.title || 'Untitled'}
          </span>
          {linkedCount > 0 && (
            <span className="notebook-tree-task-count" title={`${linkedCount} task(s)/event(s) from this page`}>
              T{linkedCount}
            </span>
          )}
          {linkedCourses.length > 0 && (
            <span
              className="notebook-tree-course-badge"
              title={`Linked to: ${linkedCourses.map((c) => c.name || 'Untitled').join(', ')}`}
            >
              {linkedCourses[0].icon || '📚'}
              {linkedCourses.length > 1 ? `+${linkedCourses.length - 1}` : ''}
            </span>
          )}
          {(isHovered || isActive) && (
            <span className="notebook-tree-actions">
              <button
                type="button"
                className="notebook-tree-action"
                onClick={(e) => handleAddChild(e, page.id)}
                title="Add page inside"
              >
                +
              </button>
              <button
                type="button"
                className="notebook-tree-action notebook-tree-action-danger"
                onClick={(e) => handleDelete(e, page)}
                title="Delete page"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {expanded && children.length > 0 && (
          <div className="notebook-tree-children">
            {children.map((child) => renderPage(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="notebook-tree">
      <div className="sidebar-header">
        <span>{sectionTitle}</span>
        {allowAddRoot && (
          <div className="sidebar-header-actions">
            <div className="notebook-template-wrap">
              <button
                className="sidebar-add-btn"
                onClick={() => setShowRootTemplates((value) => !value)}
                title="New notebook from template"
                aria-label="New notebook from template"
              >
                T
              </button>
              {showRootTemplates && (
                <div className="notebook-template-menu">
                  {PAGE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="notebook-template-option"
                      onClick={() => handleAddRootTemplate(template)}
                    >
                      <strong>{template.title}</strong>
                      <span>{template.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="sidebar-add-btn"
              onClick={handleAddRoot}
              title="New notebook"
              aria-label="New notebook"
            >
              +
            </button>
          </div>
        )}
      </div>
      {rootPages.length === 0 && (
        allowAddRoot ? (
          <button
            type="button"
            className="notebook-tree-empty"
            onClick={handleAddRoot}
          >
            {emptyLabel}
          </button>
        ) : (
          <div className="notebook-tree-empty" style={{ cursor: 'default' }}>
            {emptyLabel}
          </div>
        )
      )}
      {rootPages.map((page) => renderPage(page, 0))}
    </div>
  );
}
