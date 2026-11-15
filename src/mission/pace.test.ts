import { describe, expect, it } from 'vitest';

import { METRES_PER_DEGREE, destination, distance } from './geo';
import { SAND_PACE, legPace, slopePace, withPaces } from './pace';
import { returnPlan, walkHoursPlayed, walkProgress } from './progress';
import type { ElevationGrid } from './terrain';
import { walkLog } from './walk-log';
import { WALK_ASSUMPTIONS, evaluateWalk, legSlow, type WalkStop } from './walk';

const CELL = 0.001;
const SIZE = 41;
const half = (SIZE * CELL) / 2;
const bounds = { west: -half, east: half, south: -half, north: half };
const cellM = CELL * METRES_PER_DEGREE;
/** A grid whose ground rises `grade` (rise over run) towards the east. */
function tilted(grade: number): ElevationGrid {
  const heights = new Float32Array(SIZE * SIZE);
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) heights[row * SIZE + col] = col * cellM * grade;
  }
  return { bounds, width: SIZE, height: SIZE, heights };
}
const base = { lat: 0, lon: -0.012 };
const east = { lat: 0, lon: 0.012 };
const speed = WALK_ASSUMPTIONS.walkingSpeedKmh * 1000;

describe('the speed kept on a slope', () => {
  it('is the whole speed on the flat and never more', () => {
    expect(slopePace(0)).toBe(1);
    // Tobler's function peaks on a gentle descent; a suit is not given that.
    expect(slopePace(-0.05)).toBe(1);
    expect(slopePace(-0.02)).toBe(1);
  });

  it('falls with the slope, uphill more than downhill', () => {
    expect(slopePace(0.1)).toBeCloseTo(Math.exp(-0.35), 6);
    expect(slopePace(0.2)).toBeLessThan(slopePace(0.1));
    expect(slopePace(-0.3)).toBeLessThan(1);
    expect(slopePace(0.2)).toBeLessThan(slopePace(-0.2));
    expect(slopePace(0.5)).toBeGreaterThan(0);
  });
});

describe('how much a leg is slowed', () => {
  it('is not slowed on flat ground', () => {
    const pace = legPace(base, east, [tilted(0)]);
    expect(pace.slow).toBeCloseTo(1, 6);
    expect(pace.covered).toBeCloseTo(1, 2);
  });

  it('takes longer uphill, by the speed kept on that grade', () => {
    const up = legPace(base, east, [tilted(0.1)]);
    expect(up.slow).toBeCloseTo(1 / slopePace(0.1), 2);
    const down = legPace(east, base, [tilted(0.1)]);
    expect(down.slow).toBeGreaterThan(1);
    expect(down.slow).toBeLessThan(up.slow);
  });

  it('takes longer in a dune field', () => {
    // The field covers the eastern half of the leg.
    const field = [
      { lat: -0.005, lon: 0 },
      { lat: 0.005, lon: 0 },
      { lat: 0.005, lon: 0.02 },
      { lat: -0.005, lon: 0.02 },
    ];
    const pace = legPace(base, east, [tilted(0)], [field]);
    expect(pace.slow).toBeCloseTo(0.5 + 0.5 / SAND_PACE, 1);
  });

  it('counts ground without heights as flat, and says how much that was', () => {
    const outside = { lat: 0, lon: 0.06 };
    const pace = legPace(base, outside, [tilted(0.2)]);
    expect(pace.covered).toBeLessThan(0.6);
    expect(pace.slow).toBeLessThan(legPace(base, east, [tilted(0.2)]).slow);
    expect(legPace(base, east, []).slow).toBeCloseTo(1, 9);
    expect(legPace(base, east, []).covered).toBe(0);
  });

  it('is nothing for a leg of no length', () => {
    expect(legPace(base, base, [tilted(0.3)])).toEqual({ slow: 1, covered: 1 });
  });
});

describe('a plan with the pace of its legs', () => {
  const stop: WalkStop = { ...east, minutes: 30, name: 'Outcrop' };
  // Steep enough that the way down is slowed too: a gentle descent costs no more than the flat.
  const paced = withPaces(base, [stop], [tilted(0.3)]);

  it('keeps the stop as it was and adds how much each way is slowed', () => {
    expect(paced[0]).toMatchObject({ lat: east.lat, lon: east.lon, minutes: 30, name: 'Outcrop' });
    expect(paced[0].slow).toBeGreaterThan(1.3);
    expect(paced[0].slowBack).toBeGreaterThan(1);
    expect(legSlow(paced, 0)).toBe(paced[0].slow);
    expect(legSlow(paced, 1)).toBe(paced[0].slowBack);
  });

  it('is the same list when nothing changes, and plain on flat ground', () => {
    expect(withPaces(base, paced, [tilted(0.3)])).toBe(paced);
    const flat = withPaces(base, paced, [tilted(0)]);
    expect(flat[0].slow).toBeUndefined();
    expect(flat[0].slowBack).toBeUndefined();
    expect(withPaces(base, flat, [tilted(0)])).toBe(flat);
  });

  it('takes longer and uses more life support than the same distance on the flat', () => {
    const flat = evaluateWalk(base, [stop], 0.64);
    const steep = evaluateWalk(base, paced, 0.64);
    expect(steep.totalM).toBe(flat.totalM);
    expect(steep.walkingHours).toBeGreaterThan(flat.walkingHours);
    expect(steep.slowedHours).toBeCloseTo(steep.walkingHours - flat.walkingHours, 9);
    expect(flat.slowedHours).toBe(0);
    expect(steep.lifeSupportUsed).toBeGreaterThan(flat.lifeSupportUsed);
    expect(steep.doseMsv).toBeGreaterThan(flat.doseMsv);
  });

  it('times the walk in progress, its clock and its log the same way', () => {
    const outHours = (distance(base, east) / speed) * (paced[0].slow ?? 1);
    const total = evaluateWalk(base, paced, 0.64).durationHours;
    // Half way through the first leg in time is half way along it.
    const mid = walkProgress(base, paced, outHours / 2, 0.64);
    expect(mid.phase).toBe('walking');
    expect(mid.walkedM).toBeCloseTo(distance(base, east) / 2, 0);
    expect(mid.totalHours).toBeCloseTo(total, 9);
    expect(walkProgress(base, paced, outHours + 0.01, 0.64).phase).toBe('working');
    expect(walkHoursPlayed(base, paced, outHours / 2)).toBeCloseTo(outHours / 2, 9);
    const log = walkLog(base, paced, total + 1, { doseRateMsvPerDay: 0.64 });
    expect(log.find((entry) => entry.kind === 'waypoint-reached')?.atHours).toBeCloseTo(outHours, 6);
    expect(log.find((entry) => entry.kind === 'back-at-base')?.atHours).toBeCloseTo(total, 6);
  });

  it('keeps the clock where it was when the walk turns back on a slowed leg', () => {
    const far: WalkStop = { ...destination(east, 0, 400), slow: 1.5 };
    const route = [paced[0], far];
    const outHours = (distance(base, east) / speed) * (paced[0].slow ?? 1);
    const elapsed = outHours + 0.5 + ((distance(east, far) / speed) * 1.5) / 2;
    const before = walkProgress(base, route, elapsed, 0.64);
    const plan = returnPlan(base, route, elapsed);
    const after = walkProgress(base, plan, elapsed, 0.64);
    expect(distance(before.position, after.position)).toBeLessThan(0.5);
    expect(after.phase).toBe('returning');
    expect(plan[1].slow).toBe(1.5);
    expect(plan[1].slowBack).toBeUndefined();
  });
});
