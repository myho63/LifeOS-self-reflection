import { describe, expect, it } from 'vitest';
import {
  COMPARISON_MINIMUM_DAYS, faceFor, habitConsistency, happinessComparison, happinessMonth,
  HAPPINESS_FACES, timeSummary, dailyHours,
  type Habit, type Reflection, type TimeBudget, type TimeEntry,
} from '../src/index.js';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

/** A month of check-ins at a given value, for the first `n` days. */
function logged(y: number, m: number, n: number, value: number): Reflection[] {
  return Array.from({ length: n }, (_, i) => ({ date: iso(at(y, m, i + 1)), happiness: value }));
}

describe('the happiness scale', () => {
  it('maps every stored value onto exactly one face', () => {
    for (let v = 0; v <= 10; v += 0.5) {
      const face = faceFor(v);
      expect(HAPPINESS_FACES).toContain(face);
    }
    expect(faceFor(0).label).toBe('Very unhappy');
    expect(faceFor(5).label).toBe('Neutral');
    expect(faceFor(10).label).toBe('Very happy');
  });

  it('keeps the faces on a 0-10 scale, so a face and a slider share a history', () => {
    for (const f of HAPPINESS_FACES) {
      expect(f.value).toBeGreaterThanOrEqual(0);
      expect(f.value).toBeLessThanOrEqual(10);
      // Each face round-trips: storing its value reads back as the same face.
      expect(faceFor(f.value)).toBe(f);
    }
  });
});

describe('the month calendar', () => {
  const now = at(2026, 9, 2);

  it('lays out a fixed six-week grid so the calendar does not change height', () => {
    for (const month of [1, 2, 5, 8, 12]) {
      const m = happinessMonth([], at(2026, month, 15), now);
      expect(m.days).toHaveLength(42);
    }
  });

  it('starts the grid on a Monday and fills in the neighbouring days', () => {
    // 1 September 2026 is a Tuesday, so the grid opens with 31 August.
    const m = happinessMonth([], at(2026, 9, 1), now);
    expect(m.days[0]!.weekday).toBe(0);
    expect(m.days[0]!.date).toBe('2026-08-31');
    expect(m.days[0]!.inMonth).toBe(false);
    expect(m.days[1]!.dayOfMonth).toBe(1);
    expect(m.days[1]!.inMonth).toBe(true);
  });

  it('leaves an unlogged day undefined rather than defaulting it to the middle', () => {
    const m = happinessMonth([{ date: '2026-09-01', happiness: 9 }], at(2026, 9, 1), now);
    const first = m.days.find((d) => d.date === '2026-09-01')!;
    const second = m.days.find((d) => d.date === '2026-09-02')!;
    expect(first.value).toBe(9);
    expect(first.face?.label).toBe('Very happy');
    expect(second.value).toBeUndefined();
    expect(second.face).toBeUndefined();
  });

  it('averages only the days that were logged', () => {
    const m = happinessMonth(
      [
        { date: '2026-09-01', happiness: 9 },
        { date: '2026-09-02', happiness: 5 },
      ],
      at(2026, 9, 1),
      now,
    );
    expect(m.logged).toBe(2);
    expect(m.average).toBe(7);
    expect(m.face?.label).toBe('Happy');
  });

  it('counts days that have happened, not days in the month', () => {
    // On the 2nd, only two days could possibly have been logged.
    const m = happinessMonth([], at(2026, 9, 1), at(2026, 9, 2));
    expect(m.loggable).toBe(2);
    const full = happinessMonth([], at(2026, 9, 1), at(2026, 10, 5));
    expect(full.loggable).toBe(30);
  });

  it('marks today and the future, so an unlogged tomorrow is not a gap', () => {
    const m = happinessMonth([], at(2026, 9, 1), at(2026, 9, 2));
    expect(m.days.find((d) => d.date === '2026-09-02')!.isToday).toBe(true);
    expect(m.days.find((d) => d.date === '2026-09-03')!.isFuture).toBe(true);
    expect(m.days.find((d) => d.date === '2026-09-01')!.isFuture).toBe(false);
  });

  it('has no average at all when nothing was logged', () => {
    const m = happinessMonth([], at(2026, 9, 1), now);
    expect(m.average).toBeUndefined();
    expect(m.face).toBeUndefined();
    expect(m.logged).toBe(0);
  });
});

describe('month against month', () => {
  const now = at(2026, 9, 20);

  it('reports the rise when both months carry enough check-ins', () => {
    const c = happinessComparison([...logged(2026, 8, 20, 7), ...logged(2026, 9, 15, 7.8)], now);
    expect(c.direction).toBe('up');
    expect(c.changePercent).toBe(11);
    expect(c.previousLabel).toBe('August');
    expect(c.reading).toContain('rose');
  });

  it('withholds the comparison rather than computing one from two taps', () => {
    const c = happinessComparison([...logged(2026, 8, 2, 7), ...logged(2026, 9, 15, 9)], now);
    expect(c.direction).toBe('unknown');
    expect(c.changePercent).toBeUndefined();
    expect(c.reading).toContain(String(COMPARISON_MINIMUM_DAYS));
    // The month's own average still stands; only the comparison is withheld.
    expect(c.current.average).toBe(9);
  });

  it('calls a small move flat instead of dressing up noise as progress', () => {
    const c = happinessComparison([...logged(2026, 8, 20, 7), ...logged(2026, 9, 15, 7.05)], now);
    expect(c.direction).toBe('flat');
    expect(c.reading).toContain('Steady');
  });

  it('names a fall plainly', () => {
    const c = happinessComparison([...logged(2026, 8, 20, 8), ...logged(2026, 9, 15, 6)], now);
    expect(c.direction).toBe('down');
    expect(c.changePercent).toBe(-25);
    expect(c.reading).toContain('fell');
  });
});

