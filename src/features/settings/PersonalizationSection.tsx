import { useEffect, useState } from 'react';
import type {
  ActivityLevel,
  DietPattern,
  Goal,
  MuscleGroup,
  Preferences,
  Profile,
  Sex,
  Units
} from '../../types';
import {
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  CUISINE_OPTIONS,
  DIET_LABELS,
  DIET_PATTERNS,
  GOAL_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  SEX_LABELS,
  TRACKING_STYLES,
  TRACKING_STYLE_LABELS
} from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { Slider } from '../../components/Slider';
import { ToggleRow } from '../../components/ToggleRow';
import {
  kilogramsToPounds,
  poundsToKilograms,
  formatWeight
} from '../../lib/format';
import { muscleFocusSummary } from '../../lib/preferences';

type Errors = Record<string, string>;

function emptyFocus(): Record<MuscleGroup, number> {
  return MUSCLE_GROUPS.reduce(
    (focus, group) => ({ ...focus, [group]: 0 }),
    {} as Record<MuscleGroup, number>
  );
}

function focusFromProfile(profile: Profile | null): Record<MuscleGroup, number> {
  const base = emptyFocus();
  if (!profile?.muscleFocus) return base;
  for (const group of MUSCLE_GROUPS) {
    base[group] = profile.muscleFocus[group] ?? 0;
  }
  return base;
}

function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 40)
    )
  ].slice(0, 20);
}

