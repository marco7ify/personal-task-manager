import { useEffect, useState } from 'react';
import { subscribeSyncStatus } from '../utils/syncStatus';

const LABELS = {
  local: { text: 'Local only', dot: 'gray' },
  syncing: { text: 'Syncing…', dot: 'blue' },
  synced: { text: 'Synced', dot: 'green' },
  error: { text: 'Sync failed', dot: 'red' }
};

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SyncIndicator() {
  const [state, setState] = useState({ status: 'local', lastSyncedAt: null, lastError: null });

  useEffect(() => subscribeSyncStatus(setState), []);

  const { text, dot } = LABELS[state.status] || LABELS.local;
  const title =
    state.status === 'error'
      ? `Cloud sync failed: ${state.lastError || 'unknown error'}. Your changes are saved in this browser only.`
      : state.status === 'synced'
        ? `All changes saved to your account${state.lastSyncedAt ? ` at ${formatTime(state.lastSyncedAt)}` : ''}.`
        : state.status === 'local'
          ? 'Data is stored in this browser only and is not backed up to the cloud.'
          : 'Saving changes to your account…';

  return (
    <div className={`sync-indicator sync-${state.status}`} title={title} role="status">
      <span className={`sync-dot sync-dot-${dot}`} />
      <span>{text}</span>
      {state.status === 'synced' && state.lastSyncedAt && (
        <span className="sync-time">{formatTime(state.lastSyncedAt)}</span>
      )}
    </div>
  );
}
