/**
 * What keeps the astronaut alive during a walk: how much life support is left, how long the way
 * back is from here, and what has to be said out loud.
 *
 * This module returns numbers and alert codes; the visor writes the sentences. The limits are the
 * project's walk assumptions, not NASA rules.
 */
import type { WalkProgress } from './progress';
import { WALK_ASSUMPTIONS, type WalkAssumptions } from './walk';

export type SafetyLevel = 'nominal' | 'caution' | 'warning';

export type SafetyAlert =
  /** Life support has run out. */
  | 'life-support-exhausted'
  /** Leaving now, the astronaut reaches the base with less than the reserve. */
  | 'turn-back-now'
  /** The astronaut is farther from the base than the walk-back limit. */
  | 'beyond-walk-back-limit'
  /** There is little time left before turning back becomes mandatory. */
  | 'return-margin-low'
  /** Life support is into its reserve. */
  | 'life-support-reserve'
  /** The astronaut is close to the walk-back limit. */
  | 'near-walk-back-limit';

const LEVEL: Record<SafetyAlert, SafetyLevel> = {
  'life-support-exhausted': 'warning',
  'turn-back-now': 'warning',
  'beyond-walk-back-limit': 'warning',
  'return-margin-low': 'caution',
  'life-support-reserve': 'caution',
  'near-walk-back-limit': 'caution',
};

/** Less spare time than this before the turn-back point earns a caution, in hours. */
export const LOW_MARGIN_HOURS = 0.5;

export type WalkSafety = {
  /** Life support left, in hours. Never negative. */
  hoursLeft: number;
  /** The part of what is left that must not be used: the reserve, in hours. */
  reserveHours: number;
  /** Time to walk straight back to the base from here, in hours. */
  returnHours: number;
  /**
   * Time to spare: what is left, minus the reserve, minus the way back. At zero the astronaut has
   * to turn back now; below zero they will arrive with less than the reserve.
   */
  marginHours: number;
  level: SafetyLevel;
  /** Everything that applies now, the most serious first. */
  alerts: SafetyAlert[];
};

export function walkSafety(
  progress: WalkProgress,
  assumptions: WalkAssumptions = WALK_ASSUMPTIONS,
): WalkSafety {
  const hoursLeft = Math.max(0, assumptions.lifeSupportHours * (1 - progress.lifeSupportUsed));
  const reserveHours = assumptions.lifeSupportHours * assumptions.reserveFraction;
  const returnHours = progress.distanceToBaseM / 1000 / assumptions.walkingSpeedKmh;
  const marginHours = hoursLeft - reserveHours - returnHours;
  const awayFromBase = progress.distanceToBaseM > 1;
  const limitM = assumptions.walkBackLimitKm * 1000;

  const alerts: SafetyAlert[] = [];
  if (progress.lifeSupportUsed >= 1) alerts.push('life-support-exhausted');
  if (awayFromBase && marginHours <= 0) alerts.push('turn-back-now');
  if (progress.distanceToBaseM > limitM) alerts.push('beyond-walk-back-limit');
  if (awayFromBase && marginHours > 0 && marginHours < LOW_MARGIN_HOURS) {
    alerts.push('return-margin-low');
  }
  if (progress.lifeSupportUsed < 1 && progress.lifeSupportUsed > 1 - assumptions.reserveFraction) {
    alerts.push('life-support-reserve');
  }
  if (
    progress.distanceToBaseM <= limitM &&
    progress.distanceToBaseM > limitM * assumptions.nearLimitFraction
  ) {
    alerts.push('near-walk-back-limit');
  }

  const level: SafetyLevel = alerts.some((alert) => LEVEL[alert] === 'warning')
    ? 'warning'
    : alerts.length > 0
      ? 'caution'
      : 'nominal';

  return { hoursLeft, reserveHours, returnHours, marginHours, level, alerts };
}

/** How serious one alert is. */
export const alertLevel = (alert: SafetyAlert): SafetyLevel => LEVEL[alert];
