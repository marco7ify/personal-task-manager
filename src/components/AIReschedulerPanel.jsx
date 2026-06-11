import { useState } from 'react';
import {
  RESCHEDULE_ACTION_LABELS,
  applyRescheduleSuggestion,
  suggestRescheduleWithAi
} from '../utils/aiPlanner';

const ACTIONS = Object.entries(RESCHEDULE_ACTION_LABELS);

export function AIReschedulerPanel({ items, onUpdate, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  const itemById = new Map((items || []).map((item) => [String(item.id), item]));
  const selectedSuggestions = suggestions.filter((suggestion) => selectedIds.has(suggestion.id));

  const handleSuggest = async () => {
    setError('');
    setMessage('');
    setWarnings([]);
    if (!items || items.length === 0) {
      setError('No review items available for AI rescheduling.');
      return;
    }

    setLoading(true);
    try {
      const result = await suggestRescheduleWithAi({ items });
      setSuggestions(result.suggestions);
      setSelectedIds(new Set(result.suggestions.map((suggestion) => suggestion.id)));
      setWarnings(result.warnings);
      setMessage(result.summary || `${result.suggestions.length} reschedule suggestion(s) ready.`);
    } catch (err) {
      setError(err?.message || 'AI rescheduler failed.');
    } finally {
      setLoading(false);
    }
  };

  const updateSuggestion = (id, patch) => {
    setSuggestions((current) =>
      current.map((suggestion) => (suggestion.id === id ? { ...suggestion, ...patch } : suggestion))
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

  const applyList = (list) => {
    let applied = 0;
    const appliedIds = new Set();
    for (const suggestion of list) {
      if (applyRescheduleSuggestion(suggestion)) {
        applied += 1;
        appliedIds.add(suggestion.id);
      }
    }

    setSuggestions((current) => current.filter((suggestion) => !appliedIds.has(suggestion.id)));
    setSelectedIds((current) => {
      const next = new Set(current);
      appliedIds.forEach((id) => next.delete(id));
      return next;
    });
    setMessage(`${applied} suggestion(s) applied.`);
    setError('');
    onUpdate?.();
  };

  return (
    <section className={`ai-rescheduler ${compact ? 'compact' : ''}`}>
      <div className="ai-rescheduler-header">
        <div>
          <h2>AI Rescheduler</h2>
          <p>Suggests what to move, split, archive, or keep in Inbox.</p>
        </div>
        <div className="ai-rescheduler-actions">
          <button type="button" onClick={handleSuggest} disabled={loading || !items?.length}>
            {loading ? 'Thinking...' : 'Suggest Reschedule'}
          </button>
          <button type="button" onClick={() => applyList(selectedSuggestions)} disabled={selectedSuggestions.length === 0}>
            Apply Selected
          </button>
        </div>
      </div>

      {(message || error || warnings.length > 0) && (
        <div className="ai-rescheduler-status">
          {message && <span className="success">{message}</span>}
          {error && <span className="error">{error}</span>}
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="ai-rescheduler-list">
          {suggestions.map((suggestion) => {
            const item = itemById.get(String(suggestion.itemId));
            return (
              <article key={suggestion.id} className="ai-reschedule-card">
                <label className="ai-reschedule-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(suggestion.id)}
                    onChange={() => toggleSelected(suggestion.id)}
                  />
                </label>
                <div className="ai-reschedule-main">
                  <div className="ai-reschedule-title">Task: {item?.text || 'Unknown item'}</div>
                  <div className="ai-reschedule-grid">
                    <label>
                      <span>AI suggestion</span>
                      <select
                        value={suggestion.action}
                        onChange={(e) => updateSuggestion(suggestion.id, { action: e.target.value })}
                      >
                        {ACTIONS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Date</span>
                      <input
                        type="date"
                        value={suggestion.date || ''}
                        onChange={(e) => updateSuggestion(suggestion.id, { date: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Time</span>
                      <input
                        type="time"
                        value={suggestion.time || ''}
                        onChange={(e) => updateSuggestion(suggestion.id, { time: e.target.value })}
                      />
                    </label>
                  </div>
                  {suggestion.action === 'split_subtasks' && (
                    <label className="ai-reschedule-subtasks">
                      <span>Subtasks</span>
                      <textarea
                        rows={3}
                        value={(suggestion.subtasks || []).join('\n')}
                        onChange={(e) =>
                          updateSuggestion(suggestion.id, {
                            subtasks: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean)
                          })
                        }
                      />
                    </label>
                  )}
                  <p>Reason: {suggestion.reason || 'No reason provided.'}</p>
                </div>
                <div className="ai-reschedule-buttons">
                  <button type="button" onClick={() => applyList([suggestion])}>Apply</button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSuggestion(suggestion.id, {
                        action: 'keep_inbox',
                        date: '',
                        time: ''
                      })
                    }
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestions((current) => current.filter((item) => item.id !== suggestion.id))}
                  >
                    Ignore
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
