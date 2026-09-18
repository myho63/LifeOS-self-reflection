import { getDomain } from '../taxonomy/domains.js';
import { getStage } from '../taxonomy/stages.js';
import { clamp, round } from '../util/math.js';
import type { LifeDomainId, LifeStageId, OrientationPlan, ProfileSignals, SegmentationResult } from '../types.js';
import type { BalanceReport } from '../balance/engine.js';

/**
 * Scores, as the dashboard shows them.
 *
 * The dashboard speaks in 0-100. The engine works in 0-1. This module is the
 * single place that conversion happens, so a percentage on screen always traces
 * back to one definition rather than three slightly different roundings.
 *
 * Two numbers per dimension, and keeping them distinct is the whole point:
 *
 *   priorityScore — how much this *should* matter at this life stage
 *   yourScore     — how it is *actually* going, from the user's own rating
 *
 * The radar draws both. The ranked list ("Health 86") is priority, because that
 * is the question the list answers: what deserves your attention now.
 */

export interface DimensionScore {
  domainId: LifeDomainId;
  label: string;
  short: string;
  /** 0-100. What the life stage says this deserves. The ranked-list number. */
  priorityScore: number;
  /** 0-100 from the self-rating, or undefined when unrated. */
  yourScore?: number;
  rank: number;
  /** priorityScore - yourScore, positive means falling short. */
  gap?: number;
  state: BalanceReport['dimensions'][number]['state'];
  why: string;
}

export interface LifeScore {
  /** 0-100 headline. */
  value: number;
  band: 'needs attention' | 'finding your feet' | 'good progress' | 'thriving';
  /** The two halves, so the number is never a black box. */
  parts: { standing: number; consistency: number };
  /** Null until there is something to compare against. */
  changeSincePrevious?: number;
}

export interface Level {
  level: number;
  /** Named for where they are, not for how much they have used the app. */
  title: string;
  /** 0-1 toward the next level. */
  progress: number;
  /** What actually earned it, so it is never mysterious. */
  basis: string;
}

export function dimensionScores(plan: OrientationPlan, report: BalanceReport): DimensionScore[] {
  return report.dimensions.map((d, index) => {
    const domain = getDomain(d.domainId);
    const priorityScore = Math.round(d.priority * 100);
    const yourScore = d.standing === undefined ? undefined : Math.round(d.standing * 100);
    return {
      domainId: d.domainId,
      label: domain.label,
      short: domain.short,
      priorityScore,
      yourScore,
      rank: index + 1,
      gap: yourScore === undefined ? undefined : priorityScore - yourScore,
      state: d.state,
      why: plan.priorities.find((p) => p.domainId === d.domainId)?.why ?? domain.purpose,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore)
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

export interface ConsistencyInput {
  /** Fraction of scheduled habit occurrences completed recently, 0-1. */
  habitCompletion?: number;
  /** Fraction of planned tasks completed recently, 0-1. */
  taskCompletion?: number;
}

/**
 * The Life Score.
 *
 * Seventy per cent is how the person rates their life against what matters at
 * this stage; thirty per cent is whether they are actually doing the things
 * they said they would. A score made only of self-ratings drifts with mood and
 * never moves when you act; a score made only of completions rewards busywork
 * in dimensions that do not matter. Both halves are returned separately so the
 * user can see which one moved.
 *
 * With nothing rated there is no score — not a zero, and not a cheerful
 * default. `value` stays 0 and the band says so.
 */
export function lifeScore(
  report: BalanceReport,
  consistency: ConsistencyInput = {},
  previous?: number,
): LifeScore {
  const standing = report.weightedStanding ?? 0;
  const completions = [consistency.habitCompletion, consistency.taskCompletion]
    .filter((v): v is number => typeof v === 'number');
  const consistencyPart = completions.length
    ? completions.reduce((a, b) => a + b, 0) / completions.length
    : standing; // No practice data yet: do not punish, mirror the standing.

  const value = Math.round(clamp(standing * 0.7 + consistencyPart * 0.3, 0, 1) * 100);

  return {
    value,
    band: value >= 80 ? 'thriving' : value >= 60 ? 'good progress' : value >= 40 ? 'finding your feet' : 'needs attention',
    parts: { standing: Math.round(standing * 100), consistency: Math.round(consistencyPart * 100) },
    changeSincePrevious: previous === undefined ? undefined : value - previous,
  };
}

/**
 * Level.
 *
 * Earned by things that actually mean something — habits sustained to the point
 * of being automatic, milestones reached, dimensions kept honestly rated — and
 * deliberately not by opening the app. A level that rises for showing up is a
 * slot machine; a level that rises for finishing things is a record.
 */
export function levelFrom(input: {
  habitsAchieved: number;
  milestonesCompleted: number;
  dimensionsRated: number;
}): Level {
  const points = input.habitsAchieved * 10 + input.milestonesCompleted * 6 + input.dimensionsRated * 2;
  const level = Math.max(1, Math.floor(Math.sqrt(points / 4)) + 1);
  const atThis = 4 * (level - 1) ** 2;
  const atNext = 4 * level ** 2;
  const titles = ['Starting out', 'Explorer', 'Builder', 'Navigator', 'Steward'];
  return {
    level,
    title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))] ?? 'Explorer',
    progress: round(clamp((points - atThis) / Math.max(1, atNext - atThis), 0, 1), 2),
    basis: `${input.habitsAchieved} habits made automatic, ${input.milestonesCompleted} milestones reached, ${input.dimensionsRated} dimensions kept current`,
  };
}

