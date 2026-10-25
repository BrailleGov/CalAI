import { useEffect, useState } from 'react';
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
  const hasReminders = reminders.enabled && activeReminders.length > 0;

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
      setError('Turn on at least one meal reminder first, then save SMS preferences.');
      return;
    }

    setBusy(true);
    try {
      await saveSmsPreferences({
        enabled,
        phone,
        consent,
        reminders,
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
        <span className="card-note">Outbound only</span>
      </div>
      <div className="card settings-card">
        {!SMS_CONFIGURED ? (
          <p className="fine-print">
            SMS is not configured in this build. Deploy the Worker with a Textbelt key and set{' '}
            <code>VITE_API_BASE</code> to enable outbound reminder texts. No phone number is
            collected until then.
          </p>
        ) : (
          <>
            <p className="fine-print">
              CalAI can text you the same meal reminders you already schedule. Messages are
              outbound only: <strong>replies are not monitored</strong>. Frequency follows your
              enabled reminders (up to four per day). Message and data rates may apply.
            </p>

            <ToggleRow
              label="Send reminder texts"
              description="Uses the meal times and quiet hours from Reminders."
              checked={enabled}
              onChange={setEnabled}
            />

            <label className="field">
              <span className="field-label">Mobile number</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(error)}
              />
              <span className="field-hint">
                Include the country code. Stored encrypted on the server and kept out of exported
                backups and cloud snapshots.
              </span>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I agree to receive automated CalAI reminder texts at this number. Consent is not a
                condition of using CalAI, and I can turn this off at any time.
              </span>
            </label>

            {!hasReminders ? (
              <p className="fine-print">
                No meal reminders are on yet. Turn on at least one reminder above before enabling
                texts.
              </p>
            ) : (
              <p className="fine-print">
                Active reminder times:{' '}
                {activeReminders
                  .map((item) => `${MEAL_LABELS[item.meal]} ${item.time}`)
                  .join(' · ')}
              </p>
            )}

            <div className="sms-preview" aria-label="Message preview">
              <span className="eyebrow">Preview</span>
              <p>{smsPreview(MEAL_LABELS[activeReminders[0]?.meal ?? 'lunch'].toLowerCase())}</p>
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
              health values. Sending stops immediately when reminders are off or you turn SMS off.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
