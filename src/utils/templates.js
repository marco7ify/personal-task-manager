import { getToday } from './store';
import { BLOCK_TYPES, createBlock, createPage } from './pages';

export const TASK_TEMPLATES = [
  {
    id: 'weekly-reset',
    title: 'Weekly Reset',
    description: 'Inbox cleanup, rescheduling, and priority picking.',
    item: {
      text: 'Weekly reset',
      type: 'task',
      priority: 'medium',
      subfolder: 'Planning',
      customProps: {
        prop_notes: 'Review inbox, reschedule overdue items, check calendar, choose top priorities.'
      },
      subtasks: [
        { text: 'Clear inbox' },
        { text: 'Reschedule overdue items' },
        { text: 'Pick top 3 priorities' }
      ]
    }
  },
  {
    id: 'exam-prep',
    title: 'Exam Prep Sprint',
    description: 'Study guide, practice, and confusing topics.',
    item: {
      text: 'Exam prep sprint',
      type: 'task',
      priority: 'high',
      subfolder: 'School',
      customProps: {
        prop_notes: 'Update study guide, review weak pages, do practice problems, write questions for class.'
      },
      subtasks: [
        { text: 'Review study guide' },
        { text: 'Practice problems' },
        { text: 'Mark confusing topics' }
      ]
    }
  }
];

export const PAGE_TEMPLATES = [
  {
    id: 'study-note',
    title: 'Study Note',
    description: 'Lecture/chapter structure with questions and review.',
    page: {
      title: 'Study Note',
      icon: 'SN',
      blocks: [
        [BLOCK_TYPES.H2, 'Key ideas'],
        [BLOCK_TYPES.BULLET, ''],
        [BLOCK_TYPES.H2, 'Examples'],
        [BLOCK_TYPES.BULLET, ''],
        [BLOCK_TYPES.H2, 'Questions'],
        [BLOCK_TYPES.TODO, 'Ask about this in class'],
        [BLOCK_TYPES.H2, 'Review summary'],
        [BLOCK_TYPES.PARAGRAPH, '']
      ]
    }
  },
  {
    id: 'project-brief',
    title: 'Project Brief',
    description: 'Outcome, next actions, and working notes.',
    page: {
      title: 'Project Brief',
      icon: 'PB',
      blocks: [
        [BLOCK_TYPES.H2, 'Outcome'],
        [BLOCK_TYPES.PARAGRAPH, ''],
        [BLOCK_TYPES.H2, 'Next actions'],
        [BLOCK_TYPES.TODO, 'Define first step'],
        [BLOCK_TYPES.TODO, 'Set a target date'],
        [BLOCK_TYPES.H2, 'Notes'],
        [BLOCK_TYPES.PARAGRAPH, '']
      ]
    }
  }
];

export const JOB_TEMPLATES = [
  {
    id: 'job-lead',
    title: 'Job Lead',
    description: 'Track a role before applying.',
    job: {
      company: '',
      role: 'New opportunity',
      status: 'interested',
      nextAction: 'Review job description and decide whether to apply.',
      notes: 'Paste requirements, pay details, and application notes here.'
    }
  },
  {
    id: 'interview-prep',
    title: 'Interview Prep',
    description: 'Prep prompts for an interviewing role.',
    job: {
      company: '',
      role: 'Interview prep',
      status: 'interviewing',
      nextAction: 'Prepare answers and questions for the interviewer.',
      notes: 'Why this company, relevant experience, salary range, availability, questions to ask.'
    }
  }
];

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTaskFromTemplate(template, { projectId = null, date = getToday() } = {}) {
  const now = Date.now();
  return {
    id: now,
    text: template.item.text,
    type: template.item.type,
    priority: template.item.priority,
    pid: projectId,
    subfolder: projectId ? template.item.subfolder : null,
    date,
    time: null,
    recurrence: 'none',
    recurDetails: null,
    done: false,
    archived: false,
    reschedule: false,
    createdAt: now,
    customProps: template.item.customProps || {},
    subtasks: (template.item.subtasks || []).map((subtask, index) => ({
      id: `${now}_${index}`,
      text: subtask.text,
      done: false
    }))
  };
}

export function createPageFromTemplate(template, { parentId = null } = {}) {
  const page = createPage({
    parentId,
    title: template.page.title,
    icon: template.page.icon
  });
  page.blocks = template.page.blocks.map(([type, text]) => createBlock(type, text));
  page.updatedAt = Date.now();
  return page;
}

export function createJobFromTemplate(template) {
  const now = Date.now();
  return {
    id: makeId('job'),
    company: template.job.company,
    role: template.job.role,
    link: '',
    status: template.job.status,
    payRate: '',
    schedule: '',
    location: '',
    contactName: '',
    contactEmail: '',
    resumeVersion: '',
    applicationDate: '',
    interviewDate: '',
    followUpDate: '',
    nextAction: template.job.nextAction,
    notes: template.job.notes,
    createdAt: now,
    updatedAt: now
  };
}
