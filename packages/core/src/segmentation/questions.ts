import type { AnswerOption, AskableSignalKey, ProfileSignals } from '../types.js';

/**
 * The onboarding question catalogue.
 *
 * Life OS does not ask a fixed twenty-question form. It asks the single
 * question currently expected to sharpen the segmentation most, then re-plans.
 *
 * The answer options serve two purposes at once: they are what the client
 * renders, and they are the representative values the planner replays through
 * the scoring model to estimate information gain. Keeping them as one list
 * means the engine can never be reasoning about a set of answers the user was
 * never offered.
 */
export interface OnboardingQuestion {
  key: AskableSignalKey;
  question: string;
  /** Shown under the question to explain why the app is asking. */
  why: string;
  /** Below this age the question is never asked. */
  minAge: number;
  answers: AnswerOption[];
}

export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  {
    key: 'children',
    question: 'Do you have children?',
    why: 'The age of your youngest dependent child changes what matters more than almost anything else.',
    minAge: 16,
    answers: [
      { label: 'No children', patch: { children: [] } },
      // Coarse buckets keep onboarding to one tap. Exact ages are refined later
      // in profile settings, where the extra precision is actually worth asking for.
      { label: 'Yes — youngest is under 5', patch: { children: [{ ageYears: 3, dependent: true }] } },
      { label: 'Yes — youngest is 5 to 11', patch: { children: [{ ageYears: 8, dependent: true }] } },
      { label: 'Yes — youngest is 12 to 18', patch: { children: [{ ageYears: 15, dependent: true }] } },
      { label: 'Yes — they are grown up', patch: { children: [{ ageYears: 28, dependent: false }] } },
    ],
  },
  {
    key: 'employmentStatus',
    question: 'What best describes your work situation?',
    why: 'Whether you are studying, working, searching or retired sets the shape of everything else.',
    minAge: 14,
    answers: [
      { label: 'Studying full time', patch: { employmentStatus: 'not_working_student' } },
      { label: 'Employed', patch: { employmentStatus: 'employed' } },
      { label: 'Looking for work', patch: { employmentStatus: 'seeking_work' } },
      { label: 'Self-employed', patch: { employmentStatus: 'self_employed' } },
      { label: 'Running a business', patch: { employmentStatus: 'business_owner' } },
      { label: 'Caring full time', patch: { employmentStatus: 'full_time_caregiver' } },
      { label: 'Retired', patch: { employmentStatus: 'retired' } },
      { label: 'Unable to work right now', patch: { employmentStatus: 'unable_to_work' } },
    ],
  },
  {
    key: 'relationshipStatus',
    question: 'How would you describe your relationship situation?',
    why: 'Plans made alone and plans made jointly are different plans.',
    minAge: 16,
    answers: [
      { label: 'Single', patch: { relationshipStatus: 'single' } },
      { label: 'Dating', patch: { relationshipStatus: 'dating' } },
      { label: 'Living with a partner', patch: { relationshipStatus: 'cohabiting' } },
      { label: 'Married', patch: { relationshipStatus: 'married' } },
      { label: 'Separated', patch: { relationshipStatus: 'separated' } },
      { label: 'Divorced', patch: { relationshipStatus: 'divorced' } },
      { label: 'Widowed', patch: { relationshipStatus: 'widowed' } },
    ],
  },
  {
    key: 'educationStatus',
    question: 'Are you studying at the moment?',
    why: 'Study status tells us whether you are in a building phase or an applying phase.',
    minAge: 13,
    answers: [
      { label: 'At school', patch: { educationStatus: 'secondary_school' } },
      { label: 'At university or college', patch: { educationStatus: 'higher_education' } },
      { label: 'In training or an apprenticeship', patch: { educationStatus: 'vocational_training' } },
      { label: 'Not studying', patch: { educationStatus: 'not_studying' } },
    ],
  },
  {
    key: 'careerIntent',
    question: 'How settled do you feel in your current path?',
    why: 'People in the middle of a change need a completely different kind of help.',
    minAge: 16,
    answers: [
      { label: 'Settled — this is working', patch: { careerIntent: 'settled' } },
      { label: 'Restless, but not moving yet', patch: { careerIntent: 'restless' } },
      { label: 'Actively changing direction', patch: { careerIntent: 'actively_changing' } },
      { label: 'Being forced to change', patch: { careerIntent: 'forced_change' } },
    ],
  },
  {
    key: 'caringForDependentAdult',
    question: 'Are you helping to care for an adult — a parent, partner or relative?',
    why: 'Caring responsibilities reshape time, money and health in ways nothing else does.',
    minAge: 18,
    answers: [
      { label: 'Yes', patch: { caringForDependentAdult: true } },
      { label: 'No', patch: { caringForDependentAdult: false } },
    ],
  },
  {
    key: 'livingArrangement',
    question: 'Who do you live with?',
    why: 'Where and with whom you live is the clearest signal of how independent your life currently is.',
    minAge: 14,
    answers: [
      { label: 'With my parents', patch: { livingArrangement: 'with_parents' } },
      { label: 'On my own', patch: { livingArrangement: 'alone' } },
      { label: 'Sharing with others', patch: { livingArrangement: 'shared_housing' } },
      { label: 'With my partner', patch: { livingArrangement: 'with_partner' } },
      { label: 'With my own family', patch: { livingArrangement: 'with_own_family' } },
    ],
  },
  {
    key: 'expectingChild',
    question: 'Are you expecting a child?',
    why: 'The months before a first child are the highest-leverage preparation window there is.',
    minAge: 18,
    answers: [
      { label: 'Yes', patch: { expectingChild: true } },
      { label: 'No', patch: { expectingChild: false } },
    ],
  },
  {
    key: 'housingTenure',
    question: 'What is your housing situation?',
    why: 'Housing is usually the largest single line in a life plan.',
    minAge: 18,
    answers: [
      { label: 'Someone else covers it', patch: { housingTenure: 'dependent' } },
      { label: 'Renting', patch: { housingTenure: 'renting' } },
      { label: 'Paying a mortgage', patch: { housingTenure: 'mortgaged' } },
      { label: 'Owned outright', patch: { housingTenure: 'owned_outright' } },
    ],
  },
  {
    key: 'debtPressure',
    question: 'How much pressure are your financial commitments putting on you?',
    why: 'When money is tight, everything else has to be planned around it.',
    minAge: 18,
    answers: [
      { label: 'None', patch: { debtPressure: 'none' } },
      { label: 'Manageable', patch: { debtPressure: 'manageable' } },
      { label: 'Heavy', patch: { debtPressure: 'high' } },
      { label: 'I am struggling', patch: { debtPressure: 'severe' } },
    ],
  },
  {
    key: 'healthStatus',
    question: 'How is your health at the moment?',
    why: 'Health sets the capacity that every other plan has to fit inside.',
    minAge: 13,
    answers: [
      { label: 'Thriving', patch: { healthStatus: 'thriving' } },
      { label: 'Steady', patch: { healthStatus: 'steady' } },
      { label: 'Managing a condition', patch: { healthStatus: 'managing_condition' } },
      { label: 'Struggling', patch: { healthStatus: 'struggling' } },
    ],
  },
] as const;

const QUESTION_INDEX = new Map<AskableSignalKey, OnboardingQuestion>(
  ONBOARDING_QUESTIONS.map((q) => [q.key, q]),
);

export function getQuestion(key: AskableSignalKey): OnboardingQuestion | undefined {
  return QUESTION_INDEX.get(key);
}

/** The candidate values the information-gain planner replays. */
export function probesFor(question: OnboardingQuestion): Partial<ProfileSignals>[] {
  return question.answers.map((answer) => answer.patch);
}
