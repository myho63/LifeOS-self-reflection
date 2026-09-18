import { round } from '../util/math.js';
import type { IsoDate } from '../types.js';
import type { Habit, Reflection } from '../practice/engine.js';
import { habitStatus } from '../practice/engine.js';

/**
 * Wellbeing: the daily check-in and what it adds up to.
 *
 * The check-in is one tap on a five-face scale, because the thing that has to
 * survive here is the *habit of logging*, and a five-point scale gets logged on
 * a bad day where a five-slider form does not. The value is still stored 0-10,
 * so a face is a coarse entry into a finer scale rather than a different one —
 * a user who later wants the sliders keeps their history.
 */

export interface HappinessFace {
  /** What gets stored, 0-10. The midpoint of the band this face covers. */
  value: number;
  label: string;
  emoji: string;
  /** Band index, 0 (lowest) to 4. Used for colour, never for arithmetic. */
  band: 0 | 1 | 2 | 3 | 4;
}

export const HAPPINESS_FACES: HappinessFace[] = [
  { value: 1, label: 'Very unhappy', emoji: '😖', band: 0 },
  { value: 3, label: 'Unhappy', emoji: '🙁', band: 1 },
  { value: 5, label: 'Neutral', emoji: '😐', band: 2 },
  { value: 7, label: 'Happy', emoji: '🙂', band: 3 },
  { value: 9, label: 'Very happy', emoji: '😀', band: 4 },
];

/** The face that represents a stored 0-10 value. */
export function faceFor(value: number): HappinessFace {
  const band = value < 2 ? 0 : value < 4 ? 1 : value < 6 ? 2 : value < 8 ? 3 : 4;
  return HAPPINESS_FACES[band]!;
}

const DAY = 86_400_000;
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// The month calendar
// ---------------------------------------------------------------------------

export interface HappinessDay {
  date: IsoDate;
  dayOfMonth: number;
  /** Monday = 0, matching the calendar's own column order. */
  weekday: number;
  /** Undefined when the day was not logged. Never defaulted to a middle value. */
  value?: number;
  face?: HappinessFace;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface HappinessMonth {
  /** First day of the month, as an ISO date. */
  month: IsoDate;
  label: string;
  /**
   * Six weeks of seven days, Monday-first, including the leading and trailing
   * days from the neighbouring months that fill the grid. A calendar that
   * changes height between months is harder to read across a scroll.
   */
  days: HappinessDay[];
  /** Mean of the logged days only. Undefined when nothing was logged. */
  average?: number;
  face?: HappinessFace;
  logged: number;
  /** Days in the month that have actually happened — the honest denominator. */
  loggable: number;
}

const MONTH_LABEL = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A month of check-ins laid out as a calendar grid.
 *
 * `loggable` counts days that have already happened rather than days in the
 * month, so "21 of 30 logged" on the 2nd does not read as a month of failure.
 */
export function happinessMonth(
  reflections: Reflection[],
  monthOf: Date = new Date(),
  now: Date = new Date(),
): HappinessMonth {
  const year = monthOf.getUTCFullYear();
  const month = monthOf.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const by = new Map<string, number>();
  for (const r of reflections) {
    if (typeof r.happiness === 'number') by.set(r.date, r.happiness);
  }

  // Monday-first: getUTCDay() is Sunday-0, so shift it.
  const lead = (first.getUTCDay() + 6) % 7;
  const today = iso(now);

  const days: HappinessDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getTime() + (i - lead) * DAY);
    const key = iso(d);
    const value = by.get(key);
    days.push({
      date: key,
      dayOfMonth: d.getUTCDate(),
      weekday: (d.getUTCDay() + 6) % 7,
      value,
      face: value === undefined ? undefined : faceFor(value),
      inMonth: d.getUTCMonth() === month && d.getUTCFullYear() === year,
      isToday: key === today,
      isFuture: key > today,
    });
  }

  const logged = days.filter((d) => d.inMonth && d.value !== undefined);
  const average = logged.length === 0
    ? undefined
    : round(logged.reduce((s, d) => s + (d.value ?? 0), 0) / logged.length, 1);

  const loggable = days.filter((d) => d.inMonth && !d.isFuture).length;

  return {
    month: iso(first),
    label: MONTH_LABEL(first),
    days,
    average,
    face: average === undefined ? undefined : faceFor(average),
    logged: logged.length,
    loggable: Math.max(0, Math.min(daysInMonth, loggable)),
  };
}

