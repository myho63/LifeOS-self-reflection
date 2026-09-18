import { describe, expect, it } from 'vitest';
import { segment, forecastTransitions } from '../src/index.js';
import type { LifeStageId, ProfileSignals } from '../src/types.js';

/**
 * Personas covering the full age and situation range the product serves.
 * If a change to the rule weights moves any of these, that is a product
 * decision and should be made deliberately.
 */
const PERSONAS: { name: string; expect: LifeStageId; signals: ProfileSignals }[] = [
  {
    name: 'Fifteen, at school, living at home',
    expect: 'foundation',
    signals: {
      ageYears: 15,
      educationStatus: 'secondary_school',
      livingArrangement: 'with_parents',
      children: [],
    },
  },
  {
    name: 'Twenty, at university, sharing a flat',
    expect: 'launch',
    signals: {
      ageYears: 20,
      educationStatus: 'higher_education',
      livingArrangement: 'shared_housing',
      relationshipStatus: 'dating',
      children: [],
      yearsOfWorkExperience: 1,
    },
  },
  {
    name: 'Twenty-seven, single, employed, living alone',
    expect: 'establish',
    signals: {
      ageYears: 27,
      educationStatus: 'not_studying',
      employmentStatus: 'employed',
      relationshipStatus: 'single',
      livingArrangement: 'alone',
      children: [],
      yearsOfWorkExperience: 5,
      careerIntent: 'settled',
    },
  },
  {
    name: 'Thirty-one, married, no children',
    expect: 'partnering',
    signals: {
      ageYears: 31,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_partner',
      children: [],
      expectingChild: false,
      yearsOfWorkExperience: 9,
    },
  },
  {
    name: 'Thirty-three, expecting a first child',
    expect: 'expecting',
    signals: {
      ageYears: 33,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_partner',
      children: [],
      expectingChild: true,
    },
  },
  {
    name: 'Thirty-four, three-year-old at home',
    expect: 'early_family',
    signals: {
      ageYears: 34,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_own_family',
      children: [{ ageYears: 3, dependent: true }],
      expectingChild: false,
    },
  },
  {
    name: 'Forty-one, nine-year-old at home',
    expect: 'school_family',
    signals: {
      ageYears: 41,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_own_family',
      children: [{ ageYears: 9, dependent: true }],
      caringForDependentAdult: false,
    },
  },
  {
    name: 'Forty-seven, fifteen-year-old at home',
    expect: 'teen_family',
    signals: {
      ageYears: 47,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_own_family',
      children: [{ ageYears: 15, dependent: true }],
      caringForDependentAdult: false,
    },
  },
  {
    name: 'Forty-four, no children, established career',
    expect: 'consolidating',
    signals: {
      ageYears: 44,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_partner',
      children: [],
      yearsOfWorkExperience: 20,
      careerIntent: 'settled',
    },
  },
  {
    name: 'Thirty-eight, made redundant, job hunting',
    expect: 'pivot',
    signals: {
      ageYears: 38,
      employmentStatus: 'seeking_work',
      careerIntent: 'forced_change',
      relationshipStatus: 'married',
      children: [],
      recentLifeEvents: [{ id: 'job_loss', monthsAgo: 3 }],
    },
  },
  {
    name: 'Fifty-two, teenager at home and caring for a parent',
    expect: 'sandwich',
    signals: {
      ageYears: 52,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      children: [{ ageYears: 14, dependent: true }],
      caringForDependentAdult: true,
      recentLifeEvents: [{ id: 'became_caregiver', monthsAgo: 8 }],
    },
  },
  {
    name: 'Fifty-eight, children grown and gone',
    expect: 'empty_nest',
    signals: {
      ageYears: 58,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_partner',
      children: [{ ageYears: 26, dependent: false }, { ageYears: 23, dependent: false }],
      caringForDependentAdult: false,
      recentLifeEvents: [{ id: 'child_left_home', monthsAgo: 14 }],
    },
  },
  {
    name: 'Sixty-two, still working, no dependants',
    expect: 'pre_retirement',
    signals: {
      ageYears: 62,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      livingArrangement: 'with_partner',
      children: [],
      careerIntent: 'settled',
      yearsOfWorkExperience: 38,
    },
  },
  {
    name: 'Seventy-one, retired',
    expect: 'later_life',
    signals: {
      ageYears: 71,
      employmentStatus: 'retired',
      relationshipStatus: 'married',
      children: [{ ageYears: 40, dependent: false }],
      recentLifeEvents: [{ id: 'retired', monthsAgo: 30 }],
    },
  },
];

