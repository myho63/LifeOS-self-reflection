import { getDomain } from '../taxonomy/domains.js';
import { round } from '../util/math.js';
import type { IsoDate, LifeDomainId } from '../types.js';
import type { Habit, Reflection, Task } from '../practice/engine.js';
import type { TimeBudget, TimeEntry } from '../time/engine.js';
import { faceFor, type HappinessFace } from '../wellbeing/engine.js';

/**
 * Insights: what a year of check-ins says, and what moves with them.
 *
 * Everything in this module is *derived*, never asserted. The product's own
 * AI layer writes prose over these numbers; the numbers themselves come from
 * arithmetic on the user's own logs, so a claim on screen can always be traced
 * back to days they actually recorded. Where the data will not support a
 * claim, the claim is withheld and the gap is named rather than filled.
 */

const DAY = 86_400_000;
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// A year of check-ins
// ---------------------------------------------------------------------------

export interface HappinessMonthPoint {
  /** 0-11. */
  month: number;
  label: string;
  /** Mean of the logged days. Undefined when the month holds none. */
  average?: number;
  face?: HappinessFace;
  logged: number;
  /** A month that has not happened yet is drawn differently, not as a zero. */
  isFuture: boolean;
  isCurrent: boolean;
}

export interface HappinessYear {
  year: number;
  /** Twelve points, always. A year chart with holes is still a year. */
  months: HappinessMonthPoint[];
  average?: number;
  face?: HappinessFace;
  logged: number;
  /** Days of this year that have already happened. */
  loggable: number;
  previousYearAverage?: number;
  changePercent?: number;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  reading: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A year needs more than a fortnight in it before it is worth comparing. */
export const YEAR_COMPARISON_MINIMUM_DAYS = 30;

export function happinessYear(
  reflections: Reflection[],
  year: number,
  now: Date = new Date(),
): HappinessYear {
  const logged = reflections.filter((r) => typeof r.happiness === 'number');
  const inYear = (y: number) => logged.filter((r) => r.date.startsWith(`${y}-`));

  const thisYear = inYear(year);
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();

  const months: HappinessMonthPoint[] = MONTH_SHORT.map((label, month) => {
    const rows = thisYear.filter((r) => Number(r.date.slice(5, 7)) === month + 1);
    const average = rows.length === 0
      ? undefined
      : round(rows.reduce((s, r) => s + (r.happiness ?? 0), 0) / rows.length, 1);
    return {
      month,
      label,
      average,
      face: average === undefined ? undefined : faceFor(average),
      logged: rows.length,
      isFuture: year > nowYear || (year === nowYear && month > nowMonth),
      isCurrent: year === nowYear && month === nowMonth,
    };
  });

  const average = thisYear.length === 0
    ? undefined
    : round(thisYear.reduce((s, r) => s + (r.happiness ?? 0), 0) / thisYear.length, 1);

  // Days of this year that could have been logged: the whole year once it is
  // past, and the elapsed part of it while it is running.
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const daysInYear = Math.round((end - start) / DAY);
  const loggable = year > nowYear
    ? 0
    : year < nowYear
      ? daysInYear
      : Math.round((Date.UTC(nowYear, nowMonth, now.getUTCDate()) - start) / DAY) + 1;

  const prev = inYear(year - 1);
  const previousYearAverage = prev.length === 0
    ? undefined
    : round(prev.reduce((s, r) => s + (r.happiness ?? 0), 0) / prev.length, 1);

  if (
    thisYear.length < YEAR_COMPARISON_MINIMUM_DAYS
    || prev.length < YEAR_COMPARISON_MINIMUM_DAYS
    || previousYearAverage === undefined
    || previousYearAverage === 0
    || average === undefined
  ) {
    const short = thisYear.length < YEAR_COMPARISON_MINIMUM_DAYS ? `${year}` : `${year - 1}`;
    return {
      year, months, average, face: average === undefined ? undefined : faceFor(average),
      logged: thisYear.length, loggable, previousYearAverage,
      direction: 'unknown',
      reading: `Not enough check-ins in ${short} to compare the two years. ${YEAR_COMPARISON_MINIMUM_DAYS} days is the minimum.`,
    };
  }

  const changePercent = Math.round(((average - previousYearAverage) / previousYearAverage) * 100);
  const direction: HappinessYear['direction'] =
    Math.abs(changePercent) < 2 ? 'flat' : changePercent > 0 ? 'up' : 'down';

  return {
    year, months, average, face: faceFor(average),
    logged: thisYear.length, loggable, previousYearAverage, changePercent, direction,
    reading: direction === 'flat'
      ? `About the same as ${year - 1}.`
      : `Your average check-in ${direction === 'up' ? 'rose' : 'fell'} compared with ${year - 1}.`,
  };
}

export interface HappinessYearPoint {
  year: number;
  average: number;
  logged: number;
  face: HappinessFace;
}

/**
 * One point per calendar year that holds any check-ins.
 *
 * Years with nothing logged are left out rather than plotted at zero, and a
 * year with only a handful of days is still shown — the point count is
 * returned alongside so the caller can say how thin it is instead of the
 * chart implying every point carries equal weight.
 */
export function happinessByYear(reflections: Reflection[]): HappinessYearPoint[] {
  const by = new Map<number, number[]>();
  for (const r of reflections) {
    if (typeof r.happiness !== 'number') continue;
    const y = Number(r.date.slice(0, 4));
    (by.get(y) ?? by.set(y, []).get(y)!).push(r.happiness);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, xs]) => {
      const average = round(xs.reduce((s, x) => s + x, 0) / xs.length, 1);
      return { year, average, logged: xs.length, face: faceFor(average) };
    });
}

