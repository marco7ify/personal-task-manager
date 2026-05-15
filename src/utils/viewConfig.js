import { Store, PROPERTY_TYPES, ENTITY_TYPES } from './store';
import { getPropertyById, getPropertyValue, getOption } from './properties';

/**
 * Generate a unique view ID
 */
export function generateViewId() {
  return 'view_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

/**
 * Create a new view configuration
 * @param {string} name - View name
 * @param {Object} config - View configuration
 * @returns {Object} Created view
 */
export function createView(name, config = {}) {
  const id = generateViewId();
  const view = {
    id,
    name: name.trim(),
    entityType: config.entityType || ENTITY_TYPES.TASK,
    groupBy: config.groupBy || 'project', // 'project', 'priority', 'date', or property ID
    sortBy: config.sortBy || 'date',
    sortOrder: config.sortOrder || 'asc',
    filters: config.filters || [],
    visibleProperties: config.visibleProperties || [],
    createdAt: Date.now()
  };

  Store.viewConfigs[id] = view;
  Store.save();
  return view;
}

/**
 * Update a view configuration
 * @param {string} id - View ID
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} Updated view or null
 */
export function updateView(id, updates) {
  if (!Store.viewConfigs[id]) return null;

  Store.viewConfigs[id] = {
    ...Store.viewConfigs[id],
    ...updates,
    updatedAt: Date.now()
  };

  Store.save();
  return Store.viewConfigs[id];
}

/**
 * Delete a view configuration
 * @param {string} id - View ID
 * @returns {boolean} Success
 */
export function deleteView(id) {
  if (!Store.viewConfigs[id]) return false;
  delete Store.viewConfigs[id];
  Store.save();
  return true;
}

/**
 * Get all views for an entity type
 * @param {string} entityType - Entity type
 * @returns {Array} Views
 */
export function getViewsForEntity(entityType) {
  return Object.values(Store.viewConfigs)
    .filter(v => v.entityType === entityType)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Get a view by ID
 * @param {string} id - View ID
 * @returns {Object|null} View or null
 */
export function getViewById(id) {
  return Store.viewConfigs[id] || null;
}

/**
 * Get value for grouping/sorting
 * @param {Object} item - Item to get value from
 * @param {string} field - Field name or property ID
 * @returns {*} Value
 */
function getFieldValue(item, field) {
  // Built-in fields
  switch (field) {
    case 'project':
      return item.pid || '_inbox';
    case 'priority':
      return item.priority || 'low';
    case 'date':
      return item.date || '';
    case 'time':
      return item.time || '';
    case 'type':
      return item.type || 'task';
    case 'done':
      return item.done ? 'done' : 'pending';
    case 'text':
      return item.text || '';
    case 'createdAt':
      return item.createdAt || 0;
    default:
      // Custom property
      if (field.startsWith('prop_')) {
        return getPropertyValue(item, field);
      }
      return item[field] || null;
  }
}

/**
 * Get display label for a group
 * @param {string} field - Field name
 * @param {*} value - Group value
 * @returns {string} Display label
 */
export function getGroupLabel(field, value) {
  switch (field) {
    case 'project':
      if (value === '_inbox' || !value) return '📥 Inbox';
      const project = Store.projects.find(p => p.id === value);
      return project ? `${project.icon} ${project.name}` : 'Unknown';
    
    case 'priority':
      const priorities = { low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High' };
      return priorities[value] || value;
    
    case 'type':
      return value === 'event' ? '📅 Events' : '📋 Tasks';
    
    case 'done':
      return value === 'done' ? '✅ Done' : '⏳ Pending';
    
    case 'date':
      if (!value) return '📅 No Date';
      return `📅 ${value}`;
    
    default:
      // Custom property
      if (field.startsWith('prop_')) {
        const propDef = getPropertyById(field);
        if (!propDef) return String(value);
        
        if (propDef.type === PROPERTY_TYPES.SELECT) {
          const option = getOption(propDef, value);
          return option ? option.value : (value || 'None');
        }
        
        return value || 'None';
      }
      return String(value || 'None');
  }
}

/**
 * Compare values for sorting
 * @param {*} a - First value
 * @param {*} b - Second value
 * @param {string} order - 'asc' or 'desc'
 * @returns {number} Comparison result
 */
function compareValues(a, b, order = 'asc') {
  // Handle nulls
  if (a === null || a === undefined) return order === 'asc' ? 1 : -1;
  if (b === null || b === undefined) return order === 'asc' ? -1 : 1;

  // Handle arrays (multi-select)
  if (Array.isArray(a)) a = a.join(',');
  if (Array.isArray(b)) b = b.join(',');

  // Compare
  let result;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b));
  }

  return order === 'desc' ? -result : result;
}

/**
 * Check if an item matches a filter
 * @param {Object} item - Item to check
 * @param {Object} filter - Filter rule
 * @returns {boolean} Match result
 */
function matchesFilter(item, filter) {
  const value = getFieldValue(item, filter.propertyId);
  const filterValue = filter.value;

  switch (filter.operator) {
    case 'equals':
      return value === filterValue;
    case 'not_equals':
      return value !== filterValue;
    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'not_contains':
      return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'is_empty':
      return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    case 'is_not_empty':
      return value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
    case 'greater_than':
      return value > filterValue;
    case 'less_than':
      return value < filterValue;
    case 'includes':
      // For multi-select
      if (Array.isArray(value)) {
        return value.includes(filterValue);
      }
      return value === filterValue;
    default:
      return true;
  }
}

