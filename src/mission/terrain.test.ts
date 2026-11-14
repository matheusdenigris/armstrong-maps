import { describe, expect, it } from 'vitest';

import { METRES_PER_DEGREE } from './geo';
import { encodeIndexedPng, pngDataUri, toBase64 } from './png';
import {
  classifySlope,
  insidePolygon,
  routeCrosses,
  routeSlope,
  samplePath,
  slopeAt,
  slopeGrid,
  type ElevationGrid,
} from './terrain';

/** A grid at the equator whose height rises `rise` metres per cell towards the east. */
function ramp(rise: number, size = 5, cellDeg = 0.001): ElevationGrid {
  const heights = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) heights[row * size + col] = col * rise;
  }
  const half = (size * cellDeg) / 2;
  return {
    bounds: { west: -half, east: half, south: -half, north: half },
    width: size,
    height: size,
    heights,
  };
}

describe('slopeGrid', () => {
  const cellM = 0.001 * METRES_PER_DEGREE;

  it('is flat where the ground is flat', () => {
    const slopes = slopeGrid(ramp(0));
    expect(Math.max(...slopes.degrees)).toBeCloseTo(0, 6);
  });

  it('measures a uniform ramp on Mars', () => {
    // Rising one cell length per cell is 45 degrees.
    const slopes = slopeGrid(ramp(cellM));
    for (const value of slopes.degrees) expect(value).toBeCloseTo(45, 1);
    expect(slopes.cellM).toBeCloseTo(cellM, 0);
  });

  it('leaves no slope next to a missing height', () => {
    const grid = ramp(10);
    grid.heights[12] = Number.NaN;
    const slopes = slopeGrid(grid);
    expect(Number.isNaN(slopes.degrees[11])).toBe(true);
    expect(Number.isNaN(slopes.degrees[0])).toBe(false);
  });

  it('reads the slope under a point, and nothing outside', () => {
    const slopes = slopeGrid(ramp(cellM));
    expect(slopeAt(slopes, { lat: 0, lon: 0 })).toBeCloseTo(45, 1);
    expect(slopeAt(slopes, { lat: 1, lon: 0 })).toBeNull();
  });
});

describe('classifySlope', () => {
  const limits = { cautionDeg: 15, noGoDeg: 25 };
  it('sorts slopes by the limits', () => {
    expect(classifySlope(10, limits)).toBe('ok');
    expect(classifySlope(15, limits)).toBe('caution');
    expect(classifySlope(30, limits)).toBe('no-go');
  });
});

describe('routes', () => {
  it('samples a path at the step it is given, ends included', () => {
    const points = samplePath([{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }], 100);
    expect(points[0]).toEqual({ lat: 0, lon: 0 });
    expect(points[points.length - 1]).toEqual({ lat: 0, lon: 0.01 });
    expect(points.length).toBe(Math.ceil((0.01 * METRES_PER_DEGREE) / 100) + 1);
  });

  it('finds the steepest ground, from the finest grid that covers a point', () => {
    const fine = slopeGrid(ramp(0, 5, 0.0004));
    const coarse = slopeGrid(ramp(0.004 * METRES_PER_DEGREE, 5, 0.004));
    const inside = routeSlope([{ lat: 0, lon: -0.0005 }, { lat: 0, lon: 0.0005 }], [fine, coarse]);
    expect(inside.maxDeg).toBeCloseTo(0, 3);
    const beyond = routeSlope([{ lat: 0, lon: 0 }, { lat: 0, lon: 0.008 }], [fine, coarse]);
    expect(beyond.maxDeg).toBeCloseTo(45, 0);
    expect(beyond.cellM).toBeCloseTo(coarse.cellM, 0);
    expect(beyond.covered).toBe(1);
  });

  it('says when nothing under the route has data', () => {
    const slopes = slopeGrid(ramp(0));
    expect(routeSlope([{ lat: 10, lon: 10 }], [slopes])).toMatchObject({ maxDeg: null, covered: 0 });
  });

  it('tells when a route enters an area', () => {
    const square = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.01 },
      { lat: 0.01, lon: 0.01 },
      { lat: 0.01, lon: 0 },
    ];
    expect(insidePolygon({ lat: 0.005, lon: 0.005 }, square)).toBe(true);
    expect(insidePolygon({ lat: 0.02, lon: 0.005 }, square)).toBe(false);
    expect(routeCrosses([{ lat: 0.005, lon: -0.01 }, { lat: 0.005, lon: 0.02 }], [square])).toBe(true);
    expect(routeCrosses([{ lat: 0.02, lon: -0.01 }, { lat: 0.02, lon: 0.02 }], [square])).toBe(false);
  });
});

describe('png', () => {
  it('writes a valid indexed PNG', () => {
    const png = encodeIndexedPng(2, 2, Uint8Array.from([0, 1, 1, 0]), [
      [0, 0, 0, 0],
      [255, 0, 0, 255],
    ]);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
    expect(pngDataUri(png)).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });

  it('encodes base64 like the standard', () => {
    expect(toBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    expect(toBase64(Uint8Array.from([77, 97]))).toBe('TWE=');
    expect(toBase64(Uint8Array.from([77]))).toBe('TQ==');
  });
});
