import { LIFE_DOMAINS, getDomain } from '../taxonomy/domains.js';
import type { Guardrails, LifeDomainId, ProfileSignals } from '../types.js';

/**
 * Content gating and data-handling policy.
 *
 * Life OS serves people from thirteen upward, which means a single codebase is
 * simultaneously a youth product and an adult financial-planning product. The
 * rules here are the boundary between them, and they fail closed: when age is
 * unknown, the conservative treatment applies.
 */

export type SensitivityClass =
  /** Ordinary personal data. */
  | 'standard'
  /** Special-category data under GDPR Art. 9 and equivalents. */
  | 'special'
  /** Data about a minor, which carries additional consent obligations. */
  | 'minor';

/**
 * Storage and retention policy per signal. The API and any analytics pipeline
 * consult this before persisting or exporting a field.
 */
export const SIGNAL_SENSITIVITY: Record<keyof ProfileSignals, SensitivityClass> = {
  birthDate: 'standard',
  ageYears: 'standard',
  educationStatus: 'standard',
  employmentStatus: 'standard',
  yearsOfWorkExperience: 'standard',
  careerIntent: 'standard',
  relationshipStatus: 'standard',
  livingArrangement: 'standard',
  children: 'minor',
  expectingChild: 'special',
  caringForDependentAdult: 'special',
  housingTenure: 'standard',
  debtPressure: 'standard',
  hasEmergencyFund: 'standard',
  financialDependents: 'standard',
  soleIncomeEarner: 'standard',
  healthStatus: 'special',
  recentLifeEvents: 'special',
  countryCode: 'standard',
};

/** Signals that must never leave the user's account in identifiable form. */
export function specialCategorySignals(): (keyof ProfileSignals)[] {
  return (Object.keys(SIGNAL_SENSITIVITY) as (keyof ProfileSignals)[]).filter(
    (key) => SIGNAL_SENSITIVITY[key] === 'special',
  );
}

/**
 * Strip signals that must not be included in analytics or model-training
 * exports. Age is coarsened to a band rather than removed, because segmentation
 * cohort analysis is meaningless without it.
 */
export function redactForAnalytics(signals: ProfileSignals): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(signals)) {
    const sensitivity = SIGNAL_SENSITIVITY[key as keyof ProfileSignals];
    if (sensitivity === 'special') continue;
    if (key === 'birthDate') continue;
    if (key === 'children' && Array.isArray(value)) {
      // Keep the shape that matters to segmentation, drop identifying detail.
      out.dependentChildCount = value.filter((c) => c?.dependent).length;
      continue;
    }
    if (key === 'ageYears' && typeof value === 'number') {
      out.ageBucket = `${Math.floor(value / 5) * 5}-${Math.floor(value / 5) * 5 + 4}`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export interface ContentItem {
  id: string;
  domain: LifeDomainId;
  /** Minimum age this content is appropriate for, if stricter than the domain. */
  minAge?: number;
  /** Content that promotes or explains a regulated product. */
  regulatedProduct?: boolean;
}

/**
 * Decide whether a piece of content may be shown to this user.
 *
 * Regulated-product content is withheld from minors outright rather than
 * reworded, because the issue is not comprehension but appropriateness.
 */
export function isContentAllowed(
  item: ContentItem,
  guardrails: Guardrails,
  age?: number,
): { allowed: boolean; reason?: string } {
  if (guardrails.hiddenDomains.includes(item.domain)) {
    return { allowed: false, reason: `Domain ${item.domain} is not surfaced at this age.` };
  }
  if (guardrails.isMinor && item.regulatedProduct) {
    return { allowed: false, reason: 'Regulated product content is not shown to under-18s.' };
  }
  const requiredAge = item.minAge ?? getDomain(item.domain).minAge;
  if (age === undefined) {
    // Fail closed: without a verified age, only content safe for the youngest
    // supported user is shown.
    if (requiredAge > MINIMUM_SUPPORTED_AGE) {
      return { allowed: false, reason: 'Age unknown; only universally safe content is shown.' };
    }
    return { allowed: true };
  }
  if (age < requiredAge) {
    return { allowed: false, reason: `Content requires age ${requiredAge}.` };
  }
  return { allowed: true };
}

export const MINIMUM_SUPPORTED_AGE = 13;

/**
 * The standing disclaimer attached to every regulated-domain surface. Life OS
 * orients; it does not advise. This distinction is what keeps a product that
 * discusses money, health and legal admin on the right side of the line.
 */
export const ORIENTATION_DISCLAIMER =
  'Life OS helps you understand your options and the trade-offs between them. ' +
  'It is not financial, medical or legal advice, and it does not know your full ' +
  'circumstances. For decisions that carry real risk, use this to prepare for a ' +
  'conversation with a qualified professional, not to replace one.';

/** Domains that always carry the disclaimer. */
export const REGULATED_DOMAINS: LifeDomainId[] = LIFE_DOMAINS.filter((d) => d.regulated).map(
  (d) => d.id,
);
