import type { FramingHints, TraitItem, TraitScores } from './types.js';

/**
 * A ten-item short-form trait questionnaire.
 *
 * Two items per factor, one positively and one negatively keyed, answered on a
 * 1-5 agreement scale. It is written to be finished in under a minute, because
 * an assessment nobody completes produces no signal at all.
 *
 * This is an original short form written for this product. It is indicative
 * only — it is not a validated psychometric instrument, and the product must
 * never present it as one, assign a personality type from it, or use it to gate
 * anything. Someone who has taken a proper assessment elsewhere should import
 * those scores instead; see `importTraits`.
 */
export const TRAIT_ITEMS: readonly TraitItem[] = [
  { id: 'o1', prompt: 'I like trying things I have never done before.', factor: 'openness', reversed: false },
  { id: 'o2', prompt: 'I would rather stick with what I know works.', factor: 'openness', reversed: true },
  { id: 'c1', prompt: 'I finish what I start, even when it stops being interesting.', factor: 'conscientiousness', reversed: false },
  { id: 'c2', prompt: 'I leave things until the last moment.', factor: 'conscientiousness', reversed: true },
  { id: 'e1', prompt: 'Being around other people gives me energy.', factor: 'extraversion', reversed: false },
  { id: 'e2', prompt: 'I need a lot of time on my own to recharge.', factor: 'extraversion', reversed: true },
  { id: 'a1', prompt: 'I go out of my way to avoid conflict with people I care about.', factor: 'agreeableness', reversed: false },
  { id: 'a2', prompt: 'I say what I think even when it will not land well.', factor: 'agreeableness', reversed: true },
  { id: 's1', prompt: 'I stay steady when things go wrong.', factor: 'stability', reversed: false },
  { id: 's2', prompt: 'I worry about things well before they happen.', factor: 'stability', reversed: true },
] as const;

/** Answers keyed by item id, each 1 (strongly disagree) to 5 (strongly agree). */
export type TraitAnswers = Record<string, number>;

/**
 * Score the short form. Factors with no answered items are left undefined
 * rather than defaulted, so partial completion never invents a trait.
 */
export function scoreTraits(answers: TraitAnswers): TraitScores {
  const buckets = new Map<keyof TraitScores, number[]>();

  for (const item of TRAIT_ITEMS) {
    const raw = answers[item.id];
    if (typeof raw !== 'number' || raw < 1 || raw > 5) continue;
    const oriented = item.reversed ? 6 - raw : raw;
    // Map 1-5 onto 0-100.
    const scaled = ((oriented - 1) / 4) * 100;
    const list = buckets.get(item.factor);
    if (list) list.push(scaled);
    else buckets.set(item.factor, [scaled]);
  }

  const scores: TraitScores = {};
  for (const [factor, values] of buckets) {
    scores[factor] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return scores;
}

/**
 * Accept trait scores measured elsewhere.
 *
 * Plenty of people have already done a proper assessment. Re-asking them is
 * both wasteful and worse — an external instrument is more reliable than a
 * ten-item short form. Values are clamped rather than rejected so a 0-1 or
 * 0-10 scale can be normalised by the caller without losing the import.
 */
export function importTraits(scores: TraitScores, source: string): {
  traits: TraitScores;
  traitSource: 'imported';
  importedFrom: string;
} {
  const clamped: TraitScores = {};
  for (const [key, value] of Object.entries(scores) as [keyof TraitScores, number | undefined][]) {
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    clamped[key] = Math.max(0, Math.min(100, Math.round(value)));
  }
  return { traits: clamped, traitSource: 'imported', importedFrom: source };
}

const HIGH = 65;
const LOW = 35;

/**
 * Turn traits into framing decisions.
 *
 * Deliberately conservative: traits change *how* things are delivered, not
 * *what* matters. A scattered person and a disciplined person in the same life
 * stage still need the same emergency fund; only the scaffolding differs. Every
 * hint carries a reason, because the app shows the user what it inferred rather
 * than quietly personalising behind their back.
 */
export function framingFor(traits: TraitScores | undefined): FramingHints {
  const hints: FramingHints = {
    milestoneGranularity: 'normal',
    preferFewerCommitments: false,
    gentleTone: false,
    favourDepthOverBreadth: false,
    offerMoreOptions: false,
    reasons: [],
  };
  if (!traits) return hints;

  if (typeof traits.conscientiousness === 'number') {
    if (traits.conscientiousness < LOW) {
      hints.milestoneGranularity = 'fine';
      hints.preferFewerCommitments = true;
      hints.reasons.push('You said you tend to leave things late, so goals are broken into smaller steps and you are asked to run fewer at once.');
    } else if (traits.conscientiousness > HIGH) {
      hints.milestoneGranularity = 'coarse';
      hints.reasons.push('You finish what you start, so milestones are kept high-level rather than broken down for you.');
    }
  }

  if (typeof traits.stability === 'number' && traits.stability < LOW) {
    hints.gentleTone = true;
    hints.preferFewerCommitments = true;
    hints.reasons.push('You said you worry ahead of time, so the app leads with what is already handled before what is not.');
  }

  if (typeof traits.extraversion === 'number' && traits.extraversion < LOW) {
    hints.favourDepthOverBreadth = true;
    hints.reasons.push('You recharge alone, so community suggestions favour a few close relationships over networking.');
  }

  if (typeof traits.openness === 'number' && traits.openness > HIGH) {
    hints.offerMoreOptions = true;
    hints.reasons.push('You like trying new things, so decisions show more alternatives rather than a narrowed shortlist.');
  }

  return hints;
}

/**
 * Small, bounded weight nudges from traits.
 *
 * Capped at 0.1 on a 0-1 scale. Traits must not be able to override a life
 * stage: someone anxious still needs their emergency fund, and someone
 * gregarious does not need less sleep.
 */
export function traitWeightDeltas(traits: TraitScores | undefined): Partial<Record<string, number>> {
  const deltas: Record<string, number> = {};
  if (!traits) return deltas;
  if (typeof traits.stability === 'number' && traits.stability < LOW) deltas.mind = 0.1;
  if (typeof traits.extraversion === 'number' && traits.extraversion > HIGH) deltas.community = 0.05;
  if (typeof traits.openness === 'number' && traits.openness > HIGH) deltas.learning = 0.05;
  return deltas;
}
