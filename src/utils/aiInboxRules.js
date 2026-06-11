export const AI_INBOX_RULES = [
  {
    id: 'exam',
    label: 'Exam',
    description: 'Exam, test, midterm, final, practical, or proctored assessment.',
    prefer: { kind: 'task', action: 'create_item', itemType: 'exam' },
    examples: ['biology exam tomorrow', 'final practical next week', 'test on chapter 4']
  },
  {
    id: 'interview',
    label: 'Interview',
    description: 'Interview, phone screen, recruiter call, hiring manager call, or interview preparation.',
    prefer: { kind: 'job', action: 'create_job', status: 'interviewing' },
    examples: ['interview with HCA Tuesday', 'phone screen with recruiter', 'prep for hiring manager call']
  },
  {
    id: 'appointment',
    label: 'Appointment',
    description: 'Appointments, visits, meetings, calls, classes, or scheduled time-bound events.',
    prefer: { kind: 'event', action: 'create_item', itemType: 'event' },
    examples: ['call chiropractor tomorrow', 'dentist appointment Friday', 'meeting at 3pm']
  },
  {
    id: 'job_application',
    label: 'Job application',
    description: 'Job leads, roles, applications, companies, application links, or follow-up tasks.',
    prefer: { kind: 'job', action: 'create_job', status: 'interested' },
    examples: ['apply to nurse role at HCA', 'follow up with recruiter', 'RN job application link']
  },
  {
    id: 'notebook_idea',
    label: 'Notebook idea',
    description: 'App ideas, business ideas, guides, references, research, concepts, or notes.',
    prefer: { kind: 'page', action: 'create_page' },
    examples: ['dating app idea', 'nursing study guide concept', 'business idea notes']
  },
  {
    id: 'task',
    label: 'Task',
    description: 'Ordinary to-dos, errands, chores, admin work, or multi-step outcomes.',
    prefer: { kind: 'task', action: 'create_item', itemType: 'task' },
    examples: ['renew license', 'buy ear cleaner', 'fix garage door']
  }
];

export function getAiInboxRules() {
  return AI_INBOX_RULES;
}

export function getRuleLabel(ruleId) {
  return AI_INBOX_RULES.find((rule) => rule.id === ruleId)?.label || ruleId;
}
