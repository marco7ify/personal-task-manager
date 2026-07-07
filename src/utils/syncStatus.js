/**
 * Tracks cloud-sync state so the UI can show whether data is actually
 * reaching the server instead of silently living only in localStorage.
 */
const state = {
  // 'local' | 'syncing' | 'synced' | 'error'
  status: 'local',
  lastSyncedAt: null,
  lastError: null
};

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener({ ...state });
}

export function setSyncStatus(status, { error } = {}) {
  state.status = status;
  if (status === 'synced') {
    state.lastSyncedAt = Date.now();
    state.lastError = null;
  }
  if (status === 'error') {
    state.lastError = error ? String(error) : 'Sync failed';
  }
  emit();
}

export function getSyncStatus() {
  return { ...state };
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}
