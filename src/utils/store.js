import { fetchData, saveData, isAuthenticated } from './api';

const STORAGE_KEYS = {
  items: 'ut_items_v23',
  projects: 'ut_projects_v23',
  settings: 'ut_settings_v23',
  propertyDefs: 'ut_propertyDefs_v1',
  viewConfigs: 'ut_viewConfigs_v1',
  pages: 'ut_pages_v1',
  semesters: 'ut_semesters_v1',
  jobs: 'ut_jobs_v1',
  resumes: 'ut_resumes_v1',
  serverSynced: 'ut_server_synced_v1'
};

// Property types supported by the system
export const PROPERTY_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  TIME: 'time',
  SELECT: 'select',
  MULTI_SELECT: 'multi-select',
  URL: 'url',
  AI: 'ai'
};

// Entity types that can have custom properties
export const ENTITY_TYPES = {
  TASK: 'task',
  PROJECT: 'project'
};

/** YYYY-MM-DD in local timezone (not UTC — fixes "today" / calendar drift) */
export function formatLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Removed from personal-life template; stripped on load from existing data */
export const REMOVED_PROJECT_PROPERTY_IDS = [
  'prop_project_review_time',
  'prop_project_kickoff',
  'prop_project_budget',
  'prop_project_stakeholders',
  'prop_project_repo',
  'prop_project_brief'
];

export function migratePersonalProjectProperties(store) {
  store.propertyDefs = (store.propertyDefs || []).filter(
    (p) => !REMOVED_PROJECT_PROPERTY_IDS.includes(p.id)
  );
  for (const proj of store.projects || []) {
    if (!proj.customProps) continue;
    for (const id of REMOVED_PROJECT_PROPERTY_IDS) {
      delete proj.customProps[id];
    }
  }
}

/** Task-level properties removed from global views */
export const REMOVED_TASK_PROPERTY_IDS = [
  'prop_estimate',
  'prop_followup_date',
  'prop_focus_time'
];

export function migrateRemovedTaskProperties(store) {
  // Remove definitions
  store.propertyDefs = (store.propertyDefs || []).filter(
    (p) => !REMOVED_TASK_PROPERTY_IDS.includes(p.id)
  );
  // Remove values from all task customProps
  for (const item of store.items || []) {
    if (!item.customProps) continue;
    for (const id of REMOVED_TASK_PROPERTY_IDS) {
      delete item.customProps[id];
    }
  }
  // Remove from any saved view visibleProperties lists
  for (const vc of Object.values(store.viewConfigs || {})) {
    if (Array.isArray(vc.visibleProperties)) {
      vc.visibleProperties = vc.visibleProperties.filter(
        (id) => !REMOVED_TASK_PROPERTY_IDS.includes(id)
      );
    }
  }
}

