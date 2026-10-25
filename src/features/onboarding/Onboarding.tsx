import { useMemo, useState } from 'react';
import type {
  ActivityLevel,
  DietPattern,
  Goal,
  MuscleFocus,
  MuscleGroup,
  Preferences,
  Profile,
  Sex,
  Targets,
  Units
} from '../../types';
import {
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  CUISINE_OPTIONS,
  DEFAULT_PREFERENCES,
  DIET_LABELS,
  DIET_PATTERNS,
  GOAL_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  SEX_LABELS,
  TRACKING_STYLES,
  TRACKING_STYLE_LABELS
} from '../../types';
import { Brand } from '../../components/Brand';
import { StorageWarning } from '../../components/StorageWarning';
import { Slider } from '../../components/Slider';
import { ToggleRow } from '../../components/ToggleRow';
import { calculateTargets, maintenanceCalories } from '../../lib/nutrition';
import {
  centimetresToInches,
  clamp,
  formatNumber,
  kilogramsToPounds,
  poundsToKilograms
} from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';

type Errors = Record<string, string>;

const STEP_COUNT = 4;
const RATE_MIN = 0.1;
const RATE_MAX = 1;
const RATE_STEP = 0.05;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

function emptyMuscleFocus(): Record<MuscleGroup, number> {
  return MUSCLE_GROUPS.reduce(
    (focus, group) => ({ ...focus, [group]: 0 }),
    {} as Record<MuscleGroup, number>
  );
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

export function Onboarding() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('lose');
  const [rate, setRate] = useState(0.5);
  const [targetWeightEnabled, setTargetWeightEnabled] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState(70);
  const [muscleEnabled, setMuscleEnabled] = useState(false);
  const [muscleFocus, setMuscleFocus] = useState<Record<MuscleGroup, number>>(
    emptyMuscleFocus()
  );
  const [sex, setSex] = useState<Sex>('unspecified');
  const [age, setAge] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [units, setUnits] = useState<Units>('metric');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [feet, setFeet] = useState('5');
  const [inches, setInches] = useState('9');
  const [pounds, setPounds] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [targets, setTargets] = useState<Targets | null>(null);
  const [targetKcal, setTargetKcal] = useState('');
  const [targetProtein, setTargetProtein] = useState('');
  const [targetCarbs, setTargetCarbs] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [preferences, setPreferences] = useState<Preferences>({
    ...DEFAULT_PREFERENCES,
    avoidIngredients: [],
    cuisines: []
  });
  const [avoidText, setAvoidText] = useState('');
  const [aiConsent, setAiConsent] = useState(false);

  const currentWeightKg = useMemo(() => {
    if (units === 'metric') return Number(weightKg);
    return poundsToKilograms(Number(pounds));
  }, [pounds, units, weightKg]);

  const profile = useMemo<Profile | null>(() => {
    const numericAge = Number(age);
    if (!Number.isFinite(numericAge)) return null;

    let height: number;
    let weight: number;

    if (units === 'metric') {
      height = Number(heightCm);
      weight = Number(weightKg);
    } else {
      const feetValue = Number(feet);
      const inchValue = Number(inches);
      const poundValue = Number(pounds);
      height = (feetValue * 12 + inchValue) * 2.54;
      weight = poundsToKilograms(poundValue);
    }

    if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) {
      return null;
    }

    const focus: MuscleFocus = {};
    if (muscleEnabled) {
      for (const group of MUSCLE_GROUPS) {
        if (muscleFocus[group] > 0) focus[group] = muscleFocus[group];
      }
    }

    return {
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
  }, [
    activity,
    age,
    feet,
    goal,
    heightCm,
    inches,
    muscleEnabled,
    muscleFocus,
    pounds,
    rate,
    sex,
    targetWeightEnabled,
    targetWeightKg,
    units,
    weightKg
  ]);

  function validateBody(): boolean {
    const nextErrors: Errors = {};
    const numericAge = Number(age);

    if (!Number.isFinite(numericAge) || !Number.isInteger(numericAge)) {
      nextErrors.age = 'Enter your age in years.';
    } else if (numericAge < 13 || numericAge > 100) {
      nextErrors.age = 'CalAI is designed for ages 13 to 100.';
    }

    if (units === 'metric') {
      const height = Number(heightCm);
      const weight = Number(weightKg);
      if (!Number.isFinite(height) || height < 100 || height > 250) {
        nextErrors.height = 'Enter a height between 100 and 250 cm.';
      }
      if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
        nextErrors.weight = 'Enter a weight between 30 and 300 kg.';
      }
    } else {
      const feetValue = Number(feet);
      const inchValue = Number(inches);
      const totalInches = feetValue * 12 + inchValue;
      const poundValue = Number(pounds);

      if (
        !Number.isFinite(feetValue) ||
        !Number.isFinite(inchValue) ||
        inchValue < 0 ||
        inchValue > 11 ||
        totalInches < 39 ||
        totalInches > 98
      ) {
        nextErrors.height = 'Enter a height between 3′3″ and 8′2″.';
      }
      if (!Number.isFinite(poundValue) || poundValue < 66 || poundValue > 660) {
        nextErrors.weight = 'Enter a weight between 66 and 660 lb.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function applyCalculatedTargets(nextProfile: Profile) {
    const calculated = calculateTargets(nextProfile);
    setTargets(calculated);
    setTargetKcal(String(calculated.kcal));
    setTargetProtein(String(calculated.protein));
    setTargetCarbs(String(calculated.carbs));
    setTargetFat(String(calculated.fat));
  }

  function handleUnits(nextUnits: Units) {
    if (nextUnits === units) return;

    if (nextUnits === 'imperial') {
      const cm = Number(heightCm);
      if (Number.isFinite(cm) && cm > 0) {
        const totalInches = Math.round(centimetresToInches(cm));
        setFeet(String(Math.floor(totalInches / 12)));
        setInches(String(totalInches % 12));
      }
      const kg = Number(weightKg);
      if (Number.isFinite(kg) && kg > 0) {
        setPounds(String(Math.round(kilogramsToPounds(kg))));
      }
    } else {
      const feetValue = Number(feet);
      const inchValue = Number(inches);
      if (Number.isFinite(feetValue) && Number.isFinite(inchValue)) {
        setHeightCm(String(Math.round((feetValue * 12 + inchValue) * 2.54)));
      }
      const lb = Number(pounds);
      if (Number.isFinite(lb) && lb > 0) {
        setWeightKg(String(Math.round(poundsToKilograms(lb) * 10) / 10));
      }
    }

    setUnits(nextUnits);
    setErrors({});
  }

  function goToStep(nextStep: number) {
    setErrors({});
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function featureCount(): number {
    return [
      preferences.photoLogging,
      preferences.textLogging,
      preferences.aiChat,
      preferences.recipeIdeas
    ].filter(Boolean).length;
  }

  function sendsDataToAi(): boolean {
    return preferences.photoLogging || preferences.aiChat || preferences.recipeIdeas;
  }

  function handleContinue() {
    if (step === 0) {
      goToStep(1);
      return;
    }

    if (step === 1) {
      if (!validateBody() || !profile) return;
      applyCalculatedTargets(profile);
      goToStep(2);
      return;
    }

    if (step === 2) {
      if (aiConsent && !preferences.aiConsentAt) {
        updatePreference('aiConsentAt', Date.now());
      }
      const needsConsent = sendsDataToAi();
      if (needsConsent && !aiConsent && !preferences.aiConsentAt) {
        setErrors({
          consent:
            'Confirm the AI notice, or turn off the AI features, to continue. You can also change this later in Settings.'
        });
        return;
      }
      goToStep(3);
      return;
    }

    const nextErrors: Errors = {};
    const kcal = Number(targetKcal);
    const protein = Number(targetProtein);
    const carbs = Number(targetCarbs);
    const fat = Number(targetFat);

    if (!Number.isFinite(kcal) || kcal < 1200 || kcal > 6000) {
      nextErrors.kcal = 'Target must be between 1,200 and 6,000 kcal.';
    }
    if (!Number.isFinite(protein) || protein < 0 || protein > 1000) {
      nextErrors.protein = 'Enter protein between 0 and 1,000 g.';
    }
    if (!Number.isFinite(carbs) || carbs < 0 || carbs > 1000) {
      nextErrors.carbs = 'Enter carbs between 0 and 1,000 g.';
    }
    if (!Number.isFinite(fat) || fat < 0 || fat > 500) {
      nextErrors.fat = 'Enter fat between 0 and 500 g.';
    }

    if (Object.keys(nextErrors).length > 0 || !profile) {
      setErrors(nextErrors);
      return;
    }

    completeOnboarding(
      profile,
      {
        kcal: Math.round(kcal),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat)
      },
      {
        ...preferences,
        avoidIngredients: parseList(avoidText),
        aiConsentAt: aiConsent || preferences.aiConsentAt ? Date.now() : null
      }
    );
    window.location.hash = '#/today';
    window.scrollTo({ top: 0 });
  }

  function handleRecalculate() {
    if (!profile) return;
    applyCalculatedTargets(profile);
    setErrors({});
  }

  const maintenance = profile ? Math.round(maintenanceCalories(profile)) : null;
  const macroTotal = targets
    ? Math.round(
        (Number(targetProtein) || 0) * 4 +
          (Number(targetCarbs) || 0) * 4 +
          (Number(targetFat) || 0) * 9
      )
    : 0;
  const weightLabel = (kg: number) =>
    units === 'metric'
      ? `${Math.round(kg * 10) / 10} kg`
      : `${formatNumber(kilogramsToPounds(kg))} lb`;
  const targetWeightMin = 30;
  const targetWeightMax = 250;

  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <Brand />
        <span className="step-count">
          Step {step + 1} of {STEP_COUNT}
        </span>
      </header>

      <div className="onboarding-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }} />
      </div>

      <main className="onboarding-body" key={step}>
        <StorageWarning />
        {step === 0 ? (
          <>
            <p className="eyebrow">Set up</p>
            <h1>What are you aiming for?</h1>
            <p className="page-lede">
              CalAI builds a daily calorie and macro target around your goal. You can adjust
              everything later.
            </p>

            <fieldset className="field-group">
              <legend className="field-label">Your goal</legend>
              <div className="choice-grid">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((value) => (
                  <label
                    key={value}
                    className={`choice-card${goal === value ? ' choice-card-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="goal"
                      value={value}
                      checked={goal === value}
                      onChange={() => setGoal(value)}
                    />
                    <span className="choice-title">{GOAL_LABELS[value]}</span>
                    <span className="choice-hint">
                      {value === 'lose'
                        ? 'A steady deficit'
                        : value === 'maintain'
                          ? 'Stay where you are'
                          : 'A controlled surplus'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {goal !== 'maintain' ? (
              <fieldset className="field-group">
                <legend className="field-label">Pace</legend>
                <Slider
                  label="Weekly change"
                  value={rate}
                  min={RATE_MIN}
                  max={RATE_MAX}
                  step={RATE_STEP}
                  onChange={(value) => setRate(clamp(value, RATE_MIN, RATE_MAX))}
                  format={(value) =>
                    units === 'metric'
                      ? `${value.toFixed(2)} kg / week`
                      : `${(kilogramsToPounds(value)).toFixed(1)} lb / week`
                  }
                  hint="Smaller changes are usually easier to keep. CalAI never enforces a pace."
                />
              </fieldset>
            ) : null}

            <fieldset className="field-group">
              <legend className="field-label">Training emphasis</legend>
              <ToggleRow
                label="Set muscle-group priorities"
                description="Optional. These sliders only shape recipe and coaching wording. They are not body measurements or medical targets."
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
                  <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    onClick={() => setMuscleFocus(emptyMuscleFocus())}
                  >
                    Clear priorities
                  </button>
                </div>
              ) : null}
            </fieldset>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="eyebrow">About you</p>
            <h1>A few numbers.</h1>
            <p className="page-lede">
              Used to estimate maintenance calories. Everything stays on this device until you
              choose otherwise.
            </p>

            <div className="units-row">
              <span className="field-label">Units</span>
              <div className="segmented segmented-small">
                <button
                  type="button"
                  className={units === 'metric' ? 'segmented-item is-active' : 'segmented-item'}
                  aria-pressed={units === 'metric'}
                  onClick={() => handleUnits('metric')}
                >
                  Metric
                </button>
                <button
                  type="button"
                  className={units === 'imperial' ? 'segmented-item is-active' : 'segmented-item'}
                  aria-pressed={units === 'imperial'}
                  onClick={() => handleUnits('imperial')}
                >
                  Imperial
                </button>
              </div>
            </div>

            <fieldset className="field-group">
              <legend className="field-label">Sex used for the formula</legend>
              <div className="segmented">
                {(Object.keys(SEX_LABELS) as Sex[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={sex === value ? 'segmented-item is-active' : 'segmented-item'}
                    aria-pressed={sex === value}
                    onClick={() => setSex(value)}
                  >
                    {value === 'unspecified' ? 'Not specified' : SEX_LABELS[value]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Age</span>
                <span className="unit-input">
                  <input
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    inputMode="numeric"
                    placeholder="27"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.age)}
                  />
                  <span className="unit">yrs</span>
                </span>
                <FieldError message={errors.age} />
              </label>

              {units === 'metric' ? (
                <label className="field">
                  <span className="field-label">Height</span>
                  <span className="unit-input">
                    <input
                      value={heightCm}
                      onChange={(event) => setHeightCm(event.target.value)}
                      inputMode="decimal"
                      placeholder="175"
                      autoComplete="off"
                      aria-invalid={Boolean(errors.height)}
                    />
                    <span className="unit">cm</span>
                  </span>
                  <FieldError message={errors.height} />
                </label>
              ) : null}
            </div>

            {units === 'imperial' ? (
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Height</span>
                  <span className="split-input">
                    <span className="unit-input">
                      <input
                        value={feet}
                        onChange={(event) => setFeet(event.target.value)}
                        inputMode="numeric"
                        aria-label="Height in feet"
                        aria-invalid={Boolean(errors.height)}
                      />
                      <span className="unit">ft</span>
                    </span>
                    <span className="unit-input">
                      <input
                        value={inches}
                        onChange={(event) => setInches(event.target.value)}
                        inputMode="numeric"
                        aria-label="Height in inches"
                        aria-invalid={Boolean(errors.height)}
                      />
                      <span className="unit">in</span>
                    </span>
                  </span>
                  <FieldError message={errors.height} />
                </label>

                <label className="field">
                  <span className="field-label">Weight</span>
                  <span className="unit-input">
                    <input
                      value={pounds}
                      onChange={(event) => setPounds(event.target.value)}
                      inputMode="decimal"
                      placeholder="160"
                      autoComplete="off"
                      aria-invalid={Boolean(errors.weight)}
                    />
                    <span className="unit">lb</span>
                  </span>
                  <FieldError message={errors.weight} />
                </label>
              </div>
            ) : (
              <label className="field">
                <span className="field-label">Weight</span>
                <span className="unit-input">
                  <input
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    inputMode="decimal"
                    placeholder="70"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.weight)}
                  />
                  <span className="unit">kg</span>
                </span>
                <FieldError message={errors.weight} />
              </label>
            )}

            {goal !== 'maintain' ? (
              <fieldset className="field-group">
                <legend className="field-label">Target weight</legend>
                <ToggleRow
                  label="Set a target weight"
                  description="Optional. CalAI only uses it to describe progress; it does not push you toward a number."
                  checked={targetWeightEnabled}
                  onChange={setTargetWeightEnabled}
                />
                {targetWeightEnabled ? (
                  <Slider
                    label="Target"
                    value={targetWeightKg}
                    min={targetWeightMin}
                    max={targetWeightMax}
                    step={0.5}
                    onChange={setTargetWeightKg}
                    format={weightLabel}
                    hint={
                      Number.isFinite(currentWeightKg) && currentWeightKg > 0
                        ? `Current weight is ${weightLabel(currentWeightKg)}.`
                        : 'You can change this later in Settings.'
                    }
                  />
                ) : null}
              </fieldset>
            ) : null}

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
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="eyebrow">How you log</p>
            <h1>Make it yours.</h1>
            <p className="page-lede">
              These choices only change shortcuts and suggestions. Manual logging always works,
              and you can edit this later in Settings.
            </p>

            <fieldset className="field-group">
              <legend className="field-label">Tracking style</legend>
              <div className="choice-grid choice-grid-two">
                {TRACKING_STYLES.map((style) => (
                  <label
                    key={style}
                    className={`choice-card${
                      preferences.trackingStyle === style ? ' choice-card-active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="tracking-style"
                      value={style}
                      checked={preferences.trackingStyle === style}
                      onChange={() => updatePreference('trackingStyle', style)}
                    />
                    <span className="choice-title">{TRACKING_STYLE_LABELS[style]}</span>
                    <span className="choice-hint">
                      {style === 'quick'
                        ? 'Keep the day light with quick adds and photos'
                        : 'See macros, meals, and full history'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="field-group">
              <legend className="field-label">Shortcuts to show</legend>
              <div className="toggle-stack">
                <ToggleRow
                  label="Photo logging"
                  description="Take a meal photo and review AI estimates before logging."
                  checked={preferences.photoLogging}
                  onChange={(checked) => updatePreference('photoLogging', checked)}
                />
                <ToggleRow
                  label="Describe a meal"
                  description="Type or dictate “two eggs and toast” and confirm the parsed items."
                  checked={preferences.textLogging}
                  onChange={(checked) => updatePreference('textLogging', checked)}
                />
                <ToggleRow
                  label="AI coach"
                  description="Ask questions about your own totals and get recipe ideas."
                  checked={preferences.aiChat}
                  onChange={(checked) => updatePreference('aiChat', checked)}
                />
                <ToggleRow
                  label="Recipe ideas"
                  description="Generate recipes from what you have, matched to your preferences."
                  checked={preferences.recipeIdeas}
                  onChange={(checked) => updatePreference('recipeIdeas', checked)}
                />
              </div>
            </fieldset>

            {sendsDataToAi() ? (
              <div className="consent-box">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={aiConsent || preferences.aiConsentAt !== null}
                    onChange={(event) => {
                      setAiConsent(event.target.checked);
                      updatePreference(
                        'aiConsentAt',
                        event.target.checked ? Date.now() : null
                      );
                    }}
                  />
                  <span>
                    I understand AI estimates can be wrong and agree to send only the meal photo
                    or text I choose, plus a summary of my totals and preferences, to CalAI's AI
                    provider.
                  </span>
                </label>
                <p className="fine-print">
                  AI is optional. It is never used for simple storage, and nothing is logged until
                  you confirm. You can withdraw consent in Settings.
                </p>
                <FieldError message={errors.consent} />
              </div>
            ) : null}

            <label className="field">
              <span className="field-label">Food preference</span>
              <select
                className="select"
                value={preferences.diet}
                onChange={(event) =>
                  updatePreference('diet', event.target.value as DietPattern)
                }
              >
                {DIET_PATTERNS.map((value) => (
                  <option key={value} value={value}>
                    {DIET_LABELS[value]}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                Used for recipe ideas and suggestions. It never filters your diary.
              </span>
            </label>

            <fieldset className="field-group">
              <legend className="field-label">Cuisines you enjoy</legend>
              <div className="chip-row">
                {CUISINE_OPTIONS.map((cuisine) => {
                  const active = preferences.cuisines.includes(cuisine);
                  return (
                    <button
                      key={cuisine}
                      type="button"
                      className={`chip${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() =>
                        updatePreference(
                          'cuisines',
                          active
                            ? preferences.cuisines.filter((item) => item !== cuisine)
                            : [...preferences.cuisines, cuisine].slice(0, 6)
                        )
                      }
                    >
                      {cuisine}
                    </button>
                  );
                })}
              </div>
              <p className="field-hint">Optional. Choose up to six.</p>
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
                Optional, comma separated. Used to avoid recipe suggestions, not to diagnose
                allergies. Always check labels.
              </span>
            </label>

            <p className="fine-print">
              Reminders are SMS only and off by default. Set times, quiet hours, and an optional
              number in Settings when you want them.
            </p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="eyebrow">Your targets</p>
            <h1>Daily numbers.</h1>
            <p className="page-lede">
              Estimated maintenance is {maintenance ? `${formatNumber(maintenance)} kcal` : '—'}.
              These are a starting point, not a rule.
            </p>

            <div className="target-grid">
              <label className="field">
                <span className="field-label">Calories</span>
                <span className="unit-input">
                  <input
                    value={targetKcal}
                    onChange={(event) => setTargetKcal(event.target.value)}
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.kcal)}
                  />
                  <span className="unit">kcal</span>
                </span>
                <FieldError message={errors.kcal} />
              </label>
              <label className="field">
                <span className="field-label">Protein</span>
                <span className="unit-input">
                  <input
                    value={targetProtein}
                    onChange={(event) => setTargetProtein(event.target.value)}
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.protein)}
                  />
                  <span className="unit">g</span>
                </span>
                <FieldError message={errors.protein} />
              </label>
              <label className="field">
                <span className="field-label">Carbs</span>
                <span className="unit-input">
                  <input
                    value={targetCarbs}
                    onChange={(event) => setTargetCarbs(event.target.value)}
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.carbs)}
                  />
                  <span className="unit">g</span>
                </span>
                <FieldError message={errors.carbs} />
              </label>
              <label className="field">
                <span className="field-label">Fat</span>
                <span className="unit-input">
                  <input
                    value={targetFat}
                    onChange={(event) => setTargetFat(event.target.value)}
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.fat)}
                  />
                  <span className="unit">g</span>
                </span>
                <FieldError message={errors.fat} />
              </label>
            </div>

            <div className="target-note">
              <p>
                Macros add up to ~{formatNumber(macroTotal)} kcal. A mismatch with your calorie
                target is fine, but it can make the numbers drift.
              </p>
            </div>

            <button type="button" className="btn btn-quiet" onClick={handleRecalculate}>
              Recalculate from my stats
            </button>

            <div className="summary-review">
              <h2 className="summary-review-title">Your setup</h2>
              <ul>
                <li>
                  <span>Goal</span>
                  <strong>{GOAL_LABELS[profile?.goal ?? goal]}</strong>
                </li>
                <li>
                  <span>Tracking</span>
                  <strong>{TRACKING_STYLE_LABELS[preferences.trackingStyle]}</strong>
                </li>
                <li>
                  <span>Food preference</span>
                  <strong>{DIET_LABELS[preferences.diet]}</strong>
                </li>
                <li>
                  <span>Shortcuts</span>
                  <strong>{featureCount()} enabled</strong>
                </li>
                <li>
                  <span>Reminders</span>
                  <strong>SMS only — off until set up</strong>
                </li>
              </ul>
            </div>

            <p className="fine-print">
              CalAI enforces a 1,200 kcal floor as a safety guardrail. This is an estimate, not
              medical advice. If you have a health condition or a history of disordered eating,
              talk to a professional before setting aggressive targets.
            </p>
          </>
        ) : null}
      </main>

      <footer className="onboarding-foot">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => goToStep(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-primary" onClick={handleContinue}>
          {step === 3 ? 'Start tracking' : 'Continue'}
        </button>
      </footer>
    </div>
  );
}
