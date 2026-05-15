import '../styles/InboxRules.css';

/** Rules for the sidebar Inbox filter (strict capture list) */
export function SidebarInboxRulesHint() {
  return (
    <div className="inbox-rules-panel inbox-rules-sidebar">
      <div className="inbox-rules-title">📥 Inbox rules</div>
      <ul className="inbox-rules-list">
        <li>
          <strong>Stays here:</strong> No <em>folder/project</em>, no <em>due date</em>, not done, not archived.
        </li>
        <li>
          <strong>Leaves:</strong> Assign a folder, set a date, mark done, or archive.
        </li>
      </ul>
    </div>
  );
}

/** Rules for unscheduled backlog strips (week / month / today) */
export function UnscheduledBacklogRulesHint() {
  return (
    <div className="inbox-rules-panel inbox-rules-strip">
      <div className="inbox-rules-title">Unscheduled backlog</div>
      <ul className="inbox-rules-list">
        <li>
          <strong>Stays here:</strong> No <em>due date</em>, not done, not archived. Folder, tags, and custom fields stay.
        </li>
        <li>
          <strong>Leaves:</strong> Drag to a day or time, or mark done.
        </li>
        <li className="inbox-rules-contrast">
          <strong>vs. sidebar Inbox:</strong> Inbox also requires <strong>no folder</strong>. Here you only clear the date.
        </li>
      </ul>
    </div>
  );
}
