import { useMemo, useState } from 'react';
import type { Meal, Recipe } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { RecipeForm } from './RecipeForm';
import type { RecipeFormValues } from './RecipeForm';
import { createId } from '../../lib/id';
import { formatDecimal, formatNumber } from '../../lib/format';
import { recipePerServing, recipeToFood, recipeTotals } from '../../lib/recipes';
import { todayKey } from '../../lib/dates';
import {
  IconBook,
  IconPencil,
  IconPlus,
  IconTrash
} from '../../components/icons';

export function RecipesPage() {
  const recipes = useAppStore((state) => state.recipes);
  const addRecipe = useAppStore((state) => state.addRecipe);
  const updateRecipe = useAppStore((state) => state.updateRecipe);
  const deleteRecipe = useAppStore((state) => state.deleteRecipe);
  const logFood = useAppStore((state) => state.logFood);
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [logging, setLogging] = useState<Recipe | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal>('dinner');
  const [servings, setServings] = useState('1');
  const [logError, setLogError] = useState('');

  const logPerServing = useMemo(
    () => (logging ? recipePerServing(logging) : null),
    [logging]
  );
  const logQuantity = Number(servings);
  const validLogQuantity =
    Number.isFinite(logQuantity) && logQuantity > 0 && logQuantity <= 100;

  function handleCreate(values: RecipeFormValues) {
    const now = Date.now();
    addRecipe({
      id: createId(),
      ...values,
      createdAt: now,
      updatedAt: now
    });
    setCreating(false);
    toast('Recipe saved');
  }

  function handleUpdate(values: RecipeFormValues) {
    if (!editing) return;
    updateRecipe({
      ...editing,
      ...values,
      updatedAt: Date.now()
    });
    setEditing(null);
    toast('Recipe updated');
  }

  function handleDelete(id: string) {
    deleteRecipe(id);
    setConfirmingDelete(null);
    setEditing(null);
    toast('Recipe deleted');
  }

  function openLog(recipe: Recipe) {
    setLogging(recipe);
    setServings('1');
    setMeal('dinner');
    setLogError('');
  }

  function handleLog() {
    if (!logging) return;
    if (!validLogQuantity) {
      setLogError('Enter between 0.25 and 100 servings.');
      return;
    }

    logFood({
      food: recipeToFood(logging),
      meal,
      date: todayKey(),
      quantity: logQuantity
    });
    toast(`${logging.name} added to ${MEAL_LABELS[meal].toLowerCase()}`);
    setLogging(null);
  }

  return (
    <div className="page recipes-page">
      <header className="page-head">
        <p className="eyebrow">Cook once</p>
        <div className="page-head-row">
          <h1>Recipes</h1>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setCreating(true)}
          >
            <IconPlus size={16} /> New recipe
          </button>
        </div>
        <p className="page-lede">
          Build a batch from foods you already trust, set how many servings it makes, then
          log a portion in one tap. Past entries keep their own nutrition snapshot.
        </p>
      </header>

      {recipes.length === 0 ? (
        <div className="card empty-card">
          <IconBook size={22} />
          <h2>No recipes yet</h2>
          <p>
            Combine ingredients into a meal you cook often. A recipe works offline and can be
            logged from any meal.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
          >
            Create a recipe
          </button>
        </div>
      ) : (
        <ul className="recipe-list">
          {recipes.map((recipe) => {
            const perServing = recipePerServing(recipe);
            const total = recipeTotals(recipe);
            return (
              <li key={recipe.id} className="card recipe-card">
                <div className="recipe-card-head">
                  <div>
                    <h2>{recipe.name}</h2>
                    <p className="food-meta">
                      {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} ·{' '}
                      {recipe.ingredients.length} ingredients
                    </p>
                  </div>
                  <div className="recipe-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${recipe.name}`}
                      onClick={() => setEditing(recipe)}
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${recipe.name}`}
                      onClick={() => setConfirmingDelete(recipe.id)}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>

                <div className="recipe-numbers">
                  <div>
                    <span>Per serving</span>
                    <strong>{formatNumber(perServing.kcal)} kcal</strong>
                  </div>
                  <div>
                    <span>Whole batch</span>
                    <strong>{formatNumber(total.kcal)} kcal</strong>
                  </div>
                  <div>
                    <span>Protein / serving</span>
                    <strong>{formatNumber(perServing.protein)} g</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => openLog(recipe)}
                >
                  Log a serving
                </button>

                {confirmingDelete === recipe.id ? (
                  <div className="delete-confirm" role="alert">
                    <p>Delete this recipe? Past diary entries are kept.</p>
                    <div className="delete-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        <IconTrash size={15} /> Delete
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="fine-print">
        Recipe values are estimates based on the foods you add. Check labels when precision
        matters.
      </p>

      <Sheet
        open={creating}
        title="New recipe"
        subtitle="Set the batch size and ingredients"
        onClose={() => setCreating(false)}
      >
        <RecipeForm
          key="new-recipe"
          submitLabel="Save recipe"
          onSubmit={handleCreate}
        />
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        title={editing?.name ?? 'Edit recipe'}
        subtitle="Past entries keep their original nutrition"
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <RecipeForm
            key={editing.id}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={handleUpdate}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(logging)}
        title={logging?.name ?? 'Log recipe'}
        subtitle={
          logging && logPerServing
            ? `${formatNumber(logPerServing.kcal)} kcal and ${formatNumber(
                logPerServing.protein
              )} g protein per serving`
            : undefined
        }
        onClose={() => setLogging(null)}
      >
        {logging ? (
          <>
            <fieldset className="field-group">
              <legend className="field-label">Meal</legend>
              <div className="segmented">
                {MEALS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      meal === value ? 'segmented-item is-active' : 'segmented-item'
                    }
                    aria-pressed={meal === value}
                    onClick={() => setMeal(value)}
                  >
                    {MEAL_LABELS[value]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span className="field-label">Servings to log</span>
              <span className="unit-input">
                <input
                  value={servings}
                  onChange={(event) => setServings(event.target.value)}
                  inputMode="decimal"
                  aria-invalid={!validLogQuantity}
                />
                <span className="unit">servings</span>
              </span>
            </label>

            <p className="fine-print">
              Logging {formatDecimal(validLogQuantity ? logQuantity : 1)} ×{' '}
              {formatNumber(logPerServing?.kcal ?? 0)} kcal ={' '}
              {formatNumber((logPerServing?.kcal ?? 0) * (validLogQuantity ? logQuantity : 1))}{' '}
              kcal.
            </p>

            {logError ? (
              <p className="field-error" role="alert">
                {logError}
              </p>
            ) : null}

            <button type="button" className="btn btn-primary btn-block" onClick={handleLog}>
              Add to {MEAL_LABELS[meal]}
            </button>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
