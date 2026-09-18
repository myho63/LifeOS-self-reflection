import { clamp, round } from '../util/math.js';
import type { IsoDate, LifeDomainId } from '../types.js';

/**
 * Time and work: hours intended against hours spent.
 *
 * This is the one place the product measures a life in hours rather than in
 * ratings, and it exists because "career is a deficit" and "you gave career
 * four hours last week" are different facts, and only the second one can be
 * argued with.
 *
 * Budgets are periodic and rolling rather than calendar-locked. A week that
 * resets on Monday punishes anyone whose work does not, and the useful
 * question is "over the last seven days", not "since an arbitrary boundary".
 */

export type BudgetPeriod = 'week' | 'month';

export interface TimeBudget {
  id: string;
  /** "Deep work", "Time with family". The user's own words. */
  label: string;
  /** Hours intended per period. */
  goalHours: number;
  period: BudgetPeriod;
  /** Optional: which dimension these hours are being spent on. */
  domainId?: LifeDomainId;
  createdAt: IsoDate;
  archivedAt?: IsoDate;
}

export interface TimeEntry {
  id: string;
  budgetId: string;
  date: IsoDate;
  hours: number;
}

export interface BudgetSummary {
  budgetId: string;
  label: string;
  domainId?: LifeDomainId;
  period: BudgetPeriod;
  goalHours: number;
  /** Hours logged inside the window. */
  actualHours: number;
  /** actual / goal, 0-1 for the bar. Uncapped figure is in `ratio`. */
  progress: number;
  /** Uncapped, so over-spending is visible rather than clipped to 100%. */
  ratio: number;
  /**
   * Over, under, or on track. "On track" is a band, not a point: a goal of 40
   * met at 38 is not a failure, and a product that says so teaches people to
   * stop logging.
   */
  state: 'on track' | 'under' | 'over' | 'not started';
}

export interface TimeSummary {
  period: BudgetPeriod;
  from: IsoDate;
  to: IsoDate;
  budgets: BudgetSummary[];
  totalGoalHours: number;
  totalActualHours: number;
  /** 0-1 across all budgets in the period. */
  overall: number;
}

const DAY = 86_400_000;
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);

const WINDOW_DAYS: Record<BudgetPeriod, number> = { week: 7, month: 30 };

/** Under 85% of goal is under; over 115% is over; the band between is on track. */
const UNDER = 0.85;
const OVER = 1.15;

export function timeSummary(
  budgets: TimeBudget[],
  entries: TimeEntry[],
  period: BudgetPeriod = 'week',
  now: Date = new Date(),
): TimeSummary {
  const days = WINDOW_DAYS[period];
  const from = iso(new Date(now.getTime() - (days - 1) * DAY));
  const to = iso(now);

  const active = budgets.filter((b) => !b.archivedAt && b.period === period);

  const hoursBy = new Map<string, number>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    hoursBy.set(e.budgetId, (hoursBy.get(e.budgetId) ?? 0) + e.hours);
  }

  const summaries: BudgetSummary[] = active.map((b) => {
    const actualHours = round(hoursBy.get(b.id) ?? 0, 1);
    const ratio = b.goalHours === 0 ? 0 : actualHours / b.goalHours;
    const state: BudgetSummary['state'] =
      actualHours === 0 ? 'not started'
        : ratio < UNDER ? 'under'
          : ratio > OVER ? 'over'
            : 'on track';
    return {
      budgetId: b.id,
      label: b.label,
      domainId: b.domainId,
      period: b.period,
      goalHours: b.goalHours,
      actualHours,
      progress: round(clamp(ratio, 0, 1), 3),
      ratio: round(ratio, 3),
      state,
    };
  });

  const totalGoalHours = round(summaries.reduce((s, b) => s + b.goalHours, 0), 1);
  const totalActualHours = round(summaries.reduce((s, b) => s + b.actualHours, 0), 1);

  return {
    period,
    from,
    to,
    budgets: summaries,
    totalGoalHours,
    totalActualHours,
    overall: totalGoalHours === 0 ? 0 : round(clamp(totalActualHours / totalGoalHours, 0, 1), 3),
  };
}

/** Hours per day inside the window, for a bar chart or a heat strip. */
export function dailyHours(
  entries: TimeEntry[],
  period: BudgetPeriod = 'week',
  now: Date = new Date(),
): { date: IsoDate; hours: number }[] {
  const days = WINDOW_DAYS[period];
  const by = new Map<string, number>();
  for (const e of entries) by.set(e.date, (by.get(e.date) ?? 0) + e.hours);

  return Array.from({ length: days }, (_, i) => {
    const d = iso(new Date(now.getTime() - (days - 1 - i) * DAY));
    return { date: d, hours: round(by.get(d) ?? 0, 1) };
  });
}
