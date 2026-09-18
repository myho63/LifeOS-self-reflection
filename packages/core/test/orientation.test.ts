import { describe, expect, it } from 'vitest';
import { orient, segment } from '../src/index.js';
import type { LifeDomainId, ProfileSignals } from '../src/types.js';

function planFor(signals: ProfileSignals) {
  return orient(segment(signals));
}

const TEEN: ProfileSignals = {
  ageYears: 15,
  educationStatus: 'secondary_school',
  livingArrangement: 'with_parents',
  children: [],
};

const NEW_PARENT: ProfileSignals = {
  ageYears: 32,
  employmentStatus: 'employed',
  relationshipStatus: 'married',
  livingArrangement: 'with_own_family',
  children: [{ ageYears: 2, dependent: true }],
  caringForDependentAdult: false,
};

const PRE_RETIREE: ProfileSignals = {
  ageYears: 62,
  employmentStatus: 'employed',
  relationshipStatus: 'married',
  children: [],
  careerIntent: 'settled',
  yearsOfWorkExperience: 38,
};

function rankOf(plan: ReturnType<typeof planFor>, domain: LifeDomainId): number {
  return plan.priorities.find((p) => p.domainId === domain)?.rank ?? Number.MAX_SAFE_INTEGER;
}

describe('orientation adapts to life stage', () => {
  it('gives three different people three different priority orders', () => {
    const teen = planFor(TEEN);
    const parent = planFor(NEW_PARENT);
    const retiree = planFor(PRE_RETIREE);

    const orders = [teen, parent, retiree].map((p) =>
      p.priorities.map((d) => d.domainId).join(','),
    );
    expect(new Set(orders).size).toBe(3);
  });

  it('leads a teenager with personal growth, and hides what is age-gated', () => {
    const plan = planFor(TEEN);
    expect(plan.focus.map((f) => f.domainId)).toContain('personal_growth');
    expect(rankOf(plan, 'personal_growth')).toBe(1);
    // Environment opens at 16, so at 15 it is absent entirely rather than
    // merely ranked low. Finance opens at 15 and is therefore present.
    expect(plan.priorities.some((p) => p.domainId === 'environment')).toBe(false);
    expect(plan.priorities.some((p) => p.domainId === 'finance')).toBe(true);
    expect(plan.priorities).toHaveLength(10);
  });

  it('puts money and relationships first for a parent of a toddler', () => {
    const plan = planFor(NEW_PARENT);
    const focusIds = plan.focus.map((f) => f.domainId);
    expect(focusIds).toContain('relationships');
    expect(focusIds).toContain('finance');
    expect(rankOf(plan, 'fun')).toBeGreaterThan(rankOf(plan, 'finance'));
  });

  it('puts finance and health at the top approaching retirement', () => {
    const plan = planFor(PRE_RETIREE);
    expect(rankOf(plan, 'finance')).toBe(1);
    expect(rankOf(plan, 'health')).toBe(2);
    // Contribution rises in this stage and overtakes career.
    expect(rankOf(plan, 'contribution')).toBeLessThan(rankOf(plan, 'career'));
  });

  it('shortens the planning horizon for people in the middle of a change', () => {
    const settled = planFor(PRE_RETIREE);
    const pivoting = planFor({
      ageYears: 38,
      employmentStatus: 'seeking_work',
      careerIntent: 'forced_change',
      children: [],
      recentLifeEvents: [{ id: 'job_loss', monthsAgo: 2 }],
    });
    expect(pivoting.planningHorizonYears).toBeLessThan(settled.planningHorizonYears);
    expect(pivoting.reviewCadenceDays).toBeLessThan(settled.reviewCadenceDays);
  });
});

describe('modifiers bend the plan', () => {
  it('raises money and mental health when someone is under financial pressure', () => {
    const baseline = planFor(NEW_PARENT);
    const stressed = planFor({ ...NEW_PARENT, debtPressure: 'severe' });

    const moneyBefore = baseline.priorities.find((p) => p.domainId === 'finance')!.weight;
    const moneyAfter = stressed.priorities.find((p) => p.domainId === 'finance')!.weight;
    expect(moneyAfter).toBeGreaterThan(moneyBefore);
    expect(rankOf(stressed, 'finance')).toBeLessThanOrEqual(rankOf(baseline, 'finance'));
  });

  it('names the circumstance in the explanation', () => {
    const plan = planFor({ ...NEW_PARENT, relationshipStatus: 'single', debtPressure: 'high' });
    const money = plan.priorities.find((p) => p.domainId === 'finance')!;
    expect(money.why.toLowerCase()).toContain('parenting alone');
  });

  it('reduces demands elsewhere when health is the live problem', () => {
    const baseline = planFor(PRE_RETIREE);
    const struggling = planFor({ ...PRE_RETIREE, healthStatus: 'struggling' });
    expect(rankOf(struggling, 'health')).toBeLessThanOrEqual(2);
    expect(rankOf(struggling, 'career')).toBeGreaterThan(rankOf(baseline, 'career'));
  });
});

describe('blind spots', () => {
  it('raises what a stage reliably ignores, and never repeats the focus', () => {
    const plan = planFor(NEW_PARENT);
    expect(plan.blindSpots.length).toBeGreaterThan(0);
    const focusIds = new Set(plan.focus.map((f) => f.domainId));
    for (const spot of plan.blindSpots) {
      expect(focusIds.has(spot.domainId)).toBe(false);
      expect(spot.severity).toBeGreaterThan(0);
      expect(spot.prompt.length).toBeGreaterThan(20);
    }
  });

  it('never raises a blind spot in a domain hidden at this age', () => {
    const plan = planFor(TEEN);
    const hidden = new Set(plan.guardrails.hiddenDomains);
    for (const spot of plan.blindSpots) {
      expect(hidden.has(spot.domainId)).toBe(false);
    }
  });
});

describe('straddling stages', () => {
  it('blends both stages rather than picking one arbitrarily', () => {
    const plan = planFor({
      ageYears: 44,
      employmentStatus: 'employed',
      relationshipStatus: 'married',
      children: [{ ageYears: 12, dependent: true }],
      caringForDependentAdult: false,
    });
    expect(plan.headline).toMatch(/moving toward/i);
  });
});

describe('confidence is carried through', () => {
  it('marks a thin profile as provisional', () => {
    const thin = planFor({ ageYears: 40 });
    const full = planFor(NEW_PARENT);
    expect(thin.confidence).toBeLessThan(full.confidence);
  });
});
