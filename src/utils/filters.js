import { getToday, getWeekEnd, getMonthPrefix, monthRangeFor } from './store';
import { generateRecurringVirtuals } from './recurrence';

function passesGlobalProjectExclude(item, excludeSet) {
  if (!excludeSet || excludeSet.size === 0) return true;
  return !item.pid || !excludeSet.has(item.pid);
}

/**
 * @param {Object} [opts]
 * @param {string[]} [opts.viewExcludedProjectIds] — hide tasks in these projects from global views only
 */
export function getFilteredItems(items, filter, projectId = null, searchQuery = '', opts = {}) {
  const today = getToday();
  const weekEnd = getWeekEnd();
  const monthPrefix = getMonthPrefix();
  const excludeSet = new Set(opts.viewExcludedProjectIds || []);
  const applyExclude = !projectId && excludeSet.size > 0;

  let filtered = projectId
    ? items.filter(i => i.pid === projectId)
    : items;

  if (applyExclude) {
    filtered = filtered.filter(i => passesGlobalProjectExclude(i, excludeSet));
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      (i.text || '').toLowerCase().includes(q) ||
      (i.subfolder || '').toLowerCase().includes(q) ||
      (Array.isArray(i.subtasks)
        ? i.subtasks.some((st) => (st.text || '').toLowerCase().includes(q))
        : false)
    );
  }

  let base;
  switch (filter) {
    case 'nofolder':
      base = filtered.filter(i => !i.pid && !i.done && !i.archived);
      break;
    case 'inbox':
      if (projectId) {
        base = filtered.filter(i => !i.date && !i.done && !i.archived);
      } else {
        base = filtered.filter(i => !i.pid && !i.done && !i.archived && !i.date);
      }
      break;
    case 'today':
      base = filtered.filter(i => i.date === today && !i.done && !i.archived);
      break;
    case 'week':
      base = filtered.filter(i => i.date && i.date >= today && i.date <= weekEnd && !i.done && !i.archived);
      break;
    case 'month':
      base = filtered.filter(i => i.date && i.date.startsWith(monthPrefix) && !i.done && !i.archived);
      break;
    case 'done':
      base = filtered.filter(i => i.done);
      break;
    case 'archived':
      base = filtered.filter(i => i.archived);
      break;
    case 'reschedule':
      base = filtered.filter(i => i.reschedule && !i.done);
      break;
    default:
      base = filtered.filter(i => !i.done && !i.archived);
      break;
  }

  if (filter === 'week') {
    const virtuals = generateRecurringVirtuals(filtered, projectId, today, weekEnd);
    return base.concat(virtuals);
  }
  if (filter === 'month') {
    const r = monthRangeFor(monthPrefix);
    const virtuals = generateRecurringVirtuals(filtered, projectId, r.start, r.end);
    return base.concat(virtuals);
  }

  return base;
}

/** Counts for sidebar; respects viewExcludedProjectIds on global views (not inbox/nofolder). */
export function getCounts(items, viewExcludedProjectIds = []) {
  const today = getToday();
  const weekEnd = getWeekEnd();
  const monthPrefix = getMonthPrefix();
  const excludeSet = new Set(viewExcludedProjectIds || []);
  const g = (pred) =>
    items.filter(
      (i) => pred(i) && passesGlobalProjectExclude(i, excludeSet)
    ).length;

  return {
    all: g((i) => !i.done && !i.archived),
    inbox: items.filter((i) => !i.pid && !i.done && !i.archived && !i.date).length,
    nofolder: items.filter((i) => !i.pid && !i.done && !i.archived).length,
    today: g((i) => i.date === today && !i.done),
    week: g((i) => i.date && i.date >= today && i.date <= weekEnd && !i.done),
    month: g((i) => i.date && i.date.startsWith(monthPrefix) && !i.done),
    reschedule: g((i) => i.reschedule && !i.done),
    done: g((i) => i.done),
    archived: g((i) => i.archived)
  };
}
