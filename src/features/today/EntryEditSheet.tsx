import { useEffect, useState } from 'react';
import type { Entry } from '../../types';
import { MEAL_LABELS } from '../../types';
import { Sheet } from '../../components/Sheet';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../components/Toast';
import { formatDayMedium } from '../../lib/dates';
import { formatNumber } from '../../lib/format';
import { scaleNutrients } from '../../lib/nutrition';
import { IconMinus, IconPlus, IconTrash } from '../../components/icons';

type EntryEditSheetProps = {
  entry: Entry | null;
  onClose: () => void;
};

const PRESETS = [0.5, 1, 1.5, 2];

export function EntryEditSheet({ entry, onClose }: EntryEditSheetProps) {
  const updateEntryQuantity = useAppStore((state) => state.updateEntryQuantity);
  const deleteEntry = useAppStore((state) => state.deleteEntry);
  const toast = useToast();

  const [quantity, setQuantity] = useState('1');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entry) return;
    setQuantity(String(entry.quantity));
    setConfirming(false);
    setError('');
  }, [entry]);

  const quantityValue = Number(quantity);
  const valid = Number.isFinite(quantityValue) && quantityValue > 0 && quantityValue <= 1000;
  const nutrients = entry && valid ? scaleNutrients(entry.nutrients, quantityValue) : null;

  function step(delta: number) {
    const current = Number(quantity);
    const base = Number.isFinite(current) ? current : 1;
    const next = Math.min(1000, Math.max(0.25, Math.round((base + delta) * 4) / 4));
    setQuantity(String(next));
  }

  function handleSave() {
    if (!entry) return;
    if (!valid) {
      setError('Enter a quantity between 0.01 and 1,000.');
      return;
    }

    updateEntryQuantity(entry.id, quantityValue);
    toast('Entry updated');
    onClose();
  }

  function handleDelete() {
    if (!entry) return;
    deleteEntry(entry.id);
    toast('Entry deleted');
    onClose();
  }

  return (
    <Sheet
      open={Boolean(entry)}
      title={entry?.name ?? 'Entry'}
      subtitle={
        entry ? `${MEAL_LABELS[entry.meal]} · ${formatDayMedium(entry.date)}` : undefined
      }
      onClose={onClose}
    >
      {entry ? (
        <>
          <div className="portion-head">
            <div>
              <h3>{entry.servingLabel}</h3>
              <p>
                {formatNumber(entry.nutrients.kcal)} kcal per serving
              </p>
            </div>
          </div>

          <div className="stepper">
            <button
              type="button"
              className="icon-button"
              onClick={() => step(-0.5)}
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
                aria-invalid={!valid}
              />
              <span>× serving</span>
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => step(0.5)}
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

          {nutrients ? (
            <ul className="preview-grid">
              <li>
                <strong>{formatNumber(nutrients.kcal)}</strong>
                <span>kcal</span>
              </li>
              <li>
                <strong>{formatNumber(nutrients.protein)}</strong>
                <span>protein</span>
              </li>
              <li>
                <strong>{formatNumber(nutrients.carbs)}</strong>
                <span>carbs</span>
              </li>
              <li>
                <strong>{formatNumber(nutrients.fat)}</strong>
                <span>fat</span>
              </li>
            </ul>
          ) : null}

          {error ? <p className="field-error" role="alert">{error}</p> : null}

          <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
            Save changes
          </button>

          {confirming ? (
            <div className="delete-confirm" role="alert">
              <p>Delete this entry?</p>
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirming(false)}
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
              onClick={() => setConfirming(true)}
            >
              <IconTrash size={15} /> Delete entry
            </button>
          )}
        </>
      ) : null}
    </Sheet>
  );
}
