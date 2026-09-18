import { describe, expect, it } from 'vitest';
import {
  CHANGE_MINIMUM_DAYS, IMPACT_MINIMUM_DAYS, YEAR_COMPARISON_MINIMUM_DAYS,
  changeSignals, dimensionImpact, happinessYear,
  type Habit, type Reflection, type TimeBudget, type TimeEntry,
} from '../src/index.js';

const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (y: number, m: number, d: number) => iso(at(y, m, d));

/** `n` consecutive days from the 1st of the given month, all at `value`. */
function month(y: number, m: number, n: number, value: number): Reflection[] {
  return Array.from({ length: n }, (_, i) => ({ date: day(y, m, i + 1), happiness: value }));
}

describe('a year of check-ins', () => {
  const now = at(2026, 9, 3);

  it('always returns twelve points, so a sparse year is still a year', () => {
    const y = happinessYear([{ date: '2026-03-04', happiness: 8 }], 2026, now);
    expect(y.months).toHaveLength(12);
    expect(y.months.map((m) => m.label)[0]).toBe('Jan');
    expect(y.months[2]!.average).toBe(8);
    expect(y.months[0]!.average).toBeUndefined();
  });

  it('marks months that have not happened rather than scoring them zero', () => {
    const y = happinessYear([], 2026, now);
    expect(y.months[8]!.isCurrent).toBe(true);
    expect(y.months[8]!.isFuture).toBe(false);
    expect(y.months[9]!.isFuture).toBe(true);
    expect(y.months[7]!.isFuture).toBe(false);
    // A future month has no average, not an average of nothing.
    expect(y.months[11]!.average).toBeUndefined();
  });

  it('counts days that have elapsed, not days in the year', () => {
    expect(happinessYear([], 2026, now).loggable).toBe(246);
    expect(happinessYear([], 2025, now).loggable).toBe(365);
    expect(happinessYear([], 2027, now).loggable).toBe(0);
  });

  it('compares with last year once both carry enough days', () => {
    const y = happinessYear(
      [...month(2025, 1, 31, 6.8), ...month(2026, 1, 31, 7.6)],
      2026, now,
    );
    expect(y.direction).toBe('up');
    expect(y.changePercent).toBe(12);
    expect(y.average).toBe(7.6);
    expect(y.previousYearAverage).toBe(6.8);
  });

  it('withholds the year comparison rather than computing one from a week', () => {
    const y = happinessYear([...month(2025, 1, 4, 6), ...month(2026, 1, 31, 9)], 2026, now);
    expect(y.direction).toBe('unknown');
    expect(y.changePercent).toBeUndefined();
    expect(y.reading).toContain(String(YEAR_COMPARISON_MINIMUM_DAYS));
    // The year's own average still stands; only the comparison is withheld.
    expect(y.average).toBe(9);
  });
});

