import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Entry, Meal, Reminder } from '../../types';
import { MEALS, MEAL_LABELS } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { ProgressRing } from '../../components/ProgressRing';
import { AddFoodSheet } from './AddFoodSheet';
import { EntryEditSheet } from './EntryEditSheet';
import { AiLogSheet } from '../ai/AiLogSheet';
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
import { dismissReminder, dueReminder, wasReminderDismissed } from '../../lib/reminders';
import {
  IconBell,
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconSparkles,
  IconWater,
  IconX
} from '../../components/icons';

function mealForNow(date = new Date()): Meal {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

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
  const water = useAppStore((state) => state.water);
  const addWater = useAppStore((state) => state.addWater);
  const deleteWater = useAppStore((state) => state.deleteWater);
  const reminders = useAppStore((state) => state.reminders);
  const settings = useAppStore((state) => state.settings);
  const preferences = useAppStore((state) => state.preferences);

  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [due, setDue] = useState<Reminder | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'photo' | 'text'>('photo');
  const [aiMeal, setAiMeal] = useState<Meal>('lunch');

  const safeDate = date || today;
  const dayEntries = useMemo(
    () => entriesForDate(entries, safeDate),
    [entries, safeDate]
  );
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries]);
  const dayWater = useMemo(
    () => water.filter((item) => item.date === safeDate),
    [safeDate, water]
  );
  const waterTotal = dayWater.reduce((total, item) => total + item.ml, 0);
  const lastWater = dayWater[dayWater.length - 1];
  const waterGoal = settings.waterGoalMl || 2000;

  useEffect(() => {
    if (date !== today || !reminders.enabled) {
      setDue(null);
      return;
    }

    const check = () => {
      const now = new Date();
      const candidate = dueReminder(
        reminders.items,
        now,
        reminders.quietStart,
        reminders.quietEnd
      );
      setDue(candidate && !wasReminderDismissed(candidate, now) ? candidate : null);
    };

    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [date, reminders, today]);

  function waterLabel(ml: number): string {
    return settings.units === 'imperial'
      ? `${formatNumber(ml / 29.5735)} oz`
      : `${formatNumber(ml)} ml`;
  }

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

      {preferences.photoLogging || preferences.textLogging || preferences.aiChat ? (
        <section className="quick-log" aria-label="Faster logging">
          <div className="quick-log-head">
            <span className="eyebrow">Log faster</span>
            <span>Review before saving</span>
          </div>
          <div className="quick-log-actions">
            {preferences.photoLogging ? (
              <button
                type="button"
                className="quick-log-action"
                onClick={() => {
                  setAiMode('photo');
                  setAiMeal(mealForNow());
                  setAiOpen(true);
                }}
              >
                <IconCamera size={19} />
                <span>
                  <strong>Photo</strong>
                  <small>Recognise a meal</small>
                </span>
              </button>
            ) : null}
            {preferences.textLogging ? (
              <button
                type="button"
                className="quick-log-action"
                onClick={() => {
                  setAiMode('text');
                  setAiMeal(mealForNow());
                  setAiOpen(true);
                }}
              >
                <IconSparkles size={19} />
                <span>
                  <strong>Describe</strong>
                  <small>Type what you ate</small>
                </span>
              </button>
            ) : null}
            {preferences.aiChat ? (
              <Link to="/assistant" className="quick-log-action">
                <IconSparkles size={19} />
                <span>
                  <strong>Coach</strong>
                  <small>Ask about your week</small>
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {due ? (
        <section className="reminder-banner" aria-label="Meal reminder">
          <IconBell size={20} />
          <div className="reminder-copy">
            <strong>Time to log {MEAL_LABELS[due.meal].toLowerCase()}</strong>
            <span>Your {due.time} reminder is on for this device.</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => {
              setAddMeal(due.meal);
              setDue(null);
            }}
          >
            Log now
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss reminder for today"
            onClick={() => {
              dismissReminder(due);
              setDue(null);
            }}
          >
            <IconX size={16} />
          </button>
        </section>
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

      <section className="card water-card" aria-labelledby="water-heading">
        <div className="card-head">
          <h2 id="water-heading">
            <IconWater size={17} /> Water
          </h2>
          <span className="card-note">
            {waterLabel(waterTotal)} / {waterLabel(waterGoal)}
          </span>
        </div>

        <div
          className="water-track"
          role="progressbar"
          aria-label="Water logged today"
          aria-valuemin={0}
          aria-valuemax={waterGoal}
          aria-valuenow={Math.min(waterTotal, waterGoal)}
          aria-valuetext={`${waterLabel(waterTotal)} of ${waterLabel(waterGoal)}`}
        >
          <span
            style={{ width: `${clamp01(waterTotal / waterGoal) * 100}%` }}
          />
        </div>

        <div className="water-actions">
          {(settings.units === 'imperial' ? [240, 480] : [250, 500]).map((amount) => (
            <button
              key={amount}
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => addWater(date, amount)}
            >
              + {waterLabel(amount)}
            </button>
          ))}
          {lastWater ? (
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => deleteWater(lastWater.id)}
            >
              Undo last
            </button>
          ) : null}
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
      <AiLogSheet
        open={aiOpen}
        meal={aiMeal}
        date={date}
        initialMode={aiMode}
        onClose={() => setAiOpen(false)}
        onManualSearch={() => {
          setAiOpen(false);
          setAddMeal(aiMeal);
        }}
      />
    </div>
  );
}
