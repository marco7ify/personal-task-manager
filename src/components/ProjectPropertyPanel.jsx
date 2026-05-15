import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import { 
  getPropertiesForEntity, 
  PROPERTY_TYPES,
  ENTITY_TYPES 
} from '../utils/properties';
import { PropertyText } from './properties/PropertyText';
import { PropertyNumber } from './properties/PropertyNumber';
import { PropertyDate } from './properties/PropertyDate';
import { PropertyTime } from './properties/PropertyTime';
import { PropertySelect } from './properties/PropertySelect';
import { PropertyMultiSelect } from './properties/PropertyMultiSelect';
import { PropertyURL } from './properties/PropertyURL';
import { PropertyAI } from './properties/PropertyAI';
import '../styles/Properties.css';
import '../styles/Modal.css';

const ICON_OPTIONS = ['📁', '🏠', '💼', '💪', '🎯', '📚', '🎨', '🔧', '💡', '🚀', '⭐', '❤️', '🌟', '📝', '🎮', '🎵', '📷', '✈️', '🍕', '🌈'];
const COLOR_OPTIONS = ['#2383E2', '#E22383', '#45A557', '#F59E0B', '#FF5555', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22', '#95A5A6'];

export function ProjectPropertyPanel({ projectId, onClose, onSave }) {
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#2383E2');
  const [customProps, setCustomProps] = useState({});
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showInboxBadge, setShowInboxBadge] = useState(undefined);
  const [showTodayBadge, setShowTodayBadge] = useState(undefined);

  useEffect(() => {
    if (!projectId) return;
    const foundProject = Store.projects.find(p => p.id === projectId);
    if (!foundProject) return;

    setProject(foundProject);
    setName(foundProject.name || '');
    setIcon(foundProject.icon || '📁');
    setColor(foundProject.color || '#2383E2');
    setCustomProps(foundProject.customProps || {});
    // Badge visibility: undefined means "use global default"
    setShowInboxBadge(
      foundProject.showInboxBadge !== undefined
        ? foundProject.showInboxBadge
        : Store.settings.defaultShowInboxBadge !== false
    );
    setShowTodayBadge(
      foundProject.showTodayBadge !== undefined
        ? foundProject.showTodayBadge
        : Store.settings.defaultShowTodayBadge !== false
    );
  }, [projectId]);

  const handleSave = () => {
    if (!project || !name.trim()) return;

    project.name = name.trim();
    project.icon = icon;
    project.color = color;
    project.customProps = customProps;
    project.showInboxBadge = showInboxBadge;
    project.showTodayBadge = showTodayBadge;

    Store.save();
    onSave?.();
    onClose();
  };

  const handleCustomPropChange = (propertyId, value) => {
    setCustomProps(prev => ({
      ...prev,
      [propertyId]: value
    }));
  };

  const handleDelete = () => {
    if (!confirm('Delete this project and all tasks inside it? This cannot be undone.')) return;

    // Remove all tasks that belong to this project
    Store.items = Store.items.filter((item) => item.pid !== projectId);

    // Remove project
    Store.projects = Store.projects.filter((p) => p.id !== projectId);

    // Clean up stale project references in settings
    Store.settings.viewExcludedProjectIds = (Store.settings.viewExcludedProjectIds || [])
      .filter((id) => id !== projectId);

    Store.save();
    onSave?.();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  const projectProperties = getPropertiesForEntity(ENTITY_TYPES.PROJECT);

  // Calculate project statistics
  const projectStats = project ? {
    total: Store.items.filter(i => i.pid === projectId).length,
    done: Store.items.filter(i => i.pid === projectId && i.done).length,
    pending: Store.items.filter(i => i.pid === projectId && !i.done && !i.archived).length,
    overdue: Store.items.filter(i => {
      if (i.pid !== projectId || i.done || !i.date) return false;
      return new Date(i.date) < new Date(new Date().toISOString().split('T')[0]);
    }).length
  } : { total: 0, done: 0, pending: 0, overdue: 0 };

  const renderPropertyEditor = (propertyDef) => {
    const value = customProps[propertyDef.id];

    switch (propertyDef.type) {
      case PROPERTY_TYPES.TEXT:
        return (
          <PropertyText
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder={`Enter ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.NUMBER:
        return (
          <PropertyNumber
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder={`Enter ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.DATE:
        return (
          <PropertyDate
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
          />
        );

      case PROPERTY_TYPES.TIME:
        return (
          <PropertyTime
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
          />
        );

      case PROPERTY_TYPES.SELECT:
        return (
          <PropertySelect
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            options={propertyDef.options || []}
            placeholder={`Select ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.MULTI_SELECT:
        return (
          <PropertyMultiSelect
            value={value || []}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            options={propertyDef.options || []}
            placeholder={`Select ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.URL:
        return (
          <PropertyURL
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder="https://..."
          />
        );

      case PROPERTY_TYPES.AI:
        return (
          <PropertyAI
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            prompt={propertyDef.aiPrompt}
            context={{ name }}
          />
        );

      default:
        return null;
    }
  };

  if (!project) return null;

  return (
    <div 
      className="property-panel-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Edit project properties"
    >
      <div className="property-panel" onClick={(e) => e.stopPropagation()}>
        <div className="property-panel-header">
          <div className="property-panel-tabs">
            <span className="property-panel-tab active">Project Settings</span>
          </div>
          <button className="property-panel-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>

        <div className="property-panel-content">
          {/* Project Header */}
          <div className="project-panel-header">
            <div className="project-panel-icon-wrapper">
              <button 
                className="project-panel-icon"
                style={{ backgroundColor: `${color}20`, color }}
                onClick={() => setShowIconPicker(!showIconPicker)}
              >
                {icon}
              </button>
              {showIconPicker && (
                <div className="project-panel-picker">
                  {ICON_OPTIONS.map(i => (
                    <button
                      key={i}
                      className={`project-panel-picker-item ${icon === i ? 'active' : ''}`}
                      onClick={() => { setIcon(i); setShowIconPicker(false); }}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              className="project-panel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name..."
            />
          </div>

          {/* Color Picker */}
          <div className="property-panel-section">
            <div className="property-panel-section-title">Color</div>
            <div className="project-panel-colors">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  className={`project-panel-color ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                className="project-panel-color-custom"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Custom color"
              />
            </div>
          </div>

          {/* Sidebar Badges */}
          <div className="property-panel-section">
            <div className="property-panel-section-title">Sidebar badges</div>
            <label className="badge-defaults-row">
              <span className="badge-defaults-icon">📥</span>
              <span className="badge-defaults-label">
                <strong>Inbox badge</strong>
                <span>Unscheduled count. Turns red when new items arrive from global inbox.</span>
              </span>
              <input
                type="checkbox"
                className="badge-defaults-toggle"
                checked={!!showInboxBadge}
                onChange={(e) => setShowInboxBadge(e.target.checked)}
                aria-label="Show inbox badge for this project"
              />
            </label>
            <label className="badge-defaults-row">
              <span className="badge-defaults-icon">❗</span>
              <span className="badge-defaults-label">
                <strong>Today badge</strong>
                <span>Items due today in this project.</span>
              </span>
              <input
                type="checkbox"
                className="badge-defaults-toggle"
                checked={!!showTodayBadge}
                onChange={(e) => setShowTodayBadge(e.target.checked)}
                aria-label="Show today badge for this project"
              />
            </label>
          </div>

          {/* Statistics */}
          <div className="property-panel-section">
            <div className="property-panel-section-title">Statistics</div>
            <div className="project-panel-stats">
              <div className="project-panel-stat">
                <span className="project-panel-stat-value">{projectStats.total}</span>
                <span className="project-panel-stat-label">Total</span>
              </div>
              <div className="project-panel-stat">
                <span className="project-panel-stat-value" style={{ color: 'var(--success)' }}>{projectStats.done}</span>
                <span className="project-panel-stat-label">Done</span>
              </div>
              <div className="project-panel-stat">
                <span className="project-panel-stat-value" style={{ color: 'var(--accent)' }}>{projectStats.pending}</span>
                <span className="project-panel-stat-label">Pending</span>
              </div>
              <div className="project-panel-stat">
                <span className="project-panel-stat-value" style={{ color: 'var(--danger)' }}>{projectStats.overdue}</span>
                <span className="project-panel-stat-label">Overdue</span>
              </div>
            </div>
            {projectStats.total > 0 && (
              <div className="project-panel-progress">
                <div 
                  className="project-panel-progress-bar"
                  style={{ width: `${(projectStats.done / projectStats.total) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Custom Properties */}
          {projectProperties.length > 0 && (
            <div className="property-panel-section">
              <div className="property-panel-section-title">Custom Properties</div>
              {projectProperties.map(prop => (
                <div key={prop.id} className="property-row">
                  <label className="property-label">{prop.name}</label>
                  {renderPropertyEditor(prop)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="property-panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
