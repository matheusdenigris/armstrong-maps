import { describe, expect, it } from 'vitest';

import { METRES_PER_DEGREE, destination } from './geo';
import { LINK_ASSUMPTIONS, elevationAt, lineOfSight } from './line-of-sight';
import type { ElevationGrid } from './terrain';

const base = { lat: 0, lon: 100 };

/** A square grid around the base, 0.5 degrees across (about 30 km), with one height a cell. */
function grid(heightAt: (row: number, col: number) => number, cells = 300): ElevationGrid {
  const heights = new Float32Array(cells * cells);
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) heights[row * cells + col] = heightAt(row, col);
  }
  return {
    bounds: { west: 99.75, east: 100.25, south: -0.25, north: 0.25 },
    width: cells,
    height: cells,
    heights,
  };
}

const flat = grid(() => -4500);
const east = (metres: number) => destination(base, 90, metres);

describe('elevationAt', () => {
  it('reads the height at the centre of a cell, and the last cell at the edge of the grid', () => {
    const stepped = grid((_row, col) => col);
    expect(elevationAt(stepped, { lat: 0, lon: 99.75 })).toBe(0);
    expect(elevationAt(stepped, { lat: 0, lon: 100.25 })).toBe(299);
    // The centre of the cell 10 from the west edge.
    expect(elevationAt(stepped, { lat: 0, lon: 99.75 + (10.5 * 0.5) / 300 })).toBeCloseTo(10, 6);
  });

  it('reads between the centres of the cells, so the ground has no steps', () => {
    const stepped = grid((_row, col) => col * 4);
    const lonOf = (cells: number) => 99.75 + (cells * 0.5) / 300;
    // Halfway from the centre of cell 10 to the centre of cell 11.
    expect(elevationAt(stepped, { lat: 0, lon: lonOf(11) })).toBeCloseTo(42, 6);
    expect(elevationAt(stepped, { lat: 0, lon: lonOf(10.75) })).toBeCloseTo(41, 6);
  });

  it('has nothing outside the grid, or where the model has a gap', () => {
    expect(elevationAt(flat, { lat: 1, lon: 100 })).toBeNull();
    const gap = grid(() => Number.NaN);
    expect(elevationAt(gap, base)).toBeNull();
  });
});

describe('lineOfSight', () => {
  it('is clear over flat ground a kilometre off', () => {
    const sight = lineOfSight(flat, base, east(1000))!;

    expect(sight.clear).toBe(true);
    expect(sight.lengthM).toBeCloseTo(1000, 0);
    // The line comes down from the mast to the suit, and the planet barely curves in a kilometre.
    expect(sight.clearanceM).toBeGreaterThan(1.5);
    expect(sight.clearanceM).toBeLessThanOrEqual(LINK_ASSUMPTIONS.suitAntennaM);
  });

  it('is blocked by a rise between the two', () => {
    // A ridge 30 m high, 100 m wide, 500 m east of the base.
    const cellM = (0.5 / 300) * METRES_PER_DEGREE;
    const ridged = grid((_row, col) => {
      const eastM = (col - 150) * cellM;
      return eastM > 450 && eastM < 600 ? -4470 : -4500;
    });
    const sight = lineOfSight(ridged, base, east(1000))!;

    expect(sight.clear).toBe(false);
    expect(sight.clearanceM).toBeLessThan(-20);
    expect(sight.tightestAtM).toBeGreaterThan(400);
    // The cells are about 100 m across, so the ridge reaches a little past its 600 m.
    expect(sight.tightestAtM).toBeLessThan(700);
  });

  it('is clear again from the top of the rise', () => {
    const cellM = (0.5 / 300) * METRES_PER_DEGREE;
    const ridged = grid((_row, col) => {
      const eastM = (col - 150) * cellM;
      return eastM > 450 && eastM < 600 ? -4470 : -4500;
    });

    expect(lineOfSight(ridged, base, east(520))!.clear).toBe(true);
  });

  it('is lost to the curve of the planet over flat ground, at about ten kilometres', () => {
    // A 5 m mast sees the horizon at 5.8 km and a 2 m antenna at 3.7 km: 9.5 km between them.
    expect(lineOfSight(flat, base, east(8000))!.clear).toBe(true);
    expect(lineOfSight(flat, base, east(11000))!.clear).toBe(false);
  });

  it('reaches further from a taller mast', () => {
    const tall = { baseAntennaM: 20, suitAntennaM: 2 };
    expect(lineOfSight(flat, base, east(11000), tall)!.clear).toBe(true);
  });

  it('does not call an unknown clear', () => {
    expect(lineOfSight(flat, base, { lat: 2, lon: 100 })).toBeNull();
    const gap = grid((row, col) => (row === 150 && col === 150 ? Number.NaN : -4500));
    expect(lineOfSight(gap, base, east(1000))).toBeNull();
  });

  it('is clear where the crew member stands at the base', () => {
    const sight = lineOfSight(flat, base, base)!;
    expect(sight.clear).toBe(true);
    expect(sight.lengthM).toBe(0);
  });
});
