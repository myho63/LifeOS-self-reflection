import type { AgeBand, ModifierTag, ModifierTagId } from '../types.js';

/**
 * Modifier tags are circumstances that cut across stages. A single parent in
 * `early_family` and a partnered parent in `early_family` share a stage but not
 * a product: the stage sets the baseline, modifiers bend it.
 *
 * They are deliberately additive rather than a second segmentation axis — a
 * person can carry several, and the weight deltas simply accumulate before
 * renormalisation.
 */
export const MODIFIER_TAGS: readonly ModifierTag[] = [
  {
    id: 'minor',
    label: 'Under 18',
    effect: 'Regulated domains are hidden, guardian-aware framing is used, and crisis routing is age-appropriate.',
    weightDeltas: { personal_growth: 0.1 },
  },
  {
    id: 'student',
    label: 'In education',
    effect: 'Learning and near-term money take precedence; long-horizon planning is de-emphasised.',
    weightDeltas: { personal_growth: 0.15, finance: 0.05, contribution: -0.1 },
  },
  {
    id: 'single_parent',
    label: 'Parenting alone',
    effect: 'Support networks, contingency planning and income resilience are raised sharply.',
    weightDeltas: { finance: 0.25, contribution: 0.15, health: 0.15, fun: 0.05 },
  },
  {
    id: 'adult_caregiver',
    label: 'Caring for an adult',
    effect: 'Care admin, legal preparation and carer wellbeing move into the foreground.',
    weightDeltas: { finance: 0.15, relationships: 0.1, health: 0.25, contribution: 0.1 },
  },
  {
    id: 'financially_stressed',
    label: 'Under financial pressure',
    effect: 'Money becomes the dominant frame and discretionary planning is suppressed until the floor is stable.',
    weightDeltas: { finance: 0.4, health: 0.15, career: 0.1, fun: -0.1, contribution: -0.15 },
  },
  {
    id: 'health_managing',
    label: 'Managing a health condition',
    effect: 'Health logistics and protection cover are raised; plans are built around variable capacity.',
    weightDeltas: { health: 0.3, finance: 0.1 },
  },
  {
    id: 'health_struggling',
    label: 'Health is a live problem',
    effect: 'Health and mind dominate; the app reduces demands elsewhere rather than adding to the load.',
    weightDeltas: { health: 0.55, career: -0.1, personal_growth: -0.1, contribution: -0.05 },
  },
  {
    id: 'job_seeking',
    label: 'Looking for work',
    effect: 'Search mechanics, runway and network activation take priority over long-range career design.',
    weightDeltas: { career: 0.2, finance: 0.15, contribution: 0.15, health: 0.1 },
  },
  {
    id: 'self_employed',
    label: 'Self-employed or running a business',
    effect: 'Tax, protection and irregular-income planning replace employee defaults.',
    weightDeltas: { finance: 0.35, health: 0.05 },
  },
  {
    id: 'recently_bereaved',
    label: 'Recently bereaved',
    effect: 'Grief support and estate admin are raised; nothing else is pushed for a while.',
    weightDeltas: { health: 0.3, finance: 0.2, relationships: 0.1, contribution: 0.15, career: -0.1, personal_growth: -0.15 },
  },
  {
    id: 'recently_separated',
    label: 'Recently separated or divorced',
    effect: 'Financial disentangling, housing and emotional support lead.',
    weightDeltas: { finance: 0.35, environment: 0.2, health: 0.25, relationships: 0.1 },
  },
  {
    id: 'relocating',
    label: 'Moved or moving to a new place',
    effect: 'Rebuilding community and re-establishing local admin become first-class tasks.',
    weightDeltas: { contribution: 0.25, environment: 0.15, finance: 0.15, health: 0.05 },
  },
  {
    id: 'sole_earner',
    label: 'Sole earner for the household',
    effect: 'Income protection and contingency planning carry extra weight.',
    weightDeltas: { finance: 0.3, career: 0.1, health: 0.05 },
  },
] as const;

const MODIFIER_INDEX = new Map<ModifierTagId, ModifierTag>(MODIFIER_TAGS.map((m) => [m.id, m]));

export function getModifier(id: ModifierTagId): ModifierTag {
  const tag = MODIFIER_INDEX.get(id);
  if (!tag) throw new Error(`Unknown modifier tag: ${id}`);
  return tag;
}

/**
 * Age bands exist for cohort analytics and copy tone, never for segmentation
 * itself. Two people in the same band routinely belong to different stages.
 */
export const AGE_BANDS: readonly AgeBand[] = [
  { id: 'early_teen', label: '13–15', min: 13, max: 15 },
  { id: 'late_teen', label: '16–18', min: 16, max: 18 },
  { id: 'emerging_adult', label: '19–24', min: 19, max: 24 },
  { id: 'twenties', label: '25–29', min: 25, max: 29 },
  { id: 'early_thirties', label: '30–34', min: 30, max: 34 },
  { id: 'late_thirties', label: '35–44', min: 35, max: 44 },
  { id: 'forties_fifties', label: '45–54', min: 45, max: 54 },
  { id: 'pre_retirement_band', label: '55–64', min: 55, max: 64 },
  { id: 'later_life_band', label: '65+', min: 65, max: 130 },
] as const;

export function bandForAge(age: number): AgeBand | undefined {
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max);
}