/**
 * Apply view configuration to items
 * @param {Array} items - Items to process
 * @param {Object} viewConfig - View configuration
 * @returns {Object} Grouped and sorted items { groups: [{ key, label, items }] }
 */
export function applyView(items, viewConfig) {
  if (!viewConfig) {
    return { groups: [{ key: 'all', label: 'All Items', items }] };
  }

  let filteredItems = [...items];

  // Apply filters
  if (viewConfig.filters && viewConfig.filters.length > 0) {
    filteredItems = filteredItems.filter(item =>
      viewConfig.filters.every(filter => matchesFilter(item, filter))
    );
  }

  // Sort items
  if (viewConfig.sortBy) {
    filteredItems.sort((a, b) => {
      const aVal = getFieldValue(a, viewConfig.sortBy);
      const bVal = getFieldValue(b, viewConfig.sortBy);
      return compareValues(aVal, bVal, viewConfig.sortOrder);
    });
  }

  // Group items
  const groupBy = viewConfig.groupBy || 'project';
  const groupMap = new Map();

  filteredItems.forEach(item => {
    const groupValue = getFieldValue(item, groupBy);
    const groupKey = groupValue === null || groupValue === undefined ? '_none' : String(groupValue);
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        value: groupValue,
        label: getGroupLabel(groupBy, groupValue),
        items: []
      });
    }
    groupMap.get(groupKey).items.push(item);
  });

  // Convert to array and sort groups
  const groups = Array.from(groupMap.values());
  
  // Sort groups (special handling for priority)
  if (groupBy === 'priority') {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    groups.sort((a, b) => (priorityOrder[a.value] || 99) - (priorityOrder[b.value] || 99));
  } else {
    groups.sort((a, b) => compareValues(a.value, b.value, 'asc'));
  }

  return { groups, totalCount: filteredItems.length };
}

/**
 * Get available grouping options
 * @param {string} entityType - Entity type
 * @returns {Array} Options
 */
export function getGroupByOptions(entityType) {
  const builtIn = [
    { id: 'project', label: '📁 Project' },
    { id: 'priority', label: '⚡ Priority' },
    { id: 'date', label: '📅 Date' },
    { id: 'type', label: '📋 Type' },
    { id: 'done', label: '✅ Status' }
  ];

  // Add custom properties that support grouping
  const customProps = Store.propertyDefs
    .filter(p => p.entityType === entityType && 
      [PROPERTY_TYPES.SELECT, PROPERTY_TYPES.DATE].includes(p.type))
    .map(p => ({ id: p.id, label: `🏷️ ${p.name}` }));

  return [...builtIn, ...customProps];
}

/**
 * Get available sorting options
 * @param {string} entityType - Entity type
 * @returns {Array} Options
 */
export function getSortByOptions(entityType) {
  const builtIn = [
    { id: 'date', label: '📅 Date' },
    { id: 'priority', label: '⚡ Priority' },
    { id: 'text', label: '📝 Name' },
    { id: 'createdAt', label: '🕐 Created' },
    { id: 'time', label: '⏰ Time' }
  ];

  // Add custom properties
  const customProps = Store.propertyDefs
    .filter(p => p.entityType === entityType)
    .map(p => ({ id: p.id, label: `🏷️ ${p.name}` }));

  return [...builtIn, ...customProps];
}

/**
 * Get filter operators for a field type
 * @param {string} fieldType - Field type
 * @returns {Array} Operators
 */
export function getFilterOperators(fieldType) {
  const common = [
    { id: 'is_empty', label: 'is empty' },
    { id: 'is_not_empty', label: 'is not empty' }
  ];

  switch (fieldType) {
    case 'text':
    case PROPERTY_TYPES.TEXT:
    case PROPERTY_TYPES.URL:
      return [
        { id: 'equals', label: 'equals' },
        { id: 'not_equals', label: 'does not equal' },
        { id: 'contains', label: 'contains' },
        { id: 'not_contains', label: 'does not contain' },
        ...common
      ];

    case 'number':
    case PROPERTY_TYPES.NUMBER:
      return [
        { id: 'equals', label: 'equals' },
        { id: 'not_equals', label: 'does not equal' },
        { id: 'greater_than', label: 'greater than' },
        { id: 'less_than', label: 'less than' },
        ...common
      ];

    case 'select':
    case PROPERTY_TYPES.SELECT:
    case 'priority':
    case 'type':
      return [
        { id: 'equals', label: 'is' },
        { id: 'not_equals', label: 'is not' },
        ...common
      ];

    case PROPERTY_TYPES.MULTI_SELECT:
      return [
        { id: 'includes', label: 'includes' },
        { id: 'not_equals', label: 'does not include' },
        ...common
      ];

    case 'date':
    case PROPERTY_TYPES.DATE:
      return [
        { id: 'equals', label: 'is' },
        { id: 'not_equals', label: 'is not' },
        { id: 'greater_than', label: 'is after' },
        { id: 'less_than', label: 'is before' },
        ...common
      ];

    default:
      return [
        { id: 'equals', label: 'equals' },
        { id: 'not_equals', label: 'does not equal' },
        ...common
      ];
  }
}
