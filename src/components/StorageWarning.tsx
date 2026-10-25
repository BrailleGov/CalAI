import { useSyncExternalStore } from 'react';
import { getStorageStatus, subscribeStorageStatus } from '../lib/storage';

export function StorageWarning() {
  const status = useSyncExternalStore(
    subscribeStorageStatus,
    getStorageStatus,
    getStorageStatus
  );

  if (!status.blocked && !status.writeFailed && !status.quarantine) return null;

  const messages: string[] = [];
  if (status.blocked) {
    messages.push(
      'Storage is blocked in this browser. CalAI still works, but changes will be lost when this tab closes. Allow site data to keep your diary.'
    );
  }
  if (status.writeFailed) {
    messages.push(
      'CalAI could not save the latest changes. Storage may be full; export a backup and remove old data.'
    );
  }
  if (status.quarantine) {
    messages.push(
      'A damaged local copy was set aside so CalAI could start safely. A recovery copy remains in this browser.'
    );
  }

  return (
    <p className="storage-warning" role="status">
      {messages.join(' ')}
    </p>
  );
}
