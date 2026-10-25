import type { Food } from '../../types';
import { FOOD_SOURCE_LABELS } from '../../types';
import { formatNumber } from '../../lib/format';
import { IconPlus } from '../../components/icons';
import { AiConsentInline } from '../../components/AiConsentInline';
import type { FoodDiscoveryStatus } from './useFoodDiscovery';

type FoodDiscoveryListProps = {
  query: string;
  foods: Food[];
  status: FoodDiscoveryStatus;
  note: string;
  error: string;
  aiConsent: boolean;
  aiConfigured: boolean;
  onChoose: (food: Food) => void;
  onRetry: () => void;
};

export function FoodDiscoveryList({
  query,
  foods,
  status,
  note,
  error,
  aiConsent,
  aiConfigured,
  onChoose,
  onRetry
}: FoodDiscoveryListProps) {
  if (status === 'idle') return null;

  return (
    <section className="shared-foods" aria-label="Shared food library">
      <div className="list-heading">
        <span>Shared library</span>
        <span>{status === 'done' ? foods.length : 'AI'}</span>
      </div>

      {status === 'searching' || status === 'finding' ? (
        <p className="finding-status" role="status">
          <span className="finding-dot" aria-hidden="true" />
          {status === 'finding'
            ? 'AI is adding more matches to the shared library…'
            : 'Finding items in the shared library…'}
        </p>
      ) : null}

      {aiConfigured && !aiConsent ? (
        <AiConsentInline
          action="Turn on AI food search"
          message="Turn on AI to find more foods and add them to the shared library. Only your search words are sent."
        />
      ) : null}

      {status === 'error' ? (
        <div className="online-error" role="status">
          <p>{error} Local foods still work offline.</p>
          <button type="button" className="btn btn-ghost btn-small" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {foods.length > 0 ? (
        <ul className="food-list">
          {foods.map((food) => (
            <li key={food.id}>
              <button type="button" className="food-row" onClick={() => onChoose(food)}>
                <span className="food-row-main">
                  <span className="food-name">
                    {food.name}
                    <span className="badge">{FOOD_SOURCE_LABELS[food.source]}</span>
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
      ) : null}

      {status === 'done' && foods.length === 0 && aiConsent ? (
        <p className="empty-note">
          No shared foods for “{query}” yet. Try a shorter search or create the food.
        </p>
      ) : null}

      {note ? <p className="online-note shared-note">{note}</p> : null}

      <p className="fine-print">
        Shared foods are added by AI from searches and reviewed values are estimates, not
        verified nutrition. Check the label when precision matters.
      </p>
    </section>
  );
}
