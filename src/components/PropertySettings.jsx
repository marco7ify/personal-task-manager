import { useState } from 'react';
import { Store, PROPERTY_TYPES, ENTITY_TYPES } from '../utils/store';
import { 
  createProperty, 
  updateProperty, 
  deleteProperty, 
  getPropertiesForEntity,
  addPropertyOption,
  updatePropertyOption,
  deletePropertyOption,
  reorderProperties
} from '../utils/properties';
import '../styles/Properties.css';

const PROPERTY_TYPE_OPTIONS = [
  { value: PROPERTY_TYPES.TEXT, label: '📝 Text', description: 'Plain text field' },
  { value: PROPERTY_TYPES.NUMBER, label: '🔢 Number', description: 'Numeric value' },
  { value: PROPERTY_TYPES.DATE, label: '📅 Date', description: 'Date picker' },
  { value: PROPERTY_TYPES.TIME, label: '🕐 Time', description: 'Time picker' },
  { value: PROPERTY_TYPES.SELECT, label: '📋 Select', description: 'Single choice dropdown' },
  { value: PROPERTY_TYPES.MULTI_SELECT, label: '🏷️ Multi-Select', description: 'Multiple choice tags' },
  { value: PROPERTY_TYPES.URL, label: '🔗 URL', description: 'Web link' },
  { value: PROPERTY_TYPES.AI, label: '🤖 AI', description: 'AI-generated content' }
];

const DEFAULT_COLORS = [
  '#FF5555', '#F59E0B', '#45A557', '#2383E2', '#E22383', 
  '#9B59B6', '#1ABC9C', '#34495E', '#E67E22', '#95A5A6'
];

