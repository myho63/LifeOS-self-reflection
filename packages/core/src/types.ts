/**
 * Core domain vocabulary for Life OS.
 *
 * Everything downstream — segmentation, orientation, transition forecasting and
 * decision simulation — is expressed in terms of the types declared here, so
 * that the same model can run on the server, in the mobile client, or in an
 * offline batch job without divergence.
 */

/** ISO-8601 calendar date, e.g. `2007-03-14`. */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Life domains — the surface area a "life OS" is responsible for
// ---------------------------------------------------------------------------

/**
 * The eleven dimensions of a life. Ten universal dimensions plus Admin &
 * Protection; legacy lives inside `community` rather than standing alone.
 */
export type LifeDomainId =
  | 'health'
  | 'personal_growth'
  | 'career'
  | 'finance'
  | 'relationships'
  | 'family'
  | 'fun'
  | 'contribution'
  | 'environment'
  | 'social'
  | 'spirituality';

export interface LifeDomain {
  id: LifeDomainId;
  label: string;
  /** Compact label for the wheel, where the full one will not fit. */
  short: string;
  /** One-line statement of what this domain is responsible for. */
  purpose: string;
  /** Concrete things the app can help with inside this domain. */
  examples: string[];
  /**
   * Dimensions that feed this one. Life dimensions are not independent buckets:
   * career feeds money feeds environment feeds mind. Recording the strongest
   * couplings lets the balance engine explain a deficit by its upstream cause
   * instead of only naming the symptom.
   */
  dependsOn: LifeDomainId[];
  /**
   * Minimum age at which this domain is surfaced at all. Some domains (estate
   * planning, credit) are not merely low-priority for a 14-year-old, they are
   * inappropriate, and are hidden rather than down-weighted.
   */
  minAge: number;
  /** Regulated territory where the app must orient, never advise. */
  regulated: boolean;
}

// ---------------------------------------------------------------------------
// Life stages — the segmentation output
// ---------------------------------------------------------------------------

export type LifeStageId =
  | 'foundation'
  | 'launch'
  | 'establish'
  | 'partnering'
  | 'expecting'
  | 'early_family'
  | 'school_family'
  | 'teen_family'
  | 'consolidating'
  | 'pivot'
  | 'sandwich'
  | 'empty_nest'
  | 'pre_retirement'
  | 'later_life';

/**
 * The eight seasons of a life. Seasons sit above stages and are what the wheel
 * leads with. They are explicitly *not* chronological: someone can go Build to
 * Reinvent and back to Build, and a 52-year-old can be in Explore while a
 * 27-year-old is in Stabilize.
 */
export type SeasonId =
  | 'explore'
  | 'build'
  | 'grow'
  | 'stabilize'
  | 'reinvent'
  | 'transition'
  | 'enjoy'
  | 'preserve';

export interface Season {
  id: SeasonId;
  label: string;
  /** The question this season of life is really asking. */
  primaryQuestion: string;
  /** What the season is for, in one sentence. */
  thesis: string;
  /** What the app optimises for while someone is here. */
  optimisingFor: string;
}

export interface LifeStage {
  id: LifeStageId;
  label: string;
  /** The season this stage rolls up into. */
  seasonId: SeasonId;
  /** The question a person in this stage is really asking. */
  primaryQuestion: string;
  /** How a person in this stage would describe their own situation. */
  selfDescription: string;
  /** What orientation means for this stage, in one sentence. */
  orientationThesis: string;
  /** Indicative, non-binding age range. Stages are situational, not ages. */
  typicalAgeRange: [number, number];
  /** Baseline attention each life domain deserves in this stage, 0..1. */
  baseWeights: Partial<Record<LifeDomainId, number>>;
  /**
   * Probability, 0..1, that a person in this stage systematically under-attends
   * a domain. Combined with importance this yields blind spots — the domains
   * the app should raise unprompted because the user will not ask.
   */
  neglectPriors: Partial<Record<LifeDomainId, number>>;
  /** How far ahead planning is useful before it becomes fantasy. */
  planningHorizonYears: number;
  /** How often the orientation is worth revisiting. */
  reviewCadenceDays: number;
  /** Stage-appropriate checkpoints, surfaced as a progress spine. */
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  title: string;
  domain: LifeDomainId;
  /** Why this matters now rather than later. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Modifier tags — cross-cutting circumstances that are not stages
// ---------------------------------------------------------------------------

export type ModifierTagId =
  | 'minor'
  | 'student'
  | 'single_parent'
  | 'adult_caregiver'
  | 'financially_stressed'
  | 'health_managing'
  | 'health_struggling'
  | 'job_seeking'
  | 'self_employed'
  | 'recently_bereaved'
  | 'recently_separated'
  | 'relocating'
  | 'sole_earner';

export interface ModifierTag {
  id: ModifierTagId;
  label: string;
  /** What the app does differently when this tag is present. */
  effect: string;
  /** Domain weight adjustments applied on top of the stage baseline. */
  weightDeltas: Partial<Record<LifeDomainId, number>>;
}

