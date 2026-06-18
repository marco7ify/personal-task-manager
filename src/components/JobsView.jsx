import { useState } from 'react';
import { Store } from '../utils/store';
import { tailorResumeWithAi } from '../utils/aiResume';
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
  resumeVersionId: '',
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

function resumeLabel(resume) {
  if (!resume) return '';
  const context = [resume.company, resume.role].filter(Boolean).join(' - ');
  return context ? `${resume.name} (${context})` : resume.name;
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function JobsView({ onUpdate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [baseResumeName, setBaseResumeName] = useState('');
  const [baseResumeText, setBaseResumeText] = useState('');
  const [baseResumeFileName, setBaseResumeFileName] = useState('');
  const [selectedBaseResumeId, setSelectedBaseResumeId] = useState('');
  const [resumeJobId, setResumeJobId] = useState('');
  const [jobDescriptionText, setJobDescriptionText] = useState('');
  const [resumeMessage, setResumeMessage] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const resumes = Array.isArray(Store.resumes) ? Store.resumes : [];
  const baseResumes = resumes.filter((resume) => resume.type === 'base');
  const tailoredResumes = resumes.filter((resume) => resume.type === 'tailored');
  const selectedBaseResume = resumes.find((resume) => resume.id === selectedBaseResumeId);

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
        resumes.find((resume) => resume.id === job.resumeVersionId)?.name,
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

  const resolveResumeName = (resumeId, fallback = '') => {
    if (!resumeId) return fallback;
    return resumes.find((resume) => resume.id === resumeId)?.name || fallback;
  };

  const handleResumeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBaseResumeFileName(file.name);
    setBaseResumeName((current) => current || file.name.replace(/\.[^.]+$/, ''));
    setBaseResumeText(text);
    setSelectedBaseResumeId('');
    setResumeError('');
    setResumeMessage('');
  };

  const handleLoadResume = (resume) => {
    setSelectedBaseResumeId(resume.id);
    setBaseResumeName(resume.name || '');
    setBaseResumeText(resume.content || '');
    setBaseResumeFileName(resume.fileName || '');
    setResumeError('');
    setResumeMessage('');
  };

  const saveBaseResume = () => {
    const content = baseResumeText.trim();
    if (!content) {
      setResumeError('Add resume text before saving.');
      return null;
    }

    const now = Date.now();
    const existing = selectedBaseResumeId ? resumes.find((resume) => resume.id === selectedBaseResumeId) : null;
    const name = (baseResumeName || baseResumeFileName || 'Base resume').trim();

    if (existing && existing.type === 'base') {
      Object.assign(existing, {
        name,
        fileName: baseResumeFileName,
        content,
        updatedAt: now
      });
      Store.save();
      onUpdate?.();
      setResumeMessage('Base resume updated.');
      return existing;
    }

    const nextResume = {
      id: `resume_${now}`,
      name,
      type: 'base',
      sourceResumeId: '',
      jobId: '',
      company: '',
      role: '',
      fileName: baseResumeFileName,
      content,
      jobDescription: '',
      summary: '',
      keywordMatches: [],
      warnings: [],
      createdAt: now,
      updatedAt: now
    };
    Store.resumes = [...resumes, nextResume];
    Store.save();
    setSelectedBaseResumeId(nextResume.id);
    setResumeMessage('Base resume saved.');
    setResumeError('');
    onUpdate?.();
    return nextResume;
  };

  const handleDeleteResume = (resumeId) => {
    if (!confirm('Delete this resume version?')) return;
    Store.resumes = resumes.filter((resume) => resume.id !== resumeId);
    Store.jobs = Store.jobs.map((job) => {
      if (job.resumeVersionId !== resumeId) return job;
      return { ...job, resumeVersionId: '', resumeVersion: '' };
    });
    Store.save();
    if (selectedBaseResumeId === resumeId) {
      setSelectedBaseResumeId('');
      setBaseResumeName('');
      setBaseResumeText('');
      setBaseResumeFileName('');
    }
    onUpdate?.();
  };

  const handleGenerateResume = async () => {
    const baseResume = selectedBaseResume || (baseResumeText.trim() ? saveBaseResume() : null);
    if (!baseResume?.content?.trim()) {
      setResumeError('Save a base resume first.');
      return;
    }
    if (!jobDescriptionText.trim()) {
      setResumeError('Paste a job description first.');
      return;
    }

    const linkedJob = Store.jobs.find((job) => job.id === resumeJobId);
    setResumeLoading(true);
    setResumeError('');
    setResumeMessage('');

    try {
      const result = await tailorResumeWithAi({
        baseResume: baseResume.content,
        jobDescription: jobDescriptionText,
        jobContext: linkedJob
          ? {
              company: linkedJob.company,
              role: linkedJob.role,
              link: linkedJob.link,
              notes: linkedJob.notes
            }
          : {}
      });

      const now = Date.now();
      const name = result.title || [
        linkedJob?.company,
        linkedJob?.role,
        'Tailored resume'
      ].filter(Boolean).join(' - ');
      const nextResume = {
        id: `resume_${now}`,
        name,
        type: 'tailored',
        sourceResumeId: baseResume.id,
        jobId: linkedJob?.id || '',
        company: linkedJob?.company || '',
        role: linkedJob?.role || '',
        fileName: `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tailored-resume'}.txt`,
        content: result.tailoredResume,
        jobDescription: jobDescriptionText,
        summary: result.summary,
        keywordMatches: result.keywordMatches,
        warnings: result.warnings,
        createdAt: now,
        updatedAt: now
      };

      Store.resumes = [...(Store.resumes || []), nextResume];
      if (linkedJob) {
        linkedJob.resumeVersionId = nextResume.id;
        linkedJob.resumeVersion = nextResume.name;
        linkedJob.updatedAt = now;
      }
      Store.save();
      setSelectedBaseResumeId(nextResume.id);
      setBaseResumeName(nextResume.name);
      setBaseResumeText(nextResume.content);
      setBaseResumeFileName(nextResume.fileName);
      setResumeMessage(linkedJob ? `Saved and linked to ${linkedJob.company || linkedJob.role}.` : 'Tailored resume saved.');
      onUpdate?.();
    } catch (err) {
      setResumeError(err?.message || 'AI resume editor failed.');
    } finally {
      setResumeLoading(false);
    }
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
      resumeVersion: resolveResumeName(form.resumeVersionId, form.resumeVersion.trim()),
      resumeVersionId: form.resumeVersionId,
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
      resumeVersionId: job.resumeVersionId || '',
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

      <section className="jobs-resume-section">
        <div className="jobs-resume-editor">
          <div className="jobs-section-header">
            <div>
              <h2>Resume versions</h2>
              <p>{resumes.length} saved</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={saveBaseResume}>
              Save base resume
            </button>
          </div>

          <div className="jobs-resume-grid">
            <label>
              <span>Resume name</span>
              <input
                value={baseResumeName}
                onChange={(e) => setBaseResumeName(e.target.value)}
                placeholder="General resume"
              />
            </label>
            <label>
              <span>Upload</span>
              <input type="file" accept=".txt,.md,.text" onChange={handleResumeFile} />
            </label>
            <label>
              <span>Base resume</span>
              <select value={selectedBaseResumeId} onChange={(e) => {
                const resume = resumes.find((item) => item.id === e.target.value);
                if (resume) handleLoadResume(resume);
                else setSelectedBaseResumeId('');
              }}>
                <option value="">Unsaved draft</option>
                {baseResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>{resumeLabel(resume)}</option>
                ))}
                {tailoredResumes.length > 0 && (
                  <option disabled>Tailored versions</option>
                )}
                {tailoredResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>{resumeLabel(resume)}</option>
                ))}
              </select>
            </label>
            <label className="jobs-resume-text-field">
              <span>Resume text</span>
              <textarea
                value={baseResumeText}
                onChange={(e) => {
                  setBaseResumeText(e.target.value);
                  setSelectedBaseResumeId('');
                }}
                rows={8}
                placeholder="Paste your resume text here"
              />
            </label>
          </div>
        </div>

        <div className="jobs-resume-ai">
          <div className="jobs-section-header">
            <div>
              <h2>Tailor with AI</h2>
              <p>{tailoredResumes.length} tailored</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleGenerateResume}
              disabled={resumeLoading}
            >
              {resumeLoading ? 'Generating...' : 'Generate version'}
            </button>
          </div>

          <div className="jobs-resume-grid">
            <label>
              <span>Link to job</span>
              <select value={resumeJobId} onChange={(e) => setResumeJobId(e.target.value)}>
                <option value="">No linked job</option>
                {Store.jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {[job.company, job.role].filter(Boolean).join(' - ') || 'Untitled job'}
                  </option>
                ))}
              </select>
            </label>
            <label className="jobs-resume-text-field">
              <span>Job description</span>
              <textarea
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
                rows={8}
                placeholder="Paste the job description here"
              />
            </label>
          </div>

          {resumeError && <div className="jobs-resume-alert error">{resumeError}</div>}
          {resumeMessage && <div className="jobs-resume-alert">{resumeMessage}</div>}
        </div>
      </section>

      {resumes.length > 0 && (
        <div className="jobs-resume-list">
          {resumes
            .slice()
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
            .map((resume) => (
              <article key={resume.id} className={`jobs-resume-card ${resume.type}`}>
                <div>
                  <strong>{resume.name}</strong>
                  <span>{resume.type === 'tailored' ? 'Tailored' : 'Base'}{resume.company || resume.role ? ` - ${[resume.company, resume.role].filter(Boolean).join(' - ')}` : ''}</span>
                  {resume.summary && <p>{resume.summary}</p>}
                  {resume.keywordMatches.length > 0 && (
                    <div className="jobs-resume-keywords">
                      {resume.keywordMatches.slice(0, 8).map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="jobs-resume-card-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleLoadResume(resume)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadTextFile(resume.fileName || `${resume.name}.txt`, resume.content)}
                  >
                    Download
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteResume(resume.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}

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
            <span>Resume version</span>
            <select value={form.resumeVersionId} onChange={(e) => {
              const resumeId = e.target.value;
              updateField('resumeVersionId', resumeId);
              updateField('resumeVersion', resolveResumeName(resumeId, ''));
            }}>
              <option value="">{form.resumeVersion ? `Current: ${form.resumeVersion}` : 'No resume linked'}</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>{resumeLabel(resume)}</option>
              ))}
            </select>
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
                {(job.resumeVersion || job.resumeVersionId) && (
                  <span>Resume: {resolveResumeName(job.resumeVersionId, job.resumeVersion)}</span>
                )}
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
                {job.resumeVersionId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const resume = resumes.find((item) => item.id === job.resumeVersionId);
                      if (resume) handleLoadResume(resume);
                    }}
                  >
                    Open resume
                  </button>
                )}
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
