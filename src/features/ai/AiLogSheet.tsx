import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food, Meal, Nutrients } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { SEED_FOODS } from '../../data/seedFoods';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { Sheet } from '../../components/Sheet';
import { ToggleRow } from '../../components/ToggleRow';
import { PhotoSourcePicker } from '../../components/PhotoSourcePicker';
import { createId } from '../../lib/id';
import { formatDecimal, formatNumber } from '../../lib/format';
import { normalizeText } from '../../lib/search';
import { scaleNutrients } from '../../lib/nutrition';
import { parseFoodTextLocally } from '../../lib/nl';
import {
  AI_CONFIGURED,
  AiError,
  analyzeMealPhoto,
  parseMealText
} from '../../lib/ai';
import type { AiFoodItem } from '../../lib/ai';
import {
  IconCamera,
  IconChevronLeft,
  IconSearch,
  IconSparkles,
  IconTrash
} from '../../components/icons';

type Mode = 'photo' | 'text';

type DraftItem = {
  key: string;
  name: string;
  amountKind: 'grams' | 'servings';
  amount: string;
  baseAmount: number;
  nutrients: Nutrients;
  confidence: number;
  selected: boolean;
  note?: string;
  matched?: Food;
  source: 'ai' | 'local';
};

type AiLogSheetProps = {
  open: boolean;
  meal: Meal;
  date: string;
  initialMode?: Mode;
  onClose: () => void;
  onManualSearch?: () => void;
};

const MATCH_STOP = new Set(['and', 'with', 'the', 'a', 'an', 'of']);

function itemTokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !MATCH_STOP.has(token));
}

function findLibraryMatch(name: string, foods: Food[]): Food | undefined {
  const query = itemTokens(name);
  if (query.length === 0) return undefined;
  let best: Food | undefined;
  let bestScore = 0;

  for (const food of foods) {
    const haystack = new Set(itemTokens(`${food.name} ${food.brand ?? ''}`));
    if (haystack.size === 0) continue;
    const hits = query.filter((token) => haystack.has(token)).length;
    const score = hits / query.length;
    if (score > bestScore) {
      best = food;
      bestScore = score;
    }
  }

  return bestScore >= 0.6 ? best : undefined;
}

function toDraft(item: AiFoodItem, foods: Food[]): DraftItem {
  const hasGrams = item.grams !== null && item.grams > 0;
  return {
    key: createId(),
    name: item.name,
    amountKind: hasGrams ? 'grams' : 'servings',
    amount: hasGrams ? String(item.grams) : '1',
    baseAmount: hasGrams ? (item.grams as number) : 1,
    nutrients: {
      kcal: item.kcal,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat
    },
    confidence: item.confidence,
    selected: true,
    ...(item.notes ? { note: item.notes } : {}),
    matched: findLibraryMatch(item.name, foods),
    source: 'ai'
  };
}

function scaled(item: DraftItem): Nutrients {
  const amount = Number(item.amount);
  const factor =
    Number.isFinite(amount) && amount > 0 && item.baseAmount > 0
      ? amount / item.baseAmount
      : 1;
  return scaleNutrients(item.nutrients, factor);
}

function confidenceLabel(value: number): string {
  if (value >= 0.7) return 'High';
  if (value >= 0.5) return 'Medium';
  return 'Low';
}

