import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food, Meal, Nutrients } from '../../types';
import { FOOD_SOURCE_LABELS, MEAL_LABELS } from '../../types';
import { SEED_FOODS } from '../../data/seedFoods';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { FoodForm } from '../foods/FoodForm';
import type { FoodFormValues } from '../foods/FoodForm';
import { AiFoodAssist } from '../foods/AiFoodAssist';
import { createId } from '../../lib/id';
import { formatDecimal, formatNumber } from '../../lib/format';
import { normalizeText, rankFoods } from '../../lib/search';
import { scaleNutrients } from '../../lib/nutrition';
import { recipeToFood } from '../../lib/recipes';
import {
  isRemoteSource,
  lookupBarcode,
  searchRemoteFoods
} from '../../lib/remote';
import type { RemoteSource } from '../../lib/remote';
import { BarcodeScanner } from './BarcodeScanner';
import { FoodDiscoveryList } from '../foods/FoodDiscoveryList';
import { useFoodDiscovery } from '../foods/useFoodDiscovery';
import {
  IconBarcode,
  IconCamera,
  IconChevronLeft,
  IconMinus,
  IconPlus,
  IconSearch
} from '../../components/icons';

type Mode = 'search' | 'portion' | 'quick' | 'custom' | 'barcode';

type AddFoodSheetProps = {
  open: boolean;
  meal: Meal;
  date: string;
  onClose: () => void;
  onOpenAi?: () => void;
};

const PRESETS = [0.5, 1, 1.5, 2];

function preview(nutrients: Nutrients, quantity: number): Nutrients {
  return scaleNutrients(nutrients, quantity);
}

function foodKey(food: Food): string {
  return food.barcode
    ? `barcode:${food.barcode}`
    : `name:${normalizeText(`${food.name} ${food.brand ?? ''}`)}`;
}

function SourceBadge({ food }: { food: Food }) {
  const label = FOOD_SOURCE_LABELS[food.source];
  if (!label) return null;
  return <span className="badge">{label}</span>;
}

