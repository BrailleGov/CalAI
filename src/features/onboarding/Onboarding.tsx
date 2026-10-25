import { useMemo, useState } from 'react';
import type { ActivityLevel, Goal, Profile, Sex, Targets, Units } from '../../types';
import {
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS
} from '../../types';
import { Brand } from '../../components/Brand';
import { calculateTargets, maintenanceCalories } from '../../lib/nutrition';
import {
  centimetresToInches,
  formatNumber,
  inchesToCentimetres,
  kilogramsToPounds,
  poundsToKilograms
} from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';

type Errors = Record<string, string>;

const RATE_OPTIONS = [0.25, 0.5, 0.75];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

export function Onboarding() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('lose');
  const [rate, setRate] = useState(0.5);
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
      height = inchesToCentimetres(feetValue * 12 + inchValue);
      weight = poundsToKilograms(poundValue);
    }

    if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) {
      return null;
    }

    return {
      sex,
      age: numericAge,
      heightCm: height,
      weightKg: weight,
      activity,
      goal,
      rateKgPerWeek: goal === 'maintain' ? 0 : rate
    };
  }, [activity, age, feet, goal, heightCm, inches, pounds, rate, sex, units, weightKg]);

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
        setHeightCm(String(Math.round(inchesToCentimetres(feetValue * 12 + inchValue))));
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

    completeOnboarding(profile, {
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    });
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
    ? Math.round((Number(targetProtein) || 0) * 4 + (Number(targetCarbs) || 0) * 4 + (Number(targetFat) || 0) * 9)
    : 0;

  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <Brand />
        <span className="step-count">Step {step + 1} of 3</span>
      </header>

      <div className="onboarding-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <main className="onboarding-body" key={step}>
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
                <div className="segmented">
                  {RATE_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={rate === value ? 'segmented-item is-active' : 'segmented-item'}
                      aria-pressed={rate === value}
                      onClick={() => setRate(value)}
                    >
                      {value} kg/wk
                    </button>
                  ))}
                </div>
                <p className="field-hint">
                  0.5 kg a week is a moderate pace. Smaller changes are easier to keep.
                </p>
              </fieldset>
            ) : null}
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

            <p className="fine-print">
              CalAI enforces a 1,200 kcal floor as a safety guardrail. This is an estimate,
              not medical advice. If you have a health condition or a history of disordered
              eating, talk to a professional before setting aggressive targets.
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
          {step === 2 ? 'Start tracking' : 'Continue'}
        </button>
      </footer>
    </div>
  );
}
