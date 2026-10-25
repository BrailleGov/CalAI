import { useEffect, useMemo, useState } from 'react';
import type { Food, FoodCategory } from '../../types';
import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  foodSourceLabel
} from '../../types';
import { SEED_FOODS } from '../../data/seedFoods';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { FoodForm } from './FoodForm';
import type { FoodFormValues } from './FoodForm';
import { createId } from '../../lib/id';
import { rankFoods } from '../../lib/search';
import { formatNumber } from '../../lib/format';
import { AiConsentInline } from '../../components/AiConsentInline';
import { useFoodDiscovery } from './useFoodDiscovery';
import {
  IconPencil,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconStar,
  IconTrash
} from '../../components/icons';

export function FoodsPage() {
  const customFoods = useAppStore((state) => state.customFoods);
  const remoteFoods = useAppStore((state) => state.remoteFoods);
  const favorites = useAppStore((state) => state.favorites);
  const recentFoodIds = useAppStore((state) => state.recentFoodIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const addCustomFood = useAppStore((state) => state.addCustomFood);
  const updateCustomFood = useAppStore((state) => state.updateCustomFood);
  const deleteCustomFood = useAppStore((state) => state.deleteCustomFood);
  const cacheRemoteFoods = useAppStore((state) => state.cacheRemoteFoods);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | FoodCategory>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [discoverRequested, setDiscoverRequested] = useState(false);
  const discovery = useFoodDiscovery(
    query,
    discoverRequested && query.trim().length >= 2
  );

  useEffect(() => {
    if (discovery.foods.length > 0) {
      cacheRemoteFoods(discovery.foods);
    }
  }, [cacheRemoteFoods, discovery.foods]);

  const allFoods = useMemo(
    () => [...customFoods, ...remoteFoods, ...SEED_FOODS],
    [customFoods, remoteFoods]
  );
  const filteredFoods = useMemo(
    () =>
      category === 'all'
        ? allFoods
        : allFoods.filter((food) => food.category === category),
    [allFoods, category]
  );
  const results = useMemo(
    () => rankFoods(filteredFoods, query, favorites, recentFoodIds, 250),
    [favorites, filteredFoods, query, recentFoodIds]
  );
  const favoriteSet = new Set(favorites);

  function handleCreate(values: FoodFormValues) {
    const food: Food = {
      id: createId(),
      name: values.name,
      servingLabel: values.servingLabel,
      nutrients: values.nutrients,
      source: 'custom',
      createdAt: Date.now()
    };
    addCustomFood(food);
    setCreating(false);
    toast('Food added to your library');
  }

  function handleUpdate(values: FoodFormValues) {
    if (!editing) return;
    updateCustomFood({
      ...editing,
      name: values.name,
      servingLabel: values.servingLabel,
      nutrients: values.nutrients
    });
    setEditing(null);
    toast('Food updated');
  }

  function handleDelete() {
    if (!editing) return;
    deleteCustomFood(editing.id);
    setEditing(null);
    setConfirmingDelete(false);
    toast('Food deleted');
  }

  return (
    <div className="page foods-page">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <div className="page-head-row">
          <h1>Foods</h1>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setCreating(true)}
          >
            <IconPlus size={16} /> New food
          </button>
        </div>
        <p className="page-lede">
          Common foods work offline. Foods you log from online search are saved here too.
          Custom foods can be edited at any time.
        </p>
      </header>

      <label className="search-field">
        <IconSearch size={18} />
        <span className="visually-hidden">Search the food library</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDiscoverRequested(false);
          }}
          placeholder="Search foods…"
          autoComplete="off"
        />
      </label>

      {query.trim().length >= 2 && discovery.aiConfigured ? (
        <div className="discovery-bar">
          {!discovery.aiConsent ? (
            <AiConsentInline
              action="Enable AI food search"
              message="AI can add more foods to the shared library from your search words."
              onEnabled={() => setDiscoverRequested(true)}
            />
          ) : discovery.status === 'idle' ? (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setDiscoverRequested(true)}
            >
              <IconSparkles size={15} /> Find more with AI
            </button>
          ) : null}

          {discovery.status === 'searching' || discovery.status === 'finding' ? (
            <p className="finding-status" role="status">
              <span className="finding-dot" aria-hidden="true" />
              {discovery.status === 'finding'
                ? 'AI is adding more foods to the shared library…'
                : 'Finding shared foods…'}
            </p>
          ) : null}

          {discovery.status === 'error' ? (
            <div className="online-error" role="status">
              <p>{discovery.error}</p>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={discovery.retry}
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="chip-row category-chips" aria-label="Food categories">
        <button
          type="button"
          className={`chip${category === 'all' ? ' is-active' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {FOOD_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip${category === value ? ' is-active' : ''}`}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {FOOD_CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="list-heading">
        <span>
          {query
            ? 'Results'
            : category === 'all'
              ? 'All foods'
              : FOOD_CATEGORY_LABELS[category]}
        </span>
        <span>{results.length}</span>
      </div>

      <ul className="library-list">
        {results.map((food) => {
          const favorite = favoriteSet.has(food.id);
          return (
            <li key={food.id} className="library-row">
              <div className="food-row-main">
                <span className="food-name">
                  {food.name}
                  {foodSourceLabel(food) ? (
                    <span className="badge">{foodSourceLabel(food)}</span>
                  ) : null}
                </span>
                <span className="food-meta">
                  {food.servingLabel} · {formatNumber(food.nutrients.kcal)} kcal
                  {food.category ? ` · ${FOOD_CATEGORY_LABELS[food.category]}` : ''}
                </span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className={`icon-button${favorite ? ' is-favorite' : ''}`}
                  onClick={() => toggleFavorite(food.id)}
                  aria-label={
                    favorite
                      ? `Remove ${food.name} from favorites`
                      : `Add ${food.name} to favorites`
                  }
                  aria-pressed={favorite}
                >
                  <IconStar size={17} filled={favorite} />
                </button>
                {food.source === 'custom' ? (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setEditing(food);
                      setConfirmingDelete(false);
                    }}
                    aria-label={`Edit ${food.name}`}
                  >
                    <IconPencil size={16} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {results.length === 0 ? (
          <li className="empty-note">
            Nothing matches “{query}” in this category. Create a custom food or choose another
            category.
          </li>
        ) : null}
      </ul>

      <p className="fine-print">
        Star foods to keep them at the top when logging. Seed values are rounded public nutrition
        references; check the label when precision matters.
      </p>

      <Sheet
        open={creating}
        title="New food"
        subtitle="Nutrition per serving"
        onClose={() => setCreating(false)}
      >
        <FoodForm
          key="create-food"
          submitLabel="Add to library"
          onSubmit={handleCreate}
        />
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        title={editing ? editing.name : 'Edit food'}
        subtitle="Changes do not rewrite past diary entries"
        onClose={() => {
          setEditing(null);
          setConfirmingDelete(false);
        }}
      >
        {editing ? (
          <>
            <FoodForm
              key={editing.id}
              initial={editing}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
            />
            {confirmingDelete ? (
              <div className="delete-confirm" role="alert">
                <p>Delete this food from your library?</p>
                <div className="delete-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDelete}>
                    <IconTrash size={15} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-quiet btn-block"
                onClick={() => setConfirmingDelete(true)}
              >
                <IconTrash size={15} /> Delete food
              </button>
            )}
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