export function AddFoodSheet({ open, meal, date, onClose, onOpenAi }: AddFoodSheetProps) {
  const customFoods = useAppStore((state) => state.customFoods);
  const remoteFoods = useAppStore((state) => state.remoteFoods);
  const recipes = useAppStore((state) => state.recipes);
  const favorites = useAppStore((state) => state.favorites);
  const recentFoodIds = useAppStore((state) => state.recentFoodIds);
  const logFood = useAppStore((state) => state.logFood);
  const quickAdd = useAppStore((state) => state.quickAdd);
  const addCustomFood = useAppStore((state) => state.addCustomFood);
  const cacheRemoteFood = useAppStore((state) => state.cacheRemoteFood);
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [quickName, setQuickName] = useState('');
  const [quickKcal, setQuickKcal] = useState('');
  const [quickProtein, setQuickProtein] = useState('');
  const [quickCarbs, setQuickCarbs] = useState('');
  const [quickFat, setQuickFat] = useState('');
  const [error, setError] = useState('');
  const [onlineFoods, setOnlineFoods] = useState<Food[]>([]);
  const [onlineSources, setOnlineSources] = useState<RemoteSource[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [onlineError, setOnlineError] = useState('');
  const [onlineAttempt, setOnlineAttempt] = useState(0);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    barcodeAbortRef.current?.abort();
    setMode('search');
    setQuery('');
    setSelected(null);
    setQuantity('1');
    setQuickName('');
    setQuickKcal('');
    setQuickProtein('');
    setQuickCarbs('');
    setQuickFat('');
    setError('');
    setOnlineFoods([]);
    setOnlineSources([]);
    setOnlineStatus('idle');
    setOnlineError('');
    setBarcodeBusy(false);
    setBarcodeError('');
  }, [open]);

  const recipeFoods = useMemo(() => recipes.map(recipeToFood), [recipes]);
  const allFoods = useMemo(
    () => [...recipeFoods, ...customFoods, ...remoteFoods, ...SEED_FOODS],
    [customFoods, recipeFoods, remoteFoods]
  );
  const foodsById = useMemo(() => new Map(allFoods.map((food) => [food.id, food])), [allFoods]);
  const results = useMemo(
    () => rankFoods(allFoods, query, favorites, recentFoodIds),
    [allFoods, favorites, query, recentFoodIds]
  );
  const recents = useMemo(
    () =>
      recentFoodIds
        .map((id) => foodsById.get(id))
        .filter((food): food is Food => Boolean(food))
        .slice(0, 5),
    [foodsById, recentFoodIds]
  );

  const trimmedQuery = query.trim();
  const discovery = useFoodDiscovery(trimmedQuery, open && mode === 'search');

  useEffect(() => {
    if (!open || mode !== 'search' || trimmedQuery.length < 2) {
      setOnlineFoods([]);
      setOnlineSources([]);
      setOnlineStatus('idle');
      setOnlineError('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setOnlineStatus('loading');
      setOnlineError('');
      searchRemoteFoods(trimmedQuery, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;
          setOnlineFoods(response.foods);
          setOnlineSources(response.sources);
          setOnlineStatus('done');
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          setOnlineStatus('error');
          setOnlineError(
            searchError instanceof Error
              ? searchError.message
              : 'Online search is unavailable.'
          );
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, mode, trimmedQuery, onlineAttempt]);

  const onlineVisible = useMemo(() => {
    const localKeys = new Set(results.map(foodKey));
    return onlineFoods.filter((food) => !localKeys.has(foodKey(food)));
  }, [onlineFoods, results]);

  const discoveryVisible = useMemo(() => {
    const localKeys = new Set(results.map(foodKey));
    return discovery.foods.filter((food) => !localKeys.has(foodKey(food)));
  }, [discovery.foods, results]);

  const quantityValue = Number(quantity);
  const validQuantity = Number.isFinite(quantityValue) && quantityValue > 0 && quantityValue <= 100;
  const portionNutrients = selected && validQuantity ? preview(selected.nutrients, quantityValue) : null;

  const title =
    mode === 'quick'
      ? 'Quick add'
      : mode === 'custom'
        ? 'New food'
        : mode === 'barcode'
          ? 'Scan barcode'
          : `Add to ${MEAL_LABELS[meal]}`;

  function chooseFood(food: Food) {
    if (isRemoteSource(food.source)) cacheRemoteFood(food);
    setSelected(food);
    setQuantity('1');
    setError('');
    setMode('portion');
  }

  function stepQuantity(delta: number) {
    const current = Number(quantity);
    const base = Number.isFinite(current) ? current : 1;
    const next = Math.min(100, Math.max(0.25, Math.round((base + delta) * 4) / 4));
    setQuantity(String(next));
  }

  function handlePortionSubmit() {
    if (!selected || !validQuantity) {
      setError('Enter a serving amount between 0.01 and 100.');
      return;
    }

    logFood({ food: selected, meal, date, quantity: quantityValue });
    toast(`${selected.name} added to ${MEAL_LABELS[meal].toLowerCase()}`);
    onClose();
  }

  function handleQuickSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kcal = Number(quickKcal);
    const protein = Number(quickProtein || 0);
    const carbs = Number(quickCarbs || 0);
    const fat = Number(quickFat || 0);

    if (!Number.isFinite(kcal) || kcal < 0 || kcal > 20000) {
      setError('Enter calories between 0 and 20,000.');
      return;
    }
    if (
      !Number.isFinite(protein) ||
      !Number.isFinite(carbs) ||
      !Number.isFinite(fat) ||
      protein < 0 ||
      carbs < 0 ||
      fat < 0 ||
      protein > 2000 ||
      carbs > 2000 ||
      fat > 2000
    ) {
      setError('Enter valid macros.');
      return;
    }

    quickAdd({
      name: quickName.trim() || 'Quick add',
      meal,
      date,
      nutrients: { kcal, protein, carbs, fat }
    });
    toast('Quick entry added');
    onClose();
  }

  function handleCreateFood(values: FoodFormValues) {
    const food: Food = {
      id: createId(),
      name: values.name,
      servingLabel: values.servingLabel,
      nutrients: values.nutrients,
      source: 'custom',
      createdAt: Date.now()
    };

    addCustomFood(food);
    setSelected(food);
    setQuantity('1');
    setError('');
    setMode('portion');
    toast('Food added to your library');
  }

  function backToSearch() {
    barcodeAbortRef.current?.abort();
    setMode('search');
    setSelected(null);
    setError('');
    setBarcodeBusy(false);
    setBarcodeError('');
  }

  async function handleBarcode(code: string) {
    barcodeAbortRef.current?.abort();
    const controller = new AbortController();
    barcodeAbortRef.current = controller;
    setBarcodeBusy(true);
    setBarcodeError('');

    try {
      const food = await lookupBarcode(code, controller.signal);
      if (controller.signal.aborted) return;
      if (!food) {
        setBarcodeError(`No match for ${code}. Try search or create a custom food.`);
        return;
      }
      toast(`Found ${food.name}`);
      chooseFood(food);
    } catch (lookupError) {
      if (controller.signal.aborted) return;
      setBarcodeError(
        lookupError instanceof Error ? lookupError.message : 'Barcode lookup failed.'
      );
    } finally {
      if (!controller.signal.aborted) setBarcodeBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={title}
      subtitle={
        selected && mode === 'portion'
          ? `${selected.brand ? `${selected.brand} · ` : ''}${selected.servingLabel} · ${formatNumber(selected.nutrients.kcal)} kcal`
          : undefined
      }
      onClose={onClose}
    >
      {mode === 'search' ? (
        <>
          <div className="search-row">
            <label className="search-field">
              <IconSearch size={18} />
              <span className="visually-hidden">Search foods</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search foods…"
                autoComplete="off"
                autoFocus
              />
            </label>
            {onOpenAi ? (
              <button
                type="button"
                className="icon-button scan-button"
                aria-label="Log with AI camera"
                onClick={onOpenAi}
              >
                <IconCamera size={20} />
              </button>
            ) : null}
          </div>

          {recentFoodsSection()}

          <div className="list-heading">
            <span>{query ? 'Saved foods' : 'Common foods'}</span>
            <span>{results.length}</span>
          </div>

          <ul className="food-list">
            {results.map((food) => (
              <li key={food.id}>
                <button type="button" className="food-row" onClick={() => chooseFood(food)}>
                  <span className="food-row-main">
                    <span className="food-name">
                      {food.name}
                      <SourceBadge food={food} />
                    </span>
                    <span className="food-meta">
                      {food.brand ? `${food.brand} · ` : ''}
                      {food.servingLabel} · {formatNumber(food.nutrients.kcal)} kcal
                    </span>
                  </span>
                  <IconPlus size={17} />
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="empty-note">
                No local foods match “{query}”. Online results can still appear below.
              </li>
            ) : null}
          </ul>

          {trimmedQuery.length >= 2 ? (
            <FoodDiscoveryList
              query={trimmedQuery}
              foods={discoveryVisible}
              status={discovery.status}
              note={discovery.note}
              error={discovery.error}
              aiConsent={discovery.aiConsent}
              aiConfigured={discovery.aiConfigured}
              onChoose={chooseFood}
              onRetry={discovery.retry}
            />
          ) : null}

          {trimmedQuery.length >= 2 ? (
            <section className="online-results" aria-label="Online food results">
              <div className="list-heading">
                <span>Online</span>
                <span>
                  {onlineStatus === 'loading'
                    ? 'searching'
                    : onlineStatus === 'done'
                      ? onlineVisible.length
                      : ''}
                </span>
              </div>

              {onlineStatus === 'loading' ? (
                <p className="online-note" role="status">
                  Searching Open Food Facts…
                </p>
              ) : null}

              {onlineStatus === 'error' ? (
                <div className="online-error" role="status">
                  <p>{onlineError} Local foods still work offline.</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => setOnlineAttempt((attempt) => attempt + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {onlineStatus === 'done' ? (
                onlineVisible.length > 0 ? (
                  <ul className="food-list">
                    {onlineVisible.map((food) => (
                      <li key={food.id}>
                        <button
                          type="button"
                          className="food-row"
                          onClick={() => chooseFood(food)}
                        >
                          <span className="food-row-main">
                            <span className="food-name">
                              {food.name}
                              <SourceBadge food={food} />
                            </span>
                            <span className="food-meta">
                              {food.brand ? `${food.brand} · ` : ''}
                              {food.servingLabel} · {formatNumber(food.nutrients.kcal)} kcal
                            </span>
                          </span>
                          <IconPlus size={17} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">
                    No online matches. Try a shorter search or create a custom food.
                  </p>
                )
              ) : null}

              {onlineSources.includes('off') ? (
                <p className="fine-print">
                  Online results from{' '}
                  <a
                    className="text-link"
                    href="https://world.openfoodfacts.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Food Facts
                  </a>{' '}
                  (ODbL). Values are estimates; check the label.
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="sheet-actions sheet-actions-wrap">
            <button type="button" className="btn btn-ghost" onClick={() => setMode('quick')}>
              Quick add
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('custom')}>
              New food
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setBarcodeError('');
                setMode('barcode');
              }}
            >
              <IconBarcode size={16} /> Barcode
            </button>
          </div>
          <p className="fine-print">
            Search is optional and needs a connection. Your diary, recipes, and saved foods
            stay available offline.
          </p>
        </>
      ) : null}

      {mode === 'barcode' ? (
        <>
          <button type="button" className="back-link" onClick={backToSearch}>
            <IconChevronLeft size={16} /> Back to search
          </button>
          <BarcodeScanner busy={barcodeBusy} onDetected={handleBarcode} />
          {barcodeError ? (
            <p className="field-error" role="alert">
              {barcodeError}
            </p>
          ) : null}
        </>
      ) : null}

      {mode === 'portion' && selected ? (
        <>
          <button type="button" className="back-link" onClick={backToSearch}>
            <IconChevronLeft size={16} /> Back to search
          </button>

          <div className="portion-head">
            <div>
              <h3>
                {selected.name} <SourceBadge food={selected} />
              </h3>
              <p>
                {selected.brand ? `${selected.brand} · ` : ''}
                {selected.servingLabel}
              </p>
            </div>
          </div>

          <div className="stepper">
            <button
              type="button"
              className="icon-button"
              onClick={() => stepQuantity(-0.5)}
              aria-label="Decrease servings"
            >
              <IconMinus size={18} />
            </button>
            <label className="stepper-value">
              <span className="visually-hidden">Servings</span>
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
                aria-invalid={!validQuantity}
              />
              <span>× serving</span>
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => stepQuantity(0.5)}
              aria-label="Increase servings"
            >
              <IconPlus size={18} />
            </button>
          </div>

          <div className="preset-row">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset${quantityValue === preset ? ' is-active' : ''}`}
                onClick={() => setQuantity(String(preset))}
              >
                {preset === 0.5 ? '½' : preset === 1.5 ? '1½' : preset}×
              </button>
            ))}
          </div>

          {portionNutrients ? (
            <ul className="preview-grid">
              <li>
                <strong>{formatNumber(portionNutrients.kcal)}</strong>
                <span>kcal</span>
              </li>
              <li>
                <strong>{formatNumber(portionNutrients.protein)}</strong>
                <span>protein</span>
              </li>
              <li>
                <strong>{formatNumber(portionNutrients.carbs)}</strong>
                <span>carbs</span>
              </li>
              <li>
                <strong>{formatNumber(portionNutrients.fat)}</strong>
                <span>fat</span>
              </li>
            </ul>
          ) : null}

          {error ? <p className="field-error" role="alert">{error}</p> : null}

          <button type="button" className="btn btn-primary btn-block" onClick={handlePortionSubmit}>
            Add to {MEAL_LABELS[meal]}
          </button>
        </>
      ) : null}

      {mode === 'quick' ? (
        <>
          <button type="button" className="back-link" onClick={backToSearch}>
            <IconChevronLeft size={16} /> Back to search
          </button>
          <p className="page-lede">
            Log calories and macros without saving a food to your library.
          </p>
          <AiFoodAssist
            onApply={(draft) => {
              setQuickName(draft.name);
              setQuickKcal(String(draft.nutrients.kcal));
              setQuickProtein(String(draft.nutrients.protein));
              setQuickCarbs(String(draft.nutrients.carbs));
              setQuickFat(String(draft.nutrients.fat));
              setError('');
            }}
          />
          <form className="form" onSubmit={handleQuickSubmit} noValidate>
            <label className="field">
              <span className="field-label">Label (optional)</span>
              <input
                value={quickName}
                onChange={(event) => setQuickName(event.target.value)}
                placeholder="Lunch out"
                autoComplete="off"
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Calories</span>
                <span className="unit-input">
                  <input
                    value={quickKcal}
                    onChange={(event) => setQuickKcal(event.target.value)}
                    inputMode="decimal"
                    placeholder="500"
                    autoFocus
                  />
                  <span className="unit">kcal</span>
                </span>
              </label>
              <label className="field">
                <span className="field-label">Protein</span>
                <span className="unit-input">
                  <input
                    value={quickProtein}
                    onChange={(event) => setQuickProtein(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <span className="unit">g</span>
                </span>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Carbs</span>
                <span className="unit-input">
                  <input
                    value={quickCarbs}
                    onChange={(event) => setQuickCarbs(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <span className="unit">g</span>
                </span>
              </label>
              <label className="field">
                <span className="field-label">Fat</span>
                <span className="unit-input">
                  <input
                    value={quickFat}
                    onChange={(event) => setQuickFat(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <span className="unit">g</span>
                </span>
              </label>
            </div>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn-primary btn-block">
              Add to {MEAL_LABELS[meal]}
            </button>
          </form>
        </>
      ) : null}

      {mode === 'custom' ? (
        <>
          <button type="button" className="back-link" onClick={backToSearch}>
            <IconChevronLeft size={16} /> Back to search
          </button>
          <p className="page-lede">
            Nutrition is saved per serving, so you can log multiples later.
          </p>
          <FoodForm submitLabel="Save and choose serving" onSubmit={handleCreateFood} />
        </>
      ) : null}
    </Sheet>
  );

  function recentFoodsSection() {
    if (query || recents.length === 0) return null;

    return (
      <>
        <div className="list-heading">
          <span>Recent</span>
          <span>{recents.length}</span>
        </div>
        <ul className="food-list">
          {recents.map((food) => (
            <li key={food.id}>
              <button type="button" className="food-row" onClick={() => chooseFood(food)}>
                <span className="food-row-main">
                  <span className="food-name">
                    {food.name}
                    <SourceBadge food={food} />
                  </span>
                  <span className="food-meta">
                    {formatDecimal(1)}× · {formatNumber(food.nutrients.kcal)} kcal
                  </span>
                </span>
                <IconPlus size={17} />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }
}
