import { describe, expect, it } from 'vitest';

import {
  MARS_RADIUS_M,
  METRES_PER_DEGREE,
  bearing,
  destination,
  distance,
  normalizeLon,
  pathLength,
  pointAlong,
  toEast360,
} from './geo';

// Gale crater (Curiosity landing site) and Jezero crater (Perseverance landing site).
const GALE = { lat: -4.5895, lon: 137.4417 };
const JEZERO = { lat: 18.4447, lon: 77.4508 };

describe('distance', () => {
  it('is zero between a point and itself', () => {
    expect(distance(GALE, GALE)).toBe(0);
  });

  it('covers a quarter of the circumference along the equator', () => {
    const quarter = (Math.PI / 2) * MARS_RADIUS_M;
    expect(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo(quarter, 3);
  });

  it('measures one degree of latitude as about 59.16 km', () => {
    expect(distance({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })).toBeCloseTo(METRES_PER_DEGREE, 3);
    expect(METRES_PER_DEGREE).toBeCloseTo(59_157.9, 0);
  });

  it('shrinks a degree of longitude with the cosine of the latitude', () => {
    const at60 = distance({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
    expect(at60 / METRES_PER_DEGREE).toBeCloseTo(0.5, 3);
  });

  it('uses the radius of Mars, not of Earth', () => {
    // The same arc on Earth (radius 6371 km) would be 1.88 times longer: about 10 000 km.
    const equatorToPole = distance({ lat: 0, lon: 0 }, { lat: 90, lon: 0 });
    expect(equatorToPole).toBeGreaterThan(5_300_000);
    expect(equatorToPole).toBeLessThan(5_400_000);
  });

  it('is symmetric and crosses the antimeridian the short way', () => {
    expect(distance(GALE, JEZERO)).toBeCloseTo(distance(JEZERO, GALE), 6);
    const across = distance({ lat: 0, lon: 179 }, { lat: 0, lon: -179 });
    expect(across).toBeCloseTo(2 * METRES_PER_DEGREE, 3);
  });
});

describe('bearing', () => {
  const origin = { lat: 0, lon: 0 };

  it('points to the four cardinal directions', () => {
    expect(bearing(origin, { lat: 1, lon: 0 })).toBeCloseTo(0, 6);
    expect(bearing(origin, { lat: 0, lon: 1 })).toBeCloseTo(90, 6);
    expect(bearing(origin, { lat: -1, lon: 0 })).toBeCloseTo(180, 6);
    expect(bearing(origin, { lat: 0, lon: -1 })).toBeCloseTo(270, 6);
  });
});

describe('destination', () => {
  it('is the inverse of distance and bearing', () => {
    const heading = bearing(GALE, JEZERO);
    const reached = destination(GALE, heading, distance(GALE, JEZERO));
    expect(reached.lat).toBeCloseTo(JEZERO.lat, 6);
    expect(reached.lon).toBeCloseTo(JEZERO.lon, 6);
  });

  it('walks one kilometre north', () => {
    const reached = destination(GALE, 0, 1000);
    expect(reached.lon).toBeCloseTo(GALE.lon, 9);
    expect(reached.lat - GALE.lat).toBeCloseTo(1000 / METRES_PER_DEGREE, 9);
  });

  it('keeps the longitude inside -180..180', () => {
    const reached = destination({ lat: 0, lon: 179.9 }, 90, 20_000);
    expect(reached.lon).toBeLessThan(-179);
  });
});

describe('pathLength', () => {
  it('adds the legs of an out-and-back walk', () => {
    const turn = destination(GALE, 45, 800);
    expect(pathLength([GALE, turn, GALE])).toBeCloseTo(1600, 6);
  });

  it('is zero for fewer than two points', () => {
    expect(pathLength([])).toBe(0);
    expect(pathLength([GALE])).toBe(0);
  });
});

describe('longitude conventions', () => {
  it('wraps into -180..180', () => {
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(360)).toBe(0);
  });

  it('shows 0..360 east', () => {
    expect(toEast360(-90)).toBe(270);
    expect(toEast360(137.4417)).toBeCloseTo(137.4417, 9);
  });
});

describe('pointAlong', () => {
  const start = { lat: 18.4446, lon: 77.4509 };
  const corner = destination(start, 90, 100);
  const end = destination(corner, 0, 50);
  const path = [start, corner, end];

  it('is on the leg the distance falls in', () => {
    const first = pointAlong(path, 40)!;
    expect(distance(start, first)).toBeCloseTo(40, 3);
    expect(distance(first, corner)).toBeCloseTo(60, 3);
    const second = pointAlong(path, 120)!;
    expect(distance(corner, second)).toBeCloseTo(20, 3);
  });

  it('stays at the ends beyond them', () => {
    expect(pointAlong(path, -5)).toEqual(start);
    expect(pointAlong(path, 10_000)).toEqual(end);
  });

  it('is none for a path with no points', () => {
    expect(pointAlong([], 10)).toBeNull();
    expect(pointAlong([start], 10)).toEqual(start);
  });
});
