import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Reminder, ReminderSettings } from '../../types';
import { ACTIVITY_LABELS, GOAL_LABELS, MEAL_LABELS } from '../../types';
import {
  getPersistedData,
  useAppStore,
  resetPersistedState
} from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { buildBackup, parseBackup, redactForExport } from '../../lib/backup';
import { formatHeight, formatWeight } from '../../lib/format';
import { todayKey } from '../../lib/dates';
import { buildReminderIcs } from '../../lib/reminders';
import {
  hasPushSubscription,
  pushConfigured,
  pushSupported,
  subscribeToPush,
  syncPushReminders,
  unsubscribeFromPush
} from '../../lib/push';
import { PersonalizationSection } from './PersonalizationSection';
import { CloudBackupSection } from './CloudBackupSection';
import { SmsSettings } from './SmsSettings';
import { SMS_CONFIGURED, disableSms } from '../../lib/sms';
import {
  IconBell,
  IconDownload,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconWater
} from '../../components/icons';

type TargetErrors = Record<string, string>;

export function SettingsPage() {
  const targets = useAppStore((state) => state.targets);
  const profile = useAppStore((state) => state.profile);
  const settings = useAppStore((state) => state.settings);
  const updateTargets = useAppStore((state) => state.updateTargets);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const importData = useAppStore((state) => state.importData);
  const reminders = useAppStore((state) => state.reminders);
  const updateReminders = useAppStore((state) => state.updateReminders);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kcal, setKcal] = useState(String(targets.kcal));
  const [protein, setProtein] = useState(String(targets.protein));
  const [carbs, setCarbs] = useState(String(targets.carbs));
  const [fat, setFat] = useState(String(targets.fat));
  const [errors, setErrors] = useState<TargetErrors>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoalMl));
  const [waterError, setWaterError] = useState('');
  const [pushState, setPushState] = useState<'unknown' | 'subscribed' | 'off'>('unknown');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setKcal(String(targets.kcal));
    setProtein(String(targets.protein));
    setCarbs(String(targets.carbs));
    setFat(String(targets.fat));
  }, [targets]);

  useEffect(() => {
    setWaterGoal(String(settings.waterGoalMl));
  }, [settings.waterGoalMl]);

  useEffect(() => {
    if (!pushConfigured || !pushSupported()) return;
    let cancelled = false;
    void hasPushSubscription().then((subscribed) => {
      if (!cancelled) setPushState(subscribed ? 'subscribed' : 'off');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSaveTargets() {
    const nextErrors: TargetErrors = {};
    const kcalValue = Number(kcal);
    const proteinValue = Number(protein);
    const carbsValue = Number(carbs);
    const fatValue = Number(fat);

    if (!Number.isFinite(kcalValue) || kcalValue < 1200 || kcalValue > 6000) {
      nextErrors.kcal = 'Use 1,200–6,000 kcal.';
    }
    if (!Number.isFinite(proteinValue) || proteinValue < 0 || proteinValue > 1000) {
      nextErrors.protein = '0–1,000 g.';
    }
    if (!Number.isFinite(carbsValue) || carbsValue < 0 || carbsValue > 1000) {
      nextErrors.carbs = '0–1,000 g.';
    }
    if (!Number.isFinite(fatValue) || fatValue < 0 || fatValue > 500) {
      nextErrors.fat = '0–500 g.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    updateTargets({
      kcal: Math.round(kcalValue),
      protein: Math.round(proteinValue),
      carbs: Math.round(carbsValue),
      fat: Math.round(fatValue)
    });
    toast('Targets saved');
  }

  function handleSaveWaterGoal() {
    const value = Number(waterGoal);
    if (!Number.isFinite(value) || value < 250 || value > 10000) {
      setWaterError('Use a goal between 250 and 10,000 ml.');
      return;
    }
    setWaterError('');
    updateSettings({ waterGoalMl: Math.round(value) });
    toast('Water goal saved');
  }

  function applyReminderPatch(patch: Partial<ReminderSettings>) {
    const next = { ...reminders, ...patch };
    updateReminders(patch);
    if (pushState === 'subscribed') {
      void syncPushReminders(next).catch(() => undefined);
    }
  }

  function updateReminderItem(id: string, patch: Partial<Reminder>) {
    applyReminderPatch({
      items: reminders.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    });
  }

  function handleDownloadIcs() {
    const ics = buildReminderIcs(reminders.items);
    if (!ics) {
      toast('Turn on at least one reminder first.');
      return;
    }

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calai-reminders.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Calendar file downloaded');
  }

  async function handleEnablePush() {
    if (!reminders.enabled || !reminders.items.some((item) => item.enabled)) {
      toast('Turn on at least one reminder first.');
      return;
    }

    setPushBusy(true);
    try {
      await subscribeToPush(reminders);
      setPushState('subscribed');
      toast('Device notifications enabled');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      setPushState('off');
      toast('Device notifications turned off');
    } catch {
      toast('Could not turn off device notifications.');
    } finally {
      setPushBusy(false);
    }
  }

  function handleExport() {
    const data = redactForExport(getPersistedData());
    const backup = buildBackup(data);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calai-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const result = parseBackup(text);
    if (!result.ok) {
      toast(result.error);
      return;
    }

    const confirmed = window.confirm(
      'Importing this backup replaces your current diary, foods, targets, and settings. Continue?'
    );
    if (!confirmed) return;

    const localSms = useAppStore.getState().sms;
    importData({
      ...result.data,
      sms: localSms,
      cloudSync: { enabled: false, lastSyncedAt: null }
    });
    toast('Backup imported');
  }

  async function handleReset() {
    const state = useAppStore.getState();
    if (SMS_CONFIGURED && state.sms.enabled) {
      try {
        await disableSms();
      } catch {
        toast('Could not turn off SMS. Try again before resetting.');
        return;
      }
    }
    resetPersistedState();
    setConfirmReset(false);
    toast('All local data cleared');
  }

  return (
    <div className="page settings-page">
      <header className="page-head">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
        <p className="page-lede">
          Your diary is stored on this device. Export a backup before switching phones or
          clearing browser data.
        </p>
      </header>

      <section className="settings-section" aria-labelledby="targets-heading">
        <div className="card-head card-head-flush">
          <h2 id="targets-heading">Daily targets</h2>
          <span className="card-note">Manual override</span>
        </div>
        <div className="card">
          <div className="target-grid">
            <label className="field">
              <span className="field-label">Calories</span>
              <span className="unit-input">
                <input
                  value={kcal}
                  onChange={(event) => setKcal(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.kcal)}
                />
                <span className="unit">kcal</span>
              </span>
              {errors.kcal ? <span className="field-error" role="alert">{errors.kcal}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Protein</span>
              <span className="unit-input">
                <input
                  value={protein}
                  onChange={(event) => setProtein(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.protein)}
                />
                <span className="unit">g</span>
              </span>
              {errors.protein ? <span className="field-error" role="alert">{errors.protein}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Carbs</span>
              <span className="unit-input">
                <input
                  value={carbs}
                  onChange={(event) => setCarbs(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.carbs)}
                />
                <span className="unit">g</span>
              </span>
              {errors.carbs ? <span className="field-error" role="alert">{errors.carbs}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Fat</span>
              <span className="unit-input">
                <input
                  value={fat}
                  onChange={(event) => setFat(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.fat)}
                />
                <span className="unit">g</span>
              </span>
              {errors.fat ? <span className="field-error" role="alert">{errors.fat}</span> : null}
            </label>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={handleSaveTargets}>
            Save targets
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="water-heading">
        <div className="card-head card-head-flush">
          <h2 id="water-heading">
            <IconWater size={16} /> Water goal
          </h2>
          <span className="card-note">For the quick-add bar</span>
        </div>
        <div className="card">
          <label className="field">
            <span className="field-label">Daily water goal</span>
            <span className="unit-input">
              <input
                value={waterGoal}
                onChange={(event) => {
                  setWaterGoal(event.target.value);
                  setWaterError('');
                }}
                inputMode="numeric"
                aria-invalid={Boolean(waterError)}
              />
              <span className="unit">ml</span>
            </span>
            {waterError ? (
              <span className="field-error" role="alert">
                {waterError}
              </span>
            ) : null}
          </label>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleSaveWaterGoal}
          >
            Save water goal
          </button>
        </div>
      </section>

      <PersonalizationSection />

      <section className="settings-section" aria-labelledby="reminders-heading">
        <div className="card-head card-head-flush">
          <h2 id="reminders-heading">
            <IconBell size={16} /> Reminders
          </h2>
          <span className="card-note">{reminders.enabled ? 'On' : 'Off'}</span>
        </div>
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-label">In-app reminders</span>
            <label className="check-label">
              <input
                type="checkbox"
                aria-label="In-app reminders"
                checked={reminders.enabled}
                onChange={() => applyReminderPatch({ enabled: !reminders.enabled })}
              />
              <span>{reminders.enabled ? 'On' : 'Off'}</span>
            </label>
          </div>

          {reminders.enabled ? (
            <div className="reminder-settings">
              <p className="fine-print">
                While CalAI is open, a quiet banner appears during the 90 minutes after
                each enabled time. Quiet hours suppress the banner.
              </p>

              <ul className="reminder-list">
                {reminders.items.map((item) => (
                  <li key={item.id}>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() =>
                          updateReminderItem(item.id, { enabled: !item.enabled })
                        }
                      />
                      <span>{MEAL_LABELS[item.meal]}</span>
                    </label>
                    <label className="reminder-time">
                      <span className="visually-hidden">
                        {MEAL_LABELS[item.meal]} reminder time
                      </span>
                      <input
                        type="time"
                        value={item.time}
                        onChange={(event) =>
                          updateReminderItem(item.id, { time: event.target.value })
                        }
                      />
                    </label>
                  </li>
                ))}
              </ul>

              <div className="field-row">
                <label className="field">
                  <span className="field-label">Quiet from</span>
                  <input
                    type="time"
                    value={reminders.quietStart}
                    onChange={(event) =>
                      applyReminderPatch({ quietStart: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Quiet until</span>
                  <input
                    type="time"
                    value={reminders.quietEnd}
                    onChange={(event) =>
                      applyReminderPatch({ quietEnd: event.target.value })
                    }
                  />
                </label>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={handleDownloadIcs}
              >
                <IconDownload size={16} /> Download calendar (.ics)
              </button>

              {pushConfigured && pushSupported() ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={
                    pushState === 'subscribed' ? handleDisablePush : handleEnablePush
                  }
                  disabled={pushBusy}
                >
                  <IconBell size={16} />{' '}
                  {pushBusy
                    ? 'Working…'
                    : pushState === 'subscribed'
                      ? 'Turn off device notifications'
                      : 'Enable device notifications'}
                </button>
              ) : (
                <p className="fine-print">
                  Push notifications are not configured in this build. Deploy the Cloudflare
                  Worker and set <code>VITE_API_BASE</code> and{' '}
                  <code>VITE_VAPID_PUBLIC_KEY</code> to turn them on. The in-app banner and
                  calendar file work without a server.
                </p>
              )}

              <p className="fine-print">
                A calendar reminder works even when CalAI is closed. Push notifications are
                best on an installed PWA; iOS requires 16.4 or newer and explicit permission.
              </p>
            </div>
          ) : (
            <p className="fine-print reminder-off-note">
              Off by default. Turn reminders on to pick times and download a calendar file.
              Nothing is sent anywhere.
            </p>
          )}
        </div>
      </section>

      <SmsSettings />

      <section className="settings-section" aria-labelledby="appearance-heading">
        <div className="card-head card-head-flush">
          <h2 id="appearance-heading">Appearance</h2>
        </div>
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <div className="segmented segmented-small">
              {(['dark', 'light', 'system'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={settings.theme === value ? 'segmented-item is-active' : 'segmented-item'}
                  aria-pressed={settings.theme === value}
                  onClick={() => updateSettings({ theme: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Units</span>
            <div className="segmented segmented-small">
              {(['metric', 'imperial'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={settings.units === value ? 'segmented-item is-active' : 'segmented-item'}
                  aria-pressed={settings.units === value}
                  onClick={() => updateSettings({ units: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {profile ? (
        <section className="settings-section" aria-labelledby="stats-heading">
          <div className="card-head card-head-flush">
            <h2 id="stats-heading">Your stats</h2>
          </div>
          <dl className="card stats-list">
            <div>
              <dt>Goal</dt>
              <dd>{GOAL_LABELS[profile.goal]}</dd>
            </div>
            <div>
              <dt>Activity</dt>
              <dd>{ACTIVITY_LABELS[profile.activity]}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{profile.age}</dd>
            </div>
            <div>
              <dt>Height</dt>
              <dd>{formatHeight(profile.heightCm, settings.units)}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{formatWeight(profile.weightKg, settings.units)}</dd>
            </div>
            <div>
              <dt>Pace</dt>
              <dd>
                {profile.goal === 'maintain'
                  ? 'Maintenance'
                  : `${profile.rateKgPerWeek} kg / week`}
              </dd>
            </div>
          </dl>
          <p className="fine-print">
            These stats feed the target estimate and AI context. Use Personalization above to
            update them; daily targets stay under your control.
          </p>
        </section>
      ) : null}

      <CloudBackupSection />

      <section className="settings-section" aria-labelledby="data-heading">
        <div className="card-head card-head-flush">
          <h2 id="data-heading">Data</h2>
          <span className="card-note">Local first</span>
        </div>
        <div className="card settings-card">
          <button type="button" className="settings-action" onClick={handleExport}>
            <IconDownload size={18} />
            <span>
              <strong>Export backup</strong>
              <small>Download a JSON file; your SMS number is excluded</small>
            </span>
          </button>

          <button
            type="button"
            className="settings-action"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload size={18} />
            <span>
              <strong>Import backup</strong>
              <small>Replace local data from a CalAI JSON file</small>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            aria-label="Import backup file"
            onChange={handleImport}
          />

          {confirmReset ? (
            <div className="delete-confirm" role="alert">
              <p>Delete all foods, entries, and settings on this device?</p>
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={handleReset}>
                  <IconTrash size={15} /> Delete everything
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="settings-action settings-action-danger"
              onClick={() => setConfirmReset(true)}
            >
              <IconTrash size={18} />
              <span>
                <strong>Reset CalAI</strong>
                <small>Delete everything stored locally</small>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-heading">
        <div className="card-head card-head-flush">
          <h2 id="about-heading">About</h2>
          <span className="card-note">v0.3.0 alpha</span>
        </div>
        <div className="card about-card">
          <p>
            CalAI is a local-first calorie tracker. No account, no ads, no analytics on what
            you eat.
          </p>
          <p className="about-planned">
            <IconSparkles size={16} /> New in v0.3: photo and text logging, an AI coach, a recipe
            book, personalized goals, encrypted cloud backup, and optional SMS reminders.
          </p>
          <p className="about-meta">
            Online food data: openfoodfacts.org (ODbL) and USDA FoodData Central (public
            domain). AI estimates come from DeepSeek and are not medical advice. Values are
            estimates.
          </p>
          <a
            className="text-link"
            href="https://github.com/BrailleGov/CalAI"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub ↗
          </a>
          <p className="about-meta">
            Food estimates are not medical advice. Exported backups contain your full diary.
          </p>
        </div>
      </section>
    </div>
  );
}
