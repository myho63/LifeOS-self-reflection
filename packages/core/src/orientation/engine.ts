import { ALL_DOMAIN_IDS, getDomain } from '../taxonomy/domains.js';
import { getStage } from '../taxonomy/stages.js';
import { getModifier } from '../taxonomy/modifiers.js';
import { seasonForStage } from '../taxonomy/seasons.js';
import { traitWeightDeltas } from '../assessment/traits.js';
import type { TraitScores } from '../assessment/types.js';
import { clamp, round } from '../util/math.js';
import type {
  ProfileSignals,
  BlindSpot,
  DomainPriority,
  LifeDomainId,
  LifeStage,
  Milestone,
  ModifierTagId,
  OrientationPlan,
  SegmentationResult,
} from '../types.js';

export interface OrientationOptions {
  /** How many domains to present as the active focus. */
  focusCount?: number;
  /** Minimum severity for a domain to be raised as a blind spot. */
  blindSpotThreshold?: number;
  /**
   * Trait scores, when the person has completed the personal analysis. These
   * apply small bounded nudges only — traits must never be able to override a
   * life stage, because an anxious person still needs an emergency fund.
   */
  traits?: TraitScores;
  /** Signals, used only to split later life on capability rather than age. */
  signals?: ProfileSignals;
}

const DEFAULTS = { focusCount: 3, blindSpotThreshold: 0.3 } as const;

interface Blend {
  weights: Map<LifeDomainId, number>;
  neglect: Map<LifeDomainId, number>;
  stages: { stage: LifeStage; share: number }[];
}

/**
 * Blend the top stages by their relative probability.
 *
 * A parent whose youngest child is twelve is not cleanly in `school_family` or
 * `teen_family`, and forcing a single bucket produces advice that is wrong for
 * half the year. When the runner-up is competitive, its profile is mixed in
 * proportionally instead of discarded.
 */
function blendStages(segmentation: SegmentationResult): Blend {
  const primary = getStage(segmentation.primary.stageId);
  const secondaryScore = segmentation.secondary;

  const stages: { stage: LifeStage; share: number }[] = [];
  if (secondaryScore) {
    const total = segmentation.primary.probability + secondaryScore.probability;
    const primaryShare = total > 0 ? segmentation.primary.probability / total : 1;
    stages.push(
      { stage: primary, share: primaryShare },
      { stage: getStage(secondaryScore.stageId), share: 1 - primaryShare },
    );
  } else {
    stages.push({ stage: primary, share: 1 });
  }

  const weights = new Map<LifeDomainId, number>();
  const neglect = new Map<LifeDomainId, number>();
  for (const domainId of ALL_DOMAIN_IDS) {
    let w = 0;
    let n = 0;
    for (const { stage, share } of stages) {
      w += (stage.baseWeights[domainId] ?? 0) * share;
      n += (stage.neglectPriors[domainId] ?? 0) * share;
    }
    weights.set(domainId, w);
    neglect.set(domainId, n);
  }

  return { weights, neglect, stages };
}

function applyModifiers(
  weights: Map<LifeDomainId, number>,
  modifiers: ModifierTagId[],
): { adjusted: Map<LifeDomainId, number>; drivers: Map<LifeDomainId, ModifierTagId[]> } {
  const adjusted = new Map(weights);
  const drivers = new Map<LifeDomainId, ModifierTagId[]>();

  for (const tagId of modifiers) {
    const tag = getModifier(tagId);
    for (const [domainId, delta] of Object.entries(tag.weightDeltas) as [LifeDomainId, number][]) {
      adjusted.set(domainId, (adjusted.get(domainId) ?? 0) + delta);
      // Only record modifiers that moved a domain meaningfully, so the "why"
      // text names the circumstance rather than listing every tag.
      if (Math.abs(delta) >= 0.1) {
        const list = drivers.get(domainId);
        if (list) list.push(tagId);
        else drivers.set(domainId, [tagId]);
      }
    }
  }

  for (const [domainId, value] of adjusted) adjusted.set(domainId, clamp(value, 0, 1.5));
  return { adjusted, drivers };
}

