import { useState, useEffect } from 'react';
import { Store } from './utils/store';
import { logout, refreshAuthToken, subscribeToAuthChanges, verifyToken } from './utils/api';
import { getFilteredItems, getCounts } from './utils/filters';
import { getNextDate, getToday, getAllowedModes } from './utils/store';
import { Sidebar } from './components/Sidebar';
import { TaskInput } from './components/TaskInput';
import { PropertyPanel } from './components/PropertyPanel';
import { ViewSelector } from './components/ViewSelector';
import { ViewConfigModal } from './components/ViewConfigModal';
import { SidebarInboxRulesHint } from './components/InboxRulesHint';
import { Settings } from './components/Settings';
import { PageView } from './components/PageView';
import { CourseView } from './components/CourseView';
import { ExamView } from './components/ExamView';
import { SemesterView } from './components/SemesterView';
import { JobsView } from './components/JobsView';
import { AIIntakeView } from './components/AIIntakeView';
import { AIReschedulerPanel } from './components/AIReschedulerPanel';
import { DashboardView } from './components/DashboardView';
import { DailyReviewView } from './components/DailyReviewView';
import { StudyQueueView } from './components/StudyQueueView';
import { HelpView } from './components/HelpView';
import { NotificationCenter } from './components/NotificationCenter';
import { Login } from './components/Login';
import { getSemesters, isCourseProject, UNASSIGNED_SEMESTER_ID } from './utils/school';
import { ListView } from './components/views/ListView';
import { ScheduleView } from './components/views/ScheduleView';
import { BoardView } from './components/views/BoardView';
import { CalendarView } from './components/views/CalendarView';
import './styles/variables.css';
import './styles/App.css';
import './styles/View.css';
import './styles/Input.css';
import './styles/Button.css';
import './styles/Properties.css';
import './styles/ViewConfig.css';
import './styles/Mastery.css';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProjectFilter, setCurrentProjectFilter] = useState('all');
  const [currentPageId, setCurrentPageId] = useState(null);
  const [currentCourseId, setCurrentCourseId] = useState(null);
  const [currentExamId, setCurrentExamId] = useState(null);
  const [currentSemesterId, setCurrentSemesterId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyPanelItemId, setPropertyPanelItemId] = useState(null);
  const [currentViewId, setCurrentViewId] = useState(null);
  const [configuringViewId, setConfiguringViewId] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [counts, setCounts] = useState({});
  const [globalMonthProjectIds, setGlobalMonthProjectIds] = useState([]);
  const [globalMonthSemesterIds, setGlobalMonthSemesterIds] = useState([]);
  const [showInlineNotes, setShowInlineNotes] = useState(false);
  const [inboxAiOpen, setInboxAiOpen] = useState(false);
  const [lastViewContext, setLastViewContext] = useState(null);
  const [schoolPagePopupId, setSchoolPagePopupId] = useState(null);
  const [schoolPagePopupExpanded, setSchoolPagePopupExpanded] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  // 'loading' | 'unauth' | 'ready'
  const [appState, setAppState] = useState('loading');

  const initApp = async () => {
    await Store.load();
    const t = Store.settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    setTheme(t);
    setShowInlineNotes(!!Store.settings.showInlineNotes);
    setCounts(getCounts(Store.items, Store.settings.viewExcludedProjectIds || []));
    setAppState('ready');
  };

  useEffect(() => {
    const subscription = subscribeToAuthChanges((session) => {
      if (!session) setAppState('unauth');
    });

    const boot = async () => {
      await refreshAuthToken();
      const authed = await verifyToken();
      if (!authed) {
        setAppState('unauth');
        return;
      }
      await initApp();
    };
    boot();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!schoolPagePopupId) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSchoolPagePopupId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [schoolPagePopupId]);

  const handleUpdate = () => {
    setCounts(getCounts(Store.items, Store.settings.viewExcludedProjectIds || []));
    setUpdateTrigger(t => t + 1);
  };

  const handleOpenPropertyPanel = (itemId) => {
    const id = typeof itemId === 'number' ? itemId : parseInt(itemId, 10);
    if (!Number.isNaN(id)) setPropertyPanelItemId(id);
  };

  const handleToggleInlineNotes = () => {
    const next = !showInlineNotes;
    Store.settings.showInlineNotes = next;
    Store.save();
    setShowInlineNotes(next);
  };

  /** Week board / month calendar: open property panel (virtual occurrences → base task) */
  const handleOpenTaskDetail = (item) => {
    const rawId = item?.__virtual ? item.__baseId : item?.id;
    if (rawId == null) return;
    const id = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
    if (!Number.isNaN(id)) setPropertyPanelItemId(id);
  };

  const getCurrentContext = () => ({
    view: currentView,
    filter: currentView === 'project' ? currentProjectFilter : currentFilter,
    projectOrCourseId:
      currentView === 'course' || currentView === 'examDetail'
        ? currentCourseId
        : currentView === 'semester'
          ? currentSemesterId
          : currentView === 'project'
            ? currentProjectId
            : null,
    pageId: currentView === 'page' ? currentPageId : null,
    examId: currentView === 'examDetail' ? currentExamId : null
  });

  const handleNavigate = (view, filter, projectOrCourseId, pageId, examId, options) => {
    const fromSchoolView =
      currentView === 'course' || currentView === 'examDetail' || currentView === 'semester';
    const shouldOpenSchoolPopup =
      view === 'page' &&
      !!pageId &&
      !options?.forceMainPage &&
      (options?.openAsPopup || fromSchoolView || !!schoolPagePopupId);

    if (shouldOpenSchoolPopup) {
      setSchoolPagePopupId(pageId);
      return;
    }

    if (view !== 'page' || options?.forceMainPage) {
      setSchoolPagePopupId(null);
    }

    if (!options?.skipHistory) {
      setLastViewContext(getCurrentContext());
    }
    setCurrentView(view);
    if (filter) {
      if (view === 'project') {
        setCurrentProjectFilter(filter);
      } else {
        setCurrentFilter(filter);
      }
    }
    if (view === 'course' || view === 'examDetail') {
      if (projectOrCourseId) setCurrentCourseId(projectOrCourseId);
      if (view === 'examDetail' && examId != null) setCurrentExamId(examId);
    } else if (view === 'semester') {
      setCurrentSemesterId(projectOrCourseId || null);
    } else if (projectOrCourseId) {
      setCurrentProjectId(projectOrCourseId);
    }
    if (view === 'page' && pageId) setCurrentPageId(pageId);

    if (view !== 'page' && view !== 'course' && view !== 'examDetail' && view !== 'semester') {
      const nextAllowed = getAllowedModes(filter);
      if (filter === 'week') setViewMode('board');
      else if (filter === 'month') setViewMode('calendar');
      else if (!nextAllowed.includes(viewMode)) setViewMode('list');
    }
  };

  const getContextLabel = (context) => {
    if (!context?.view) return { label: '', icon: '' };
    if (context.view === 'course') {
      const course = (Store.projects || []).find((p) => p.id === context.projectOrCourseId);
      return { label: course?.name || 'Course', icon: course?.icon || '📚' };
    }
    if (context.view === 'examDetail') {
      const exam = (Store.items || []).find((it) => it.id === context.examId);
      return { label: exam?.text || 'Exam', icon: '📘' };
    }
    if (context.view === 'semester') {
      const semester = (Store.semesters || []).find((s) => s.id === context.projectOrCourseId);
      return { label: semester?.name || 'Semester', icon: '🎓' };
    }
    if (context.view === 'project') {
      const project = (Store.projects || []).find((p) => p.id === context.projectOrCourseId);
      return { label: project?.name || 'Project', icon: project?.icon || '📁' };
    }
    if (context.view === 'page') {
      const page = (Store.pages || []).find((p) => p.id === context.pageId);
      return { label: page?.title || 'Page', icon: page?.icon || '📄' };
    }
    if (context.view === 'settings') return { label: 'Settings', icon: '⚙️' };
    if (context.view === 'studyQueue') return { label: 'Study Queue', icon: 'Study' };
    if (context.view === 'jobs') return { label: 'Jobs', icon: 'Jobs' };
    const labels = {
      inbox: 'Inbox',
      today: 'Today',
      week: 'Week',
      month: 'Month',
      all: 'All Items',
      done: 'Done',
      archived: 'Archived',
      reschedule: 'Reschedule',
      nofolder: 'No folder'
    };
    return { label: labels[context.filter] || 'Tasks', icon: '📋' };
  };

  const handleNavigateBack = () => {
    if (!lastViewContext?.view) return;
    handleNavigate(
      lastViewContext.view,
      lastViewContext.filter,
      lastViewContext.projectOrCourseId,
      lastViewContext.pageId,
      lastViewContext.examId,
      { skipHistory: true }
    );
  };

  const resolveItemId = (id) => {
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    const n = parseInt(id, 10);
    if (!Number.isNaN(n)) return n;
    return Store.items.find((i) => String(i.id) === String(id))?.id;
  };

  const handleToggle = (id, baseId, dateStr) => {
    if (baseId && dateStr) {
      const bid = resolveItemId(baseId);
      const base = bid != null ? Store.items.find((i) => i.id === bid) : null;
      if (base) {
        const nextDate = getNextDate(dateStr, base.recurrence, base.recurDetails);
        Store.items.push({
          ...base,
          id: Date.now(),
          date: nextDate,
          done: true,
          archived: false,
          reschedule: false,
          recurrence: 'none',
          recurDetails: null,
          createdAt: Date.now()
        });
        Store.save();
        handleUpdate();
      }
      return;
    }

    const rid = resolveItemId(id);
    const item = rid != null ? Store.items.find((i) => i.id === rid) : null;
    if (item) {
      if (item.recurrence && item.recurrence !== 'none' && !item.done) {
        const nextDate = getNextDate(item.date || getToday(), item.recurrence, item.recurDetails);
        Store.items.push({
          ...item,
          id: Date.now(),
          date: nextDate,
          done: false,
          archived: false,
          reschedule: false,
          createdAt: Date.now()
        });
      }
      item.done = !item.done;
      Store.save();
      handleUpdate();
    }
  };

  const handleDelete = (id) => {
    if (confirm('Delete this item?')) {
      Store.items = Store.items.filter(i => i.id !== parseInt(id, 10));
      Store.save();
      handleUpdate();
    }
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('taskId', String(id));
    e.dataTransfer.effectAllowed = 'move';
  };

  /** Clear only due date & time — keeps folder, tags, custom fields */
  const handleUnscheduleToInbox = (e) => {
    e.preventDefault();
    e.currentTarget?.classList?.remove('drag-over');
    const raw = e.dataTransfer.getData('taskId');
    if (!raw) return;
    const idNum = parseInt(raw, 10);
    const t = Store.items.find((x) => x.id === idNum || String(x.id) === raw);
    if (!t || t.archived) return;
    t.date = null;
    t.time = null;
    Store.save();
    handleUpdate();
  };

  const handleDropTime = (e, timeVal) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('taskId');
    if (!raw) return;
    const idNum = parseInt(raw, 10);
    const t = Store.items.find((x) => x.id === idNum || String(x.id) === raw);
    if (t) {
      const today = getToday();
      if (!t.date) t.date = today;
      t.time = timeVal || null;
      Store.save();
      handleUpdate();
    }
  };

  const handleDropDate = (e, dateVal) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('taskId');
    if (!raw) return;
    const idNum = parseInt(raw, 10);
    const t = Store.items.find((x) => x.id === idNum || String(x.id) === raw);
    if (t) {
      t.date = dateVal || null;
      if (!dateVal) t.time = null;
      Store.save();
      handleUpdate();
    }
  };

  const filter = currentView === 'project' ? currentProjectFilter : currentFilter;
  const projectId = currentView === 'project' ? currentProjectId : null;
  const viewFilterOpts = {
    viewExcludedProjectIds: Store.settings.viewExcludedProjectIds || []
  };
  const items = getFilteredItems(Store.items, filter, projectId, searchQuery, viewFilterOpts);
  const globalProjectOptions = (Store.projects || []).filter((p) => !isCourseProject(p));
  const globalSemesterOptions = getSemesters();
  const monthFilteredItems =
    currentView === 'tasks' && currentFilter === 'month'
      ? items.filter((item) => {
          if (globalMonthProjectIds.length > 0) {
            if (!item.pid || !globalMonthProjectIds.includes(item.pid)) return false;
          }
          if (globalMonthSemesterIds.length > 0) {
            if (!item.pid) return false;
            const project = (Store.projects || []).find((p) => p.id === item.pid);
            if (!project || !isCourseProject(project)) return false;
            const sid = project.semesterId || UNASSIGNED_SEMESTER_ID;
            if (!globalMonthSemesterIds.includes(sid)) return false;
          }
          return true;
        })
      : items;
  const visibleItems = monthFilteredItems;
  const allowedModes = getAllowedModes(filter);

  const pageTitle = {
    inbox: '📥 Inbox',
    today: '☀️ Today',
    week: '📅 Next 7 Days',
    month: '🗓 Month',
    all: '≡ All Items',
    done: '✅ Done',
    reschedule: '⚠️ Reschedule',
    archived: '📦 Archived',
    nofolder: '📭 No folder assigned'
  }[filter] || 'Tasks';

  const renderView = () => {
    if (currentView === 'home') {
      return (
        <DashboardView
          onNavigate={handleNavigate}
          onOpenItem={handleOpenPropertyPanel}
        />
      );
    }

    if (currentView === 'dailyReview') {
      return (
        <DailyReviewView
          onNavigate={handleNavigate}
          onOpenItem={handleOpenPropertyPanel}
          onUpdate={handleUpdate}
        />
      );
    }

    if (currentView === 'studyQueue') {
      return (
        <StudyQueueView
          onNavigate={handleNavigate}
          onUpdate={handleUpdate}
        />
      );
    }

    if (currentView === 'settings') {
      return <Settings onBack={() => handleNavigate('tasks', 'all')} onUpdate={handleUpdate} />;
    }

    if (currentView === 'help') {
      return (
        <HelpView
          onNavigate={handleNavigate}
          onNavigateBack={handleNavigateBack}
          onUpdate={handleUpdate}
        />
      );
    }

    if (currentView === 'jobs') {
      return <JobsView onUpdate={handleUpdate} />;
    }

    if (currentView === 'page') {
      const contextLabel = getContextLabel(lastViewContext);
      return (
        <PageView
          pageId={currentPageId}
          onNavigate={handleNavigate}
          onNavigateBack={handleNavigateBack}
          backButtonLabel={lastViewContext?.view ? contextLabel.label : null}
          backButtonIcon={lastViewContext?.view ? contextLabel.icon : null}
          onUpdate={handleUpdate}
          onOpenItem={handleOpenPropertyPanel}
        />
      );
    }

    if (currentView === 'course') {
      return (
        <CourseView
          courseId={currentCourseId}
          onNavigate={handleNavigate}
          onUpdate={handleUpdate}
          onOpenItemPanel={handleOpenPropertyPanel}
        />
      );
    }

    if (currentView === 'examDetail') {
      return (
        <ExamView
          examId={currentExamId}
          courseId={currentCourseId}
          onNavigate={handleNavigate}
          onUpdate={handleUpdate}
          onOpenItemPanel={handleOpenPropertyPanel}
        />
      );
    }

    if (currentView === 'semester') {
      return (
        <SemesterView
          semesterId={currentSemesterId}
          onNavigate={handleNavigate}
          onUpdate={handleUpdate}
          onOpenItemPanel={handleOpenPropertyPanel}
        />
      );
    }

    if (currentView === 'project') {
      const project = Store.projects.find(p => p.id === currentProjectId);
      if (!project) return null;

      return (
        <>
          <div className="header-row">
            <h1 className="page-title">{project.icon} {project.name}</h1>
            <div className="header-controls">
              <div className="view-toggle-group">
                {['list', 'schedule', 'board', 'calendar'].map(mode => (
                  <button
                    key={mode}
                    className={`view-toggle ${viewMode === mode ? 'active' : ''}`}
                    disabled={!allowedModes.includes(mode)}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              <button
                className={`view-toggle standalone ${showInlineNotes ? 'active' : ''}`}
                onClick={handleToggleInlineNotes}
                title={showInlineNotes ? 'Hide notes under tasks/events' : 'Show notes under tasks/events'}
              >
                Notes inline
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleNavigate('tasks', 'all')}>
                ← Back
              </button>
            </div>
          </div>

          <div className="filter-bar">
            {['all', 'inbox', 'today', 'week', 'month', 'reschedule', 'done'].map(f => (
              <button
                key={f}
                className={`filter-btn ${currentProjectFilter === f ? 'active' : ''}`}
                onClick={() => handleNavigate('project', f)}
              >
                {f === 'inbox' ? '📥 Backlog' : f === 'all' ? '≡ All' : f === 'today' ? '☀️ Today' : f === 'week' ? '📅 Week' : f === 'month' ? '🗓 Month' : f === 'reschedule' ? '⚠️ Reschedule' : '✅ Done'}
              </button>
            ))}
          </div>

          <TaskInput
            filter={currentProjectFilter}
            projectId={currentProjectId}
            onAdd={() =>
              setCounts(getCounts(Store.items, Store.settings.viewExcludedProjectIds || []))
            }
          />

          {viewMode === 'board' && currentProjectFilter === 'week' && (
            <BoardView
              items={items}
              includeInboxBacklog
              backlogProjectId={currentProjectId}
              viewExcludedProjectIds={[]}
              onDragStart={handleDragStart}
              onDrop={handleDropDate}
              onDropUnschedule={handleUnscheduleToInbox}
              onToggle={handleToggle}
              onOpenTask={handleOpenTaskDetail}
            />
          )}
          {viewMode === 'schedule' && currentProjectFilter === 'today' && (
            <ScheduleView
              items={items}
              onToggle={handleToggle}
              onDragStart={handleDragStart}
              onDrop={handleDropTime}
              includeInboxBacklog
              backlogProjectId={currentProjectId}
              viewExcludedProjectIds={[]}
              onDropUnschedule={handleUnscheduleToInbox}
              onOpenTask={handleOpenTaskDetail}
            />
          )}
          {viewMode === 'calendar' && currentProjectFilter === 'month' && (
            <CalendarView
              items={items}
              onToggle={handleToggle}
              onDragStart={handleDragStart}
              onDrop={handleDropDate}
              onOpenTask={handleOpenTaskDetail}
              includeInboxBacklog
              backlogProjectId={currentProjectId}
              viewExcludedProjectIds={[]}
              onDropUnschedule={handleUnscheduleToInbox}
            />
          )}
          {(viewMode === 'list' || !allowedModes.includes(viewMode)) && (
            <ListView 
              items={items} 
              onToggle={handleToggle} 
              onDelete={handleDelete} 
              onEdit={handleOpenPropertyPanel}
              viewId={currentViewId}
              onUpdate={handleUpdate}
              groupBySubfolder
              showInlineNotes={showInlineNotes}
              showInboxReasons={currentProjectFilter === 'inbox'}
            />
          )}
        </>
      );
    }

    return (
      <>
        <div className="header-row">
          <h1 className="page-title">{pageTitle}</h1>
          <div className="header-controls">
            <input
              type="search"
              className="search-input"
              placeholder="🔍 Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <ViewSelector
              currentViewId={currentViewId}
              onSelectView={setCurrentViewId}
              onConfigureView={setConfiguringViewId}
            />
            <button
              className={`view-toggle standalone ${showInlineNotes ? 'active' : ''}`}
              onClick={handleToggleInlineNotes}
              title={showInlineNotes ? 'Hide notes under tasks/events' : 'Show notes under tasks/events'}
            >
              Notes inline
            </button>
            <button
              className="btn-icon"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                Store.settings.theme = next;
                Store.save();
                document.documentElement.setAttribute('data-theme', next);
                setTheme(next);
              }}
              title="Toggle Theme"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="view-toggle-group">
              {['list', 'schedule', 'board', 'calendar'].map(mode => (
                <button
                  key={mode}
                  className={`view-toggle ${viewMode === mode ? 'active' : ''}`}
                  disabled={!allowedModes.includes(mode)}
                  onClick={() => setViewMode(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="filter-bar">
          {['all', 'inbox', 'nofolder', 'today', 'week', 'month', 'reschedule', 'done', 'archived'].map((f) => (
            <button
              key={f}
              className={`filter-btn ${currentFilter === f ? 'active' : ''}`}
              onClick={() => handleNavigate('tasks', f)}
            >
              {f === 'all'
                ? '≡ All'
                : f === 'inbox'
                  ? '📥 Inbox'
                  : f === 'nofolder'
                    ? '📭 No folder'
                    : f === 'today'
                      ? '☀️ Today'
                      : f === 'week'
                        ? '📅 Week'
                        : f === 'month'
                          ? '🗓 Month'
                          : f === 'reschedule'
                            ? '⚠️ Reschedule'
                            : f === 'done'
                              ? '✅ Done'
                              : '📦 Archived'}
            </button>
          ))}
        </div>

        {currentView === 'tasks' && currentFilter === 'month' && (
          <div className="month-filter-row">
            <details className="month-multiselect">
              <summary>
                Projects
                <span className="month-multiselect-count">
                  {globalMonthProjectIds.length === 0 ? 'All' : globalMonthProjectIds.length}
                </span>
              </summary>
              <div className="month-multiselect-menu">
                {globalProjectOptions.length === 0 ? (
                  <div className="month-multiselect-empty">No projects</div>
                ) : (
                  globalProjectOptions.map((p) => (
                    <label key={p.id} className="month-multiselect-option">
                      <input
                        type="checkbox"
                        checked={globalMonthProjectIds.includes(p.id)}
                        onChange={() => {
                          setGlobalMonthProjectIds((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                          );
                        }}
                      />
                      <span>{p.icon} {p.name}</span>
                    </label>
                  ))
                )}
              </div>
            </details>

            <details className="month-multiselect">
              <summary>
                Semesters
                <span className="month-multiselect-count">
                  {globalMonthSemesterIds.length === 0 ? 'All' : globalMonthSemesterIds.length}
                </span>
              </summary>
              <div className="month-multiselect-menu">
                <label className="month-multiselect-option">
                  <input
                    type="checkbox"
                    checked={globalMonthSemesterIds.includes(UNASSIGNED_SEMESTER_ID)}
                    onChange={() => {
                      setGlobalMonthSemesterIds((prev) =>
                        prev.includes(UNASSIGNED_SEMESTER_ID)
                          ? prev.filter((id) => id !== UNASSIGNED_SEMESTER_ID)
                          : [...prev, UNASSIGNED_SEMESTER_ID]
                      );
                    }}
                  />
                  <span>📭 Unassigned</span>
                </label>
                {globalSemesterOptions.length === 0 ? (
                  <div className="month-multiselect-empty">No semesters</div>
                ) : (
                  globalSemesterOptions.map((sem) => (
                    <label key={sem.id} className="month-multiselect-option">
                      <input
                        type="checkbox"
                        checked={globalMonthSemesterIds.includes(sem.id)}
                        onChange={() => {
                          setGlobalMonthSemesterIds((prev) =>
                            prev.includes(sem.id)
                              ? prev.filter((id) => id !== sem.id)
                              : [...prev, sem.id]
                          );
                        }}
                      />
                      <span>🎓 {sem.name}</span>
                    </label>
                  ))
                )}
              </div>
            </details>
          </div>
        )}

        {currentView === 'tasks' && currentFilter === 'inbox' && (
          <>
            <section className={`inbox-ai-panel ${inboxAiOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="inbox-ai-toggle"
                onClick={() => setInboxAiOpen((open) => !open)}
                aria-expanded={inboxAiOpen}
              >
                <span>
                  <strong>AI Intake</strong>
                  <small>Organize pasted lists into tasks, jobs, appointments, and notebook pages.</small>
                </span>
                <span>{inboxAiOpen ? 'Hide' : 'Open'}</span>
              </button>
              {inboxAiOpen && <AIIntakeView onUpdate={handleUpdate} embedded />}
            </section>
            <SidebarInboxRulesHint />
          </>
        )}

        {currentView === 'tasks' && currentFilter === 'reschedule' && (
          <AIReschedulerPanel items={visibleItems} onUpdate={handleUpdate} compact />
        )}

        <TaskInput
          filter={currentFilter}
          onAdd={() =>
            setCounts(getCounts(Store.items, Store.settings.viewExcludedProjectIds || []))
          }
        />

        {viewMode === 'board' && currentFilter === 'week' && (
          <BoardView
            items={visibleItems}
            includeInboxBacklog
            viewExcludedProjectIds={Store.settings.viewExcludedProjectIds || []}
            onDragStart={handleDragStart}
            onDrop={handleDropDate}
            onDropUnschedule={handleUnscheduleToInbox}
            onToggle={handleToggle}
            onOpenTask={handleOpenTaskDetail}
          />
        )}
        {viewMode === 'schedule' && currentFilter === 'today' && (
          <ScheduleView
            items={visibleItems}
            onToggle={handleToggle}
            onDragStart={handleDragStart}
            onDrop={handleDropTime}
            includeInboxBacklog
            viewExcludedProjectIds={Store.settings.viewExcludedProjectIds || []}
            onDropUnschedule={handleUnscheduleToInbox}
            onOpenTask={handleOpenTaskDetail}
          />
        )}
        {viewMode === 'calendar' && currentFilter === 'month' && (
          <CalendarView
            items={visibleItems}
            onToggle={handleToggle}
            onDragStart={handleDragStart}
            onDrop={handleDropDate}
            onOpenTask={handleOpenTaskDetail}
            includeInboxBacklog
            viewExcludedProjectIds={Store.settings.viewExcludedProjectIds || []}
            onDropUnschedule={handleUnscheduleToInbox}
          />
        )}
        {(viewMode === 'list' || !allowedModes.includes(viewMode)) && (
          <ListView 
            items={visibleItems} 
            onToggle={handleToggle} 
            onDelete={handleDelete} 
            onEdit={handleOpenPropertyPanel} 
            showProject
            viewId={currentViewId}
            onUpdate={handleUpdate}
            showInlineNotes={showInlineNotes}
            showInboxReasons={currentFilter === 'inbox'}
          />
        )}
      </>
    );
  };

  if (appState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-main)',
        color: 'var(--text-sub)', fontSize: '1rem', gap: '10px'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚡</span> Loading…
      </div>
    );
  }

  if (appState === 'unauth') {
    return <Login onLogin={initApp} />;
  }

  return (
    <div className="app">
      <Sidebar
        currentView={currentView}
        currentFilter={currentFilter}
        currentProjectId={currentProjectId}
        currentCourseId={currentCourseId}
        currentExamId={currentExamId}
        currentSemesterId={currentSemesterId}
        currentPageId={currentPageId}
        onNavigate={handleNavigate}
        counts={counts}
        onUpdate={handleUpdate}
      />
      <main className="main">
        <div className="main-scroll">{renderView()}</div>
      </main>
      <NotificationCenter enabled={appState === 'ready'} />
      <button
        type="button"
        className="auth-signout-btn"
        onClick={async () => {
          await logout();
          setAppState('unauth');
        }}
        title="Sign out"
      >
        Sign out
      </button>
      {schoolPagePopupId && (
        <div className="school-page-popout-overlay" onClick={() => setSchoolPagePopupId(null)}>
          <div
            className={`school-page-popout ${schoolPagePopupExpanded ? 'expanded' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="school-page-popout-header">
              <span className="school-page-popout-title">Notebook</span>
              <div className="school-page-popout-actions">
                <button
                  type="button"
                  className="school-page-popout-btn"
                  onClick={() => setSchoolPagePopupExpanded((v) => !v)}
                  title={schoolPagePopupExpanded ? 'Collapse' : 'Expand'}
                >
                  {schoolPagePopupExpanded ? '🗗' : '🗖'}
                </button>
                <button
                  type="button"
                  className="school-page-popout-btn danger"
                  onClick={() => setSchoolPagePopupId(null)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="school-page-popout-body">
              <PageView
                pageId={schoolPagePopupId}
                onNavigate={handleNavigate}
                onNavigateBack={() => setSchoolPagePopupId(null)}
                backButtonLabel={null}
                backButtonIcon={null}
                onUpdate={handleUpdate}
                onOpenItem={handleOpenPropertyPanel}
              />
            </div>
          </div>
        </div>
      )}
      {propertyPanelItemId && (
        <PropertyPanel
          itemId={propertyPanelItemId}
          onClose={() => setPropertyPanelItemId(null)}
          onSave={handleUpdate}
        />
      )}

      {configuringViewId && (
        <ViewConfigModal
          viewId={configuringViewId}
          onClose={() => setConfiguringViewId(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}

export default App;
