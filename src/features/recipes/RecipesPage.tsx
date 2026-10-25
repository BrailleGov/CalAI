import { useMemo, useState } from 'react';
import type { Meal, Recipe } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { CURATED_RECIPES } from '../../data/curatedRecipes';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { RecipeForm } from './RecipeForm';
import type { RecipeFormValues } from './RecipeForm';
import { createId } from '../../lib/id';
import { formatDecimal, formatNumber } from '../../lib/format';
import { muscleFocusSummary } from '../../lib/preferences';
import { recipePerServing, recipeToFood, recipeTotals } from '../../lib/recipes';
import { todayKey } from '../../lib/dates';
import {
  AI_CONFIGURED,
  AiError,
  generateRecipe,
  suggestRecipes
} from '../../lib/ai';
import type { AiRecipeDraft } from '../../lib/ai';
import {
  IconBook,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconTrash
} from '../../components/icons';

type Tab = 'mine' | 'discover';

function dietTag(value: string): string | null {
  if (value === 'vegan') return 'Vegan';
  if (value === 'vegetarian') return 'Vegetarian';
  if (value === 'pescatarian') return 'Pescatarian';
  return null;
}

function matchesAvoidList(recipe: Recipe, avoid: string[]): boolean {
  if (avoid.length === 0) return false;
  const text = `${recipe.name} ${recipe.ingredients.map((item) => item.name).join(' ')}`.toLowerCase();
  return avoid.some((term) => term.trim() && text.includes(term.trim().toLowerCase()));
}

function personalizedScore(
  recipe: Recipe,
  diet: string | null,
  cuisines: string[],
  quick: boolean
): number {
  let score = 0;
  const tags = (recipe.tags ?? []).map((tag) => tag.toLowerCase());
  if (diet && tags.includes(diet.toLowerCase())) score += 4;
  for (const cuisine of cuisines) {
    if (tags.some((tag) => tag.includes(cuisine.toLowerCase().split(' ')[0] ?? ''))) {
      score += 2;
    }
  }
  if (quick && tags.includes('quick meals')) score += 1;
  return score;
}

