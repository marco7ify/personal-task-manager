import { Store } from '../../utils/store';
import { UnscheduledBacklogRulesHint } from '../InboxRulesHint';
import '../../styles/Schedule.css';
import '../../styles/Board.css';
import '../../styles/Task.css';

export function ScheduleView({
  items,
  onToggle,
  onDragStart,
  onDrop,
  includeInboxBacklog = false,
  backlogProjectId = null,
  viewExcludedProjectIds = [],
  onDropUnschedule,
  onOpenTask
}) {
  const start = Store.settings.startHour;
  const end = Store.settings.endHour;

  const createScheduleSlot = (item) => {
    const proj = item.pid ? Store.projects.find(p => p.id === item.pid) : null;
    const bg = proj ? `rgba(${hexToRgba(proj.color)}, 0.2)` : 'var(--bg-hover)';
    const eventClass = item.type === 'event' ? 'type-event' : 'type-task';
    const isVirtual = !!item.__virtual;
    const checkbox = item.type === 'task' ? (
      <div
        className={`task-checkbox ${item.done ? 'done' : ''}`}
        style={{ width: '14px', height: '14px', marginRight: '6px', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id, isVirtual ? item.__baseId : null, isVirtual ? item.date : null);
        }}
      >
        {item.done ? '✓' : ''}
      </div>
    ) : null;
    const projIcon = proj ? proj.icon : '';

    return (
      <div
        key={item.id}
        className={`schedule-item ${eventClass} ${item.done ? 'done' : ''}`}
        style={{ background: bg }}
        data-id={item.id}
        draggable={!isVirtual}
        onDragStart={isVirtual ? undefined : (e) => onDragStart(e, item.id)}
        onClick={() => onOpenTask?.(item)}
        role={onOpenTask ? 'button' : undefined}
        tabIndex={onOpenTask ? 0 : undefined}
      >
        {checkbox} {projIcon} {item.text}{' '}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>{item.time || ''}</span>
      </div>
    );
  };

  const allDay = items.filter(item => !item.time);

  const excludeSet = new Set(viewExcludedProjectIds || []);
  const passesVisible = (i) =>
    !excludeSet.size || !i.pid || !excludeSet.has(i.pid);

  const backlog = includeInboxBacklog
    ? Store.items.filter((i) => {
        if (i.date || i.done || i.archived) return false;
        if (!passesVisible(i)) return false;
        if (backlogProjectId != null) return i.pid === backlogProjectId;
        return true;
      })
    : [];

  return (
    <div className="schedule-grid">
      {includeInboxBacklog && (
        <>
          <div className="time-label" title="No date yet">
            Inbox
          </div>
          <div
            className="time-slot schedule-inbox-strip board-backlog-drop-zone"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
            onDrop={(e) => {
              e.currentTarget.classList.remove('drag-over');
              onDropUnschedule?.(e);
            }}
          >
            {backlog.length > 0 ? (
              backlog.map((i) => {
                const proj = i.pid ? Store.projects.find(p => p.id === i.pid) : null;
                return (
                  <div
                    key={i.id}
                    className="board-backlog-card"
                    style={{ maxWidth: '260px' }}
                    draggable
                    onDragStart={(e) => onDragStart(e, i.id)}
                    onClick={() => onOpenTask?.(i)}
                    title={proj ? proj.name : 'No folder'}
                  >
                    <span style={{ opacity: 0.85 }}>{proj ? proj.icon : '📥'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.text}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="board-backlog-empty" style={{ width: '100%', textAlign: 'left', padding: '8px 0' }}>
                Drop here for unscheduled inbox (no date)
              </div>
            )}
          </div>
          <div className="schedule-inbox-rules-wrap" style={{ gridColumn: '1 / -1' }}>
            <UnscheduledBacklogRulesHint />
          </div>
        </>
      )}

      <div className="time-label">All Day</div>
      <div
        className="time-slot"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          onDrop(e, '');
        }}
      >
        {allDay.map(createScheduleSlot)}
      </div>

      {Array.from({ length: end - start + 1 }, (_, i) => {
        const h = start + i;
        const hour = String(h).padStart(2, '0');
        const slot00 = items.filter(
          item => item.time && (item.time === `${hour}:00` || (item.time.startsWith(`${hour}:`) && item.time < `${hour}:30`))
        );
        const slot30 = items.filter(
          item => item.time && (item.time === `${hour}:30` || (item.time >= `${hour}:30` && item.time < `${String(h + 1).padStart(2, '0')}:00`))
        );

        return (
          <div key={h}>
            <div className="time-label">{hour}:00</div>
            <div
              className="time-slot time-slot-drop"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                onDrop(e, `${hour}:00`);
              }}
            >
              {slot00.map(createScheduleSlot)}
            </div>
            <div className="time-label" style={{ fontSize: '0.65rem', color: '#777' }}>
              {hour}:30
            </div>
            <div
              className="time-slot time-slot-drop"
              style={{ borderTop: '1px dotted var(--border)' }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                onDrop(e, `${hour}:30`);
              }}
            >
              {slot30.map(createScheduleSlot)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function hexToRgba(hex) {
  if (!hex) return '50,50,50';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
