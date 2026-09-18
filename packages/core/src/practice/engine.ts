import { round } from '../util/math.js';
import type { IsoDate, LifeDomainId } from '../types.js';

/**
 * The daily loop: habits, tasks and reflection.
 *
 * The habit model follows Atomic Habits in the one way that matters
 * structurally — a habit is a small action attached to a cue on set days, and
 * the goal is for it to stop needing willpower. Which is why habits can be
 * **achieved** and leave the active list: a product that keeps "drink water" on
 * screen for three years has misunderstood what a habit is for.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0

export interface Habit {
  id: string;
  title: string;
  domainId: LifeDomainId;
  /** Days it is meant to happen. Four days a week is a schedule, not a failure. */
  schedule: Weekday[];
  /** The Atomic Habits cue: "after I make coffee". Optional but high-value. */
  cue?: string;
  createdAt: IsoDate;
  /** Dates it was actually done. */
  completions: IsoDate[];
  /** Set once sustained long enough to be automatic; it leaves the active list. */
  achievedAt?: IsoDate;
  archivedAt?: IsoDate;
}

export interface HabitStatus {
  habitId: string;
  title: string;
  domainId: LifeDomainId;
  /** Consecutive scheduled days met, counting back from today. */
  streak: number;
  /** Completed vs scheduled this week. */
  thisWeek: { done: number; scheduled: number };
  /** Per-weekday state for the M T W T F S S strip. */
  week: { day: Weekday; scheduled: boolean; done: boolean; future: boolean }[];
  doneToday: boolean;
  scheduledToday: boolean;
  achieved: boolean;
  /** 0-1 over the qualifying window, used for the Life Score. */
  adherence: number;
}

