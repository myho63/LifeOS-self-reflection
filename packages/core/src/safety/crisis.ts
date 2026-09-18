/**
 * Crisis screening.
 *
 * This is a **routing pre-filter, not a diagnostic instrument**. Its only job is
 * to decide whether a piece of user-authored text should interrupt the normal
 * product flow and surface human help instead. It is deliberately biased toward
 * false positives: showing a support resource to someone who did not need it
 * costs very little, and missing someone who did costs a great deal.
 *
 * It must never be presented to users as an assessment of their mental state,
 * never be used to gate access to the product, and never be the only safety
 * mechanism — every surface that accepts free text should also offer an
 * always-visible route to help.
 */

export type CrisisSeverity = 'none' | 'monitor' | 'elevated' | 'urgent';

export interface CrisisSignal {
  severity: CrisisSeverity;
  /** Which pattern groups matched, for audit and tuning. Never shown to users. */
  matched: string[];
  /** What the product should do next. */
  action: 'continue' | 'offer_support' | 'interrupt_with_support';
  /** Copy the surface should show, if any. */
  message?: string;
  resources: SupportResource[];
}

export interface SupportResource {
  label: string;
  detail: string;
  /** Present when there is a dialable or clickable destination. */
  contact?: string;
  scope: 'global' | 'country';
}

interface PatternGroup {
  id: string;
  severity: Exclude<CrisisSeverity, 'none'>;
  patterns: RegExp[];
}

/**
 * Pattern groups, ordered from most to least acute.
 *
 * These are intentionally simple and readable so they can be reviewed by
 * clinicians rather than only by engineers. A production deployment should pair
 * them with a trained classifier and a human escalation path; the patterns here
 * are the floor, not the ceiling.
 */
const PATTERN_GROUPS: PatternGroup[] = [
  {
    id: 'self_harm_intent',
    severity: 'urgent',
    patterns: [
      /\b(kill|killing)\s+myself\b/i,
      /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
      /\b(take|taking)\s+my\s+own\s+life\b/i,
      /\bsuicid(e|al)\b/i,
      /\b(don'?t|do not)\s+want\s+to\s+(be here|live|wake up)\b/i,
      /\b(better off|everyone.{0,15}better)\s+(without|if i)\b/i,
      /\bhurt(ing)?\s+myself\b/i,
      /\bself[-\s]?harm(ing)?\b/i,
    ],
  },
  {
    id: 'harm_to_others',
    severity: 'urgent',
    patterns: [/\b(hurt|kill|harm)\s+(him|her|them|someone|people)\b/i],
  },
  {
    id: 'abuse_or_danger',
    severity: 'urgent',
    patterns: [
      /\b(he|she|they)\s+(hits?|hit|beats?|hurts?)\s+me\b/i,
      /\bnot\s+safe\s+at\s+home\b/i,
      /\bafraid\s+(of|for)\s+my\s+(partner|husband|wife|dad|mum|mom|parents?)\b/i,
    ],
  },
  {
    id: 'acute_distress',
    severity: 'elevated',
    patterns: [
      /\bcan'?t\s+(go on|cope|take (it|this) any\s?more|do this any\s?more)\b/i,
      /\b(no|nothing left to|there is no)\s+(hope|point|future|way out)\b/i,
      /\b(completely|totally)\s+(hopeless|worthless)\b/i,
      /\bbreaking down\b/i,
    ],
  },
  {
    id: 'persistent_low_mood',
    severity: 'monitor',
    patterns: [
      /\b(depress(ed|ion)|anxious all the time|panic attacks?)\b/i,
      /\bcan'?t\s+(sleep|eat|get out of bed)\b/i,
      /\b(exhausted|burn(ed|t)\s?out)\b/i,
      /\bnobody\s+(cares|would notice)\b/i,
    ],
  },
];

const GLOBAL_RESOURCES: SupportResource[] = [
  {
    label: 'Find a helpline in your country',
    detail: 'A free directory of crisis lines worldwide.',
    contact: 'https://findahelpline.com',
    scope: 'global',
  },
  {
    label: 'Emergency services',
    detail: 'If you or someone else is in immediate danger, contact your local emergency number.',
    scope: 'global',
  },
];

/**
 * Country-specific lines. Kept intentionally short: an out-of-date number is
 * worse than none, so anything not verified belongs in the global directory.
 */
const COUNTRY_RESOURCES: Record<string, SupportResource[]> = {
  US: [
    {
      label: '988 Suicide & Crisis Lifeline',
      detail: 'Call or text 988, 24 hours a day.',
      contact: '988',
      scope: 'country',
    },
  ],
  GB: [
    {
      label: 'Samaritans',
      detail: 'Call 116 123 free, 24 hours a day.',
      contact: '116123',
      scope: 'country',
    },
  ],
};

export interface ScreenOptions {
  countryCode?: string;
  /** Under-18 flows use gentler copy and add a trusted-adult prompt. */
  isMinor?: boolean;
}

function resourcesFor(options: ScreenOptions): SupportResource[] {
  const country = options.countryCode?.toUpperCase();
  const local = country ? (COUNTRY_RESOURCES[country] ?? []) : [];
  return [...local, ...GLOBAL_RESOURCES];
}

const SEVERITY_ORDER: Record<CrisisSeverity, number> = {
  none: 0, monitor: 1, elevated: 2, urgent: 3,
};

export function screenText(text: string, options: ScreenOptions = {}): CrisisSignal {
  const matched: string[] = [];
  let severity: CrisisSeverity = 'none';

  for (const group of PATTERN_GROUPS) {
    if (group.patterns.some((pattern) => pattern.test(text))) {
      matched.push(group.id);
      if (SEVERITY_ORDER[group.severity] > SEVERITY_ORDER[severity]) severity = group.severity;
    }
  }

  if (severity === 'none') {
    return { severity, matched, action: 'continue', resources: [] };
  }

  const resources = resourcesFor(options);
  const trustedAdult = options.isMinor
    ? ' If you can, tell an adult you trust — a parent, teacher, or school counsellor.'
    : '';

  if (severity === 'urgent') {
    return {
      severity,
      matched,
      action: 'interrupt_with_support',
      message:
        'It sounds like you are going through something really hard right now. ' +
        'You deserve support from a person, not an app.' +
        trustedAdult +
        ' Here are places you can reach someone straight away.',
      resources,
    };
  }

  if (severity === 'elevated') {
    return {
      severity,
      matched,
      action: 'interrupt_with_support',
      message:
        'That sounds genuinely heavy. Before we carry on with planning, it is worth ' +
        'talking to someone who can help properly.' +
        trustedAdult,
      resources,
    };
  }

  return {
    severity,
    matched,
    action: 'offer_support',
    message:
      'This sounds like it has been weighing on you. Support is available whenever you want it.' +
      trustedAdult,
    resources,
  };
}
