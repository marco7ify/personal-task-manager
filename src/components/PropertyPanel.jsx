import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import { 
  getPropertiesForEntity, 
  getPropertyValue, 
  setPropertyValue,
  PROPERTY_TYPES,
  ENTITY_TYPES 
} from '../utils/properties';
import { PropertyText } from './properties/PropertyText';
import { PropertyNumber } from './properties/PropertyNumber';
import { PropertyDate } from './properties/PropertyDate';
import { PropertyTime } from './properties/PropertyTime';
import { PropertySelect } from './properties/PropertySelect';
import { PropertyMultiSelect } from './properties/PropertyMultiSelect';
import { PropertyURL } from './properties/PropertyURL';
import { PropertyAI } from './properties/PropertyAI';
import '../styles/Properties.css';

const ACADEMIC_KEYS = {
  SEMESTER: 'academic_semester',
  CLASS: 'academic_class',
  COURSE: 'academic_course',
  MONTH: 'academic_month'
};

export function PropertyPanel({ itemId, onClose, onSave }) {
  const [item, setItem] = useState(null);
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('low');
  const [pid, setPid] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [subfolder, setSubfolder] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [customProps, setCustomProps] = useState({});
  const [academicCatalog, setAcademicCatalog] = useState([]);
  const [newSemester, setNewSemester] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [activeTab, setActiveTab] = useState('properties');

  useEffect(() => {
    if (!itemId) return;
    const foundItem = Store.items.find(
      (i) => i.id === itemId || String(i.id) === String(itemId)
    );
    if (!foundItem) return;

    setItem(foundItem);
    setText(foundItem.text || '');
    setType(foundItem.type || 'task');
    setPriority(foundItem.priority || 'low');
    setPid(foundItem.pid || '');
    setDate(foundItem.date || '');
    setTime(foundItem.time || '');
    setRecurrence(foundItem.recurrence || 'none');
    setSubfolder(foundItem.subfolder || '');
    setSubtasks(Array.isArray(foundItem.subtasks) ? foundItem.subtasks : []);
    setNewSubtask('');
    setCustomProps(foundItem.customProps || {});
    setAcademicCatalog(Array.isArray(Store.settings.academicCatalog) ? Store.settings.academicCatalog : []);
  }, [itemId]);

  const handleSave = () => {
    if (!item || !text.trim()) return;

    item.text = text.trim();
    item.type = type;
    item.priority = priority;
    item.pid = pid || null;
    item.subfolder = pid ? (subfolder.trim() || null) : null;
    item.subtasks = subtasks
      .map((st) => ({ ...st, text: (st.text || '').trim(), done: !!st.done }))
      .filter((st) => st.text.length > 0);
    item.date = date || null;
    item.time = time || null;
    item.recurrence = recurrence;
    item.customProps = customProps;
    Store.settings.academicCatalog = academicCatalog;

    Store.save();
    onSave?.();
    onClose();
  };

  const handleCustomPropChange = (propertyId, value) => {
    setCustomProps(prev => ({
      ...prev,
      [propertyId]: value
    }));
  };

  const semesterValue = customProps[ACADEMIC_KEYS.SEMESTER] || '';
  const classValue = customProps[ACADEMIC_KEYS.CLASS] || '';
  const courseValue = customProps[ACADEMIC_KEYS.COURSE] || '';
  const monthValue = customProps[ACADEMIC_KEYS.MONTH] || '';

  const selectedSemester = academicCatalog.find((s) => s.name === semesterValue) || null;
  const classOptions = selectedSemester?.classes || [];
  const selectedClass = classOptions.find((c) => c.name === classValue) || null;
  const courseOptions = selectedClass?.courses || [];

  const setAcademicPath = ({ semester, className, course, month }) => {
    setCustomProps((prev) => ({
      ...prev,
      [ACADEMIC_KEYS.SEMESTER]: semester,
      [ACADEMIC_KEYS.CLASS]: className,
      [ACADEMIC_KEYS.COURSE]: course,
      [ACADEMIC_KEYS.MONTH]: month
    }));
  };

  const addSemesterOption = () => {
    const value = newSemester.trim();
    if (!value) return;
    if (academicCatalog.some((s) => s.name.toLowerCase() === value.toLowerCase())) return;
    const next = [...academicCatalog, { id: `sem_${Date.now()}`, name: value, classes: [] }];
    setAcademicCatalog(next);
    setAcademicPath({ semester: value, className: '', course: '', month: '' });
    setNewSemester('');
  };

  const addClassOption = () => {
    const value = newClassName.trim();
    if (!value || !selectedSemester) return;
    if (classOptions.some((c) => c.name.toLowerCase() === value.toLowerCase())) return;
    const next = academicCatalog.map((sem) =>
      sem.name === selectedSemester.name
        ? { ...sem, classes: [...(sem.classes || []), { id: `cls_${Date.now()}`, name: value, courses: [] }] }
        : sem
    );
    setAcademicCatalog(next);
    setAcademicPath({ semester: selectedSemester.name, className: value, course: '', month: '' });
    setNewClassName('');
  };

  const addCourseOption = () => {
    const value = newCourseName.trim();
    if (!value || !selectedSemester || !selectedClass) return;
    if (courseOptions.some((c) => c.name.toLowerCase() === value.toLowerCase())) return;
    const next = academicCatalog.map((sem) => {
      if (sem.name !== selectedSemester.name) return sem;
      return {
        ...sem,
        classes: (sem.classes || []).map((cls) =>
          cls.name === selectedClass.name
            ? { ...cls, courses: [...(cls.courses || []), { id: `crs_${Date.now()}`, name: value }] }
            : cls
        )
      };
    });
    setAcademicCatalog(next);
    setAcademicPath({
      semester: selectedSemester.name,
      className: selectedClass.name,
      course: value,
      month: monthValue || ''
    });
    setNewCourseName('');
  };

  const handleDelete = () => {
    if (confirm('Delete this item?')) {
      Store.items = Store.items.filter(
        (i) => i.id !== itemId && String(i.id) !== String(itemId)
      );
      Store.save();
      onSave?.();
      onClose();
    }
  };

  const projectSubfolders = pid
    ? Array.from(
      new Set(
        Store.items
          .filter((i) => i.pid === pid && i.subfolder)
          .map((i) => i.subfolder.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
    : [];

  const addSubtask = () => {
    const value = newSubtask.trim();
    if (!value) return;
    setSubtasks((prev) => [...prev, { text: value, done: false }]);
    setNewSubtask('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  const taskProperties = getPropertiesForEntity(ENTITY_TYPES.TASK);

  const renderPropertyEditor = (propertyDef) => {
    const value = customProps[propertyDef.id];

    switch (propertyDef.type) {
      case PROPERTY_TYPES.TEXT:
        return (
          <PropertyText
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder={`Enter ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.NUMBER:
        return (
          <PropertyNumber
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder={`Enter ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.DATE:
        return (
          <PropertyDate
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
          />
        );

      case PROPERTY_TYPES.TIME:
        return (
          <PropertyTime
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
          />
        );

      case PROPERTY_TYPES.SELECT:
        return (
          <PropertySelect
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            options={propertyDef.options || []}
            placeholder={`Select ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.MULTI_SELECT:
        return (
          <PropertyMultiSelect
            value={value || []}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            options={propertyDef.options || []}
            placeholder={`Select ${propertyDef.name.toLowerCase()}...`}
          />
        );

      case PROPERTY_TYPES.URL:
        return (
          <PropertyURL
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            placeholder="https://..."
          />
        );

      case PROPERTY_TYPES.AI:
        return (
          <PropertyAI
            value={value}
            onChange={(v) => handleCustomPropChange(propertyDef.id, v)}
            prompt={propertyDef.aiPrompt}
            context={{ text, date, priority }}
          />
        );

      default:
        return null;
    }
  };

  if (!item) return null;

  return (
    <div 
      className="property-panel-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Edit task properties"
    >
      <div className="property-panel" onClick={(e) => e.stopPropagation()}>
        <div className="property-panel-header">
          <div className="property-panel-tabs">
            <button 
              className={`property-panel-tab ${activeTab === 'properties' ? 'active' : ''}`}
              onClick={() => setActiveTab('properties')}
            >
              Properties
            </button>
            <button 
              className={`property-panel-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
          <button className="property-panel-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>

        {activeTab === 'properties' && (
          <div className="property-panel-content">
            {/* Title */}
            <div className="property-panel-title-row">
              <textarea
                className="property-panel-title"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Task name..."
                rows={1}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
            </div>

            {/* Standard Properties */}
            <div className="property-panel-section">
              <div className="property-panel-section-title">Standard Properties</div>
              
              <div className="property-row">
                <label className="property-label">Type</label>
                <select 
                  className="property-select-native"
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="task">📋 Task</option>
                  <option value="event">📅 Event</option>
                </select>
              </div>

              <div className="property-row">
                <label className="property-label">Priority</label>
                <select 
                  className="property-select-native"
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>

              <div className="property-row">
                <label className="property-label">Project</label>
                <select 
                  className="property-select-native"
                  value={pid} 
                  onChange={(e) => setPid(e.target.value)}
                >
                  <option value="">📁 No Project</option>
                  {Store.projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {pid && (
                <div className="property-row">
                  <label className="property-label">Subfolder</label>
                  <input
                    className="property-text"
                    list={`propertySubfolderOptions-${itemId}`}
                    value={subfolder}
                    onChange={(e) => setSubfolder(e.target.value)}
                    placeholder="Optional subfolder"
                  />
                  <datalist id={`propertySubfolderOptions-${itemId}`}>
                    {projectSubfolders.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              )}

              <div className="property-row">
                <label className="property-label">Date</label>
                <PropertyDate
                  value={date}
                  onChange={setDate}
                />
              </div>

              <div className="property-row">
                <label className="property-label">Time</label>
                <PropertyTime
                  value={time}
                  onChange={setTime}
                />
              </div>

              <div className="property-row">
                <label className="property-label">Repeat</label>
                <select 
                  className="property-select-native"
                  value={recurrence} 
                  onChange={(e) => setRecurrence(e.target.value)}
                >
                  <option value="none">🔁 No Repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="property-panel-section">
              <div className="property-panel-section-title">Subtasks</div>
              {subtasks.length === 0 && (
                <p className="property-panel-hint">No subtasks yet.</p>
              )}
              {subtasks.map((subtask, idx) => (
                <div key={`subtask-${idx}`} className="property-subtask-row">
                  <input
                    type="checkbox"
                    checked={!!subtask.done}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSubtasks((prev) => prev.map((st, i) => (
                        i === idx ? { ...st, done: checked } : st
                      )));
                    }}
                  />
                  <input
                    className="property-text"
                    value={subtask.text || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSubtasks((prev) => prev.map((st, i) => (
                        i === idx ? { ...st, text: value } : st
                      )));
                    }}
                    placeholder="Subtask"
                  />
                  <button
                    className="property-subtask-delete"
                    type="button"
                    onClick={() => {
                      setSubtasks((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    title="Delete subtask"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="property-subtask-add">
                <input
                  className="property-text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Add a subtask..."
                />
                <button className="btn btn-secondary" type="button" onClick={addSubtask}>
                  Add
                </button>
              </div>
            </div>

            <div className="property-panel-section">
              <div className="property-panel-section-title">Academic Link</div>

              <div className="property-row">
                <label className="property-label">Semester type</label>
                <select
                  className="property-select-native"
                  value={semesterValue}
                  onChange={(e) =>
                    setAcademicPath({ semester: e.target.value, className: '', course: '', month: '' })
                  }
                >
                  <option value="">Select semester...</option>
                  {academicCatalog.map((sem) => (
                    <option key={sem.id || sem.name} value={sem.name}>
                      {sem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-inline-create">
                <input
                  className="property-text"
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value)}
                  placeholder="Add semester type (e.g. Fall 2026)"
                />
                <button className="btn btn-secondary" type="button" onClick={addSemesterOption}>
                  Add
                </button>
              </div>

              <div className="property-row">
                <label className="property-label">Class</label>
                <select
                  className="property-select-native"
                  value={classValue}
                  disabled={!selectedSemester}
                  onChange={(e) =>
                    setAcademicPath({
                      semester: semesterValue,
                      className: e.target.value,
                      course: '',
                      month: ''
                    })
                  }
                >
                  <option value="">
                    {selectedSemester ? 'Select class...' : 'Pick semester first'}
                  </option>
                  {classOptions.map((cls) => (
                    <option key={cls.id || cls.name} value={cls.name}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-inline-create">
                <input
                  className="property-text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder={selectedSemester ? 'Add class' : 'Pick semester first'}
                  disabled={!selectedSemester}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={addClassOption}
                  disabled={!selectedSemester}
                >
                  Add
                </button>
              </div>

              <div className="property-row">
                <label className="property-label">Course</label>
                <select
                  className="property-select-native"
                  value={courseValue}
                  disabled={!selectedClass}
                  onChange={(e) =>
                    setAcademicPath({
                      semester: semesterValue,
                      className: classValue,
                      course: e.target.value,
                      month: monthValue || ''
                    })
                  }
                >
                  <option value="">
                    {selectedClass ? 'Select course...' : 'Pick class first'}
                  </option>
                  {courseOptions.map((course) => (
                    <option key={course.id || course.name} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-inline-create">
                <input
                  className="property-text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder={selectedClass ? 'Add course' : 'Pick class first'}
                  disabled={!selectedClass}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={addCourseOption}
                  disabled={!selectedClass}
                >
                  Add
                </button>
              </div>

              <div className="property-row">
                <label className="property-label">Monthly calendar</label>
                <input
                  type="month"
                  className="property-date"
                  value={monthValue}
                  disabled={!courseValue}
                  onChange={(e) =>
                    setAcademicPath({
                      semester: semesterValue,
                      className: classValue,
                      course: courseValue,
                      month: e.target.value
                    })
                  }
                />
              </div>
            </div>

            {/* Custom Properties */}
            {taskProperties.length > 0 && (
              <div className="property-panel-section">
                <div className="property-panel-section-title">Custom Properties</div>
                {taskProperties.map(prop => (
                  <div key={prop.id} className="property-row">
                    <label className="property-label">{prop.name}</label>
                    {renderPropertyEditor(prop)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="property-panel-content">
            <div className="property-panel-section">
              <div className="property-panel-section-title">Item Settings</div>
              <p className="property-panel-hint">
                Manage custom properties in Settings → Manage Properties
              </p>
            </div>
          </div>
        )}

        <div className="property-panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
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
