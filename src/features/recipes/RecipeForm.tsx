import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Food, Recipe, RecipeIngredient } from '../../types';
import { SEED_FOODS } from '../../data/seedFoods';
import { useAppStore } from '../../store/useAppStore';
import { formatNumber } from '../../lib/format';
import { rankFoods } from '../../lib/search';
import { recipePerServing, recipeTotals } from '../../lib/recipes';
import { IconMinus, IconPlus, IconSearch, IconTrash } from '../../components/icons';

export type RecipeFormValues = {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions?: string[];
};

type RecipeFormProps = {
  initial?: Recipe;
  submitLabel: string;
  onSubmit: (values: RecipeFormValues) => void;
};

export function RecipeForm({ initial, submitLabel, onSubmit }: RecipeFormProps) {
  const customFoods = useAppStore((state) => state.customFoods);
  const remoteFoods = useAppStore((state) => state.remoteFoods);
  const favorites = useAppStore((state) => state.favorites);
  const recentFoodIds = useAppStore((state) => state.recentFoodIds);

  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial ? initial.ingredients.map((item) => ({ ...item })) : []
  );
  const [instructions, setInstructions] = useState(
    initial?.instructions?.join('\n') ?? ''
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const allFoods = useMemo(
    () => [...customFoods, ...remoteFoods, ...SEED_FOODS],
    [customFoods, remoteFoods]
  );
  const results = useMemo(
    () => (query.trim() ? rankFoods(allFoods, query, favorites, recentFoodIds).slice(0, 6) : []),
    [allFoods, favorites, query, recentFoodIds]
  );

  const draft: Recipe = {
    id: initial?.id ?? 'draft',
    name,
    servings: Math.max(0.25, Number(servings) || 1),
    ingredients,
    createdAt: initial?.createdAt ?? Date.now(),
    updatedAt: Date.now()
  };
  const totals = recipeTotals(draft);
  const perServing = recipePerServing(draft);

  function addFood(food: Food) {
    setIngredients((current) => [
      ...current,
      {
        foodId: food.id,
        name: food.name,
        servingLabel: food.servingLabel,
        quantity: 1,
        nutrients: { ...food.nutrients }
      }
    ]);
    setQuery('');
    setError('');
  }

  function updateQuantity(index: number, next: number) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: Math.min(1000, Math.max(0.01, next)) }
          : item
      )
    );
  }

  function removeIngredient(index: number) {
    setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const servingsValue = Number(servings);

    if (!name.trim()) {
      setError('Give the recipe a name.');
      return;
    }
    if (!Number.isFinite(servingsValue) || servingsValue < 0.25 || servingsValue > 100) {
      setError('Servings must be between 0.25 and 100.');
      return;
    }
    if (ingredients.length === 0) {
      setError('Add at least one ingredient.');
      return;
    }

    setError('');
    onSubmit({
      name: name.trim(),
      servings: servingsValue,
      ingredients,
      instructions: instructions
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 30)
    });
  }

  return (
    <form className="form recipe-form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span className="field-label">Recipe name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Chicken rice bowl"
          autoComplete="off"
          autoFocus
        />
      </label>

      <label className="field">
        <span className="field-label">Servings in this batch</span>
        <span className="unit-input">
          <input
            value={servings}
            onChange={(event) => setServings(event.target.value)}
            inputMode="decimal"
          />
          <span className="unit">servings</span>
        </span>
      </label>

      <div className="recipe-add">
        <label className="search-field">
          <IconSearch size={17} />
          <span className="visually-hidden">Search ingredients</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add an ingredient…"
            autoComplete="off"
          />
        </label>
        {results.length > 0 ? (
          <ul className="food-list recipe-results">
            {results.map((food) => (
              <li key={food.id}>
                <button type="button" className="food-row" onClick={() => addFood(food)}>
                  <span className="food-row-main">
                    <span className="food-name">{food.name}</span>
                    <span className="food-meta">
                      {food.servingLabel} · {formatNumber(food.nutrients.kcal)} kcal
                    </span>
                  </span>
                  <IconPlus size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {ingredients.length > 0 ? (
        <ul className="ingredient-list">
          {ingredients.map((ingredient, index) => (
            <li key={`${ingredient.foodId ?? ingredient.name}-${index}`}>
              <div className="ingredient-main">
                <span className="food-name">{ingredient.name}</span>
                <span className="food-meta">{ingredient.servingLabel}</span>
              </div>
              <div className="ingredient-controls">
                <button
                  type="button"
                  className="icon-button icon-button-small"
                  aria-label={`Decrease ${ingredient.name}`}
                  onClick={() => updateQuantity(index, ingredient.quantity - 0.25)}
                >
                  <IconMinus size={14} />
                </button>
                <label className="ingredient-quantity">
                  <span className="visually-hidden">{ingredient.name} quantity</span>
                  <input
                    value={ingredient.quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) updateQuantity(index, next);
                    }}
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button icon-button-small"
                  aria-label={`Increase ${ingredient.name}`}
                  onClick={() => updateQuantity(index, ingredient.quantity + 0.25)}
                >
                  <IconPlus size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${ingredient.name}`}
                  onClick={() => removeIngredient(index)}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">Search above to add the first ingredient.</p>
      )}

      {ingredients.length > 0 ? (
        <div className="recipe-totals">
          <div>
            <span>Per serving</span>
            <strong>{formatNumber(perServing.kcal)} kcal</strong>
          </div>
          <div>
            <span>Whole batch</span>
            <strong>{formatNumber(totals.kcal)} kcal</strong>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span className="field-label">Method (optional)</span>
        <textarea
          className="textarea"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={'One step per line\nCook the rice\nSear the chicken…'}
          rows={5}
        />
        <span className="field-hint">Shown when you open the recipe later.</span>
      </label>

      {error ? <p className="field-error" role="alert">{error}</p> : null}

      <button type="submit" className="btn btn-primary btn-block">
        {submitLabel}
      </button>
    </form>
  );
}
