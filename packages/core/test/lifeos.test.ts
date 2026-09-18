import { describe, expect, it } from 'vitest';
import {
  balance, framingFor, getSeason, importTraits, nextCheckIn, orient,
  scoreTraits, seasonForStage, segment, TRAIT_ITEMS, type Assessment,
  type LifeDomainId, type ProfileSignals,
} from '../src/index.js';

const TODAY = '2026-08-29';
const NOW = new Date(`${TODAY}T12:00:00Z`);

const PARENT: ProfileSignals = {
  ageYears: 38,
  employmentStatus: 'employed',
  relationshipStatus: 'married',
  livingArrangement: 'with_own_family',
  children: [{ ageYears: 4, dependent: true }],
  caringForDependentAdult: false,
  healthStatus: 'steady',
};

function planFor(signals: ProfileSignals) {
  return orient(segment(signals), { signals });
}

function rate(entries: Partial<Record<LifeDomainId, number>>, ratedAt = TODAY): Assessment {
  return {
    ratings: Object.entries(entries).map(([domainId, standing]) => ({
      domainId: domainId as LifeDomainId,
      standing: standing as number,
      ratedAt,
    })),
  };
}

// ---------------------------------------------------------------- dimensions
describe('the eleven dimensions', () => {
  it('gives every person a full wheel unless age gates something', () => {
    const adult = planFor(PARENT);
    expect(adult.priorities).toHaveLength(11);
    const teen = planFor({ ageYears: 14, educationStatus: 'secondary_school', children: [] });
    expect(teen.priorities.length).toBeLessThan(11);
  });

  it('ranks the same eleven differently for different lives', () => {
    const a = planFor(PARENT).priorities.map((p) => p.domainId).join();
    const b = planFor({ ageYears: 24, employmentStatus: 'employed', relationshipStatus: 'single', children: [], livingArrangement: 'alone' })
      .priorities.map((p) => p.domainId).join();
    expect(a).not.toBe(b);
  });
});

// -------------------------------------------------------------------- seasons
describe('seasons sit above stages', () => {
  it('rolls each stage up into a season', () => {
    expect(seasonForStage('foundation')).toBe('explore');
    expect(seasonForStage('establish')).toBe('build');
    expect(seasonForStage('early_family')).toBe('grow');
    expect(seasonForStage('pivot')).toBe('reinvent');
    expect(seasonForStage('pre_retirement')).toBe('transition');
  });

  it('is not chronological — a 27-year-old and a 55-year-old can share a season', () => {
    const youngPivot = planFor({
      ageYears: 27, employmentStatus: 'seeking_work', careerIntent: 'forced_change',
      children: [], recentLifeEvents: [{ id: 'job_loss', monthsAgo: 2 }],
    });
    const olderPivot = planFor({
      ageYears: 55, employmentStatus: 'seeking_work', careerIntent: 'forced_change',
      children: [], recentLifeEvents: [{ id: 'job_loss', monthsAgo: 2 }],
    });
    expect(youngPivot.seasonId).toBe('reinvent');
    expect(olderPivot.seasonId).toBe('reinvent');
  });

  it('splits later life on capability rather than birthday', () => {
    const thriving = seasonForStage('later_life', { ageYears: 70, healthStatus: 'thriving' });
    const limited = seasonForStage('later_life', { ageYears: 68, healthStatus: 'struggling' });
    const veryLate = seasonForStage('later_life', { ageYears: 84, healthStatus: 'thriving' });
    expect(thriving).toBe('enjoy');
    expect(limited).toBe('preserve');
    expect(veryLate).toBe('preserve');
  });

  it('carries the question the chapter is really asking', () => {
    const plan = planFor(PARENT);
    expect(plan.primaryQuestion.length).toBeGreaterThan(10);
    expect(getSeason(plan.seasonId).primaryQuestion).toMatch(/\?$/);
  });
});

// ----------------------------------------------------------------- assessment
describe('personal analysis', () => {
  it('scores the short form and leaves unanswered factors undefined', () => {
    const scores = scoreTraits({ o1: 5, o2: 1, c1: 2, c2: 5 });
    expect(scores.openness).toBe(100);
    expect(scores.conscientiousness).toBe(13);
    expect(scores.extraversion).toBeUndefined();
  });

  it('has two items per factor, one of them reverse-keyed', () => {
    const byFactor = new Map<string, number>();
    for (const item of TRAIT_ITEMS) byFactor.set(item.factor, (byFactor.get(item.factor) ?? 0) + 1);
    expect([...byFactor.values()].every((n) => n === 2)).toBe(true);
    expect(TRAIT_ITEMS.filter((i) => i.reversed)).toHaveLength(5);
  });

  it('accepts scores measured elsewhere rather than re-asking', () => {
    const imported = importTraits({ openness: 82, conscientiousness: 140, stability: -5 }, 'Big Five (external)');
    expect(imported.traitSource).toBe('imported');
    expect(imported.importedFrom).toBe('Big Five (external)');
    expect(imported.traits.conscientiousness).toBe(100);
    expect(imported.traits.stability).toBe(0);
  });

  it('turns traits into framing, and explains every inference', () => {
    const scattered = framingFor({ conscientiousness: 20, stability: 25 });
    expect(scattered.milestoneGranularity).toBe('fine');
    expect(scattered.preferFewerCommitments).toBe(true);
    expect(scattered.gentleTone).toBe(true);
    expect(scattered.reasons.length).toBeGreaterThanOrEqual(2);

    const disciplined = framingFor({ conscientiousness: 90 });
    expect(disciplined.milestoneGranularity).toBe('coarse');

    expect(framingFor(undefined).reasons).toHaveLength(0);
  });

  it('lets traits tilt the budget but never override the life stage', () => {
    const base = planFor(PARENT);
    const anxious = orient(segment(PARENT), { signals: PARENT, traits: { stability: 15 } });
    const rankOf = (p: typeof base, d: LifeDomainId) => p.priorities.find((x) => x.domainId === d)!.rank;
    expect(rankOf(anxious, 'health')).toBeLessThanOrEqual(rankOf(base, 'health'));
    // Money is structural in this stage and must survive any trait profile.
    expect(rankOf(anxious, 'finance')).toBeLessThanOrEqual(3);
  });
});

