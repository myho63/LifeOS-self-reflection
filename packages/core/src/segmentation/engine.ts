import { ALL_STAGE_IDS, getStage } from '../taxonomy/stages.js';
import { bandForAge } from '../taxonomy/modifiers.js';
import { LIFE_DOMAINS } from '../taxonomy/domains.js';
import { entropyBits, round, softmax } from '../util/math.js';
import type {
  Guardrails,
  LifeDomainId,
  LifeStageId,
  MissingSignal,
  ModifierTagId,
  ProfileSignals,
  RationaleEntry,
  SegmentationResult,
  StageScore,
} from '../types.js';
import { deriveContext, type DerivedContext } from './context.js';
import { SEGMENTATION_RULES, TOTAL_RULE_WEIGHT, type SegmentationRule } from './rules.js';
import { ONBOARDING_QUESTIONS, probesFor } from './questions.js';

export interface SegmentOptions {
  /** Injected for deterministic testing of age-dependent logic. */
  now?: Date;
  /**
   * Softmax temperature. Lower is more decisive. The default is tuned so that a
   * well-evidenced profile lands around 0.8 probability while a thin one stays
   * visibly uncertain.
   */
  temperature?: number;
  /** How many follow-up questions to plan. */
  maxQuestions?: number;
  /** Probability gap below which a second stage is reported as competitive. */
  secondaryThreshold?: number;
}

const DEFAULTS = {
  temperature: 0.2,
  maxQuestions: 3,
  secondaryThreshold: 0.6,
} as const;

/**
 * Age of majority by ISO-3166-1 alpha-2 code. Only jurisdictions that differ
 * from 18 need an entry; everything else falls through to the default. This
 * gates regulated content, not access to the app.
 */
const AGE_OF_MAJORITY: Record<string, number> = {
  US: 18, GB: 18, SG: 21, KR: 19, NZ: 20, JP: 18, VN: 18,
};
const DEFAULT_AGE_OF_MAJORITY = 18;

export function ageOfMajority(countryCode?: string): number {
  if (!countryCode) return DEFAULT_AGE_OF_MAJORITY;
  return AGE_OF_MAJORITY[countryCode.toUpperCase()] ?? DEFAULT_AGE_OF_MAJORITY;
}

interface ScoreBreakdown {
  rawByStage: Map<LifeStageId, number>;
  contributions: RationaleEntry[];
  evaluableWeight: number;
}

// Rules grouped by stage, and each stage's total weight, computed once.
const RULES_BY_STAGE = new Map<LifeStageId, SegmentationRule[]>();
for (const rule of SEGMENTATION_RULES) {
  const list = RULES_BY_STAGE.get(rule.stageId);
  if (list) list.push(rule);
  else RULES_BY_STAGE.set(rule.stageId, [rule]);
}
const STAGE_WEIGHT = new Map<LifeStageId, number>(
  [...RULES_BY_STAGE].map(([id, rules]) => [id, rules.reduce((s, r) => s + r.weight, 0)]),
);

/**
 * Evaluate every rule against a context.
 *
 * Each stage's raw score is its evidence sum divided by the *total* weight of
 * its own rules, so stages described by many rules are not advantaged over
 * stages described by few. Unknown evidence contributes nothing in either
 * direction and is instead subtracted from coverage.
 */
function scoreStages(ctx: DerivedContext, collectRationale: boolean): ScoreBreakdown {
  const rawByStage = new Map<LifeStageId, number>();
  const contributions: RationaleEntry[] = [];
  let evaluableWeight = 0;

  for (const stageId of ALL_STAGE_IDS) {
    const rules = RULES_BY_STAGE.get(stageId) ?? [];
    const stageWeight = STAGE_WEIGHT.get(stageId) ?? 1;
    let sum = 0;

    for (const rule of rules) {
      const value = rule.evaluate(ctx);
      if (value === null) continue;
      const weighted = rule.weight * value;
      sum += weighted;
      evaluableWeight += rule.weight;
      if (collectRationale) {
        contributions.push({
          signal: rule.describe(ctx),
          stageId,
          contribution: round(weighted / stageWeight, 4),
        });
      }
    }

    rawByStage.set(stageId, sum / stageWeight);
  }

  return { rawByStage, contributions, evaluableWeight };
}