// ---------------------------------------------------------------------------
// Segment
// ---------------------------------------------------------------------------

export interface Segment {
  /** "Young Adult (20-29)" */
  ageBandLabel: string;
  /** "Single • No Kids" */
  householdLabel: string;
  /** "Career Explorer" */
  archetype: string;
  /** The whole thing, as one line. */
  label: string;
  stageId: LifeStageId;
  /**
   * Share of users in the same segment, 0-1.
   *
   * Undefined until a real distribution is supplied. A fabricated "23% of
   * users" is the easiest number in this product to invent and the fastest way
   * to lose the user's trust in every other number on the page.
   */
  cohortShare?: number;
  keyFocus: string[];
}

const ARCHETYPE: Record<LifeStageId, string> = {
  foundation: 'Finding Your Feet',
  launch: 'Career Explorer',
  establish: 'Foundation Builder',
  partnering: 'Partnership Builder',
  expecting: 'Preparing for Family',
  early_family: 'Hands-Full Parent',
  school_family: 'Family Navigator',
  teen_family: 'Launching a Teenager',
  consolidating: 'Mid-Career Reviewer',
  pivot: 'In Transition',
  sandwich: 'Carer in the Middle',
  empty_nest: 'Second Act',
  pre_retirement: 'Winding Down',
  later_life: 'Living It',
};

function ageBandLabel(age?: number): string {
  if (age === undefined) return 'Age not given';
  if (age < 18) return `Teen (${age})`;
  if (age < 20) return 'Young Adult (18-19)';
  if (age < 30) return 'Young Adult (20-29)';
  if (age < 40) return 'Adult (30-39)';
  if (age < 50) return 'Adult (40-49)';
  if (age < 60) return 'Midlife (50-59)';
  if (age < 70) return 'Later Career (60-69)';
  return 'Later Life (70+)';
}

function householdLabel(signals: ProfileSignals): string {
  const rel = signals.relationshipStatus;
  const partnered = rel === 'married' || rel === 'cohabiting';
  const relLabel = partnered ? (rel === 'married' ? 'Married' : 'Partnered')
    : rel === 'dating' ? 'Dating'
    : rel === 'separated' || rel === 'divorced' ? 'Separated'
    : rel === 'widowed' ? 'Widowed'
    : rel === 'single' ? 'Single' : 'Household unknown';

  const kids = signals.children;
  if (kids === undefined) return relLabel;
  const dependent = kids.filter((c) => c.dependent);
  const kidLabel = dependent.length === 0
    ? (kids.length > 0 ? 'Grown Kids' : 'No Kids')
    : dependent.length === 1 ? '1 Child' : `${dependent.length} Children`;
  return `${relLabel} • ${kidLabel}`;
}

export interface CohortDistribution {
  /** Count of users per segment label. Supplied by the analytics layer. */
  counts: Record<string, number>;
  total: number;
}

export function segmentOf(
  segmentation: SegmentationResult,
  signals: ProfileSignals,
  cohort?: CohortDistribution,
): Segment {
  const stage = getStage(segmentation.primary.stageId);
  const band = ageBandLabel(signals.ageYears);
  const household = householdLabel(signals);
  const archetype = ARCHETYPE[stage.id];
  const label = `${band} · ${household} · ${archetype}`;

  const share = cohort && cohort.total > 0 ? (cohort.counts[label] ?? 0) / cohort.total : undefined;

  return {
    ageBandLabel: band,
    householdLabel: household,
    archetype,
    label,
    stageId: stage.id,
    cohortShare: share === undefined ? undefined : round(share, 3),
    keyFocus: stage.milestones.map((m) => m.title),
  };
}
