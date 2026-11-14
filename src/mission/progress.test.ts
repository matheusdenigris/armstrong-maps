import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RATE,
  elapsedSeconds,
  pauseClock,
  resumeClock,
  startClock,
  withRate,
} from './clock';
import { destination, distance } from './geo';
import { walkProgress } from './progress';
import { evaluateWalk } from './walk';

const BASE = { lat: -4.589467, lon: 137.441633 };
const DOSE_RATE = 0.64;
// 1 km east, then 1 km north of that. At 2.5 km/h a kilometre takes 0.4 h; a stop takes 1/3 h.
const FIRST = destination(BASE, 90, 1000);
const SECOND = destination(FIRST, 0, 1000);
const ROUTE = [FIRST, SECOND];

const at = (hours: number) => walkProgress(BASE, ROUTE, hours, DOSE_RATE);

describe('walkProgress', () => {
  it('starts at the base, facing the first waypoint', () => {
    const start = at(0);
    expect(start.phase).toBe('walking');
    expect(distance(start.position, BASE)).toBeCloseTo(0, 6);
    expect(start.heading).toBeCloseTo(90, 1);
    expect(start.stop).toBe(0);
    expect(start.distanceToTargetM).toBeCloseTo(1000, 3);
  });

  it('is half way along the first leg after half its time', () => {
    const half = at(0.2);
    expect(half.phase).toBe('walking');
    expect(half.walkedM).toBeCloseTo(500, 3);
    expect(distance(BASE, half.position)).toBeCloseTo(500, 3);
    expect(half.distanceToTargetM).toBeCloseTo(500, 3);
    expect(half.distanceToBaseM).toBeCloseTo(500, 3);
  });

  it('stops at a waypoint and already faces the next leg', () => {
    const working = at(0.4 + 0.1);
    expect(working.phase).toBe('working');
    expect(working.stop).toBe(0);
    expect(distance(working.position, FIRST)).toBeCloseTo(0, 6);
    expect(working.heading).toBeCloseTo(0, 1);
    expect(working.walkedM).toBeCloseTo(1000, 3);
    expect(working.distanceToTargetM).toBeCloseTo(1000, 3);
  });

  it('counts down the leg and the work, and counts the stops done', () => {
    expect(at(0.1).phaseHoursLeft).toBeCloseTo(0.3, 6);
    expect(at(0.1).stopsDone).toBe(0);
    // A stop is 20 minutes; five minutes in, fifteen are left.
    expect(at(0.4 + 5 / 60).phaseHoursLeft).toBeCloseTo(15 / 60, 6);
    expect(at(0.4 + 5 / 60).stopsDone).toBe(0);
    expect(at(0.4 + 1 / 3 + 0.1).stopsDone).toBe(1);
    expect(at(0.8 + 2 / 3 + 0.01).stopsDone).toBe(2);
    expect(at(99).stopsDone).toBe(2);
    expect(at(99).phaseHoursLeft).toBe(0);
  });

  it('walks the second leg after the stop', () => {
    const second = at(0.4 + 1 / 3 + 0.2);
    expect(second.phase).toBe('walking');
    expect(second.stop).toBe(1);
    expect(second.walkedM).toBeCloseTo(1500, 3);
  });

  it('returns straight to the base after the last stop', () => {
    const leaving = at(0.8 + 2 / 3 + 0.01);
    expect(leaving.phase).toBe('returning');
    expect(leaving.stop).toBeNull();
    expect(distance(leaving.target, BASE)).toBeCloseTo(0, 6);
    // South-west, back towards the base.
    expect(leaving.heading).toBeGreaterThan(180);
    expect(leaving.heading).toBeLessThan(270);
  });

  it('agrees with the plan on the total time and ends at the base', () => {
    const plan = evaluateWalk(BASE, ROUTE, DOSE_RATE);
    const end = at(plan.durationHours + 5);
    expect(end.totalHours).toBeCloseTo(plan.durationHours, 9);
    expect(end.phase).toBe('at-base');
    expect(end.elapsedHours).toBeCloseTo(plan.durationHours, 9);
    expect(end.walkedM).toBeCloseTo(plan.totalM, 3);
    expect(end.doseMsv).toBeCloseTo(plan.doseMsv, 9);
    expect(end.lifeSupportUsed).toBeCloseTo(plan.lifeSupportUsed, 9);
  });

  it('never moves backwards or jumps', () => {
    const plan = evaluateWalk(BASE, ROUTE, DOSE_RATE);
    let walked = -1;
    let previous = at(0).position;
    for (let step = 0; step <= 200; step += 1) {
      const now = at((plan.durationHours * step) / 200);
      expect(now.walkedM).toBeGreaterThanOrEqual(walked);
      // A two-hundredth of this walk is at most about 23 m of walking.
      expect(distance(previous, now.position)).toBeLessThan(30);
      walked = now.walkedM;
      previous = now.position;
    }
  });

  it('stays at the base without waypoints', () => {
    const idle = walkProgress(BASE, [], 3, DOSE_RATE);
    expect(idle.phase).toBe('at-base');
    expect(idle.totalHours).toBe(0);
    expect(idle.doseMsv).toBe(0);
  });

  it('treats a negative time as the start', () => {
    expect(at(-2).walkedM).toBe(0);
  });
});

describe('the walk clock', () => {
  const T0 = 1_800_000_000_000;

  it('plays walk time at its rate', () => {
    expect(startClock(T0).rate).toBe(DEFAULT_RATE);
    const clock = startClock(T0, 60);
    expect(elapsedSeconds(clock, T0)).toBe(0);
    expect(elapsedSeconds(clock, T0 + 10_000)).toBe(600);
  });

  it('holds still while paused and carries on after', () => {
    const paused = pauseClock(startClock(T0, 60), T0 + 10_000);
    expect(elapsedSeconds(paused, T0 + 99_000)).toBe(600);
    const resumed = resumeClock(paused, T0 + 100_000);
    expect(elapsedSeconds(resumed, T0 + 101_000)).toBe(660);
  });

  it('changes speed without losing the time already passed', () => {
    const faster = withRate(startClock(T0, 60), 600, T0 + 10_000);
    expect(elapsedSeconds(faster, T0 + 10_000)).toBe(600);
    expect(elapsedSeconds(faster, T0 + 11_000)).toBe(1200);
  });

  it('does not run backwards when the device clock steps back', () => {
    expect(elapsedSeconds(startClock(T0), T0 - 5_000)).toBe(0);
  });

  it('gives the same answer in two tabs', () => {
    const saved = JSON.parse(JSON.stringify(startClock(T0, 60)));
    expect(elapsedSeconds(saved, T0 + 30_000)).toBe(elapsedSeconds(startClock(T0, 60), T0 + 30_000));
  });
});
