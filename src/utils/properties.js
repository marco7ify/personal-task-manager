import { Store, PROPERTY_TYPES, ENTITY_TYPES } from './store';

/**
 * Generate a unique property ID
 */
export function generatePropertyId() {
  return 'prop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

/**
 * Generate a unique option ID for select/multi-select
 */
export function generateOptionId() {
  return 'opt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

/**
 * Create a new property definition
 * @param {string} name - Property name
 * @param {string} type - Property type (from PROPERTY_TYPES)
 * @param {string} entityType - Entity type ('task' or 'project')
 * @param {Object} options - Additional options (options array for select types, etc.)
 * @returns {Object} The created property definition
 */
export function createProperty(name, type, entityType, options = {}) {
  const id = generatePropertyId();
  const maxOrder = Store.propertyDefs
    .filter(p => p.entityType === entityType)
    .reduce((max, p) => Math.max(max, p.order || 0), -1);

  const propertyDef = {
    id,
    name: name.trim(),
    type,
    entityType,
    options: options.options || [],
    aiPrompt: options.aiPrompt || '',
    defaultValue: getDefaultValueForType(type),
    showInline: options.showInline !== undefined ? options.showInline : true,
    order: maxOrder + 1,
    createdAt: Date.now()
  };

  Store.propertyDefs.push(propertyDef);
  Store.save();
  return propertyDef;
}

/**
 * Get default value for a property type
 */
export function getDefaultValueForType(type) {
  switch (type) {
    case PROPERTY_TYPES.TEXT:
    case PROPERTY_TYPES.URL:
    case PROPERTY_TYPES.AI:
      return '';
    case PROPERTY_TYPES.NUMBER:
      return null;
    case PROPERTY_TYPES.DATE:
    case PROPERTY_TYPES.TIME:
    case PROPERTY_TYPES.SELECT:
      return null;
    case PROPERTY_TYPES.MULTI_SELECT:
      return [];
    default:
      return null;
  }
}

/**
 * Update a property definition
 * @param {string} id - Property ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated property or null if not found
 */
export function updateProperty(id, updates) {
  const index = Store.propertyDefs.findIndex(p => p.id === id);
  if (index === -1) return null;

  // Don't allow changing type if property has values
  if (updates.type && updates.type !== Store.propertyDefs[index].type) {
    const hasValues = checkPropertyHasValues(id);
    if (hasValues) {
      console.warn('Cannot change property type when values exist');
      delete updates.type;
    }
  }

  Store.propertyDefs[index] = {
    ...Store.propertyDefs[index],
    ...updates,
    updatedAt: Date.now()
  };

  Store.save();
  return Store.propertyDefs[index];
}

/**
 * Delete a property definition and remove all values
 * @param {string} id - Property ID
 * @returns {boolean} Success
 */
export function deleteProperty(id) {
  const index = Store.propertyDefs.findIndex(p => p.id === id);
  if (index === -1) return false;

  const propertyDef = Store.propertyDefs[index];

  // Remove property values from all items
  if (propertyDef.entityType === ENTITY_TYPES.TASK) {
    Store.items.forEach(item => {
      if (item.customProps && item.customProps[id] !== undefined) {
        delete item.customProps[id];
      }
    });
  } else if (propertyDef.entityType === ENTITY_TYPES.PROJECT) {
    Store.projects.forEach(project => {
      if (project.customProps && project.customProps[id] !== undefined) {
        delete project.customProps[id];
      }
    });
  }

  // Remove property definition
  Store.propertyDefs.splice(index, 1);
  Store.save();
  return true;
}

/**
 * Get all properties for an entity type
 * @param {string} entityType - 'task' or 'project'
 * @returns {Array} Property definitions sorted by order
 */
export function getPropertiesForEntity(entityType) {
  return Store.propertyDefs
    .filter(p => p.entityType === entityType)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get a property definition by ID
 * @param {string} id - Property ID
 * @returns {Object|null} Property definition or null
 */
export function getPropertyById(id) {
  return Store.propertyDefs.find(p => p.id === id) || null;
}

/**
 * Get property value from an item
 * @param {Object} item - Task or project
 * @param {string} propertyId - Property ID
 * @returns {*} Property value or default
 */
export function getPropertyValue(item, propertyId) {
  if (!item.customProps) return null;
  
  const value = item.customProps[propertyId];
  if (value !== undefined) return value;

  // Return default value from property definition
  const propertyDef = getPropertyById(propertyId);
  return propertyDef ? propertyDef.defaultValue : null;
}

/**
 * Set property value on an item
 * @param {Object} item - Task or project
 * @param {string} propertyId - Property ID
 * @param {*} value - Value to set
 * @returns {boolean} Success
 */
export function setPropertyValue(item, propertyId, value) {
  if (!item.customProps) {
    item.customProps = {};
  }

  const propertyDef = getPropertyById(propertyId);
  if (!propertyDef) return false;

  // Validate value
  const validatedValue = validatePropertyValue(propertyDef, value);
  item.customProps[propertyId] = validatedValue;
  Store.save();
  return true;
}

/**
 * Validate and normalize a property value
 * @param {Object} propertyDef - Property definition
 * @param {*} value - Value to validate
 * @returns {*} Validated/normalized value
 */
export function validatePropertyValue(propertyDef, value) {
  switch (propertyDef.type) {
    case PROPERTY_TYPES.TEXT:
    case PROPERTY_TYPES.URL:
    case PROPERTY_TYPES.AI:
      return value === null || value === undefined ? '' : String(value);

    case PROPERTY_TYPES.NUMBER:
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return isNaN(num) ? null : num;

    case PROPERTY_TYPES.DATE:
      if (!value) return null;
      // Validate date format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      return null;

    case PROPERTY_TYPES.TIME:
      if (!value) return null;
      // Validate time format HH:MM
      if (/^\d{2}:\d{2}$/.test(value)) return value;
      return null;

    case PROPERTY_TYPES.SELECT:
      if (!value) return null;
      // Validate option exists
      const optionExists = propertyDef.options?.some(opt => opt.id === value || opt.value === value);
      return optionExists ? value : null;

    case PROPERTY_TYPES.MULTI_SELECT:
      if (!Array.isArray(value)) return [];
      // Filter to valid options only
      return value.filter(v => 
        propertyDef.options?.some(opt => opt.id === v || opt.value === v)
      );

    default:
      return value;
  }
}

/**
 * Check if a property has any values set
 * @param {string} propertyId - Property ID
 * @returns {boolean}
 */
export function checkPropertyHasValues(propertyId) {
  const propertyDef = getPropertyById(propertyId);
  if (!propertyDef) return false;

  const entities = propertyDef.entityType === ENTITY_TYPES.TASK 
    ? Store.items 
    : Store.projects;

  return entities.some(entity => {
    const value = entity.customProps?.[propertyId];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  });
}

/**
 * Add an option to a select/multi-select property
 * @param {string} propertyId - Property ID
 * @param {string} value - Option value
 * @param {string} color - Option color (optional)
 * @returns {Object|null} Created option or null
 */
export function addPropertyOption(propertyId, value, color = '#9B9B9B') {
  const propertyDef = getPropertyById(propertyId);
  if (!propertyDef) return null;
  if (propertyDef.type !== PROPERTY_TYPES.SELECT && propertyDef.type !== PROPERTY_TYPES.MULTI_SELECT) {
    return null;
  }

  const option = {
    id: generateOptionId(),
    value: value.trim(),
    color
  };

  if (!propertyDef.options) propertyDef.options = [];
  propertyDef.options.push(option);
  Store.save();
  return option;
}

/**
 * Update an option in a select/multi-select property
 * @param {string} propertyId - Property ID
 * @param {string} optionId - Option ID
 * @param {Object} updates - Updates to apply
 * @returns {boolean} Success
 */
export function updatePropertyOption(propertyId, optionId, updates) {
  const propertyDef = getPropertyById(propertyId);
  if (!propertyDef || !propertyDef.options) return false;

  const optionIndex = propertyDef.options.findIndex(o => o.id === optionId);
  if (optionIndex === -1) return false;

  propertyDef.options[optionIndex] = {
    ...propertyDef.options[optionIndex],
    ...updates
  };

  Store.save();
  return true;
}

/**
 * Delete an option from a select/multi-select property
 * @param {string} propertyId - Property ID
 * @param {string} optionId - Option ID
 * @returns {boolean} Success
 */
export function deletePropertyOption(propertyId, optionId) {
  const propertyDef = getPropertyById(propertyId);
  if (!propertyDef || !propertyDef.options) return false;

  const optionIndex = propertyDef.options.findIndex(o => o.id === optionId);
  if (optionIndex === -1) return false;

  // Remove option
  propertyDef.options.splice(optionIndex, 1);

  // Clear values that reference this option
  const entities = propertyDef.entityType === ENTITY_TYPES.TASK 
    ? Store.items 
    : Store.projects;

  entities.forEach(entity => {
    if (!entity.customProps) return;
    const value = entity.customProps[propertyId];
    
    if (propertyDef.type === PROPERTY_TYPES.SELECT && value === optionId) {
      entity.customProps[propertyId] = null;
    } else if (propertyDef.type === PROPERTY_TYPES.MULTI_SELECT && Array.isArray(value)) {
      entity.customProps[propertyId] = value.filter(v => v !== optionId);
    }
  });

  Store.save();
  return true;
}

/**
 * Reorder properties
 * @param {string} entityType - Entity type
 * @param {Array} orderedIds - Array of property IDs in new order
 */
export function reorderProperties(entityType, orderedIds) {
  orderedIds.forEach((id, index) => {
    const prop = Store.propertyDefs.find(p => p.id === id && p.entityType === entityType);
    if (prop) {
      prop.order = index;
    }
  });
  Store.save();
}

/**
 * Get display value for a property (formatted for UI)
 * @param {Object} propertyDef - Property definition
 * @param {*} value - Raw value
 * @returns {string|Array} Display value
 */
export function getDisplayValue(propertyDef, value) {
  if (value === null || value === undefined) return '';

  switch (propertyDef.type) {
    case PROPERTY_TYPES.SELECT:
      const option = propertyDef.options?.find(o => o.id === value || o.value === value);
      return option ? option.value : '';

    case PROPERTY_TYPES.MULTI_SELECT:
      if (!Array.isArray(value)) return [];
      return value.map(v => {
        const opt = propertyDef.options?.find(o => o.id === v || o.value === v);
        return opt ? opt.value : v;
      });

    case PROPERTY_TYPES.URL:
      return value || '';

    default:
      return value;
  }
}

/**
 * Get option by ID or value
 * @param {Object} propertyDef - Property definition
 * @param {string} idOrValue - Option ID or value
 * @returns {Object|null} Option object
 */
export function getOption(propertyDef, idOrValue) {
  if (!propertyDef.options) return null;
  return propertyDef.options.find(o => o.id === idOrValue || o.value === idOrValue) || null;
}

/**
 * Get inline properties (properties marked to show in task row)
 * @param {string} entityType - Entity type
 * @returns {Array} Property definitions
 */
export function getInlineProperties(entityType) {
  return getPropertiesForEntity(entityType).filter(p => p.showInline);
}

// Export types for convenience
export { PROPERTY_TYPES, ENTITY_TYPES };
