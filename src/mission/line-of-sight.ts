/**
 * Whether the base and a crew member can see each other, which is what a radio link on the
 * surface needs: nothing in the way.
 *
 * Between the ship and an astronaut a few kilometres off, the signal takes microseconds, so
 * there is no delay to show. What does happen on the ground is losing the link behind a rise.
 * The line from one antenna to the other is checked against the heights of the elevation model
 * along the way, with the curve of the planet: Mars is small, and two antennas a few metres up
 * stop seeing each other at about ten kilometres even over flat ground.
 *
 * The heights of the antennas are assumptions of this project. The model gives one height for a
 * cell tens of metres across, so a boulder or a low bank does not show: the real link can drop
 * where this says it is clear. There is next to no air to bend the signal, so none is assumed.
 */
import { MARS_RADIUS_M, METRES_PER_DEGREE, distance, type LatLon } from './geo';
import type { ElevationGrid } from './terrain';

/** How high each antenna is above the ground, in metres. Assumptions of this project. */
export const LINK_ASSUMPTIONS = {
  /** On a mast at the base. */
  baseAntennaM: 5,
  /** On the helmet or the backpack of the suit. */
  suitAntennaM: 2,
} as const;

export type LinkAssumptions = { baseAntennaM: number; suitAntennaM: number };

/**
 * The height of the ground at a point, or null outside the grid or where it has no data. It is
 * read between the centres of the four cells around the point, not from the one cell under it:
 * a line that grazes the ground would otherwise flick between blocked and clear each time one
 * of its ends stepped into the next cell.
 */
export function elevationAt(grid: ElevationGrid, point: LatLon): number | null {
  const { bounds, width, height } = grid;
  if (
    point.lat > bounds.north ||
    point.lat < bounds.south ||
    point.lon < bounds.west ||
    point.lon > bounds.east
  ) {
    return null;
  }
  // In cells, counted from the centre of the first one. At the edge of the grid there is no
  // cell further out, so the last centre stands for the rest.
  const clamp = (value: number, most: number) => Math.min(most, Math.max(0, value));
  const x = clamp(((point.lon - bounds.west) / (bounds.east - bounds.west)) * width - 0.5, width - 1);
  const y = clamp(((bounds.north - point.lat) / (bounds.north - bounds.south)) * height - 0.5, height - 1);
  const col = Math.min(width - 1, Math.floor(x));
  const row = Math.min(height - 1, Math.floor(y));
  const nextCol = Math.min(width - 1, col + 1);
  const nextRow = Math.min(height - 1, row + 1);
  const [fx, fy] = [x - col, y - row];
  const at = (r: number, c: number) => grid.heights[r * width + c];
  const value =
    at(row, col) * (1 - fx) * (1 - fy) +
    at(row, nextCol) * fx * (1 - fy) +
    at(nextRow, col) * (1 - fx) * fy +
    at(nextRow, nextCol) * fx * fy;
  // A gap in any of the four makes the height unknown: NaN carries through the sum.
  return Number.isFinite(value) ? value : null;
}

export type SightLine = {
  clear: boolean;
  /**
   * How far the line passes above the ground at its tightest point, in metres. Negative when it
   * is blocked: how far under the ground the line would run.
   */
  clearanceM: number;
  /** How far from the base that tightest point is, in metres. */
  tightestAtM: number;
  /** The length of the line, in metres. */
  lengthM: number;
};

/**
 * The line of sight from the base to a crew member over an elevation grid. Null when the grid
 * has no height at either end, so that an unknown is never reported as clear.
 */
export function lineOfSight(
  grid: ElevationGrid,
  base: LatLon,
  crew: LatLon,
  heights: LinkAssumptions = LINK_ASSUMPTIONS,
): SightLine | null {
  const groundAtBase = elevationAt(grid, base);
  const groundAtCrew = elevationAt(grid, crew);
  if (groundAtBase === null || groundAtCrew === null) return null;

  const lengthM = distance(base, crew);
  const from = groundAtBase + heights.baseAntennaM;
  const to = groundAtCrew + heights.suitAntennaM;
  // Two samples a cell, so no cell on the way is stepped over.
  const cellM = ((grid.bounds.north - grid.bounds.south) / grid.height) * METRES_PER_DEGREE;
  const steps = Math.max(2, Math.ceil(lengthM / (cellM / 2)));

  let clearanceM = Math.min(heights.baseAntennaM, heights.suitAntennaM);
  let tightestAtM = lengthM;
  for (let step = 1; step < steps; step += 1) {
    const share = step / steps;
    const ground = elevationAt(grid, {
      lat: base.lat + (crew.lat - base.lat) * share,
      lon: base.lon + (crew.lon - base.lon) * share,
    });
    if (ground === null) continue;
    const alongM = lengthM * share;
    // Seen from the straight line between the two ends, the planet bulges up in between.
    const bulge = (alongM * (lengthM - alongM)) / (2 * MARS_RADIUS_M);
    const clearance = from + (to - from) * share - (ground + bulge);
    if (clearance < clearanceM) {
      clearanceM = clearance;
      tightestAtM = alongM;
    }
  }
  return { clear: clearanceM > 0, clearanceM, tightestAtM, lengthM };
}