describe('habit consistency', () => {
  // A Wednesday: this week's Monday is two days back and Tuesday one, so
  // both have elapsed while Thursday onwards has not.
  const now = at(2026, 9, 2);
  const day = (offset: number) => iso(new Date(now.getTime() + offset * DAY));
  const MON = day(-2);
  const TUE = day(-1);

  const habit = (id: string, schedule: number[], done: string[]): Habit => ({
    id, title: id, domainId: 'health', schedule: schedule as Habit['schedule'],
    createdAt: '2026-08-01', completions: done,
  });

  it('splits the week into kept, partial and dropped rather than one percentage', () => {
    const c = habitConsistency([
      // Mon+Tue scheduled, both done.
      habit('a', [1, 2], [MON, TUE]),
      // Mon+Tue scheduled, one done.
      habit('b', [1, 2], [MON]),
      // Mon+Tue scheduled, neither done.
      habit('c', [1, 2], []),
    ], now);

    expect(c.completed).toBe(1);
    expect(c.partial).toBe(1);
    expect(c.missed).toBe(1);
    expect(c.done).toBe(3);
    expect(c.scheduled).toBe(6);
    expect(c.overall).toBe(0.5);
  });

  it('does not count a Friday habit as missed on a Wednesday', () => {
    const c = habitConsistency([habit('a', [5], [])], now);
    expect(c.missed).toBe(0);
    expect(c.completed).toBe(0);
    expect(c.scheduled).toBe(0);
  });

  it('leaves achieved habits out of the week but still counts them', () => {
    const active = habit('a', [1, 2], [MON, TUE]);
    const retired: Habit = { ...habit('b', [1, 2], []), achievedAt: '2026-08-20' };
    const c = habitConsistency([active, retired], now);
    expect(c.completed).toBe(1);
    expect(c.missed).toBe(0);
    expect(c.achieved).toBe(1);
  });

  it('reports zero rather than dividing by nothing on an empty week', () => {
    expect(habitConsistency([], now).overall).toBe(0);
  });
});

describe('time budgets', () => {
  const now = at(2026, 9, 10);
  const day = (offset: number) => iso(new Date(now.getTime() + offset * DAY));

  const budget = (id: string, goalHours: number): TimeBudget =>
    ({ id, label: id, goalHours, period: 'week', createdAt: '2026-08-01' });
  const entry = (budgetId: string, offset: number, hours: number): TimeEntry =>
    ({ id: `${budgetId}-${offset}`, budgetId, date: day(offset), hours });

  it('measures the last seven days, not since an arbitrary Monday', () => {
    const s = timeSummary(
      [budget('deep', 10)],
      [entry('deep', 0, 3), entry('deep', -6, 4), entry('deep', -7, 99)],
      'week',
      now,
    );
    expect(s.budgets[0]!.actualHours).toBe(7);
    expect(s.from).toBe(day(-6));
    expect(s.to).toBe(day(0));
  });

  it('treats near-enough as on track rather than as failure', () => {
    const s = timeSummary([budget('focus', 40)], [entry('focus', 0, 38)], 'week', now);
    expect(s.budgets[0]!.state).toBe('on track');
    expect(s.budgets[0]!.ratio).toBe(0.95);
  });

  it('names under and over separately, and does not clip overspend to 100%', () => {
    const s = timeSummary(
      [budget('a', 10), budget('b', 10)],
      [entry('a', 0, 4), entry('b', 0, 15)],
      'week',
      now,
    );
    const [a, b] = s.budgets;
    expect(a!.state).toBe('under');
    expect(b!.state).toBe('over');
    expect(b!.ratio).toBe(1.5);
    // The bar still fills to exactly full; only the reported ratio exceeds one.
    expect(b!.progress).toBe(1);
  });

  it('separates "not started" from "under", because they need different nudges', () => {
    const s = timeSummary([budget('a', 10)], [], 'week', now);
    expect(s.budgets[0]!.state).toBe('not started');
    expect(s.overall).toBe(0);
  });

  it('leaves out budgets for a period you are not looking at', () => {
    const monthly: TimeBudget = { ...budget('m', 100), period: 'month' };
    expect(timeSummary([monthly], [], 'week', now).budgets).toHaveLength(0);
    expect(timeSummary([monthly], [], 'month', now).budgets).toHaveLength(1);
  });

  it('gives one row per day in the window, including the empty ones', () => {
    const d = dailyHours([entry('a', 0, 2), entry('a', -2, 3)], 'week', now);
    expect(d).toHaveLength(7);
    expect(d.at(-1)).toEqual({ date: day(0), hours: 2 });
    expect(d.find((x) => x.date === day(-1))!.hours).toBe(0);
  });
});
