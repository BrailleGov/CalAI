import { useState } from 'react';
import { getPersistedData, useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { APP_LOCALE } from '../../lib/locale';
import {
  SYNC_CONFIGURED,
  SyncError,
  clearSyncToken,
  deleteCloudSnapshot,
  ensureSyncToken,
  pullCloudSnapshot,
  pushCloudSnapshot
} from '../../lib/sync';

function formatSynced(value: number | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function CloudBackupSection() {
  const cloudSync = useAppStore((state) => state.cloudSync);
  const updateCloudSync = useAppStore((state) => state.updateCloudSync);
  const importData = useAppStore((state) => state.importData);
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  function currentSnapshot() {
    return getPersistedData();
  }

  async function backup(enable: boolean) {
    setBusy(true);
    setError('');
    try {
      if (!cloudSync.enabled) await ensureSyncToken();
      const updatedAt = await pushCloudSnapshot(currentSnapshot());
      updateCloudSync({ enabled: true, lastSyncedAt: updatedAt });
      toast(enable ? 'Cloud backup enabled' : 'Cloud backup updated');
    } catch (errorValue) {
      setError(
        errorValue instanceof SyncError
          ? errorValue.message
          : 'Cloud backup failed. Try again later.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError('');
    try {
      const data = await pullCloudSnapshot();
      const localSms = useAppStore.getState().sms;
      importData({ ...data, sms: localSms });
      updateCloudSync({ enabled: true, lastSyncedAt: Date.now() });
      setConfirmRestore(false);
      toast('Cloud backup restored');
    } catch (errorValue) {
      setError(
        errorValue instanceof SyncError
          ? errorValue.message
          : 'Cloud backup could not be restored.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError('');
    try {
      await deleteCloudSnapshot();
      if (!useAppStore.getState().sms.enabled) clearSyncToken();
      updateCloudSync({ enabled: false, lastSyncedAt: null });
      setConfirmDisable(false);
      toast(
        useAppStore.getState().sms.enabled
          ? 'Cloud backup turned off; SMS reminders stay connected'
          : 'Cloud backup turned off'
      );
    } catch (errorValue) {
      setError(
        errorValue instanceof SyncError
          ? `${errorValue.message} The encrypted server copy may still exist.`
          : 'The server copy could not be deleted. Try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="sync-heading">
      <div className="card-head card-head-flush">
        <h2 id="sync-heading">Cloud backup</h2>
        <span className="card-note">{cloudSync.enabled ? 'On' : 'Optional'}</span>
      </div>
      <div className="card settings-card">
        <div className="settings-card-body">
          <p className="settings-copy">
            An encrypted copy of your diary, recipes, and preferences can be stored on CalAI's
            server. There is no account: this browser holds a random device key.
          </p>

          <dl className="stats-list stats-list-flush">
            <div>
              <dt>Status</dt>
              <dd>{cloudSync.enabled ? 'Connected' : 'Not set up'}</dd>
            </div>
            <div>
              <dt>Last backup</dt>
              <dd>{formatSynced(cloudSync.lastSyncedAt)}</dd>
            </div>
          </dl>

          {!SYNC_CONFIGURED ? (
            <p className="fine-print">
              Cloud backup is not configured in this build. Deploy the Worker with a D1 database
              and set <code>VITE_API_BASE</code> to enable it.
            </p>
          ) : null}

          <p className="fine-print">
            The server stores a hash of the device key and encrypts the snapshot with a separate
            server-side secret. SMS settings and your phone number are never included.
          </p>

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}

          {confirmRestore ? (
            <div className="delete-confirm" role="alert">
              <p>
                Restoring from the cloud replaces this device's diary, recipes, and preferences.
                SMS settings stay local. Export a local backup first if you are unsure.
              </p>
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmRestore(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={restore}
                  disabled={busy}
                >
                  Restore cloud backup
                </button>
              </div>
            </div>
          ) : null}

          {confirmDisable ? (
            <div className="delete-confirm" role="alert">
              <p>Turn off cloud backup and delete the encrypted server copy?</p>
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmDisable(false)}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={disable}
                  disabled={busy}
                >
                  Turn off
                </button>
              </div>
            </div>
          ) : null}

          <div className="settings-button-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !SYNC_CONFIGURED}
              onClick={() => backup(!cloudSync.enabled)}
            >
              {busy ? 'Working…' : cloudSync.enabled ? 'Back up now' : 'Set up cloud backup'}
            </button>
            {cloudSync.enabled ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setConfirmRestore(true)}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy}
                  onClick={() => setConfirmDisable(true)}
                >
                  Turn off
                </button>
              </>
            ) : null}
          </div>

          <p className="fine-print">
            {cloudSync.enabled
              ? 'After setup, CalAI backs up quietly a few seconds after changes while the app is open and online.'
              : 'Nothing is uploaded until you choose to set it up. The local diary remains the source of truth.'}
          </p>
        </div>
      </div>
    </section>
  );
}
