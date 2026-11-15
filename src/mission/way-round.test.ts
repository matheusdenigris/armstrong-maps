import { describe, expect, it } from 'vitest';

import { METRES_PER_DEGREE, distance, pathLength } from './geo';
import {
  heightAt,
  routeProfile,
  routeSlope,
  wayRound,
  type ElevationGrid,
  type SlopeGrid,
} from './terrain';

const CELL_DEG = 0.001;
const limits = { cautionDeg: 15, noGoDeg: 25 };

/** A square slope grid at the equator, flat except where `steep` says how steep a cell is. */
function slopes(size: number, steep: (col: number, row: number) => number): SlopeGrid {
  const degrees = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) degrees[row * size + col] = steep(col, row);
  }
  const half = (size * CELL_DEG) / 2;
  return {
    bounds: { west: -half, east: half, south: -half, north: half },
    width: size,
    height: size,
    degrees,
    cellM: CELL_DEG * METRES_PER_DEGREE,
  };
}
/** The centre of a cell of such a grid. */
const cell = (size: number, col: number, row: number) => ({
  lat: (size * CELL_DEG) / 2 - (row + 0.5) * CELL_DEG,
  lon: -(size * CELL_DEG) / 2 + (col + 0.5) * CELL_DEG,
});

describe('a way round steep ground', () => {
  it('is the straight line over flat ground', () => {
    const grid = slopes(21, () => 2);
    const way = wayRound(cell(21, 2, 10), cell(21, 18, 10), grid, limits);
    expect(way).not.toBeNull();
    expect(way?.via).toEqual([]);
    expect(way?.maxDeg).toBeLessThan(limits.cautionDeg);
  });

  it('goes round a wall too steep to walk', () => {
    // A wall across the middle column, open only at the two bottom rows.
    const grid = slopes(21, (col, row) => (col === 10 && row < 19 ? 40 : 2));
    const from = cell(21, 2, 10);
    const to = cell(21, 18, 10);
    expect(routeSlope([from, to], [grid]).maxDeg).toBeGreaterThanOrEqual(limits.noGoDeg);
    const way = wayRound(from, to, grid, limits);
    expect(way).not.toBeNull();
    if (!way) return;
    expect(way.via.length).toBeGreaterThan(0);
    // Few points: only where the way turns.
    expect(way.via.length).toBeLessThanOrEqual(4);
    const path = [from, ...way.via, to];
    expect(routeSlope(path, [grid]).maxDeg).toBeLessThan(limits.cautionDeg);
    expect(way.lengthM).toBeCloseTo(pathLength(path), 3);
    expect(way.lengthM).toBeGreaterThan(distance(from, to));
  });

  it('prefers clear ground to a short cut over caution ground', () => {
    // A band of caution ground across the middle, with a clear gap at the bottom.
    const grid = slopes(21, (col, row) => (col >= 9 && col <= 11 && row < 17 ? 20 : 2));
    const from = cell(21, 2, 14);
    const to = cell(21, 18, 14);
    const way = wayRound(from, to, grid, limits);
    expect(way).not.toBeNull();
    if (!way) return;
    expect(way.maxDeg).toBeLessThan(limits.cautionDeg);
  });

  it('crosses caution ground when the way round would be far longer', () => {
    // The band is three cells thick and the clear way round is a long detour.
    const grid = slopes(41, (col, row) => (col >= 19 && col <= 21 && row < 40 ? 20 : 2));
    const way = wayRound(cell(41, 15, 2), cell(41, 25, 2), grid, limits);
    expect(way).not.toBeNull();
    if (!way) return;
    expect(way.maxDeg).toBeGreaterThanOrEqual(limits.cautionDeg);
    expect(way.maxDeg).toBeLessThan(limits.noGoDeg);
  });

  it('finds none when the wall has no gap', () => {
    const grid = slopes(21, (col) => (col === 10 ? 40 : 2));
    expect(wayRound(cell(21, 2, 10), cell(21, 18, 10), grid, limits)).toBeNull();
  });

  it('does not walk over ground with no data', () => {
    const grid = slopes(21, (col) => (col === 10 ? Number.NaN : 2));
    expect(wayRound(cell(21, 2, 10), cell(21, 18, 10), grid, limits)).toBeNull();
  });

  it('does not squeeze between two steep cells on a diagonal', () => {
    // Two steep cells touching at a corner close the diagonal between them.
    const grid = slopes(5, (col, row) =>
      (col === 2 && row === 1) || (col === 1 && row === 2) || col + row === 5 || (col === 0 && row === 3) || (col === 3 && row === 0)
        ? 40
        : 2,
    );
    const way = wayRound(cell(5, 1, 1), cell(5, 2, 2), grid, limits);
    expect(way).toBeNull();
  });

  it('starts and ends where the crew chose, even on steep ground', () => {
    const grid = slopes(21, (col, row) => (col === 18 && row === 10 ? 40 : 2));
    const way = wayRound(cell(21, 2, 10), cell(21, 18, 10), grid, limits);
    expect(way).not.toBeNull();
  });

  it('finds none for a point off the grid', () => {
    const grid = slopes(21, () => 2);
    expect(wayRound({ lat: 5, lon: 5 }, cell(21, 18, 10), grid, limits)).toBeNull();
  });
});

