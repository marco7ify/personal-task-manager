import { useState, useEffect, useRef } from 'react';
import { getViewsForEntity, createView, deleteView } from '../utils/viewConfig';
import { ENTITY_TYPES } from '../utils/store';
import '../styles/ViewConfig.css';

export function ViewSelector({ 
  entityType = ENTITY_TYPES.TASK, 
  currentViewId, 
  onSelectView, 
  onConfigureView 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [views, setViews] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setViews(getViewsForEntity(entityType));
  }, [entityType, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentView = views.find(v => v.id === currentViewId);

  const handleCreateView = () => {
    const name = prompt('Enter view name:');
    if (name?.trim()) {
      const view = createView(name.trim(), { entityType });
      setViews(getViewsForEntity(entityType));
      onSelectView(view.id);
      onConfigureView?.(view.id);
    }
  };

  const handleDeleteView = (e, viewId) => {
    e.stopPropagation();
    if (confirm('Delete this view?')) {
      deleteView(viewId);
      setViews(getViewsForEntity(entityType));
      if (currentViewId === viewId) {
        onSelectView(null);
      }
    }
  };

  return (
    <div className="view-selector-wrapper" ref={wrapperRef}>
      <button 
        className="view-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="view-selector-icon">📊</span>
        <span className="view-selector-label">
          {currentView ? currentView.name : 'Default View'}
        </span>
        <span className="view-selector-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="view-selector-dropdown">
          <div className="view-selector-section">
            <div className="view-selector-section-title">Views</div>
            
            <div 
              className={`view-selector-item ${!currentViewId ? 'active' : ''}`}
              onClick={() => { onSelectView(null); setIsOpen(false); }}
            >
              <span>📋 Default View</span>
            </div>

            {views.map(view => (
              <div 
                key={view.id}
                className={`view-selector-item ${currentViewId === view.id ? 'active' : ''}`}
                onClick={() => { onSelectView(view.id); setIsOpen(false); }}
              >
                <span>{view.name}</span>
                <div className="view-selector-item-actions">
                  <button 
                    className="view-selector-item-btn"
                    onClick={(e) => { e.stopPropagation(); onConfigureView?.(view.id); setIsOpen(false); }}
                    title="Configure"
                  >
                    ⚙️
                  </button>
                  <button 
                    className="view-selector-item-btn view-selector-item-delete"
                    onClick={(e) => handleDeleteView(e, view.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="view-selector-divider" />

          <button 
            className="view-selector-create"
            onClick={handleCreateView}
          >
            + Create New View
          </button>
        </div>
      )}
    </div>
  );
}
