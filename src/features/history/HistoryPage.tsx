import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Nutrients } from '../../types';
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
import { clamp01, formatNumber } from '../../lib/format';
import { IconChevronRight } from '../../components/icons';

export function HistoryPage() {
  const navigate = useNavigate();
  const entries = useAppStore((state) => state.entries);
  const targets = useAppStore((state) => state.targets);
  const today = todayKey();

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