function explain(
  domainId: LifeDomainId,
  stages: { stage: LifeStage; share: number }[],
  drivers: ModifierTagId[],
  rank: number,
): string {
  const leadStage = stages[0]?.stage;
  const stageLabel = leadStage ? leadStage.label : 'your stage';
  const purpose = getDomain(domainId).purpose;
  const driverText =
    drivers.length > 0
      ? ` Raised further because you are ${drivers.map((d) => getModifier(d).label.toLowerCase()).join(' and ')}.`
      : '';

  // The domain's own purpose carries the specificity; the rank supplies the
  // judgement about where it sits for this person. Without the first half every
  // priority reads identically, which makes the ranking look arbitrary.
  if (rank === 1) {
    return `${purpose} Nothing else in ${stageLabel} pays off as reliably.${driverText}`;
  }
  if (rank <= 3) {
    return `${purpose} One of the few areas worth real attention in ${stageLabel} right now.${driverText}`;
  }
  if (rank <= 7) {
    return `${purpose} Worth keeping steady, but not where your effort should concentrate this quarter.${driverText}`;
  }
  return `${purpose} Deliberately deferred in ${stageLabel} so the top areas get real attention.${driverText}`;
}

function blindSpotPrompt(domainId: LifeDomainId, stageLabel: string): string {
  const domain = getDomain(domainId);
  return `Most people in ${stageLabel} leave ${domain.label.toLowerCase()} until it becomes urgent. ${domain.purpose}`;
}

/**
 * Build the orientation plan: what this person should be paying attention to,
 * in what order, and what they are likely to be ignoring.
 */
export function orient(
  segmentation: SegmentationResult,
  options: OrientationOptions = {},
): OrientationPlan {
  const focusCount = options.focusCount ?? DEFAULTS.focusCount;
  const blindSpotThreshold = options.blindSpotThreshold ?? DEFAULTS.blindSpotThreshold;

  const { weights, neglect, stages } = blendStages(segmentation);
  const { adjusted, drivers } = applyModifiers(weights, segmentation.modifiers);

  // Traits nudge the budget slightly, after stage and circumstance have had
  // their say. Capped in `traitWeightDeltas` so they can only ever tilt.
  for (const [domainId, delta] of Object.entries(traitWeightDeltas(options.traits))) {
    if (typeof delta !== 'number') continue;
    const id = domainId as LifeDomainId;
    if (adjusted.has(id)) adjusted.set(id, clamp((adjusted.get(id) ?? 0) + delta, 0, 1.5));
  }

  const hidden = new Set(segmentation.guardrails.hiddenDomains);
  const visible = ALL_DOMAIN_IDS.filter((id) => !hidden.has(id));

  const maxWeight = visible.reduce((max, id) => Math.max(max, adjusted.get(id) ?? 0), 0) || 1;

  const priorities: DomainPriority[] = visible
    .map((domainId) => ({
      domainId,
      raw: adjusted.get(domainId) ?? 0,
    }))
    .sort((a, b) => b.raw - a.raw)
    .map((entry, index) => ({
      domainId: entry.domainId,
      label: getDomain(entry.domainId).label,
      weight: round(entry.raw / maxWeight, 3),
      rank: index + 1,
      why: explain(entry.domainId, stages, drivers.get(entry.domainId) ?? [], index + 1),
    }));

  const focus = priorities.slice(0, focusCount);
  const focusIds = new Set(focus.map((f) => f.domainId));
  const leadStage = stages[0]?.stage ?? getStage(segmentation.primary.stageId);

  const blindSpots: BlindSpot[] = priorities
    .filter((p) => !focusIds.has(p.domainId))
    .map((p) => ({
      domainId: p.domainId,
      label: p.label,
      // A blind spot is something that genuinely matters here *and* that people
      // in this stage reliably fail to look at. Either factor alone is not one.
      severity: round(p.weight * (neglect.get(p.domainId) ?? 0), 3),
      prompt: blindSpotPrompt(p.domainId, leadStage.label),
    }))
    .filter((b) => b.severity >= blindSpotThreshold)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 4);

  const milestones: Milestone[] = leadStage.milestones.filter((m) => !hidden.has(m.domain));

  const headline = segmentation.secondary
    ? `${leadStage.label}, moving toward ${getStage(segmentation.secondary.stageId).label}`
    : leadStage.label;

  return {
    stageId: leadStage.id,
    seasonId: seasonForStage(leadStage.id, options.signals ?? {}),
    primaryQuestion: leadStage.primaryQuestion,
    headline,
    thesis: leadStage.orientationThesis,
    planningHorizonYears: leadStage.planningHorizonYears,
    reviewCadenceDays: leadStage.reviewCadenceDays,
    priorities,
    focus,
    blindSpots,
    milestones,
    guardrails: segmentation.guardrails,
    confidence: segmentation.confidence,
  };
}
