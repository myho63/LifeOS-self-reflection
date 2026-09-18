import type { LifeStageId, ProfileSignals } from '../types.js';
import type { DerivedContext } from './context.js';

/**
 * A single piece of evidence for or against one life stage.
 *
 * Rules return a signed strength in [-1, 1], or `null` when the signals they
 * depend on are unknown. Nothing in the engine ever converts `null` into 0
 * silently: unknown evidence is excluded from the stage's score *and* recorded
 * against coverage, so a thin profile produces a low-confidence answer rather
 * than a confident wrong one.
 */
export interface SegmentationRule {
  id: string;
  stageId: LifeStageId;
  /** Relative importance of this rule within its stage. */
  weight: number;
  /** Signal keys this rule reads — drives the information-gain planner. */
  deps: (keyof ProfileSignals)[];
  evaluate(ctx: DerivedContext): number | null;
  /** Plain-language statement of the evidence, shown in the rationale. */
  describe(ctx: DerivedContext): string;
}

/** Piecewise age response: full credit inside the band, decaying either side. */
function ageBand(
  age: number | undefined,
  lo: number,
  hi: number,
  falloff = 4,
): number | null {
  if (age === undefined) return null;
  if (age >= lo && age <= hi) return 1;
  const distance = age < lo ? lo - age : age - hi;
  // Linear decay to -1 across `falloff` years beyond the band.
  return Math.max(-1, 1 - (2 * distance) / falloff);
}

/** Convert a known boolean into signed evidence; unknown stays unknown. */
function bool(value: boolean | undefined, whenTrue: number, whenFalse: number): number | null {
  if (value === undefined) return null;
  return value ? whenTrue : whenFalse;
}

function oneOf<T extends string>(
  value: T | undefined,
  matches: readonly T[],
  whenTrue: number,
  whenFalse: number,
): number | null {
  if (value === undefined) return null;
  return matches.includes(value) ? whenTrue : whenFalse;
}

const r = (rule: SegmentationRule): SegmentationRule => rule;