// ---------------------------------------------------------------------------
// Profile signals — the raw inputs
// ---------------------------------------------------------------------------

export type EducationStatus =
  | 'secondary_school'
  | 'higher_education'
  | 'vocational_training'
  | 'not_studying';

export type EmploymentStatus =
  | 'not_working_student'
  | 'seeking_work'
  | 'employed'
  | 'self_employed'
  | 'business_owner'
  | 'full_time_caregiver'
  | 'retired'
  | 'unable_to_work';

export type RelationshipStatus =
  | 'single'
  | 'dating'
  | 'cohabiting'
  | 'married'
  | 'separated'
  | 'divorced'
  | 'widowed';

export type LivingArrangement =
  | 'with_parents'
  | 'alone'
  | 'with_partner'
  | 'shared_housing'
  | 'with_own_family'
  | 'supported_accommodation';

export type HousingTenure = 'dependent' | 'renting' | 'mortgaged' | 'owned_outright';

export type DebtPressure = 'none' | 'manageable' | 'high' | 'severe';

export type HealthStatus = 'thriving' | 'steady' | 'managing_condition' | 'struggling';

export type CareerIntent = 'settled' | 'restless' | 'actively_changing' | 'forced_change';

export type LifeEventId =
  | 'started_first_job'
  | 'job_loss'
  | 'promotion'
  | 'moved_home'
  | 'moved_country'
  | 'relationship_started'
  | 'relationship_ended'
  | 'bereavement'
  | 'new_child'
  | 'child_left_home'
  | 'health_diagnosis'
  | 'became_caregiver'
  | 'retired';

export interface ChildSignal {
  ageYears: number;
  /** Financially or practically dependent on the user. */
  dependent: boolean;
}

export interface RecentLifeEvent {
  id: LifeEventId;
  /** How long ago, in months. Recency decays a signal's influence. */
  monthsAgo: number;
}

/**
 * Everything the app may know about a person. Every field except age is
 * optional by design: segmentation must degrade gracefully, and onboarding
 * asks for fields in information-gain order rather than all at once.
 */
export interface ProfileSignals {
  birthDate?: IsoDate;
  ageYears?: number;

  educationStatus?: EducationStatus;
  employmentStatus?: EmploymentStatus;
  yearsOfWorkExperience?: number;
  careerIntent?: CareerIntent;

  relationshipStatus?: RelationshipStatus;
  livingArrangement?: LivingArrangement;
  children?: ChildSignal[];
  expectingChild?: boolean;
  caringForDependentAdult?: boolean;

  housingTenure?: HousingTenure;
  debtPressure?: DebtPressure;
  hasEmergencyFund?: boolean;
  financialDependents?: number;
  soleIncomeEarner?: boolean;

  healthStatus?: HealthStatus;
  recentLifeEvents?: RecentLifeEvent[];

  /** ISO-3166-1 alpha-2. Drives jurisdiction-specific ages and terminology. */
  countryCode?: string;
}

/** Signal keys the onboarding planner is allowed to ask about. */
export type AskableSignalKey =
  | 'educationStatus'
  | 'employmentStatus'
  | 'careerIntent'
  | 'relationshipStatus'
  | 'livingArrangement'
  | 'children'
  | 'expectingChild'
  | 'caringForDependentAdult'
  | 'housingTenure'
  | 'debtPressure'
  | 'healthStatus';

// ---------------------------------------------------------------------------
// Segmentation output
// ---------------------------------------------------------------------------

export interface AgeBand {
  id: string;
  label: string;
  min: number;
  max: number;
}

export interface StageScore {
  stageId: LifeStageId;
  /** Softmax probability across all stages, 0..1. */
  probability: number;
  /** Raw weighted evidence sum, before normalisation. */
  rawScore: number;
}

export interface RationaleEntry {
  /** Human-readable statement of the evidence, e.g. "Youngest child is 3". */
  signal: string;
  /** Which stage this evidence pushed toward or away from. */
  stageId: LifeStageId;
  /** Signed contribution to that stage's raw score. */
  contribution: number;
}

/**
 * One selectable answer. `patch` is the exact signal fragment to merge when it
 * is chosen, which makes an answer directly submittable and means the engine
 * and the UI can never drift apart about what an option means.
 */
export interface AnswerOption {
  label: string;
  patch: Partial<ProfileSignals>;
}

export interface MissingSignal {
  key: AskableSignalKey;
  question: string;
  /** Shown under the question, so the user knows why it is being asked. */
  why: string;
  answers: AnswerOption[];
  /**
   * Expected information gain in bits — how much answering this is predicted to
   * sharpen the segmentation. Drives onboarding question order.
   */
  expectedGainBits: number;
}

export interface Guardrails {
  /** The user is below the age of majority in their jurisdiction. */
  isMinor: boolean;
  /** Domains hidden entirely for this user. */
  hiddenDomains: LifeDomainId[];
  /** Extra care required when generating content, keyed for the content layer. */
  contentFlags: string[];
}

