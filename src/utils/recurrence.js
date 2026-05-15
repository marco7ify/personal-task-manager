import { formatLocalYMD } from './store';

export function getRecurrenceDetails(recur, weeklyContainer, monthlyDayInput) {
  if (recur === 'weekly') {
    const days = Array.from(weeklyContainer.querySelectorAll('.day-check.selected'))
      .map(el => parseInt(el.dataset.day, 10))
      .filter(n => Number.isFinite(n));
    return { days };
  }
  if (recur === 'monthly') {
    const dom = parseInt(monthlyDayInput?.value || '1', 10);
    return { dayOfMonth: Math.max(1, Math.min(31, dom)) };
  }
  return null;
}

export function matchesRecurrenceOnDate(item, dateStr) {
  if (!item.recurrence || item.recurrence === 'none') return false;
  if (!item.date) return false;
  if (dateStr < item.date) return false;

  const d = new Date(dateStr + 'T00:00:00');
  if (item.recurrence === 'daily') return true;

  if (item.recurrence === 'weekly') {
    const days = Array.isArray(item.recurDetails?.days) ? item.recurDetails.days : [];
    if (days.length > 0) return days.includes(d.getDay());
    const start = new Date(item.date + 'T00:00:00');
    const diffDays = Math.round((d - start) / (1000 * 60 * 60 * 24));
    return diffDays % 7 === 0;
  }

  if (item.recurrence === 'monthly') {
    const dom = parseInt(item.recurDetails?.dayOfMonth || '', 10);
    const targetDay = Number.isFinite(dom) ? dom : parseInt(item.date.split('-')[2], 10);
    return d.getDate() === targetDay;
  }

  return false;
}

export function existsEquivalentOnDate(base, dateStr, items) {
  return items.some(i =>
    i.date === dateStr &&
    (i.text || '') === (base.text || '') &&
    (i.pid || null) === (base.pid || null) &&
    (i.type || 'task') === (base.type || 'task') &&
    (i.time || null) === (base.time || null)
  );
}

export function generateRecurringVirtuals(items, projectId, startDate, endDate) {
  const generators = items.filter(i => {
    if (projectId && i.pid !== projectId) return false;
    if (!i.recurrence || i.recurrence === 'none') return false;
    if (i.archived) return false;
    if (i.done) return false;
    if (!i.date) return false;
    return true;
  });

  const out = [];
  for (const g of generators) {
    let cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    while (cur <= end) {
      const ds = formatLocalYMD(cur);
      if (matchesRecurrenceOnDate(g, ds)) {
        if (!existsEquivalentOnDate(g, ds, items)) {
          out.push({
            ...g,
            id: `v-${g.id}-${ds}`,
            date: ds,
            done: false,
            archived: false,
            __virtual: true,
            __baseId: g.id
          });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  return out;
}
