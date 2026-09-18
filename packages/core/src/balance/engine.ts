import { getDomain, upstreamOf } from '../taxonomy/domains.js';
import { round } from '../util/math.js';
import type { LifeDomainId, OrientationPlan } from '../types.js';
import type { Assessment, DimensionRating } from '../assessment/types.js';

/**
 * The balance engine.
 *
 * Segmentation says how much a dimension *should* matter. Assessment says how
 * it is *actually going*. This module is the subtraction, and it is the reason
 * the product is more than either half:
 *
 *     gap = priority × (1 − standing)
 *
 * A high gap is not "you are bad at this". It is "this matters a lot right now
 * and it is not going well", which is a completely different sentence and the
 * only one worth acting on.
 *
 * The four states are what let the app say the useful thing — that someone is
 * not failing at life, they are misallocated. Naming an over-invested dimension
 * is what makes the advice actionable, because attention has to come from
 * somewhere.
 */

export type BalanceState =
  /** Matters a lot, going well. Protect it. */
  | 'aligned'
  /** Matters a lot, not going well. This is where to act. */
  | 'deficit'
  /** Matters less right now, going very well. A possible source of attention. */
  | 'overinvested'
  /** Matters less right now, not going well. Fine to leave for now. */
  | 'dormant';

export interface DimensionBalance {
  domainId: LifeDomainId;
  label: string;
  short: string;
  /** 0-1 relative priority from the life stage. */
  priority: number;
  /** 0-1 self-rated standing, or undefined when unrated. */
  standing?: number;
  state: BalanceState;
  /** priority × (1 − standing), 0-1. Undefined when unrated. */
  gap?: number;
  /** Gap weighted by how reliably this stage ignores the dimension. */
  neglectRisk?: number;
  /** True when the rating is old enough to be worth re-asking. */
  stale: boolean;
  /** Dimensions feeding this one that are themselves in deficit. */
  blockedBy: LifeDomainId[];
  note: string;
}

export interface Reallocation {
  from: LifeDomainId;
  fromLabel: string;
  to: LifeDomainId;
  toLabel: string;
  note: string;
}

export interface BalanceReport {
  dimensions: DimensionBalance[];
  deficits: DimensionBalance[];
  overinvested: DimensionBalance[];
  /** The one-sentence read on the shape of this life right now. */
  headline: string;
  /** Where attention could come from and where it should go. */
  reallocation?: Reallocation;
  /** Fraction of dimensions that carry a usable rating. */
  coverage: number;
  unrated: LifeDomainId[];
  /** Ratings old enough to be worth refreshing, oldest first. */
  stale: LifeDomainId[];
  /** Overall standing across rated dimensions, weighted by priority. 0-1. */
  weightedStanding?: number;
}

export interface BalanceOptions {
  /** Priority at or above this counts as "matters a lot". */
  priorityThreshold?: number;
  /** Standing at or above this counts as "going well". */
  standingThreshold?: number;
  /** Standing at or above this is needed to call something over-invested. */
  overinvestedThreshold?: number;
  /** Days after which a rating is treated as stale. */
  staleAfterDays?: number;
  now?: Date;
}

const DEFAULTS = {
  priorityThreshold: 0.6,
  standingThreshold: 0.6,
  overinvestedThreshold: 0.75,
  staleAfterDays: 45,
} as const;

function latestRating(assessment: Assessment, domainId: LifeDomainId): DimensionRating | undefined {
  let best: DimensionRating | undefined;
  for (const rating of assessment.ratings) {
    if (rating.domainId !== domainId) continue;
    if (!best || rating.ratedAt > best.ratedAt) best = rating;
  }
  return best;
}

function daysBetween(from: string, now: Date): number {
  const then = new Date(from).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / 86_400_000;
}

function classify(
  priority: number,
  standing: number | undefined,
  o: Required<Omit<BalanceOptions, 'now'>>,
): BalanceState {
  const matters = priority >= o.priorityThreshold;
  if (standing === undefined) return matters ? 'deficit' : 'dormant';
  if (matters) return standing >= o.standingThreshold ? 'aligned' : 'deficit';
  return standing >= o.overinvestedThreshold ? 'overinvested' : 'dormant';
}

function noteFor(state: BalanceState, label: string, blockedBy: string[]): string {
  const blocked = blockedBy.length
    ? ` It is unlikely to move much while ${blockedBy.join(' and ')} ${blockedBy.length === 1 ? 'is' : 'are'} also under strain.`
    : '';
  switch (state) {
    case 'aligned':
      return `${label} matters a lot right now and it is going well. The job here is to protect it, not improve it.${blocked}`;
    case 'deficit':
      return `${label} matters a lot right now and it is not going well. This is where attention is worth the most.${blocked}`;
    case 'overinvested':
      return `${label} is going very well but matters less than other things at this point. It is a realistic place to take attention *from*.`;
    case 'dormant':
      return `${label} is not going brilliantly, but it also does not matter much right now. Leaving it is a legitimate choice.`;
  }
}

/**
 * Produce the balance report for a person.
 *
 * Unrated dimensions that matter are treated as deficits rather than ignored:
 * not knowing how something is going is itself a finding, and it is the thing
 * the check-in should ask about next.
 */
