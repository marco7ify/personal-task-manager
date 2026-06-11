import { useState } from 'react';
import { Store } from '../utils/store';
import { JOB_TEMPLATES } from '../utils/templates';
import '../styles/Jobs.css';

const JOB_STATUSES = [
  { id: 'all', label: 'All' },
  { id: 'interested', label: 'Interested' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' }
];

const EMPTY_FORM = {
  company: '',
  role: '',
  link: '',
  status: 'interested',
  payRate: '',
  schedule: '',
  location: '',
  contactName: '',
  contactEmail: '',
  resumeVersion: '',
  applicationDate: '',
  interviewDate: '',
  followUpDate: '',
  nextAction: '',
  notes: ''
};

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function JobsView({ onUpdate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const statusCounts = { all: Store.jobs.length };
  for (const status of JOB_STATUSES) statusCounts[status.id] = statusCounts[status.id] || 0;
  for (const job of Store.jobs) {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
  }

  const q = searchQuery.trim().toLowerCase();
  const visibleJobs = [...Store.jobs]
    .filter((job) => statusFilter === 'all' || job.status === statusFilter)
    .filter((job) => {
      if (!q) return true;
      return [
        job.company,
        job.role,
        job.location,
        job.schedule,
        job.payRate,
        job.contactName,
        job.contactEmail,
        job.resumeVersion,
        job.nextAction,
        job.notes
      ]
        .some((field) => String(field || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const aFollow = a.followUpDate || '9999-12-31';
      const bFollow = b.followUpDate || '9999-12-31';
      if (aFollow !== bFollow) return aFollow.localeCompare(bFollow);
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });

  const upcomingFollowUps = Store.jobs
    .filter((job) => job.followUpDate && job.followUpDate >= today && !['accepted', 'rejected'].includes(job.status))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    .slice(0, 5);
  const overdueFollowUps = Store.jobs
    .filter((job) => job.followUpDate && job.followUpDate < today && !['accepted', 'rejected'].includes(job.status))
    .length;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const applyTemplate = (template) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      ...template.job
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const company = form.company.trim();
    const role = form.role.trim();
    if (!company && !role) return;

    const now = Date.now();
    const payload = {
      company,
      role,
      link: normalizeUrl(form.link),
      status: form.status,
      payRate: form.payRate.trim(),
      schedule: form.schedule.trim(),
      location: form.location.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      resumeVersion: form.resumeVersion.trim(),
      applicationDate: form.applicationDate,
      interviewDate: form.interviewDate,
      followUpDate: form.followUpDate,
      nextAction: form.nextAction.trim(),
      notes: form.notes.trim(),
      updatedAt: now
    };

    if (editingId) {
      const job = Store.jobs.find((item) => item.id === editingId);
      if (job) Object.assign(job, payload);
    } else {
      Store.jobs.push({
        id: `job_${now}`,
        ...payload,
        createdAt: now
      });
    }

    Store.save();
    resetForm();
    onUpdate?.();
  };

  const handleEdit = (job) => {
    setEditingId(job.id);
    setForm({
      company: job.company || '',
      role: job.role || '',
      link: job.link || '',
      status: job.status || 'interested',
      payRate: job.payRate || '',
      schedule: job.schedule || '',
      location: job.location || '',
      contactName: job.contactName || '',
      contactEmail: job.contactEmail || '',
      resumeVersion: job.resumeVersion || '',
      applicationDate: job.applicationDate || '',
      interviewDate: job.interviewDate || '',
      followUpDate: job.followUpDate || '',
      nextAction: job.nextAction || '',
      notes: job.notes || ''
    });
  };

  const handleDelete = (jobId) => {
    if (!confirm('Delete this job application?')) return;
    Store.jobs = Store.jobs.filter((job) => job.id !== jobId);
    Store.save();
    if (editingId === jobId) resetForm();
    onUpdate?.();
  };

  const handleStatusChange = (job, status) => {
    job.status = status;
    job.updatedAt = Date.now();
    Store.save();
    onUpdate?.();
  };

  const handleQuickField = (job, field, value) => {
    job[field] = value;
    job.updatedAt = Date.now();
    Store.save();
    onUpdate?.();
  };

  return (
    <div className="jobs-view">
      <div className="header-row">
        <h1 className="page-title">Jobs</h1>
        <div className="header-controls">
          <input
            type="search"
            className="search-input"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="jobs-stats">
        {JOB_STATUSES.map((status) => (
          <button
            key={status.id}
            className={`jobs-status-tab ${statusFilter === status.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(status.id)}
          >
            <span>{status.label}</span>
            <span className="jobs-status-count">{statusCounts[status.id] || 0}</span>
          </button>
        ))}
      </div>

      <div className="jobs-followup-strip">
        <div className={`jobs-followup-alert ${overdueFollowUps > 0 ? 'hot' : ''}`}>
          <strong>{overdueFollowUps}</strong>
          <span>overdue follow-ups</span>
        </div>
        <div className="jobs-followup-list">
          {upcomingFollowUps.length === 0 ? (
            <span className="jobs-followup-empty">No upcoming follow-ups scheduled.</span>
          ) : (
            upcomingFollowUps.map((job) => (
              <button key={job.id} type="button" onClick={() => handleEdit(job)}>
                <span>{job.followUpDate}</span>
                <strong>{job.company || job.role || 'Untitled job'}</strong>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="jobs-template-strip">
        <span>Templates</span>
        {JOB_TEMPLATES.map((template) => (
          <button key={template.id} type="button" onClick={() => applyTemplate(template)}>
            <strong>{template.title}</strong>
            <small>{template.description}</small>
          </button>
        ))}
      </div>

      <form className="jobs-form" onSubmit={handleSubmit}>
        <div className="jobs-form-grid">
          <label>
            <span>Company</span>
            <input value={form.company} onChange={(e) => updateField('company', e.target.value)} />
          </label>
          <label>
            <span>Role</span>
            <input value={form.role} onChange={(e) => updateField('role', e.target.value)} />
          </label>
          <label>
            <span>Application link</span>
            <input value={form.link} onChange={(e) => updateField('link', e.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
              {JOB_STATUSES.filter((status) => status.id !== 'all').map((status) => (
                <option key={status.id} value={status.id}>{status.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Pay rate</span>
            <input value={form.payRate} onChange={(e) => updateField('payRate', e.target.value)} placeholder="$18/hr, $60k, etc." />
          </label>
          <label>
            <span>Schedule</span>
            <input value={form.schedule} onChange={(e) => updateField('schedule', e.target.value)} placeholder="M-F 9-5, nights, remote" />
          </label>
          <label>
            <span>Location</span>
            <input value={form.location} onChange={(e) => updateField('location', e.target.value)} />
          </label>
          <label>
            <span>Contact name</span>
            <input value={form.contactName} onChange={(e) => updateField('contactName', e.target.value)} />
          </label>
          <label>
            <span>Contact email</span>
            <input value={form.contactEmail} onChange={(e) => updateField('contactEmail', e.target.value)} />
          </label>
          <label>
            <span>Resume/version</span>
            <input value={form.resumeVersion} onChange={(e) => updateField('resumeVersion', e.target.value)} placeholder="General v3, retail resume, etc." />
          </label>
          <label>
            <span>Applied on</span>
            <input type="date" value={form.applicationDate} onChange={(e) => updateField('applicationDate', e.target.value)} />
          </label>
          <label>
            <span>Interview date</span>
            <input type="date" value={form.interviewDate} onChange={(e) => updateField('interviewDate', e.target.value)} />
          </label>
          <label>
            <span>Follow up</span>
            <input type="date" value={form.followUpDate} onChange={(e) => updateField('followUpDate', e.target.value)} />
          </label>
          <label className="jobs-next-action-field">
            <span>Next action</span>
            <input value={form.nextAction} onChange={(e) => updateField('nextAction', e.target.value)} placeholder="Send thank-you note, check portal, call recruiter..." />
          </label>
          <label className="jobs-notes-field">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} />
          </label>
        </div>
        <div className="jobs-form-actions">
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            {editingId ? 'Save job' : 'Add job'}
          </button>
        </div>
      </form>

      <div className="jobs-list">
        {visibleJobs.length === 0 ? (
          <div className="empty-state">No jobs match this view.</div>
        ) : (
          visibleJobs.map((job) => (
            <article key={job.id} className="job-card">
              <div className="job-card-main">
                <div>
                  <h2>{job.role || 'Untitled role'}</h2>
                  <div className="job-company">{job.company || 'Unknown company'}</div>
                </div>
                <select
                  className={`job-status job-status-${job.status}`}
                  value={job.status}
                  onChange={(e) => handleStatusChange(job, e.target.value)}
                >
                  {JOB_STATUSES.filter((status) => status.id !== 'all').map((status) => (
                    <option key={status.id} value={status.id}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div className="job-meta">
                {job.payRate && <span>Pay: {job.payRate}</span>}
                {job.schedule && <span>Schedule: {job.schedule}</span>}
                {job.location && <span>Location: {job.location}</span>}
                {job.applicationDate && <span>Applied: {job.applicationDate}</span>}
                {job.interviewDate && <span>Interview: {job.interviewDate}</span>}
                {job.followUpDate && (
                  <span className={job.followUpDate < today && !['accepted', 'rejected'].includes(job.status) ? 'job-meta-hot' : ''}>
                    Follow up: {job.followUpDate}
                  </span>
                )}
                {job.resumeVersion && <span>Resume: {job.resumeVersion}</span>}
                {(job.contactName || job.contactEmail) && (
                  <span>Contact: {[job.contactName, job.contactEmail].filter(Boolean).join(' - ')}</span>
                )}
              </div>

              {job.nextAction && <div className="job-next-action">Next: {job.nextAction}</div>}
              {job.notes && <p className="job-notes">{job.notes}</p>}

              <div className="job-actions">
                {job.link && (
                  <a className="btn btn-secondary btn-sm" href={job.link} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(job)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickField(job, 'followUpDate', '')}
                  disabled={!job.followUpDate}
                >
                  Clear follow-up
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
