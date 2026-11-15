import { describe, expect, it } from 'vitest';

import { destination, distance } from './geo';
import { TURN_BACK_NAME, returnPlan, walkHoursPlayed, walkProgress } from './progress';
import { MAX_STOP_MINUTES, WALK_ASSUMPTIONS, evaluateWalk, stopMinutes, type WalkStop } from './walk';

const base = { lat: 0, lon: 0 };
/** A point `metres` east of the base. */
const east = (metres: number, more: Partial<WalkStop> = {}): WalkStop => ({
  ...destination(base, 90, metres),
  ...more,
});
const speed = WALK_ASSUMPTIONS.walkingSpeedKmh * 1000;

describe('the time of a stop', () => {
  it('is the assumed time when the stop has none of its own', () => {
    expect(stopMinutes(east(100))).toBe(WALK_ASSUMPTIONS.minutesPerStop);
  });

  it('is its own time, kept between nothing and the longest stop', () => {
    expect(stopMinutes(east(100, { minutes: 45 }))).toBe(45);
    expect(stopMinutes(east(100, { minutes: 0 }))).toBe(0);
    expect(stopMinutes(east(100, { minutes: -5 }))).toBe(0);
    expect(stopMinutes(east(100, { minutes: 9999 }))).toBe(MAX_STOP_MINUTES);
    expect(stopMinutes(east(100, { minutes: Number.NaN }))).toBe(WALK_ASSUMPTIONS.minutesPerStop);
  });

  it('counts against life support in the plan', () => {
    const short = evaluateWalk(base, [east(1000, { minutes: 10 })], 0.64);
    const long = evaluateWalk(base, [east(1000, { minutes: 70 })], 0.64);
    expect(short.stopHours).toBeCloseTo(10 / 60, 9);
    expect(long.stopHours).toBeCloseTo(70 / 60, 9);
    expect(long.durationHours - short.durationHours).toBeCloseTo(1, 9);
    expect(long.lifeSupportUsed).toBeGreaterThan(short.lifeSupportUsed);
    expect(long.walkingHours).toBeCloseTo(short.walkingHours, 9);
  });

  it('can turn a go into a caution', () => {
    const quick = evaluateWalk(base, [east(3500, { minutes: 20 })], 0.64);
    const slow = evaluateWalk(base, [east(3500, { minutes: 240 })], 0.64);
    expect(quick.verdict).toBe('go');
    expect(slow.reasons).toContain('into-reserve');
  });

  it('is what the walk in progress waits at each stop', () => {
    const route = [east(500, { minutes: 30 }), east(1000, { minutes: 0 })];
    const legHours = 500 / speed;
    // Ten minutes into the work at the first stop.
    const working = walkProgress(base, route, legHours + 10 / 60, 0.64);
    expect(working.phase).toBe('working');
    expect(working.stop).toBe(0);
    expect(working.phaseHoursLeft).toBeCloseTo(20 / 60, 9);
    // The second point has no work: the walk passes through it and turns for the base.
    const after = walkProgress(base, route, legHours * 2 + 30 / 60 + 0.01, 0.64);
    expect(after.phase).toBe('returning');
    expect(after.totalHours).toBeCloseTo(legHours * 2 + 30 / 60 + 1000 / speed, 9);
  });

  it('is played faster than the walking, by its own length', () => {
    const route = [east(500, { minutes: 30 })];
    const legHours = 500 / speed;
    // The whole stop takes 30 / 15 = 2 minutes of the clock.
    expect(walkHoursPlayed(base, route, legHours + 1 / 60)).toBeCloseTo(legHours + 15 / 60, 9);
    expect(walkHoursPlayed(base, route, legHours + 2 / 60 + 0.1)).toBeCloseTo(
      legHours + 30 / 60 + 0.1,
      9,
    );
  });
});

describe('returning to the base', () => {
  const route = [east(1000), east(2000), east(3000)];
  const leg = 1000 / speed;
  const stop = WALK_ASSUMPTIONS.minutesPerStop / 60;

  it('turns back from where the astronaut is on the way to a waypoint', () => {
    // Half way from the first waypoint to the second.
    const elapsed = leg + stop + leg / 2;
    const plan = returnPlan(base, route, elapsed);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual(route[0]);
    expect(plan[1].name).toBe(TURN_BACK_NAME);
    expect(plan[1].minutes).toBe(0);
    expect(distance(base, plan[1])).toBeCloseTo(1500, 0);
  });

  it('keeps the astronaut where they are at this moment, and shortens what is left', () => {
    const elapsed = leg + stop + leg / 2;
    const before = walkProgress(base, route, elapsed, 0.64);
    const plan = returnPlan(base, route, elapsed);
    const after = walkProgress(base, plan, elapsed, 0.64);
    expect(distance(before.position, after.position)).toBeLessThan(0.01);
    expect(after.elapsedHours).toBeCloseTo(before.elapsedHours, 9);
    expect(after.phase).toBe('returning');
    // The way back is 1.5 km instead of 1.5 km out, two stops and 3 km home.
    expect(after.distanceToTargetM).toBeCloseTo(1500, 0);
    expect(after.totalHours - elapsed).toBeCloseTo(1500 / speed, 6);
    expect(after.totalHours).toBeLessThan(before.totalHours);
    // The clock of the walk reads the same before and after.
    expect(walkHoursPlayed(base, plan, 0.5)).toBeCloseTo(walkHoursPlayed(base, route, 0.5), 9);
  });

  it('ends the work at a stop and leaves from it', () => {
    // Five minutes into the work at the second waypoint.
    const elapsed = leg * 2 + stop + 5 / 60;
    const plan = returnPlan(base, route, elapsed);
    expect(plan).toHaveLength(2);
    expect(plan[1].lat).toBe(route[1].lat);
    expect(plan[1].minutes).toBeCloseTo(5, 6);
    const after = walkProgress(base, plan, elapsed + 0.001, 0.64);
    expect(after.phase).toBe('returning');
    expect(after.distanceToBaseM).toBeLessThan(2000);
  });

  it('changes nothing on the way back or at the base', () => {
    const total = evaluateWalk(base, route, 0.64).durationHours;
    expect(returnPlan(base, route, total - 0.1)).toEqual(route);
    expect(returnPlan(base, route, total + 1)).toEqual(route);
    expect(returnPlan(base, [], 1)).toEqual([]);
  });
});
