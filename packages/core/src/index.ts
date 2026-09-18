/**
 * @lifeos/core — the Life OS domain engine.
 *
 * The same model runs on the API and in the mobile client, so a user's
 * segmentation never disagrees with itself between surfaces. Nothing in this
 * package touches I/O, storage or the network: it is a pure function from
 * profile signals to orientation.
 */

export * from './types.js';

// Taxonomy
export {
  LIFE_DOMAINS, ALL_DOMAIN_IDS, getDomain, domainLabel, upstreamOf, downstreamOf,
} from './taxonomy/domains.js';
export { LIFE_STAGES, ALL_STAGE_IDS, getStage } from './taxonomy/stages.js';
export { SEASONS, ALL_SEASON_IDS, getSeason, seasonForStage } from './taxonomy/seasons.js';
export { MODIFIER_TAGS, getModifier, AGE_BANDS, bandForAge } from './taxonomy/modifiers.js';

// Segmentation
export { segment, primaryStage, ageOfMajority, type SegmentOptions } from './segmentation/engine.js';
export { deriveContext, type DerivedContext } from './segmentation/context.js';
export { SEGMENTATION_RULES, TOTAL_RULE_WEIGHT, type SegmentationRule } from './segmentation/rules.js';
export { ONBOARDING_QUESTIONS, getQuestion, probesFor, type OnboardingQuestion } from './segmentation/questions.js';
export { forecastTransitions } from './segmentation/transitions.js';

// Orientation
export { orient, type OrientationOptions } from './orientation/engine.js';

// Personal analysis
export {
  TRAIT_ITEMS, scoreTraits, importTraits, framingFor, traitWeightDeltas,
  type TraitAnswers,
} from './assessment/traits.js';
export type {
  Assessment, DimensionRating, TraitScores, TraitSource, TraitItem, FramingHints,
} from './assessment/types.js';

// Balance — priority against standing
export {
  balance, nextCheckIn,
  type BalanceReport, type BalanceState, type DimensionBalance,
  type BalanceOptions, type Reallocation,
} from './balance/engine.js';

// Goals and milestones
// Dashboard scoring
export {
  dimensionScores, lifeScore, levelFrom, segmentOf,
  type DimensionScore, type LifeScore, type Level, type Segment,
  type ConsistencyInput, type CohortDistribution,
} from './scoring/engine.js';

// Daily practice
export {
  habitStatus, readyToAchieve, todayPlan, progressSummary,
  ACHIEVEMENT_WINDOW_DAYS, REFLECTION_PROMPTS,
  type Habit, type HabitStatus, type Weekday, type Task, type TodayPlan,
  type Reflection, type ProgressSummary, type VisionBoard,
} from './practice/engine.js';

// Wellbeing — the daily check-in and what it adds up to
export {
  HAPPINESS_FACES, faceFor, happinessMonth, happinessComparison, habitConsistency,
  COMPARISON_MINIMUM_DAYS,
  type HappinessFace, type HappinessDay, type HappinessMonth,
  type HappinessComparison, type HabitConsistency,
} from './wellbeing/engine.js';

// Insights — what a year of check-ins says, and what moves with them
export {
  happinessYear, happinessByYear, dimensionImpact, changeSignals,
  YEAR_COMPARISON_MINIMUM_DAYS, IMPACT_MINIMUM_DAYS, CHANGE_MINIMUM_DAYS,
  type HappinessYear, type HappinessMonthPoint, type HappinessYearPoint,
  type DimensionImpact, type ImpactReport,
  type ChangeSignal, type ChangeReport,
} from './insights/engine.js';

// Reflection — the written record scored as arithmetic
export {
  readDimensions, explainReading,
  REFLECTION_MINIMUM_DAYS, REFLECTION_MINIMUM_SIDE,
  type ReflectionDay, type ReflectionReading, type DimensionReading,
  type ImpactBand, type ImpactDirection, type ConfidenceBand,
  type InsufficientReason,
} from './insights/reflection.js';

// Time and work — hours intended against hours spent
export {
  timeSummary, dailyHours,
  type TimeBudget, type TimeEntry, type BudgetPeriod,
  type BudgetSummary, type TimeSummary,
} from './time/engine.js';

// Safety
export {
  screenText,
  type CrisisSignal,
  type CrisisSeverity,
  type SupportResource,
  type ScreenOptions,
} from './safety/crisis.js';
export {
  SIGNAL_SENSITIVITY,
  specialCategorySignals,
  redactForAnalytics,
  isContentAllowed,
  ORIENTATION_DISCLAIMER,
  REGULATED_DOMAINS,
  MINIMUM_SUPPORTED_AGE,
  type SensitivityClass,
  type ContentItem,
} from './safety/guardrails.js';

// Utilities worth exposing to consumers building on the model
export { softmax, entropyBits, clamp, round } from './util/math.js';