export const Store = {
  items: [],
  projects: [],
  pages: [],        // Notion-style pages (notebooks + nested pages)
  semesters: [],    // School semesters that group course projects
  jobs: [],         // Job applications and opportunities
  resumes: [],      // Uploaded and tailored resume versions
  propertyDefs: [], // Custom property definitions
  viewConfigs: {},  // Saved view configurations
  settings: {
    startHour: 6,
    endHour: 22,
    rescheduleHours: 24,
    theme: 'dark',
    /** Project ids hidden from global views (All, Today, Week, etc.); inbox/nofolder ignore this */
    viewExcludedProjectIds: [],
    /** Show task/event notes directly under rows in list views */
    showInlineNotes: false,
    /** Default badge visibility for newly created projects */
    defaultShowInboxBadge: true,
    defaultShowTodayBadge: true,
    /** Academic hierarchy (semester -> class -> course) used by task right panel */
    academicCatalog: [],
    /** Mastery tracking settings */
    masteryEnabled: true,
    masteryIgnoreUntracked: true,
    /** Browser notification settings */
    notificationsEnabled: false,
    notificationLeadMinutes: 15,
    notificationTasks: true,
    notificationStudy: true,
    notificationJobs: true,
    /** AI planning preferences */
    plannerSleepStart: '23:00',
    plannerSleepEnd: '07:00',
    plannerWorkShifts: [
      { day: 1, enabled: false, start: '09:00', end: '17:00' },
      { day: 2, enabled: false, start: '09:00', end: '17:00' },
      { day: 3, enabled: false, start: '09:00', end: '17:00' },
      { day: 4, enabled: false, start: '09:00', end: '17:00' },
      { day: 5, enabled: false, start: '09:00', end: '17:00' },
      { day: 6, enabled: false, start: '09:00', end: '17:00' },
      { day: 0, enabled: false, start: '09:00', end: '17:00' }
    ],
    plannerInclude: {
      tasks: true,
      classes: true,
      study: true,
      jobs: true,
      events: true
    },
    /** AI Intake preferences. API keys are intentionally kept out of synced Store data. */
    aiDefaultModel: 'gpt-5.5',
    aiCustomModel: '',
    aiAllowNewDestinations: false,
    aiCategories: {
      tasks: true,
      events: true,
      jobs: true,
      pages: true
    }
  },

  /** Shared post-load normalisation + migrations */
  _postLoad() {
    this.cleanupOrphanedProjectTasks();
    this.items.forEach(i  => { if (!i.customProps) i.customProps = {}; });
    if (!Array.isArray(this.semesters)) this.semesters = [];
    if (!Array.isArray(this.jobs)) this.jobs = [];
    if (!Array.isArray(this.resumes)) this.resumes = [];
    if (typeof this.settings.showInlineNotes !== 'boolean') this.settings.showInlineNotes = false;
    this.resumes = this.resumes
      .filter((resume) => resume && resume.id)
      .map((resume) => ({
        id: resume.id,
        name: String(resume.name || 'Untitled resume').trim() || 'Untitled resume',
        type: resume.type === 'tailored' ? 'tailored' : 'base',
        sourceResumeId: resume.sourceResumeId || '',
        jobId: resume.jobId || '',
        company: String(resume.company || '').trim(),
        role: String(resume.role || '').trim(),
        fileName: String(resume.fileName || '').trim(),
        content: String(resume.content || ''),
        jobDescription: String(resume.jobDescription || ''),
        summary: String(resume.summary || '').trim(),
        keywordMatches: Array.isArray(resume.keywordMatches)
          ? resume.keywordMatches.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        warnings: Array.isArray(resume.warnings)
          ? resume.warnings.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        createdAt: resume.createdAt || Date.now(),
        updatedAt: resume.updatedAt || resume.createdAt || Date.now()
      }));
    this.jobs = this.jobs
      .filter((job) => job && job.id)
      .map((job) => ({
        id: job.id,
        company: String(job.company || '').trim(),
        role: String(job.role || '').trim(),
        link: String(job.link || '').trim(),
        status: ['interested', 'applied', 'interviewing', 'accepted', 'rejected'].includes(job.status)
          ? job.status
          : 'interested',
        payRate: String(job.payRate || '').trim(),
        schedule: String(job.schedule || '').trim(),
        location: String(job.location || '').trim(),
        contactName: String(job.contactName || '').trim(),
        contactEmail: String(job.contactEmail || '').trim(),
        resumeVersion: String(job.resumeVersion || '').trim(),
        resumeVersionId: job.resumeVersionId || '',
        applicationDate: String(job.applicationDate || '').trim(),
        interviewDate: String(job.interviewDate || '').trim(),
        followUpDate: String(job.followUpDate || '').trim(),
        nextAction: String(job.nextAction || '').trim(),
        notes: String(job.notes || '').trim(),
        createdAt: job.createdAt || Date.now(),
        updatedAt: job.updatedAt || job.createdAt || Date.now()
      }));
    this.semesters = this.semesters
      .filter((s) => s && s.id)
      .map((s) => ({
        id: s.id,
        name: String(s.name || 'Untitled Semester').trim() || 'Untitled Semester',
        createdAt: s.createdAt || Date.now(),
        expanded: typeof s.expanded === 'boolean' ? s.expanded : true
      }));
    const semesterByName = new Map(
      this.semesters.map((s) => [String(s.name || '').toLowerCase(), s.id])
    );
    this.projects.forEach(p => {
      if (!p.customProps) p.customProps = {};
      // School: normalize course-specific fields when present
      if (p.kind === 'course') {
        if (!Array.isArray(p.classTimes)) p.classTimes = [];
        p.classTimes = p.classTimes.map((ct) => ({
          ...ct,
          days: Array.isArray(ct?.days) ? ct.days : [],
          start: typeof ct?.start === 'string' ? ct.start : '',
          end: typeof ct?.end === 'string' ? ct.end : '',
          startDate: typeof ct?.startDate === 'string' ? ct.startDate : '',
          endDate: typeof ct?.endDate === 'string' ? ct.endDate : '',
          location: typeof ct?.location === 'string' ? ct.location : ''
        }));
        if (!Array.isArray(p.linkedPageIds)) p.linkedPageIds = [];
        if (!p.notebookMetadata || typeof p.notebookMetadata !== 'object') {
          p.notebookMetadata = {};
        }
        if (typeof p.semester !== 'string') p.semester = '';
        if (p.semesterId === undefined) {
          p.semesterId = p.semester
            ? (semesterByName.get(String(p.semester).toLowerCase()) || null)
            : null;
        }
        if (p.semesterId && !this.semesters.some((s) => s.id === p.semesterId)) {
          p.semesterId = null;
        }
        if (typeof p.courseStatus !== 'string') p.courseStatus = 'in_progress';
      }
    });
    // School: ensure exam items have examMeta blob
    this.items.forEach((it) => {
      if (it.type === 'exam' && (!it.examMeta || typeof it.examMeta !== 'object')) {
        it.examMeta = { studyGuide: '', linkedPageIds: [] };
      }
      if (it.examMeta) {
        if (typeof it.examMeta.studyGuide !== 'string') it.examMeta.studyGuide = '';
        if (!Array.isArray(it.examMeta.linkedPageIds)) it.examMeta.linkedPageIds = [];
      }
    });
    if (!Array.isArray(this.settings.academicCatalog)) this.settings.academicCatalog = [];
    if (typeof this.settings.masteryEnabled !== 'boolean') this.settings.masteryEnabled = true;
    if (typeof this.settings.masteryIgnoreUntracked !== 'boolean') this.settings.masteryIgnoreUntracked = true;
    if (typeof this.settings.notificationsEnabled !== 'boolean') this.settings.notificationsEnabled = false;
    if (typeof this.settings.notificationLeadMinutes !== 'number') this.settings.notificationLeadMinutes = 15;
    if (typeof this.settings.notificationTasks !== 'boolean') this.settings.notificationTasks = true;
    if (typeof this.settings.notificationStudy !== 'boolean') this.settings.notificationStudy = true;
    if (typeof this.settings.notificationJobs !== 'boolean') this.settings.notificationJobs = true;
    if (typeof this.settings.plannerSleepStart !== 'string') this.settings.plannerSleepStart = '23:00';
    if (typeof this.settings.plannerSleepEnd !== 'string') this.settings.plannerSleepEnd = '07:00';
    const defaultShifts = this.settings.plannerWorkShifts || [];
    this.settings.plannerWorkShifts = [1, 2, 3, 4, 5, 6, 0].map((day) => {
      const existing = Array.isArray(defaultShifts)
        ? defaultShifts.find((shift) => Number(shift?.day) === day)
        : null;
      return {
        day,
        enabled: existing?.enabled === true,
        start: typeof existing?.start === 'string' ? existing.start : '09:00',
        end: typeof existing?.end === 'string' ? existing.end : '17:00'
      };
    });
    this.settings.plannerInclude = {
      tasks: this.settings.plannerInclude?.tasks !== false,
      classes: this.settings.plannerInclude?.classes !== false,
      study: this.settings.plannerInclude?.study !== false,
      jobs: this.settings.plannerInclude?.jobs !== false,
      events: this.settings.plannerInclude?.events !== false
    };
    if (typeof this.settings.aiDefaultModel !== 'string') this.settings.aiDefaultModel = 'gpt-5.5';
    if (typeof this.settings.aiCustomModel !== 'string') this.settings.aiCustomModel = '';
    if (typeof this.settings.aiAllowNewDestinations !== 'boolean') this.settings.aiAllowNewDestinations = false;
    this.settings.aiCategories = {
      tasks: this.settings.aiCategories?.tasks !== false,
      events: this.settings.aiCategories?.events !== false,
      jobs: this.settings.aiCategories?.jobs !== false,
      pages: this.settings.aiCategories?.pages !== false
    };
    if (!Array.isArray(this.pages)) this.pages = [];
    this.pages.forEach((p) => {
      if (!Array.isArray(p.blocks)) p.blocks = [];
      if (!p.icon) p.icon = '📄';
      if (!p.title) p.title = 'Untitled';
      if (typeof p.expanded !== 'boolean') p.expanded = true;
      // Normalize mastery tracking
      if (!p.mastery || typeof p.mastery !== 'object') {
        p.mastery = { level: 'none', reviewCount: 0, lastReviewed: null, nextReview: null };
      } else {
        if (typeof p.mastery.level !== 'string') p.mastery.level = 'none';
        if (typeof p.mastery.reviewCount !== 'number') p.mastery.reviewCount = 0;
        if (p.mastery.lastReviewed !== null && typeof p.mastery.lastReviewed !== 'string') p.mastery.lastReviewed = null;
        if (p.mastery.nextReview !== null && typeof p.mastery.nextReview !== 'string') p.mastery.nextReview = null;
      }
      p.blocks.forEach((block) => {
        if (block && typeof block.text === 'string' && !block.__htmlMigrated) {
          if (block.text && !/<\w/.test(block.text) && !/&[a-z]+;/i.test(block.text)) {
            block.text = block.text
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;');
          }
          block.__htmlMigrated = true;
        }
      });
    });
    migratePersonalProjectProperties(this);
    migrateRemovedTaskProperties(this);
    this.syncRescheduleFlags();
  },

  /**
   * Legacy cleanup:
   * Older project-delete logic moved tasks to Inbox by setting pid=null.
   * Imported tasks now carry project subfolders, so if a task has no project
   * but still has subfolder metadata, it's an orphan from deleted projects.
   */
  cleanupOrphanedProjectTasks() {
    const looksLikeLegacyImportedText = (text) => {
      const v = String(text || '').trim();
      if (!v) return false;
      // Older importer flattened "Section: task - detail" into text
      if (/^[^:]{2,40}:\s+.+/u.test(v)) return true;
      // Common phrasing from imported notes/details
      if (/\bDeadline\b|\bFollow up\b|\bResearch\b|\bCreate\b/u.test(v) && v.includes(' - ')) return true;
      return false;
    };

    const before = this.items.length;
    this.items = this.items.filter((item) => {
      if (item.pid != null) return true;

      const hasSubfolder = !!item.subfolder;
      const hasSubtasks = Array.isArray(item.subtasks) && item.subtasks.length > 0;
      const legacyImportedText = looksLikeLegacyImportedText(item.text);

      return !(hasSubfolder || hasSubtasks || legacyImportedText);
    });
    if (this.items.length !== before) this.save();
  },

  /** Load from localStorage (sync, offline fallback) */
  loadLocal() {
    try {
      const items       = localStorage.getItem(STORAGE_KEYS.items);
      const projects    = localStorage.getItem(STORAGE_KEYS.projects);
      const settings    = localStorage.getItem(STORAGE_KEYS.settings);
      const propertyDefs = localStorage.getItem(STORAGE_KEYS.propertyDefs);
      const viewConfigs  = localStorage.getItem(STORAGE_KEYS.viewConfigs);
      const pages        = localStorage.getItem(STORAGE_KEYS.pages);
      const semesters    = localStorage.getItem(STORAGE_KEYS.semesters);
      const jobs         = localStorage.getItem(STORAGE_KEYS.jobs);
      const resumes      = localStorage.getItem(STORAGE_KEYS.resumes);

      if (items) this.items = JSON.parse(items);
      else this.seed();

      if (projects)     this.projects     = JSON.parse(projects);
      if (propertyDefs) this.propertyDefs = JSON.parse(propertyDefs);
      if (viewConfigs)  this.viewConfigs  = JSON.parse(viewConfigs);
      if (settings)     this.settings     = { ...this.settings, ...JSON.parse(settings) };
      if (pages)        this.pages        = JSON.parse(pages);
      if (semesters)    this.semesters    = JSON.parse(semesters);
      if (jobs)         this.jobs         = JSON.parse(jobs);
      if (resumes)      this.resumes      = JSON.parse(resumes);
      this._postLoad();
    } catch (e) {
      console.error('Load error:', e);
      this.seed();
    }
  },

  hasLocalSnapshot() {
    try {
      return Object.entries(STORAGE_KEYS)
        .filter(([name]) => name !== 'serverSynced')
        .some(([, key]) => localStorage.getItem(key) != null);
    } catch {
      return false;
    }
  },

  /** Load from server (async), fall back to localStorage */
  async load() {
    try {
      if (!isAuthenticated()) { this.loadLocal(); return; }

      const data = await fetchData();
      const hasServerData = Object.values(data || {}).some((value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.keys(value).length > 0;
        return value != null;
      });

      if (!hasServerData && this.hasLocalSnapshot()) {
        this.loadLocal();
        this._syncToServer();
        return;
      }

      if (data.items)        this.items        = data.items        ?? [];
      if (data.projects)     this.projects     = data.projects     ?? [];
      if (data.settings)     this.settings     = { ...this.settings, ...data.settings };
      if (data.propertyDefs) this.propertyDefs = data.propertyDefs ?? [];
      if (data.viewConfigs)  this.viewConfigs  = data.viewConfigs  ?? {};
      if (data.pages)        this.pages        = data.pages        ?? [];
      if (data.semesters)    this.semesters    = data.semesters    ?? [];
      if (data.jobs)         this.jobs         = data.jobs         ?? [];
      if (data.resumes)      this.resumes      = data.resumes      ?? [];

      // If DB is empty (fresh deploy), seed and push initial data.
      if (!hasServerData) {
        this.seed();
        this._postLoad();
        this._syncToServer();
        return;
      }
      this._postLoad();
      // Refresh localStorage cache
      this._saveLocal();
    } catch (e) {
      console.warn('Server load failed — using localStorage:', e.message);
      this.loadLocal();
    }
  },

  /** Write localStorage cache */
  _saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.items,        JSON.stringify(this.items));
      localStorage.setItem(STORAGE_KEYS.projects,     JSON.stringify(this.projects));
      localStorage.setItem(STORAGE_KEYS.settings,     JSON.stringify(this.settings));
      localStorage.setItem(STORAGE_KEYS.propertyDefs, JSON.stringify(this.propertyDefs));
      localStorage.setItem(STORAGE_KEYS.viewConfigs,  JSON.stringify(this.viewConfigs));
      localStorage.setItem(STORAGE_KEYS.pages,        JSON.stringify(this.pages || []));
      localStorage.setItem(STORAGE_KEYS.semesters,    JSON.stringify(this.semesters || []));
      localStorage.setItem(STORAGE_KEYS.jobs,         JSON.stringify(this.jobs || []));
      localStorage.setItem(STORAGE_KEYS.resumes,      JSON.stringify(this.resumes || []));
    } catch (e) {
      console.error('localStorage error:', e);
    }
  },

  /** Fire-and-forget server sync */
  _syncToServer() {
    if (!isAuthenticated()) return;
    saveData({
      items: this.items,
      projects: this.projects,
      settings: this.settings,
      propertyDefs: this.propertyDefs,
      viewConfigs: this.viewConfigs,
      pages: this.pages || [],
      semesters: this.semesters || [],
      jobs: this.jobs || [],
      resumes: this.resumes || [],
    })
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEYS.serverSynced, String(Date.now()));
        } catch {
          // Sync succeeded; marker persistence is best effort.
        }
      })
      .catch(err => console.warn('Server save failed:', err.message));
  },

  /** Save: instant localStorage + background server sync */
  save() {
    this._saveLocal();
    this._syncToServer();
  },

  seed() {
    const today = getToday();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalYMD(tomorrow);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    const nextWeekStr = formatLocalYMD(nextWeek);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalYMD(yesterday);

    this.semesters = [
      {
        id: 'sem_fall_2026',
        name: 'Fall 2026',
        createdAt: Date.now(),
        expanded: true
      },
      {
        id: 'sem_spring_2027',
        name: 'Spring 2027',
        createdAt: Date.now() + 1,
        expanded: true
      }
    ];
    this.jobs = [];
    this.resumes = [];

    this.projects = [
      {
        id: 'p1',
        name: 'Personal',
        icon: '🏠',
        color: '#2383E2',
        customProps: {
          prop_project_owner: 'Alex',
          prop_project_stage: 'stage_in_progress'
        }
      },
      {
        id: 'p2',
        name: 'Work',
        icon: '💼',
        color: '#E22383',
        customProps: {
          prop_project_owner: 'Jordan',
          prop_project_stage: 'stage_in_progress'
        }
      },
      {
        id: 'p3',
        name: 'Health',
        icon: '💪',
        color: '#45A557',
        customProps: {
          prop_project_owner: 'Sam',
          prop_project_stage: 'stage_planning'
        }
      }
    ];

    this.items = [
      {
        id: 1,
        text: 'Morning standup',
        type: 'event',
        priority: 'high',
        pid: 'p2',
        date: today,
        time: '09:00',
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_in_progress',
          prop_tags: ['tag_meeting'],
          prop_link: 'https://meet.google.com/example',
          prop_summary: 'Daily sync with the team to share blockers.',
          prop_notes: 'Share updates on launch readiness.'
        }
      },
      {
        id: 2,
        text: 'Buy groceries',
        type: 'task',
        priority: 'low',
        pid: 'p1',
        date: today,
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_not_started',
          prop_tags: ['tag_quick_win'],
          prop_link: 'https://example.com/shopping-list',
          prop_summary: 'Restock for the week.',
          prop_notes: 'Grab fruit, veggies, and protein.'
        }
      },
      {
        id: 3,
        text: 'Review code',
        type: 'task',
        priority: 'high',
        pid: 'p2',
        date: today,
        time: '14:00',
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_in_progress',
          prop_tags: ['tag_important', 'tag_research'],
          prop_link: 'https://github.com/example/pull/42',
          prop_summary: 'Audit performance changes for release.',
          prop_notes: 'Focus on memory usage and loading state.'
        }
      },
      {
        id: 4,
        text: 'Gym',
        type: 'event',
        priority: 'medium',
        pid: 'p3',
        date: today,
        time: '18:00',
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_not_started',
          prop_tags: ['tag_focus'],
          prop_link: 'https://example.com/workout-plan',
          prop_summary: 'Strength session and cooldown.',
          prop_notes: 'Remember mobility work.'
        }
      },
      {
        id: 5,
        text: 'Team lunch',
        type: 'event',
        priority: 'low',
        pid: 'p2',
        date: tomorrowStr,
        time: '12:30',
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_not_started',
          prop_tags: ['tag_meeting'],
          prop_estimate: 1.5,
          prop_followup_date: tomorrowStr,
          prop_focus_time: '13:00',
          prop_link: 'https://example.com/restaurant',
          prop_summary: 'Team bonding lunch.',
          prop_notes: 'Confirm headcount.'
        }
      },
      {
        id: 6,
        text: 'Call mom',
        type: 'task',
        priority: 'low',
        pid: 'p1',
        date: tomorrowStr,
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_not_started',
          prop_tags: ['tag_important'],
          prop_link: 'https://example.com/call-notes',
          prop_summary: 'Check in and plan weekend.',
          prop_notes: 'Ask about travel plans.'
        }
      },
      {
        id: 7,
        text: 'Project deadline',
        type: 'task',
        priority: 'high',
        pid: 'p2',
        date: nextWeekStr,
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_in_progress',
          prop_tags: ['tag_important'],
          prop_estimate: 6,
          prop_followup_date: nextWeekStr,
          prop_focus_time: '10:00',
          prop_link: 'https://example.com/deadline',
          prop_summary: 'Launch milestone due next week.',
          prop_notes: 'Align stakeholders on delivery.'
        }
      },
      {
        id: 8,
        text: 'Backlog Item',
        type: 'task',
        priority: 'low',
        pid: 'p2',
        date: null,
        done: false,
        archived: false,
        recurrence: 'none',
        recurDetails: null,
        createdAt: Date.now(),
        customProps: {
          prop_status: 'status_blocked',
          prop_tags: ['tag_research'],
          prop_link: 'https://example.com/backlog',
          prop_summary: 'Needs discovery before scheduling.',
          prop_notes: 'Capture constraints and alternatives.'
        }
      }
    ];

    // Seed default property definitions
    this.propertyDefs = [
      {
        id: 'prop_status',
        name: 'Status',
        type: PROPERTY_TYPES.SELECT,
        entityType: ENTITY_TYPES.TASK,
        options: [
          { id: 'status_not_started', value: 'Not Started', color: '#9B9B9B' },
          { id: 'status_in_progress', value: 'In Progress', color: '#F59E0B' },
          { id: 'status_completed', value: 'Completed', color: '#45A557' },
          { id: 'status_blocked', value: 'Blocked', color: '#FF5555' }
        ],
        defaultValue: null,
        showInline: true,
        order: 0
      },
      {
        id: 'prop_tags',
        name: 'Tags',
        type: PROPERTY_TYPES.MULTI_SELECT,
        entityType: ENTITY_TYPES.TASK,
        options: [
          { id: 'tag_important', value: 'Important', color: '#FF5555' },
          { id: 'tag_quick_win', value: 'Quick Win', color: '#45A557' },
          { id: 'tag_research', value: 'Research', color: '#2383E2' },
          { id: 'tag_meeting', value: 'Meeting', color: '#E22383' },
          { id: 'tag_focus', value: 'Focus', color: '#9B59B6' }
        ],
        defaultValue: [],
        showInline: true,
        order: 1
      },
      {
        id: 'prop_link',
        name: 'Link',
        type: PROPERTY_TYPES.URL,
        entityType: ENTITY_TYPES.TASK,
        options: [],
        defaultValue: '',
        showInline: true,
        order: 2
      },
      {
        id: 'prop_summary',
        name: 'AI Summary',
        type: PROPERTY_TYPES.AI,
        entityType: ENTITY_TYPES.TASK,
        options: [],
        aiPrompt: 'Summarize this task in one sentence',
        defaultValue: '',
        showInline: false,
        order: 3
      },
      {
        id: 'prop_notes',
        name: 'Notes',
        type: PROPERTY_TYPES.TEXT,
        entityType: ENTITY_TYPES.TASK,
        options: [],
        defaultValue: '',
        showInline: false,
        order: 4
      },
      {
        id: 'prop_project_owner',
        name: 'Owner',
        type: PROPERTY_TYPES.TEXT,
        entityType: ENTITY_TYPES.PROJECT,
        options: [],
        defaultValue: '',
        showInline: false,
        order: 0
      },
      {
        id: 'prop_project_stage',
        name: 'Stage',
        type: PROPERTY_TYPES.SELECT,
        entityType: ENTITY_TYPES.PROJECT,
        options: [
          { id: 'stage_planning', value: 'Planning', color: '#9B9B9B' },
          { id: 'stage_in_progress', value: 'In Progress', color: '#2383E2' },
          { id: 'stage_review', value: 'Review', color: '#F59E0B' },
          { id: 'stage_done', value: 'Done', color: '#45A557' }
        ],
        defaultValue: null,
        showInline: false,
        order: 1
      }
    ];

    this.viewConfigs = {
      view_status: {
        id: 'view_status',
        name: 'By Status',
        entityType: ENTITY_TYPES.TASK,
        groupBy: 'prop_status',
        sortBy: 'date',
        sortOrder: 'asc',
        filters: [],
        visibleProperties: ['prop_status', 'prop_tags'],
        createdAt: Date.now()
      },
      view_priority: {
        id: 'view_priority',
        name: 'By Priority',
        entityType: ENTITY_TYPES.TASK,
        groupBy: 'priority',
        sortBy: 'date',
        sortOrder: 'asc',
        filters: [],
        visibleProperties: ['prop_status'],
        createdAt: Date.now()
      },
      view_date: {
        id: 'view_date',
        name: 'By Date',
        entityType: ENTITY_TYPES.TASK,
        groupBy: 'date',
        sortBy: 'time',
        sortOrder: 'asc',
        filters: [],
        visibleProperties: ['prop_status', 'prop_link'],
        createdAt: Date.now()
      },
      view_project_stage: {
        id: 'view_project_stage',
        name: 'Projects by Stage',
        entityType: ENTITY_TYPES.PROJECT,
        groupBy: 'prop_project_stage',
        sortBy: 'text',
        sortOrder: 'asc',
        filters: [],
        visibleProperties: [],
        createdAt: Date.now()
      }
    };
    this.save();
  },

  /**
   * Mark items for the Reschedule view:
   * - Due date before today (local): flagged immediately when still open
   * - Due today: flagged after due time (or end of day) + rescheduleHours
   */
  syncRescheduleFlags() {
    const hours = Number(this.settings.rescheduleHours) || 24;
    const ms = hours * 3600000;
    const now = Date.now();
    const todayStr = getToday();
    let changed = false;
    for (const item of this.items) {
      if (item.done || item.archived || !item.date) {
        if (item.reschedule) {
          item.reschedule = false;
          changed = true;
        }
        continue;
      }
      let shouldFlag = false;
      if (item.date < todayStr) {
        shouldFlag = true;
      } else if (item.date === todayStr) {
        let dueEndMs;
        if (item.time && /^\d{2}:\d{2}$/.test(item.time)) {
          dueEndMs = new Date(`${item.date}T${item.time}:00`).getTime();
        } else {
          dueEndMs = new Date(`${item.date}T23:59:59`).getTime();
        }
        shouldFlag = now > dueEndMs + ms;
      }
      if (shouldFlag && !item.reschedule) {
        item.reschedule = true;
        changed = true;
      } else if (!shouldFlag && item.reschedule) {
        item.reschedule = false;
        changed = true;
      }
    }
    if (changed) this.save();
  },

  async reset() {
    if (!confirm('⚠️ Delete ALL data? This cannot be undone!')) return;
    try {
      // Reset in-memory state, persist locally, then propagate to server.
      this.seed();
      this._postLoad();
      this._saveLocal();
      if (isAuthenticated()) {
        await saveData({
          items: this.items,
          projects: this.projects,
          settings: this.settings,
          propertyDefs: this.propertyDefs,
          viewConfigs: this.viewConfigs,
          pages: this.pages || [],
          semesters: this.semesters || [],
          jobs: this.jobs || [],
          resumes: this.resumes || [],
        });
      }
    } catch (e) {
      console.warn('Reset sync warning:', e?.message || e);
    } finally {
      window.location.reload();
    }
  }
};

