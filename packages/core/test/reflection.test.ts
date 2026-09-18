import { describe, expect, it } from 'vitest';
import {
  REFLECTION_MINIMUM_DAYS, explainReading, readDimensions,
  type DimensionReading, type LifeDomainId, type ReflectionDay,
} from '../src/index.js';

const day = (n: number): string => `2026-09-${String(n).padStart(2, '0')}`;

/** `n` days, each carrying `happiness` and the given dimensions. */
function run(
  spec: Array<[happiness: number, dims: LifeDomainId[]]>,
  from = 1,
): ReflectionDay[] {
  return spec.map(([happiness, dimensions], i) => ({
    date: day(from + i), happiness, dimensions,
  }));
}

const pick = (days: ReflectionDay[], id: LifeDomainId): DimensionReading =>
  readDimensions({ days }).dimensions.find((d) => d.domainId === id)!;

describe('reading the record as arithmetic', () => {
  it('always returns all eleven, whatever the record holds', () => {
    const r = readDimensions({ days: [] });
    expect(r.dimensions).toHaveLength(11);
    expect(r.dimensions.every((d) => d.band === 'insufficient')).toBe(true);
    expect(r.scoredDays).toBe(0);
  });

  it('withholds every band until the window is long enough', () => {
    const days = run([[3, ['career']], [8, []], [4, ['career']]]);
    expect(days.length).toBeLessThan(REFLECTION_MINIMUM_DAYS);
    const r = readDimensions({ days });
    expect(r.dimensions.every((d) => d.reason === 'no-window')).toBe(true);
    expect(r.basis).toContain('Impact needs');
  });

  it('names why a dimension could not be scored, rather than scoring it zero', () => {
    const days = run([
      [3, ['career']], [8, ['health']], [4, ['career']], [7, ['health']],
      [5, ['career', 'health', 'family']], [6, ['career', 'health']],
    ]);
    expect(pick(days, 'finance').reason).toBe('not-mentioned');
    expect(pick(days, 'family').reason).toBe('too-few-mentions');
  });

  it('calls a dimension on every day uncomparable, not all-powerful', () => {
    const days = run([[3, ['family']], [8, ['family']], [4, ['family']], [7, ['family']]]);
    const family = pick(days, 'family');
    expect(family.reason).toBe('no-contrast');
    expect(family.reach).toBe(1);
    expect(family.score).toBe(0);
  });
});

describe('impact, direction and confidence are three separate answers', () => {
  /* Career runs through the bad days, health through the good ones, across a
     window long enough to say so. */
  const days = run([
    [3, ['career']], [9, ['health']], [2, ['career']], [8, ['health']],
    [3, ['career']], [9, ['health']], [2, ['career']], [8, ['health']],
    [4, ['career']], [9, ['health']],
  ]);

  it('scores a strong, well-covered drag as high and negative', () => {
    const career = pick(days, 'career');
    expect(career.band).toBe('high');
    expect(career.direction).toBe('negative');
    expect(career.delta).toBeLessThan(-2);
  });

  it('scores the other side of the same window as high and positive', () => {
    const health = pick(days, 'health');
    expect(health.band).toBe('high');
    expect(health.direction).toBe('positive');
    expect(health.delta).toBeGreaterThan(2);
  });

  it('separates a big effect seen twice from the same effect seen often', () => {
    const rare = run([
      [2, ['career']], [8, []], [7, []], [8, []],
      [3, ['career']], [7, []], [8, []], [7, []], [8, []], [7, []],
    ]);
    const career = pick(rare, 'career');
    // The difference is large, so the impact is not dismissed...
    expect(Math.abs(career.delta)).toBeGreaterThan(4);
    expect(career.band).not.toBe('insufficient');
    // ...but two days is two days, and the confidence says so.
    expect(career.confidence).toBe('low');
    expect(career.daysWith).toBe(2);
  });

  it('will not turn four identical days into a confident reading', () => {
    // Perfect separation, zero variance: without a noise floor this is a
    // standard error of zero and a "certain" answer out of four days.
    const days2 = run([[8, ['fun']], [8, ['fun']], [4, []], [4, []]]);
    const fun = pick(days2, 'fun');
    expect(fun.delta).toBe(4);
    expect(fun.confidence).toBe('low');
    expect(fun.margin).toBeGreaterThan(0);
  });

  it('grows more confident as the same pattern repeats', () => {
    const short = pick(run([
      [3, ['career']], [7, []], [4, ['career']], [8, []], [3, ['career']], [7, []],
    ]), 'career');
    const long = pick(run(Array.from({ length: 24 }, (_, i) => (
      i % 2 === 0 ? [3 + (i % 3), ['career']] : [7 + (i % 3), []]
    ) as [number, LifeDomainId[]])), 'career');
    expect(long.confidenceSteps).toBeGreaterThan(short.confidenceSteps);
  });

  it('calls a difference inside the scale’s own granularity mixed', () => {
    const days2 = run([
      [6, ['social']], [6, []], [7, ['social']], [7, []],
      [6, ['social']], [6, []], [7, ['social']], [7, []],
    ]);
    const social = pick(days2, 'social');
    expect(social.direction).toBe('mixed');
    expect(social.band).toBe('low');
  });

  it('reports low impact with high confidence when the record is long and flat', () => {
    // Fifty days saying "this does not move you" is the surest reading here,
    // and must not be filed as low confidence.
    const flat = run(Array.from({ length: 50 }, (_, i) => (
      [6 + (i % 3), i % 2 === 0 ? ['finance'] : []]
    ) as [number, LifeDomainId[]]));
    const finance = pick(flat, 'finance');
    expect(finance.band).toBe('low');
    expect(finance.confidence).toBe('high');
    expect(finance.confidenceSteps).toBe(4);
  });

  it('never lets the meter disagree with the word beside it', () => {
    const all = readDimensions({ days: run([
      [3, ['career']], [9, ['health']], [2, ['career']], [8, ['health']],
      [3, ['career']], [9, ['health']], [4, ['family']], [6, []],
    ]) }).dimensions;
    for (const d of all) {
      expect(d.confidenceSteps).toBeGreaterThanOrEqual(1);
      expect(d.confidenceSteps).toBeLessThanOrEqual(4);
      if (d.confidence === 'high') expect(d.confidenceSteps).toBe(4);
      if (d.confidence === 'medium') expect(d.confidenceSteps).toBe(3);
      if (d.confidence === 'low') expect(d.confidenceSteps).toBeLessThanOrEqual(2);
    }
  });
});

