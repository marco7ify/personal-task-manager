import { useState } from 'react';
import { Store } from '../utils/store';
import {
  AI_MODEL_PRESETS,
  applyAiSuggestions,
  getConfiguredModel,
  normalizeSuggestions,
  organizeWithAi,
  suggestionNeedsDestination
} from '../utils/aiIntake';
import { getRuleLabel } from '../utils/aiInboxRules';
import '../styles/AIIntake.css';

const ACTION_LABELS = {
  create_item: 'Create task/event',
  append_subtask: 'Append subtask',
  create_parent_with_subtasks: 'Create task + subtasks',
  create_job: 'Create job',
  create_page: 'Create notebook page'
};

const ITEM_TYPE_LABELS = {
  task: 'Task',
  event: 'Event',
  exam: 'Exam',
  assignment: 'Assignment',
  quiz: 'Quiz',
  homework: 'Homework',
  study_session: 'Study session'
};

function categoryAllowsSuggestion(suggestion, categories) {
  if (suggestion.action === 'create_job' || suggestion.kind === 'job') return categories.jobs;
  if (suggestion.action === 'create_page' || suggestion.kind === 'page') return categories.pages;
  if (suggestion.kind === 'event' || suggestion.itemType === 'event') return categories.events;
  return categories.tasks;
}

function filterWarningsForCategories(warnings, categories) {
  return (warnings || []).filter((warning) => {
    const text = String(warning || '').toLowerCase();
    if (!categories.pages && /\b(page|pages|notebook|notebooks|idea|ideas|reference|references)\b/.test(text)) {
      return false;
    }
    if (!categories.tasks && /\b(task|tasks|project|projects|todo|to-do)\b/.test(text)) {
      return false;
    }
    if (!categories.jobs && /\b(job|jobs|application|applications)\b/.test(text)) {
      return false;
    }
    if (!categories.events && /\b(event|events|appointment|appointments)\b/.test(text)) {
      return false;
    }
    return true;
  });
}

function adaptSuggestionsToCategories(suggestions, categories, inputText) {
  const adapted = suggestions.map((suggestion) => {
    const isPage = suggestion.action === 'create_page' || suggestion.kind === 'page';
    if (isPage && !categories.pages && categories.tasks) {
      return {
        ...suggestion,
        kind: 'task',
        action: suggestion.blocks?.length > 0 ? 'create_parent_with_subtasks' : 'create_item',
        title: suggestion.pageTitle || suggestion.title || suggestion.notebookTitle || 'New task',
        notes: suggestion.notes || `Converted from notebook suggestion${suggestion.notebookTitle ? `: ${suggestion.notebookTitle}` : ''}.`,
        notebookId: '',
        notebookTitle: '',
        pageTitle: '',
        blocks: [],
        subtasks: suggestion.blocks?.length > 0 ? suggestion.blocks : suggestion.subtasks || []
      };
    }
    return suggestion;
  });

  const scoped = adapted.filter((suggestion) => categoryAllowsSuggestion(suggestion, categories));
  if (scoped.length > 0 || !categories.tasks) return scoped;

  const fallback = buildTaskFallbackFromInput(inputText);
  return fallback ? [fallback] : [];
}

