import { Store, getToday } from '../utils/store';
import { getMasteryConfig, pageReviewStatus, recordReview } from '../utils/mastery';
import { PAGE_TEMPLATES, createPageFromTemplate } from '../utils/templates';
import '../styles/Dashboard.css';

function formatDate(dateStr) {
  if (!dateStr) return 'No date';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function pageParentLabel(page) {
  if (!page?.parentId) return 'Top-level page';
  const parent = Store.pages.find((candidate) => candidate.id === page.parentId);
  return parent ? `${parent.icon || ''} ${parent.title || 'Untitled'}`.trim() : 'Nested page';
}

function buildStudyQueue() {
  const today = getToday();
  const items = (Store.pages || [])
    .filter((page) => page && page.mastery?.level !== 'retired')
    .map((page) => ({
      page,
      status: pageReviewStatus(page, today),
      config: getMasteryConfig(page.mastery?.level)
    }));

  const statusOrder = { missed: 0, due_today: 1, not_started: 2, upcoming: 3, retired: 4 };
  return items.sort((a, b) => {
    const byStatus = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (byStatus !== 0) return byStatus;
    const aDate = a.page.mastery?.nextReview || '9999-12-31';
    const bDate = b.page.mastery?.nextReview || '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (a.page.title || '').localeCompare(b.page.title || '');
  });
}

function statusLabel(status) {
  if (status === 'missed') return 'Missed';
  if (status === 'due_today') return 'Due today';
  if (status === 'not_started') return 'Not started';
  if (status === 'upcoming') return 'Upcoming';
  return 'Review';
}

export function StudyQueueView({ onNavigate, onUpdate }) {
  const queue = buildStudyQueue();
  const missed = queue.filter((item) => item.status === 'missed').length;
  const dueToday = queue.filter((item) => item.status === 'due_today').length;
  const notStarted = queue.filter((item) => item.status === 'not_started').length;
  const upcoming = queue.filter((item) => item.status === 'upcoming').length;

  const handleReview = (page, level) => {
    recordReview(page, { newLevel: level });
    Store.save();
    onUpdate?.();
  };

  const handleCreateStudyNote = () => {
    const studyTemplate = PAGE_TEMPLATES.find((template) => template.id === 'study-note') || PAGE_TEMPLATES[0];
    const page = createPageFromTemplate(studyTemplate);
    Store.pages.push(page);
    Store.save();
    onUpdate?.();
    onNavigate('page', null, null, page.id);
  };

  const priorityQueue = queue.filter((item) =>
    ['missed', 'due_today', 'not_started'].includes(item.status)
  );
  const visibleQueue = priorityQueue.length > 0 ? priorityQueue : queue.slice(0, 12);

  return (
    <div className="daily-review-view study-queue-view">
      <div className="header-row">
        <div>
          <h1 className="page-title">Study Queue</h1>
          <p className="dash-subtitle">Review notebook pages by mastery status without mixing them into task triage.</p>
        </div>
        <div className="header-controls">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('home')}>
            Back Home
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('dailyReview')}>
            Daily Review
          </button>
        </div>
      </div>

      <section className="review-summary">
        <div>
          <span>Missed</span>
          <strong>{missed}</strong>
        </div>
        <div>
          <span>Due Today</span>
          <strong>{dueToday}</strong>
        </div>
        <div>
          <span>Not Started</span>
          <strong>{notStarted}</strong>
        </div>
        <div>
          <span>Upcoming</span>
          <strong>{upcoming}</strong>
        </div>
      </section>

      {visibleQueue.length === 0 ? (
        <section className="review-empty">
          <h2>No study pages yet</h2>
          <p>Create notebook pages or enable mastery tracking on existing pages to build a review queue.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateStudyNote}>
            New Study Note
          </button>
        </section>
      ) : (
        <section className="review-list">
          {visibleQueue.map(({ page, status, config }) => (
            <article key={page.id} className="review-item study-review-item">
              <div className="review-item-main">
                <div className="review-item-topline">
                  <span className={`study-status study-status-${status}`}>{statusLabel(status)}</span>
                  <span
                    className="mastery-level-chip small"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.label}
                  </span>
                  <span>{pageParentLabel(page)}</span>
                  {page.mastery?.nextReview && <span>Next {formatDate(page.mastery.nextReview)}</span>}
                </div>
                <h2>{page.icon || ''} {page.title || 'Untitled page'}</h2>
              </div>
              <div className="review-actions">
                <button type="button" onClick={() => onNavigate('page', null, null, page.id)}>Open</button>
                <button type="button" onClick={() => handleReview(page, page.mastery?.level || 'rookie')}>Reviewed</button>
                <button type="button" onClick={() => handleReview(page, 'ranger')}>Ranger</button>
                <button type="button" onClick={() => handleReview(page, 'mastered')}>Mastered</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
