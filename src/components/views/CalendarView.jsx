import { Store, getToday } from '../../utils/store';
import { UnscheduledBacklogRulesHint } from '../InboxRulesHint';
import '../../styles/Calendar.css';
import '../../styles/Board.css';
import '../../styles/Task.css';

export function CalendarView({
  items,
  onToggle,
  onDragStart,
  onDrop,
  onOpenTask,
  includeInboxBacklog = false,
  backlogProjectId = null,
  viewExcludedProjectIds = [],
  onDropUnschedule
}) {
  const todayStr = getToday();
  const [y, m] = todayStr.split('-');
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m - 1, 1).getDay();

  const createCalendarItem = (item) => {
    const p = Store.projects.find(x => x.id === item.pid);
    const cls = item.type === 'event' ? 'type-event' : 'type-task';
    const time = item.time ? `🕐 ${item.time} ` : '';
    const projIcon = p ? p.icon + ' ' : '';
    const isVirtual = !!item.__virtual;

    const check = item.type === 'task' ? (
      <span
        className="cal-check"
        data-id={item.id}
        data-virtual={isVirtual ? '1' : undefined}
        data-base={isVirtual ? item.__baseId : undefined}
        data-date={isVirtual ? item.date : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id, isVirtual ? item.__baseId : null, isVirtual ? item.date : null);
        }}
      />
    ) : null;

    const dragAttrs = isVirtual
      ? {}
      : {
          draggable: true,
          onDragStart: (e) => onDragStart(e, item.id)
        };

    return (
      <div
        key={item.id}
        className={`calendar-item ${cls}`}
        data-id={item.id}
        {...dragAttrs}
        onClick={() => onOpenTask?.(item)}
        style={{ cursor: onOpenTask ? 'pointer' : undefined }}
        role={onOpenTask ? 'button' : undefined}
        tabIndex={onOpenTask ? 0 : undefined}
        onKeyDown={
          onOpenTask
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenTask(item);
                }
              }
            : undefined
        }
      >
        {check}
        <span className="cal-text">
          {time}
          {projIcon}
          {item.text}
        </span>
      </div>
    );
  };

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
    <>
    <div className="calendar-grid">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
        <div key={d} className="calendar-header-cell">
          {d}
        </div>
      ))}

      {Array.from({ length: firstDay }, (_, i) => (
        <div key={`empty-${i}`} className="calendar-cell" style={{ background: 'var(--bg-sidebar)' }} />
      ))}

      {Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${m}-${String(d).padStart(2, '0')}`;
        const dayItems = items.filter(item => item.date === dateStr && !item.done && !item.archived);

        return (
          <div
            key={dateStr}
            className={`calendar-cell ${dateStr === todayStr ? 'today' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              onDrop(e, dateStr);
            }}
          >
            <div className="calendar-date">{d}</div>
            {dayItems.map(createCalendarItem)}
          </div>
        );
      })}
    </div>

    {includeInboxBacklog && (
      <div className="board-backlog calendar-backlog-wrap">
        <div className="board-backlog-title">
          <span>📥 Unscheduled inbox</span>
          <span style={{ color: 'var(--text-sub)', fontWeight: 'normal' }}>({backlog.length})</span>
        </div>
        <UnscheduledBacklogRulesHint />
        <div
          className="board-backlog-grid board-backlog-drop-zone"
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
          {backlog.length ? (
            backlog.map((i) => {
              const proj = i.pid ? Store.projects.find(p => p.id === i.pid) : null;
              return (
                <div
                  key={i.id}
                  className="board-backlog-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, i.id)}
                  onClick={() => onOpenTask?.(i)}
                  style={{ cursor: onOpenTask ? 'pointer' : undefined }}
                  data-id={i.id}
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
            <div className="board-backlog-empty">Drop here to send to unscheduled inbox</div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
