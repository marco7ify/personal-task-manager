import { useState } from 'react';
import { Store } from '../../utils/store';
import { TaskRow } from '../TaskRow';
import { applyView, getViewById } from '../../utils/viewConfig';
import '../../styles/View.css';

export function ListView({ 
  items, 
  onToggle, 
  onDelete, 
  onEdit, 
  showProject = false,
  viewId = null,
  onUpdate,
  groupBySubfolder = false,
  showInlineNotes = false,
  showInboxReasons = false
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Get view configuration
  const viewConfig = viewId ? getViewById(viewId) : null;
  
  // Apply view configuration (grouping, sorting, filtering)
  const groups = groupBySubfolder
    ? buildSubfolderGroups(items)
    : (viewConfig
      ? applyView(items, viewConfig).groups
      : applyView(items, { groupBy: 'project', sortBy: 'date', sortOrder: 'asc' }).groups);

  if (items.length === 0) {
    return (
      <div className="tasks-container">
        <div className="empty-state">
          <div>📭</div>
          <div>No items found</div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="tasks-container">
        <div className="empty-state">
          <div>🔍</div>
          <div>No items match the current filters</div>
        </div>
      </div>
    );
  }

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="tasks-container">
      {groups.map(group => (
        <div 
          key={group.key} 
          className={`task-group ${collapsedGroups[group.key] ? 'collapsed' : ''}`}
        >
          <div className="task-group-header" onClick={() => toggleGroup(group.key)}>
            <span className="task-group-toggle">▼</span>
            <span className="task-group-title">{group.label}</span>
            <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>
              ({group.items.length})
            </span>
          </div>
          <div className="task-group-items">
            {group.items.map(item => (
              <TaskRow
                key={item.id || `${item.__baseId}-${item.date}`}
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                showProject={showProject || (viewConfig ? viewConfig.groupBy !== 'project' : false)}
                onUpdate={onUpdate}
                showInlineNotes={showInlineNotes}
                showInboxReasons={showInboxReasons}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildSubfolderGroups(items) {
  const groupsByKey = new Map();

  for (const item of items) {
    const key = item.subfolder ? item.subfolder.trim() : '_none';
    const label = item.subfolder ? `📂 ${item.subfolder.trim()}` : '📂 No subfolder';
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        key,
        label,
        items: []
      });
    }
    groupsByKey.get(key).items.push(item);
  }

  const groups = Array.from(groupsByKey.values());
  groups.sort((a, b) => a.label.localeCompare(b.label));
  groups.forEach(group => {
    group.items.sort((a, b) => {
      const aDate = a.date || '9999-12-31';
      const bDate = b.date || '9999-12-31';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return (a.text || '').localeCompare(b.text || '');
    });
  });
  return groups;
}