export interface SegmentationResult {
  primary: StageScore;
  /** Present when a second stage is genuinely competitive — people straddle. */
  secondary?: StageScore;
  distribution: StageScore[];
  ageBand?: AgeBand;
  modifiers: ModifierTagId[];
  /**
   * 0..1. Product of the primary stage's probability and signal coverage, so an
   * unanswered profile is never reported as confidently segmented.
   */
  confidence: number;
  /** Fraction of the total rule weight that could actually be evaluated. */
  coverage: number;
  rationale: RationaleEntry[];
  /** Highest-value questions to ask next, best first. */
  missingSignals: MissingSignal[];
  guardrails: Guardrails;
}

// ---------------------------------------------------------------------------
// Orientation output
// ---------------------------------------------------------------------------

export interface DomainPriority {
  domainId: LifeDomainId;
  label: string;
  /**
   * Relative priority in 0..1 after stage baseline and modifiers, normalised so
   * the leading domain scores 1. Reads directly as a bar in the UI.
   */
  weight: number;
  rank: number;
  /** Why this domain sits where it does for this person. */
  why: string;
}

export interface BlindSpot {
  domainId: LifeDomainId;
  label: string;
  /** Importance x neglect probability, 0..1. */
  severity: number;
  prompt: string;
}

export interface OrientationPlan {
  stageId: LifeStageId;
  /** The season this stage rolls up into — the top of the hierarchy. */
  seasonId: SeasonId;
  /** The question this person's chapter is really asking. */
  primaryQuestion: string;
  headline: string;
  thesis: string;
  planningHorizonYears: number;
  reviewCadenceDays: number;
  priorities: DomainPriority[];
  focus: DomainPriority[];
  blindSpots: BlindSpot[];
  milestones: Milestone[];
  guardrails: Guardrails;
  /** Confidence carried through from segmentation, for UI hedging. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Transition forecasting
// ---------------------------------------------------------------------------

export interface TransitionForecast {
  id: string;
  title: string;
  /** Stage the user is expected to move toward, when known. */
  towardStageId?: LifeStageId;
  /** Months until the transition is expected to land. */
  etaMonths: number;
  /** How far ahead preparation should begin, in months. */
  prepLeadMonths: number;
  /** True once `etaMonths <= prepLeadMonths` — the app should raise it now. */
  active: boolean;
  domains: LifeDomainId[];
  why: string;
  prepare: string[];
}

// ---------------------------------------------------------------------------
// Decision exploration
// ---------------------------------------------------------------------------

export type DecisionKind =
  /** Outcomes are largely quantifiable; the model projects them. */
  | 'simulable'
  /** Outcomes turn on personal values; the model structures the user's own reasoning. */
  | 'values_led';

export type InputType = 'number' | 'choice' | 'boolean' | 'text';

export type InputValue = number | string | boolean;

export interface DecisionInputSpec {
  key: string;
  label: string;
  type: InputType;
  help?: string;
  default?: InputValue;
  min?: number;
  max?: number;
  unit?: string;
  choices?: { value: string; label: string }[];
}

export interface Assumption {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Where the default came from, so the user can challenge it. */
  basis: string;
  /** Range explored during sensitivity analysis. */
  range: [number, number];
}

export interface OutcomeSeries {
  /** Outcome axis, e.g. `net_position`, `debt`, `earning_power`. */
  axis: string;
  label: string;
  unit: string;
  /** One value per projected year, index 0 = today. */
  values: number[];
  /** Higher is better for this axis. */
  higherIsBetter: boolean;
}

export interface OptionProjection {
  optionKey: string;
  label: string;
  series: OutcomeSeries[];
  /** How easily this choice can be undone later, 0 (irreversible) .. 1. */
  reversibility: number;
  /** How many meaningful future options remain open, 0..1. */
  optionality: number;
  /** Headline numbers for the summary card. */
  summary: { label: string; value: string }[];
  tradeoffs: string[];
}

export interface SensitivityFinding {
  assumptionKey: string;
  label: string;
  /** Assumption value at which the leading option changes, if one exists. */
  flipsAt?: number;
  /** Plain-language statement of what the assumption controls. */
  note: string;
}

export interface SimulationResult {
  decisionKey: string;
  kind: DecisionKind;
  question: string;
  horizonYears: number;
  options: OptionProjection[];
  assumptions: Assumption[];
  sensitivity: SensitivityFinding[];
  /** What the model deliberately does not account for. */
  limitations: string[];
  /** Questions that resolve what the numbers cannot. */
  whatWouldChangeThis: string[];
  disclaimer: string;
}

export interface DecisionModel {
  key: string;
  title: string;
  question: string;
  kind: DecisionKind;
  domains: LifeDomainId[];
  /** Stages this decision is typically live for. */
  relevantStages: LifeStageId[];
  minAge: number;
  horizonYears: number;
  inputs: DecisionInputSpec[];
  assumptions: Assumption[];
  run(inputs: Record<string, InputValue>): SimulationResult;
}