export function RecipesPage() {
  const recipes = useAppStore((state) => state.recipes);
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const addRecipe = useAppStore((state) => state.addRecipe);
  const updateRecipe = useAppStore((state) => state.updateRecipe);
  const deleteRecipe = useAppStore((state) => state.deleteRecipe);
  const logFood = useAppStore((state) => state.logFood);
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('mine');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [logging, setLogging] = useState<Recipe | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal>('dinner');
  const [servings, setServings] = useState('1');
  const [logError, setLogError] = useState('');
  const [tagFilter, setTagFilter] = useState('All');

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiServings, setAiServings] = useState('2');
  const [aiMinutes, setAiMinutes] = useState('30');
  const [aiMeal, setAiMeal] = useState<Meal | ''>('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDraft, setAiDraft] = useState<AiRecipeDraft | null>(null);
  const [aiName, setAiName] = useState('');
  const [aiDraftServings, setAiDraftServings] = useState('2');
  const [picks, setPicks] = useState<{ id: string; reason: string }[]>([]);
  const [pickNote, setPickNote] = useState('');
  const [picksBusy, setPicksBusy] = useState(false);
  const [picksError, setPicksError] = useState('');

  const logPerServing = useMemo(
    () => (logging ? recipePerServing(logging) : null),
    [logging]
  );
  const logQuantity = Number(servings);
  const validLogQuantity =
    Number.isFinite(logQuantity) && logQuantity > 0 && logQuantity <= 100;

  const diet = dietTag(preferences.diet);
  const avoid = preferences.avoidIngredients;
  const pickRank = useMemo(
    () => new Map(picks.map((pick, index) => [pick.id, index])),
    [picks]
  );
  const pickReasons = useMemo(
    () => new Map(picks.map((pick) => [pick.id, pick.reason])),
    [picks]
  );
  const curatedTags = useMemo(
    () => ['All', ...new Set(CURATED_RECIPES.flatMap((recipe) => recipe.tags ?? []))],
    []
  );
  const curated = useMemo(
    () =>
      CURATED_RECIPES.filter((recipe) => !matchesAvoidList(recipe, avoid))
        .filter((recipe) => tagFilter === 'All' || (recipe.tags ?? []).includes(tagFilter))
        .sort((a, b) => {
          const rankA = pickRank.get(a.id);
          const rankB = pickRank.get(b.id);
          if (rankA !== undefined || rankB !== undefined) {
            return (rankA ?? 999) - (rankB ?? 999);
          }
          return (
            personalizedScore(b, diet, preferences.cuisines, preferences.trackingStyle === 'quick') -
            personalizedScore(a, diet, preferences.cuisines, preferences.trackingStyle === 'quick')
          );
        }),
    [avoid, diet, pickRank, preferences.cuisines, preferences.trackingStyle, tagFilter]
  );

  function handleCreate(values: RecipeFormValues) {
    const now = Date.now();
    addRecipe({
      id: createId(),
      ...values,
      source: 'user',
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
    setViewing(null);
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

  function saveCurated(recipe: Recipe, logAfter: boolean) {
    const now = Date.now();
    const copy: Recipe = {
      ...recipe,
      id: createId(),
      source: 'user',
      createdAt: now,
      updatedAt: now,
      ingredients: recipe.ingredients.map((item) => ({
        ...item,
        nutrients: { ...item.nutrients }
      })),
      ...(recipe.instructions ? { instructions: [...recipe.instructions] } : {}),
      ...(recipe.tags ? { tags: [...recipe.tags] } : {})
    };
    addRecipe(copy);
    setViewing(null);
    setTab('mine');
    toast('Recipe saved to your book');
    if (logAfter) openLog(copy);
  }

  function resetAi() {
    setAiDraft(null);
    setAiError('');
    setAiBusy(false);
  }

  async function handleGenerate() {
    if (!AI_CONFIGURED) {
      setAiError('Recipe generation needs the CalAI service. Deploy the Worker and set VITE_API_BASE.');
      return;
    }
    if (preferences.aiConsentAt === null) {
      setAiError('Enable AI consent before generating a recipe.');
      return;
    }
    if (aiPrompt.trim().length < 3) {
      setAiError('Add a few ingredients or a craving first.');
      return;
    }

    setAiBusy(true);
    setAiError('');
    setAiDraft(null);

    try {
      const draft = await generateRecipe({
        prompt: aiPrompt,
        servings: Number(aiServings) || 2,
        maxMinutes: Number(aiMinutes) || 30,
        ...(aiMeal ? { meal: aiMeal } : {}),
        trainingFocus: muscleFocusSummary(profile),
        preferences
      });
      setAiDraft(draft);
      setAiName(draft.name);
      setAiDraftServings(String(draft.servings));
    } catch (errorValue) {
      setAiError(
        errorValue instanceof AiError
          ? errorValue.message
          : 'The recipe could not be generated. Try again.'
      );
    } finally {
      setAiBusy(false);
    }
  }

  function handleSaveAi(logAfter: boolean) {
    if (!aiDraft) return;
    const servingsValue = Number(aiDraftServings);
    if (!aiName.trim() || !Number.isFinite(servingsValue) || servingsValue < 0.25) {
      setAiError('Give the recipe a name and at least 0.25 servings.');
      return;
    }

    const now = Date.now();
    const recipe: Recipe = {
      id: createId(),
      name: aiName.trim(),
      description: aiDraft.description,
      servings: servingsValue,
      tags: aiDraft.tags,
      instructions: aiDraft.instructions,
      source: 'ai',
      ingredients: aiDraft.ingredients.map((item) => ({
        name: item.name,
        servingLabel: item.grams ? `${formatNumber(item.grams)} g` : item.quantityLabel || 'portion',
        quantity: 1,
        nutrients: {
          kcal: item.kcal,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat
        }
      })),
      createdAt: now,
      updatedAt: now
    };

    addRecipe(recipe);
    setAiOpen(false);
    setTab('mine');
    resetAi();
    toast('AI recipe saved — review the estimates');
    if (logAfter) openLog(recipe);
  }

  function handleOpenAi() {
    resetAi();
    setAiPrompt('');
    setAiServings('2');
    setAiMinutes('30');
    setAiMeal('');
    setAiOpen(true);
  }

  async function handlePersonalize() {
    if (!AI_CONFIGURED) {
      setPicksError('Personalized picks need the CalAI service.');
      return;
    }
    if (preferences.aiConsentAt === null) {
      setPicksError('Enable AI consent before asking for personalized picks.');
      return;
    }

    setPicksBusy(true);
    setPicksError('');
    setPickNote('');
    try {
      const result = await suggestRecipes(
        CURATED_RECIPES.filter((recipe) => !matchesAvoidList(recipe, avoid)).map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description ?? '',
          tags: recipe.tags ?? []
        })),
        preferences
      );
      setPicks(result.picks);
      setPickNote(result.note);
    } catch (errorValue) {
      setPicksError(
        errorValue instanceof AiError
          ? errorValue.message
          : 'Personalized picks are unavailable. Browse the book instead.'
      );
    } finally {
      setPicksBusy(false);
    }
  }

  function renderRecipeCard(recipe: Recipe, curatedRecipe = false, reason?: string) {
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
              {curatedRecipe ? ' · CalAI recipe book' : ''}
            </p>
            {recipe.description ? (
              <p className="recipe-description">{recipe.description}</p>
            ) : null}
            {reason ? <p className="ai-match">Picked for you: {reason}</p> : null}
          </div>
          {!curatedRecipe ? (
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
          ) : null}
        </div>

        {recipe.tags?.length ? (
          <div className="tag-row">
            {recipe.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

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

        <div className="recipe-card-actions">
          {recipe.instructions?.length ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setViewing(recipe)}
            >
              View recipe
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openLog(recipe)}
          >
            Log a serving
          </button>
        </div>

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
  }

  const viewingSaved = viewing
    ? recipes.some((recipe) => recipe.name === viewing.name)
    : false;

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
          Build a batch from foods you already trust, browse the small CalAI recipe book, or ask
          for an idea that matches your preferences.
        </p>
      </header>

      <div className="segmented recipe-tabs" role="tablist" aria-label="Recipe views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => setTab('mine')}
        >
          My recipes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'discover'}
          className={tab === 'discover' ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => setTab('discover')}
        >
          Discover
        </button>
      </div>

      {tab === 'mine' ? (
        recipes.length === 0 ? (
          <div className="card empty-card">
            <IconBook size={22} />
            <h2>No recipes yet</h2>
            <p>
              Combine ingredients into a meal you cook often. A recipe works offline and can be
              logged from any meal.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                Create a recipe
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTab('discover')}
              >
                Browse the book
              </button>
            </div>
          </div>
        ) : (
          <ul className="recipe-list">
            {recipes.map((recipe) => renderRecipeCard(recipe))}
          </ul>
        )
      ) : (
        <>
          <div className="discover-head">
            <div className="chip-row">
              {curatedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip${tagFilter === tag ? ' is-active' : ''}`}
                  aria-pressed={tagFilter === tag}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            {preferences.recipeIdeas ? (
              <div className="discover-actions">
                {AI_CONFIGURED ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    disabled={picksBusy || preferences.aiConsentAt === null}
                    onClick={() => void handlePersonalize()}
                  >
                    <IconSparkles size={15} /> {picksBusy ? 'Picking…' : 'Personalize'}
                  </button>
                ) : null}
                <button type="button" className="btn btn-ghost btn-small" onClick={handleOpenAi}>
                  <IconSparkles size={16} /> AI recipe
                </button>
              </div>
            ) : null}
          </div>

          {preferences.recipeIdeas && preferences.aiConsentAt === null && AI_CONFIGURED ? (
            <div className="consent-box compact-consent">
              <span>AI recipes are available after you enable AI consent.</span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => updatePreferences({ aiConsentAt: Date.now() })}
              >
                Enable AI
              </button>
            </div>
          ) : null}

          {pickNote ? <p className="online-note">{pickNote}</p> : null}
          {picksError ? (
            <p className="field-error" role="alert">
              {picksError}
            </p>
          ) : null}

          {curated.length === 0 ? (
            <div className="card empty-card">
              <h2>No recipes match that filter</h2>
              <p>Try another tag. Your avoid list is applied to recipe names and ingredients.</p>
            </div>
          ) : (
            <ul className="recipe-list">
              {curated.map((recipe) =>
                renderRecipeCard(recipe, true, pickReasons.get(recipe.id))
              )}
            </ul>
          )}
          <p className="fine-print">
            Book recipes are built from the same seed foods as the diary, so their nutrition is
            consistent with logging. Values are still estimates.
          </p>
        </>
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
        open={Boolean(viewing)}
        title={viewing?.name ?? 'Recipe'}
        subtitle={
          viewing
            ? `${viewing.servings} ${viewing.servings === 1 ? 'serving' : 'servings'} · ${formatNumber(
                recipePerServing(viewing).kcal
              )} kcal per serving`
            : undefined
        }
        onClose={() => setViewing(null)}
      >
        {viewing ? (
          <>
            {viewing.description ? <p className="page-lede">{viewing.description}</p> : null}
            {viewing.tags?.length ? (
              <div className="tag-row">
                {viewing.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="recipe-numbers">
              <div>
                <span>Per serving</span>
                <strong>{formatNumber(recipePerServing(viewing).kcal)} kcal</strong>
              </div>
              <div>
                <span>Protein</span>
                <strong>{formatNumber(recipePerServing(viewing).protein)} g</strong>
              </div>
              <div>
                <span>Carbs / fat</span>
                <strong>
                  {formatNumber(recipePerServing(viewing).carbs)} /{' '}
                  {formatNumber(recipePerServing(viewing).fat)} g
                </strong>
              </div>
            </div>

            <div className="card-head card-head-flush">
              <h2>Ingredients</h2>
              <span className="card-note">Whole batch</span>
            </div>
            <ul className="ingredient-list static">
              {viewing.ingredients.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <div className="ingredient-main">
                    <span className="food-name">{item.name}</span>
                    <span className="food-meta">
                      {formatDecimal(item.quantity)} × {item.servingLabel}
                    </span>
                  </div>
                  <span className="food-meta">
                    {formatNumber(item.nutrients.kcal * item.quantity)} kcal
                  </span>
                </li>
              ))}
            </ul>

            {viewing.instructions?.length ? (
              <>
                <div className="card-head card-head-flush">
                  <h2>Method</h2>
                </div>
                <ol className="instruction-list">
                  {viewing.instructions.map((step, index) => (
                    <li key={`${step}-${index}`}>{step}</li>
                  ))}
                </ol>
              </>
            ) : null}

            <div className="sheet-actions">
              {!viewingSaved && viewing.source === 'curated' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => saveCurated(viewing, false)}
                  >
                    Save to my recipes
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => saveCurated(viewing, true)}
                  >
                    Save and log
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => openLog(viewing)}
                >
                  Log a serving
                </button>
              )}
            </div>
          </>
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

      <Sheet
        open={aiOpen}
        title="AI recipe idea"
        subtitle="Generated from your preferences, then saved only if you approve"
        onClose={() => {
          setAiOpen(false);
          resetAi();
        }}
      >
        {!AI_CONFIGURED ? (
          <div className="ai-notice" role="status">
            <strong>AI recipes need the CalAI service.</strong>
            <p>
              Deploy the Worker, set <code>VITE_API_BASE</code> and a DeepSeek key, then rebuild.
            </p>
          </div>
        ) : null}

        {AI_CONFIGURED && preferences.aiConsentAt === null ? (
          <div className="consent-box">
            <p>Generating a recipe sends the ingredients you type and your food preferences.</p>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => updatePreferences({ aiConsentAt: Date.now() })}
            >
              Enable AI
            </button>
          </div>
        ) : null}

        <label className="field">
          <span className="field-label">What do you have or want?</span>
          <textarea
            className="textarea"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Chicken, rice, broccoli; something high protein and quick"
            rows={3}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Servings</span>
            <span className="unit-input">
              <input
                value={aiServings}
                onChange={(event) => setAiServings(event.target.value)}
                inputMode="numeric"
              />
              <span className="unit">servings</span>
            </span>
          </label>
          <label className="field">
            <span className="field-label">Max time</span>
            <span className="unit-input">
              <input
                value={aiMinutes}
                onChange={(event) => setAiMinutes(event.target.value)}
                inputMode="numeric"
              />
              <span className="unit">min</span>
            </span>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Meal (optional)</span>
          <select
            className="select"
            value={aiMeal}
            onChange={(event) => setAiMeal(event.target.value as Meal | '')}
          >
            <option value="">Any meal</option>
            {MEALS.map((value) => (
              <option key={value} value={value}>
                {MEAL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <p className="fine-print">
          Uses your diet, cuisines, avoid list, and logging style. AI estimates are not verified
          nutrition.
        </p>

        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={aiBusy || !AI_CONFIGURED || preferences.aiConsentAt === null}
          onClick={handleGenerate}
        >
          <IconSparkles size={16} /> {aiBusy ? 'Generating…' : 'Generate recipe'}
        </button>

        {aiError ? (
          <p className="field-error" role="alert">
            {aiError}
          </p>
        ) : null}

        {aiDraft ? (
          <section className="ai-recipe-preview" aria-label="Generated recipe">
            <label className="field">
              <span className="field-label">Recipe name</span>
              <input value={aiName} onChange={(event) => setAiName(event.target.value)} />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Servings</span>
                <span className="unit-input">
                  <input
                    value={aiDraftServings}
                    onChange={(event) => setAiDraftServings(event.target.value)}
                    inputMode="decimal"
                  />
                  <span className="unit">servings</span>
                </span>
              </label>
              <div className="field">
                <span className="field-label">Time</span>
                <p className="static-value">{aiDraft.timeMinutes} min</p>
              </div>
            </div>

            {aiDraft.tags.length > 0 ? (
              <div className="tag-row">
                {aiDraft.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <ul className="proposal-list">
              {aiDraft.ingredients.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <span className="proposal-main">
                    <strong>{item.name}</strong>
                    <small>
                      {item.grams ? `${formatNumber(item.grams)} g · ` : ''}
                      {formatNumber(item.kcal)} kcal · P {formatNumber(item.protein)} / C{' '}
                      {formatNumber(item.carbs)} / F {formatNumber(item.fat)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>

            <ol className="instruction-list">
              {aiDraft.instructions.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>

            <p className="fine-print">
              {aiDraft.note || 'AI-generated recipe. Review amounts before cooking or logging.'}
            </p>

            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleSaveAi(false)}
              >
                Save recipe
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSaveAi(true)}
              >
                Save and log
              </button>
            </div>
          </section>
        ) : null}
      </Sheet>
    </div>
  );
}