describe('the ranking', () => {
  const days = run([
    [2, ['career']], [9, ['health']], [3, ['career']], [8, ['health']],
    [2, ['career']], [9, ['health', 'fun']], [5, ['fun']], [6, ['fun']],
    [3, ['career']], [8, ['health']],
  ]);

  it('puts scored dimensions above unscored ones whatever the taxonomy says', () => {
    const order = readDimensions({ days }).dimensions;
    const lastScored = order.findIndex((d) => d.band === 'insufficient');
    expect(lastScored).toBeGreaterThan(0);
    expect(order.slice(lastScored).every((d) => d.band === 'insufficient')).toBe(true);
  });

  it('is stable for dimensions with nothing to separate them', () => {
    const a = readDimensions({ days }).dimensions.map((d) => d.domainId);
    const b = readDimensions({ days: [...days].reverse() }).dimensions.map((d) => d.domainId);
    expect(a).toEqual(b);
  });

  it('is the same reading every time it is run', () => {
    expect(readDimensions({ days })).toEqual(readDimensions({ days }));
  });
});

describe('explaining a reading', () => {
  it('restates the arithmetic rather than making a claim about the person', () => {
    const days = run([
      [3, ['career']], [8, []], [2, ['career']], [7, []],
      [3, ['career']], [8, []],
    ]);
    const text = explainReading(pick(days, 'career'));
    expect(text).toContain('3 of 6 days');
    expect(text).toContain('lower');
  });

  it('says what is missing when a dimension could not be scored', () => {
    const days = run([[3, ['career']], [8, []], [2, ['career']], [7, []]]);
    expect(explainReading(pick(days, 'finance'))).toContain('has not come up'.replace('h', 'H'));
  });
});

describe('what this module deliberately does not do', () => {
  it('never weights a dimension by how much the life stage asks of it', () => {
    // Stage priority lives in balance()/dimensionScores(). Keeping it out of
    // here is what lets the screen show "your stage leans on this hard, and
    // your own days show no sign of it" — the reading worth surfacing, and
    // the one a combined number would erase.
    const days = run([
      [3, ['finance']], [8, []], [4, ['finance']], [7, []],
      [3, ['finance']], [8, []],
    ]);
    const finance = pick(days, 'finance');
    const fun = pick(run([
      [3, ['fun']], [8, []], [4, ['fun']], [7, []], [3, ['fun']], [8, []],
    ]), 'fun');
    // Same evidence, same reading — the dimension's name buys it nothing.
    expect(finance.score).toBe(fun.score);
    expect(finance.band).toBe(fun.band);
    expect(finance.confidence).toBe(fun.confidence);
  });

  it('exposes only what the arithmetic supports', () => {
    const r = pick(run([
      [3, ['career']], [8, []], [4, ['career']], [7, []], [3, ['career']], [8, []],
    ]), 'career');
    expect(Object.keys(r).sort()).toEqual([
      'band', 'confidence', 'confidenceSteps', 'daysWith', 'daysWithout', 'delta',
      'direction', 'domainId', 'label', 'margin', 'meanWith', 'meanWithout',
      'reach', 'score',
    ]);
  });
});