// -------------------------------------------------------------------- balance
/** All eleven rated, so nothing is a deficit merely for being unrated. */
const PARENT_RATINGS: Partial<Record<LifeDomainId, number>> = {
  family: 8, relationships: 3, finance: 8, health: 4, career: 9, environment: 7,
  personal_growth: 9, fun: 2, social: 4, spirituality: 5, contribution: 5,
};

describe('balance: priority against standing', () => {
  const plan = planFor(PARENT);

  it('finds the deficit — high priority, low standing', () => {
    const report = balance(plan, rate(PARENT_RATINGS), { now: NOW });
    // Family is rated well here, so the partner relationship is the live gap.
    // Splitting the two is what makes that distinction possible at all.
    expect(report.deficits[0]!.domainId).toBe('relationships');
    expect(report.deficits[0]!.state).toBe('deficit');
    expect(report.deficits[0]!.gap!).toBeGreaterThan(0.5);
  });

  it('names the over-invested dimension so attention has somewhere to come from', () => {
    const report = balance(plan, rate({
      family: 8, relationships: 3, finance: 4, health: 4, career: 9, environment: 5,
      personal_growth: 9, fun: 2, social: 3, spirituality: 4, contribution: 5,
    }), { now: NOW });
    expect(report.overinvested.map((d) => d.domainId)).toContain('personal_growth');
    expect(report.reallocation).toBeDefined();
    expect(report.reallocation!.to).toBe(report.deficits[0]!.domainId);
  });

  it('says the allocation sentence when things are broadly fine but misdirected', () => {
    const report = balance(plan, rate({
      family: 8, relationships: 4, finance: 8, health: 7, career: 9, environment: 8,
      personal_growth: 9, fun: 3, social: 4, spirituality: 6, contribution: 7,
    }), { now: NOW });
    expect(report.headline).toMatch(/allocation problem/i);
  });

  it('classifies all four states', () => {
    const report = balance(plan, rate({ relationships: 9, finance: 2, fun: 9, personal_growth: 1 }), { now: NOW });
    const stateOf = (d: LifeDomainId) => report.dimensions.find((x) => x.domainId === d)!.state;
    expect(stateOf('relationships')).toBe('aligned');
    expect(stateOf('finance')).toBe('deficit');
    expect(stateOf('fun')).toBe('overinvested');
    expect(stateOf('personal_growth')).toBe('dormant');
  });

  it('explains a deficit by what is feeding it', () => {
    // Money is upstream of environment; when both are low, that is worth saying.
    const report = balance(plan, rate({ finance: 2, environment: 2 }), { now: NOW });
    const environment = report.dimensions.find((d) => d.domainId === 'environment')!;
    expect(environment.blockedBy).toContain('finance');
    expect(environment.note).toMatch(/unlikely to move much while/i);
  });

  it('treats an unrated dimension that matters as a finding, not a blank', () => {
    const report = balance(plan, { ratings: [] }, { now: NOW });
    expect(report.coverage).toBe(0);
    expect(report.headline).toMatch(/prescription without a diagnosis/i);
    expect(report.deficits.length).toBeGreaterThan(0);
  });

  it('flags stale ratings and asks about them next', () => {
    const old = balance(plan, rate({
      family: 7, relationships: 7, finance: 7, health: 7, career: 7, environment: 7,
      personal_growth: 7, fun: 7, social: 7, spirituality: 7, contribution: 7,
    }, '2026-01-01'), { now: NOW });
    expect(old.stale.length).toBeGreaterThan(0);
    expect(nextCheckIn(old)).toBeDefined();
  });

  it('asks about the highest-priority unrated dimension first', () => {
    const report = balance(plan, rate({ fun: 5 }), { now: NOW });
    const asked = nextCheckIn(report)!;
    expect(asked).not.toBe('fun');
    expect(plan.priorities.find((p) => p.domainId === asked)!.rank).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------- goals
