/**
 * Where a crew member is at a given moment of a walk: out from the base through the waypoints,
 * a stop at each, and straight back.
 *
 * The position is simulated. It follows the plan exactly, at the assumed walking speed.
 */
import { bearing, destination, distance, type LatLon } from './geo';
import { WALK_ASSUMPTIONS, type WalkAssumptions } from './walk';

export type WalkPhase =
  /** On the way to a waypoint. */
  | 'walking'
  /** Stopped at a waypoint, working. */
  | 'working'
  /** On the last leg, to the base. */
  | 'returning'
  /** At the base: the walk has not left yet, has no waypoints, or is over. */
  | 'at-base';

export type WalkProgress = {
  phase: WalkPhase;
  position: LatLon;
  /** Direction of travel in degrees from north. At a stop, the direction of the next leg. */
  heading: number;
  /** The waypoint being walked to or worked at (0 is the first), or null on the way back. */
  stop: number | null;
  /** The point being walked to: a waypoint or the base. */
  target: LatLon;
  distanceToTargetM: number;
  bearingToTarget: number;
  distanceToBaseM: number;
  /** Time left in what the astronaut is doing now: this leg, or the work at this stop. In hours. */
  phaseHoursLeft: number;
  /** How many waypoints have been reached and worked at. */
  stopsDone: number;
  walkedM: number;
  /** Walk time counted, in hours: it stops growing when the walk is over. */
  elapsedHours: number;
  /** The whole walk, in hours. */
  totalHours: number;
  lifeSupportUsed: number;
  doseMsv: number;
};

/**
 * @param elapsedHours walk time since leaving the base
 * @param doseRateMsvPerDay the dose equivalent rate on the surface, per Earth day
 */
export function walkProgress(
  base: LatLon,
  waypoints: readonly LatLon[],
  elapsedHours: number,
  doseRateMsvPerDay: number,
  assumptions: WalkAssumptions = WALK_ASSUMPTIONS,
): WalkProgress {
  const speed = assumptions.walkingSpeedKmh * 1000; // metres per hour
  const stopHours = assumptions.minutesPerStop / 60;
  const points = [base, ...waypoints, base];
  const legs = points.slice(1).map((to, index) => {
    const from = points[index];
    const lengthM = distance(from, to);
    return { from, to, lengthM, hours: lengthM / speed };
  });
  const totalHours =
    waypoints.length === 0
      ? 0
      : legs.reduce((sum, leg) => sum + leg.hours, 0) + waypoints.length * stopHours;
  const counted = Math.min(Math.max(0, elapsedHours), totalHours);

  const report = (
    phase: WalkPhase,
    position: LatLon,
    heading: number,
    stop: number | null,
    target: LatLon,
    walkedM: number,
    phaseHoursLeft: number,
    stopsDone: number,
  ): WalkProgress => ({
    phase,
    position,
    heading,
    stop,
    target,
    distanceToTargetM: distance(position, target),
    bearingToTarget: bearing(position, target),
    distanceToBaseM: distance(position, base),
    phaseHoursLeft,
    stopsDone,
    walkedM,
    elapsedHours: counted,
    totalHours,
    lifeSupportUsed: counted / assumptions.lifeSupportHours,
    doseMsv: (doseRateMsvPerDay * counted) / 24,
  });

  if (waypoints.length === 0 || counted >= totalHours) {
    const walked = waypoints.length === 0 ? 0 : legs.reduce((sum, leg) => sum + leg.lengthM, 0);
    // Back at the base, looking the way the last leg came in.
    const lastLeg = legs[legs.length - 1];
    const heading = waypoints.length === 0 ? 0 : bearing(lastLeg.from, lastLeg.to);
    return report('at-base', base, heading, null, base, walked, 0, waypoints.length);
  }

  let clock = 0;
  let walkedM = 0;
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const lastLeg = index === legs.length - 1;
    if (counted < clock + leg.hours) {
      const doneM = (counted - clock) * speed;
      const course = bearing(leg.from, leg.to);
      const position = doneM === 0 ? leg.from : destination(leg.from, course, doneM);
      return report(
        lastLeg ? 'returning' : 'walking',
        position,
        doneM === 0 ? course : bearing(position, leg.to),
        lastLeg ? null : index,
        leg.to,
        walkedM + doneM,
        clock + leg.hours - counted,
        index,
      );
    }
    clock += leg.hours;
    walkedM += leg.lengthM;
    if (!lastLeg && counted < clock + stopHours) {
      const next = legs[index + 1];
      // Working at waypoint `index`; the next thing to walk to is the end of the next leg.
      return report(
        'working',
        leg.to,
        bearing(next.from, next.to),
        index,
        next.to,
        walkedM,
        clock + stopHours - counted,
        index,
      );
    }
    clock += lastLeg ? 0 : stopHours;
  }

  // Not reached: the loop returns before the total time. Kept for the type checker.
  return report('at-base', base, 0, null, base, walkedM, 0, waypoints.length);
}