export function PropertySettings({ onClose }) {
  const [activeTab, setActiveTab] = useState(ENTITY_TYPES.TASK);
  const [editingProperty, setEditingProperty] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState(PROPERTY_TYPES.TEXT);

  const properties = getPropertiesForEntity(activeTab);

  const handleCreateProperty = () => {
    if (!newPropertyName.trim()) return;

    const options = {};
    if (newPropertyType === PROPERTY_TYPES.SELECT || newPropertyType === PROPERTY_TYPES.MULTI_SELECT) {
      options.options = [];
    }

    createProperty(newPropertyName.trim(), newPropertyType, activeTab, options);
    setNewPropertyName('');
    setNewPropertyType(PROPERTY_TYPES.TEXT);
    setIsCreating(false);
  };

  const handleDeleteProperty = (propertyId) => {
    if (confirm('Delete this property? All values will be lost.')) {
      deleteProperty(propertyId);
    }
  };

  const handleToggleInline = (property) => {
    updateProperty(property.id, { showInline: !property.showInline });
  };

  const handleUpdatePropertyName = (property, newName) => {
    if (newName.trim() && newName !== property.name) {
      updateProperty(property.id, { name: newName.trim() });
    }
  };

  return (
    <div 
      className="property-settings-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Manage properties"
    >
      <div className="property-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="property-settings-header">
          <h2>Manage Properties</h2>
          <button className="property-settings-close" onClick={onClose}>×</button>
        </div>

        <div className="property-settings-tabs">
          <button 
            className={`property-settings-tab ${activeTab === ENTITY_TYPES.TASK ? 'active' : ''}`}
            onClick={() => setActiveTab(ENTITY_TYPES.TASK)}
          >
            📋 Task Properties
          </button>
          <button 
            className={`property-settings-tab ${activeTab === ENTITY_TYPES.PROJECT ? 'active' : ''}`}
            onClick={() => setActiveTab(ENTITY_TYPES.PROJECT)}
          >
            📁 Project Properties
          </button>
        </div>

        <div className="property-settings-content">
          {/* Property List */}
          <div className="property-settings-list">
            {properties.length === 0 ? (
              <div className="property-settings-empty">
                <p>No custom properties yet.</p>
                <p>Create one to get started!</p>
              </div>
            ) : (
              properties.map(property => (
                <PropertySettingsItem
                  key={property.id}
                  property={property}
                  onDelete={() => handleDeleteProperty(property.id)}
                  onToggleInline={() => handleToggleInline(property)}
                  onUpdateName={(name) => handleUpdatePropertyName(property, name)}
                  isEditing={editingProperty === property.id}
                  onStartEdit={() => setEditingProperty(property.id)}
                  onEndEdit={() => setEditingProperty(null)}
                />
              ))
            )}
          </div>

          {/* Create New Property */}
          {isCreating ? (
            <div className="property-settings-create">
              <div className="property-settings-create-form">
                <input
                  type="text"
                  className="property-settings-input"
                  placeholder="Property name..."
                  value={newPropertyName}
                  onChange={(e) => setNewPropertyName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProperty();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                />
                <select
                  className="property-settings-select"
                  value={newPropertyType}
                  onChange={(e) => setNewPropertyType(e.target.value)}
                >
                  {PROPERTY_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-settings-create-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setIsCreating(false)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleCreateProperty}
                  disabled={!newPropertyName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="property-settings-add-btn"
              onClick={() => setIsCreating(true)}
            >
              + Add Property
            </button>
          )}
        </div>

        <div className="property-settings-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PropertySettingsItem({ property, onDelete, onToggleInline, onUpdateName, isEditing, onStartEdit, onEndEdit }) {
  const [name, setName] = useState(property.name);
  const [showOptions, setShowOptions] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionColor, setNewOptionColor] = useState(DEFAULT_COLORS[0]);

  const typeInfo = PROPERTY_TYPE_OPTIONS.find(t => t.value === property.type);
  const hasOptions = property.type === PROPERTY_TYPES.SELECT || property.type === PROPERTY_TYPES.MULTI_SELECT;

  const handleSaveName = () => {
    onUpdateName(name);
    onEndEdit();
  };

  const handleAddOption = () => {
    if (!newOptionValue.trim()) return;
    addPropertyOption(property.id, newOptionValue.trim(), newOptionColor);
    setNewOptionValue('');
    setNewOptionColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
  };

  const handleDeleteOption = (optionId) => {
    deletePropertyOption(property.id, optionId);
  };

  const handleUpdateOptionColor = (optionId, color) => {
    updatePropertyOption(property.id, optionId, { color });
  };

  return (
    <div className="property-settings-item">
      <div className="property-settings-item-header">
        <div className="property-settings-item-info">
          {isEditing ? (
            <input
              type="text"
              className="property-settings-item-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setName(property.name);
                  onEndEdit();
                }
              }}
              autoFocus
            />
          ) : (
            <span 
              className="property-settings-item-name"
              onClick={onStartEdit}
            >
              {property.name}
            </span>
          )}
          <span className="property-settings-item-type">
            {typeInfo?.label || property.type}
          </span>
        </div>
        <div className="property-settings-item-actions">
          <label className="property-settings-inline-toggle">
            <input
              type="checkbox"
              checked={property.showInline}
              onChange={onToggleInline}
            />
            <span>Show inline</span>
          </label>
          {hasOptions && (
            <button 
              className="property-settings-item-btn"
              onClick={() => setShowOptions(!showOptions)}
              title="Manage options"
            >
              ⚙️
            </button>
          )}
          <button 
            className="property-settings-item-btn property-settings-item-delete"
            onClick={onDelete}
            title="Delete property"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Options Editor for Select/Multi-Select */}
      {hasOptions && showOptions && (
        <div className="property-settings-options">
          <div className="property-settings-options-list">
            {(property.options || []).map(option => (
              <div key={option.id} className="property-settings-option">
                <input
                  type="color"
                  className="property-settings-option-color"
                  value={option.color || '#9B9B9B'}
                  onChange={(e) => handleUpdateOptionColor(option.id, e.target.value)}
                />
                <span 
                  className="property-settings-option-value"
                  style={{ 
                    backgroundColor: `${option.color}20`,
                    color: option.color
                  }}
                >
                  {option.value}
                </span>
                <button 
                  className="property-settings-option-delete"
                  onClick={() => handleDeleteOption(option.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="property-settings-option-add">
            <input
              type="color"
              className="property-settings-option-color"
              value={newOptionColor}
              onChange={(e) => setNewOptionColor(e.target.value)}
            />
            <input
              type="text"
              className="property-settings-option-input"
              placeholder="New option..."
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddOption();
              }}
            />
            <button 
              className="btn btn-sm btn-primary"
              onClick={handleAddOption}
              disabled={!newOptionValue.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