// ---------------------------------------------------------------------------
// What moves with your mood
// ---------------------------------------------------------------------------

export interface DimensionImpact {
  domainId: LifeDomainId;
  label: string;
  /**
   * Mean check-in on days with activity in this dimension, minus days
   * without. On the 0-10 scale, so +1.2 means "a point and a bit better".
   */
  effect: number;
  strength: 'high' | 'medium';
  daysWith: number;
  daysWithout: number;
  meanWith: number;
  meanWithout: number;
  /** When this dimension started being tracked; the comparison starts here. */
  since: IsoDate;
}

export interface ImpactReport {
  /** Only dimensions the data can actually speak to, strongest first. */
  dimensions: DimensionImpact[];
  /** Named rather than silently dropped, so the gap is visible. */
  insufficient: { domainId: LifeDomainId; label: string; daysWith: number }[];
  /** Days carrying both a check-in and enough context to place it. */
  sampleDays: number;
  reading: string;
}

/**
 * Both sides of the comparison need this many days before it means anything.
 * Below it the difference between two means is mostly noise, and a bar on a
 * screen is a claim whether or not it carries a caveat.
 */
export const IMPACT_MINIMUM_DAYS = 5;

/** Above this the effect is called high; below it, medium; under, dropped. */
const HIGH_EFFECT = 0.8;
const MEDIUM_EFFECT = 0.3;

/**
 * Which dimensions co-occur with better days.
 *
 * For every day that carries a check-in, work out which dimensions saw any
 * activity — a habit kept, hours logged, a task finished — then compare the
 * mean check-in on days with that dimension against days without it.
 *
 * This is co-occurrence, not causation, and the reading says so. A good week
 * makes people more likely to exercise *and* rate the day higher; this cannot
 * tell that apart from exercise making the day better. What it can do is point
 * at where to look, which is all a dashboard should claim.
 */
