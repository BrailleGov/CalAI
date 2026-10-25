import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Nutrients, WeightEntry } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  formatDayMedium,
  formatWeekday,
  formatWeekdayNarrow,
  lastNDayKeys,
  relativeDayLabel,
  todayKey
} from '../../lib/dates';
import { EMPTY_NUTRIENTS } from '../../lib/nutrition';
import {
  clamp01,
  formatDecimal,
  formatNumber,
  kilogramsToPounds,
  poundsToKilograms
} from '../../lib/format';
import { IconChevronRight, IconScale, IconTrash } from '../../components/icons';

export function HistoryPage() {
  const navigate = useNavigate();
  const entries = useAppStore((state) => state.entries);
  const targets = useAppStore((state) => state.targets);
  const weights = useAppStore((state) => state.weights);
  const profile = useAppStore((state) => state.profile);
  const settings = useAppStore((state) => state.settings);
  const logWeight = useAppStore((state) => state.logWeight);
  const deleteWeight = useAppStore((state) => state.deleteWeight);
  const today = todayKey();

  const sortedWeights = useMemo(
    () => [...weights].sort((a, b) => b.date.localeCompare(a.date)),
    [weights]
  );
  const latestWeight = sortedWeights[0] ?? null;
  const weekWeightKeys = useMemo(() => new Set(lastNDayKeys(7, today)), [today]);
  const weekWeights = useMemo(
    () => sortedWeights.filter((item) => weekWeightKeys.has(item.date)).slice(0, 7),
    [sortedWeights, weekWeightKeys]
  );
  const weekWeightAverage =
    weekWeights.length > 0
      ? weekWeights.reduce((total, item) => total + item.kg, 0) / weekWeights.length
      : null;

  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState('');
  const [confirmWeight, setConfirmWeight] = useState<string | null>(null);

  useEffect(() => {
    const source = latestWeight?.kg ?? profile?.weightKg;
    if (source === undefined) {
      setWeightInput('');
      return;
    }
    setWeightInput(
      settings.units === 'imperial'
        ? String(Math.round(kilogramsToPounds(source)))
        : String(Math.round(source * 10) / 10)
    );
  }, [latestWeight?.id, latestWeight?.kg, profile?.weightKg, settings.units]);

  function handleLogWeight() {
    const value = Number(weightInput);
    const kg = settings.units === 'imperial' ? poundsToKilograms(value) : value;

    if (
      !Number.isFinite(kg) ||
      kg < 30 ||
      kg > 300
    ) {
      setWeightError('Enter a weight between 30 and 300 kg (66 and 660 lb).');
      return;
    }

    setWeightError('');
    logWeight(today, Math.round(kg * 10) / 10);
  }

  function displayWeight(item: WeightEntry): string {
    return settings.units === 'imperial'
      ? `${formatNumber(kilogramsToPounds(item.kg))} lb`
      : `${formatDecimal(item.kg)} kg`;
  }

  const weightChart = [...weekWeights].reverse();
  const chartValues = weightChart.map((item) => item.kg);
  const chartMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const chartRange = Math.max(0.5, chartMax - chartMin);
  const chartPoints = chartValues
    .map((value, index) => {
      const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100;
      const y = 36 - ((value - chartMin) / chartRange) * 30;
      return `${x},${Math.max(4, Math.min(38, y))}`;
    })
    .join(' ');
  const weightChartLabel = weightChart
    .map((item) => `${formatDayMedium(item.date)}: ${displayWeight(item)}`)
    .join('. ');

  const totalsByDate = useMemo(() => {
    const map = new Map<string, Nutrients>();
    for (const entry of entries) {
      const current = map.get(entry.date) ?? { ...EMPTY_NUTRIENTS };
      map.set(entry.date, {
        kcal: current.kcal + entry.nutrients.kcal * entry.quantity,
        protein: current.protein + entry.nutrients.protein * entry.quantity,
        carbs: current.carbs + entry.nutrients.carbs * entry.quantity,
        fat: current.fat + entry.nutrients.fat * entry.quantity
      });
    }
    return map;
  }, [entries]);

  const last7 = useMemo(() => lastNDayKeys(7, today), [today]);
  const last30 = useMemo(() => lastNDayKeys(30, today), [today]);

  const weekValues = last7.map((date) => totalsByDate.get(date)?.kcal ?? 0);
  const loggedWeek = weekValues.filter((value) => value > 0);
  const weekAverage =
    loggedWeek.length > 0
      ? loggedWeek.reduce((total, value) => total + value, 0) / loggedWeek.length
      : 0;
  const loggedDays = last7.filter((date) => totalsByDate.has(date)).length;

  const maxValue = Math.max(targets.kcal, ...weekValues, 1);
  const targetPercent = clamp01(targets.kcal / maxValue) * 100;
  const chartLabel = last7
    .map((date) => `${formatWeekday(date)}: ${formatNumber(totalsByDate.get(date)?.kcal ?? 0)} calories`)
    .join('. ');

  return (
    <div className="page history-page">
      <header className="page-head">
        <p className="eyebrow">Progress</p>
        <h1>History</h1>
        <p className="page-lede">
          A quiet look at the last few weeks. No streaks to break, no red marks.
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Avg / logged day</span>
          <strong className="stat-value">{formatNumber(weekAverage)}</strong>
          <span className="stat-unit">kcal · last 7 days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Days logged</span>
          <strong className="stat-value">
            {loggedDays}
            <span className="stat-denominator">/7</span>
          </strong>
          <span className="stat-unit">this week</span>
        </div>
      </div>

      <section className="card chart-card" aria-labelledby="chart-heading">
        <div className="card-head">
          <h2 id="chart-heading">Last 7 days</h2>
          <span className="card-note">{formatNumber(targets.kcal)} kcal target</span>
        </div>

        <div className="chart" role="img" aria-label={`Calories for the last 7 days. ${chartLabel}`}>
          <div className="chart-plot">
            <div className="chart-target" style={{ bottom: `${targetPercent}%` }}>
              <span>target</span>
            </div>
            <div className="chart-bars">
              {last7.map((date, index) => {
                const value = weekValues[index] ?? 0;
                const height = value > 0 ? Math.max(3, (value / maxValue) * 100) : 0;
                return (
                  <div key={date} className="chart-col">
                    <div
                      className={`chart-bar${date === today ? ' chart-bar-today' : ''}${
                        value > targets.kcal ? ' chart-bar-over' : ''
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-days" aria-hidden="true">
            {last7.map((date) => (
              <span key={date}>{formatWeekdayNarrow(date)}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="card weight-card" aria-labelledby="weight-heading">
        <div className="card-head">
          <h2 id="weight-heading">
            <IconScale size={17} /> Weight
          </h2>
          <span className="card-note">
            {weekWeights.length > 0 ? '7-day average' : 'Local only'}
          </span>
        </div>

        {weekWeights.length > 0 ? (
          <>
            <div className="weight-stats">
              <div>
                <span>Latest</span>
                <strong>{latestWeight ? displayWeight(latestWeight) : '—'}</strong>
              </div>
              <div>
                <span>7-day average</span>
                <strong>
                  {weekWeightAverage !== null
                    ? settings.units === 'imperial'
                      ? `${formatNumber(kilogramsToPounds(weekWeightAverage))} lb`
                      : `${formatDecimal(weekWeightAverage)} kg`
                    : '—'}
                </strong>
              </div>
            </div>

            <div
              className="weight-chart"
              role="img"
              aria-label={`Weight for the last 7 days. ${weightChartLabel}`}
            >
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                {chartValues.length > 1 ? (
                  <polyline
                    points={chartPoints}
                    fill="none"
                    stroke="var(--accent-text)"
                    strokeWidth="1.6"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <circle cx="50" cy="20" r="2.4" fill="var(--accent-text)" />
                )}
              </svg>
              <div className="weight-chart-labels" aria-hidden="true">
                {weightChart.map((item) => (
                  <span key={item.date}>{formatDayMedium(item.date)}</span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="empty-note">
            Log a weight to see a quiet 7-day line. No goal, no streaks.
          </p>
        )}

        <div className="weight-form">
          <label className="field">
            <span className="field-label">
              Today ({settings.units === 'imperial' ? 'lb' : 'kg'})
            </span>
            <span className="unit-input">
              <input
                value={weightInput}
                onChange={(event) => {
                  setWeightInput(event.target.value);
                  setWeightError('');
                }}
                inputMode="decimal"
                aria-invalid={Boolean(weightError)}
                placeholder={settings.units === 'imperial' ? '160' : '72'}
              />
              <span className="unit">{settings.units === 'imperial' ? 'lb' : 'kg'}</span>
            </span>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLogWeight}
          >
            {latestWeight?.date === today ? 'Update today' : 'Log weight'}
          </button>
        </div>
        {weightError ? (
          <p className="field-error" role="alert">
            {weightError}
          </p>
        ) : null}

        {sortedWeights.length > 0 ? (
          <ul className="weight-list">
            {sortedWeights.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{displayWeight(item)}</strong>
                  <small>{formatDayMedium(item.date)}</small>
                </span>
                {confirmWeight === item.id ? (
                  <span className="weight-confirm">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setConfirmWeight(null)}
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => {
                        deleteWeight(item.id);
                        setConfirmWeight(null);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete weight from ${formatDayMedium(item.date)}`}
                    onClick={() => setConfirmWeight(item.id)}
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="recent-heading">
        <div className="card-head card-head-flush">
          <h2 id="recent-heading">Last 30 days</h2>
          <span className="card-note">Tap a day to open it</span>
        </div>

        <ul className="history-list">
          {[...last30].reverse().map((date) => {
            const totals = totalsByDate.get(date);
            const logged = Boolean(totals);
            const percentage = totals ? clamp01(totals.kcal / (targets.kcal || 1)) * 100 : 0;
            const relative = relativeDayLabel(date, today);

            return (
              <li key={date}>
                <button
                  type="button"
                  className="history-row"
                  onClick={() => navigate(`/day/${date}`)}
                >
                  <span className="history-date">
                    <span className="history-day">{relative ?? formatWeekday(date)}</span>
                    <span className="history-sub">{formatDayMedium(date)}</span>
                  </span>
                  <span className="history-bar" aria-hidden="true">
                    <span style={{ width: `${percentage}%` }} />
                  </span>
                  <span className={`history-kcal${logged ? '' : ' is-empty'}`}>
                    {logged ? formatNumber(totals?.kcal ?? 0) : '—'}
                  </span>
                  {logged ? null : <span className="visually-hidden">Nothing logged</span>}
                  <IconChevronRight size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="fine-print">
        Targets are the ones currently set in Settings; past days are recalculated against
        today&rsquo;s target for comparison.
      </p>
    </div>
  );
}
