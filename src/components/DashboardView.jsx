import { useState } from 'react';
import { Store, getToday, getWeekEnd } from '../utils/store';
import { getCounts } from '../utils/filters';
import { pageReviewStatus } from '../utils/mastery';
import {
  applyPlanBlocks,
  buildPlannerContext,
  getPlannerInclude,
  planScheduleWithAi
} from '../utils/aiPlanner';
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
    month: 'short',
    day: 'numeric'
  });
}

function projectLabel(item) {
  const project = item.pid ? Store.projects.find((p) => p.id === item.pid) : null;
  return project ? `${project.icon || ''} ${project.name}`.trim() : 'No folder';
}

function sortByDateTime(a, b) {
  const aDate = a.date || '9999-12-31';
  const bDate = b.date || '9999-12-31';
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return (a.time || '99:99').localeCompare(b.time || '99:99');
}

function MiniItem({ item, onOpenItem }) {
  return (
    <button type="button" className="dash-mini-item" onClick={() => onOpenItem?.(item.id)}>
      <span className={`dash-mini-dot priority-${item.priority || 'low'}`} />
      <span className="dash-mini-main">
        <span className="dash-mini-title">{item.text || 'Untitled item'}</span>
        <span className="dash-mini-meta">
          {formatDateLabel(item.date)}
          {item.time ? ` at ${item.time}` : ''}
          {' - '}
          {projectLabel(item)}
        </span>
      </span>
    </button>
  );
}

