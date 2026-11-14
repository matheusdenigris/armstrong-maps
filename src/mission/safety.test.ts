import { describe, expect, it } from 'vitest';

import { destination } from './geo';
import { walkProgress } from './progress';
import { LOW_MARGIN_HOURS, alertLevel, walkSafety } from './safety';
import { WALK_ASSUMPTIONS } from './walk';

const BASE = { lat: -4.589467, lon: 137.441633 };
const DOSE_RATE = 0.64;
const east = (metres: number) => destination(BASE, 90, metres);

/** The safety picture `hours` into a walk through `route`. */
const at = (route: ReturnType<typeof east>[], hours: number, assumptions = WALK_ASSUMPTIONS) =>
  walkSafety(walkProgress(BASE, route, hours, DOSE_RATE, assumptions), assumptions);

describe('walkSafety', () => {
  it('is nominal at the start of a short walk', () => {
    const safety = at([east(1000)], 0);
    expect(safety.hoursLeft).toBeCloseTo(8, 9);
    expect(safety.reserveHours).toBeCloseTo(1.6, 9);
    expect(safety.returnHours).toBeCloseTo(0, 6);
    expect(safety.marginHours).toBeCloseTo(6.4, 6);
    expect(safety.level).toBe('nominal');
    expect(safety.alerts).toEqual([]);
  });

  it('counts the way back at walking speed', () => {
    // 1 km out at 2.5 km/h takes 0.4 h, and so does the way back.
    const safety = at([east(1000)], 0.4);
    expect(safety.returnHours).toBeCloseTo(0.4, 4);
    expect(safety.hoursLeft).toBeCloseTo(7.6, 6);
    expect(safety.marginHours).toBeCloseTo(7.6 - 1.6 - 0.4, 4);
  });

  it('cautions near the walk-back limit and warns beyond it', () => {
    const route = [east(6000)];
    // 4.2 km out: past 80 % of 5 km.
    const near = at(route, 4.2 / 2.5);
    expect(near.alerts).toContain('near-walk-back-limit');
    expect(near.level).toBe('caution');
    // 5.5 km out.
    const beyond = at(route, 5.5 / 2.5);
    expect(beyond.alerts).toContain('beyond-walk-back-limit');
    expect(beyond.alerts).not.toContain('near-walk-back-limit');
    expect(beyond.level).toBe('warning');
  });

  it('cautions when little time is left before the turn-back point', () => {
    // A suit with 2 h and no reserve, 2 km out and back: at 1.9 km the way back takes 0.76 h and
    // 1.24 h are left, so 0.48 h to spare.
    const short = { ...WALK_ASSUMPTIONS, lifeSupportHours: 2, reserveFraction: 0, minutesPerStop: 0 };
    const safety = at([east(2000)], 1.9 / 2.5, short);
    expect(safety.marginHours).toBeGreaterThan(0);
    expect(safety.marginHours).toBeLessThan(LOW_MARGIN_HOURS);
    expect(safety.alerts).toEqual(['return-margin-low']);
    expect(safety.level).toBe('caution');
  });

  it('says to turn back when the way home would eat the reserve', () => {
    // 2 h of life support with a 20 % reserve: 1.6 h usable. 2.2 km out takes 0.88 h each way.
    const tight = { ...WALK_ASSUMPTIONS, lifeSupportHours: 2, minutesPerStop: 0 };
    const safety = at([east(4000)], 2.2 / 2.5, tight);
    expect(safety.marginHours).toBeLessThanOrEqual(0);
    expect(safety.alerts[0]).toBe('turn-back-now');
    expect(safety.level).toBe('warning');
  });

  it('reports the reserve, then the end of life support', () => {
    // Working for ten hours at a waypoint 100 m from the base.
    const idle = { ...WALK_ASSUMPTIONS, minutesPerStop: 600 };
    const reserve = at([east(100)], 7, idle);
    expect(reserve.hoursLeft).toBeCloseTo(1, 6);
    expect(reserve.alerts).toContain('life-support-reserve');

    const spent = at([east(100)], 9, idle);
    expect(spent.hoursLeft).toBe(0);
    expect(spent.alerts[0]).toBe('life-support-exhausted');
    expect(spent.alerts).not.toContain('life-support-reserve');
    expect(spent.level).toBe('warning');
  });

  it('does not ask an astronaut who is at the base to turn back', () => {
    const idle = { ...WALK_ASSUMPTIONS, minutesPerStop: 600 };
    const home = walkSafety(walkProgress(BASE, [], 0, DOSE_RATE, idle), idle);
    expect(home.alerts).toEqual([]);
  });

  it('puts warnings ahead of cautions', () => {
    const tight = { ...WALK_ASSUMPTIONS, lifeSupportHours: 2, minutesPerStop: 0 };
    const safety = at([east(4000)], 2.2 / 2.5, tight);
    const levels = safety.alerts.map(alertLevel);
    const firstCaution = levels.indexOf('caution');
    const lastWarning = levels.lastIndexOf('warning');
    if (firstCaution !== -1) expect(lastWarning).toBeLessThan(firstCaution);
  });
});
