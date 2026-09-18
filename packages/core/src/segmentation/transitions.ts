import type { LifeStageId, ProfileSignals, TransitionForecast } from '../types.js';
import { deriveContext, type DerivedContext } from './context.js';
import { ageOfMajority } from './engine.js';

/**
 * Transition forecasting — the part that makes Life OS proactive rather than
 * reactive.
 *
 * Most life-stage changes are visible months or years in advance: a child turns
 * five, a teenager turns eighteen, a pension age approaches. The value of the
 * product is largely in raising these *before* they land, while preparation is
 * still cheap, so every forecast carries a `prepLeadMonths` and goes `active`
 * once the window opens.
 *
 * Only dateable transitions are forecast. The engine deliberately does not
 * speculate about whether someone will partner, have children or change career,
 * because guessing at those is both unreliable and intrusive.
 */

/** State pension / retirement age by country, defaulting where unlisted. */
const PENSION_AGE: Record<string, number> = {
  US: 67, GB: 67, AU: 67, CA: 65, SG: 63, JP: 65, VN: 62, DE: 67, FR: 64,
};
const DEFAULT_PENSION_AGE = 66;

function pensionAge(countryCode?: string): number {
  if (!countryCode) return DEFAULT_PENSION_AGE;
  return PENSION_AGE[countryCode.toUpperCase()] ?? DEFAULT_PENSION_AGE;
}

function monthsUntilAge(currentAge: number | undefined, targetAge: number): number | undefined {
  if (currentAge === undefined) return undefined;
  const years = targetAge - currentAge;
  if (years < 0) return undefined;
  return Math.round(years * 12);
}

function forecast(
  input: Omit<TransitionForecast, 'active'> & { active?: boolean },
): TransitionForecast {
  return { ...input, active: input.active ?? input.etaMonths <= input.prepLeadMonths };
}

function childTransitions(ctx: DerivedContext): TransitionForecast[] {
  const out: TransitionForecast[] = [];
  const youngest = ctx.youngestDependentAge;
  if (youngest === undefined) return out;

  const startSchool = monthsUntilAge(youngest, 5);
  if (startSchool !== undefined && startSchool > 0) {
    out.push(
      forecast({
        id: 'child_starts_school',
        title: 'Your youngest starts school',
        towardStageId: 'school_family',
        etaMonths: startSchool,
        prepLeadMonths: 12,
        domains: ['finance', 'career', 'relationships'],
        why: 'Childcare costs fall sharply and weekday bandwidth returns — the single biggest financial and career inflection of the early-family years.',
        prepare: [
          'Re-run the household budget without full-time childcare',
          'Decide in advance where the freed hours and money should go',
          'Reopen the career conversation you paused',
        ],
      }),
    );
  }

  const secondary = monthsUntilAge(youngest, 11);
  if (secondary !== undefined && secondary > 0) {
    out.push(
      forecast({
        id: 'child_starts_secondary',
        title: 'Your youngest moves to secondary school',
        towardStageId: 'teen_family',
        etaMonths: secondary,
        prepLeadMonths: 9,
        domains: ['relationships', 'health', 'finance'],
        why: 'The parenting job changes from supervision to negotiation, and costs step up again.',
        prepare: [
          'Agree the independence you will hand over, and when',
          'Budget for the step-change in costs',
          'Set up the conversations you want to be having by then',
        ],
      }),
    );
  }

  const adulthood = monthsUntilAge(youngest, 18);
  if (adulthood !== undefined && adulthood > 0) {
    out.push(
      forecast({
        id: 'child_reaches_adulthood',
        title: 'Your youngest reaches adulthood',
        towardStageId: 'empty_nest',
        etaMonths: adulthood,
        prepLeadMonths: 24,
        domains: ['finance', 'personal_growth', 'relationships'],
        why: 'Support costs, household shape and your own direction all change at once — and the financial commitment is usually decided far too late.',
        prepare: [
          'Cost the support you intend to give, and check it against your retirement plan',
          'Start sketching what you want the following decade to be for',
          'Talk about how the relationship changes when they leave',
        ],
      }),
    );
  }

  return out;
}

