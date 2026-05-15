import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import { getRecurrenceDetails } from '../utils/recurrence';
import '../styles/Modal.css';
import '../styles/Recurrence.css';
import '../styles/Button.css';
import '../styles/Input.css';

export function EditModal({ itemId, onClose, onSave, onDelete }) {
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('low');
  const [pid, setPid] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [selectedDays, setSelectedDays] = useState([]);
  const [monthlyDay, setMonthlyDay] = useState(1);

  useEffect(() => {
    if (!itemId) return;
    const item = Store.items.find(i => i.id === itemId);
    if (!item) return;

    setText(item.text || '');
    setType(item.type || 'task');
    setPriority(item.priority || 'low');
    setPid(item.pid || '');
    setDate(item.date || '');
    setTime(item.time || '');
    setRecurrence(item.recurrence || 'none');

    if (item.recurrence === 'weekly' && item.recurDetails?.days) {
      setSelectedDays(item.recurDetails.days);
    }
    if (item.recurrence === 'monthly' && item.recurDetails?.dayOfMonth) {
      setMonthlyDay(item.recurDetails.dayOfMonth);
    }
  }, [itemId]);

  const handleSave = () => {
    if (!text.trim()) return;

    const item = Store.items.find(i => i.id === itemId);
    if (!item) return;

    item.text = text.trim();
    item.type = type;
    item.priority = priority;
    item.pid = pid || null;
    item.date = date || null;
    item.time = time || null;
    item.recurrence = recurrence;

    if (recurrence === 'weekly' || recurrence === 'monthly') {
      const weeklyContainer = document.getElementById('editRecurWeekly');
      const monthlyDayInput = document.getElementById('editRecurMonthlyDay');
      item.recurDetails = getRecurrenceDetails(recurrence, weeklyContainer, monthlyDayInput);
    } else {
      item.recurDetails = null;
    }

    Store.save();
    onSave?.();
    onClose();
  };

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (!itemId) return null;

  return (
    <div
      className="modal-overlay visible"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit item"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✏️ Edit Item</div>
          <button className="btn-icon" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-grid">
          <div className="full">
            <label>Text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="task">📋 Task</option>
              <option value="event">📅 Event</option>
            </select>
          </div>

          <div>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
            </select>
          </div>

          <div>
            <label>Project</label>
            <select value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">📁 No Project</option>
              {Store.projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label>Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>

          <div>
            <label>Repeat</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="none">🔁 No Repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="full">
            {recurrence === 'weekly' && (
              <div id="editRecurWeekly" style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <span
                    key={day}
                    className={`day-check ${selectedDays.includes(day) ? 'selected' : ''}`}
                    onClick={() => toggleDay(day)}
                    data-day={day}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: selectedDays.includes(day) ? 'var(--accent)' : 'transparent',
                      color: selectedDays.includes(day) ? 'white' : 'var(--text-sub)'
                    }}
                  >
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][day]}
                  </span>
                ))}
              </div>
            )}
            {recurrence === 'monthly' && (
              <div id="editRecurMonthly" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Day:</span>
                <input
                  type="number"
                  id="editRecurMonthlyDay"
                  min="1"
                  max="31"
                  value={monthlyDay}
                  onChange={(e) => setMonthlyDay(parseInt(e.target.value) || 1)}
                  className="input-select"
                  style={{ width: '60px' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={() => { onDelete?.(); onClose(); }}>
            Delete
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
