import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Entry, Meal } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { ProgressRing } from '../../components/ProgressRing';
import { AddFoodSheet } from './AddFoodSheet';
import { EntryEditSheet } from './EntryEditSheet';
import {
  addDays,
  formatDayLong,
  formatDayMedium,
  formatWeekday,
  isFutureDay,
  isValidDayKey,
  relativeDayLabel,
  todayKey
} from '../../lib/dates';
import {
  entriesForDate,
  entriesForMeal,
  sumEntries,
  totalsForMeal
} from '../../lib/nutrition';
import { clamp01, formatDecimal, formatNumber } from '../../lib/format';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/icons';

function MacroBar({
  label,
  value,
  target,
  tone
}: {
  label: string;
  value: number;
  target: number;
  tone: 'protein' | 'carbs' | 'fat';
}) {
  const percentage = target > 0 ? clamp01(value / target) * 100 : 0;

  return (
    <div className={`macro macro-${tone}`}>
      <div className="macro-head">
        <span>{label}</span>
        <span>
          {formatNumber(value)} / {formatNumber(target)} g
        </span>
      </div>
      <div className="macro-track" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function TodayPage() {
  const params = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const today = todayKey();
  const requested = params.date;
  const date =
    requested === undefined
      ? today
      : isValidDayKey(requested) && !isFutureDay(requested, today)
        ? requested
        : '';

  const entries = useAppStore((state) => state.entries);
  const targets = useAppStore((state) => state.targets);

  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  const safeDate = date || today;
  const dayEntries = useMemo(
    () => entriesForDate(entries, safeDate),
    [entries, safeDate]
  );
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries]);

  if (!date) {
    return <Navigate to={`/day/${today}`} replace />;
  }

  const remaining = targets.kcal - totals.kcal;
  const isOver = remaining < 0;
  const relative = relativeDayLabel(date, today);

  return (
    <div className="page day-page">
      <header className="day-nav">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous day"
          onClick={() => navigate(`/day/${addDays(date, -1)}`)}
        >
          <IconChevronLeft />
        </button>

        <div className="day-title">
          <p className="eyebrow">{formatDayLong(date)}</p>
          <h1>{relative ?? formatWeekday(date)}</h1>
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => navigate(`/day/${addDays(date, 1)}`)}
        >
          <IconChevronRight />
        </button>
      </header>

      {date !== today ? (
        <button type="button" className="jump-today" onClick={() => navigate('/today')}>
          Jump to today
        </button>
      ) : null}

      <section
        className={`summary-card${isOver ? ' summary-over' : ''}`}
        aria-label="Daily summary"
      >
        <ProgressRing
          value={targets.kcal > 0 ? totals.kcal / targets.kcal : 0}
          label={`${formatNumber(totals.kcal)} of ${formatNumber(targets.kcal)} calories logged`}
          size={120}
          stroke={9}
        >
          <span className="ring-number">{formatNumber(Math.abs(remaining))}</span>
          <span className="ring-label">{isOver ? 'kcal over' : 'kcal left'}</span>
        </ProgressRing>

        <div className="summary-side">
          <div className="summary-stats">
            <div>
              <span>Eaten</span>
              <strong>{formatNumber(totals.kcal)}</strong>
            </div>
            <div>
              <span>Target</span>
              <strong>{formatNumber(targets.kcal)}</strong>
            </div>
          </div>

          <div className="macro-list">
            <MacroBar
              label="Protein"
              value={totals.protein}
              target={targets.protein}
              tone="protein"
            />
            <MacroBar
              label="Carbs"
              value={totals.carbs}
              target={targets.carbs}
              tone="carbs"
            />
            <MacroBar label="Fat" value={totals.fat} target={targets.fat} tone="fat" />
          </div>
        </div>
      </section>

      <div className="meals">
        {MEALS.map((meal) => {
          const mealEntries = entriesForMeal(entries, date, meal);
          const mealTotals = totalsForMeal(entries, date, meal);

          return (
            <section key={meal} className="meal-card" aria-labelledby={`meal-${meal}`}>
              <header className="meal-head">
                <div>
                  <h2 id={`meal-${meal}`}>{MEAL_LABELS[meal]}</h2>
                  <span className="meal-total">
                    {formatNumber(mealTotals.kcal)} kcal
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button-accent"
                  aria-label={`Add food to ${MEAL_LABELS[meal]}`}
                  onClick={() => setAddMeal(meal)}
                >
                  <IconPlus size={18} />
                </button>
              </header>

              {mealEntries.length > 0 ? (
                <ul className="entry-list">
                  {mealEntries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="entry-row"
                        onClick={() => setEditEntry(entry)}
                        aria-label={`Edit ${entry.name}`}
                      >
                        <span className="entry-main">
                          <span className="entry-name">{entry.name}</span>
                          <span className="entry-meta">
                            {formatDecimal(entry.quantity)} × {entry.servingLabel}
                          </span>
                        </span>
                        <span className="entry-kcal">
                          {formatNumber(entry.nutrients.kcal * entry.quantity)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  className="meal-empty"
                  onClick={() => setAddMeal(meal)}
                >
                  <IconPlus size={15} /> Add {MEAL_LABELS[meal].toLowerCase()}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <p className="day-footnote">
        {dayEntries.length > 0
          ? `${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'} logged for ${formatDayMedium(date)}.`
          : 'Nothing logged yet. Add your first food to see the day add up.'}
      </p>

      <AddFoodSheet
        open={addMeal !== null}
        meal={addMeal ?? 'breakfast'}
        date={date}
        onClose={() => setAddMeal(null)}
      />
      <EntryEditSheet entry={editEntry} onClose={() => setEditEntry(null)} />
    </div>
  );
}