export const SEGMENTATION_RULES: readonly SegmentationRule[] = [
  // ---------------------------------------------------------------- foundation
  r({
    id: 'foundation.age',
    stageId: 'foundation',
    weight: 3,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 13, 17, 3),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'foundation.at_school',
    stageId: 'foundation',
    weight: 2.5,
    deps: ['educationStatus'],
    evaluate: (c) => oneOf(c.signals.educationStatus, ['secondary_school'], 1, -0.7),
    describe: (c) =>
      c.signals.educationStatus === 'secondary_school'
        ? 'Still in secondary school'
        : 'No longer in secondary school',
  }),
  r({
    id: 'foundation.lives_with_parents',
    stageId: 'foundation',
    weight: 1,
    deps: ['livingArrangement'],
    evaluate: (c) => oneOf(c.signals.livingArrangement, ['with_parents'], 0.5, -0.4),
    describe: (c) =>
      c.signals.livingArrangement === 'with_parents' ? 'Lives with parents' : 'Lives independently',
  }),
  r({
    id: 'foundation.no_children',
    stageId: 'foundation',
    weight: 2,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -1, 0.3),
    describe: () => 'No dependent children',
  }),

  // -------------------------------------------------------------------- launch
  r({
    id: 'launch.age',
    stageId: 'launch',
    weight: 2.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 17, 24, 5),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'launch.post_secondary',
    stageId: 'launch',
    weight: 2.5,
    deps: ['educationStatus'],
    evaluate: (c) =>
      oneOf(c.signals.educationStatus, ['higher_education', 'vocational_training'], 0.9, -0.2),
    describe: (c) =>
      c.signals.educationStatus === 'higher_education'
        ? 'In higher education'
        : c.signals.educationStatus === 'vocational_training'
          ? 'In vocational training'
          : 'Not in post-secondary education',
  }),
  r({
    id: 'launch.early_career',
    stageId: 'launch',
    weight: 1.5,
    deps: ['yearsOfWorkExperience'],
    evaluate: (c) => {
      const y = c.signals.yearsOfWorkExperience;
      if (y === undefined) return null;
      return y <= 2 ? 0.8 : y <= 5 ? 0.1 : -0.7;
    },
    describe: (c) => `${c.signals.yearsOfWorkExperience} years of work experience`,
  }),
  r({
    id: 'launch.transitional_housing',
    stageId: 'launch',
    weight: 1,
    deps: ['livingArrangement'],
    evaluate: (c) =>
      oneOf(c.signals.livingArrangement, ['with_parents', 'shared_housing'], 0.5, -0.2),
    describe: (c) => `Living arrangement: ${c.signals.livingArrangement}`,
  }),
  r({
    id: 'launch.no_children',
    stageId: 'launch',
    weight: 2,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -0.9, 0.3),
    describe: () => 'No dependent children',
  }),

  // ----------------------------------------------------------------- establish
  r({
    id: 'establish.age',
    stageId: 'establish',
    weight: 2,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 22, 32, 6),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'establish.no_children',
    stageId: 'establish',
    weight: 2,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -1, 0.7),
    describe: () => 'No dependent children',
  }),
  r({
    id: 'establish.working',
    stageId: 'establish',
    weight: 1.5,
    deps: ['employmentStatus'],
    evaluate: (c) => bool(c.working, 0.6, -0.4),
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),
  r({
    id: 'establish.unpartnered',
    stageId: 'establish',
    weight: 1.5,
    deps: ['relationshipStatus'],
    evaluate: (c) =>
      oneOf(c.signals.relationshipStatus, ['single', 'dating'], 0.6, -0.5),
    describe: (c) => `Relationship status: ${c.signals.relationshipStatus}`,
  }),
  r({
    id: 'establish.independent_living',
    stageId: 'establish',
    weight: 1,
    deps: ['livingArrangement'],
    evaluate: (c) => oneOf(c.signals.livingArrangement, ['alone', 'shared_housing'], 0.5, -0.2),
    describe: (c) => `Living arrangement: ${c.signals.livingArrangement}`,
  }),

  // ---------------------------------------------------------------- partnering
  r({
    id: 'partnering.partnered',
    stageId: 'partnering',
    weight: 3,
    deps: ['relationshipStatus'],
    evaluate: (c) => bool(c.partnered, 1, -1),
    describe: (c) => `Relationship status: ${c.signals.relationshipStatus}`,
  }),
  r({
    id: 'partnering.no_children',
    stageId: 'partnering',
    weight: 2.5,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -1, 0.8),
    describe: () => 'No dependent children',
  }),
  r({
    id: 'partnering.not_expecting',
    stageId: 'partnering',
    weight: 2.5,
    deps: ['expectingChild'],
    evaluate: (c) => bool(c.expecting, -1, 0.4),
    describe: (c) => (c.expecting ? 'Expecting a child' : 'Not expecting a child'),
  }),
  r({
    id: 'partnering.lives_with_partner',
    stageId: 'partnering',
    weight: 1.5,
    deps: ['livingArrangement'],
    evaluate: (c) => oneOf(c.signals.livingArrangement, ['with_partner'], 0.8, -0.3),
    describe: (c) => `Living arrangement: ${c.signals.livingArrangement}`,
  }),
  r({
    id: 'partnering.age',
    stageId: 'partnering',
    weight: 1,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 23, 42, 10),
    describe: (c) => `Age ${c.age}`,
  }),

  // ----------------------------------------------------------------- expecting
  r({
    id: 'expecting.expecting_child',
    stageId: 'expecting',
    weight: 5,
    deps: ['expectingChild'],
    evaluate: (c) => bool(c.expecting, 1, -0.9),
    describe: (c) => (c.expecting ? 'Expecting a child' : 'Not expecting a child'),
  }),
  r({
    id: 'expecting.newborn_event',
    stageId: 'expecting',
    weight: 2.5,
    deps: ['recentLifeEvents'],
    evaluate: (c) => bool(c.eventWithin('new_child', 12), 0.9, -0.3),
    describe: () => 'A child arrived within the last year',
  }),
  r({
    id: 'expecting.infant_at_home',
    stageId: 'expecting',
    weight: 2,
    deps: ['children', 'expectingChild'],
    evaluate: (c) => {
      if (c.hasDependentChildren === undefined) return null;
      const youngest = c.youngestDependentAge;
      // Having no children yet is the normal case for a first pregnancy, so it
      // must not count against this stage when we already know they expect one.
      if (youngest === undefined) return c.expecting ? 0.4 : -0.6;
      return youngest < 1 ? 0.9 : youngest <= 2 ? -0.2 : -0.8;
    },
    describe: (c) =>
      c.youngestDependentAge === undefined
        ? 'No children at home yet'
        : `Youngest child is ${c.youngestDependentAge}`,
  }),

  // -------------------------------------------------------------- early_family
  r({
    id: 'early_family.youngest_under_six',
    stageId: 'early_family',
    weight: 3.5,
    deps: ['children'],
    evaluate: (c) => {
      if (c.hasDependentChildren === undefined) return null;
      const youngest = c.youngestDependentAge;
      if (youngest === undefined) return -1;
      if (youngest <= 5) return 1;
      if (youngest <= 7) return 0.1;
      return -0.9;
    },
    describe: (c) =>
      c.youngestDependentAge === undefined
        ? 'No dependent children'
        : `Youngest dependent child is ${c.youngestDependentAge}`,
  }),
  r({
    id: 'early_family.not_expecting_first',
    stageId: 'early_family',
    weight: 1.5,
    deps: ['expectingChild', 'children'],
    evaluate: (c) => {
      if (c.expecting === undefined) return null;
      if (!c.expecting) return 0.3;
      // Expecting with children already at home is still early family.
      return c.hasDependentChildren ? 0.2 : -0.9;
    },
    describe: (c) => (c.expecting ? 'Expecting another child' : 'Not currently expecting'),
  }),
  r({
    id: 'early_family.age',
    stageId: 'early_family',
    weight: 0.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 25, 45, 12),
    describe: (c) => `Age ${c.age}`,
  }),

  r({
    id: 'early_family.not_caregiving',
    stageId: 'early_family',
    weight: 1.5,
    deps: ['caringForDependentAdult'],
    evaluate: (c) => bool(c.caringForDependentAdult, -1, 0.3),
    describe: (c) =>
      c.caringForDependentAdult
        ? 'Also caring for a dependent adult'
        : 'Not caring for a dependent adult',
  }),

  // ------------------------------------------------------------- school_family
  r({
    id: 'school_family.youngest_school_age',
    stageId: 'school_family',
    weight: 3.5,
    deps: ['children'],
    evaluate: (c) => {
      if (c.hasDependentChildren === undefined) return null;
      const youngest = c.youngestDependentAge;
      if (youngest === undefined) return -1;
      if (youngest >= 6 && youngest <= 11) return 1;
      if (youngest === 12) return 0.6;
      if (youngest === 5 || youngest === 13) return 0.3;
      return -0.9;
    },
    describe: (c) =>
      c.youngestDependentAge === undefined
        ? 'No dependent children'
        : `Youngest dependent child is ${c.youngestDependentAge}`,
  }),
  r({
    id: 'school_family.age',
    stageId: 'school_family',
    weight: 0.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 30, 50, 12),
    describe: (c) => `Age ${c.age}`,
  }),

  r({
    id: 'school_family.not_caregiving',
    stageId: 'school_family',
    weight: 1.5,
    deps: ['caringForDependentAdult'],
    evaluate: (c) => bool(c.caringForDependentAdult, -1, 0.3),
    describe: (c) =>
      c.caringForDependentAdult
        ? 'Also caring for a dependent adult'
        : 'Not caring for a dependent adult',
  }),

  // --------------------------------------------------------------- teen_family
  r({
    id: 'teen_family.youngest_teenager',
    stageId: 'teen_family',
    weight: 3.5,
    deps: ['children'],
    evaluate: (c) => {
      if (c.hasDependentChildren === undefined) return null;
      const youngest = c.youngestDependentAge;
      if (youngest === undefined) return -1;
      if (youngest >= 13 && youngest <= 18) return 1;
      if (youngest === 12) return 0.6;
      if (youngest === 11) return 0.2;
      if (youngest > 18) return -0.3;
      return -0.9;
    },
    describe: (c) =>
      c.youngestDependentAge === undefined
        ? 'No dependent children'
        : `Youngest dependent child is ${c.youngestDependentAge}`,
  }),
  r({
    id: 'teen_family.age',
    stageId: 'teen_family',
    weight: 0.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 38, 58, 12),
    describe: (c) => `Age ${c.age}`,
  }),

  r({
    id: 'teen_family.not_caregiving',
    stageId: 'teen_family',
    weight: 1.5,
    deps: ['caringForDependentAdult'],
    evaluate: (c) => bool(c.caringForDependentAdult, -1, 0.3),
    describe: (c) =>
      c.caringForDependentAdult
        ? 'Also caring for a dependent adult'
        : 'Not caring for a dependent adult',
  }),

  // ------------------------------------------------------------- consolidating
  r({
    id: 'consolidating.age',
    stageId: 'consolidating',
    weight: 2,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 33, 52, 8),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'consolidating.no_dependents',
    stageId: 'consolidating',
    weight: 2,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -0.9, 0.7),
    describe: () => 'No dependent children',
  }),
  r({
    id: 'consolidating.established_career',
    stageId: 'consolidating',
    weight: 1.5,
    deps: ['yearsOfWorkExperience'],
    evaluate: (c) => {
      const y = c.signals.yearsOfWorkExperience;
      if (y === undefined) return null;
      return y >= 10 ? 0.8 : y >= 6 ? 0.3 : -0.6;
    },
    describe: (c) => `${c.signals.yearsOfWorkExperience} years of work experience`,
  }),
  r({
    id: 'consolidating.career_stable',
    stageId: 'consolidating',
    weight: 1.5,
    deps: ['careerIntent'],
    evaluate: (c) =>
      oneOf(c.signals.careerIntent, ['settled', 'restless'], 0.4, -0.8),
    describe: (c) => `Career intent: ${c.signals.careerIntent}`,
  }),
  r({
    id: 'consolidating.working',
    stageId: 'consolidating',
    weight: 1,
    deps: ['employmentStatus'],
    evaluate: (c) => bool(c.working, 0.5, -0.5),
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),

  // --------------------------------------------------------------------- pivot
  r({
    id: 'pivot.career_intent',
    stageId: 'pivot',
    weight: 3.5,
    deps: ['careerIntent'],
    evaluate: (c) =>
      oneOf(c.signals.careerIntent, ['actively_changing', 'forced_change'], 1, -0.8),
    describe: (c) => `Career intent: ${c.signals.careerIntent}`,
  }),
  r({
    id: 'pivot.seeking_work',
    stageId: 'pivot',
    weight: 2.5,
    deps: ['employmentStatus'],
    evaluate: (c) => bool(c.seekingWork, 0.9, -0.3),
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),
  r({
    id: 'pivot.job_loss',
    stageId: 'pivot',
    weight: 3,
    deps: ['recentLifeEvents'],
    evaluate: (c) => bool(c.eventWithin('job_loss', 12), 1, -0.2),
    describe: () => 'Lost a job within the last year',
  }),
  r({
    id: 'pivot.upheaval',
    stageId: 'pivot',
    weight: 2,
    deps: ['recentLifeEvents'],
    evaluate: (c) => {
      const moved = c.eventWithin('moved_country', 12);
      const ended = c.eventWithin('relationship_ended', 12);
      if (moved === undefined && ended === undefined) return null;
      return moved || ended ? 0.8 : -0.2;
    },
    describe: () => 'Recent relocation or relationship breakdown',
  }),

  // ------------------------------------------------------------------ sandwich
  r({
    id: 'sandwich.dual_care',
    stageId: 'sandwich',
    weight: 4,
    deps: ['caringForDependentAdult', 'children'],
    evaluate: (c) => {
      if (c.caringForDependentAdult === undefined || c.hasDependentChildren === undefined) {
        return null;
      }
      if (c.caringForDependentAdult && c.hasDependentChildren) return 1;
      if (c.caringForDependentAdult) return 0.2;
      return -1;
    },
    describe: (c) =>
      c.caringForDependentAdult && c.hasDependentChildren
        ? 'Caring for both children and an adult'
        : c.caringForDependentAdult
          ? 'Caring for a dependent adult'
          : 'Not caring for a dependent adult',
  }),
  r({
    id: 'sandwich.became_caregiver',
    stageId: 'sandwich',
    weight: 1.5,
    deps: ['recentLifeEvents'],
    evaluate: (c) => bool(c.eventWithin('became_caregiver', 24), 0.8, -0.2),
    describe: () => 'Recently became a carer',
  }),
  r({
    id: 'sandwich.age',
    stageId: 'sandwich',
    weight: 0.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 38, 62, 12),
    describe: (c) => `Age ${c.age}`,
  }),

  // ---------------------------------------------------------------- empty_nest
  r({
    id: 'empty_nest.children_launched',
    stageId: 'empty_nest',
    weight: 3.5,
    deps: ['children'],
    evaluate: (c) => {
      if (c.hasLaunchedChildren === undefined) return null;
      if (c.hasLaunchedChildren) return 1;
      return c.hasDependentChildren ? -1 : -0.6;
    },
    describe: (c) =>
      c.hasLaunchedChildren ? 'Children are grown and independent' : 'No independent adult children',
  }),
  r({
    id: 'empty_nest.child_left_home',
    stageId: 'empty_nest',
    weight: 2.5,
    deps: ['recentLifeEvents'],
    evaluate: (c) => bool(c.eventWithin('child_left_home', 36), 0.9, -0.2),
    describe: () => 'A child left home recently',
  }),
  r({
    id: 'empty_nest.age',
    stageId: 'empty_nest',
    weight: 1.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 48, 66, 8),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'empty_nest.still_working',
    stageId: 'empty_nest',
    weight: 1,
    deps: ['employmentStatus'],
    evaluate: (c) => bool(c.retired, -0.8, 0.3),
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),

  // ------------------------------------------------------------ pre_retirement
  r({
    id: 'pre_retirement.age',
    stageId: 'pre_retirement',
    weight: 2.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 55, 68, 7),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'pre_retirement.still_working',
    stageId: 'pre_retirement',
    weight: 2.5,
    deps: ['employmentStatus'],
    evaluate: (c) => {
      if (c.retired === undefined) return null;
      if (c.retired) return -1;
      return c.working ? 0.7 : 0;
    },
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),
  r({
    id: 'pre_retirement.no_dependents',
    stageId: 'pre_retirement',
    weight: 1,
    deps: ['children'],
    evaluate: (c) => bool(c.hasDependentChildren, -0.6, 0.4),
    describe: () => 'No dependent children',
  }),

  // ---------------------------------------------------------------- later_life
  r({
    id: 'later_life.retired',
    stageId: 'later_life',
    weight: 3.5,
    deps: ['employmentStatus'],
    evaluate: (c) => bool(c.retired, 1, -0.7),
    describe: (c) => `Employment: ${c.signals.employmentStatus}`,
  }),
  r({
    id: 'later_life.age',
    stageId: 'later_life',
    weight: 2.5,
    deps: ['ageYears', 'birthDate'],
    evaluate: (c) => ageBand(c.age, 68, 120, 8),
    describe: (c) => `Age ${c.age}`,
  }),
  r({
    id: 'later_life.retired_event',
    stageId: 'later_life',
    weight: 1.5,
    deps: ['recentLifeEvents'],
    evaluate: (c) => bool(c.eventWithin('retired', 36), 0.8, -0.1),
    describe: () => 'Retired within the last three years',
  }),
] as const;

/** Total rule weight in the model, used for coverage. */
export const TOTAL_RULE_WEIGHT = SEGMENTATION_RULES.reduce((sum, rule) => sum + rule.weight, 0);
