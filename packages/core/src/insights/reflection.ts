import { LIFE_DOMAINS, getDomain } from '../taxonomy/domains.js';
import { getStage } from '../taxonomy/stages.js';
import { clamp, round } from '../util/math.js';
import type { IsoDate, LifeDomainId, LifeStageId } from '../types.js';

/**
 * What the written record says about each dimension — as arithmetic.
 *
 * The division of labour here is deliberate. A language model is good at
 * reading a paragraph and saying *which* parts of a life it touches and what
 * it appears to mean; it is bad at saying how much something matters, because
 * a number it produces is a guess dressed as a measurement. It has no access
 * to the arithmetic, cannot be audited, and will not give the same answer
 * twice on the same input.
 *
 * So the model attributes and interprets, and this module scores. Everything
 * below is computed from the user's own check-in values and the days each
 * dimension was attributed to: the same input always yields the same reading,
 * every number can be traced to days they logged, and the thresholds are in
 * one place where they can be argued with.
 *
 * Three things are reported, and they are kept apart on purpose:
 *
 *   - **Impact** — how strongly this dimension is associated with how they
 *     felt, combining the size of the difference with how much of the window
 *     it touches.
 *   - **Direction** — which way it leans. Computed separately, because a
 *     large effect that helps and a large effect that costs are the same
 *     size and opposite things.
 *   - **Confidence** — how precisely the difference has been pinned down.
 *     Separate again, because a big apparent effect seen twice and a small
 *     one seen fifty times are both real readings and mean different things.
 *
 * This is co-occurrence, never causation. A good week makes someone more
 * likely to see friends *and* to rate the day well; nothing here can tell that
 * apart from seeing friends making the day better.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ReflectionDay {
  date: IsoDate;
  /**
   * The day's check-in on the 0-10 scale. A day without one still carries
   * writing worth reading, but it cannot join a comparison of means.
   */
  happiness?: number;
  /**
   * Which dimensions this day touched — the model's reading of what they
   * wrote, unioned with the dimensions they filed it under themselves.
   */
  dimensions: LifeDomainId[];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** What the reader is shown. The raw score behind it stays internal. */
export type ImpactBand = 'high' | 'medium' | 'low' | 'insufficient';

/** Which way it leans, on its own axis. */
export type ImpactDirection = 'positive' | 'negative' | 'mixed';

export type ConfidenceBand = 'high' | 'medium' | 'low';

/** Why a dimension could not be scored. Named so the gap can be explained. */
export type InsufficientReason =
  | 'no-window'
  | 'not-mentioned'
  | 'too-few-mentions'
  | 'no-contrast';

export interface DimensionReading {
  domainId: LifeDomainId;
  label: string;
  band: ImpactBand;
  /** Set only when `band` is 'insufficient'. */
  reason?: InsufficientReason;
  direction: ImpactDirection;
  confidence: ConfidenceBand;
  /** 1-4 filled segments. Always agrees with `confidence`. */
  confidenceSteps: number;

  /**
   * 0-100. Internal: the ordering behind the band, kept off the screen
   * because a decimal invites a precision the input does not have. Exposed
   * here so the ranking is testable and so a support tool can explain a band.
   */
  score: number;
  /** Share of the window this dimension appears in, 0..1. */
  reach: number;
  /** meanWith - meanWithout, in points on the 0-10 scale. Signed. */
  delta: number;
  daysWith: number;
  daysWithout: number;
  meanWith?: number;
  meanWithout?: number;
  /** Half-width of the 95% interval around `delta`, in points. */
  margin?: number;
}

export interface ReflectionReading {
  /** All eleven, best-evidenced and strongest first. */
  dimensions: DimensionReading[];
  /** Days in the window carrying a check-in value. */
  scoredDays: number;
  /** Days in the window at all, scored or not. */
  totalDays: number;
  from?: IsoDate;
  to?: IsoDate;
  basis: string;
}

// ---------------------------------------------------------------------------
// The thresholds, in one place
// ---------------------------------------------------------------------------

/** A window shorter than this cannot support a comparison of any kind. */
export const REFLECTION_MINIMUM_DAYS = 4;

