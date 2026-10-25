import { useEffect, useState } from 'react';
import type { Reminder } from '../../types';
import { MEAL_LABELS } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { ToggleRow } from '../../components/ToggleRow';
import {
  SMS_CONFIGURED,
  SmsError,
  disableSms,
  maskPhone,
  normalizePhone,
  saveSmsPreferences,
  sendTestSms,
  smsPreview,
  validatePhone
} from '../../lib/sms';

export function SmsSettings() {
  const sms = useAppStore((state) => state.sms);
  const updateSms = useAppStore((state) => state.updateSms);
  const reminders = useAppStore((state) => state.reminders);
  const updateReminders = useAppStore((state) => state.updateReminders);
  const toast = useToast();

  const [phone, setPhone] = useState(sms.phone);
  const [enabled, setEnabled] = useState(sms.enabled);
  const [consent, setConsent] = useState(sms.consentAt !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPhone(sms.phone);
    setEnabled(sms.enabled);
    setConsent(sms.consentAt !== null);
    setSaved(Boolean(sms.enabled && sms.phone && sms.consentAt));
  }, [sms]);

  const activeReminders = reminders.items.filter((item) => item.enabled);
  const hasReminders = activeReminders.length > 0;
  const previewMeal = MEAL_LABELS[activeReminders[0]?.meal ?? 'lunch'].toLowerCase();

  function setSchedule(items: Reminder[]) {
    updateReminders({
      items,
      enabled: items.some((item) => item.enabled)
    });
  }

  function updateReminderItem(id: string, patch: Partial<Reminder>) {
    setSchedule(
      reminders.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function handleSave() {
    setError('');
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    if (enabled && !consent) {
      setError('Confirm consent before turning on SMS reminders.');
      return;
    }
    if (enabled && !hasReminders) {
      setError('Turn on at least one meal reminder before enabling texts.');
      return;
    }

    setBusy(true);
    try {
      await saveSmsPreferences({
        enabled,
        phone,
        consent,
        reminders: {
          ...reminders,
          enabled: hasReminders
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      });
      const consentAt = consent ? Date.now() : null;
      updateSms({
        enabled,
        phone: normalizePhone(phone),
        consentAt
      });
      setSaved(Boolean(consentAt));
      toast(enabled ? 'SMS reminders saved' : 'SMS preferences saved');
    } catch (errorValue) {
      setError(
        errorValue instanceof SmsError
          ? errorValue.message
          : 'SMS preferences could not be saved.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setError('');
    try {
      const result = await sendTestSms();
      updateSms({ lastTestAt: Date.now() });
      toast(
        typeof result.quotaRemaining === 'number'
          ? `Test text sent · ${result.quotaRemaining} left`
          : 'Test text sent'
      );
    } catch (errorValue) {
      setError(
        errorValue instanceof SmsError ? errorValue.message : 'The test text could not be sent.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError('');
    try {
      await disableSms();
      updateSms({ enabled: false, phone: '', consentAt: null });
      setPhone('');
      setEnabled(false);
      setConsent(false);
      setSaved(false);
      toast('SMS reminders turned off');
    } catch (errorValue) {
      setError(
        errorValue instanceof SmsError
          ? `${errorValue.message} The service may still send until this succeeds.`
          : 'SMS could not be turned off. Try again before leaving this screen.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="sms-heading">
      <div className="card-head card-head-flush">
        <h2 id="sms-heading">SMS reminders</h2>
        <span className="card-note">{sms.enabled ? 'On' : 'Off'}</span>
      </div>
      <div className="card settings-card">
        <div className="settings-card-body">
          {!SMS_CONFIGURED ? (
            <p className="settings-copy">
              SMS is not configured in this build. Deploy the Worker with a Textbelt key and set{' '}
              <code>VITE_API_BASE</code> to enable outbound reminder texts. No phone number is
              collected until then.
            </p>
          ) : (
            <>
              <p className="settings-copy">
                All CalAI reminders are sent by text. Messages are outbound only and{' '}
                <strong>replies are not monitored</strong>. CalAI has no in-app or push
                reminders.
              </p>

              <div className="settings-block">
                <ToggleRow
                  label="Send reminder texts"
                  description="Texts use the meal times and quiet hours below. Up to four per day."
                  checked={enabled}
                  onChange={setEnabled}
                />
              </div>

              <div className="settings-block">
                <h3 className="settings-subhead">Reminder schedule</h3>
                <p className="settings-copy">
                  Pick the meals you want a text for. Message and data rates may apply.
                </p>
                <ul className="reminder-list sms-schedule" aria-label="Meal reminder times">
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
                        updateReminders({ quietStart: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Quiet until</span>
                    <input
                      type="time"
                      value={reminders.quietEnd}
                      onChange={(event) => updateReminders({ quietEnd: event.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="settings-block">
                <h3 className="settings-subhead">Mobile number</h3>
                <label className="field">
                  <span className="field-label">Number for texts</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+1 555 123 4567"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(error)}
                  />
                  <span className="field-hint">
                    Include the country code. Stored encrypted on the server and kept out of
                    exported backups and cloud snapshots.
                  </span>
                </label>

                <label className="check-label sms-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>
                    I agree to receive automated CalAI reminder texts at this number. Consent is
                    not a condition of using CalAI, and I can turn this off at any time.
                  </span>
                </label>
              </div>

              <div className="sms-preview" aria-label="Message preview">
                <span className="eyebrow">Preview</span>
                <p>{smsPreview(previewMeal)}</p>
              </div>

              {sms.phone ? (
                <p className="fine-print">
                  Saved number: {maskPhone(sms.phone)}
                  {sms.enabled ? ' · Reminders on' : ' · Reminders off'}
                </p>
              ) : null}

              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="settings-button-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={handleSave}
                >
                  {busy ? 'Working…' : 'Save SMS settings'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || !saved}
                  onClick={handleTest}
                >
                  Send test text
                </button>
                {sms.phone ? (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy}
                    onClick={handleDisable}
                  >
                    Turn off SMS
                  </button>
                ) : null}
              </div>

              <p className="fine-print">
                Texts contain only the meal name and time. They never include calories, foods, or
                health values. Sending stops immediately when SMS is off.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
