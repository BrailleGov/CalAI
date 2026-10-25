import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../../types';
import {
  getPersistedData,
  useAppStore,
  resetPersistedState
} from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { buildBackup, parseBackup, redactForExport } from '../../lib/backup';
import { formatHeight, formatWeight } from '../../lib/format';
import { todayKey } from '../../lib/dates';
import { PersonalizationSection } from './PersonalizationSection';
import { CloudBackupSection } from './CloudBackupSection';
import { SmsSettings } from './SmsSettings';
import { SMS_CONFIGURED, disableSms } from '../../lib/sms';
import {
  SYNC_CONFIGURED,
  clearSyncToken,
  deleteCloudSnapshot,
  getSyncToken
} from '../../lib/sync';
import {
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
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kcal, setKcal] = useState(String(targets.kcal));
  const [protein, setProtein] = useState(String(targets.protein));
  const [carbs, setCarbs] = useState(String(targets.carbs));
  const [fat, setFat] = useState(String(targets.fat));
  const [errors, setErrors] = useState<TargetErrors>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoalMl));
  const [waterError, setWaterError] = useState('');

  useEffect(() => {
    setKcal(String(targets.kcal));
    setProtein(String(targets.protein));
    setCarbs(String(targets.carbs));
    setFat(String(targets.fat));
  }, [targets]);

  useEffect(() => {
    setWaterGoal(String(settings.waterGoalMl));
  }, [settings.waterGoalMl]);

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
    setResetError('');

    if (SMS_CONFIGURED && state.sms.enabled) {
      try {
        await disableSms();
      } catch {
        setResetError(
          'SMS reminders could not be turned off. Retry while online before deleting local data.'
        );
        return;
      }
    }

    if (SYNC_CONFIGURED && (state.cloudSync.enabled || Boolean(getSyncToken()))) {
      try {
        await deleteCloudSnapshot();
      } catch {
        setResetError(
          'The encrypted cloud copy could not be deleted. Retry while online before deleting local data.'
        );
        return;
      }
    }

    resetPersistedState();
    clearSyncToken();
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
              <p>
                Delete all foods, entries, and settings on this device? If cloud backup or SMS
                is enabled, CalAI also deletes the server copies first.
              </p>
              {resetError ? (
                <p className="field-error" role="alert">
                  {resetError}
                </p>
              ) : null}
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setConfirmReset(false);
                    setResetError('');
                  }}
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
              onClick={() => {
                setResetError('');
                setConfirmReset(true);
              }}
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
          <span className="card-note">v0.3.1 alpha</span>
        </div>
        <div className="card about-card">
          <p>
            CalAI is a local-first calorie tracker. No account, no ads, no analytics on what
            you eat.
          </p>
          <p className="about-planned">
            <IconSparkles size={16} /> New in v0.3: camera-first photo and text logging, a shared
            AI food library, an AI coach, a recipe book, personalized goals, encrypted cloud
            backup, and SMS-only reminders.
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