function distributionFrom(rawByStage: Map<LifeStageId, number>, temperature: number): StageScore[] {
  const stageIds = [...ALL_STAGE_IDS];
  const raws = stageIds.map((id) => rawByStage.get(id) ?? 0);
  const probs = softmax(raws, temperature);
  return stageIds
    .map((stageId, i) => ({
      stageId,
      probability: round(probs[i] ?? 0, 4),
      rawScore: round(raws[i] ?? 0, 4),
    }))
    .sort((a, b) => b.probability - a.probability);
}

function deriveModifiers(ctx: DerivedContext, isMinor: boolean): ModifierTagId[] {
  const tags: ModifierTagId[] = [];
  const s = ctx.signals;

  if (isMinor) tags.push('minor');
  if (ctx.inEducation) tags.push('student');
  if (
    ctx.hasDependentChildren &&
    s.relationshipStatus !== undefined &&
    ['single', 'separated', 'divorced', 'widowed'].includes(s.relationshipStatus)
  ) {
    tags.push('single_parent');
  }
  if (ctx.caringForDependentAdult) tags.push('adult_caregiver');
  if (s.debtPressure === 'high' || s.debtPressure === 'severe') tags.push('financially_stressed');
  if (s.healthStatus === 'managing_condition') tags.push('health_managing');
  if (s.healthStatus === 'struggling') tags.push('health_struggling');
  if (ctx.seekingWork) tags.push('job_seeking');
  if (s.employmentStatus === 'self_employed' || s.employmentStatus === 'business_owner') {
    tags.push('self_employed');
  }
  if (ctx.eventWithin('bereavement', 18)) tags.push('recently_bereaved');
  if (ctx.eventWithin('relationship_ended', 18) || s.relationshipStatus === 'separated') {
    tags.push('recently_separated');
  }
  if (ctx.eventWithin('moved_home', 12) || ctx.eventWithin('moved_country', 12)) {
    tags.push('relocating');
  }
  if (s.soleIncomeEarner === true) tags.push('sole_earner');

  return tags;
}

function deriveGuardrails(ctx: DerivedContext, modifiers: ModifierTagId[]): Guardrails {
  const age = ctx.age;
  const majority = ageOfMajority(ctx.signals.countryCode);
  const isMinor = age !== undefined && age < majority;

  const hiddenDomains: LifeDomainId[] =
    age === undefined ? [] : LIFE_DOMAINS.filter((d) => age < d.minAge).map((d) => d.id);

  const contentFlags: string[] = [];
  if (isMinor) {
    contentFlags.push('minor_safe_mode', 'no_regulated_products', 'youth_crisis_routing');
    if (age !== undefined && age < 16) contentFlags.push('guardian_aware');
  }
  if (age === undefined) contentFlags.push('age_unverified_conservative_mode');
  if (modifiers.includes('financially_stressed')) contentFlags.push('hardship_support_first');
  if (modifiers.includes('health_struggling') || modifiers.includes('recently_bereaved')) {
    contentFlags.push('mental_health_sensitive');
  }
  if (modifiers.includes('adult_caregiver')) contentFlags.push('carer_load_aware');

  return { isMinor, hiddenDomains, contentFlags };
}

/**
 * Plan the next questions to ask, ranked by expected information gain.
 *
 * For each unanswered question we replay its representative answers through the
 * scoring model and measure how much the entropy of the stage distribution is
 * expected to fall. The result is an onboarding flow that adapts: a 15-year-old
 * is asked about school, a 34-year-old about children, and neither is asked the
 * other's questions.
 */