export function getToday() {
  return formatLocalYMD(new Date());
}

export function getWeekEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatLocalYMD(d);
}

export function getMonthPrefix() {
  return getToday().substring(0, 7);
}

export function monthRangeFor(prefixYYYYMM) {
  const [y, m] = prefixYYYYMM.split('-').map(n => parseInt(n, 10));
  const start = `${prefixYYYYMM}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${prefixYYYYMM}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function clampDay(year, monthIndex, day) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(day, daysInMonth));
}

export function getNextDate(dateStr, recurrence, details) {
  const base = new Date((dateStr || getToday()) + 'T00:00:00');

  if (recurrence === 'daily') {
    base.setDate(base.getDate() + 1);
    return formatLocalYMD(base);
  }

  if (recurrence === 'weekly') {
    const days = Array.isArray(details?.days) ? details.days : [];
    if (days.length === 0) {
      base.setDate(base.getDate() + 7);
      return formatLocalYMD(base);
    }
    for (let i = 1; i <= 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (days.includes(d.getDay())) return formatLocalYMD(d);
    }
    base.setDate(base.getDate() + 7);
    return formatLocalYMD(base);
  }

  if (recurrence === 'monthly') {
    const dom = parseInt(details?.dayOfMonth || '1', 10);
    const y = base.getFullYear();
    const m = base.getMonth();
    const next = new Date(y, m + 1, 1);
    next.setDate(clampDay(next.getFullYear(), next.getMonth(), dom));
    return formatLocalYMD(next);
  }

  return dateStr || null;
}

export function getAllowedModes(filter) {
  if (filter === 'today') return ['list', 'schedule'];
  if (filter === 'week') return ['board', 'list'];
  if (filter === 'month') return ['calendar', 'list'];
  return ['list'];
}
