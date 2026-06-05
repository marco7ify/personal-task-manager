import { useMemo, useState } from 'react';
import { Store } from '../utils/store';
import { mergeImportedTasks, parseImportedTaskText } from '../utils/importParser';
import { AI_MODEL_PRESETS, getStoredOpenAiKey, setStoredOpenAiKey } from '../utils/aiIntake';
import { PropertySettings } from './PropertySettings';
import '../styles/Settings.css';
import '../styles/Button.css';
import '../styles/Modal.css';

export function Settings({ onBack, onUpdate }) {
  const [showPropertySettings, setShowPropertySettings] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [openAiKey, setOpenAiKey] = useState(getStoredOpenAiKey());
  const [aiDefaultModel, setAiDefaultModel] = useState(Store.settings.aiDefaultModel || 'gpt-5.5');
  const [aiCustomModel, setAiCustomModel] = useState(Store.settings.aiCustomModel || '');
  const [aiAllowNewDestinations, setAiAllowNewDestinations] = useState(
    Store.settings.aiAllowNewDestinations === true
  );
  const [aiCategories, setAiCategories] = useState({
    tasks: Store.settings.aiCategories?.tasks !== false,
    events: Store.settings.aiCategories?.events !== false,
    jobs: Store.settings.aiCategories?.jobs !== false,
    pages: Store.settings.aiCategories?.pages !== false
  });

  const handleSave = () => {
    Store.settings.startHour = parseInt(document.getElementById('settingStartHour').value, 10);
    Store.settings.endHour = parseInt(document.getElementById('settingEndHour').value, 10);
    Store.settings.rescheduleHours = parseInt(document.getElementById('settingRescheduleHours').value, 10);
    Store.settings.theme = document.getElementById('settingTheme').value;
    Store.settings.masteryEnabled = document.getElementById('settingMasteryEnabled').checked;
    Store.settings.masteryIgnoreUntracked = document.getElementById('settingMasteryIgnoreUntracked').checked;
    Store.settings.aiDefaultModel = aiDefaultModel;
    Store.settings.aiCustomModel = aiCustomModel.trim();
    Store.settings.aiAllowNewDestinations = aiAllowNewDestinations;
    Store.settings.aiCategories = aiCategories;
    setStoredOpenAiKey(openAiKey);
    Store.save();
    document.documentElement.setAttribute('data-theme', Store.settings.theme);
    onUpdate?.();
    alert('Settings Saved');
  };

  return (
    <>
      <div className="header-row">
        <h1 className="page-title">⚙️ Settings</h1>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">AI Intake</h3>
        <div className="settings-row settings-row-stacked">
          <label className="settings-label" htmlFor="settingOpenAiKey">OpenAI API key</label>
          <input
            type="password"
            className="settings-input settings-input-wide"
            id="settingOpenAiKey"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
        </div>
        <div className="settings-row settings-row-stacked">
          <label className="settings-label" htmlFor="settingAiModel">Default AI model</label>
          <select
            className="input-select settings-input-wide"
            id="settingAiModel"
            value={aiDefaultModel}
            onChange={(e) => setAiDefaultModel(e.target.value)}
          >
            {AI_MODEL_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}: {preset.model === 'custom' ? 'Custom model' : preset.model}
              </option>
            ))}
          </select>
        </div>
        {aiDefaultModel === 'custom' && (
          <div className="settings-row settings-row-stacked">
            <label className="settings-label" htmlFor="settingAiCustomModel">Custom model ID</label>
            <input
              type="text"
              className="settings-input settings-input-wide"
              id="settingAiCustomModel"
              value={aiCustomModel}
              onChange={(e) => setAiCustomModel(e.target.value)}
              placeholder="gpt-5.4-mini"
            />
          </div>
        )}
        <div className="settings-row">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={aiAllowNewDestinations}
              onChange={(e) => setAiAllowNewDestinations(e.target.checked)}
            />
            <span>Allow AI to suggest new folders, notebooks, and pages by default</span>
          </label>
        </div>
        <div className="settings-ai-categories" aria-label="Default AI categories">
          {[
            ['tasks', 'Tasks / projects'],
            ['events', 'Appointments / events'],
            ['jobs', 'Jobs'],
            ['pages', 'Notebooks / ideas']
          ].map(([key, label]) => (
            <label key={key} className="settings-checkbox-label">
              <input
                type="checkbox"
                checked={aiCategories[key]}
                onChange={(e) =>
                  setAiCategories((current) => ({ ...current, [key]: e.target.checked }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">📅 Schedule View</h3>
        <div className="settings-row">
          <label className="settings-label">Start hour (0-23):</label>
          <input
            type="number"
            className="settings-input"
            id="settingStartHour"
            min="0"
            max="23"
            defaultValue={Store.settings.startHour}
          />
        </div>
        <div className="settings-row">
          <label className="settings-label">End hour (0-23):</label>
          <input
            type="number"
            className="settings-input"
            id="settingEndHour"
            min="0"
            max="23"
            defaultValue={Store.settings.endHour}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">⚠️ Auto Reschedule</h3>
        <p className="settings-hint" style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Tasks with a due date <strong>before today</strong> (your local calendar) appear under Reschedule while still open.
          Tasks <strong>due today</strong> use this delay after the due time (or after the end of today if no time).
        </p>
        <div className="settings-row">
          <label className="settings-label">Extra hours (after due time / end of today):</label>
          <input
            type="number"
            className="settings-input"
            id="settingRescheduleHours"
            min="1"
            defaultValue={Store.settings.rescheduleHours}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">🎨 Theme</h3>
        <div className="settings-row">
          <label className="settings-label">Color theme:</label>
          <select className="input-select" id="settingTheme" defaultValue={Store.settings.theme}>
            <option value="dark">🌙 Dark</option>
            <option value="light">☀️ Light</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">🎯 Study & Mastery</h3>
        <p className="settings-hint" style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Track review progress for notes with spaced-repetition scheduling.
        </p>
        <div className="settings-row">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              id="settingMasteryEnabled"
              defaultChecked={Store.settings.masteryEnabled !== false}
            />
            <span>Enable mastery tracking</span>
          </label>
        </div>
        <div className="settings-row">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              id="settingMasteryIgnoreUntracked"
              defaultChecked={Store.settings.masteryIgnoreUntracked !== false}
            />
            <span>Only count pages I've started reviewing in scores</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">🏷️ Custom Properties</h3>
        <div className="settings-row">
          <label className="settings-label">Manage custom properties for tasks and projects</label>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowPropertySettings(true)}
          >
            Manage Properties
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">📥 Data Import</h3>
        <div className="settings-row">
          <label className="settings-label">Paste a project/task list and merge it into your current data</label>
          <button
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            Import
          </button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        💾 Save Settings
      </button>

      {showPropertySettings && (
        <PropertySettings onClose={() => setShowPropertySettings(false)} />
      )}

      {showImportModal && (
        <ImportTasksModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            onUpdate?.();
          }}
        />
      )}
    </>
  );
}

function ImportTasksModal({ onClose, onImported }) {
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const parsedImport = useMemo(() => parseImportedTaskText(importText), [importText]);
  const trimmedInput = importText.trim();
  const hasParseErrors = trimmedInput && parsedImport.errors.length > 0;
  const totalImportable =
    parsedImport.taskCount + parsedImport.notebookCount + parsedImport.pageCount;
  const canImport = trimmedInput && !hasParseErrors && totalImportable > 0;

  const handleImport = () => {
    if (!canImport) return;

    const summaryParts = [];
    if (parsedImport.taskCount > 0) {
      summaryParts.push(`${parsedImport.taskCount} tasks into ${parsedImport.projectCount} projects`);
    }
    if (parsedImport.notebookCount > 0) {
      summaryParts.push(`${parsedImport.notebookCount} notebooks with ${parsedImport.pageCount} pages`);
    }
    const ok = window.confirm(
      `Import ${summaryParts.join(' and ')}? Existing data will be kept.`
    );
    if (!ok) return;

    const result = mergeImportedTasks(Store, parsedImport);
    const messageParts = [];
    if (result.tasksAdded > 0) {
      messageParts.push(
        `${result.tasksAdded} tasks imported`,
        `${result.projectsCreated} projects created`,
        `${result.projectsReused} projects reused`
      );
    }
    if (result.notebooksCreated > 0) {
      messageParts.push(
        `${result.notebooksCreated} notebooks created`,
        `${result.pagesCreated} pages created`
      );
    }
    const message = messageParts.join('. ') + '.';
    setStatusMessage(message);
    window.alert(message);
    onImported?.();
  };

  return (
    <div
      className="modal-overlay visible"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Import tasks"
    >
      <div className="modal import-tasks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📥 Import Tasks & Notebooks</div>
          <button type="button" className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="import-intro">
            Paste markdown where Projects contain only actionable tasks and subtasks. Anything that is
            not a to-do, like notes, ideas, references, summaries, or study material, should go into
            regular Notebooks and Pages. The import will not delete existing data or link notebooks to
            School courses.
          </p>

          <label htmlFor="taskImportText">Import content</label>
          <textarea
            id="taskImportText"
            className="import-textarea"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setStatusMessage('');
            }}
            placeholder="Projects = tasks only. Notebooks = notes/ideas/references.&#10;&#10;# Project 1: Personal Tasks&#10;&#10;## Home / Admin&#10;- Sign up for summer classes&#10;  - Check prerequisites&#10;  - Email advisor&#10;&#10;# Notebook: Ideas and Notes&#10;&#10;## Page: Home Project Ideas&#10;Text:&#10;- Paint colors to compare&#10;- Storage ideas&#10;- Measurements and reference notes"
          />

          <div className={`import-preview ${hasParseErrors ? 'error' : ''}`} aria-live="polite">
            {!trimmedInput && 'Paste content to preview the import. Use Projects for tasks/subtasks only; use Notebooks for notes and ideas.'}
            {hasParseErrors && parsedImport.errors.join(' ')}
            {canImport && [
              parsedImport.projectCount > 0
                ? `${parsedImport.projectCount} projects and ${parsedImport.taskCount} tasks`
                : null,
              parsedImport.notebookCount > 0
                ? `${parsedImport.notebookCount} notebooks, ${parsedImport.pageCount} pages, and ${parsedImport.noteBlockCount} note blocks`
                : null
            ].filter(Boolean).join(' detected. ') + ' detected.'}
            {statusMessage && ` ${statusMessage}`}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!canImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