function planQuestions(
  signals: ProfileSignals,
  currentEntropy: number,
  options: Required<Pick<SegmentOptions, 'temperature' | 'maxQuestions'>> & { now?: Date },
): MissingSignal[] {
  const ctx = deriveContext(signals, options.now);
  const age = ctx.age;
  const planned: MissingSignal[] = [];

  for (const question of ONBOARDING_QUESTIONS) {
    if (signals[question.key] !== undefined) continue;
    // Never ask a question that is inappropriate for the user's age. When age is
    // unknown, ask only the questions that are safe for the youngest user.
    const effectiveAge = age ?? 13;
    if (effectiveAge < question.minAge) continue;

    const probes = probesFor(question);
    let entropySum = 0;
    for (const probe of probes) {
      const probed = deriveContext({ ...signals, ...probe }, options.now);
      const { rawByStage } = scoreStages(probed, false);
      const probs = distributionFrom(rawByStage, options.temperature).map((s) => s.probability);
      entropySum += entropyBits(probs);
    }
    const expectedEntropy = entropySum / probes.length;
    const gain = currentEntropy - expectedEntropy;

    planned.push({
      key: question.key,
      question: question.question,
      why: question.why,
      answers: question.answers,
      expectedGainBits: round(gain, 4),
    });
  }

  return planned
    .filter((p) => p.expectedGainBits > 0.005)
    .sort((a, b) => b.expectedGainBits - a.expectedGainBits)
    .slice(0, options.maxQuestions);
}

/**
 * Segment a profile into a life stage.
 *
 * The result is deliberately a distribution rather than a label: people
 * genuinely straddle stages, and a parent of a 12-year-old is halfway between
 * `school_family` and `teen_family` no matter how confidently a bucket is
 * asserted. Downstream orientation blends the top two when they are close.
 */
export function segment(signals: ProfileSignals, options: SegmentOptions = {}): SegmentationResult {
  const temperature = options.temperature ?? DEFAULTS.temperature;
  const maxQuestions = options.maxQuestions ?? DEFAULTS.maxQuestions;
  const secondaryThreshold = options.secondaryThreshold ?? DEFAULTS.secondaryThreshold;

  const ctx = deriveContext(signals, options.now);
  const { rawByStage, contributions, evaluableWeight } = scoreStages(ctx, true);
  const distribution = distributionFrom(rawByStage, temperature);

  const primary = distribution[0] ?? { stageId: 'establish' as LifeStageId, probability: 0, rawScore: 0 };
  const runnerUp = distribution[1];
  const secondary =
    runnerUp && primary.probability > 0 && runnerUp.probability / primary.probability >= secondaryThreshold
      ? runnerUp
      : undefined;

  const coverage = round(evaluableWeight / TOTAL_RULE_WEIGHT, 4);
  // Confidence is probability discounted by how much of the model we could
  // actually evaluate. The 0.25 floor keeps a strongly-implied answer from a
  // thin profile from reading as zero, while still marking it as provisional.
  const confidence = round(primary.probability * (0.25 + 0.75 * coverage), 4);

  const relevantStages = new Set<LifeStageId>([primary.stageId]);
  if (secondary) relevantStages.add(secondary.stageId);
  const rationale = contributions
    .filter((entry) => relevantStages.has(entry.stageId) && Math.abs(entry.contribution) > 0.001)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8);

  const modifiers = deriveModifiers(ctx, ctx.age !== undefined && ctx.age < ageOfMajority(signals.countryCode));
  const guardrails = deriveGuardrails(ctx, modifiers);

  const currentEntropy = entropyBits(distribution.map((d) => d.probability));
  const missingSignals = planQuestions(signals, currentEntropy, {
    temperature,
    maxQuestions,
    now: options.now,
  });

  return {
    primary,
    secondary,
    distribution,
    ageBand: ctx.age !== undefined ? bandForAge(ctx.age) : undefined,
    modifiers,
    confidence,
    coverage,
    rationale,
    missingSignals,
    guardrails,
  };
}

/** Convenience accessor used widely by the orientation layer. */
export function primaryStage(result: SegmentationResult) {
  return getStage(result.primary.stageId);
}