export function AiLogSheet({
  open,
  meal: initialMeal,
  date,
  initialMode = 'photo',
  onClose,
  onManualSearch
}: AiLogSheetProps) {
  const preferences = useAppStore((state) => state.preferences);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const customFoods = useAppStore((state) => state.customFoods);
  const remoteFoods = useAppStore((state) => state.remoteFoods);
  const addCustomFood = useAppStore((state) => state.addCustomFood);
  const quickAdd = useAppStore((state) => state.quickAdd);
  const logFood = useAppStore((state) => state.logFood);
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [consentChecked, setConsentChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const aiConsent = preferences.aiConsentAt !== null;
  const canUseAi = AI_CONFIGURED && aiConsent;
  const allFoods = useMemo(
    () => [...customFoods, ...remoteFoods, ...SEED_FOODS],
    [customFoods, remoteFoods]
  );

  useEffect(() => {
    if (!open) return;
    abortRef.current?.abort();
    setMode(initialMode);
    setMeal(initialMeal);
    setConsentChecked(false);
    setFile(null);
    setPreviewUrl('');
    setText('');
    setStatus('idle');
    setError('');
    setNote('');
    setUncertain(false);
    setDrafts([]);
    setSaveToLibrary(false);
    setSubmitError('');
  }, [initialMeal, initialMode, open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function resetResults() {
    setDrafts([]);
    setNote('');
    setUncertain(false);
    setStatus('idle');
    setError('');
    setSubmitError('');
  }

  function handleModeChange(next: Mode) {
    if (next === mode) return;
    abortRef.current?.abort();
    resetResults();
    setMode(next);
  }

  function applyAiResult(result: {
    items: AiFoodItem[];
    note: string;
    uncertain: boolean;
  }) {
    setDrafts(result.items.map((item) => toDraft(item, allFoods)));
    setNote(result.note);
    setUncertain(result.uncertain);
    setStatus('done');
  }

  function aiError(errorValue: unknown) {
    setStatus('error');
    setError(
      errorValue instanceof AiError
        ? errorValue.message
        : 'That photo could not be analysed. Try again or use manual search.'
    );
  }

  async function handleAnalyzePhoto() {
    if (!file) {
      setError('Choose or take a photo first.');
      return;
    }
    if (!canUseAi) {
      setError('Enable AI in the notice above to analyse a photo.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError('');
    setSubmitError('');

    try {
      const result = await analyzeMealPhoto(file, { signal: controller.signal });
      if (!controller.signal.aborted) applyAiResult(result);
    } catch (errorValue) {
      if (!controller.signal.aborted) aiError(errorValue);
    }
  }

  async function handleParseText(withAi: boolean) {
    if (text.trim().length < 2) {
      setError('Describe what you ate in a few words.');
      return;
    }
    setSubmitError('');

    if (!withAi) {
      const result = parseFoodTextLocally(text, allFoods);
      if (result.items.length === 0) {
        setStatus('error');
        setError(
          result.unmatched.length > 0
            ? `No library match for ${result.unmatched.join(', ')}. Try different words or use manual search.`
            : 'No foods were recognised. Try naming the items.'
        );
        return;
      }
      setDrafts(
        result.items.map((item) => ({
          key: createId(),
          name: item.food.name,
          amountKind: 'servings',
          amount: String(item.quantity),
          baseAmount: item.quantity,
          nutrients: { ...item.food.nutrients },
          confidence: item.confidence,
          selected: true,
          matched: item.food,
          source: 'local'
        }))
      );
      setNote(
        result.unmatched.length > 0
          ? `Not matched: ${result.unmatched.join(', ')}. Add those manually if needed.`
          : 'Matched against foods already in your library.'
      );
      setUncertain(false);
      setStatus('done');
      return;
    }

    if (!canUseAi) {
      setError('Enable AI in the notice above, or use offline matching.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError('');

    try {
      const result = await parseMealText(text, { signal: controller.signal });
      if (!controller.signal.aborted) applyAiResult(result);
    } catch (errorValue) {
      if (!controller.signal.aborted) aiError(errorValue);
    }
  }

  function updateDraft(key: string, patch: Partial<DraftItem>) {
    setDrafts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function updateScaledNutrient(key: string, nutrient: keyof Nutrients, value: number) {
    setDrafts((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const amount = Number(item.amount);
        const factor =
          Number.isFinite(amount) && amount > 0 && item.baseAmount > 0
            ? amount / item.baseAmount
            : 1;
        return {
          ...item,
          nutrients: {
            ...item.nutrients,
            [nutrient]: factor > 0 ? Math.max(0, value) / factor : Math.max(0, value)
          }
        };
      })
    );
  }

  function useLibraryValues(key: string) {
    setDrafts((current) =>
      current.map((item) => {
        if (item.key !== key || !item.matched?.servingGrams) return item;
        const grams = Number(item.amount);
        if (!Number.isFinite(grams) || grams <= 0) return item;
        return {
          ...item,
          baseAmount: item.matched.servingGrams,
          amountKind: 'grams',
          amount: String(grams),
          nutrients: { ...item.matched.nutrients },
          confidence: Math.max(item.confidence, 0.8)
        };
      })
    );
    toast('Using the library value for this item');
  }

  function handleLog() {
    const selected = drafts.filter((item) => item.selected);
    if (selected.length === 0) {
      setSubmitError('Select at least one item.');
      return;
    }

    for (const item of selected) {
      const amount = Number(item.amount);
      if (!item.name.trim()) {
        setSubmitError('Every item needs a name.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setSubmitError('Every item needs a portion above zero.');
        return;
      }
    }

    for (const item of selected) {
      const nutrients = scaled(item);
      const amount = Number(item.amount);
      const servingLabel =
        item.amountKind === 'grams'
          ? `${formatNumber(amount)} g (estimate)`
          : `${formatDecimal(amount)} × ${item.matched?.servingLabel ?? 'serving'}`;

      if (saveToLibrary) {
        const food: Food = {
          id: createId(),
          name: item.name.trim(),
          servingLabel,
          nutrients,
          source: 'custom',
          createdAt: Date.now()
        };
        addCustomFood(food);
        logFood({ food, meal, date, quantity: 1 });
      } else {
        quickAdd({
          name: item.name.trim(),
          meal,
          date,
          nutrients,
          servingLabel
        });
      }
    }

    toast(
      `${selected.length} ${selected.length === 1 ? 'item' : 'items'} added to ${MEAL_LABELS[
        meal
      ].toLowerCase()}`
    );
    onClose();
  }

  const selectedCount = drafts.filter((item) => item.selected).length;
  const totalKcal = drafts
    .filter((item) => item.selected)
    .reduce((total, item) => total + scaled(item).kcal, 0);

  return (
    <Sheet
      open={open}
      title="Log with AI"
      subtitle="Review and edit every estimate before it is saved"
      onClose={onClose}
    >
      <div className="segmented ai-tabs" role="tablist" aria-label="AI logging mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'photo'}
          className={mode === 'photo' ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => handleModeChange('photo')}
        >
          <IconCamera size={16} /> Photo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'text'}
          className={mode === 'text' ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => handleModeChange('text')}
        >
          <IconSparkles size={16} /> Describe
        </button>
      </div>

      {onManualSearch ? (
        <button type="button" className="back-link manual-search-link" onClick={onManualSearch}>
          <IconSearch size={15} /> Search or scan a barcode instead
        </button>
      ) : null}

      {!AI_CONFIGURED ? (
        <div className="ai-notice" role="status">
          <strong>AI is not configured in this build.</strong>
          <p>
            Deploy the CalAI Worker and set <code>VITE_API_BASE</code> to turn on photo
            recognition and AI text parsing. Offline description matching still works below.
          </p>
        </div>
      ) : null}

      {AI_CONFIGURED && !aiConsent ? (
        <div className="consent-box">
          <p>
            AI can be wrong about foods and portions. Photos and text are only sent when you
            press an AI button, and they are not stored by CalAI.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            <span>I agree to send this meal to CalAI's AI provider for an estimate.</span>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={!consentChecked}
            onClick={() => {
              updatePreferences({ aiConsentAt: Date.now() });
              toast('AI enabled');
            }}
          >
            Enable AI
          </button>
        </div>
      ) : null}

      <fieldset className="field-group">
        <legend className="field-label">Meal</legend>
        <div className="segmented segmented-small">
          {MEALS.map((value) => (
            <button
              key={value}
              type="button"
              className={meal === value ? 'segmented-item is-active' : 'segmented-item'}
              aria-pressed={meal === value}
              onClick={() => setMeal(value)}
            >
              {MEAL_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      {mode === 'photo' ? (
        <section className="ai-photo" aria-label="Meal photo">
          {previewUrl ? (
            <div className="ai-preview">
              <img src={previewUrl} alt="Selected meal" />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove photo"
                onClick={() => {
                  setFile(null);
                  resetResults();
                }}
              >
                <IconTrash size={16} />
              </button>
            </div>
          ) : (
            <PhotoSourcePicker
              disabled={status === 'loading'}
              onSelect={(chosen) => {
                setFile(chosen);
                resetResults();
              }}
            />
          )}

          <div className="ai-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={status === 'loading' || !file}
              onClick={handleAnalyzePhoto}
            >
              {status === 'loading' ? 'Analysing…' : 'Analyse photo'}
            </button>
            {file ? (
              <PhotoSourcePicker
                variant="button"
                label="Change photo"
                disabled={status === 'loading'}
                onSelect={(chosen) => {
                  setFile(chosen);
                  resetResults();
                }}
              />
            ) : null}
          </div>
          <p className="fine-print">
            AI recognises visible items and estimates portions. Mixed dishes and hidden oils are
            uncertain; the values are not exact.
          </p>
        </section>
      ) : (
        <section aria-label="Describe your meal">
          <label className="field">
            <span className="field-label">What did you eat?</span>
            <textarea
              className="textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Two eggs, toast with butter, and a coffee"
              rows={3}
            />
          </label>
          <div className="ai-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={status === 'loading'}
              onClick={() => handleParseText(canUseAi)}
            >
              {status === 'loading'
                ? 'Parsing…'
                : canUseAi
                  ? 'Parse with AI'
                  : 'Match my foods'}
            </button>
            {canUseAi ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={status === 'loading'}
                onClick={() => handleParseText(false)}
              >
                Match offline
              </button>
            ) : null}
          </div>
          <p className="fine-print">
            Offline matching only uses foods already in your library. AI parsing can split
            multi-item meals and estimate portions.
          </p>
        </section>
      )}

      {status === 'loading' ? (
        <p className="ai-status" role="status">
          Working on it. This can take a few seconds.
        </p>
      ) : null}

      {error ? (
        <div className="online-error" role="alert">
          <p>{error}</p>
          {onManualSearch ? (
            <button type="button" className="btn btn-ghost btn-small" onClick={onManualSearch}>
              Use manual search
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'done' && drafts.length > 0 ? (
        <section className="ai-results" aria-label="Recognised foods">
          <div className="list-heading">
            <span>Review estimates</span>
            <span>
              {selectedCount} selected · ~{formatNumber(totalKcal)} kcal
            </span>
          </div>

          {uncertain ? (
            <p className="ai-warning" role="status">
              Some items are uncertain. Check names, portions, and oil or sauce that may be
              hidden.
            </p>
          ) : null}
          {note ? <p className="online-note">{note}</p> : null}

          <ul className="ai-item-list">
            {drafts.map((item) => {
              const nutrients = scaled(item);
              return (
                <li key={item.key} className="ai-item">
                  <div className="ai-item-head">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(event) =>
                          updateDraft(item.key, { selected: event.target.checked })
                        }
                        aria-label={`Include ${item.name}`}
                      />
                      <input
                        className="ai-item-name"
                        value={item.name}
                        onChange={(event) =>
                          updateDraft(item.key, { name: event.target.value })
                        }
                        aria-label="Food name"
                      />
                    </label>
                    <span
                      className={`confidence confidence-${confidenceLabel(
                        item.confidence
                      ).toLowerCase()}`}
                    >
                      {confidenceLabel(item.confidence)} confidence
                    </span>
                  </div>

                  <div className="ai-item-controls">
                    <label className="unit-input">
                      <span className="visually-hidden">Portion</span>
                      <input
                        value={item.amount}
                        onChange={(event) =>
                          updateDraft(item.key, { amount: event.target.value })
                        }
                        inputMode="decimal"
                        aria-label={`${item.name} portion`}
                      />
                      <span className="unit">
                        {item.amountKind === 'grams' ? 'g' : '× serving'}
                      </span>
                    </label>
                    {item.matched?.servingGrams && item.source === 'ai' ? (
                      <button
                        type="button"
                        className="btn btn-quiet btn-small"
                        onClick={() => useLibraryValues(item.key)}
                      >
                        Use library value
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter((draft) => draft.key !== item.key)
                        )
                      }
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>

                  <div className="ai-nutrient-grid">
                    <label>
                      <span>kcal</span>
                      <input
                        value={formatNumber(nutrients.kcal)}
                        onChange={(event) =>
                          updateScaledNutrient(
                            item.key,
                            'kcal',
                            Number(event.target.value) || 0
                          )
                        }
                        inputMode="numeric"
                        aria-label={`${item.name} calories`}
                      />
                    </label>
                    <label>
                      <span>protein</span>
                      <input
                        value={formatDecimal(nutrients.protein)}
                        onChange={(event) =>
                          updateScaledNutrient(
                            item.key,
                            'protein',
                            Number(event.target.value) || 0
                          )
                        }
                        inputMode="decimal"
                        aria-label={`${item.name} protein`}
                      />
                    </label>
                    <label>
                      <span>carbs</span>
                      <input
                        value={formatDecimal(nutrients.carbs)}
                        onChange={(event) =>
                          updateScaledNutrient(
                            item.key,
                            'carbs',
                            Number(event.target.value) || 0
                          )
                        }
                        inputMode="decimal"
                        aria-label={`${item.name} carbs`}
                      />
                    </label>
                    <label>
                      <span>fat</span>
                      <input
                        value={formatDecimal(nutrients.fat)}
                        onChange={(event) =>
                          updateScaledNutrient(
                            item.key,
                            'fat',
                            Number(event.target.value) || 0
                          )
                        }
                        inputMode="decimal"
                        aria-label={`${item.name} fat`}
                      />
                    </label>
                  </div>

                  {item.matched ? (
                    <p className="ai-match">
                      Closest library food: {item.matched.name}
                      {item.matched.servingLabel ? ` (${item.matched.servingLabel})` : ''}
                    </p>
                  ) : null}
                  {item.note ? <p className="fine-print">{item.note}</p> : null}
                </li>
              );
            })}
          </ul>

          <ToggleRow
            label="Save these items to my food library"
            description="Useful for meals you log often. Each saved food keeps the reviewed values."
            checked={saveToLibrary}
            onChange={setSaveToLibrary}
          />

          {submitError ? (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleLog}
          >
            Log {selectedCount} {selectedCount === 1 ? 'item' : 'items'} to{' '}
            {MEAL_LABELS[meal]}
          </button>
          <p className="fine-print">
            These are estimates, not verified nutrition. Check packaging or a scale when precision
            matters.
          </p>
        </section>
      ) : null}

      {status === 'done' && drafts.length === 0 ? (
        <div className="empty-note">
          <IconChevronLeft size={15} /> Nothing selected. Try another photo or use manual search.
        </div>
      ) : null}
    </Sheet>
  );
}
