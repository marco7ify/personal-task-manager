import { useState } from 'react';
import { Store } from '../utils/store';
import { MASTERY_LEVELS, getMasteryConfig, recordReview } from '../utils/mastery';
import '../styles/Mastery.css';

/**
 * MasteryBar: displays mastery info for a page and allows reviewing.
 * Props:
 *   - page: the page object
 *   - onUpdate: callback after saving changes
 */
export function MasteryBar({ page, onUpdate }) {
  const [showPicker, setShowPicker] = useState(false);

  if (!Store.settings.masteryEnabled) return null;
  if (!page) return null;

  const mastery = page.mastery || { level: 'none', reviewCount: 0, lastReviewed: null, nextReview: null };
  const currentLevel = mastery.level || 'none';
  const config = getMasteryConfig(currentLevel);

  const handleReview = (newLevel) => {
    recordReview(page, { newLevel });
    Store.save();
    setShowPicker(false);
    if (onUpdate) onUpdate();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Levels available in the picker (exclude 'none' since you can't choose to be not started)
  const pickableLevels = MASTERY_LEVELS.filter((l) => l.id !== 'none');
  // Default selection when current is 'none'
  const defaultPickLevel = currentLevel === 'none' ? 'rookie' : currentLevel;

  return (
    <div className="mastery-bar">
      <div className="mastery-bar-info">
        <span
          className="mastery-level-chip"
          style={{ backgroundColor: config.color }}
        >
          {config.label}
        </span>
        <span className="mastery-stat">
          <span className="mastery-stat-label">Reviews:</span> {mastery.reviewCount}
        </span>
        {mastery.lastReviewed && (
          <span className="mastery-stat">
            <span className="mastery-stat-label">Last:</span> {formatDate(mastery.lastReviewed)}
          </span>
        )}
        {mastery.nextReview && currentLevel !== 'none' && currentLevel !== 'retired' && (
          <span className="mastery-stat">
            <span className="mastery-stat-label">Next:</span> {formatDate(mastery.nextReview)}
          </span>
        )}
      </div>

      <div className="mastery-bar-actions">
        {!showPicker ? (
          <button
            type="button"
            className="mastery-review-btn"
            onClick={() => setShowPicker(true)}
          >
            Review
          </button>
        ) : (
          <div className="mastery-picker">
            <span className="mastery-picker-label">Set level:</span>
            <div className="mastery-picker-options">
              {pickableLevels.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  className={`mastery-picker-option ${level.id === defaultPickLevel ? 'suggested' : ''} ${level.id === currentLevel ? 'current' : ''}`}
                  style={{ borderColor: level.color }}
                  onClick={() => handleReview(level.id)}
                  title={`${level.percent}% - Next review in ${level.intervalDays} day${level.intervalDays !== 1 ? 's' : ''}`}
                >
                  <span
                    className="mastery-picker-dot"
                    style={{ backgroundColor: level.color }}
                  />
                  {level.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mastery-picker-cancel"
              onClick={() => setShowPicker(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
