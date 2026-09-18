import type { ChildSignal, LifeEventId, ProfileSignals } from '../types.js';

/**
 * A normalised view of raw profile signals.
 *
 * Rules read this rather than `ProfileSignals` directly so that "youngest
 * dependent child is 3" is computed once, and so that *unknown* stays properly
 * distinct from *false*. Every derived field is `undefined` when the underlying
 * signals cannot answer it, which is what lets the engine report coverage
 * honestly instead of treating silence as a negative answer.
 */
export interface DerivedContext {
  readonly signals: ProfileSignals;

  age?: number;

  /** Undefined when the user has not told us about children at all. */
  hasDependentChildren?: boolean;
  dependentChildren: ChildSignal[];
  youngestDependentAge?: number;
  /** True when children are known to exist but none are still dependent. */
  hasLaunchedChildren?: boolean;

  expecting?: boolean;
  partnered?: boolean;
  caringForDependentAdult?: boolean;

  inEducation?: boolean;
  working?: boolean;
  retired?: boolean;
  seekingWork?: boolean;

  /** Months since a life event, or undefined if it has not been reported. */
  eventAge(id: LifeEventId): number | undefined;
  /** True when the event happened within `months`; undefined when unknown. */
  eventWithin(id: LifeEventId, months: number): boolean | undefined;
}

function computeAge(signals: ProfileSignals, now: Date): number | undefined {
  if (typeof signals.ageYears === 'number' && Number.isFinite(signals.ageYears)) {
    return signals.ageYears;
  }
  if (!signals.birthDate) return undefined;
  const born = new Date(signals.birthDate);
  if (Number.isNaN(born.getTime())) return undefined;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 ? age : undefined;
}

export function deriveContext(signals: ProfileSignals, now: Date = new Date()): DerivedContext {
  const age = computeAge(signals, now);

  const children = signals.children;
  const dependentChildren = (children ?? []).filter((c) => c.dependent);
  const youngestDependentAge =
    dependentChildren.length > 0
      ? dependentChildren.reduce((min, c) => Math.min(min, c.ageYears), Number.POSITIVE_INFINITY)
      : undefined;

  const events = signals.recentLifeEvents ?? [];
  const eventAge = (id: LifeEventId): number | undefined => {
    const matches = events.filter((e) => e.id === id);
    if (matches.length === 0) return undefined;
    return matches.reduce((min, e) => Math.min(min, e.monthsAgo), Number.POSITIVE_INFINITY);
  };

  const employment = signals.employmentStatus;
  const education = signals.educationStatus;
  const relationship = signals.relationshipStatus;

  return {
    signals,
    age,

    hasDependentChildren: children === undefined ? undefined : dependentChildren.length > 0,
    dependentChildren,
    youngestDependentAge,
    hasLaunchedChildren:
      children === undefined ? undefined : children.length > 0 && dependentChildren.length === 0,

    expecting: signals.expectingChild,
    partnered:
      relationship === undefined
        ? undefined
        : relationship === 'married' || relationship === 'cohabiting',
    caringForDependentAdult: signals.caringForDependentAdult,

    inEducation:
      education === undefined
        ? undefined
        : education === 'secondary_school' ||
          education === 'higher_education' ||
          education === 'vocational_training',
    working:
      employment === undefined
        ? undefined
        : employment === 'employed' ||
          employment === 'self_employed' ||
          employment === 'business_owner',
    retired: employment === undefined ? undefined : employment === 'retired',
    seekingWork: employment === undefined ? undefined : employment === 'seeking_work',

    eventAge,
    eventWithin: (id, months) => {
      // An absent `recentLifeEvents` array means we never asked, which is not
      // the same as the user telling us nothing happened. Only once the array
      // exists does a missing event count as a genuine negative.
      if (signals.recentLifeEvents === undefined) return undefined;
      const monthsAgo = eventAge(id);
      if (monthsAgo === undefined) return false;
      return monthsAgo <= months;
    },
  };
}
