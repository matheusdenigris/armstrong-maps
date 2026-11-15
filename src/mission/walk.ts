/**
 * Evaluates a walk on the surface: out from the base through the waypoints and straight back.
 *
 * This module returns numbers and reason codes. It has no sentences in it; the interface writes
 * them.
 */
import { distance, pathLength, type LatLon } from './geo';

/**
 * What the evaluation takes for granted. These are assumptions of this project, chosen to be
 * plausible for a suited walk. They are not NASA requirements, and the interface says so.
 */
export type WalkAssumptions = {
  /** Average walking speed in a suit over rough ground, in km/h. */
  walkingSpeedKmh: number;
  /** How long the suit's life support lasts, in hours. */
  lifeSupportHours: number;
  /** The share of life support that must still be there on return. */
  reserveFraction: number;
  /** Time spent working at each waypoint, in minutes. */
  minutesPerStop: number;
  /** The farthest a crew member may be from the base, in km: the walk-back limit. */
  walkBackLimitKm: number;
  /** A waypoint past this share of the walk-back limit earns a warning. */
  nearLimitFraction: number;
  /** Ground this steep or steeper under the route earns a caution, in degrees. */
  cautionSlopeDeg: number;
  /** Ground this steep or steeper under the route refuses the walk, in degrees. */
  noGoSlopeDeg: number;
  /**
   * Below this elevation the Sun is low: long shadows hide holes and rocks, and the light fades
   * fast. A walk in it earns a caution. In degrees.
   */
  lowSunDeg: number;
};

export const WALK_ASSUMPTIONS: WalkAssumptions = {
  walkingSpeedKmh: 2.5,
  lifeSupportHours: 8,
  reserveFraction: 0.2,
  minutesPerStop: 20,
  walkBackLimitKm: 5,
  nearLimitFraction: 0.8,
  cautionSlopeDeg: 15,
  noGoSlopeDeg: 25,
  lowSunDeg: 10,
};

export type Verdict = 'go' | 'caution' | 'no-go';

/** Why a walk is not a plain go. */
export type WalkReason =
  | 'life-support-exceeded'
  | 'into-reserve'
  | 'beyond-walk-back-limit'
  | 'near-walk-back-limit'
  | 'cme-at-mars'
  | 'too-steep'
  | 'steep-ground'
  | 'dune-field'
  | 'starts-in-dark'
  | 'into-night'
  | 'low-sun';

const SEVERITY: Record<WalkReason, Verdict> = {
  'life-support-exceeded': 'no-go',
  'into-reserve': 'caution',
  'beyond-walk-back-limit': 'no-go',
  'near-walk-back-limit': 'caution',
  'cme-at-mars': 'caution',
  'too-steep': 'no-go',
  'steep-ground': 'caution',
  'dune-field': 'caution',
  'starts-in-dark': 'no-go',
  'into-night': 'no-go',
  'low-sun': 'caution',
};

/** What is happening around the walk, from live sources. Unknown is left out. */
export type WalkConditions = {
  /**
   * A coronal mass ejection is forecast to reach Mars around the time of the walk, or has just
   * reached it (NASA DONKI, WSA-Enlil model). It can bring solar particles that raise the dose
   * above the average the evaluation uses.
   */
  cmeAtMars?: boolean;
  /**
   * The steepest ground under the route, out and back, in degrees, read from an elevation model.
   * Left out when the model has not answered.
   */
  maxSlopeDeg?: number | null;
  /** The route, out and back, runs into a mapped dune field: loose sand. */
  crossesDunes?: boolean;
  /** Where the Sun is over the walk, from the Mars clock. Left out when no start time is set. */
  daylight?: {
    /** Sun elevation at the start, in degrees. */
    startElevation: number;
    /** The lowest the Sun gets before the walk ends, in degrees. */
    lowestElevation: number;
  } | null;
};

export type WalkEvaluation = {
  /** Base, through the waypoints, in metres. */
  outboundM: number;
  /** From the last waypoint straight back to the base, in metres. */
  returnM: number;
  totalM: number;
  /** The greatest straight-line distance between a waypoint and the base, in metres. */
  farthestM: number;
  walkingHours: number;
  stopHours: number;
  durationHours: number;
  /** Share of life support used: 1 is all of it, more than 1 is more than the suit has. */
  lifeSupportUsed: number;
  /** Radiation dose equivalent picked up during the walk, in millisieverts. */
  doseMsv: number;
  verdict: Verdict;
  reasons: WalkReason[];
};

/**
 * @param doseRateMsvPerDay the dose equivalent rate on the surface, per Earth day
 */
export function evaluateWalk(
  base: LatLon,
  waypoints: readonly LatLon[],
  doseRateMsvPerDay: number,
  assumptions: WalkAssumptions = WALK_ASSUMPTIONS,
  conditions: WalkConditions = {},
): WalkEvaluation {
  const outboundM = pathLength([base, ...waypoints]);
  const last = waypoints[waypoints.length - 1];
  const returnM = last ? distance(last, base) : 0;
  const totalM = outboundM + returnM;
  const farthestM = waypoints.reduce((far, point) => Math.max(far, distance(base, point)), 0);

  const walkingHours = totalM / 1000 / assumptions.walkingSpeedKmh;
  const stopHours = (waypoints.length * assumptions.minutesPerStop) / 60;
  const durationHours = walkingHours + stopHours;
  const lifeSupportUsed = durationHours / assumptions.lifeSupportHours;
  const doseMsv = (doseRateMsvPerDay * durationHours) / 24;

  const reasons: WalkReason[] = [];
  if (lifeSupportUsed > 1) reasons.push('life-support-exceeded');
  else if (lifeSupportUsed > 1 - assumptions.reserveFraction) reasons.push('into-reserve');

  const limitM = assumptions.walkBackLimitKm * 1000;
  if (farthestM > limitM) reasons.push('beyond-walk-back-limit');
  else if (farthestM > limitM * assumptions.nearLimitFraction) reasons.push('near-walk-back-limit');

  // Space weather only matters once there is a walk to take.
  if (conditions.cmeAtMars && waypoints.length > 0) reasons.push('cme-at-mars');

  // So does the ground under it.
  const slope = conditions.maxSlopeDeg;
  if (waypoints.length > 0 && slope !== undefined && slope !== null) {
    if (slope >= assumptions.noGoSlopeDeg) reasons.push('too-steep');
    else if (slope >= assumptions.cautionSlopeDeg) reasons.push('steep-ground');
  }
  if (conditions.crossesDunes && waypoints.length > 0) reasons.push('dune-field');

  // And the light: the walk has to start and end with the Sun up.
  const sun = conditions.daylight;
  if (sun && waypoints.length > 0) {
    if (sun.startElevation < 0) reasons.push('starts-in-dark');
    else if (sun.lowestElevation < 0) reasons.push('into-night');
    else if (sun.lowestElevation < assumptions.lowSunDeg) reasons.push('low-sun');
  }

  const verdict: Verdict = reasons.some((reason) => SEVERITY[reason] === 'no-go')
    ? 'no-go'
    : reasons.length > 0
      ? 'caution'
      : 'go';

  return {
    outboundM,
    returnM,
    totalM,
    farthestM,
    walkingHours,
    stopHours,
    durationHours,
    lifeSupportUsed,
    doseMsv,
    verdict,
    reasons,
  };
}
