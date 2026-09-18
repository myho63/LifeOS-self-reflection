import type { LifeStage, LifeStageId } from '../types.js';

/**
 * The fourteen life stages Life OS segments into, expressed across the eleven
 * dimensions.
 *
 * Stages are *situational*, not chronological. `typicalAgeRange` exists only to
 * give the segmenter a weak prior and to let the UI say "most people here are
 * 25-35". A 40-year-old returning to study is in `launch`; a 24-year-old with a
 * toddler is in `early_family`. Age is the weakest signal in the model.
 *
 * Each stage rolls up into a broader `season` — the top of the hierarchy, and
 * what the wheel leads with. Seasons repeat: someone can go Build to Reinvent
 * and back to Build, which is why neither stages nor seasons are ordered by age.
 *
 * `baseWeights` is the attention budget: how much of a person's finite time and
 * energy each dimension deserves in this stage. `neglectPriors` is the
 * counterweight: how likely someone here is to under-attend that dimension
 * anyway. Blind spots fall out of the product of the two.
 */
export const LIFE_STAGES: readonly LifeStage[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    seasonId: 'explore',
    selfDescription: 'Still at school, working out who I am and what comes next.',
    orientationThesis:
      'Widen the option set and build self-knowledge before any door closes. Nothing here should be irreversible.',
    primaryQuestion: 'Who am I, and what kind of life do I want?',
    typicalAgeRange: [13, 17],
    planningHorizonYears: 4,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.7, personal_growth: 0.95, career: 0.5, finance: 0.35, relationships: 0.55,
      family: 0.6, fun: 0.55, contribution: 0.35, environment: 0.1, social: 0.7,
      spirituality: 0.4,
    },
    neglectPriors: { finance: 0.8, health: 0.5, career: 0.45, spirituality: 0.5, contribution: 0.5 },
    milestones: [
      { id: 'know-your-strengths', title: 'Map your strengths and interests', domain: 'personal_growth', rationale: 'Subject choices start narrowing options at 15-16; self-knowledge should precede them.' },
      { id: 'subject-choice', title: 'Understand what your subject choices open and close', domain: 'personal_growth', rationale: 'Most teenagers discover the consequences of subject choice a year after making it.' },
      { id: 'first-money', title: 'Run your own money for the first time', domain: 'finance', rationale: 'Habits formed on small amounts are the ones that scale.' },
      { id: 'work-exposure', title: 'Get real exposure to two careers you are curious about', domain: 'career', rationale: 'A day of observation kills or confirms an ambition faster than a year of speculation.' },
    ],
  },
  {
    id: 'launch',
    label: 'Launch',
    seasonId: 'explore',
    selfDescription: 'Leaving school or home, choosing a path and standing up my own life.',
    orientationThesis:
      'Convert direction into a first foothold — training, income, and the admin of being an adult — without over-committing to a single track.',
    primaryQuestion: 'What do I want to try first, and what does it cost me to try it?',
    typicalAgeRange: [17, 24],
    planningHorizonYears: 5,
    reviewCadenceDays: 60,
    baseWeights: {
      health: 0.55, personal_growth: 0.85, career: 0.9, finance: 0.7, relationships: 0.5,
      family: 0.35, fun: 0.45, contribution: 0.35, environment: 0.6, social: 0.6,
      spirituality: 0.35,
    },
    neglectPriors: { finance: 0.75, health: 0.6, social: 0.5, spirituality: 0.55, contribution: 0.55 },
    milestones: [
      { id: 'path-decision', title: 'Choose your route: study, training, or work', domain: 'personal_growth', rationale: 'The cost of this decision is dominated by what it forecloses, not what it costs.' },
      { id: 'first-income', title: 'Earn and manage your first regular income', domain: 'finance', rationale: 'The first year of earning sets the savings rate most people keep for a decade.' },
      { id: 'adult-admin', title: 'Set up the adult paperwork: ID, tax, bank, insurance', domain: 'finance', rationale: 'Invisible until it blocks something urgent.' },
      { id: 'leave-home', title: 'Plan the move out of the family home', domain: 'environment', rationale: 'Housing cost is the single biggest determinant of early-career freedom.' },
    ],
  },
  {
    id: 'establish',
    label: 'Establish',
    seasonId: 'build',
    selfDescription: 'Independent, working, no dependants — building momentum.',
    orientationThesis:
      'Compound early: earning power, savings rate and health habits set here decide the size of every later choice.',
    primaryQuestion: 'What foundation am I going to build my life on?',
    typicalAgeRange: [22, 32],
    planningHorizonYears: 7,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.6, personal_growth: 0.6, career: 0.95, finance: 0.85, relationships: 0.65,
      family: 0.3, fun: 0.5, contribution: 0.35, environment: 0.6, social: 0.55,
      spirituality: 0.3,
    },
    neglectPriors: { contribution: 0.7, social: 0.65, spirituality: 0.65, health: 0.65, fun: 0.6 },
    milestones: [
      { id: 'earning-trajectory', title: 'Establish a rising earning trajectory', domain: 'career', rationale: 'Compensation growth in the first decade compounds through every later year.' },
      { id: 'emergency-fund', title: 'Build a genuine emergency buffer', domain: 'finance', rationale: 'It converts a crisis into an inconvenience, and makes career risk affordable.' },
      { id: 'health-baseline', title: 'Set a health baseline you can defend under pressure', domain: 'health', rationale: 'The habits that survive a busy decade are the ones installed before it.' },
      { id: 'chosen-people', title: 'Invest deliberately in chosen relationships', domain: 'relationships', rationale: 'Friendship networks thin out sharply after full-time work begins unless maintained on purpose.' },
    ],
  },
  {
    id: 'partnering',
    label: 'Partnering',
    seasonId: 'build',
    selfDescription: 'Building a life with someone — merging plans, money and place.',
    orientationThesis:
      'Make the joint architecture explicit — money, home, expectations — while the stakes are still low enough to renegotiate.',
    primaryQuestion: 'What are we building together, and have we actually agreed on it?',
    typicalAgeRange: [23, 40],
    planningHorizonYears: 7,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.55, personal_growth: 0.45, career: 0.7, finance: 0.8, relationships: 0.9,
      family: 0.5, fun: 0.5, contribution: 0.35, environment: 0.75, social: 0.45,
      spirituality: 0.35,
    },
    neglectPriors: { contribution: 0.7, spirituality: 0.6, social: 0.6, personal_growth: 0.55, fun: 0.5 },
    milestones: [
      { id: 'money-conversation', title: 'Have the full money conversation', domain: 'finance', rationale: 'Undiscussed financial assumptions are the most common source of long-run conflict.' },
      { id: 'housing-decision', title: 'Decide how you want to live, and where', domain: 'environment', rationale: 'Housing commitments quietly fix your career geography for years.' },
      { id: 'expectations', title: 'Surface expectations about work, children and care', domain: 'relationships', rationale: 'Cheap to discover now, extremely expensive to discover later.' },
      { id: 'joint-admin', title: 'Sort the legal and insurance basics of a shared life', domain: 'finance', rationale: 'Cohabiting couples often assume protections they do not actually have.' },
    ],
  },
  {
    id: 'expecting',
    label: 'Expecting',
    seasonId: 'grow',
    selfDescription: 'A first child is on the way, or has just arrived.',
    orientationThesis:
      'Front-load everything that will be impossible to arrange once the child is here: money, leave, health, admin and support.',
    primaryQuestion: 'What has to be in place before this changes everything?',
    typicalAgeRange: [22, 42],
    planningHorizonYears: 3,
    reviewCadenceDays: 30,
    baseWeights: {
      health: 0.85, personal_growth: 0.4, career: 0.6, finance: 0.85, relationships: 0.9,
      family: 0.8, fun: 0.3, contribution: 0.3, environment: 0.7, social: 0.4,
      spirituality: 0.4,
    },
    neglectPriors: { fun: 0.8, social: 0.6, personal_growth: 0.6, contribution: 0.6, spirituality: 0.55 },
    milestones: [
      { id: 'leave-and-income', title: 'Model the income change through leave and after', domain: 'finance', rationale: 'The cashflow dip is predictable and almost always underestimated.' },
      { id: 'protection', title: 'Put protection and paperwork in place', domain: 'finance', rationale: 'Life cover, guardianship and wills are cheapest to arrange before the arrival.' },
      { id: 'support-network', title: 'Line up practical support before you need it', domain: 'relationships', rationale: 'Support asked for in advance arrives; support asked for in crisis often does not.' },
      { id: 'couple-baseline', title: 'Agree how you will divide load and protect the partnership', domain: 'relationships', rationale: 'Relationship satisfaction dips sharply post-birth without an explicit division of labour.' },
    ],
  },
  {
    id: 'early_family',
    label: 'Early Family',
    seasonId: 'grow',
    selfDescription: 'Young children at home — time-poor and stretched.',
    orientationThesis:
      'Protect the scarce resources — time, sleep, money and the partnership — and defer anything that can wait five years.',
    primaryQuestion: 'How do I keep everything standing while there is nothing left over?',
    typicalAgeRange: [25, 45],
    planningHorizonYears: 5,
    reviewCadenceDays: 45,
    baseWeights: {
      health: 0.75, personal_growth: 0.35, career: 0.7, finance: 0.85, relationships: 0.85,
      family: 0.9, fun: 0.35, contribution: 0.3, environment: 0.65, social: 0.35,
      spirituality: 0.35,
    },
    neglectPriors: { fun: 0.85, social: 0.75, health: 0.7, personal_growth: 0.7, spirituality: 0.6 },
    milestones: [
      { id: 'childcare-economics', title: 'Work out whether the childcare maths actually works', domain: 'finance', rationale: 'Second-earner decisions made on gross pay alone are usually wrong.' },
      { id: 'career-continuity', title: 'Keep a career thread alive through the intense years', domain: 'career', rationale: 'A deliberate holding pattern is recoverable; an unplanned exit often is not.' },
      { id: 'load-sharing', title: 'Rebalance the domestic and mental load', domain: 'relationships', rationale: 'Invisible load is the most common unspoken grievance in this stage.' },
      { id: 'parent-health', title: 'Defend your own sleep and health floor', domain: 'health', rationale: 'Parental health is the dependency everything else in the household runs on.' },
    ],
  },
  {
    id: 'school_family',
    label: 'School-Age Family',
    seasonId: 'grow',
    selfDescription: 'Children at school — logistics-heavy but more predictable.',
    orientationThesis:
      'Use the returning bandwidth deliberately: rebuild career and financial trajectory before the teenage years absorb it again.',
    primaryQuestion: 'I have some capacity back — where should it actually go?',
    typicalAgeRange: [30, 50],
    planningHorizonYears: 8,
    reviewCadenceDays: 60,
    baseWeights: {
      health: 0.65, personal_growth: 0.5, career: 0.75, finance: 0.8, relationships: 0.75,
      family: 0.9, fun: 0.4, contribution: 0.4, environment: 0.55, social: 0.45,
      spirituality: 0.4,
    },
    neglectPriors: { fun: 0.75, social: 0.65, health: 0.6, personal_growth: 0.6, spirituality: 0.55 },
    milestones: [
      { id: 'career-rebuild', title: 'Reset your career trajectory with the bandwidth you have back', domain: 'career', rationale: 'This window closes again when children reach secondary school.' },
      { id: 'education-costs', title: 'Get ahead of education and activity costs', domain: 'finance', rationale: 'Costs rise steeply and predictably from here; they can be smoothed if seen early.' },
      { id: 'family-rhythm', title: 'Build a family rhythm that survives the school calendar', domain: 'relationships', rationale: 'Logistics crowd out connection unless connection is scheduled.' },
      { id: 'retirement-check', title: 'Run a first honest retirement adequacy check', domain: 'finance', rationale: 'Still early enough that small changes compound; late enough that the numbers are real.' },
    ],
  },
  {
    id: 'teen_family',
    label: 'Family with Teenagers',
    seasonId: 'stabilize',
    selfDescription: 'Teenagers at home — launching them while my own choices are still open.',
    orientationThesis:
      'Run two orientations at once: theirs toward independence, yours toward the second half of your working life.',
    primaryQuestion: 'How do I launch them well without losing my own thread?',
    typicalAgeRange: [38, 58],
    planningHorizonYears: 8,
    reviewCadenceDays: 60,
    baseWeights: {
      health: 0.6, personal_growth: 0.5, career: 0.7, finance: 0.8, relationships: 0.7,
      family: 0.9, fun: 0.4, contribution: 0.45, environment: 0.5, social: 0.45,
      spirituality: 0.45,
    },
    neglectPriors: { fun: 0.7, personal_growth: 0.65, social: 0.6, health: 0.55, spirituality: 0.5 },
    milestones: [
      { id: 'launch-support', title: 'Support their path decision without making it for them', domain: 'relationships', rationale: 'This is the highest-leverage parenting window and the easiest one to over-steer.' },
      { id: 'cost-of-launch', title: 'Cost the launch: study, training, and the first years out', domain: 'finance', rationale: 'Family support decisions made ad hoc tend to compromise retirement quietly.' },
      { id: 'own-second-act', title: 'Start sketching your own second act', domain: 'personal_growth', rationale: 'The empty nest arrives faster than the plan for it does.' },
      { id: 'health-midlife', title: 'Take the midlife health checks seriously', domain: 'health', rationale: 'Most conditions that shape later life are detectable and modifiable now.' },
    ],
  },
  {
    id: 'consolidating',
    label: 'Consolidating',
    seasonId: 'stabilize',
    selfDescription: 'Mid-career, established, weighing whether this is the life I meant to build.',
    orientationThesis:
      'Audit the trajectory honestly while you still have the runway to change it — and convert peak earning into durable security.',
    primaryQuestion: 'Is this actually the life I meant to build?',
    typicalAgeRange: [33, 52],
    planningHorizonYears: 12,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.7, personal_growth: 0.65, career: 0.85, finance: 0.85, relationships: 0.65,
      family: 0.55, fun: 0.5, contribution: 0.45, environment: 0.5, social: 0.5,
      spirituality: 0.45,
    },
    neglectPriors: { fun: 0.65, social: 0.6, health: 0.6, spirituality: 0.55, contribution: 0.55 },
    milestones: [
      { id: 'trajectory-audit', title: 'Audit whether your trajectory still matches your direction', domain: 'personal_growth', rationale: 'Drift is invisible year to year and obvious over a decade.' },
      { id: 'peak-earning', title: 'Make peak earning years count', domain: 'finance', rationale: 'The savings gap that opens here is rarely closable later.' },
      { id: 'career-ceiling', title: 'Test your ceiling deliberately rather than assuming it', domain: 'career', rationale: 'Most plateaus are unexamined rather than genuine.' },
      { id: 'preventive-health', title: 'Move health from reactive to preventive', domain: 'health', rationale: 'Risk curves steepen from the forties onward.' },
    ],
  },
  {
    id: 'pivot',
    label: 'Pivot',
    seasonId: 'reinvent',
    selfDescription: 'In the middle of a major change — by choice or not.',
    orientationThesis:
      'Stabilise the floor first, then rebuild direction. Transitions are where the most consequential decisions get made worst.',
    primaryQuestion: 'What do I rebuild on, and how long do I have?',
    typicalAgeRange: [18, 65],
    planningHorizonYears: 3,
    reviewCadenceDays: 21,
    baseWeights: {
      health: 0.55, personal_growth: 0.8, career: 0.95, finance: 0.85, relationships: 0.55,
      family: 0.4, fun: 0.35, contribution: 0.4, environment: 0.4, social: 0.7,
      spirituality: 0.5,
    },
    neglectPriors: { health: 0.6, fun: 0.6, spirituality: 0.5, family: 0.45, social: 0.4 },
    milestones: [
      { id: 'runway', title: 'Establish how long your runway actually is', domain: 'finance', rationale: 'Every other decision in a transition is downstream of the deadline.' },
      { id: 'transferable', title: 'Inventory what actually transfers', domain: 'career', rationale: 'People systematically undervalue their own transferable capability mid-transition.' },
      { id: 'network-activation', title: 'Reactivate the network before you need it', domain: 'contribution', rationale: 'Most transitions resolve through weak ties, not applications.' },
      { id: 'stabilise-mind', title: 'Protect mental health through the unstable months', domain: 'health', rationale: 'Transition stress degrades exactly the judgement the transition requires.' },
    ],
  },
  {
    id: 'sandwich',
    label: 'Sandwich',
    seasonId: 'stabilize',
    selfDescription: 'Caring for children and for ageing parents at the same time.',
    orientationThesis:
      'Triage without self-erasure: get the care system legible and shared, and defend a floor of your own health and finances.',
    primaryQuestion: 'How do I carry this without disappearing inside it?',
    typicalAgeRange: [38, 62],
    planningHorizonYears: 5,
    reviewCadenceDays: 30,
    baseWeights: {
      health: 0.75, personal_growth: 0.35, career: 0.65, finance: 0.8, relationships: 0.7,
      family: 0.95, fun: 0.3, contribution: 0.4, environment: 0.5, social: 0.35,
      spirituality: 0.45,
    },
    neglectPriors: { fun: 0.9, health: 0.8, social: 0.8, personal_growth: 0.75, spirituality: 0.55 },
    milestones: [
      { id: 'care-map', title: 'Map the full care load and who else can carry part of it', domain: 'relationships', rationale: 'Care work concentrates on one person by default unless it is made explicit.' },
      { id: 'parents-admin', title: 'Get your parents’ legal and financial affairs legible', domain: 'finance', rationale: 'Powers of attorney and access must exist before capacity becomes a question.' },
      { id: 'own-floor', title: 'Set a non-negotiable floor for your own health and income', domain: 'health', rationale: 'Carer collapse is the failure mode that takes the whole system down.' },
      { id: 'career-protection', title: 'Protect long-run earning and pension through the caring years', domain: 'finance', rationale: 'Reduced hours during caring produce a pension gap that persists for life.' },
    ],
  },
  {
    id: 'empty_nest',
    label: 'Empty Nest',
    seasonId: 'reinvent',
    selfDescription: 'The children have gone — more room than I have had in twenty years.',
    orientationThesis:
      'Rebuild identity and relationship on purpose, and convert the freed capacity into security and meaning rather than drift.',
    primaryQuestion: 'What is this decade actually for?',
    typicalAgeRange: [48, 66],
    planningHorizonYears: 15,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.8, personal_growth: 0.8, career: 0.65, finance: 0.85, relationships: 0.8,
      family: 0.55, fun: 0.6, contribution: 0.55, environment: 0.6, social: 0.6,
      spirituality: 0.55,
    },
    neglectPriors: { personal_growth: 0.6, social: 0.5, fun: 0.5, spirituality: 0.5, contribution: 0.5 },
    milestones: [
      { id: 'second-act', title: 'Define what this decade is for', domain: 'personal_growth', rationale: 'The stage arrives with capacity and no default script.' },
      { id: 'relationship-reset', title: 'Rediscover the relationship without the children in the middle', domain: 'relationships', rationale: 'Partnerships organised entirely around parenting have to be renegotiated when it ends.' },
      { id: 'retirement-runway', title: 'Close the retirement gap while you still can', domain: 'finance', rationale: 'The last decade of earning does the heaviest lifting in retirement adequacy.' },
      { id: 'right-sizing', title: 'Ask whether the house still fits the life', domain: 'environment', rationale: 'Housing is usually the largest under-examined asset at this point.' },
    ],
  },
  {
    id: 'pre_retirement',
    label: 'Pre-Retirement',
    seasonId: 'transition',
    selfDescription: 'Work is winding down — deciding what the next phase looks like.',
    orientationThesis:
      'Turn accumulated resources into a durable plan for income, health, purpose and place — before the last payslip, not after.',
    primaryQuestion: 'What do I want the next chapter to look like, and can I afford it?',
    typicalAgeRange: [55, 70],
    planningHorizonYears: 20,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.85, personal_growth: 0.7, career: 0.6, finance: 0.95, relationships: 0.7,
      family: 0.55, fun: 0.6, contribution: 0.65, environment: 0.6, social: 0.6,
      spirituality: 0.6,
    },
    neglectPriors: { personal_growth: 0.7, social: 0.6, contribution: 0.6, spirituality: 0.55, fun: 0.5 },
    milestones: [
      { id: 'income-plan', title: 'Build a retirement income plan you can actually live on', domain: 'finance', rationale: 'Decumulation is a harder problem than accumulation and gets far less attention.' },
      { id: 'purpose-plan', title: 'Plan the structure and purpose, not just the money', domain: 'personal_growth', rationale: 'Loss of role and rhythm is the most reported difficulty of early retirement.' },
      { id: 'health-span', title: 'Invest in health span while it is still modifiable', domain: 'health', rationale: 'Healthy years, not total years, determine what retirement is like.' },
      { id: 'affairs-in-order', title: 'Put wills, wishes and powers of attorney in order', domain: 'contribution', rationale: 'Cheap and straightforward now; costly and contested if deferred.' },
    ],
  },
  {
    id: 'later_life',
    label: 'Later Life',
    seasonId: 'enjoy',
    selfDescription: 'Retired — focused on health, people and what I leave behind.',
    orientationThesis:
      'Protect independence and connection, and make your wishes known while you are the one making them.',
    primaryQuestion: 'How do I make the most of the life I have built?',
    typicalAgeRange: [65, 100],
    planningHorizonYears: 15,
    reviewCadenceDays: 90,
    baseWeights: {
      health: 0.9, personal_growth: 0.5, career: 0.2, finance: 0.75, relationships: 0.8,
      family: 0.7, fun: 0.65, contribution: 0.7, environment: 0.65, social: 0.75,
      spirituality: 0.7,
    },
    neglectPriors: { social: 0.5, personal_growth: 0.5, fun: 0.45, contribution: 0.45, spirituality: 0.4 },
    milestones: [
      { id: 'independence', title: 'Protect independence: home, mobility, and driving', domain: 'environment', rationale: 'Small adaptations made early prevent forced moves later.' },
      { id: 'connection', title: 'Build connection deliberately against shrinking networks', domain: 'contribution', rationale: 'Isolation is the strongest modifiable risk factor in later life.' },
      { id: 'care-wishes', title: 'Record care and treatment wishes clearly', domain: 'contribution', rationale: 'Families make better decisions when the wishes are unambiguous and written.' },
      { id: 'sustainable-income', title: 'Check income sustainability against a longer life than you expect', domain: 'finance', rationale: 'Longevity risk is systematically underestimated.' },
    ],
  },
] as const;

const STAGE_INDEX = new Map<LifeStageId, LifeStage>(LIFE_STAGES.map((s) => [s.id, s]));

export function getStage(id: LifeStageId): LifeStage {
  const stage = STAGE_INDEX.get(id);
  if (!stage) throw new Error(`Unknown life stage: ${id}`);
  return stage;
}

export const ALL_STAGE_IDS: readonly LifeStageId[] = LIFE_STAGES.map((s) => s.id);