/** A grid whose height rises `rise` metres a cell towards the east. */
function ramp(size: number, rise: number): ElevationGrid {
  const heights = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) heights[row * size + col] = col * rise;
  }
  const half = (size * CELL_DEG) / 2;
  return { bounds: { west: -half, east: half, south: -half, north: half }, width: size, height: size, heights };
}

describe('the height under a point', () => {
  it('is the height of a cell at its centre, and between two cells half way', () => {
    const grid = ramp(11, 10);
    expect(heightAt(grid, cell(11, 4, 5))).toBeCloseTo(40, 4);
    const between = { lat: 0, lon: (cell(11, 4, 5).lon + cell(11, 5, 5).lon) / 2 };
    expect(heightAt(grid, between)).toBeCloseTo(45, 4);
  });

  it('is nothing outside the grid or where the model has a gap', () => {
    const grid = ramp(11, 10);
    expect(heightAt(grid, { lat: 1, lon: 0 })).toBeNull();
    grid.heights[5 * 11 + 5] = Number.NaN;
    expect(heightAt(grid, cell(11, 5, 5))).toBeNull();
  });
});

describe('the profile of a route', () => {
  it('climbs on the way out and comes down the same on the way back', () => {
    const grid = ramp(21, 10);
    const from = cell(21, 2, 10);
    const to = cell(21, 12, 10);
    const profile = routeProfile([from, to, from], [grid]);
    expect(profile.ascentM).toBeCloseTo(100, 1);
    expect(profile.descentM).toBeCloseTo(100, 1);
    expect(profile.lowestM).toBeCloseTo(20, 1);
    expect(profile.highestM).toBeCloseTo(120, 1);
    expect(profile.totalM).toBeCloseTo(2 * distance(from, to), 3);
    expect(profile.covered).toBe(1);
    expect(profile.samples[0].distanceM).toBe(0);
    expect(profile.samples.at(-1)?.distanceM).toBeCloseTo(profile.totalM, 6);
  });

  it('says how much of the route had no height', () => {
    const grid = ramp(21, 10);
    const profile = routeProfile([cell(21, 10, 10), { lat: 0, lon: 0.03 }], [grid]);
    expect(profile.covered).toBeGreaterThan(0.2);
    expect(profile.covered).toBeLessThan(0.8);
    expect(profile.samples.at(-1)?.heightM).toBeNull();
  });

  it('has no climb to give when nothing has a height', () => {
    const profile = routeProfile([{ lat: 5, lon: 5 }, { lat: 5.001, lon: 5 }], [ramp(5, 1)]);
    expect(profile.ascentM).toBeNull();
    expect(profile.covered).toBe(0);
    expect(profile.cellM).toBeNull();
  });
});