describe('life-stage segmentation', () => {
  for (const persona of PERSONAS) {
    it(`places "${persona.name}" in ${persona.expect}`, () => {
      const result = segment(persona.signals);
      expect(result.primary.stageId).toBe(persona.expect);
    });
  }

  it('reaches usable confidence on a well-described profile', () => {
    const result = segment(PERSONAS[5]!.signals);
    expect(result.confidence).toBeGreaterThan(0.35);
    expect(result.coverage).toBeGreaterThan(0.4);
  });

  it('stays honest about uncertainty when almost nothing is known', () => {
    const result = segment({ ageYears: 30 });
    expect(result.coverage).toBeLessThan(0.25);
    expect(result.confidence).toBeLessThan(0.35);
    expect(result.missingSignals.length).toBeGreaterThan(0);
  });

  it('does not segment on age alone — same age, different lives, different stages', () => {
    const base = { ageYears: 34, employmentStatus: 'employed' as const };
    const withToddler = segment({
      ...base,
      children: [{ ageYears: 2, dependent: true }],
      relationshipStatus: 'married',
    });
    const singleNoKids = segment({
      ...base,
      children: [],
      relationshipStatus: 'single',
      livingArrangement: 'alone',
      careerIntent: 'settled',
      yearsOfWorkExperience: 11,
    });
    const changingCareer = segment({
      ...base,
      children: [],
      employmentStatus: 'seeking_work',
      careerIntent: 'actively_changing',
      recentLifeEvents: [{ id: 'job_loss', monthsAgo: 2 }],
    });

    expect(withToddler.primary.stageId).toBe('early_family');
    expect(changingCareer.primary.stageId).toBe('pivot');
    expect(
      new Set([
        withToddler.primary.stageId,
        singleNoKids.primary.stageId,
        changingCareer.primary.stageId,
      ]).size,
    ).toBe(3);
  });

  it('reports a competitive second stage when someone genuinely straddles', () => {
    // A twelve-year-old sits exactly between school-age and teenage parenting.
    const result = segment({
      ageYears: 44,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      children: [{ ageYears: 12, dependent: true }],
      caringForDependentAdult: false,
    });
    expect(result.secondary).toBeDefined();
    expect(['school_family', 'teen_family']).toContain(result.primary.stageId);
    expect(['school_family', 'teen_family']).toContain(result.secondary?.stageId);
  });

  it('explains itself with concrete evidence', () => {
    const result = segment(PERSONAS[10]!.signals);
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.rationale.some((entry) => /child/i.test(entry.signal))).toBe(true);
    for (const entry of result.rationale) {
      expect(entry.signal.length).toBeGreaterThan(0);
    }
  });
});

describe('modifier tags', () => {
  it('detects a single parent under financial pressure', () => {
    const result = segment({
      ageYears: 29,
      relationshipStatus: 'single',
      children: [{ ageYears: 4, dependent: true }],
      debtPressure: 'high',
      employmentStatus: 'employed',
    });
    expect(result.modifiers).toContain('single_parent');
    expect(result.modifiers).toContain('financially_stressed');
  });

  it('detects recent bereavement and relocation', () => {
    const result = segment({
      ageYears: 55,
      recentLifeEvents: [
        { id: 'bereavement', monthsAgo: 4 },
        { id: 'moved_country', monthsAgo: 6 },
      ],
    });
    expect(result.modifiers).toContain('recently_bereaved');
    expect(result.modifiers).toContain('relocating');
  });
});

describe('age guardrails', () => {
  it('hides age-gated dimensions from a fourteen-year-old', () => {
    const result = segment({ ageYears: 14, educationStatus: 'secondary_school' });
    expect(result.guardrails.isMinor).toBe(true);
    // Finance opens at 15, Environment at 16.
    expect(result.guardrails.hiddenDomains).toContain('finance');
    expect(result.guardrails.hiddenDomains).toContain('environment');
    expect(result.guardrails.contentFlags).toContain('minor_safe_mode');
    expect(result.guardrails.contentFlags).toContain('guardian_aware');
  });

  it('opens the full set of dimensions once age-gates are passed', () => {
    const fifteen = segment({ ageYears: 15 });
    const adult = segment({ ageYears: 18 });
    expect(fifteen.guardrails.isMinor).toBe(true);
    expect(fifteen.guardrails.hiddenDomains).toEqual(['environment']);
    expect(adult.guardrails.isMinor).toBe(false);
    expect(adult.guardrails.hiddenDomains).toHaveLength(0);
  });

  it('fails closed when age is unknown', () => {
    const result = segment({ employmentStatus: 'employed' });
    expect(result.guardrails.contentFlags).toContain('age_unverified_conservative_mode');
  });

  it('respects a jurisdiction where majority is twenty-one', () => {
    const result = segment({ ageYears: 19, countryCode: 'SG' });
    expect(result.guardrails.isMinor).toBe(true);
  });
});