const DAY = 86_400_000;
const iso = (d: Date): IsoDate => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Sunday-start week containing `now`, matching the M-T-W-T-F-S-S strip. */
function weekDays(now: Date): Date[] {
  const start = addDays(now, -now.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Sustained this long on schedule and it is no longer a habit you are building. */
export const ACHIEVEMENT_WINDOW_DAYS = 66;
const ACHIEVEMENT_ADHERENCE = 0.85;

export function habitStatus(habit: Habit, now: Date = new Date()): HabitStatus {
  const done = new Set(habit.completions);
  const today = iso(now);
  const scheduledToday = habit.schedule.includes(now.getUTCDay() as Weekday);

  const week = weekDays(now).map((d) => {
    const day = d.getUTCDay() as Weekday;
    return {
      day,
      scheduled: habit.schedule.includes(day),
      done: done.has(iso(d)),
      future: d.getTime() > now.getTime() && iso(d) !== today,
    };
  });

  // Streak counts scheduled days only — missing a day the habit was never meant
  // to happen on must not break it.
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(now, -i);
    if (!habit.schedule.includes(d.getUTCDay() as Weekday)) continue;
    if (done.has(iso(d))) streak++;
    else if (i > 0 || !scheduledToday) break;
    else break;
  }

  // Adherence over the achievement window, or since creation if newer.
  const created = new Date(habit.createdAt).getTime();
  const windowStart = Math.max(created, now.getTime() - ACHIEVEMENT_WINDOW_DAYS * DAY);
  let scheduled = 0;
  let met = 0;
  for (let t = windowStart; t <= now.getTime(); t += DAY) {
    const d = new Date(t);
    if (!habit.schedule.includes(d.getUTCDay() as Weekday)) continue;
    scheduled++;
    if (done.has(iso(d))) met++;
  }

  const thisWeek = week.filter((w) => w.scheduled && !w.future);
  return {
    habitId: habit.id,
    title: habit.title,
    domainId: habit.domainId,
    streak,
    thisWeek: { done: thisWeek.filter((w) => w.done).length, scheduled: week.filter((w) => w.scheduled).length },
    week,
    doneToday: done.has(today),
    scheduledToday,
    achieved: Boolean(habit.achievedAt),
    adherence: scheduled === 0 ? 0 : round(met / scheduled, 3),
  };
}

/**
 * Has this habit become automatic?
 *
 * Long enough on schedule, kept most of the time. The threshold is generous on
 * purpose — 85% over about two months, not perfection — because demanding an
 * unbroken run teaches people that one missed day ruins everything, which is
 * the opposite of the behaviour a habit product wants.
 */
export function readyToAchieve(habit: Habit, now: Date = new Date()): boolean {
  if (habit.achievedAt || habit.archivedAt) return false;
  const ageDays = (now.getTime() - new Date(habit.createdAt).getTime()) / DAY;
  if (ageDays < ACHIEVEMENT_WINDOW_DAYS) return false;
  return habitStatus(habit, now).adherence >= ACHIEVEMENT_ADHERENCE;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  domainId?: LifeDomainId;
  /** Links a task to the goal it serves, when it serves one. */
  goalId?: string;
  dueDate?: IsoDate;
  completedAt?: IsoDate;
  createdAt: IsoDate;
}

export interface TodayPlan {
  date: IsoDate;
  tasks: Task[];
  done: number;
  total: number;
  /** 0-1. */
  completion: number;
}

export function todayPlan(tasks: Task[], now: Date = new Date()): TodayPlan {
  const today = iso(now);
  // Today's plan is what is due today, overdue, or undated — not the backlog.
  const relevant = tasks.filter((t) => {
    if (t.completedAt) return t.completedAt === today;
    return t.dueDate === undefined || t.dueDate <= today;
  });
  const done = relevant.filter((t) => t.completedAt).length;
  return {
    date: today,
    tasks: relevant,
    done,
    total: relevant.length,
    completion: relevant.length === 0 ? 0 : round(done / relevant.length, 3),
  };
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

export interface Reflection {
  date: IsoDate;
  /** Each 0-10. */
  happiness?: number;
  motivation?: number;
  satisfaction?: number;
  purpose?: number;
  meaning?: number;
  note?: string;
}

export const REFLECTION_PROMPTS = [
  { key: 'happiness', label: 'Happiness', emoji: '😊' },
  { key: 'motivation', label: 'Motivation', emoji: '🔥' },
  { key: 'satisfaction', label: 'Satisfaction', emoji: '🙂' },
  { key: 'purpose', label: 'Sense of purpose', emoji: '🧭' },
  { key: 'meaning', label: 'Meaning', emoji: '✨' },
] as const;

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface ProgressSummary {
  /** Consecutive days with any completion at all. */
  consistencyDays: number;
  /** 0-1 over the last 28 days. */
  planCompletion: number;
  habitAdherence: number;
  activeHabits: number;
  achievedHabits: number;
  /** Life Score over time, oldest first. */
  trend: { date: IsoDate; value: number }[];
}

export function progressSummary(
  habits: Habit[],
  tasks: Task[],
  trend: { date: IsoDate; value: number }[] = [],
  now: Date = new Date(),
): ProgressSummary {
  const active = habits.filter((h) => !h.achievedAt && !h.archivedAt);
  const statuses = active.map((h) => habitStatus(h, now));

  const activity = new Set<string>();
  for (const h of habits) for (const c of h.completions) activity.add(c);
  for (const t of tasks) if (t.completedAt) activity.add(t.completedAt);

  let consistencyDays = 0;
  for (let i = 0; i < 400; i++) {
    const d = iso(addDays(now, -i));
    if (activity.has(d)) consistencyDays++;
    // Today not yet logged should not read as a broken streak.
    else if (i > 0) break;
  }

  const windowStart = now.getTime() - 28 * DAY;
  const recent = tasks.filter((t) => new Date(t.createdAt).getTime() >= windowStart);
  const planCompletion = recent.length === 0 ? 0 : round(recent.filter((t) => t.completedAt).length / recent.length, 3);

  return {
    consistencyDays,
    planCompletion,
    habitAdherence: statuses.length === 0 ? 0 : round(statuses.reduce((s, h) => s + h.adherence, 0) / statuses.length, 3),
    activeHabits: active.length,
    achievedHabits: habits.filter((h) => h.achievedAt).length,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Vision board
// ---------------------------------------------------------------------------

export interface VisionBoard {
  /** The person's own words about the life they are building. */
  statement?: string;
  /**
   * Image slots. `url` is filled by the client from the user's own uploads or a
   * licensed library — this package never invents or generates imagery, and a
   * slot with no url renders as an empty frame rather than a stock photo
   * standing in for someone's life.
   */
  images: { id: string; caption?: string; url?: string; domainId?: LifeDomainId }[];
  updatedAt?: IsoDate;
}
