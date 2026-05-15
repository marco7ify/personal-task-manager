import { useState, useMemo } from 'react';
import { Store, formatLocalYMD } from '../utils/store';
import { getMasteryBreakdown, getMasteryConfig } from '../utils/mastery';
import '../styles/Mastery.css';

/**
 * StudySection: displays mastery score and buckets for a set of pages.
 * Props:
 *   - pages: array of page objects (already resolved for scope)
 *   - onOpenPage: callback(pageId) to navigate to a page
 *   - onUpdate: callback after changes (for re-rendering parent)
 */
export function StudySection({ pages, onOpenPage, onUpdate }) {
  const [expandedBuckets, setExpandedBuckets] = useState({
    missed: true,
    dueToday: true,
    upcoming: false,
    notStarted: false,
    retired: false
  });

  const todayYMD = formatLocalYMD(new Date());
  const ignoreUntracked = Store.settings.masteryIgnoreUntracked;

  const breakdown = useMemo(() => {
    return getMasteryBreakdown(pages || [], todayYMD, { ignoreUntracked });
  }, [pages, todayYMD, ignoreUntracked]);

  if (!pages || pages.length === 0) {
    return (
      <div className="study-section study-section-empty">
        <p>No pages linked. Link notebooks to track mastery.</p>
      </div>
    );
  }

  const toggleBucket = (key) => {
    setExpandedBuckets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderPageRow = (page) => {
    const mastery = page.mastery || { level: 'none', reviewCount: 0, lastReviewed: null, nextReview: null };
    const config = getMasteryConfig(mastery.level);

    return (
      <div key={page.id} className="study-page-row">
        <button
          type="button"
          className="study-page-link"
          onClick={() => onOpenPage && onOpenPage(page.id)}
        >
          <span className="study-page-icon">{page.icon || '📄'}</span>
          <span className="study-page-title">{page.title || 'Untitled'}</span>
        </button>
        <span
          className="mastery-level-chip small"
          style={{ backgroundColor: config.color }}
        >
          {config.label}
        </span>
        {mastery.nextReview && mastery.level !== 'none' && mastery.level !== 'retired' && (
          <span className="study-page-date">{formatDate(mastery.nextReview)}</span>
        )}
      </div>
    );
  };

  const renderBucket = (key, label, emoji, items) => {
    const isExpanded = expandedBuckets[key];
    const count = items.length;

    if (count === 0) return null;

    // For not started, if ignoreUntracked is on, show as collapsed footer
    if (key === 'notStarted' && ignoreUntracked) {
      return (
        <div key={key} className="study-bucket study-bucket-untracked">
          <button
            type="button"
            className="study-bucket-header"
            onClick={() => toggleBucket(key)}
          >
            <span className="study-bucket-toggle">{isExpanded ? '▾' : '▸'}</span>
            <span className="study-bucket-label">Untracked ({count})</span>
          </button>
          {isExpanded && (
            <div className="study-bucket-items">
              {items.map(renderPageRow)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={key} className={`study-bucket study-bucket-${key}`}>
        <button
          type="button"
          className="study-bucket-header"
          onClick={() => toggleBucket(key)}
        >
          <span className="study-bucket-toggle">{isExpanded ? '▾' : '▸'}</span>
          <span className="study-bucket-emoji">{emoji}</span>
          <span className="study-bucket-label">{label}</span>
          <span className="study-bucket-count">{count}</span>
        </button>
        {isExpanded && (
          <div className="study-bucket-items">
            {items.map(renderPageRow)}
          </div>
        )}
      </div>
    );
  };

  const { buckets, score, totalPages, trackedPages } = breakdown;

  return (
    <div className="study-section">
      <div className="study-score-header">
        <div className="study-score-main">
          <span className="study-score-value">{score}%</span>
          <span className="study-score-label">Mastery</span>
        </div>
        <div className="study-score-meta">
          <span className="study-score-stat">
            {trackedPages} of {totalPages} tracked
          </span>
          {buckets.missed.length > 0 && (
            <span className="study-score-alert">
              ⚠️ {buckets.missed.length} missed
            </span>
          )}
          {buckets.dueToday.length > 0 && (
            <span className="study-score-due">
              📅 {buckets.dueToday.length} due today
            </span>
          )}
        </div>
      </div>

      <div className="study-buckets">
        {renderBucket('missed', 'Missed', '⚠️', buckets.missed)}
        {renderBucket('dueToday', 'Due Today', '📅', buckets.dueToday)}
        {renderBucket('upcoming', 'Upcoming', '📆', buckets.upcoming)}
        {renderBucket('notStarted', 'Not Started', '📋', buckets.notStarted)}
        {renderBucket('retired', 'Retired', '✅', buckets.retired)}
      </div>
    </div>
  );
}
