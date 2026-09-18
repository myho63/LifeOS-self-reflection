import type { ProfileSignals, Season, SeasonId } from '../types.js';
import { getStage } from './stages.js';
import type { LifeStageId } from '../types.js';

/**
 * Seasons — the top of the hierarchy.
 *
 * A stage is a precise situation ("youngest child is four"). A season is the
 * shape of the chapter ("we are growing"). The wheel leads with the season
 * because it is what a person recognises about themselves before they have
 * answered a single question.
 *
 * Crucially, seasons are not ordered and not chronological. `preserve` does not
 * follow `enjoy` by age; it follows it by capability. `reinvent` can arrive at
 * 27 or 62. Someone can pass through `build` twice, which is why the wheel
 * never renders these as a progress bar.
 */
export const SEASONS: readonly Season[] = [
  {
    id: 'explore',
    label: 'Explore',
    primaryQuestion: 'Who am I, and what kind of life do I want?',
    thesis: 'Discover your options before optimising any of them. Nothing here should be irreversible.',
    optimisingFor: 'Breadth of options and self-knowledge',
  },
  {
    id: 'build',
    label: 'Build',
    primaryQuestion: 'What foundation am I going to build my life on?',
    thesis: 'Build the things that compound — skills, earning power, health habits, chosen people.',
    optimisingFor: 'Compounding assets',
  },
  {
    id: 'grow',
    label: 'Grow',
    primaryQuestion: 'How do I carry more than I used to without dropping any of it?',
    thesis: 'The life has expanded faster than the capacity to run it. Protect the scarce resources and defer the rest.',
    optimisingFor: 'Load-bearing capacity',
  },
  {
    id: 'stabilize',
    label: 'Stabilize',
    primaryQuestion: 'How do I build a great life without sacrificing myself?',
    thesis: 'Multiple dimensions now compete for the same finite time. The problem is allocation, not ambition.',
    optimisingFor: 'Balance across competing claims',
  },
  {
    id: 'reinvent',
    label: 'Reinvent',
    primaryQuestion: 'What do I rebuild on, and who am I without the old thing?',
    thesis: 'Something ended, by choice or not. Stabilise the floor first, then rebuild direction.',
    optimisingFor: 'A stable floor, then a new direction',
  },
  {
    id: 'transition',
    label: 'Transition',
    primaryQuestion: 'What do I want the next chapter to look like?',
    thesis: 'Convert what you have accumulated into a durable plan for income, health, purpose and place.',
    optimisingFor: 'Freedom and healthspan over accumulation',
  },
  {
    id: 'enjoy',
    label: 'Enjoy',
    primaryQuestion: 'How do I make the most of the life I have built?',
    thesis: 'The target is quality of life rather than accumulation. Spend what you built on what you value.',
    optimisingFor: 'Quality of lived years',
  },
  {
    id: 'preserve',
    label: 'Preserve',
    primaryQuestion: 'How do I maintain autonomy, connection, dignity and meaning?',
    thesis: 'Preserving capability and relationships matters more than any further achievement.',
    optimisingFor: 'Autonomy and connection',
  },
] as const;

const SEASON_INDEX = new Map<SeasonId, Season>(SEASONS.map((s) => [s.id, s]));

export function getSeason(id: SeasonId): Season {
  const season = SEASON_INDEX.get(id);
  if (!season) throw new Error(`Unknown season: ${id}`);
  return season;
}

export const ALL_SEASON_IDS: readonly SeasonId[] = SEASONS.map((s) => s.id);

/**
 * Resolve the season for a stage.
 *
 * Most stages map straight to their declared season. The exception is later
 * life, which splits on *capability* rather than age: someone thriving at 78 is
 * in `enjoy`, and someone managing serious health limits at 68 is in
 * `preserve`. Making that split on health rather than birthday is the whole
 * reason seasons exist as a layer.
 */
export function seasonForStage(stageId: LifeStageId, signals: ProfileSignals = {}): SeasonId {
  const declared = getStage(stageId).seasonId;
  if (declared !== 'enjoy') return declared;

  const strugglingHealth =
    signals.healthStatus === 'struggling' || signals.healthStatus === 'managing_condition';
  const veryLate = (signals.ageYears ?? 0) >= 80;
  return strugglingHealth || veryLate ? 'preserve' : 'enjoy';
}
