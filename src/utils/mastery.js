/**
 * Mastery tracking for pages (notes).
 * Implements spaced-repetition review scheduling and scoring.
 */

import { Store, formatLocalYMD } from './store';
import { getDescendantPageIds } from './pages';

export const MASTERY_LEVELS = [
  { id: 'none',    label: 'Not Started', color: '#9B9B9B', percent: 0,   intervalDays: 0 },
  { id: 'rookie',  label: 'Rookie',      color: '#F59E0B', percent: 25,  intervalDays: 1 },
  { id: 'ranger',  label: 'Ranger',      color: '#2383E2', percent: 50,  intervalDays: 2 },
  { id: 'mastered',label: 'Mastered',    color: '#45A557', percent: 75,  intervalDays: 4 },
  { id: 'final',   label: 'Final Exam',  color: '#9B59B6', percent: 90,  intervalDays: 14 },
  { id: 'retired', label: 'Retired',     color: '#6B7280', percent: 100, intervalDays: 9999 }
];

/** Lookup level config by id. */
export function getMasteryConfig(levelId) {
  return MASTERY_LEVELS.find((l) => l.id === levelId) || MASTERY_LEVELS[0];
}

/** Default mastery blob for a new page. */
export function defaultMastery() {
  return {
    level: 'none',
    reviewCount: 0,
    lastReviewed: null,
    nextReview: null
  };
}

/**
 * Compute next review date based on level.
 * @param {string} level - mastery level id
 * @param {string} fromYMD - 'YYYY-MM-DD' date string
 * @returns {string|null} - 'YYYY-MM-DD' or null if level is 'none'
 */
export function computeNextReview(level, fromYMD) {
  const config = getMasteryConfig(level);
  if (!config.intervalDays || level === 'none') return null;
  const base = new Date(fromYMD + 'T00:00:00');
  base.setDate(base.getDate() + config.intervalDays);
  return formatLocalYMD(base);
}

/**
 * Record a review on a page, updating mastery state.
 * Mutates page.mastery in place.
 * @param {object} page - page object with mastery property
 * @param {object} options
 * @param {string} [options.newLevel] - target level (defaults to 'rookie' if current is 'none')
 * @param {string} [options.todayYMD] - today's date string, defaults to now
 */
export function recordReview(page, { newLevel, todayYMD } = {}) {
  if (!page) return;
  if (!page.mastery) page.mastery = defaultMastery();
  
  const today = todayYMD || formatLocalYMD(new Date());
  const currentLevel = page.mastery.level || 'none';
  
  // Default to rookie if coming from none and no level specified
  const targetLevel = newLevel || (currentLevel === 'none' ? 'rookie' : currentLevel);
  
  page.mastery.level = targetLevel;
  page.mastery.reviewCount = (page.mastery.reviewCount || 0) + 1;
  page.mastery.lastReviewed = today;
  page.mastery.nextReview = computeNextReview(targetLevel, today);
}

/**
 * Determine review status for a page relative to today.
 * @param {object} page
 * @param {string} todayYMD - 'YYYY-MM-DD'
 * @returns {'not_started'|'due_today'|'missed'|'upcoming'|'retired'}
 */
export function pageReviewStatus(page, todayYMD) {
  const mastery = page?.mastery || defaultMastery();
  const level = mastery.level || 'none';
  
  if (level === 'none') return 'not_started';
  if (level === 'retired') return 'retired';
  
  const nextReview = mastery.nextReview;
  if (!nextReview) return 'upcoming'; // shouldn't happen, but safe fallback
  
  if (nextReview < todayYMD) return 'missed';
  if (nextReview === todayYMD) return 'due_today';
  return 'upcoming';
}

/**
 * Collect all pages for a scope: the root pages plus all their descendants.
 * @param {object} options
 * @param {string[]} options.rootPageIds - array of page ids to start from
 * @returns {object[]} - array of page objects
 */
export function collectPagesForScope({ rootPageIds }) {
  if (!rootPageIds || rootPageIds.length === 0) return [];
  
  const pages = Store.pages || [];
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const resultIds = new Set();
  
  for (const rootId of rootPageIds) {
    if (pageById.has(rootId)) {
      resultIds.add(rootId);
      const descendants = getDescendantPageIds(pages, rootId);
      for (const descId of descendants) {
        resultIds.add(descId);
      }
    }
  }
  
  return Array.from(resultIds)
    .map((id) => pageById.get(id))
    .filter(Boolean);
}

/**
 * Compute mastery score across pages as average of level percentages.
 * @param {object[]} pages
 * @param {object} options
 * @param {boolean} [options.ignoreUntracked=false] - exclude 'none' level pages from average
 * @returns {number} - score 0-100
 */
export function computeMasteryScore(pages, { ignoreUntracked = false } = {}) {
  if (!pages || pages.length === 0) return 0;
  
  let filtered = pages;
  if (ignoreUntracked) {
    filtered = pages.filter((p) => (p.mastery?.level || 'none') !== 'none');
  }
  
  if (filtered.length === 0) return 0;
  
  const total = filtered.reduce((sum, p) => {
    const level = p.mastery?.level || 'none';
    const config = getMasteryConfig(level);
    return sum + config.percent;
  }, 0);
  
  return Math.round(total / filtered.length);
}

/**
 * Get full mastery breakdown for a set of pages.
 * @param {object[]} pages
 * @param {string} todayYMD
 * @param {object} options
 * @param {boolean} [options.ignoreUntracked=false]
 * @returns {object} breakdown with totalPages, trackedPages, score, byLevel, buckets
 */
export function getMasteryBreakdown(pages, todayYMD, { ignoreUntracked = false } = {}) {
  const result = {
    totalPages: pages.length,
    trackedPages: 0,
    score: 0,
    byLevel: {
      none: [],
      rookie: [],
      ranger: [],
      mastered: [],
      final: [],
      retired: []
    },
    buckets: {
      notStarted: [],
      dueToday: [],
      missed: [],
      upcoming: [],
      retired: []
    }
  };
  
  if (!pages || pages.length === 0) return result;
  
  for (const page of pages) {
    const level = page.mastery?.level || 'none';
    const status = pageReviewStatus(page, todayYMD);
    
    // Group by level
    if (result.byLevel[level]) {
      result.byLevel[level].push(page);
    }
    
    // Group by bucket
    switch (status) {
      case 'not_started':
        result.buckets.notStarted.push(page);
        break;
      case 'due_today':
        result.buckets.dueToday.push(page);
        break;
      case 'missed':
        result.buckets.missed.push(page);
        break;
      case 'upcoming':
        result.buckets.upcoming.push(page);
        break;
      case 'retired':
        result.buckets.retired.push(page);
        break;
    }
    
    if (level !== 'none') {
      result.trackedPages++;
    }
  }
  
  // Sort buckets by nextReview date
  const sortByNextReview = (a, b) => {
    const aDate = a.mastery?.nextReview || '9999-99-99';
    const bDate = b.mastery?.nextReview || '9999-99-99';
    return aDate.localeCompare(bDate);
  };
  
  result.buckets.missed.sort(sortByNextReview);
  result.buckets.dueToday.sort(sortByNextReview);
  result.buckets.upcoming.sort(sortByNextReview);
  
  // Compute score
  result.score = computeMasteryScore(pages, { ignoreUntracked });
  
  return result;
}