export function forecastTransitions(
  signals: ProfileSignals,
  currentStage?: LifeStageId,
  now: Date = new Date(),
): TransitionForecast[] {
  const ctx = deriveContext(signals, now);
  const age = ctx.age;
  const out: TransitionForecast[] = [];

  // -- Reaching legal adulthood -------------------------------------------
  const majority = ageOfMajority(signals.countryCode);
  const toMajority = monthsUntilAge(age, majority);
  if (toMajority !== undefined && toMajority > 0) {
    out.push(
      forecast({
        id: 'reach_majority',
        title: `You turn ${majority}`,
        towardStageId: 'launch',
        etaMonths: toMajority,
        prepLeadMonths: 12,
        domains: ['finance', 'career'],
        why: 'Legal adulthood switches on a set of responsibilities and options at once — bank accounts, contracts, tax, and the end of most automatic support.',
        prepare: [
          'Get identity documents and a bank account in your own name',
          'Understand what you become responsible for on the day',
          'Have the next-step conversation before it is urgent',
        ],
      }),
    );
  }

  // -- End of secondary education -----------------------------------------
  if (signals.educationStatus === 'secondary_school') {
    const toLeaving = monthsUntilAge(age, 18);
    if (toLeaving !== undefined && toLeaving > 0) {
      out.push(
        forecast({
          id: 'leave_secondary',
          title: 'You finish school',
          towardStageId: 'launch',
          etaMonths: toLeaving,
          prepLeadMonths: 18,
          domains: ['personal_growth', 'career'],
          why: 'The decision made here shapes the following decade more than any other in this stage, and the good options close earliest.',
          prepare: [
            'Compare study, training and work on the same terms — cost, time, and what each keeps open',
            'Get first-hand exposure to at least two paths you are considering',
            'Find out which entry requirements have deadlines a year out',
          ],
        }),
      );
    }
  }

  // -- Arrival of a child --------------------------------------------------
  if (signals.expectingChild) {
    out.push(
      forecast({
        id: 'child_arrives',
        title: 'Your child arrives',
        towardStageId: 'early_family',
        // Without a due date, assume mid-pregnancy: the window is open either way.
        etaMonths: 5,
        prepLeadMonths: 9,
        domains: ['finance', 'relationships', 'health'],
        why: 'Income, time and household logistics all change on a known date. Almost everything worth arranging is easier to arrange now.',
        prepare: [
          'Model the income change through leave and the first year back',
          'Put life cover, wills and guardianship in place',
          'Agree how you will divide nights, admin and the mental load',
        ],
      }),
    );
  }

  // -- Children becoming independent --------------------------------------
  out.push(...childTransitions(ctx));

  // -- Approaching retirement ---------------------------------------------
  const retirementAge = pensionAge(signals.countryCode);
  const toRetirement = monthsUntilAge(age, retirementAge);
  if (toRetirement !== undefined && toRetirement > 0 && ctx.retired !== true) {
    out.push(
      forecast({
        id: 'reach_pension_age',
        title: `You reach ${retirementAge}`,
        towardStageId: 'later_life',
        etaMonths: toRetirement,
        prepLeadMonths: 60,
        domains: ['finance', 'personal_growth', 'health', 'contribution'],
        why: 'Retirement income has to be designed years ahead — and the non-financial half, purpose and structure, is usually left until after it is too late to shape.',
        prepare: [
          'Test whether your income plan survives a longer life than you expect',
          'Decide what the first two years will actually contain',
          'Put wills, wishes and powers of attorney in order',
        ],
      }),
    );
  }

  // -- Career transition already underway ---------------------------------
  if (signals.careerIntent === 'actively_changing' || signals.careerIntent === 'forced_change') {
    out.push(
      forecast({
        id: 'career_transition',
        title: 'Your career change lands',
        towardStageId: 'pivot',
        etaMonths: signals.careerIntent === 'forced_change' ? 3 : 9,
        prepLeadMonths: 12,
        domains: ['career', 'finance', 'contribution', 'health'],
        why: 'Transitions compress the highest-stakes decisions into the period when judgement is most degraded. Deciding the rules in advance protects you from the pressure.',
        prepare: [
          'Work out your runway in months, precisely',
          'Set your walk-away criteria before you are desperate',
          'Reactivate weak ties now rather than when you need them',
        ],
      }),
    );
  }

  // Nearest first; active windows always ahead of distant ones.
  return out.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.etaMonths - b.etaMonths;
  });
}
