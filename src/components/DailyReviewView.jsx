import { Store, getToday } from '../utils/store';
import { AIReschedulerPanel } from './AIReschedulerPanel';
import '../styles/Dashboard.css';

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'Unscheduled';
  const today = getToday();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function getProjectName(item) {
  const project = item.pid ? Store.projects.find((p) => p.id === item.pid) : null;
  return project ? `${project.icon || ''} ${project.name}`.trim() : 'No folder';
}

function sortReviewItems(a, b) {
  const aDate = a.date || '9999-12-31';
  const bDate = b.date || '9999-12-31';
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  if ((a.priority || '') !== (b.priority || '')) {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  }
  return (a.text || '').localeCompare(b.text || '');
}

function buildReviewQueue() {
  const today = getToday();
  return (Store.items || [])
    .filter((item) => !item.done && !item.archived)
    .filter((item) => item.reschedule || !item.date || item.date <= today)
    .sort(sortReviewItems);
}

export function DailyReviewView({ onNavigate, onOpenItem, onUpdate }) {
  const today = getToday();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const queue = buildReviewQueue();
  const overdue = queue.filter((item) => item.date && item.date < today).length;
  const unscheduled = queue.filter((item) => !item.date).length;
  const dueToday = queue.filter((item) => item.date === today).length;

  const updateItem = (id, patch) => {
    const item = Store.items.find((candidate) => candidate.id === id);
    if (!item) return;
    Object.assign(item, patch);
    Store.save();
    onUpdate?.();
  };

  const scheduleItem = (id, date) => {
    updateItem(id, { date, reschedule: false });
  };

  const markDone = (id) => {
    updateItem(id, { done: true, reschedule: false });
  };

  const archiveItem = (id) => {
    updateItem(id, { archived: true, reschedule: false });
  };

  return (
    <div className="daily-review-view">
      <div className="header-row">
        <div>
          <h1 className="page-title">Daily Review</h1>
          <p className="dash-subtitle">Clear today, rescue old tasks, and decide what deserves a date.</p>
        </div>
        <div className="header-controls">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('home')}>
            Back Home
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('tasks', 'today')}>
            Today View
          </button>
        </div>
      </div>

      <section className="review-summary">
        <div>
          <span>Review Queue</span>
          <strong>{queue.length}</strong>
        </div>
        <div>
          <span>Overdue</span>
          <strong>{overdue}</strong>
        </div>
        <div>
          <span>Due Today</span>
          <strong>{dueToday}</strong>
        </div>
        <div>
          <span>Unscheduled</span>
          <strong>{unscheduled}</strong>
        </div>
      </section>

      <AIReschedulerPanel items={queue} onUpdate={onUpdate} />

      {queue.length === 0 ? (
        <section className="review-empty">
          <h2>Review complete</h2>
          <p>No overdue, due-today, flagged, or unscheduled tasks need attention.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('home')}>
            Return Home
          </button>
        </section>
      ) : (
        <section className="review-list">
          {queue.map((item) => (
            <article key={item.id} className="review-item">
              <div className="review-item-main">
                <div className="review-item-topline">
                  <span className={`review-priority priority-${item.priority || 'low'}`}>
                    {item.priority || 'low'}
                  </span>
                  <span>{formatDateLabel(item.date)}</span>
                  <span>{getProjectName(item)}</span>
                </div>
                <h2>{item.text || 'Untitled item'}</h2>
                {item.customProps?.prop_notes && <p>{item.customProps.prop_notes}</p>}
              </div>
              <div className="review-actions">
                <button type="button" onClick={() => scheduleItem(item.id, tomorrow)}>Tomorrow</button>
                <button type="button" onClick={() => scheduleItem(item.id, nextWeek)}>Next Week</button>
                <button type="button" onClick={() => scheduleItem(item.id, null)}>Inbox</button>
                <button type="button" onClick={() => markDone(item.id)}>Done</button>
                <button type="button" onClick={() => archiveItem(item.id)}>Archive</button>
                <button type="button" onClick={() => onOpenItem?.(item.id)}>Details</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
