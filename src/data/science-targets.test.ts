import { describe, expect, it } from 'vitest';

import { METRES_PER_DEGREE, distance } from '@/mission/geo';
import { VIA_NAME, rerouteWalk } from '@/mission/reroute';
import { routeSlope, type SlopeGrid } from '@/mission/terrain';

import { POINT_SETS, SAMPLE_DEPOT, SITE_POINT_SETS } from './mission-points';
import { parseRoverTrack, positionOnSol } from './rover';
import { GALE_TARGETS, galeTargetPoints, stopAt, suggestedTask } from './science-targets';
import { SITES } from './sites';

/** A feed with the shape of NASA's: where the rover stopped after each drive. */
const feed = (stops: [sol: number, lat: number, lon: number][]) => ({
  features: stops.map(([sol, lat, lon]) => ({ properties: { sol, lat, lon, dist_km: 0 } })),
});

describe('where the rover stood on a sol', () => {
  const track = parseRoverTrack(
    feed([
      [3, -4.5895, 137.4417],
      [59, -4.59, 137.4483],
      [166, -4.5895, 137.4491],
      [392, -4.6071, 137.4263],
    ]),
  );

  it('is the end of its last drive on or before that sol', () => {
    expect(positionOnSol(track, 59)).toEqual({ lat: -4.59, lon: 137.4483 });
    expect(positionOnSol(track, 60)).toEqual({ lat: -4.59, lon: 137.4483 });
    expect(positionOnSol(track, 182)).toEqual({ lat: -4.5895, lon: 137.4491 });
    expect(positionOnSol(track, 5000)).toEqual({ lat: -4.6071, lon: 137.4263 });
  });

  it('is unknown before the first waypoint', () => {
    expect(positionOnSol(track, 1)).toBeNull();
    expect(positionOnSol(parseRoverTrack(null), 100)).toBeNull();
  });
});

describe('the science targets of Gale', () => {
  it('each name a NASA page, a sol and a task', () => {
    expect(GALE_TARGETS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(GALE_TARGETS.map((target) => target.id)).size).toBe(GALE_TARGETS.length);
    for (const target of GALE_TARGETS) {
      expect(target.reference).toMatch(/^https:\/\/([a-z]+\.)*nasa\.gov\//);
      expect(target.source.length).toBeGreaterThan(10);
      expect(target.sol).toBeGreaterThan(0);
      expect(target.what.length).toBeGreaterThan(10);
      expect(target.task.length).toBeGreaterThan(10);
    }
  });

  it('are placed by the location feed, not by hand', () => {
    const track = parseRoverTrack(
      feed([
        [59, -4.59, 137.4483],
        [166, -4.5895, 137.4491],
      ]),
    );
    const points = galeTargetPoints(track);
    // The feed above ends before Darwin: every target takes the last place it knows by its sol.
    expect(points.find((point) => point.id === 'target-rocknest')?.point).toEqual({
      lat: -4.59,
      lon: 137.4483,
    });
    expect(points.find((point) => point.id === 'target-john-klein')?.point).toEqual({
      lat: -4.5895,
      lon: 137.4491,
    });
    // With no feed there is no position, and so no mark.
    expect(galeTargetPoints(parseRoverTrack(null))).toEqual([]);
  });

  it('are a set of mission points of the site', () => {
    expect(SITE_POINT_SETS.gale).toContain('targets');
    expect(POINT_SETS.targets.source).toContain('NASA');
    expect(SITES.some((site) => site.id === 'gale')).toBe(true);
  });
});

describe('a published place as a stop of the walk', () => {
  it('keeps its name, takes a task and says where it comes from', () => {
    const tube = SAMPLE_DEPOT[0];
    const stop = stopAt(tube, POINT_SETS.depot);
    expect(stop.lat).toBe(tube.point.lat);
    expect(stop.lon).toBe(tube.point.lon);
    expect(stop.name).toBe(tube.name);
    expect(stop.task).toBe(suggestedTask(tube));
    expect(stop.source).toBe(POINT_SETS.depot.source);
    // The time is left to the assumed one until the crew sets it.
    expect(stop.minutes).toBeUndefined();
  });

  it('takes the task and the source of the target itself when it has them', () => {
    const track = parseRoverTrack(feed([[166, -4.5895, 137.4491]]));
    const klein = galeTargetPoints(track).find((point) => point.id === 'target-john-klein');
    expect(klein).toBeDefined();
    if (!klein) return;
    const stop = stopAt(klein, POINT_SETS.targets);
    expect(stop.task).toBe(GALE_TARGETS.find((target) => target.id === 'john-klein')?.task);
    expect(stop.source).toContain('PIA20845');
  });
});

describe('a plan put round steep ground', () => {
  const CELL = 0.001;
  const SIZE = 21;
  const limits = { cautionDeg: 15, noGoDeg: 25 };
  const half = (SIZE * CELL) / 2;
  const cell = (col: number, row: number) => ({
    lat: half - (row + 0.5) * CELL,
    lon: -half + (col + 0.5) * CELL,
  });
  // A wall across the middle column, open at the two bottom rows.
  const degrees = new Float32Array(SIZE * SIZE).fill(2);
  for (let row = 0; row < 19; row += 1) degrees[row * SIZE + 10] = 40;
  const grid: SlopeGrid = {
    bounds: { west: -half, east: half, south: -half, north: half },
    width: SIZE,
    height: SIZE,
    degrees,
    cellM: CELL * METRES_PER_DEGREE,
  };
  const base = cell(2, 10);
  const stop = { ...cell(18, 10), name: 'Outcrop', minutes: 30, task: 'Collect a rock' };

  it('adds points to pass through on the way out and on the way back, and keeps the stop', () => {
    const found = rerouteWalk(base, [stop], [grid], limits, 24);
    expect(found.blocked).toBe(0);
    expect(found.added).toBeGreaterThan(0);
    expect(found.stops.filter((entry) => entry.name === 'Outcrop')).toEqual([stop]);
    const via = found.stops.filter((entry) => entry.name === VIA_NAME);
    expect(via).toHaveLength(found.added);
    expect(via.every((entry) => entry.minutes === 0)).toBe(true);
    // Points on both sides of the stop: the way back is put round the wall too.
    const at = found.stops.findIndex((entry) => entry.name === 'Outcrop');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(found.stops.length - 1);
    const loop = [base, ...found.stops, base];
    expect(routeSlope(loop, [grid]).maxDeg).toBeLessThan(limits.cautionDeg);
    expect(distance(base, found.stops[0])).toBeGreaterThan(0);
  });

  it('leaves a clear plan as it is', () => {
    const near = { ...cell(6, 10) };
    const found = rerouteWalk(base, [near], [grid], limits, 24);
    expect(found).toEqual({ stops: [near], added: 0, blocked: 0, full: 0 });
  });

  it('says so when there is no way round, or no room for it', () => {
    const closed = { ...grid, degrees: new Float32Array(degrees) };
    for (let row = 0; row < SIZE; row += 1) closed.degrees[row * SIZE + 10] = 40;
    const none = rerouteWalk(base, [stop], [closed], limits, 24);
    expect(none.added).toBe(0);
    expect(none.blocked).toBe(2);
    expect(none.stops).toEqual([stop]);

    const tight = rerouteWalk(base, [stop], [grid], limits, 1);
    expect(tight.added).toBe(0);
    expect(tight.full).toBe(2);
    expect(tight.stops).toEqual([stop]);
  });
});
