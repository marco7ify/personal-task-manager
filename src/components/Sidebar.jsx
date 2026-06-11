import { useState, useEffect, useRef } from 'react';
import { Store, getToday } from '../utils/store';
import { getCounts } from '../utils/filters';
import { ProjectPropertyPanel } from './ProjectPropertyPanel';
import { ViewProjectsSettingsModal } from './ViewProjectsSettingsModal';
import { ProjectsBadgeSettingsModal } from './ProjectsBadgeSettingsModal';
import { NotebooksTree } from './NotebooksTree';
import { SchoolTree } from './SchoolTree';
import { isCourseProject } from '../utils/school';
import '../styles/Sidebar.css';
import '../styles/Notebook.css';
import '../styles/School.css';

export function Sidebar({ currentView, currentFilter, currentProjectId, currentCourseId, currentExamId, currentSemesterId, currentPageId, onNavigate, counts, onUpdate }) {
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [viewProjectsSettingsOpen, setViewProjectsSettingsOpen] = useState(false);
  const [badgeSettingsOpen, setBadgeSettingsOpen] = useState(false);
  const [highlightedInboxProjects, setHighlightedInboxProjects] = useState(new Set());
  const prevInboxCountsRef = useRef({});

  const excluded = Store.settings.viewExcludedProjectIds || [];
  const projectCounts =
    counts && Object.keys(counts).length
      ? counts
      : getCounts(Store.items, excluded);

  const today = getToday();
  const inGlobalViews = currentView === 'tasks';

  // Track per-project inbox count; highlight when it increases
  useEffect(() => {
    const prev = prevInboxCountsRef.current;
    const next = {};
    const toHighlight = [];

    Store.projects.filter((p) => !isCourseProject(p)).forEach((p) => {
      next[p.id] = Store.items.filter(
        (i) => i.pid === p.id && !i.date && !i.done && !i.archived
      ).length;
      // prev[p.id] undefined on first mount -> set equal so no false highlight
      const prevCount = prev[p.id] ?? next[p.id];
      if (next[p.id] > prevCount) toHighlight.push(p.id);
    });

    prevInboxCountsRef.current = next;

    if (toHighlight.length > 0) {
      setHighlightedInboxProjects((s) => {
        const ns = new Set(s);
        toHighlight.forEach((id) => ns.add(id));
        return ns;
      });
    }
  }, [counts]);

  const dismissHighlight = (e, pid) => {
    e.stopPropagation();
    setHighlightedInboxProjects((s) => {
      const ns = new Set(s);
      ns.delete(pid);
      return ns;
    });
  };

  const handleProjectAdd = () => {
    const newProject = {
      id: 'p' + Date.now(),
      name: 'New Project',
      icon: '📁',
      color: '#2383E2',
      customProps: {},
      showInboxBadge: Store.settings.defaultShowInboxBadge !== false,
      showTodayBadge: Store.settings.defaultShowTodayBadge !== false,
    };
    Store.projects.push(newProject);
    Store.save();
    setEditingProjectId(newProject.id);
    onUpdate?.();
  };

  const handleProjectEdit = (e, projectId) => {
    e.stopPropagation();
    setEditingProjectId(projectId);
  };

  const handleReset = () => {
    Store.reset();
  };

  /** Resolve badge visibility: per-project flag, falling back to global default */
  const badgeEnabled = (proj, key, defaultKey) => {
    if (proj[key] !== undefined) return proj[key];
    return Store.settings[defaultKey] !== false;
  };

  return (
    <nav className="sidebar" id="sidebar">
      <div className="sidebar-brand">⚡ Ultimate Tasks</div>

      <div className="sidebar-header">
        <span>Start</span>
      </div>
      <button
        className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
        onClick={() => onNavigate('home')}
      >
        <span>Home</span>
        <span>Dashboard</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'dailyReview' ? 'active' : ''}`}
        onClick={() => onNavigate('dailyReview')}
      >
        <span>Review</span>
        <span>Daily Review</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'help' ? 'active' : ''}`}
        onClick={() => onNavigate('help')}
      >
        <span>?</span>
        <span>Help</span>
      </button>
      <div className="sidebar-header">
        <span>Global Views</span>
        <button
          className="sidebar-views-settings"
          onClick={() => setViewProjectsSettingsOpen(true)}
          title="Configure which projects appear in global views"
          aria-label="Configure global view projects"
        >
          ⚙️
        </button>
      </div>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'all' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'all')}
      >
        <span>≡</span>
        <span>All Items</span>
        <span className="sidebar-count">{projectCounts.all}</span>
      </button>
      {false && (
        <>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'inbox' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'inbox')}
      >
        <span>📥</span>
        <span>Inbox</span>
        <span className="sidebar-count">{projectCounts.inbox}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'nofolder' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'nofolder')}
      >
        <span>📭</span>
        <span>No folder assigned</span>
        <span className="sidebar-count">{projectCounts.nofolder}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'today' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'today')}
      >
        <span>☀️</span>
        <span>Today</span>
        <span className="sidebar-count">{projectCounts.today}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'week' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'week')}
      >
        <span>📅</span>
        <span>Next 7 Days</span>
        <span className="sidebar-count">{projectCounts.week}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'month' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'month')}
      >
        <span>🗓</span>
        <span>Month</span>
        <span className="sidebar-count">{projectCounts.month}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'reschedule' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'reschedule')}
      >
        <span>⚠️</span>
        <span>Reschedule</span>
        <span className="sidebar-count">{projectCounts.reschedule}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'done' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'done')}
      >
        <span>✅</span>
        <span>Done</span>
        <span className="sidebar-count">{projectCounts.done}</span>
      </button>
      <button
        className={`sidebar-item ${currentView === 'tasks' && currentFilter === 'archived' ? 'active' : ''}`}
        onClick={() => onNavigate('tasks', 'archived')}
      >
        <span>📦</span>
        <span>Archived</span>
        <span className="sidebar-count">{projectCounts.archived}</span>
      </button>
        </>
      )}

      <div className="sidebar-header">
        <span>Projects</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-add-btn"
            onClick={() => setBadgeSettingsOpen(true)}
            title="Project badge defaults"
            aria-label="Project badge defaults"
          >
            🏷
          </button>
          <button className="sidebar-add-btn" onClick={handleProjectAdd} title="Add Project">+</button>
        </div>
      </div>
      <div id="sidebarProjects">
        {Store.projects.filter((p) => !isCourseProject(p)).map((p) => {
          const total = Store.items.filter((i) => i.pid === p.id).length;
          const done = Store.items.filter((i) => i.pid === p.id && i.done).length;
          const progress = total > 0 ? Math.round((done / total) * 100) : 0;
          const isActive = currentView === 'project' && currentProjectId === p.id;

          const showInboxBadge = badgeEnabled(p, 'showInboxBadge', 'defaultShowInboxBadge');
          const showTodayBadge = badgeEnabled(p, 'showTodayBadge', 'defaultShowTodayBadge');

          const inboxCount = showInboxBadge
            ? Store.items.filter((i) => i.pid === p.id && !i.date && !i.done && !i.archived).length
            : 0;
          const todayCount = showTodayBadge
            ? Store.items.filter((i) => i.pid === p.id && i.date === today && !i.done && !i.archived).length
            : 0;

          const isHighlighted = highlightedInboxProjects.has(p.id);

          return (
            <div
              key={p.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate('project', null, p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate('project', null, p.id);
                }
              }}
            >
              <span>{p.icon}</span>
              <span className="sidebar-project-name">{p.name}</span>

              {showInboxBadge && inboxCount > 0 && (
                <span
                  className={`sidebar-project-badge inbox-badge${isHighlighted ? ' highlighted' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isHighlighted) dismissHighlight(e, p.id);
                    onNavigate('project', 'inbox', p.id);
                  }}
                  title={isHighlighted ? 'New from inbox - click to open' : `${inboxCount} unscheduled - click to open`}
                  aria-label={`Unscheduled: ${inboxCount}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isHighlighted) dismissHighlight(e, p.id);
                      onNavigate('project', 'inbox', p.id);
                    }
                  }}
                >
                  📥 {inboxCount}
                </span>
              )}

              {showTodayBadge && todayCount > 0 && (
                <span
                  className="sidebar-project-badge today-badge"
                  title={`${todayCount} due today`}
                  aria-label={`Due today: ${todayCount}`}
                >
                  ❗{todayCount}
                </span>
              )}

              <button
                className="sidebar-project-edit"
                onClick={(e) => handleProjectEdit(e, p.id)}
                title="Edit project"
              >
                ⚙️
              </button>
              <div
                className="sidebar-ring"
                style={{
                  background: `conic-gradient(${p.color || 'var(--accent)'} ${progress}%, var(--border) 0)`
                }}
              />
            </div>
          );
        })}
      </div>

      <NotebooksTree
        currentPageId={currentPageId}
        onNavigate={onNavigate}
        onUpdate={onUpdate}
        sectionTitle="Notebooks"
        schoolMode="regular"
      />

      <SchoolTree
        currentView={currentView}
        currentCourseId={currentCourseId}
        currentExamId={currentExamId}
        currentSemesterId={currentSemesterId}
        onNavigate={onNavigate}
        onUpdate={onUpdate}
      />

      <button
        className={`sidebar-item ${currentView === 'studyQueue' ? 'active' : ''}`}
        onClick={() => onNavigate('studyQueue')}
      >
        <span>Study</span>
        <span>Study Queue</span>
      </button>

      {!inGlobalViews && (
        <NotebooksTree
          currentPageId={currentPageId}
          onNavigate={onNavigate}
          onUpdate={onUpdate}
          sectionTitle="School Notebooks"
          schoolMode="school"
          allowAddRoot={false}
          emptyLabel="No school notebooks yet."
        />
      )}

      <div className="sidebar-header">
        <span>Jobs</span>
      </div>
      <button
        className={`sidebar-item ${currentView === 'jobs' ? 'active' : ''}`}
        onClick={() => onNavigate('jobs')}
      >
        <span>Jobs</span>
        <span>Applications</span>
        <span className="sidebar-count">{(Store.jobs || []).length}</span>
      </button>

      <div style={{ flex: 1 }} />

      <button className="sidebar-item" onClick={() => onNavigate('settings')}>
        <span>⚙️</span>
        <span>Settings</span>
      </button>
      <button className="sidebar-item danger" onClick={handleReset}>
        <span>🗑</span>
        <span>Reset All Data</span>
      </button>

      {editingProjectId && (
        <ProjectPropertyPanel
          projectId={editingProjectId}
          onClose={() => setEditingProjectId(null)}
          onSave={() => {
            setEditingProjectId(null);
            onUpdate?.();
          }}
        />
      )}

      {viewProjectsSettingsOpen && (
        <ViewProjectsSettingsModal
          onClose={() => setViewProjectsSettingsOpen(false)}
          onSave={() => onUpdate?.()}
        />
      )}

      {badgeSettingsOpen && (
        <ProjectsBadgeSettingsModal
          onClose={() => setBadgeSettingsOpen(false)}
          onSave={() => onUpdate?.()}
        />
      )}
    </nav>
  );
}