describe('what moves with your mood', () => {
  /** Days 1..n of September 2026, alternating so both sides have samples. */
  const reflections: Reflection[] = Array.from({ length: 20 }, (_, i) => ({
    date: day(2026, 9, i + 1),
    // Even days good, odd days middling.
    happiness: i % 2 === 0 ? 8 : 6,
  }));

  const habitOn = (id: string, domainId: Habit['domainId'], days: number[]): Habit => ({
    id, title: id, domainId, schedule: [0, 1, 2, 3, 4, 5, 6],
    createdAt: '2026-08-01',
    completions: days.map((d) => day(2026, 9, d)),
  });

  it('finds the dimension that lines up with the better days', () => {
    // Health kept on exactly the good days.
    const good = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const r = dimensionImpact({ reflections, habits: [habitOn('h', 'health', good)] });

    const health = r.dimensions.find((d) => d.domainId === 'health')!;
    expect(health.effect).toBe(2);
    expect(health.strength).toBe('high');
    expect(health.meanWith).toBe(8);
    expect(health.meanWithout).toBe(6);
    expect(r.reading).toContain('Health'.toLowerCase());
  });

  it('says plainly that this is a pattern, not a cause', () => {
    const r = dimensionImpact({
      reflections,
      habits: [habitOn('h', 'health', [1, 3, 5, 7, 9, 11, 13, 15, 17, 19])],
    });
    expect(r.reading).toContain('not proof of cause');
  });

  it('drops a dimension it has too few days on either side of', () => {
    // Three days is under the floor, so nothing is claimed about it.
    const r = dimensionImpact({ reflections, habits: [habitOn('h', 'fun', [1, 3, 5])] });
    expect(r.dimensions.find((d) => d.domainId === 'fun')).toBeUndefined();
    expect(r.insufficient.map((i) => i.domainId)).toContain('fun');
    expect(r.reading).toContain(String(IMPACT_MINIMUM_DAYS));
  });

  it('drops a dimension whose days are no better than the rest', () => {
    // Kept on five good and five middling days: no signal either way.
    const r = dimensionImpact({
      reflections,
      habits: [habitOn('h', 'career', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])],
    });
    expect(r.dimensions.find((d) => d.domainId === 'career')).toBeUndefined();
  });

  it('reports a dimension that lines up with worse days, and says so', () => {
    const bad = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const r = dimensionImpact({ reflections, habits: [habitOn('h', 'career', bad)] });
    const career = r.dimensions.find((d) => d.domainId === 'career')!;
    expect(career.effect).toBe(-2);
    // The reading has to describe what the bars show. Claiming "nothing lines
    // up with better days" while a career bar sits on screen is the bug this
    // guards.
    expect(r.reading).toContain('harder days');
    expect(r.reading).toContain('career');
    expect(r.reading).not.toContain('Your better days');
  });

  it('counts hours and finished tasks as activity, not only habits', () => {
    const good = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const budget: TimeBudget = { id: 'b', label: 'Deep work', goalHours: 40, period: 'month', domainId: 'career', createdAt: '2026-08-01' };
    const entries: TimeEntry[] = good.map((d, i) => ({ id: `e${i}`, budgetId: 'b', date: day(2026, 9, d), hours: 2 }));
    const r = dimensionImpact({ reflections, timeBudgets: [budget], timeEntries: entries });
    expect(r.dimensions.find((d) => d.domainId === 'career')?.effect).toBe(2);
  });

  it('says so rather than guessing when there is nothing to work from', () => {
    const r = dimensionImpact({ reflections: [] });
    expect(r.dimensions).toEqual([]);
    expect(r.sampleDays).toBe(0);
    expect(r.reading).toContain('No check-ins');
  });
});

describe('what changed since last month', () => {
  const now = at(2026, 9, 20);

  it('leads with the happiness move and backs it with a figure', () => {
    const r = changeSignals({
      reflections: [...month(2026, 8, 20, 7), ...month(2026, 9, 15, 7.8)],
    }, now);
    expect(r.headline?.direction).toBe('up');
    expect(r.headline?.magnitude).toBe(11);
    expect(r.headline?.detail).toContain('11% higher than August');
  });

  it('refuses to compare two months off a handful of check-ins', () => {
    const r = changeSignals({
      reflections: [...month(2026, 8, 2, 7), ...month(2026, 9, 15, 9)],
    }, now);
    expect(r.headline).toBeUndefined();
    expect(r.signals).toEqual([]);
    expect(r.note).toContain(String(CHANGE_MINIMUM_DAYS));
  });

  it('names the dimension whose habit days moved most', () => {
    const habit = (id: string, domainId: Habit['domainId'], aug: number, sep: number): Habit => ({
      id, title: id, domainId, schedule: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-07-01',
      completions: [
        ...Array.from({ length: aug }, (_, i) => day(2026, 8, i + 1)),
        ...Array.from({ length: sep }, (_, i) => day(2026, 9, i + 1)),
      ],
    });
    const r = changeSignals({
      reflections: [...month(2026, 8, 20, 7), ...month(2026, 9, 15, 7.5)],
      habits: [habit('a', 'health', 5, 15), habit('b', 'fun', 8, 8)],
    }, now);

    const health = r.signals.find((s) => s.domainId === 'health')!;
    expect(health.direction).toBe('up');
    expect(health.magnitude).toBe(10);
    expect(health.title).toContain('Health');
    // Fun did not move, so it is not mentioned at all.
    expect(r.signals.find((s) => s.domainId === 'fun')).toBeUndefined();
  });

  it('notices a month that swung less than the one before', () => {
    const steady = month(2026, 9, 15, 7);
    const swingy = Array.from({ length: 20 }, (_, i) => ({ date: day(2026, 8, i + 1), happiness: i % 2 ? 3 : 10 }));
    const r = changeSignals({ reflections: [...swingy, ...steady] }, now);
    const c = r.signals.find((s) => s.id === 'consistency')!;
    expect(c.direction).toBe('up');
    expect(c.detail).toContain('varied less');
  });

  it('keeps the list short rather than reporting eleven one-day shifts', () => {
    const habits: Habit[] = (['health', 'career', 'fun', 'social', 'finance'] as const).map((domainId, n) => ({
      id: domainId, title: domainId, domainId, schedule: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-07-01',
      completions: Array.from({ length: 4 + n * 4 }, (_, i) => day(2026, 9, i + 1)),
    }));
    const r = changeSignals({
      reflections: [...month(2026, 8, 20, 7), ...month(2026, 9, 15, 7.5)],
      habits,
    }, now);
    expect(r.signals.filter((s) => s.id.startsWith('habits-')).length).toBeLessThanOrEqual(2);
  });
});

