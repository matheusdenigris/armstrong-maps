import { describe, expect, it } from 'vitest';

import { destination } from './geo';
import { WALK_ASSUMPTIONS, evaluateWalk } from './walk';

const BASE = { lat: -4.589467, lon: 137.441633 };
const DOSE_RATE = 0.64;

/** A waypoint `metres` from the base on a given bearing. */
const at = (metres: number, bearing = 90) => destination(BASE, bearing, metres);

describe('evaluateWalk', () => {
  it('is an empty go without waypoints', () => {
    const walk = evaluateWalk(BASE, [], DOSE_RATE);
    expect(walk.totalM).toBe(0);
    expect(walk.durationHours).toBe(0);
    expect(walk.doseMsv).toBe(0);
    expect(walk.verdict).toBe('go');
    expect(walk.reasons).toEqual([]);
  });

  it('goes out through the waypoints and straight back', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE);
    expect(walk.outboundM).toBeCloseTo(1000, 3);
    expect(walk.returnM).toBeCloseTo(1000, 3);
    expect(walk.totalM).toBeCloseTo(2000, 3);
    expect(walk.farthestM).toBeCloseTo(1000, 3);
  });

  it('adds walking time and time at the stops', () => {
    // 2 km at 2.5 km/h is 0.8 h; one stop of 20 min is a third of an hour.
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE);
    expect(walk.walkingHours).toBeCloseTo(0.8, 6);
    expect(walk.stopHours).toBeCloseTo(1 / 3, 6);
    expect(walk.durationHours).toBeCloseTo(0.8 + 1 / 3, 6);
    expect(walk.lifeSupportUsed).toBeCloseTo((0.8 + 1 / 3) / 8, 6);
    expect(walk.verdict).toBe('go');
  });

  it('scales the dose with the time outside', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE);
    expect(walk.doseMsv).toBeCloseTo((DOSE_RATE * walk.durationHours) / 24, 9);
    const twice = evaluateWalk(BASE, [at(1000)], DOSE_RATE * 2);
    expect(twice.doseMsv).toBeCloseTo(walk.doseMsv * 2, 9);
  });

  it('measures the farthest waypoint, not the last one', () => {
    const walk = evaluateWalk(BASE, [at(3000), at(500)], DOSE_RATE);
    expect(walk.farthestM).toBeCloseTo(3000, 3);
  });

  it('warns near the walk-back limit', () => {
    const walk = evaluateWalk(BASE, [at(4200)], DOSE_RATE);
    expect(walk.verdict).toBe('caution');
    expect(walk.reasons).toEqual(['near-walk-back-limit']);
  });

  it('refuses a waypoint beyond the walk-back limit', () => {
    const walk = evaluateWalk(BASE, [at(5200)], DOSE_RATE);
    expect(walk.verdict).toBe('no-go');
    expect(walk.reasons).toContain('beyond-walk-back-limit');
  });

  it('warns when the walk eats into the reserve', () => {
    // Stops only: 20 stops of 20 min next to the base are 6 h 40 min, past 80 % of 8 h.
    const stops = Array.from({ length: 20 }, (_, index) => at(1 + index * 0.01));
    const walk = evaluateWalk(BASE, stops, DOSE_RATE);
    expect(walk.lifeSupportUsed).toBeGreaterThan(0.8);
    expect(walk.lifeSupportUsed).toBeLessThan(1);
    expect(walk.verdict).toBe('caution');
    expect(walk.reasons).toEqual(['into-reserve']);
  });

  it('refuses a route over ground steeper than the no-go slope', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE, WALK_ASSUMPTIONS, { maxSlopeDeg: 27 });
    expect(walk.verdict).toBe('no-go');
    expect(walk.reasons).toEqual(['too-steep']);
  });

  it('warns about steep ground and dune fields', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE, WALK_ASSUMPTIONS, {
      maxSlopeDeg: 18,
      crossesDunes: true,
    });
    expect(walk.verdict).toBe('caution');
    expect(walk.reasons).toEqual(['steep-ground', 'dune-field']);
  });

  it('says nothing about the ground when the model has not answered', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE, WALK_ASSUMPTIONS, { maxSlopeDeg: null });
    expect(walk.reasons).toEqual([]);
    expect(evaluateWalk(BASE, [], DOSE_RATE, WALK_ASSUMPTIONS, { maxSlopeDeg: 40 }).verdict).toBe('go');
  });

  it('adds a caution when a CME is at Mars', () => {
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE, WALK_ASSUMPTIONS, { cmeAtMars: true });
    expect(walk.verdict).toBe('caution');
    expect(walk.reasons).toEqual(['cme-at-mars']);
  });

  it('ignores space weather until there is a walk', () => {
    const walk = evaluateWalk(BASE, [], DOSE_RATE, WALK_ASSUMPTIONS, { cmeAtMars: true });
    expect(walk.verdict).toBe('go');
  });

  it('keeps a no-go when a CME is also at Mars', () => {
    const walk = evaluateWalk(BASE, [at(5200)], DOSE_RATE, WALK_ASSUMPTIONS, { cmeAtMars: true });
    expect(walk.verdict).toBe('no-go');
    expect(walk.reasons).toEqual(['beyond-walk-back-limit', 'cme-at-mars']);
  });

  it('refuses a walk longer than the life support', () => {
    const stops = Array.from({ length: 25 }, (_, index) => at(1 + index * 0.01));
    const walk = evaluateWalk(BASE, stops, DOSE_RATE);
    expect(walk.lifeSupportUsed).toBeGreaterThan(1);
    expect(walk.verdict).toBe('no-go');
    expect(walk.reasons).toEqual(['life-support-exceeded']);
  });

  it('keeps every reason and lets the worst one decide', () => {
    const far = Array.from({ length: 22 }, (_, index) => at(4500, index));
    const walk = evaluateWalk(BASE, far, DOSE_RATE);
    expect(walk.reasons).toContain('near-walk-back-limit');
    expect(walk.reasons).toContain('life-support-exceeded');
    expect(walk.verdict).toBe('no-go');
  });

  it('follows the assumptions it is given', () => {
    const brisk = { ...WALK_ASSUMPTIONS, walkingSpeedKmh: 5, minutesPerStop: 0 };
    const walk = evaluateWalk(BASE, [at(1000)], DOSE_RATE, brisk);
    expect(walk.durationHours).toBeCloseTo(0.4, 6);
  });
});
