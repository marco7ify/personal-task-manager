import { Store, getToday, formatLocalYMD } from '../../utils/store';
import { UnscheduledBacklogRulesHint } from '../InboxRulesHint';
import '../../styles/Board.css';
import '../../styles/Task.css';

export function BoardView({
  items,
  includeInboxBacklog = false,
  /** When set, backlog = items in this project with no date; global backlog = any item with no date */
  backlogProjectId = null,
  /** Omit tasks from hidden folders in global backlog strip */
  viewExcludedProjectIds = [],
  onDragStart,
  onDrop,
  onDropUnschedule,
  onToggle,
  onOpenTask
}) {
  // "Next 7 Days" board: columns run from today forward, matching the week filter.
  const now = new Date();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const createBoardCard = (item) => {
    const proj = item.pid ? Store.projects.find(p => p.id === item.pid) : null;
    const eventClass = item.type === 'event' ? 'type-event' : 'type-task';
    const isVirtual = !!item.__virtual;
    const check = item.type === 'task' && onToggle ? (
      <div
        className={`task-checkbox ${item.done ? 'done' : ''}`}
        style={{ width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id, isVirtual ? item.__baseId : null, isVirtual ? item.date : null);
        }}
      >
        {item.done ? '✓' : ''}
      </div>
    ) : null;
    const projIcon = proj ? proj.icon : '';
    const time = item.time ? <span className="board-time">🕐 {item.time}</span> : null;

    return (
      <div
        key={item.id}
        className={`board-card ${eventClass} ${item.done ? 'done' : ''}`}
        data-id={item.id}
        draggable={!isVirtual}
        onDragStart={isVirtual ? undefined : (e) => onDragStart(e, item.id)}
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
        <div className="board-card-top">
          {check}
          <span className="board-card-title" title={item.text}>
            {projIcon && <span className="board-card-icon">{projIcon} </span>}
            {item.text}
          </span>
        </div>
        {time}
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
      <div className="board-container">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          const dStr = formatLocalYMD(d);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const colItems = items.filter(item => item.date === dStr && !item.done && !item.archived);
          const isToday = dStr === getToday();

          return (
            <div
              key={dStr}
              className="board-column"
              style={isToday ? { border: '1px solid var(--accent)' } : {}}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                onDrop(e, dStr);
              }}
            >
              <div className="board-header">
                <div>{dayName}</div>
                <div style={{ fontWeight: 'normal' }}>{d.getDate()}</div>
              </div>
              {colItems.map(createBoardCard)}
            </div>
          );
        })}
      </div>

      {includeInboxBacklog && (
        <div className="board-backlog">
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