/** Each side of a comparison needs at least this many days. */
export const REFLECTION_MINIMUM_SIDE = 2;

/**
 * The difference, in points of happiness, that counts as a complete effect.
 * Two and a half points on a ten-point scale is the distance between an
 * ordinary week and a bad one; treating it as the ceiling stops a freak
 * six-point gap between two days from reading the same as a standing pattern.
 */
const FULL_SWING = 2.5;

/**
 * Below this the difference is not called a direction. A tenth of a point
 * either way is the scale's own granularity, not a lean.
 */
const DIRECTION_DEADZONE = 0.35;

/**
 * Floor on each group's standard deviation. A self-rated 0-10 check-in is a
 * coarse instrument: two days both marked 7 were not identical days, and
 * without this floor a handful of days that happen to agree produce a
 * standard error of zero and a confident claim out of four data points.
 */
const RATING_NOISE = 0.8;

/** Where the internal score is cut into the three words a reader sees. */
const HIGH_IMPACT = 55;
const MEDIUM_IMPACT = 25;

const HIGH_CONFIDENCE = 0.6;
const MEDIUM_CONFIDENCE = 0.3;

/** Confidence saturates around a fortnight of check-ins. */
const CONFIDENCE_FULL_WINDOW = 10;

// ---------------------------------------------------------------------------

/**
 * Two-sided 95% t multipliers, by degrees of freedom.
 *
 * Using 1.96 here — the large-sample value — is what makes a reading taken
 * from two days look as well-established as one taken from fifty. At two
 * degrees of freedom the true multiplier is more than twice that, and the
 * interval it produces is wide enough to say so. Interpolated between rows,
 * which is well inside the precision this is reported at.
 */
const T95: ReadonlyArray<readonly [df: number, t: number]> = [
  [1, 12.71], [2, 4.30], [3, 3.18], [4, 2.78], [5, 2.57], [6, 2.45],
  [7, 2.36], [8, 2.31], [9, 2.26], [10, 2.23], [12, 2.18], [15, 2.13],
  [20, 2.09], [25, 2.06], [30, 2.04], [40, 2.02], [60, 2.00], [120, 1.98],
];
const T_LARGE_SAMPLE = 1.96;

function tMultiplier(df: number): number {
  const first = T95[0]!;
  if (!Number.isFinite(df) || df <= first[0]) return first[1];
  for (let i = 1; i < T95.length; i += 1) {
    const hi = T95[i]!;
    if (df <= hi[0]) {
      const lo = T95[i - 1]!;
      return lo[1] + (hi[1] - lo[1]) * ((df - lo[0]) / (hi[0] - lo[0]));
    }
  }
  return T_LARGE_SAMPLE;
}

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Sample variance. Undefined for a single day, which the noise floor covers. */
const variance = (xs: number[], m: number): number =>
  (xs.length < 2 ? 0 : xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));

function impactBand(score: number): Exclude<ImpactBand, 'insufficient'> {
  if (score >= HIGH_IMPACT) return 'high';
  if (score >= MEDIUM_IMPACT) return 'medium';
  return 'low';
}