export function balance(
  plan: OrientationPlan,
  assessment: Assessment,
  options: BalanceOptions = {},
): BalanceReport {
  const o = {
    priorityThreshold: options.priorityThreshold ?? DEFAULTS.priorityThreshold,
    standingThreshold: options.standingThreshold ?? DEFAULTS.standingThreshold,
    overinvestedThreshold: options.overinvestedThreshold ?? DEFAULTS.overinvestedThreshold,
    staleAfterDays: options.staleAfterDays ?? DEFAULTS.staleAfterDays,
  };
  const now = options.now ?? new Date();

  // First pass: priority, standing and state per dimension.
  const interim = plan.priorities.map((p) => {
    const rating = latestRating(assessment, p.domainId);
    const standing = rating ? Math.max(0, Math.min(10, rating.standing)) / 10 : undefined;
    return {
      priority: p.weight,
      domainId: p.domainId,
      label: p.label,
      standing,
      state: classify(p.weight, standing, o),
      stale: rating ? daysBetween(rating.ratedAt, now) > o.staleAfterDays : false,
      ratedAt: rating?.ratedAt,
    };
  });

  const stateOf = new Map(interim.map((d) => [d.domainId, d.state]));

  // Second pass: a deficit is far more actionable once you know what is feeding
  // it. Chasing sleep while money is in crisis is the classic wasted effort.
  const dimensions: DimensionBalance[] = interim.map((d) => {
    const blockedBy = upstreamOf(d.domainId).filter((up) => stateOf.get(up) === 'deficit');
    const gap = d.standing === undefined ? undefined : round(d.priority * (1 - d.standing), 3);
    const domain = getDomain(d.domainId);
    return {
      domainId: d.domainId,
      label: d.label,
      short: domain.short,
      priority: round(d.priority, 3),
      standing: d.standing === undefined ? undefined : round(d.standing, 3),
      state: d.state,
      gap,
      neglectRisk: gap === undefined ? undefined : round(gap, 3),
      stale: d.stale,
      blockedBy,
      note: noteFor(d.state, d.label, blockedBy.map((b) => getDomain(b).label.toLowerCase())),
    };
  });

  const rated = dimensions.filter((d) => d.standing !== undefined);
  const deficits = dimensions
    .filter((d) => d.state === 'deficit')
    .sort((a, b) => (b.gap ?? b.priority) - (a.gap ?? a.priority));
  const overinvested = dimensions
    .filter((d) => d.state === 'overinvested')
    .sort((a, b) => (b.standing ?? 0) - (a.standing ?? 0));

  const weightedStanding = rated.length
    ? round(
        rated.reduce((sum, d) => sum + (d.standing ?? 0) * d.priority, 0) /
          rated.reduce((sum, d) => sum + d.priority, 0),
        3,
      )
    : undefined;

  // The reallocation is the whole point: attention is finite, so naming where
  // it should come from is what turns a diagnosis into something doable.
  let reallocation: Reallocation | undefined;
  const source = overinvested[0];
  const target = deficits.find((d) => d.standing !== undefined) ?? deficits[0];
  if (source && target) {
    reallocation = {
      from: source.domainId,
      fromLabel: source.label,
      to: target.domainId,
      toLabel: target.label,
      note: `${source.label} is in good shape and matters less than it used to. ${target.label} matters a great deal right now and is not going well. Moving even a few hours a week from the first to the second is the highest-value change available to you.`,
    };
  }

  return {
    dimensions,
    deficits,
    overinvested,
    headline: headlineFor(deficits, overinvested, rated.length, dimensions.length, weightedStanding),
    reallocation,
    coverage: round(rated.length / Math.max(1, dimensions.length), 3),
    unrated: dimensions.filter((d) => d.standing === undefined).map((d) => d.domainId),
    stale: dimensions.filter((d) => d.stale).map((d) => d.domainId),
    weightedStanding,
  };
}

function headlineFor(
  deficits: DimensionBalance[],
  overinvested: DimensionBalance[],
  ratedCount: number,
  total: number,
  weightedStanding: number | undefined,
): string {
  if (ratedCount === 0) {
    return 'Nothing is rated yet, so this is a prescription without a diagnosis. Rate a few dimensions and the picture changes from what should matter to what actually needs attention.';
  }
  if (ratedCount < total / 2) {
    return `Only ${ratedCount} of ${total} dimensions are rated. The read is partial — the unrated ones are as likely to be the problem as the rated ones.`;
  }
  if (deficits.length === 0) {
    return 'Nothing is both important and struggling right now. That is a genuinely good position, and the job is to keep it rather than find something to fix.';
  }
  if (overinvested.length > 0 && weightedStanding !== undefined && weightedStanding >= 0.55) {
    return 'This is not a productivity problem, it is an allocation problem. Things are broadly going well — but the attention is not where it needs to be.';
  }
  if (deficits.length >= 4) {
    return 'A lot is under strain at once. Rather than fixing everything, the useful move is to pick the one that is feeding the others and start there.';
  }
  const first = deficits[0];
  return first
    ? `The clearest gap is ${first.label.toLowerCase()} — it matters a great deal in this stage and it is the furthest from where you want it.`
    : 'The picture is broadly balanced.';
}

/**
 * Which dimension to ask about next in a check-in.
 *
 * Prefers unrated dimensions that matter, then stale ratings, then whatever is
 * highest-priority. Keeping the check-in to a single question is deliberate:
 * a thirty-second interaction that visibly moves the wheel gets done, and an
 * eleven-question survey does not.
 */
export function nextCheckIn(report: BalanceReport): LifeDomainId | undefined {
  const byPriority = [...report.dimensions].sort((a, b) => b.priority - a.priority);
  const unrated = byPriority.find((d) => d.standing === undefined);
  if (unrated) return unrated.domainId;
  const stale = byPriority.find((d) => d.stale);
  if (stale) return stale.domainId;
  return byPriority[0]?.domainId;
}