// ---------------------------------------------------------------------------
// Month over month
// ---------------------------------------------------------------------------

export interface HappinessComparison {
  current: HappinessMonth;
  previousLabel: string;
  previousAverage?: number;
  /** Percentage change against last month, rounded. Undefined when not sound. */
  changePercent?: number;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  /** Always present, and says plainly when there is nothing to compare. */
  reading: string;
}

/**
 * How this month compares with the last.
 *
 * The comparison is withheld unless both months carry enough logged days to
 * mean anything. Five is the floor: a month averaged from two taps is not a
 * month, and "12% happier than August" computed from two data points is the
 * kind of number that makes a person distrust every other number on the page.
 */
export const COMPARISON_MINIMUM_DAYS = 5;

export function happinessComparison(
  reflections: Reflection[],
  now: Date = new Date(),
  /** Which month is "current". Defaults to the one `now` falls in. */
  monthOf: Date = now,
): HappinessComparison {
  const current = happinessMonth(reflections, monthOf, now);
  const prevDate = new Date(Date.UTC(monthOf.getUTCFullYear(), monthOf.getUTCMonth() - 1, 1));
  const previous = happinessMonth(reflections, prevDate, now);
  const previousLabel = previous.label.replace(/ \d{4}$/, '');

  if (current.logged < COMPARISON_MINIMUM_DAYS || previous.logged < COMPARISON_MINIMUM_DAYS) {
    const currentLabel = current.label.replace(/ \d{4}$/, '');
    const short = current.logged < COMPARISON_MINIMUM_DAYS ? currentLabel : previousLabel;
    return {
      current,
      previousLabel,
      previousAverage: previous.average,
      direction: 'unknown',
      reading: `Not enough check-ins in ${short} to compare the two yet. ${COMPARISON_MINIMUM_DAYS} days is the minimum.`,
    };
  }

  const a = current.average ?? 0;
  const b = previous.average ?? 0;
  const changePercent = b === 0 ? undefined : Math.round(((a - b) / b) * 100);
  const direction: HappinessComparison['direction'] =
    changePercent === undefined || Math.abs(changePercent) < 2
      ? 'flat'
      : changePercent > 0 ? 'up' : 'down';

  const reading = direction === 'flat'
    ? `About the same as ${previousLabel}. Steady is not nothing.`
    : direction === 'up'
      ? `Your average check-in rose compared with ${previousLabel}.`
      : `Your average check-in fell compared with ${previousLabel}. Worth a look at what changed.`;

  return {
    current,
    previousLabel,
    previousAverage: previous.average,
    changePercent,
    direction,
    reading,
  };
}

// ---------------------------------------------------------------------------
// Habit consistency
// ---------------------------------------------------------------------------

export interface HabitConsistency {
  /** Habits that met every scheduled day so far this week. */
  completed: number;
  /** Met some but not all. */
  partial: number;
  /** Met none of the days that have already come round. */
  missed: number;
  /** Scheduled days kept, over scheduled days elapsed. 0-1. */
  overall: number;
  scheduled: number;
  done: number;
  achieved: number;
}

/**
 * The week at a glance, per habit rather than per day.
 *
 * Three buckets, and the distinction between them is the useful part: five
 * habits at 80% is a different week from four perfect and one abandoned, and a
 * single completion percentage cannot tell them apart.
 *
 * Days still to come are excluded. A habit scheduled for Friday is not
 * "missed" on Tuesday, and counting it that way would make every week open in
 * failure and close in relief.
 */
export function habitConsistency(habits: Habit[], now: Date = new Date()): HabitConsistency {
  const active = habits.filter((h) => !h.achievedAt && !h.archivedAt);

  let completed = 0;
  let partial = 0;
  let missed = 0;
  let scheduled = 0;
  let done = 0;

  for (const h of active) {
    const status = habitStatus(h, now);
    const elapsed = status.week.filter((d) => d.scheduled && !d.future);
    if (elapsed.length === 0) continue;

    const met = elapsed.filter((d) => d.done).length;
    scheduled += elapsed.length;
    done += met;

    if (met === elapsed.length) completed++;
    else if (met > 0) partial++;
    else missed++;
  }

  return {
    completed,
    partial,
    missed,
    overall: scheduled === 0 ? 0 : round(done / scheduled, 3),
    scheduled,
    done,
    achieved: habits.filter((h) => h.achievedAt).length,
  };
}
