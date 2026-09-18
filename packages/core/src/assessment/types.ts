import type { IsoDate, LifeDomainId } from '../types.js';

/**
 * The personal analysis layer.
 *
 * Segmentation answers "how much should this dimension matter to you?".
 * Assessment answers "how is it actually going?". Neither is useful alone: the
 * first is a generic prescription, the second is a satisfaction survey. The gap
 * between them is the product.
 */

/** How a person rates one dimension of their life right now. */
export interface DimensionRating {
  domainId: LifeDomainId;
  /** 0-10. Deliberately coarse: precision here is false precision. */
  standing: number;
  ratedAt: IsoDate;
  /** Optional free text — screened before storage, never required. */
  note?: string;
}

/**
 * Trait scores, 0-100.
 *
 * Five factors, framed positively (stability rather than neuroticism) because
 * the app shows these back to the person. These are an *indicative self-report*
 * used to adjust how guidance is framed — never a diagnosis, never a gate, and
 * never shown as a personality type or label.
 */
export interface TraitScores {
  openness?: number;
  conscientiousness?: number;
  extraversion?: number;
  agreeableness?: number;
  stability?: number;
}

export type TraitSource = 'lifeos_short_form' | 'imported' | 'unknown';

export interface Assessment {
  ratings: DimensionRating[];
  traits?: TraitScores;
  traitSource?: TraitSource;
  /** Where imported traits came from, for provenance shown to the user. */
  importedFrom?: string;
  completedAt?: IsoDate;
}

/** One item in the short-form trait questionnaire. */
export interface TraitItem {
  id: string;
  prompt: string;
  factor: keyof TraitScores;
  /** True when agreement counts *against* the factor. */
  reversed: boolean;
}

/**
 * How guidance should be shaped for this person. Traits change framing and
 * scaffolding far more than they change priorities — a conscientious person and
 * a scattered person in the same life stage need the same things, delivered
 * very differently.
 */
export interface FramingHints {
  /** How finely to break milestones down. */
  milestoneGranularity: 'coarse' | 'normal' | 'fine';
  /** Prefer fewer, larger commitments over many small ones. */
  preferFewerCommitments: boolean;
  /** Soften pressure and lead with reassurance before asks. */
  gentleTone: boolean;
  /** Frame community and networking as depth rather than breadth. */
  favourDepthOverBreadth: boolean;
  /** Offer more optionality and exploration in decisions. */
  offerMoreOptions: boolean;
  /** Human-readable reasons, shown to the user so nothing is inferred silently. */
  reasons: string[];
}