export function PersonalizationSection() {
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const units = useAppStore((state) => state.settings.units);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [goal, setGoal] = useState<Goal>('maintain');
  const [rate, setRate] = useState(0.5);
  const [sex, setSex] = useState<Sex>('unspecified');
  const [age, setAge] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [feet, setFeet] = useState('5');
  const [inches, setInches] = useState('9');
  const [pounds, setPounds] = useState('');
  const [targetWeightEnabled, setTargetWeightEnabled] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState(70);
  const [muscleEnabled, setMuscleEnabled] = useState(false);
  const [muscleFocus, setMuscleFocus] = useState<Record<MuscleGroup, number>>(emptyFocus());
  const [draftPreferences, setDraftPreferences] = useState<Preferences>(preferences);
  const [avoidText, setAvoidText] = useState(preferences.avoidIngredients.join(', '));
  const [aiConsent, setAiConsent] = useState(preferences.aiConsentAt !== null);
  const [editUnits, setEditUnits] = useState<Units>(units);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGoal(profile?.goal ?? 'maintain');
    setRate(profile?.rateKgPerWeek || 0.5);
    setSex(profile?.sex ?? 'unspecified');
    setAge(profile ? String(profile.age) : '');
    setActivity(profile?.activity ?? 'moderate');
    setHeightCm(profile ? String(Math.round(profile.heightCm)) : '');
    setWeightKg(profile ? String(Math.round(profile.weightKg * 10) / 10) : '');
    setPounds(profile ? String(Math.round(kilogramsToPounds(profile.weightKg))) : '');
    if (profile) {
      const totalInches = Math.round(profile.heightCm / 2.54);
      setFeet(String(Math.floor(totalInches / 12)));
      setInches(String(totalInches % 12));
    }
    setTargetWeightEnabled(Boolean(profile?.targetWeightKg));
    setTargetWeightKg(profile?.targetWeightKg ?? profile?.weightKg ?? 70);
    setMuscleEnabled(Boolean(profile?.muscleFocus));
    setMuscleFocus(focusFromProfile(profile));
    setDraftPreferences(preferences);
    setAvoidText(preferences.avoidIngredients.join(', '));
    setAiConsent(preferences.aiConsentAt !== null);
    setEditUnits(units);
  }, [open, preferences, profile, units]);

  const sendsDataToAi =
    draftPreferences.photoLogging ||
    draftPreferences.aiChat ||
    draftPreferences.recipeIdeas;

  function patchPreferences<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setDraftPreferences((current) => ({ ...current, [key]: value }));
  }

  function changeUnits(next: Units) {
    if (next === editUnits) return;
    if (next === 'imperial') {
      const cm = Number(heightCm);
      if (Number.isFinite(cm) && cm > 0) {
        const total = Math.round(cm / 2.54);
        setFeet(String(Math.floor(total / 12)));
        setInches(String(total % 12));
      }
      const kg = Number(weightKg);
      if (Number.isFinite(kg) && kg > 0) {
        setPounds(String(Math.round(kilogramsToPounds(kg))));
      }
    } else {
      const total = Number(feet) * 12 + Number(inches);
      if (Number.isFinite(total)) setHeightCm(String(Math.round(total * 2.54)));
      const lb = Number(pounds);
      if (Number.isFinite(lb) && lb > 0) {
        setWeightKg(String(Math.round(poundsToKilograms(lb) * 10) / 10));
      }
    }
    setEditUnits(next);
    setErrors({});
  }

  function handleSave() {
    const nextErrors: Errors = {};
    const numericAge = Number(age);
    const height =
      editUnits === 'metric'
        ? Number(heightCm)
        : (Number(feet) * 12 + Number(inches)) * 2.54;
    const weight =
      editUnits === 'metric' ? Number(weightKg) : poundsToKilograms(Number(pounds));

    if (!Number.isInteger(numericAge) || numericAge < 13 || numericAge > 100) {
      nextErrors.age = 'Use an age between 13 and 100.';
    }
    if (!Number.isFinite(height) || height < 100 || height > 250) {
      nextErrors.height = 'Enter a height between 100 and 250 cm.';
    }
    if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      nextErrors.weight = 'Enter a weight between 30 and 300 kg.';
    }
    if (sendsDataToAi && !aiConsent && draftPreferences.aiConsentAt === null) {
      nextErrors.consent =
        'Confirm AI use or turn off the AI features. Your diary still works without AI.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const focus: Record<string, number> = {};
    if (muscleEnabled) {
      for (const group of MUSCLE_GROUPS) {
        if (muscleFocus[group] > 0) focus[group] = muscleFocus[group];
      }
    }

    const nextProfile: Profile = {
      sex,
      age: numericAge,
      heightCm: height,
      weightKg: weight,
      activity,
      goal,
      rateKgPerWeek: goal === 'maintain' ? 0 : rate,
      ...(targetWeightEnabled && goal !== 'maintain'
        ? { targetWeightKg: Math.round(targetWeightKg * 10) / 10 }
        : {}),
      ...(Object.keys(focus).length > 0 ? { muscleFocus: focus } : {})
    };

    updateProfile(nextProfile);
    updatePreferences({
      ...draftPreferences,
      avoidIngredients: parseList(avoidText),
      aiConsentAt: aiConsent ? Date.now() : null
    });
    setOpen(false);
    toast('Personalization saved');
  }

  const summaryWeight = profile ? formatWeight(profile.weightKg, units) : null;

  return (
    <section className="settings-section" aria-labelledby="personalization-heading">
      <div className="card-head card-head-flush">
        <h2 id="personalization-heading">Personalization</h2>
        <span className="card-note">Editable</span>
      </div>
      <div className="card settings-card">
        <dl className="stats-list personalization-summary">
          <div>
            <dt>Goal</dt>
            <dd>{profile ? GOAL_LABELS[profile.goal] : 'Not set'}</dd>
          </div>
          <div>
            <dt>Tracking</dt>
            <dd>{TRACKING_STYLE_LABELS[preferences.trackingStyle]}</dd>
          </div>
          <div>
            <dt>Food preference</dt>
            <dd>{DIET_LABELS[preferences.diet]}</dd>
          </div>
          <div>
            <dt>Current weight</dt>
            <dd>{summaryWeight ?? '—'}</dd>
          </div>
          <div>
            <dt>Target weight</dt>
            <dd>
              {profile?.targetWeightKg
                ? formatWeight(profile.targetWeightKg, units)
                : 'Not set'}
            </dd>
          </div>
          <div>
            <dt>Training emphasis</dt>
            <dd>{muscleFocusSummary(profile).join(', ') || 'Not set'}</dd>
          </div>
          <div>
            <dt>AI consent</dt>
            <dd>{preferences.aiConsentAt ? 'Given' : 'Not given'}</dd>
          </div>
          <div>
            <dt>Cuisines</dt>
            <dd>{preferences.cuisines.join(', ') || 'Any'}</dd>
          </div>
        </dl>

        <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>
          Edit setup and preferences
        </button>
      </div>

      <Sheet
        open={open}
        title="Edit personalization"
        subtitle="Changes apply to shortcuts and suggestions, not past entries"
        onClose={() => setOpen(false)}
      >
        <fieldset className="field-group">
          <legend className="field-label">Goal</legend>
          <div className="segmented segmented-small">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((value) => (
              <button
                key={value}
                type="button"
                className={goal === value ? 'segmented-item is-active' : 'segmented-item'}
                aria-pressed={goal === value}
                onClick={() => setGoal(value)}
              >
                {GOAL_LABELS[value]}
              </button>
            ))}
          </div>
          {goal !== 'maintain' ? (
            <Slider
              label="Weekly pace"
              value={rate}
              min={0.1}
              max={1}
              step={0.05}
              onChange={setRate}
              format={(value) =>
                editUnits === 'metric'
                  ? `${value.toFixed(2)} kg / week`
                  : `${kilogramsToPounds(value).toFixed(1)} lb / week`
              }
            />
          ) : null}
        </fieldset>

        <div className="units-row">
          <span className="field-label">Units for these fields</span>
          <div className="segmented segmented-small">
            {(['metric', 'imperial'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={editUnits === value ? 'segmented-item is-active' : 'segmented-item'}
                aria-pressed={editUnits === value}
                onClick={() => changeUnits(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Age</span>
            <span className="unit-input">
              <input
                value={age}
                onChange={(event) => setAge(event.target.value)}
                inputMode="numeric"
                aria-invalid={Boolean(errors.age)}
              />
              <span className="unit">yrs</span>
            </span>
            {errors.age ? <span className="field-error" role="alert">{errors.age}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">Sex for formula</span>
            <select
              className="select"
              value={sex}
              onChange={(event) => setSex(event.target.value as Sex)}
            >
              {(Object.keys(SEX_LABELS) as Sex[]).map((value) => (
                <option key={value} value={value}>
                  {SEX_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {editUnits === 'metric' ? (
          <div className="field-row">
            <label className="field">
              <span className="field-label">Height</span>
              <span className="unit-input">
                <input
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.height)}
                />
                <span className="unit">cm</span>
              </span>
              {errors.height ? (
                <span className="field-error" role="alert">{errors.height}</span>
              ) : null}
            </label>
            <label className="field">
              <span className="field-label">Weight</span>
              <span className="unit-input">
                <input
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.weight)}
                />
                <span className="unit">kg</span>
              </span>
              {errors.weight ? (
                <span className="field-error" role="alert">{errors.weight}</span>
              ) : null}
            </label>
          </div>
        ) : (
          <div className="field-row">
            <label className="field">
              <span className="field-label">Height (ft / in)</span>
              <span className="split-input">
                <span className="unit-input">
                  <input
                    value={feet}
                    onChange={(event) => setFeet(event.target.value)}
                    inputMode="numeric"
                    aria-label="Edit height in feet"
                  />
                  <span className="unit">ft</span>
                </span>
                <span className="unit-input">
                  <input
                    value={inches}
                    onChange={(event) => setInches(event.target.value)}
                    inputMode="numeric"
                    aria-label="Edit height in inches"
                  />
                  <span className="unit">in</span>
                </span>
              </span>
            </label>
            <label className="field">
              <span className="field-label">Weight</span>
              <span className="unit-input">
                <input
                  value={pounds}
                  onChange={(event) => setPounds(event.target.value)}
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.weight)}
                />
                <span className="unit">lb</span>
              </span>
              {errors.weight ? (
                <span className="field-error" role="alert">{errors.weight}</span>
              ) : null}
            </label>
          </div>
        )}

        <label className="field">
          <span className="field-label">Activity</span>
          <select
            className="select"
            value={activity}
            onChange={(event) => setActivity(event.target.value as ActivityLevel)}
          >
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((value) => (
              <option key={value} value={value}>
                {ACTIVITY_LABELS[value]}
              </option>
            ))}
          </select>
          <span className="field-hint">{ACTIVITY_HINTS[activity]}</span>
        </label>

        {goal !== 'maintain' ? (
          <fieldset className="field-group">
            <legend className="field-label">Target weight</legend>
            <ToggleRow
              label="Set a target weight"
              description="Optional. It is never treated as a medical target."
              checked={targetWeightEnabled}
              onChange={setTargetWeightEnabled}
            />
            {targetWeightEnabled ? (
              <Slider
                label="Target"
                value={targetWeightKg}
                min={30}
                max={250}
                step={0.5}
                onChange={setTargetWeightKg}
                format={(value) =>
                  editUnits === 'metric'
                    ? `${Math.round(value * 10) / 10} kg`
                    : `${Math.round(kilogramsToPounds(value))} lb`
                }
              />
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="field-group">
          <legend className="field-label">Training emphasis</legend>
          <ToggleRow
            label="Set muscle-group priorities"
            description="Only shapes recipe and coaching wording. Not a measurement."
            checked={muscleEnabled}
            onChange={setMuscleEnabled}
          />
          {muscleEnabled ? (
            <div className="slider-stack">
              {MUSCLE_GROUPS.map((group) => (
                <Slider
                  key={group}
                  label={MUSCLE_LABELS[group]}
                  value={muscleFocus[group]}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(value) =>
                    setMuscleFocus((current) => ({ ...current, [group]: value }))
                  }
                  format={(value) => `${value}% priority`}
                />
              ))}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="field-group">
          <legend className="field-label">Tracking style</legend>
          <div className="segmented segmented-small">
            {TRACKING_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                className={
                  draftPreferences.trackingStyle === style
                    ? 'segmented-item is-active'
                    : 'segmented-item'
                }
                aria-pressed={draftPreferences.trackingStyle === style}
                onClick={() => patchPreferences('trackingStyle', style)}
              >
                {TRACKING_STYLE_LABELS[style]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend className="field-label">AI shortcuts</legend>
          <div className="toggle-stack">
            <ToggleRow
              label="Photo logging"
              checked={draftPreferences.photoLogging}
              onChange={(checked) => patchPreferences('photoLogging', checked)}
            />
            <ToggleRow
              label="Describe a meal"
              checked={draftPreferences.textLogging}
              onChange={(checked) => patchPreferences('textLogging', checked)}
            />
            <ToggleRow
              label="AI coach"
              checked={draftPreferences.aiChat}
              onChange={(checked) => patchPreferences('aiChat', checked)}
            />
            <ToggleRow
              label="Recipe ideas"
              checked={draftPreferences.recipeIdeas}
              onChange={(checked) => patchPreferences('recipeIdeas', checked)}
            />
          </div>
          {sendsDataToAi ? (
            <div className="consent-box">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={aiConsent}
                  onChange={(event) => setAiConsent(event.target.checked)}
                />
                <span>
                  I agree to send only the meal content I choose, plus totals and preferences, to
                  CalAI's AI provider.
                </span>
              </label>
              {errors.consent ? (
                <span className="field-error" role="alert">{errors.consent}</span>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <label className="field">
          <span className="field-label">Food preference</span>
          <select
            className="select"
            value={draftPreferences.diet}
            onChange={(event) => patchPreferences('diet', event.target.value as DietPattern)}
          >
            {DIET_PATTERNS.map((value) => (
              <option key={value} value={value}>
                {DIET_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field-group">
          <legend className="field-label">Cuisines</legend>
          <div className="chip-row">
            {CUISINE_OPTIONS.map((cuisine) => {
              const active = draftPreferences.cuisines.includes(cuisine);
              return (
                <button
                  key={cuisine}
                  type="button"
                  className={`chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    patchPreferences(
                      'cuisines',
                      active
                        ? draftPreferences.cuisines.filter((item) => item !== cuisine)
                        : [...draftPreferences.cuisines, cuisine].slice(0, 6)
                    )
                  }
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Ingredients to avoid</span>
          <input
            value={avoidText}
            onChange={(event) => setAvoidText(event.target.value)}
            placeholder="peanuts, shellfish"
            autoComplete="off"
          />
          <span className="field-hint">
            Used to filter recipe suggestions. Always check labels for allergies.
          </span>
        </label>

        <p className="fine-print">
          Stats above set future AI context and recipe personalization. Daily calorie targets stay
          unchanged unless you edit them in the Daily targets section.
        </p>

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save personalization
          </button>
        </div>
      </Sheet>
    </section>
  );
}
