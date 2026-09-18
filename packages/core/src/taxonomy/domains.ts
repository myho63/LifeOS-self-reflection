import type { LifeDomain, LifeDomainId } from '../types.js';

/**
 * The eleven life dimensions.
 *
 * Health carries body and mind together, because for a user "am I well?" is one
 * question, not two. Relationships, Family and Social are deliberately separate
 * — a partner, a household and a friendship network fail independently and at
 * different life stages, and collapsing them hides the most common midlife
 * pattern of all: a strong marriage, a busy household, and no friends left.
 * Finance absorbs the protective paperwork (insurance, tax, wills), which has
 * no user-facing home of its own.
 *
 * `dependsOn` records the strongest couplings so a low score can be explained by
 * its upstream cause rather than only named. Career feeds Finance feeds
 * Environment feeds Health; chasing sleep during a money crisis is the classic
 * wasted effort.
 */
export const LIFE_DOMAINS: readonly LifeDomain[] = [
  {
    id: 'health',
    label: 'Health',
    short: 'Health',
    purpose: 'Build a strong body and mind to live an energetic life.',
    examples: ['Movement and sleep', 'Preventive screening', 'Stress and resilience', 'Managing a condition'],
    minAge: 13,
    regulated: true,
    dependsOn: ['finance', 'environment'],
  },
  {
    id: 'personal_growth',
    label: 'Personal Growth',
    short: 'Growth',
    purpose: 'Grow mentally and emotionally, and become your best self.',
    examples: ['Learning a skill', 'Self-awareness', 'Reading and study', 'Working on a pattern'],
    minAge: 13,
    regulated: false,
    dependsOn: ['health'],
  },
  {
    id: 'career',
    label: 'Career',
    short: 'Career',
    purpose: 'Build a meaningful career that creates impact.',
    examples: ['Direction and next role', 'Skills and employability', 'Negotiation', 'Winding down'],
    minAge: 13,
    regulated: false,
    dependsOn: ['personal_growth'],
  },
  {
    id: 'finance',
    label: 'Finance',
    short: 'Finance',
    purpose: 'Make income, obligations and savings hold together over time.',
    examples: ['Budget and debt', 'Emergency fund', 'Investing', 'Insurance, tax and wills'],
    minAge: 15,
    regulated: true,
    dependsOn: ['career'],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    short: 'Partner',
    purpose: 'The person you are closest to, and how that partnership is doing.',
    examples: ['Partnership decisions', 'Repairing a rupture', 'Dividing the load', 'Dating'],
    minAge: 13,
    regulated: false,
    dependsOn: ['health'],
  },
  {
    id: 'family',
    label: 'Family',
    short: 'Family',
    purpose: 'Children, parents, and the household you are responsible for.',
    examples: ['Parenting by child age', 'Caring for parents', 'Family rhythm', 'Launching a teenager'],
    minAge: 13,
    regulated: false,
    dependsOn: ['finance'],
  },
  {
    id: 'fun',
    label: 'Fun & Recreation',
    short: 'Fun',
    purpose: 'Play, rest, travel and the part of life that is not instrumental.',
    examples: ['Protecting recovery', 'Reviving an interest', 'Travel', 'Creative practice'],
    minAge: 13,
    regulated: false,
    dependsOn: ['health'],
  },
  {
    id: 'contribution',
    label: 'Contribution',
    short: 'Give',
    purpose: 'What you give back, and what outlasts you.',
    examples: ['Volunteering', 'Mentoring', 'Causes you back', 'Wills and wishes'],
    minAge: 13,
    regulated: false,
    dependsOn: ['social'],
  },
  {
    id: 'environment',
    label: 'Environment',
    short: 'Home',
    purpose: 'Where you live and whether it fits the life you are building.',
    examples: ['Moving out', 'Rent versus buy', 'Relocation', 'Downsizing'],
    minAge: 16,
    regulated: false,
    dependsOn: ['finance'],
  },
  {
    id: 'social',
    label: 'Social',
    short: 'Social',
    purpose: 'Friendships and the network you are actually in contact with.',
    examples: ['Keeping friendships alive', 'Rebuilding after a move', 'Weak ties', 'Loneliness'],
    minAge: 13,
    regulated: false,
    dependsOn: ['fun'],
  },
  {
    id: 'spirituality',
    label: 'Spirituality',
    short: 'Spirit',
    purpose: 'Meaning, values, and what you are ultimately for.',
    examples: ['Values clarification', 'Practice or faith', 'Making sense of a loss', 'Purpose after a role ends'],
    minAge: 13,
    regulated: false,
    dependsOn: [],
  },
] as const;

const DOMAIN_INDEX = new Map<LifeDomainId, LifeDomain>(LIFE_DOMAINS.map((d) => [d.id, d]));

export function getDomain(id: LifeDomainId): LifeDomain {
  const domain = DOMAIN_INDEX.get(id);
  if (!domain) throw new Error(`Unknown life dimension: ${id}`);
  return domain;
}

export function domainLabel(id: LifeDomainId): string {
  return getDomain(id).label;
}

export const ALL_DOMAIN_IDS: readonly LifeDomainId[] = LIFE_DOMAINS.map((d) => d.id);

export function upstreamOf(id: LifeDomainId): LifeDomainId[] {
  return [...getDomain(id).dependsOn];
}

export function downstreamOf(id: LifeDomainId): LifeDomainId[] {
  return LIFE_DOMAINS.filter((d) => d.dependsOn.includes(id)).map((d) => d.id);
}
