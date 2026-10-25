import { useMemo, useState } from 'react';
import type { Food } from '../../types';
import { FOOD_SOURCE_LABELS } from '../../types';
import { SEED_FOODS } from '../../data/seedFoods';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { FoodForm } from './FoodForm';
import type { FoodFormValues } from './FoodForm';
import { createId } from '../../lib/id';
import { rankFoods } from '../../lib/search';
import { formatNumber } from '../../lib/format';
import {
  IconPencil,
  IconPlus,
  IconSearch,
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
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const allFoods = useMemo(
    () => [...customFoods, ...remoteFoods, ...SEED_FOODS],
    [customFoods, remoteFoods]
  );
  const results = useMemo(
    () => rankFoods(allFoods, query, favorites, recentFoodIds),
    [allFoods, favorites, query, recentFoodIds]
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search foods…"
          autoComplete="off"
        />
      </label>

      <div className="list-heading">
        <span>{query ? 'Results' : 'All foods'}</span>
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
                  {FOOD_SOURCE_LABELS[food.source] ? (
                    <span className="badge">{FOOD_SOURCE_LABELS[food.source]}</span>
                  ) : null}
                </span>
                <span className="food-meta">
                  {food.servingLabel} · {formatNumber(food.nutrients.kcal)} kcal
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
            Nothing matches “{query}”. Create a custom food to add it to your library.
          </li>
        ) : null}
      </ul>

      <p className="fine-print">
        Star foods to keep them at the top when logging. Logging happens from the Today screen.
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