export function dimensionImpact(input: {
  reflections: Reflection[];
  habits?: Habit[];
  tasks?: Task[];
  timeBudgets?: TimeBudget[];
  timeEntries?: TimeEntry[];
}): ImpactReport {
  const { reflections, habits = [], tasks = [], timeBudgets = [], timeEntries = [] } = input;

  const scored = new Map<IsoDate, number>();
  for (const r of reflections) {
    if (typeof r.happiness === 'number') scored.set(r.date, r.happiness);
  }
  if (scored.size === 0) {
    return { dimensions: [], insufficient: [], sampleDays: 0, reading: 'No check-ins to work from yet.' };
  }

  // Which dimensions saw activity on each scored day.
  const active = new Map<IsoDate, Set<LifeDomainId>>();

  /**
   * When each dimension started being tracked at all.
   *
   * This is load-bearing. Without it, a habit created last month is compared
   * against every check-in ever logged, and the two years before the habit
   * existed count as "days I chose not to do this" — which they are not. That
   * turns "you started running" into a spurious mountain of an effect. The
   * comparison window per dimension opens when its tracking did.
   */
  const trackedFrom = new Map<LifeDomainId, IsoDate>();
  const opensAt = (domainId: LifeDomainId, date: IsoDate) => {
    const at = trackedFrom.get(domainId);
    if (at === undefined || date < at) trackedFrom.set(domainId, date);
  };

  const mark = (date: IsoDate, domainId?: LifeDomainId) => {
    if (!domainId) return;
    opensAt(domainId, date);
    if (!scored.has(date)) return;
    const set = active.get(date) ?? new Set<LifeDomainId>();
    set.add(domainId);
    active.set(date, set);
  };

  // A habit's creation date opens its window even before its first completion:
  // the days between setting it up and first keeping it are real misses.
  for (const h of habits) {
    opensAt(h.domainId, h.createdAt);
    for (const c of h.completions) mark(c, h.domainId);
  }
  for (const t of tasks) if (t.completedAt) mark(t.completedAt, t.domainId);

  const budgetDomain = new Map(timeBudgets.map((b) => [b.id, b.domainId]));
  for (const b of timeBudgets) if (b.domainId) opensAt(b.domainId, b.createdAt);
  for (const e of timeEntries) {
    if (e.hours > 0) mark(e.date, budgetDomain.get(e.budgetId));
  }

  // Every dimension seen anywhere is a candidate; the day-count floor decides
  // which of them survive.
  const candidates = new Set<LifeDomainId>();
  for (const set of active.values()) for (const d of set) candidates.add(d);

  const dimensions: DimensionImpact[] = [];
  const insufficient: ImpactReport['insufficient'] = [];

  for (const domainId of candidates) {
    const from = trackedFrom.get(domainId) ?? '0000-00-00';
    const withDays: number[] = [];
    const withoutDays: number[] = [];
    for (const [date, value] of scored) {
      // Only days inside this dimension's own tracking window.
      if (date < from) continue;
      (active.get(date)?.has(domainId) ? withDays : withoutDays).push(value);
    }

    const label = getDomain(domainId).label;
    if (withDays.length < IMPACT_MINIMUM_DAYS || withoutDays.length < IMPACT_MINIMUM_DAYS) {
      insufficient.push({ domainId, label, daysWith: withDays.length });
      continue;
    }

    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const meanWith = mean(withDays);
    const meanWithout = mean(withoutDays);
    const effect = meanWith - meanWithout;

    if (Math.abs(effect) < MEDIUM_EFFECT) continue;

    dimensions.push({
      domainId,
      label,
      since: from,
      effect: round(effect, 2),
      strength: Math.abs(effect) >= HIGH_EFFECT ? 'high' : 'medium',
      daysWith: withDays.length,
      daysWithout: withoutDays.length,
      meanWith: round(meanWith, 1),
      meanWithout: round(meanWithout, 1),
    });
  }

  dimensions.sort((a, b) => b.effect - a.effect);

  const names = (xs: DimensionImpact[]) => xs.map((d) => d.label.toLowerCase()).join(' and ');
  const better = dimensions.filter((d) => d.effect > 0).slice(0, 2);
  const worse = dimensions.filter((d) => d.effect < 0).slice(-2).reverse();

  const parts: string[] = [];
  if (better.length > 0) {
    parts.push(`Your better days tend to have ${names(better)} in them.`);
  }
  if (worse.length > 0) {
    parts.push(better.length > 0
      ? `Days with ${names(worse)} in them run lower.`
      : `Your harder days tend to have ${names(worse)} in them.`);
  }

  const reading = dimensions.length === 0
    ? `Nothing stands out yet. Keep logging — this needs ${IMPACT_MINIMUM_DAYS} days on each side of a comparison before it will say anything.`
    : `${parts.join(' ')} That is a pattern in what you logged, not proof of cause — `
      + 'a good week makes people more likely to do these things and to rate the day well. It is where to look first.';

  return { dimensions, insufficient, sampleDays: scored.size, reading };
}

