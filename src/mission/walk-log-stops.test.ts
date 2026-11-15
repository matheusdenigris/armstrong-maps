import { describe, expect, it } from 'vitest';

import { destination } from './geo';
import { walkProgress } from './progress';
import { walkLog } from './walk-log';
import { WALK_ASSUMPTIONS, type WalkStop } from './walk';

const base = { lat: -4.589467, lon: 137.441633 };
const options = { doseRateMsvPerDay: 0.64 };
const speed = WALK_ASSUMPTIONS.walkingSpeedKmh * 1000;

describe('the record of a walk whose stops have their own times', () => {
  const first: WalkStop = { ...destination(base, 0, 1000), minutes: 45 };
  const through: WalkStop = { ...destination(base, 0, 1500), minutes: 0 };
  const route = [first, through];
  const total = walkProgress(base, route, 0, 0.64).totalHours;
  const log = walkLog(base, route, total + 1, options);

  it('ends the work at a stop after the time the plan gives it', () => {
    const reached = log.find((entry) => entry.kind === 'waypoint-reached' && entry.stop === 0);
    const done = log.find((entry) => entry.kind === 'work-done' && entry.stop === 0);
    expect(reached?.atHours).toBeCloseTo(1000 / speed, 6);
    expect((done?.atHours ?? 0) - (reached?.atHours ?? 0)).toBeCloseTo(45 / 60, 6);
  });

  it('has no work to finish at a point the walk only passes through', () => {
    expect(log.some((entry) => entry.kind === 'waypoint-reached' && entry.stop === 1)).toBe(true);
    expect(log.some((entry) => entry.kind === 'work-done' && entry.stop === 1)).toBe(false);
  });

  it('is back at the base when the plan says so', () => {
    const back = log.find((entry) => entry.kind === 'back-at-base');
    expect(back?.atHours).toBeCloseTo(total, 6);
    expect(total).toBeCloseTo(3000 / speed + 45 / 60, 6);
  });
});
