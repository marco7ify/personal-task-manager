import '../styles/Help.css';

const TOPICS = [
  {
    id: 'tasks',
    title: 'Tasks, inbox, and filters',
    summary: 'Add work fast, sort it later, and keep the inbox from becoming a junk drawer.',
    points: [
      'Use the main input bar to create tasks, events, and quick notes.',
      'Inbox is for unscheduled items. Move them to Today, Week, Month, a project, or leave them unscheduled until you are ready.',
      'Use Done and Archived to separate finished work from items you want to hide but keep around.'
    ],
    tip: 'If something does not need a date yet, keep it in Inbox instead of forcing a schedule.'
  },
  {
    id: 'views',
    title: 'List, Schedule, Board, and Calendar',
    summary: 'Switch views based on what you are trying to do right now.',
    points: [
      'List is best for scanning, editing, and bulk cleanup.',
      'Schedule shows time blocks for today.',
      'Board is best for dragging tasks through the next seven days.',
      'Calendar gives a month-level picture for planning ahead.'
    ],
    tip: 'Use Schedule for timed work and Board for flexible planning.'
  },
  {
    id: 'projects',
    title: 'Projects and badges',
    summary: 'Projects keep related work together and make the sidebar easier to scan.',
    points: [
      'Create projects from the sidebar and open a project to see only its items.',
      'Project badges show unscheduled inbox items and tasks due today.',
      'Use the project settings button to change the project name, icon, color, and custom fields.'
    ],
    tip: 'If a project feels too broad, split it before the sidebar gets noisy.'
  },
  {
    id: 'school',
    title: 'Notebooks, school views, and study queue',
    summary: 'Separate reference material from actionable work and keep school items organized.',
    points: [
      'Use notebooks and pages for notes, ideas, and reference content.',
      'Use course, exam, and semester views to track school work by class.',
      'Study Queue surfaces pages that need review so you can keep a steady study rhythm.'
    ],
    tip: 'Treat notebooks like knowledge storage and tasks like action items.'
  },
  {
    id: 'jobs',
    title: 'Jobs tracking',
    summary: 'Track applications, follow-ups, interviews, and next steps in one place.',
    points: [
      'Use the Jobs page to store company, role, status, pay, contacts, and dates.',
      'Set follow-up dates so active applications stay visible.',
      'Templates help you quickly start common application types.'
    ],
    tip: 'Keep one clear next action for every active job application.'
  },
  {
    id: 'ai',
    title: 'AI intake and rescheduling',
    summary: 'Use the built-in AI helpers to organize messy lists and clean up overdue work.',
    points: [
      'AI Intake turns pasted notes into tasks, jobs, appointments, notebooks, and pages.',
      'Home includes AI planning for day or week planning.',
      'Daily Review and Reschedule help you clear overdue tasks and decide what should move next.'
    ],
    tip: 'The AI tools work best when your source text is messy but still meaningful.'
  },
  {
    id: 'settings',
    title: 'Settings, notifications, import, and storage',
    summary: 'Tune the app to your workflow and keep your data local.',
    points: [
      'Settings control theme, schedule hours, notifications, custom properties, and AI options.',
      'Use import to merge task or notebook lists into your current data.',
      'Everything is stored locally in your browser unless you export or move it elsewhere.'
    ],
    tip: 'If the app feels off, check theme, hours, and notification permissions first.'
  }
];

const QUICK_START = [
  {
    title: '1. Add something',
    text: 'Type a task, event, or idea into the input bar and save it quickly.'
  },
  {
    title: '2. Sort it later',
    text: 'Put unscheduled work in Inbox, then move it into a project or date when it is ready.'
  },
  {
    title: '3. Pick the right view',
    text: 'Use List for cleanup, Schedule for today, Board for the week, and Calendar for the month.'
  },
  {
    title: '4. Review daily',
    text: 'Check Daily Review, clear overdue items, and use Jobs and Study Queue as needed.'
  }
];

function SectionCard({ id, title, summary, points, tip }) {
  return (
    <article id={id} className="help-card">
      <div className="help-card-head">
        <div>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        <span className="help-card-badge">Feature guide</span>
      </div>
      <ul className="help-points">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="help-tip">
        <strong>Tip:</strong> {tip}
      </div>
    </article>
  );
}

export function HelpView({ onNavigate, onNavigateBack }) {
  return (
    <div className="help-view">
      <div className="header-row">
        <div>
          <h1 className="page-title">Help</h1>
          <p className="help-subtitle">
            A quick guide to the app's core features, where they live, and how to use them.
          </p>
        </div>
        <div className="header-controls">
          {onNavigateBack && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateBack}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('home')}>
            Home
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('tasks', 'inbox')}>
            Open Inbox
          </button>
        </div>
      </div>

      <section className="help-hero">
        <div className="help-hero-copy">
          <span className="help-hero-kicker">Quick start</span>
          <h2>Get from messy notes to a clear plan</h2>
          <p>
            The app works best when you capture everything quickly, keep unscheduled items in Inbox,
            and then use the right view for the kind of planning you are doing.
          </p>
          <div className="help-hero-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('tasks', 'today')}>
              Open Today
            </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('dailyReview')}>
            Start Daily Review
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('settings')}>
            Open Settings
          </button>
        </div>
      </div>
        <div className="help-hero-panel">
          <div className="help-hero-panel-title">What to do first</div>
          <div className="help-quick-start">
            {QUICK_START.map((step) => (
              <div key={step.title} className="help-step">
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="help-toc" aria-label="Help sections">
        {TOPICS.map((topic) => (
          <a key={topic.id} href={`#${topic.id}`} className="help-toc-item">
            {topic.title}
          </a>
        ))}
      </nav>

      <section className="help-section">
        <div className="help-section-head">
          <h2>Feature guide</h2>
          <p>Everything below is a concise map of the features you will use most often.</p>
        </div>
        <div className="help-grid">
          {TOPICS.map((topic) => (
            <SectionCard key={topic.id} {...topic} />
          ))}
        </div>
      </section>

      <section className="help-footer">
        <div className="help-footer-panel">
          <h2>Short version</h2>
          <p>
            Capture quickly, keep your inbox clean, plan in the view that fits the moment, and use
            projects, notebooks, school tools, jobs, and AI helpers only when they reduce friction.
          </p>
        </div>
        <div className="help-footer-panel subtle">
          <h2>Need a reset?</h2>
          <p>
            Open Settings to adjust theme, notifications, import data, or review the storage model
            before making bigger changes.
          </p>
        </div>
      </section>
    </div>
  );
}
