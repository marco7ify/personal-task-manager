import { useState, useEffect } from 'react';
import { Store, ENTITY_TYPES } from '../utils/store';
import { 
  getViewById, 
  updateView, 
  getGroupByOptions, 
  getSortByOptions,
  getFilterOperators
} from '../utils/viewConfig';
import { getPropertiesForEntity, getPropertyById } from '../utils/properties';
import '../styles/ViewConfig.css';

export function ViewConfigModal({ viewId, onClose, onSave }) {
  const [view, setView] = useState(null);
  const [name, setName] = useState('');
  const [groupBy, setGroupBy] = useState('project');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filters, setFilters] = useState([]);

  useEffect(() => {
    const v = getViewById(viewId);
    if (v) {
      setView(v);
      setName(v.name);
      setGroupBy(v.groupBy || 'project');
      setSortBy(v.sortBy || 'date');
      setSortOrder(v.sortOrder || 'asc');
      setFilters(v.filters || []);
    }
  }, [viewId]);

  const handleSave = () => {
    if (!view) return;

    updateView(viewId, {
      name: name.trim(),
      groupBy,
      sortBy,
      sortOrder,
      filters
    });

    onSave?.();
    onClose();
  };

  const handleAddFilter = () => {
    setFilters([
      ...filters,
      { propertyId: 'priority', operator: 'equals', value: '' }
    ]);
  };

  const handleUpdateFilter = (index, updates) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
  };

  const handleRemoveFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  if (!view) return null;

  const entityType = view.entityType || ENTITY_TYPES.TASK;
  const groupByOptions = getGroupByOptions(entityType);
  const sortByOptions = getSortByOptions(entityType);

  return (
    <div 
      className="view-config-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Configure view"
    >
      <div className="view-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="view-config-header">
          <h2>Configure View</h2>
          <button className="view-config-close" onClick={onClose}>×</button>
        </div>

        <div className="view-config-content">
          {/* View Name */}
          <div className="view-config-section">
            <label className="view-config-label">View Name</label>
            <input
              type="text"
              className="view-config-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter view name..."
            />
          </div>

          {/* Group By */}
          <div className="view-config-section">
            <label className="view-config-label">Group By</label>
            <select
              className="view-config-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              {groupByOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="view-config-section">
            <label className="view-config-label">Sort By</label>
            <div className="view-config-sort-row">
              <select
                className="view-config-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortByOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <select
                className="view-config-select view-config-select-small"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">↑ Ascending</option>
                <option value="desc">↓ Descending</option>
              </select>
            </div>
          </div>

          {/* Filters */}
          <div className="view-config-section">
            <label className="view-config-label">Filters</label>
            <div className="view-config-filters">
              {filters.length === 0 ? (
                <div className="view-config-filters-empty">
                  No filters applied
                </div>
              ) : (
                filters.map((filter, index) => (
                  <FilterRow
                    key={index}
                    filter={filter}
                    entityType={entityType}
                    onChange={(updates) => handleUpdateFilter(index, updates)}
                    onRemove={() => handleRemoveFilter(index)}
                  />
                ))
              )}
              <button 
                className="view-config-add-filter"
                onClick={handleAddFilter}
              >
                + Add Filter
              </button>
            </div>
          </div>
        </div>

        <div className="view-config-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save View
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterRow({ filter, entityType, onChange, onRemove }) {
  const fieldOptions = [
    { id: 'priority', label: 'Priority', type: 'select' },
    { id: 'type', label: 'Type', type: 'select' },
    { id: 'done', label: 'Status', type: 'select' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'text', label: 'Name', type: 'text' },
    ...getPropertiesForEntity(entityType).map(p => ({
      id: p.id,
      label: p.name,
      type: p.type
    }))
  ];

  const selectedField = fieldOptions.find(f => f.id === filter.propertyId) || fieldOptions[0];
  const operators = getFilterOperators(selectedField.type);

  const getValueOptions = () => {
    switch (filter.propertyId) {
      case 'priority':
        return [
          { value: 'low', label: '🟢 Low' },
          { value: 'medium', label: '🟡 Medium' },
          { value: 'high', label: '🔴 High' }
        ];
      case 'type':
        return [
          { value: 'task', label: '📋 Task' },
          { value: 'event', label: '📅 Event' }
        ];
      case 'done':
        return [
          { value: 'pending', label: '⏳ Pending' },
          { value: 'done', label: '✅ Done' }
        ];
      default:
        // Check if it's a custom property with options
        if (filter.propertyId.startsWith('prop_')) {
          const propDef = getPropertyById(filter.propertyId);
          if (propDef?.options) {
            return propDef.options.map(o => ({ value: o.id, label: o.value }));
          }
        }
        return null;
    }
  };

  const valueOptions = getValueOptions();
  const needsValueInput = !['is_empty', 'is_not_empty'].includes(filter.operator);

  return (
    <div className="view-config-filter-row">
      <select
        className="view-config-filter-field"
        value={filter.propertyId}
        onChange={(e) => onChange({ propertyId: e.target.value, value: '' })}
      >
        {fieldOptions.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>

      <select
        className="view-config-filter-operator"
        value={filter.operator}
        onChange={(e) => onChange({ operator: e.target.value })}
      >
        {operators.map(op => (
          <option key={op.id} value={op.id}>{op.label}</option>
        ))}
      </select>

      {needsValueInput && (
        valueOptions ? (
          <select
            className="view-config-filter-value"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Select...</option>
            {valueOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={selectedField.type === 'date' ? 'date' : 'text'}
            className="view-config-filter-value"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value..."
          />
        )
      )}

      <button 
        className="view-config-filter-remove"
        onClick={onRemove}
        title="Remove filter"
      >
        ×
      </button>
    </div>
  );
}
