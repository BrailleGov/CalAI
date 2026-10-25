import { storageAvailable } from '../lib/storage';

export function StorageWarning() {
  if (storageAvailable) return null;

  return (
    <p className="storage-warning" role="status">
      Storage is blocked in this browser. CalAI still works, but changes will be lost when
      this tab closes. Allow site data to keep your diary.
    </p>
  );
}
