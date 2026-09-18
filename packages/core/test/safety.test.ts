import { describe, expect, it } from 'vitest';
import {
  isContentAllowed,
  redactForAnalytics,
  screenText,
  segment,
  specialCategorySignals,
} from '../src/index.js';

describe('crisis screening', () => {
  it('interrupts on explicit self-harm language', () => {
    const result = screenText('i keep thinking about killing myself');
    expect(result.severity).toBe('urgent');
    expect(result.action).toBe('interrupt_with_support');
    expect(result.resources.length).toBeGreaterThan(0);
  });

  it('interrupts on acute hopelessness', () => {
    const result = screenText("i can't go on like this, there is no point any more");
    expect(['urgent', 'elevated']).toContain(result.severity);
    expect(result.action).toBe('interrupt_with_support');
  });

  it('offers support without interrupting on lower-level distress', () => {
    const result = screenText('i have been so burnt out and cannot sleep');
    expect(result.severity).toBe('monitor');
    expect(result.action).toBe('offer_support');
  });

  it('leaves ordinary planning text alone', () => {
    const result = screenText('I want to work out whether to rent or buy next year');
    expect(result.severity).toBe('none');
    expect(result.action).toBe('continue');
    expect(result.resources).toHaveLength(0);
  });

  it('does not fire on ordinary uses of loaded words', () => {
    expect(screenText('this deadline is killing my weekend plans').severity).toBe('none');
    expect(screenText('my phone battery died').severity).toBe('none');
  });

  it('adds a trusted-adult route for under-18s', () => {
    const minor = screenText('i want to hurt myself', { isMinor: true });
    const adult = screenText('i want to hurt myself', { isMinor: false });
    expect(minor.message).toMatch(/adult you trust/i);
    expect(adult.message).not.toMatch(/adult you trust/i);
  });

  it('surfaces a local line first where one is known', () => {
    const result = screenText('i feel suicidal', { countryCode: 'GB' });
    expect(result.resources[0]!.scope).toBe('country');
    expect(result.resources.some((r) => r.contact === 'https://findahelpline.com')).toBe(true);
  });

  it('still returns a route where no local line is configured', () => {
    const result = screenText('i feel suicidal', { countryCode: 'ZZ' });
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.resources[0]!.scope).toBe('global');
  });
});

describe('content gating', () => {
  const teen = segment({ ageYears: 15, educationStatus: 'secondary_school' });
  const adult = segment({ ageYears: 40, employmentStatus: 'employed' });

  it('blocks regulated product content for a minor', () => {
    const verdict = isContentAllowed(
      { id: 'credit-card-basics', domain: 'finance', regulatedProduct: true },
      teen.guardrails,
      15,
    );
    expect(verdict.allowed).toBe(false);
  });

  it('allows the same domain without the product framing', () => {
    const verdict = isContentAllowed(
      { id: 'first-budget', domain: 'finance' },
      teen.guardrails,
      15,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('blocks estate planning for a minor and allows it for an adult', () => {
    // Legacy lives inside Contribution & Community, which is open to teenagers.
    // Estate planning is therefore gated at the content level, which is the
    // right granularity: a 15-year-old can volunteer but should not be writing
    // a will.
    const wills = { id: 'wills', domain: 'contribution' as const, minAge: 25 };
    expect(isContentAllowed(wills, teen.guardrails, 15).allowed).toBe(false);
    expect(isContentAllowed(wills, adult.guardrails, 40).allowed).toBe(true);
    // The surrounding dimension stays reachable for the teenager.
    expect(isContentAllowed({ id: 'volunteering', domain: 'contribution' }, teen.guardrails, 15).allowed).toBe(true);
  });

  it('fails closed when age is unknown', () => {
    const unknown = segment({ employmentStatus: 'employed' });
    const verdict = isContentAllowed({ id: 'wills', domain: 'contribution', minAge: 25 }, unknown.guardrails);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/age unknown/i);
  });
});

describe('data handling', () => {
  it('classifies health, pregnancy and caring status as special category', () => {
    const special = specialCategorySignals();
    expect(special).toContain('healthStatus');
    expect(special).toContain('expectingChild');
    expect(special).toContain('caringForDependentAdult');
  });

  it('strips special-category and identifying fields from analytics exports', () => {
    const redacted = redactForAnalytics({
      ageYears: 34,
      birthDate: '1992-01-04',
      healthStatus: 'struggling',
      expectingChild: true,
      children: [{ ageYears: 3, dependent: true }, { ageYears: 26, dependent: false }],
      employmentStatus: 'employed',
      recentLifeEvents: [{ id: 'bereavement', monthsAgo: 2 }],
    });

    expect(redacted.healthStatus).toBeUndefined();
    expect(redacted.expectingChild).toBeUndefined();
    expect(redacted.recentLifeEvents).toBeUndefined();
    expect(redacted.birthDate).toBeUndefined();
    expect(redacted.children).toBeUndefined();

    // What segmentation actually needs survives, in coarsened form.
    expect(redacted.dependentChildCount).toBe(1);
    expect(redacted.ageBucket).toBe('30-34');
    expect(redacted.employmentStatus).toBe('employed');
  });
});
