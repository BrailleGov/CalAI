import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Food, Nutrients } from '../../types';

export type FoodFormValues = {
  name: string;
  servingLabel: string;
  nutrients: Nutrients;
};

type FoodFormProps = {
  initial?: Food;
  submitLabel: string;
  onSubmit: (values: FoodFormValues) => void;
};

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function FoodForm({ initial, submitLabel, onSubmit }: FoodFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? '1 serving');
  const [kcal, setKcal] = useState(initial ? String(initial.nutrients.kcal) : '');
  const [protein, setProtein] = useState(initial ? String(initial.nutrients.protein) : '');
  const [carbs, setCarbs] = useState(initial ? String(initial.nutrients.carbs) : '');
  const [fat, setFat] = useState(initial ? String(initial.nutrients.fat) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const kcalValue = parseNumber(kcal);
    const proteinValue = parseNumber(protein);
    const carbsValue = parseNumber(carbs);
    const fatValue = parseNumber(fat);

    if (!name.trim()) nextErrors.name = 'Give the food a name.';
    if (!servingLabel.trim()) nextErrors.serving = 'Describe the serving.';
    if (!Number.isFinite(kcalValue) || kcalValue < 0 || kcalValue > 20000) {
      nextErrors.kcal = 'Enter calories between 0 and 20,000.';
    }
    if (!Number.isFinite(proteinValue) || proteinValue < 0 || proteinValue > 2000) {
      nextErrors.protein = 'Enter protein between 0 and 2,000 g.';
    }
    if (!Number.isFinite(carbsValue) || carbsValue < 0 || carbsValue > 2000) {
      nextErrors.carbs = 'Enter carbs between 0 and 2,000 g.';
    }
    if (!Number.isFinite(fatValue) || fatValue < 0 || fatValue > 2000) {
      nextErrors.fat = 'Enter fat between 0 and 2,000 g.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      servingLabel: servingLabel.trim(),
      nutrients: {
        kcal: kcalValue,
        protein: proteinValue,
        carbs: carbsValue,
        fat: fatValue
      }
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Chicken curry"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <span className="field-error" role="alert">{errors.name}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Serving</span>
        <input
          value={servingLabel}
          onChange={(event) => setServingLabel(event.target.value)}
          placeholder="1 bowl (350 g)"
          autoComplete="off"
          aria-invalid={Boolean(errors.serving)}
        />
        {errors.serving ? <span className="field-error" role="alert">{errors.serving}</span> : null}
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Calories</span>
          <span className="unit-input">
            <input
              value={kcal}
              onChange={(event) => setKcal(event.target.value)}
              inputMode="decimal"
              placeholder="450"
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
              inputMode="decimal"
              placeholder="30"
              aria-invalid={Boolean(errors.protein)}
            />
            <span className="unit">g</span>
          </span>
          {errors.protein ? <span className="field-error" role="alert">{errors.protein}</span> : null}
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field-label">Carbs</span>
          <span className="unit-input">
            <input
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              inputMode="decimal"
              placeholder="40"
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
              inputMode="decimal"
              placeholder="15"
              aria-invalid={Boolean(errors.fat)}
            />
            <span className="unit">g</span>
          </span>
          {errors.fat ? <span className="field-error" role="alert">{errors.fat}</span> : null}
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block">
        {submitLabel}
      </button>
    </form>
  );
}