export function DashboardView({ onNavigate, onOpenItem }) {
  const [plannerRange, setPlannerRange] = useState('day');
  const [plannerInclude, setPlannerInclude] = useState(getPlannerInclude());
  const [aiPlan, setAiPlan] = useState(null);
  const [selectedPlanBlockIds, setSelectedPlanBlockIds] = useState(new Set());
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planMessage, setPlanMessage] = useState('');
  const today = getToday();
  const weekEnd = getWeekEnd();
  const plannerContext = buildPlannerContext({
    startDate: today,
    days: plannerRange === 'week' ? 7 : 1,
    include: plannerInclude
  });
  const excluded = Store.settings.viewExcludedProjectIds || [];
  const counts = getCounts(Store.items, excluded);
  const activeItems = (Store.items || []).filter((item) => !item.done && !item.archived);

  const todayItems = activeItems
    .filter((item) => item.date === today)
    .sort(sortByDateTime)
    .slice(0, 8);

  const overdueItems = activeItems
    .filter((item) => item.date && item.date < today)
    .sort(sortByDateTime)
    .slice(0, 6);

  const inboxItems = activeItems
    .filter((item) => !item.date)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);

  const upcomingExams = activeItems
    .filter((item) => item.type === 'exam' && item.date && item.date >= today)
    .sort(sortByDateTime)
    .slice(0, 4);

  const upcomingWeek = activeItems.filter(
    (item) => item.date && item.date >= today && item.date <= weekEnd
  );
  const highPriority = activeItems.filter((item) => item.priority === 'high').length;
  const jobs = Store.jobs || [];
  const activeJobs = jobs.filter((job) => !['accepted', 'rejected'].includes(job.status)).length;
  const interviewingJobs = jobs.filter((job) => job.status === 'interviewing').length;
  const studyDue = (Store.pages || []).filter((page) =>
    ['missed', 'due_today'].includes(pageReviewStatus(page, today))
  ).length;
  const visibleTodayItems = todayItems.filter((item) =>
    item.type === 'event'
      ? plannerInclude.events
      : ['exam', 'study_session'].includes(item.type)
        ? plannerInclude.study
        : plannerInclude.tasks
  );
  const visibleOverdueItems = overdueItems.filter((item) =>
    ['exam', 'study_session'].includes(item.type) ? plannerInclude.study : plannerInclude.tasks
  );
  const visibleInboxItems = plannerInclude.tasks ? inboxItems : [];
  const visibleUpcomingExams = plannerInclude.study || plannerInclude.classes ? upcomingExams : [];
  const protectedBlocks = plannerContext.protectedTime.slice(0, plannerRange === 'week' ? 10 : 4);

  const updatePlannerInclude = (key, checked) => {
    const next = { ...plannerInclude, [key]: checked };
    Store.settings.plannerInclude = next;
    Store.save();
    setPlannerInclude(next);
    setAiPlan(null);
    setSelectedPlanBlockIds(new Set());
  };

  const handleGeneratePlan = async () => {
    setPlanError('');
    setPlanMessage('');
    setPlanLoading(true);
    try {
      const nextPlan = await planScheduleWithAi({
        range: plannerRange,
        context: plannerContext
      });
      setAiPlan(nextPlan);
      setSelectedPlanBlockIds(
        new Set(nextPlan.blocks.filter((block) => block.itemId).map((block) => block.id))
      );
      setPlanMessage(`${nextPlan.blocks.length} block(s) suggested.`);
    } catch (err) {
      setPlanError(err?.message || 'AI planner failed.');
    } finally {
      setPlanLoading(false);
    }
  };

  const togglePlanBlock = (blockId) => {
    setSelectedPlanBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const handleApplyPlan = () => {
    if (!aiPlan) return;
    const selected = aiPlan.blocks.filter((block) => selectedPlanBlockIds.has(block.id));
    const applied = applyPlanBlocks(selected);
    setPlanMessage(`${applied} scheduled item(s) updated.`);
    setSelectedPlanBlockIds(new Set());
  };

  return (
    <div className="dashboard-view">
      <div className="header-row">
        <div>
          <h1 className="page-title">Home</h1>
          <p className="dash-subtitle">A quick pass over today, loose ends, school, and jobs.</p>
        </div>
        <div className="header-controls">
          <div className="view-toggle-group" aria-label="Planning range">
            {[
              ['day', 'Day'],
              ['week', 'Week']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`view-toggle ${plannerRange === value ? 'active' : ''}`}
                onClick={() => setPlannerRange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('dailyReview')}>
            Start Daily Review
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleGeneratePlan}
            disabled={planLoading}
          >
            {planLoading ? 'Planning...' : plannerRange === 'week' ? 'Plan My Week' : 'Plan My Day'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('studyQueue')}>
            Study Queue
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('tasks', 'inbox')}>
            Open Inbox
          </button>
        </div>
      </div>

      <section className="dash-planner-bar">
        <div className="dash-filter-chips" aria-label="Home dashboard filters">
          {[
            ['tasks', 'Tasks'],
            ['events', 'Events'],
            ['classes', 'Classes'],
            ['study', 'Study'],
            ['jobs', 'Jobs']
          ].map(([key, label]) => (
            <label key={key} className={`dash-filter-chip ${plannerInclude[key] ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={plannerInclude[key]}
                onChange={(e) => updatePlannerInclude(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="dash-protected-time">
          <span className="dash-protected-label">Protected time</span>
          {protectedBlocks.length === 0 ? (
            <span className="dash-protected-empty">None set</span>
          ) : (
            protectedBlocks.map((block, index) => (
              <span key={`${block.date}-${block.kind}-${index}`} className={`dash-protected-pill ${block.kind}`}>
                {plannerRange === 'week' ? `${formatDateLabel(block.date)} ` : ''}
                {block.label}: {block.start}-{block.end}
              </span>
            ))
          )}
        </div>
      </section>

      {(aiPlan || planError || planMessage) && (
        <section className="dash-ai-plan">
          <div className="dash-ai-plan-header">
            <div>
              <h2>AI Plan</h2>
              {aiPlan?.summary && <p>{aiPlan.summary}</p>}
              {planError && <p className="dash-plan-error">{planError}</p>}
              {planMessage && <p className="dash-plan-message">{planMessage}</p>}
            </div>
            <div className="dash-ai-plan-actions">
              <button
                type="button"
                onClick={handleApplyPlan}
                disabled={!aiPlan || selectedPlanBlockIds.size === 0}
              >
                Apply Selected
              </button>
              <button type="button" onClick={() => setAiPlan(null)} disabled={!aiPlan}>
                Clear
              </button>
            </div>
          </div>
          {aiPlan?.warnings?.length > 0 && (
            <div className="dash-plan-warnings">
              {aiPlan.warnings.map((warning, index) => (
                <span key={`warning-${index}`}>{warning}</span>
              ))}
            </div>
          )}
          {aiPlan?.blocks?.length > 0 && (
            <div className="dash-plan-blocks">
              {aiPlan.blocks.map((block) => (
                <label key={block.id} className={`dash-plan-block ${block.itemId ? '' : 'suggestion-only'}`}>
                  <input
                    type="checkbox"
                    checked={selectedPlanBlockIds.has(block.id)}
                    disabled={!block.itemId}
                    onChange={() => togglePlanBlock(block.id)}
                  />
                  <span className="dash-plan-time">
                    {formatDateLabel(block.date)} {block.start}-{block.end}
                  </span>
                  <span className="dash-plan-title">
                    {block.title}
                    {!block.itemId && <span className="dash-plan-tag">preview only</span>}
                  </span>
                  <span className={`dash-plan-kind kind-${block.kind}`}>{block.kind}</span>
                  {block.reason && <span className="dash-plan-reason">{block.reason}</span>}
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="dash-stat-grid" aria-label="Dashboard summary">
        {plannerInclude.tasks && (
        <button type="button" className="dash-stat" onClick={() => onNavigate('tasks', 'today')}>
          <span className="dash-stat-label">Today</span>
          <strong>{counts.today || 0}</strong>
          <span>scheduled items</span>
        </button>
        )}
        {plannerInclude.tasks && (
        <button type="button" className="dash-stat" onClick={() => onNavigate('tasks', 'reschedule')}>
          <span className="dash-stat-label">Needs Review</span>
          <strong>{visibleOverdueItems.length + (counts.reschedule || 0)}</strong>
          <span>overdue or flagged</span>
        </button>
        )}
        {(plannerInclude.tasks || plannerInclude.events || plannerInclude.study) && (
        <button type="button" className="dash-stat" onClick={() => onNavigate('tasks', 'week')}>
          <span className="dash-stat-label">This Week</span>
          <strong>{upcomingWeek.length}</strong>
          <span>active items</span>
        </button>
        )}
        {plannerInclude.study && (
        <button type="button" className="dash-stat" onClick={() => onNavigate('studyQueue')}>
          <span className="dash-stat-label">Study Queue</span>
          <strong>{studyDue}</strong>
          <span>reviews due</span>
        </button>
        )}
        {plannerInclude.jobs && (
          <button type="button" className="dash-stat" onClick={() => onNavigate('jobs')}>
            <span className="dash-stat-label">Jobs</span>
            <strong>{activeJobs}</strong>
            <span>{interviewingJobs} interviewing</span>
          </button>
        )}
      </section>

      <div className="dash-layout">
        {(plannerInclude.tasks || plannerInclude.events || plannerInclude.study) && (
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>Today</h2>
            <button type="button" onClick={() => onNavigate('tasks', 'today')}>View</button>
          </div>
          {visibleTodayItems.length > 0 ? (
            <div className="dash-list">{visibleTodayItems.map((item) => <MiniItem key={item.id} item={item} onOpenItem={onOpenItem} />)}</div>
          ) : (
            <div className="dash-empty">Nothing scheduled for today.</div>
          )}
        </section>
        )}

        {plannerInclude.tasks && (
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>Needs Attention</h2>
            <button type="button" onClick={() => onNavigate('dailyReview')}>Review</button>
          </div>
          {visibleOverdueItems.length > 0 ? (
            <div className="dash-list">{visibleOverdueItems.map((item) => <MiniItem key={item.id} item={item} onOpenItem={onOpenItem} />)}</div>
          ) : (
            <div className="dash-empty">No overdue items.</div>
          )}
        </section>
        )}

        {plannerInclude.tasks && (
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>Inbox</h2>
            <button type="button" onClick={() => onNavigate('tasks', 'inbox')}>Open</button>
          </div>
          {visibleInboxItems.length > 0 ? (
            <div className="dash-list">{visibleInboxItems.map((item) => <MiniItem key={item.id} item={item} onOpenItem={onOpenItem} />)}</div>
          ) : (
            <div className="dash-empty">Inbox is clear.</div>
          )}
        </section>
        )}

        {(plannerInclude.classes || plannerInclude.study || plannerInclude.jobs) && (
        <section className="dash-panel">
          <div className="dash-panel-header">
            <h2>School And Jobs</h2>
            <button type="button" onClick={() => onNavigate('jobs')}>Jobs</button>
          </div>
          <div className="dash-metric-stack">
            <div className="dash-metric-row">
              <span>Upcoming exams</span>
              <strong>{visibleUpcomingExams.length}</strong>
            </div>
            {plannerInclude.tasks && (
            <div className="dash-metric-row">
              <span>High priority open</span>
              <strong>{highPriority}</strong>
            </div>
            )}
            {plannerInclude.jobs && (
              <>
            <div className="dash-metric-row">
              <span>Applications tracked</span>
              <strong>{jobs.length}</strong>
            </div>
            <div className="dash-metric-row">
              <span>Active jobs</span>
              <strong>{activeJobs}</strong>
            </div>
            <div className="dash-metric-row">
              <span>Interviewing</span>
              <strong>{interviewingJobs}</strong>
            </div>
              </>
            )}
          </div>
          {visibleUpcomingExams.length > 0 && (
            <div className="dash-list dash-list-spaced">
              {visibleUpcomingExams.map((item) => <MiniItem key={item.id} item={item} onOpenItem={onOpenItem} />)}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