describe('the tracking window', () => {
  const now = at(2026, 9, 20);

  it('does not credit a new habit with the months before it existed', () => {
    // Two years of check-ins, middling throughout, and a habit created last
    // month that has been kept on the recent good days.
    const old: Reflection[] = Array.from({ length: 200 }, (_, i) => ({
      date: iso(new Date(at(2026, 9, 20).getTime() - (i + 40) * 86_400_000)),
      happiness: 6,
    }));
    const recent: Reflection[] = Array.from({ length: 30 }, (_, i) => ({
      date: iso(new Date(at(2026, 9, 20).getTime() - i * 86_400_000)),
      happiness: i % 2 === 0 ? 8 : 6,
    }));
    const kept = recent.filter((_, i) => i % 2 === 0).map((r) => r.date);

    const habit: Habit = {
      id: 'h', title: 'Run', domainId: 'health', schedule: [0, 1, 2, 3, 4, 5, 6],
      createdAt: kept.at(-1)!, completions: kept,
    };

    const r = dimensionImpact({ reflections: [...old, ...recent], habits: [habit] });
    const health = r.dimensions.find((d) => d.domainId === 'health')!;

    // Against the handful of tracked days without it, not the two hundred
    // before the habit existed. The effect is the real 2 points, and the
    // sample is the tracking window rather than the whole history.
    expect(health.effect).toBe(2);
    expect(health.since).toBe(kept.at(-1));
    expect(health.daysWith + health.daysWithout).toBeLessThanOrEqual(recent.length);
    expect(health.daysWith + health.daysWithout).toBeGreaterThan(20);
    // Without the window this would have been 230.
    expect(health.daysWithout).toBeLessThan(20);
  });

  it('opens the window when the habit was created, not when it was first kept', () => {
    const reflections: Reflection[] = Array.from({ length: 20 }, (_, i) => ({
      date: day(2026, 9, i + 1), happiness: i < 10 ? 5 : 9,
    }));
    // Created on the 1st, first kept on the 11th: the first ten days count as
    // tracked-and-missed rather than being excluded.
    const habit: Habit = {
      id: 'h', title: 'Run', domainId: 'health', schedule: [0, 1, 2, 3, 4, 5, 6],
      createdAt: day(2026, 9, 1),
      completions: Array.from({ length: 10 }, (_, i) => day(2026, 9, i + 11)),
    };
    const r = dimensionImpact({ reflections, habits: [habit] });
    const health = r.dimensions.find((d) => d.domainId === 'health')!;
    expect(health.since).toBe(day(2026, 9, 1));
    expect(health.daysWithout).toBe(10);
    expect(health.effect).toBe(4);
  });
});

describe('the change card can follow a chosen month', () => {
  it('compares the month it is given, not always the current one', () => {
    const now = at(2026, 9, 3);
    const r = changeSignals(
      { reflections: [...month(2026, 7, 20, 6.5), ...month(2026, 8, 20, 7.3)] },
      now,
      at(2026, 8, 15),
    );
    expect(r.headline?.direction).toBe('up');
    expect(r.headline?.detail).toContain('than July');
  });

  it('names both months when it has to decline the comparison', () => {
    const now = at(2026, 9, 3);
    const r = changeSignals({ reflections: month(2026, 8, 20, 7) }, now);
    expect(r.note).toContain('in September');
    expect(r.note).toContain('in August');
  });
});