function confidenceBand(value: number): ConfidenceBand {
  if (value >= HIGH_CONFIDENCE) return 'high';
  if (value >= MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
}

/**
 * The meter, derived from the band rather than from the number.
 *
 * A meter that reads three-quarters full beside the word "Low" is a bug the
 * reader has to resolve, so the two are not allowed to disagree: the band
 * decides, and the raw value only chooses between the two low positions.
 */
function confidenceSteps(band: ConfidenceBand, value: number): number {
  if (band === 'high') return 4;
  if (band === 'medium') return 3;
  return value >= MEDIUM_CONFIDENCE / 2 ? 2 : 1;
}

function directionOf(delta: number): ImpactDirection {
  if (delta > DIRECTION_DEADZONE) return 'positive';
  if (delta < -DIRECTION_DEADZONE) return 'negative';
  return 'mixed';
}

/**
 * Read every dimension against the check-ins of one window.
 *
 * For each dimension: split the scored days into those it was attributed to
 * and those it was not, and compare the means. The size of that difference,
 * scaled by how much of the window the dimension touches, is the impact; its
 * sign is the direction; the precision of the estimate is the confidence.
 *
 * All eleven come back every time. A dimension nobody has written about is a
 * fact about the record, not a hole in it, and saying so is the honest answer.
 */
export function readDimensions(input: { days: ReflectionDay[] }): ReflectionReading {
  const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  const scored = days.filter((d) => typeof d.happiness === 'number');
  const values = new Map<IsoDate, number>();
  const touched = new Map<IsoDate, Set<LifeDomainId>>();

  for (const d of scored) {
    values.set(d.date, clamp(d.happiness as number, 0, 10));
    const set = touched.get(d.date) ?? new Set<LifeDomainId>();
    for (const id of d.dimensions) if (getDomainOrNull(id)) set.add(id);
    touched.set(d.date, set);
  }

  const scoredDays = values.size;
  const enoughWindow = scoredDays >= REFLECTION_MINIMUM_DAYS;

  const readings: DimensionReading[] = LIFE_DOMAINS.map((domain) => {
    const withDays: number[] = [];
    const withoutDays: number[] = [];
    for (const [date, value] of values) {
      (touched.get(date)?.has(domain.id) ? withDays : withoutDays).push(value);
    }

    const base = {
      domainId: domain.id,
      label: domain.label,
      daysWith: withDays.length,
      daysWithout: withoutDays.length,
      reach: scoredDays === 0 ? 0 : round(withDays.length / scoredDays, 4),
    };

    const short = (reason: InsufficientReason): DimensionReading => ({
      ...base,
      band: 'insufficient',
      reason,
      direction: 'mixed',
      confidence: 'low',
      confidenceSteps: 1,
      score: 0,
      delta: 0,
    });

    if (!enoughWindow) return short('no-window');
    if (withDays.length === 0) return short('not-mentioned');
    if (withDays.length < REFLECTION_MINIMUM_SIDE) return short('too-few-mentions');
    // Everywhere is the same problem as nowhere: with nothing to compare
    // against, a dimension on every day has no measurable effect at all.
    if (withoutDays.length < REFLECTION_MINIMUM_SIDE) return short('no-contrast');

    const meanWith = mean(withDays);
    const meanWithout = mean(withoutDays);
    const delta = meanWith - meanWithout;

    // How big the difference is, against what counts as a complete effect.
    const magnitude = Math.min(1, Math.abs(delta) / FULL_SWING);

    /* How much of the window it touches. Reach never falls to zero: a
       dimension that shows up on two days out of twenty and costs three
       points on each of them is a real part of those days, and multiplying
       it straight by 0.1 would erase it. It is damped, not dismissed —
       something running through most of the record outranks something sharp
       and rare at the same effect size. */
    const reachWeight = 0.4 + 0.6 * base.reach;
    const score = round(100 * magnitude * reachWeight, 2);

    /* Confidence is precision, not significance.
       The question is not "is this difference real" but "how tightly have we
       pinned it down" — otherwise a dimension measured over fifty days and
       found not to matter would be reported as a low-confidence reading,
       when it is the surest thing on the page. So: the width of the interval
       around the difference, against the same full-swing yardstick the
       magnitude uses, damped by how much of a window there is at all. */
    /* Welch rather than a pooled variance, and each side floored separately.
       Pooling lets the larger side lend its steadiness to the smaller one, so
       a dimension seen on two days borrows the composure of the other twenty
       and comes back better established than it has any right to be. Welch
       keeps the two apart and pays for it in degrees of freedom, which is
       what drags the multiplier up and the confidence down where the
       evidence is one-sided. */
    const vWith = Math.max(RATING_NOISE ** 2, variance(withDays, meanWith));
    const vWithout = Math.max(RATING_NOISE ** 2, variance(withoutDays, meanWithout));
    const termWith = vWith / withDays.length;
    const termWithout = vWithout / withoutDays.length;
    const se = Math.sqrt(termWith + termWithout);
    const df = (termWith + termWithout) ** 2 / (
      termWith ** 2 / Math.max(1, withDays.length - 1)
      + termWithout ** 2 / Math.max(1, withoutDays.length - 1)
    );
    const margin = tMultiplier(df) * se;
    const precision = 1 - Math.min(1, margin / FULL_SWING);
    const value = precision * Math.min(1, scoredDays / CONFIDENCE_FULL_WINDOW);
    const cBand = confidenceBand(value);

    return {
      ...base,
      band: impactBand(score),
      direction: directionOf(delta),
      confidence: cBand,
      confidenceSteps: confidenceSteps(cBand, value),
      score,
      delta: round(delta, 2),
      meanWith: round(meanWith, 1),
      meanWithout: round(meanWithout, 1),
      margin: round(margin, 2),
    };
  });

  const rank: Record<ImpactBand, number> = { high: 3, medium: 2, low: 1, insufficient: 0 };
  const order = new Map(LIFE_DOMAINS.map((d, i) => [d.id, i]));
  readings.sort((a, b) => {
    if (rank[a.band] !== rank[b.band]) return rank[b.band] - rank[a.band];
    if (b.score !== a.score) return b.score - a.score;
    // Unscored dimensions keep taxonomy order rather than shuffling on ties.
    return (order.get(a.domainId) ?? 0) - (order.get(b.domainId) ?? 0);
  });

  return {
    dimensions: readings,
    scoredDays,
    totalDays: days.length,
    from: days[0]?.date,
    to: days[days.length - 1]?.date,
    basis: basisFor(scoredDays),
  };
}

function basisFor(scoredDays: number): string {
  if (scoredDays === 0) return 'No check-ins in this window yet.';
  if (scoredDays < REFLECTION_MINIMUM_DAYS) {
    return `${scoredDays} check-in${scoredDays === 1 ? '' : 's'} in this window. `
      + `Impact needs ${REFLECTION_MINIMUM_DAYS} before it can compare one day against another.`;
  }
  return `Measured across ${scoredDays} check-ins: how you rated the days a dimension came up, `
    + 'against the days it did not.';
}

function getDomainOrNull(id: LifeDomainId): boolean {
  return LIFE_DOMAINS.some((d) => d.id === id);
}

/**
 * One dimension's reading, said in numbers the reader can check.
 *
 * Deliberately not a claim about their life — it restates the arithmetic, so
 * someone who disagrees with the band can see exactly what produced it.
 */
export function explainReading(r: DimensionReading): string {
  if (r.band === 'insufficient') {
    switch (r.reason) {
      case 'not-mentioned':
        return 'Has not come up in what you have written for this window.';
      case 'too-few-mentions':
        return `Came up on ${r.daysWith} day${r.daysWith === 1 ? '' : 's'}. `
          + `Two are needed before this can be compared against your other days.`;
      case 'no-contrast':
        return 'Comes up on nearly every day here, so there are no days without it '
          + 'to compare against.';
      default:
        return 'Not enough check-ins in this window yet.';
    }
  }
  const dir = r.delta >= 0 ? 'higher' : 'lower';
  return `Came up on ${r.daysWith} of ${r.daysWith + r.daysWithout} days. `
    + `Those days averaged ${r.meanWith?.toFixed(1)} against ${r.meanWithout?.toFixed(1)} `
    + `on the rest — ${Math.abs(r.delta).toFixed(1)} ${dir}.`;
}

// ---------------------------------------------------------------------------
// Life stage relevance lives elsewhere, on purpose
// ---------------------------------------------------------------------------

/*
 * Nothing in this module weights a dimension by how much the user's life stage
 * asks of it, and nothing here should.
 *
 * That reading already exists: `balance()` carries a stage-derived `priority`
 * per dimension and `dimensionScores()` ranks on it. Folding it into the score
 * above would answer two questions with one number and hide the finding that
 * matters most — finance can be the single most important dimension of
 * someone's stage and show no measurable effect on their week, and that gap is
 * the thing worth surfacing. Multiplying them makes it disappear.
 *
 * So the two stay apart all the way to the screen: this module says what the
 * record shows, the stage priority says what the stage asks, and the reader is
 * shown both rather than their product.
 */
