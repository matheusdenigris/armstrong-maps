/**
 * How much the ground slows a suited walk: a leg over a slope or over loose sand takes longer
 * than the same distance on flat, firm ground.
 *
 * Nothing here is a NASA rule. No published walking speed for a suit on Mars exists, so the walk
 * keeps its assumed speed on flat ground and loses speed with the slope in the shape of Tobler's
 * hiking function, which was measured on people walking on Earth without a suit. The interface
 * says so.
 *
 * The slowdown of each leg is kept with the plan (`slow` on the stop the leg reaches, `slowBack`
 * on the last stop for the way home), so that the console and the visor time the walk the same
 * way without both reading the elevation model.
 */
import { METRES_PER_DEGREE, distance, type LatLon } from './geo';
import { heightAt, insidePolygon, samplePath, type ElevationGrid, type Polygon } from './terrain';
import type { WalkStop } from './walk';

/**
 * Tobler's hiking function (Tobler 1993, "Three presentations on geographical analysis and
 * modeling", NCGIA Technical Report 93-1): walking speed falls off as exp(-3.5 |grade + 0.05|),
 * where the grade is the rise over the run, positive uphill.
 */
const TOBLER_DECAY = 3.5;
const TOBLER_BEST_GRADE = -0.05;

/**
 * The share of the flat-ground speed kept on a grade (rise over run, positive uphill): 1 on the
 * flat, less on any slope. Tobler's function is a little faster on a gentle descent than on the
 * flat; in a suit that is not taken on trust, so the share never goes above 1.
 */
export function slopePace(grade: number): number {
  const onGrade = Math.exp(-TOBLER_DECAY * Math.abs(grade - TOBLER_BEST_GRADE));
  const onFlat = Math.exp(-TOBLER_DECAY * Math.abs(TOBLER_BEST_GRADE));
  return Math.min(1, onGrade / onFlat);
}

/**
 * The share of the speed kept in a mapped dune field: loose sand. An assumption of this project;
 * no measurement of a suited walk on Martian sand exists.
 */
export const SAND_PACE = 0.7;

/** The most a leg may be slowed: ten times. Past it the number is a fault in the data. */
export const MOST_SLOW = 10;

export type LegPace = {
  /** How many times longer the leg takes than on flat, firm ground: 1 or more. */
  slow: number;
  /** The share of the leg the elevation model had heights for, 0 to 1. Without heights it counts as flat. */
  covered: number;
};

/**
 * How much one leg is slowed. The leg is cut into pieces a cell of the model long; each piece is
 * timed by its own grade, in the direction of travel, and by whether it is in a dune field. A
 * piece without heights is timed as flat ground: unknown is not counted as slow, and `covered`
 * says how much of the leg that was.
 *
 * @param grids elevation grids from the finest to the coarsest
 * @param sand outlines of the dune fields
 */
export function legPace(
  from: LatLon,
  to: LatLon,
  grids: readonly ElevationGrid[],
  sand: readonly Polygon[] = [],
): LegPace {
  const length = distance(from, to);
  if (length < 1) return { slow: 1, covered: 1 };
  const step = grids.reduce((least, grid) => {
    const cell = ((grid.bounds.north - grid.bounds.south) / grid.height) * METRES_PER_DEGREE;
    return Math.min(least, cell);
  }, 200);
  const path = samplePath([from, to], Math.max(10, step));
  const height = (point: LatLon) => {
    for (const grid of grids) {
      const value = heightAt(grid, point);
      if (value !== null) return value;
    }
    return null;
  };
  let time = 0;
  let known = 0;
  let before = height(path[0]);
  for (let index = 1; index < path.length; index += 1) {
    const piece = distance(path[index - 1], path[index]);
    const here = height(path[index]);
    let pace = 1;
    if (before !== null && here !== null && piece > 0) {
      pace = slopePace((here - before) / piece);
      known += piece;
    }
    const middle = {
      lat: (path[index - 1].lat + path[index].lat) / 2,
      lon: (path[index - 1].lon + path[index].lon) / 2,
    };
    if (sand.some((field) => insidePolygon(middle, field))) pace *= SAND_PACE;
    time += piece / pace;
    before = here;
  }
  const slow = Math.min(MOST_SLOW, Math.max(1, time / length));
  return { slow, covered: Math.min(1, known / length) };
}

/** Three decimals are enough for a time, and keep a recomputed plan equal to the saved one. */
const rounded = (slow: number) => Math.round(slow * 1000) / 1000;

/**
 * The plan with the slowdown of every leg written into it. Returns the same list when nothing
 * changes, so saving it again does nothing.
 */
export function withPaces(
  base: LatLon,
  stops: readonly WalkStop[],
  grids: readonly ElevationGrid[],
  sand: readonly Polygon[] = [],
): readonly WalkStop[] {
  let changed = false;
  const next = stops.map((stop, index) => {
    const slow = rounded(legPace(index === 0 ? base : stops[index - 1], stop, grids, sand).slow);
    const last = index === stops.length - 1;
    const slowBack = last ? rounded(legPace(stop, base, grids, sand).slow) : undefined;
    if ((stop.slow ?? 1) === slow && stop.slowBack === (slowBack === 1 ? undefined : slowBack)) {
      return stop;
    }
    changed = true;
    const paced: WalkStop = { ...stop };
    if (slow === 1) delete paced.slow;
    else paced.slow = slow;
    if (slowBack === undefined || slowBack === 1) delete paced.slowBack;
    else paced.slowBack = slowBack;
    return paced;
  });
  return changed ? next : stops;
}