// ---------------------------------------------------------------------------
// What changed since last month
// ---------------------------------------------------------------------------

export interface ChangeSignal {
  id: string;
  title: string;
  detail: string;
  direction: 'up' | 'down' | 'flat';
  domainId?: LifeDomainId;
  /** The figure behind the sentence, so the claim can be checked. */
  magnitude: number;
  unit: 'percent' | 'days' | 'hours';
}

export interface ChangeReport {
  /** The one-line summary at the top of the card. Absent when nothing is sound. */
  headline?: ChangeSignal;
  signals: ChangeSignal[];
  /** Why the list is short, when it is. */
  note: string;
}

/** A month either side needs this many logged days before a delta means much. */
export const CHANGE_MINIMUM_DAYS = 5;

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const inMonth = (date: IsoDate, key: string) => date.startsWith(key);

/**
 * What is different about this month.
 *
 * Every signal is a month-over-month delta on something the person logged, so
 * each one is checkable: the habit days they kept, the hours they booked, the
 * share of days they rated well. Nothing here is inferred from anything other
 * than their own records, and a comparison whose either side is thin is left
 * out rather than reported quietly.
 */
export function changeSignals(input: {
  reflections: Reflection[];
  habits?: Habit[];
  timeBudgets?: TimeBudget[];
  timeEntries?: TimeEntry[];
}, now: Date = new Date(), monthOf: Date = now): ChangeReport {
  const { reflections, habits = [], timeBudgets = [], timeEntries = [] } = input;

  const thisKey = monthKey(monthOf);
  const prevKey = monthKey(new Date(Date.UTC(monthOf.getUTCFullYear(), monthOf.getUTCMonth() - 1, 1)));
  const prevLabel = new Date(`${prevKey}-01T12:00:00Z`)
    .toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

  const logged = reflections.filter((r) => typeof r.happiness === 'number');
  const cur = logged.filter((r) => inMonth(r.date, thisKey));
  const prev = logged.filter((r) => inMonth(r.date, prevKey));

  const curLabel = new Date(`${thisKey}-01T12:00:00Z`)
    .toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

  if (cur.length < CHANGE_MINIMUM_DAYS || prev.length < CHANGE_MINIMUM_DAYS) {
    return {
      signals: [],
      note: `Two months of at least ${CHANGE_MINIMUM_DAYS} check-ins each are needed before this can compare them. `
        + `You have ${cur.length} in ${curLabel} and ${prev.length} in ${prevLabel}.`,
    };
  }

  const mean = (xs: Reflection[]) => xs.reduce((s, r) => s + (r.happiness ?? 0), 0) / xs.length;
  const curMean = mean(cur);
  const prevMean = mean(prev);
  const pct = prevMean === 0 ? 0 : Math.round(((curMean - prevMean) / prevMean) * 100);
  const dir = (n: number, tol = 2): ChangeSignal['direction'] =>
    Math.abs(n) < tol ? 'flat' : n > 0 ? 'up' : 'down';

  // The share of days rated 7 or better, which is what "more good days" means
  // in a way that survives being asked what it means.
  const goodShare = (xs: Reflection[]) => xs.filter((r) => (r.happiness ?? 0) >= 7).length / xs.length;
  const goodDelta = Math.round((goodShare(cur) - goodShare(prev)) * 100);

  const move = dir(pct);
  const headline: ChangeSignal = {
    id: 'happiness',
    title: move === 'up' ? 'Your happiness is trending up'
      : move === 'down' ? 'Your happiness is trending down'
        : 'Your happiness is holding steady',
    detail: `Your average check-in ${move === 'flat' ? 'is about level with' : `is ${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than`} ${prevLabel}`
      + (Math.abs(goodDelta) >= 5
        ? `, and ${Math.abs(goodDelta)}% ${goodDelta > 0 ? 'more' : 'fewer'} of your days landed at happy or better.`
        : '.'),
    direction: move,
    magnitude: pct,
    unit: 'percent',
  };

  const signals: ChangeSignal[] = [];

  // --- habit days kept, per dimension --------------------------------------
  const keptIn = (key: string, domainId: LifeDomainId) =>
    habits.filter((h) => h.domainId === domainId)
      .reduce((n, h) => n + h.completions.filter((c) => inMonth(c, key)).length, 0);

  const domainsWithHabits = [...new Set(habits.map((h) => h.domainId))];
  const habitDeltas = domainsWithHabits
    .map((domainId) => ({ domainId, delta: keptIn(thisKey, domainId) - keptIn(prevKey, domainId) }))
    .filter((d) => Math.abs(d.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // At most two, and they are the two that moved most — a list of eleven
  // dimensions each shifting by a day is a table, not an insight.
  for (const { domainId, delta } of habitDeltas.slice(0, 2)) {
    const label = getDomain(domainId).label;
    signals.push({
      id: `habits-${domainId}`,
      domainId,
      title: `${label} habits ${delta > 0 ? 'on the rise' : 'slipping'}`,
      detail: `You kept ${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} ${label.toLowerCase()} habit days this month than in ${prevLabel}.`,
      direction: delta > 0 ? 'up' : 'down',
      magnitude: delta,
      unit: 'days',
    });
  }

  // --- hours logged, per budget --------------------------------------------
  const hoursIn = (key: string, budgetId: string) =>
    timeEntries.filter((e) => e.budgetId === budgetId && inMonth(e.date, key))
      .reduce((n, e) => n + e.hours, 0);

  const hourDeltas = timeBudgets
    .filter((b) => !b.archivedAt)
    .map((b) => ({ b, delta: round(hoursIn(thisKey, b.id) - hoursIn(prevKey, b.id), 1) }))
    .filter((d) => Math.abs(d.delta) >= 4)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  for (const { b, delta } of hourDeltas.slice(0, 1)) {
    signals.push({
      id: `hours-${b.id}`,
      domainId: b.domainId,
      title: `${b.label} ${delta > 0 ? 'went up' : 'came down'}`,
      detail: `You logged ${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} hours of ${b.label.toLowerCase()} than in ${prevLabel}.`,
      direction: delta > 0 ? 'up' : 'down',
      magnitude: delta,
      unit: 'hours',
    });
  }

  // --- how steady the month was --------------------------------------------
  const spread = (xs: Reflection[]) => {
    const m = mean(xs);
    return Math.sqrt(xs.reduce((s, r) => s + ((r.happiness ?? 0) - m) ** 2, 0) / xs.length);
  };
  const steadier = round(spread(prev) - spread(cur), 2);
  if (Math.abs(steadier) >= 0.4) {
    signals.push({
      id: 'consistency',
      title: steadier > 0 ? 'Steadier days' : 'More up and down',
      detail: steadier > 0
        ? `Your days varied less than in ${prevLabel} — fewer swings in either direction.`
        : `Your days swung more than in ${prevLabel}, with bigger gaps between the good and the hard ones.`,
      direction: steadier > 0 ? 'up' : 'down',
      magnitude: steadier,
      unit: 'percent',
    });
  }

  return {
    headline,
    signals,
    note: signals.length === 0
      ? `Nothing else moved enough to be worth calling out against ${prevLabel}.`
      : 'These are month-over-month changes in what you logged. They update as you log more.',
  };
}