describe('information-gain onboarding', () => {
  it('asks the highest-value question first, and it is not a fixed one', () => {
    const blank = segment({ ageYears: 34 });
    const knowsChildren = segment({
      ageYears: 34,
      children: [{ ageYears: 3, dependent: true }],
    });
    expect(blank.missingSignals[0]).toBeDefined();
    expect(blank.missingSignals[0]!.expectedGainBits).toBeGreaterThan(0);
    // Once children are known, the planner must move on to something else.
    expect(knowsChildren.missingSignals.map((m) => m.key)).not.toContain('children');
  });

  it('never asks a fourteen-year-old adult-only questions', () => {
    const result = segment({ ageYears: 14, educationStatus: 'secondary_school' });
    const keys = result.missingSignals.map((m) => m.key);
    expect(keys).not.toContain('children');
    expect(keys).not.toContain('housingTenure');
    expect(keys).not.toContain('expectingChild');
    expect(keys).not.toContain('caringForDependentAdult');
  });

  it('ranks questions by expected gain, descending', () => {
    const result = segment({ ageYears: 40 }, { maxQuestions: 5 });
    const gains = result.missingSignals.map((m) => m.expectedGainBits);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
  });

  it('stops asking once the profile is complete enough', () => {
    const full = segment({
      ageYears: 34,
      educationStatus: 'not_studying',
      employmentStatus: 'employed',
      careerIntent: 'settled',
      relationshipStatus: 'married',
      livingArrangement: 'with_own_family',
      children: [{ ageYears: 3, dependent: true }],
      expectingChild: false,
      caringForDependentAdult: false,
      housingTenure: 'mortgaged',
      debtPressure: 'manageable',
      healthStatus: 'steady',
    });
    expect(full.missingSignals).toHaveLength(0);
    expect(full.coverage).toBeGreaterThan(0.8);
  });
});

describe('onboarding questions are directly answerable', () => {
  it('ships every question with options the client can submit as-is', () => {
    const result = segment({ ageYears: 40 }, { maxQuestions: 5 });
    expect(result.missingSignals.length).toBeGreaterThan(0);
    for (const question of result.missingSignals) {
      expect(question.why.length).toBeGreaterThan(10);
      expect(question.answers.length).toBeGreaterThanOrEqual(2);
      for (const answer of question.answers) {
        expect(answer.label.length).toBeGreaterThan(0);
        // The patch must set the signal the question is about, so answering it
        // always removes that question from the next plan.
        expect(Object.keys(answer.patch)).toContain(question.key);
      }
    }
  });

  it('applies a chosen answer and moves the segmentation on', () => {
    const before = segment({ ageYears: 40 }, { maxQuestions: 1 });
    const question = before.missingSignals[0]!;
    const answer = question.answers[1]!;
    const after = segment({ ageYears: 40, ...answer.patch }, { maxQuestions: 1 });

    expect(after.coverage).toBeGreaterThan(before.coverage);
    expect(after.missingSignals.map((m) => m.key)).not.toContain(question.key);
  });
});

describe('transition forecasting', () => {
  it('raises turning eighteen for a seventeen-year-old, with lead time', () => {
    const forecasts = forecastTransitions({
      ageYears: 17,
      educationStatus: 'secondary_school',
    });
    const majority = forecasts.find((f) => f.id === 'reach_majority');
    expect(majority).toBeDefined();
    expect(majority!.active).toBe(true);
    expect(majority!.etaMonths).toBeLessThanOrEqual(12);
    expect(majority!.prepare.length).toBeGreaterThan(0);
  });

  it('sees school starting before it happens', () => {
    const forecasts = forecastTransitions({
      ageYears: 33,
      children: [{ ageYears: 4, dependent: true }],
    });
    const school = forecasts.find((f) => f.id === 'child_starts_school');
    expect(school).toBeDefined();
    expect(school!.etaMonths).toBe(12);
    expect(school!.active).toBe(true);
  });

  it('opens the retirement window five years out, not on the day', () => {
    const early = forecastTransitions({ ageYears: 45, employmentStatus: 'employed' });
    const late = forecastTransitions({ ageYears: 63, employmentStatus: 'employed' });
    expect(early.find((f) => f.id === 'reach_pension_age')?.active).toBe(false);
    expect(late.find((f) => f.id === 'reach_pension_age')?.active).toBe(true);
  });

  it('does not forecast retirement for someone already retired', () => {
    const forecasts = forecastTransitions({ ageYears: 60, employmentStatus: 'retired' });
    expect(forecasts.find((f) => f.id === 'reach_pension_age')).toBeUndefined();
  });

  it('derives age from a birth date', () => {
    const now = new Date('2026-08-28T00:00:00Z');
    // Born 2010-09-01, evaluated on 2026-08-28: the birthday has not landed yet,
    // so this must be 15, not 16.
    const result = segment({ birthDate: '2010-09-01', educationStatus: 'secondary_school' }, { now });
    expect(result.ageBand?.id).toBe('early_teen');
    expect(result.primary.stageId).toBe('foundation');
  });
});
