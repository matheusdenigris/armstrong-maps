/**
 * Puts a walk plan round steep ground: each leg that crosses ground at or past the caution slope
 * is replaced by a way that avoids it, where the elevation model shows one.
 *
 * The points it adds are passed through without stopping. The stops of the crew are not moved.
 */
import type { LatLon } from './geo';
import { routeSlope, wayRound, type SlopeGrid, type SlopeLimits } from './terrain';
import type { WalkStop } from './walk';

/** What a point added to go round steep ground is called in the plan. */
export const VIA_NAME = 'Via point';

export type Reroute = {
  stops: WalkStop[];
  /** How many points were added. */
  added: number;
  /** Legs that cross steep ground and for which no way round was found. */
  blocked: number;
  /** Legs left as they were because the plan has no room for more points. */
  full: number;
};

/**
 * @param grids slope grids from the finest to the coarsest; a leg is searched on the finest one
 * that holds both of its ends
 * @param mostStops the most points a plan may have
 */
export function rerouteWalk(
  base: LatLon,
  stops: readonly WalkStop[],
  grids: readonly SlopeGrid[],
  limits: SlopeLimits,
  mostStops: number,
): Reroute {
  const inside = (grid: SlopeGrid, point: LatLon) =>
    point.lat <= grid.bounds.north &&
    point.lat >= grid.bounds.south &&
    point.lon >= grid.bounds.west &&
    point.lon <= grid.bounds.east;

  const out: WalkStop[] = [];
  let added = 0;
  let blocked = 0;
  let full = 0;
  const points: LatLon[] = [base, ...stops, base];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const steepest = routeSlope([from, to], grids).maxDeg;
    if (steepest !== null && steepest >= limits.cautionDeg) {
      const grid = grids.find((entry) => inside(entry, from) && inside(entry, to));
      const way = grid ? wayRound(from, to, grid, limits) : null;
      if (!way || way.maxDeg >= steepest) {
        // No way, or none better than the straight line.
        blocked += 1;
      } else if (stops.length + added + way.via.length > mostStops) {
        full += 1;
      } else {
        for (const point of way.via) {
          out.push({ lat: point.lat, lon: point.lon, minutes: 0, name: VIA_NAME });
        }
        added += way.via.length;
      }
    }
    // Every point but the base at the end is a stop of the plan.
    if (index < points.length - 1) out.push(stops[index - 1]);
  }
  return { stops: out, added, blocked, full };
}