function buildTaskFallbackFromInput(inputText) {
  const lines = String(inputText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const titleLine = lines[0].replace(/[:#]+$/g, '').trim() || 'New task';
  const subtasks = lines
    .slice(1)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  return {
    id: `fallback_${Date.now()}`,
    kind: 'task',
    action: subtasks.length > 0 ? 'create_parent_with_subtasks' : 'create_item',
    title: titleLine,
    notes: 'Created locally because the AI response did not match the enabled categories.',
    confidence: 0.5,
    destination: '',
    createNewDestination: false,
    projectId: '',
    projectName: '',
    subfolder: '',
    date: '',
    time: '',
        recurrence: 'none',
        itemType: 'task',
        matchedRuleIds: ['task'],
        subtasks,
    existingTaskId: '',
    company: '',
    role: '',
    link: '',
    status: 'interested',
    payRate: '',
    schedule: '',
        location: '',
        contactName: '',
        contactEmail: '',
        applicationDate: '',
        interviewDate: '',
        followUpDate: '',
        nextAction: '',
        notebookId: '',
    notebookTitle: '',
    pageTitle: '',
    blockFormat: 'bullet',
    blocks: []
  };
}

export function AIIntakeView({ onUpdate, embedded = false }) {
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState(Store.settings.aiDefaultModel || 'gpt-5.5');
  const [customModel, setCustomModel] = useState(Store.settings.aiCustomModel || '');
  const [allowNewDestinations, setAllowNewDestinations] = useState(
    Store.settings.aiAllowNewDestinations === true
  );
  const [categories, setCategories] = useState({
    tasks: Store.settings.aiCategories?.tasks !== false,
    events: Store.settings.aiCategories?.events !== false,
    jobs: Store.settings.aiCategories?.jobs !== false,
    pages: Store.settings.aiCategories?.pages !== false
  });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [warnings, setWarnings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const projects = Store.projects || [];
  const openTasks = (Store.items || []).filter((item) => !item.done && !item.archived);
  const notebooks = (Store.pages || []).filter((page) => !page.parentId);
  const model = selectedModel === 'custom' ? customModel.trim() || getConfiguredModel() : selectedModel;
  const selectedSuggestions = suggestions.filter((item) => selectedIds.has(item.id));

  const saveAiDefaults = () => {
    Store.settings.aiDefaultModel = selectedModel;
    Store.settings.aiCustomModel = customModel.trim();
    Store.settings.aiAllowNewDestinations = allowNewDestinations;
    Store.settings.aiCategories = categories;
    Store.save();
  };

  const resetReviewState = () => {
    setSuggestions([]);
    setSelectedIds(new Set());
    setWarnings([]);
    setMessage('');
    setError('');
  };

  const updateCategory = (key, checked) => {
    setCategories((current) => ({ ...current, [key]: checked }));
    resetReviewState();
  };

  const updateAllowNewDestinations = (checked) => {
    setAllowNewDestinations(checked);
    resetReviewState();
  };

  const handleOrganize = async () => {
    setError('');
    setMessage('');
    if (!inputText.trim()) {
      setError('Paste a list or notes first.');
      return;
    }
    if (!Object.values(categories).some(Boolean)) {
      setError('Turn on at least one category.');
      return;
    }

    saveAiDefaults();
    setLoading(true);
    try {
      const result = await organizeWithAi({
        inputText,
        model,
        categories,
        allowNewDestinations
      });
      const scopedSuggestions = adaptSuggestionsToCategories(result.suggestions, categories, inputText);
      setSuggestions(scopedSuggestions);
      setSelectedIds(new Set(scopedSuggestions.map((suggestion) => suggestion.id)));
      setWarnings(filterWarningsForCategories(result.warnings, categories));
      setMessage(
        scopedSuggestions.length > 0
          ? `${scopedSuggestions.length} suggestion(s) ready to review.`
          : 'No suggestions matched the enabled categories.'
      );
    } catch (err) {
      setError(err?.message || 'AI organizer failed.');
    } finally {
      setLoading(false);
    }
  };

  const updateSuggestion = (id, patch) => {
    setSuggestions((current) =>
      normalizeSuggestions(
        current.map((suggestion) =>
          suggestion.id === id ? { ...suggestion, ...patch } : suggestion
        )
      )
    );
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyList = (items) => {
    setError('');
    setMessage('');
    const usable = items.filter((suggestion) => !suggestionNeedsDestination(suggestion, allowNewDestinations));
    if (usable.length === 0) {
      setError('Choose destinations for the selected suggestion(s) first.');
      return;
    }
    const results = applyAiSuggestions(usable, { allowNewDestinations });
    const appliedIds = new Set(
      usable.filter((_, index) => results[index]?.ok).map((suggestion) => suggestion.id)
    );
    setSuggestions((current) => current.filter((suggestion) => !appliedIds.has(suggestion.id)));
    setSelectedIds((current) => {
      const next = new Set(current);
      appliedIds.forEach((id) => next.delete(id));
      return next;
    });
    onUpdate?.();
    const okCount = results.filter((result) => result.ok).length;
    const failed = results.filter((result) => !result.ok);
    setMessage(`${okCount} suggestion(s) applied.`);
    if (failed.length > 0) setError(failed.map((result) => result.message).join(' '));
  };

  const applyOne = (suggestion) => applyList([suggestion]);
  const applySelected = () => applyList(selectedSuggestions);
  const applyAll = () => applyList(suggestions);

  return (
    <div className={`ai-intake-view ${embedded ? 'embedded' : ''}`}>
      <div className="header-row">
        {embedded ? (
          <div>
            <h2 className="ai-intake-title">AI Intake</h2>
            <p className="ai-intake-subtitle">Paste loose notes, then review before anything is added.</p>
          </div>
        ) : (
          <h1 className="page-title">AI Intake</h1>
        )}
        <div className="header-controls">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOrganize} disabled={loading}>
            {loading ? 'Organizing...' : 'Organize with AI'}
          </button>
        </div>
      </div>

      <div className="ai-intake-layout">
        <section className="ai-intake-panel">
          <div className="ai-control-grid">
            <label>
              <span>Model</span>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                {AI_MODEL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}: {preset.model === 'custom' ? 'Custom model' : preset.model}
                  </option>
                ))}
              </select>
            </label>
            {selectedModel === 'custom' && (
              <label>
                <span>Custom model ID</span>
                <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
              </label>
            )}
            <label className="ai-switch">
              <input
                type="checkbox"
                checked={allowNewDestinations}
                onChange={(e) => updateAllowNewDestinations(e.target.checked)}
              />
              <span>Allow new folders/notebooks/pages</span>
            </label>
          </div>

          <div className="ai-category-row">
            {[
              ['tasks', 'Tasks / projects'],
              ['events', 'Appointments'],
              ['jobs', 'Jobs'],
              ['pages', 'Notebooks / ideas']
            ].map(([key, label]) => (
              <label key={key} className="ai-chip">
                <input
                  type="checkbox"
                  checked={categories[key]}
                  onChange={(e) => updateCategory(key, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <textarea
            className="ai-intake-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste tasks, ideas, jobs, appointments, notes, or a ChatGPT-organized list here..."
          />

          <div className="ai-status-row">
            {error && <div className="ai-status error">{error}</div>}
            {message && <div className="ai-status success">{message}</div>}
            {warnings.length > 0 && <div className="ai-status">{warnings.join(' ')}</div>}
          </div>
        </section>

        <section className="ai-review-panel">
          <div className="ai-review-header">
            <div>
              <strong>Review suggestions</strong>
              <span>{selectedSuggestions.length} selected</span>
            </div>
            <div className="ai-review-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={applySelected} disabled={selectedSuggestions.length === 0}>
                Apply Selected
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={applyAll} disabled={suggestions.length === 0}>
                Apply All
              </button>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <div className="empty-state">AI suggestions will appear here before anything is added.</div>
          ) : (
            <div className="ai-suggestion-list">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  selected={selectedIds.has(suggestion.id)}
                  projects={projects}
                  openTasks={openTasks}
                  notebooks={notebooks}
                  allowNewDestinations={allowNewDestinations}
                  onToggle={() => toggleSelected(suggestion.id)}
                  onChange={(patch) => updateSuggestion(suggestion.id, patch)}
                  onApply={() => applyOne(suggestion)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  selected,
  projects,
  openTasks,
  notebooks,
  allowNewDestinations,
  onToggle,
  onChange,
  onApply
}) {
  const needsDestination = suggestionNeedsDestination(suggestion, allowNewDestinations);

  const setAction = (action) => {
    const patch = { action };
    if (action === 'create_job') patch.kind = 'job';
    if (action === 'create_page') patch.kind = 'page';
    if (action === 'append_subtask') patch.kind = 'task';
    onChange(patch);
  };

  return (
    <article className={`ai-suggestion-card ${selected ? 'selected' : ''}`}>
      <div className="ai-suggestion-top">
        <label className="ai-suggestion-check">
          <input type="checkbox" checked={selected} onChange={onToggle} />
        </label>
        <input
          className="ai-title-input"
          value={suggestion.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <span className="ai-confidence">{Math.round((suggestion.confidence || 0) * 100)}%</span>
      </div>

      {suggestion.matchedRuleIds?.length > 0 && (
        <div className="ai-rule-row">
          {suggestion.matchedRuleIds.map((ruleId) => (
            <span key={ruleId}>{getRuleLabel(ruleId)}</span>
          ))}
        </div>
      )}

      <div className="ai-card-grid">
        <label>
          <span>Action</span>
          <select value={suggestion.action} onChange={(e) => setAction(e.target.value)}>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {(suggestion.action === 'create_item' || suggestion.action === 'create_parent_with_subtasks') && (
          <label>
            <span>Item type</span>
            <select
              value={suggestion.itemType || (suggestion.kind === 'event' ? 'event' : 'task')}
              onChange={(e) => {
                const itemType = e.target.value;
                onChange({
                  itemType,
                  kind: itemType === 'event' ? 'event' : 'task'
                });
              }}
            >
              {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        )}
        {renderDestinationFields({ suggestion, projects, openTasks, notebooks, allowNewDestinations, onChange })}
      </div>

      {suggestion.action === 'create_job' && (
        <div className="ai-card-grid">
          <label>
            <span>Company</span>
            <input value={suggestion.company} onChange={(e) => onChange({ company: e.target.value })} />
          </label>
          <label>
            <span>Role</span>
            <input value={suggestion.role} onChange={(e) => onChange({ role: e.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={suggestion.status} onChange={(e) => onChange({ status: e.target.value })}>
              <option value="interested">Interested</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            <span>Pay</span>
            <input value={suggestion.payRate} onChange={(e) => onChange({ payRate: e.target.value })} />
          </label>
          <label>
            <span>Schedule</span>
            <input value={suggestion.schedule} onChange={(e) => onChange({ schedule: e.target.value })} />
          </label>
          <label>
            <span>Location</span>
            <input value={suggestion.location} onChange={(e) => onChange({ location: e.target.value })} />
          </label>
          <label>
            <span>Interview date</span>
            <input type="date" value={suggestion.interviewDate} onChange={(e) => onChange({ interviewDate: e.target.value })} />
          </label>
          <label>
            <span>Follow up</span>
            <input type="date" value={suggestion.followUpDate} onChange={(e) => onChange({ followUpDate: e.target.value })} />
          </label>
          <label>
            <span>Next action</span>
            <input value={suggestion.nextAction} onChange={(e) => onChange({ nextAction: e.target.value })} />
          </label>
        </div>
      )}

      {(suggestion.action === 'create_item' || suggestion.action === 'create_parent_with_subtasks') && (
        <div className="ai-card-grid">
          <label>
            <span>Date</span>
            <input type="date" value={suggestion.date} onChange={(e) => onChange({ date: e.target.value })} />
          </label>
          <label>
            <span>Time</span>
            <input type="time" value={suggestion.time} onChange={(e) => onChange({ time: e.target.value })} />
          </label>
          <label>
            <span>Repeat</span>
            <select value={suggestion.recurrence} onChange={(e) => onChange({ recurrence: e.target.value })}>
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      )}

      {suggestion.action !== 'create_job' && suggestion.action !== 'create_page' && (
        <label className="ai-wide-field">
          <span>Subtasks</span>
          <textarea
            rows={3}
            value={suggestion.subtasks.join('\n')}
            onChange={(e) => onChange({ subtasks: e.target.value.split('\n') })}
          />
        </label>
      )}

      {suggestion.action === 'create_page' && (
        <>
          <div className="ai-card-grid">
            <label>
              <span>Notebook format</span>
              <select
                value={suggestion.blockFormat || 'bullet'}
                onChange={(e) => onChange({ blockFormat: e.target.value })}
              >
                <option value="bullet">Bulleted item list</option>
                <option value="todo">To-do list</option>
                <option value="hyphen_text">Text with hyphens</option>
                <option value="plain_text">Plain text</option>
              </select>
            </label>
          </div>
          <label className="ai-wide-field">
            <span>Page content</span>
            <textarea
              rows={4}
              value={suggestion.blocks.join('\n')}
              onChange={(e) => onChange({ blocks: e.target.value.split('\n') })}
            />
          </label>
        </>
      )}

      <label className="ai-wide-field">
        <span>Notes</span>
        <textarea rows={2} value={suggestion.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </label>

      <div className="ai-card-footer">
        {needsDestination && <span className="ai-warning">Destination needed</span>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onApply} disabled={needsDestination}>
          Apply
        </button>
      </div>
    </article>
  );
}

function renderDestinationFields({ suggestion, projects, openTasks, notebooks, allowNewDestinations, onChange }) {
  if (suggestion.action === 'append_subtask') {
    return (
      <label>
        <span>Existing task</span>
        <select value={suggestion.existingTaskId} onChange={(e) => onChange({ existingTaskId: e.target.value })}>
          <option value="">Choose task</option>
          {openTasks.map((task) => (
            <option key={task.id} value={String(task.id)}>{task.text}</option>
          ))}
        </select>
      </label>
    );
  }

  if (suggestion.action === 'create_page') {
    return (
      <>
        <label>
          <span>Notebook</span>
          <select
            value={suggestion.notebookId}
            onChange={(e) => onChange({ notebookId: e.target.value, createNewDestination: false })}
          >
            <option value="">Choose notebook</option>
            {notebooks.map((page) => (
              <option key={page.id} value={page.id}>{page.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>New notebook name</span>
          <input
            value={suggestion.notebookTitle}
            disabled={!allowNewDestinations}
            placeholder={allowNewDestinations ? 'Create or reuse notebook' : 'Turn on allow new first'}
            onChange={(e) =>
              onChange({
                notebookTitle: e.target.value,
                createNewDestination: !!e.target.value.trim(),
                notebookId: ''
              })
            }
          />
        </label>
        <label>
          <span>Page title</span>
          <input value={suggestion.pageTitle} onChange={(e) => onChange({ pageTitle: e.target.value })} />
        </label>
      </>
    );
  }

  if (suggestion.action === 'create_job') {
    return (
      <label>
        <span>Application link</span>
        <input value={suggestion.link} onChange={(e) => onChange({ link: e.target.value })} />
      </label>
    );
  }

  return (
    <>
      <label>
        <span>Project</span>
        <select
          value={suggestion.projectId}
          onChange={(e) => {
            const project = projects.find((item) => item.id === e.target.value);
            onChange({
              projectId: e.target.value,
              projectName: project?.name || '',
              createNewDestination: false
            });
          }}
        >
          <option value="">Inbox / no project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>New project</span>
        <input
          value={suggestion.projectId ? '' : suggestion.projectName}
          disabled={!allowNewDestinations || !!suggestion.projectId}
          onChange={(e) =>
            onChange({
              projectName: e.target.value,
              createNewDestination: !!e.target.value.trim(),
              projectId: ''
            })
          }
        />
      </label>
      <label>
        <span>Subfolder</span>
        <input value={suggestion.subfolder} onChange={(e) => onChange({ subfolder: e.target.value })} />
      </label>
    </>
  );
}
