import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import { getToday } from '../utils/store';
import '../styles/Input.css';
import '../styles/Button.css';
import '../styles/Recurrence.css';

export function TaskInput({ filter, projectId, onAdd }) {
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('low');
  const [pid, setPid] = useState(projectId || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [selectedDays, setSelectedDays] = useState([]);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [subfolder, setSubfolder] = useState('');

  useEffect(() => {
    if (filter === 'today') {
      setDate(getToday());
    } else if (!date) {
      setDate('');
    }
  }, [filter]);

  useEffect(() => {
    if (projectId) setPid(projectId);
  }, [projectId]);

  const projectSubfolders = pid
    ? Array.from(
      new Set(
        Store.items
          .filter(i => i.pid === pid && i.subfolder)
          .map(i => i.subfolder.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
    : [];

  const handleAdd = () => {
    if (!text.trim()) return;

    const finalDate = filter === 'today' ? getToday() : date || null;
    let recurDetails = null;

    if (recurrence === 'weekly') {
      recurDetails = { days: selectedDays };
    } else if (recurrence === 'monthly') {
      recurDetails = { dayOfMonth: Math.max(1, Math.min(31, monthlyDay)) };
    }

    const newItem = {
      id: Date.now(),
      text: text.trim(),
      type,
      priority,
      pid: pid || null,
      subfolder: pid ? (subfolder.trim() || null) : null,
      date: finalDate,
      time: time || null,
      recurrence,
      recurDetails,
      done: false,
      archived: false,
      reschedule: false,
      createdAt: Date.now(),
      subtasks: []
    };

    Store.items.push(newItem);
    Store.save();

    setText('');
    setType('task');
    setPriority('low');
    setPid(projectId || '');
    setDate(filter === 'today' ? getToday() : '');
    setTime('');
    setRecurrence('none');
    setSelectedDays([]);
    setMonthlyDay(1);
    setSubfolder('');

    onAdd?.();
  };

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="input-row">
      <span style={{ color: 'var(--text-sub)' }}>+</span>
      <input
        type="text"
        className="task-input"
        placeholder="Add a new task or event..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <div className="input-controls">
        <select className="input-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="task">📋 Task</option>
          <option value="event">📅 Event</option>
        </select>

        <select className="input-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">🟢 Low</option>
          <option value="medium">🟡 Medium</option>
          <option value="high">🔴 High</option>
        </select>

        <select className="input-select" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">📁 No Project</option>
          {Store.projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        {pid && (
          <>
            <input
              type="text"
              className="input-select"
              list="taskSubfolderOptions"
              placeholder="📂 Subfolder (optional)"
              value={subfolder}
              onChange={(e) => setSubfolder(e.target.value)}
            />
            <datalist id="taskSubfolderOptions">
              {projectSubfolders.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="input-select"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
          >
            <option value="none">🔁 No Repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          {recurrence === 'weekly' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2, 3, 4, 5, 6].map(day => (
                <span
                  key={day}
                  className={`day-check ${selectedDays.includes(day) ? 'selected' : ''}`}
                  onClick={() => toggleDay(day)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem' }}>Day:</span>
              <input
                type="number"
                min="1"
                max="31"
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(parseInt(e.target.value) || 1)}
                className="input-select"
                style={{ width: '50px' }}
              />
            </div>
          )}
        </div>

        <input
          type="time"
          className="input-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <input
          type="date"
          className="input-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={filter === 'today'}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
}
