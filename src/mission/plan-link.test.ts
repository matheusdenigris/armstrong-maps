import { describe, expect, it } from 'vitest';

import { distance } from './geo';
import { decodePlan, encodePlan, samePlan } from './plan-link';
import type { WalkStop } from './walk';

const plan: WalkStop[] = [
  { lat: -4.589483, lon: 137.449129, minutes: 45, name: 'Yellowknife Bay · John Klein', task: 'Photograph the drill hole & the mudstone (100%)', source: 'NASA/JPL-Caltech' },
  { lat: -4.6071123456, lon: 137.4262912345 },
  { lat: -4.6, lon: 137.43, minutes: 0, name: 'Turn-back point' },
];

describe('a plan in a link', () => {
  it('comes back as the same route with the same work', () => {
    const read = decodePlan(encodePlan(plan));
    expect(read).not.toBeNull();
    if (!read) return;
    expect(read).toHaveLength(3);
    read.forEach((stop, index) => {
      // Six decimals: within a few centimetres.
      expect(distance(stop, plan[index])).toBeLessThan(0.1);
      expect(stop.minutes).toBe(plan[index].minutes);
      expect(stop.name).toBe(plan[index].name);
      expect(stop.task).toBe(plan[index].task);
      expect(stop.source).toBe(plan[index].source);
    });
    expect(samePlan(read, plan)).toBe(true);
  });

  it('is made of characters a web address carries as they are', () => {
    expect(encodePlan(plan)).toMatch(/^[A-Za-z0-9._~%\-!'()*]+$/);
  });

  it('keeps a stop without a time apart from a stop of no minutes', () => {
    const read = decodePlan(encodePlan(plan));
    expect(read?.[1].minutes).toBeUndefined();
    expect(read?.[2].minutes).toBe(0);
  });

  it('survives the separators inside a name', () => {
    const odd: WalkStop[] = [{ lat: 1, lon: 2, name: 'a~b_c d', task: 'x_y~z' }];
    const read = decodePlan(encodePlan(odd));
    expect(read?.[0].name).toBe('a~b_c d');
    expect(read?.[0].task).toBe('x_y~z');
  });

  it('is empty for an empty plan', () => {
    expect(encodePlan([])).toBe('');
    expect(decodePlan('')).toBeNull();
    expect(decodePlan(null)).toBeNull();
  });

  it('refuses what it did not write', () => {
    expect(decodePlan('2~1_2')).toBeNull();
    expect(decodePlan('1')).toBeNull();
    expect(decodePlan('1~abc_2')).toBeNull();
    expect(decodePlan('1~95_2')).toBeNull();
    expect(decodePlan('1~1_200')).toBeNull();
    expect(decodePlan('1~1_2_-5')).toBeNull();
    expect(decodePlan('1~1')).toBeNull();
    expect(decodePlan(`1~${Array.from({ length: 25 }, () => '1_2').join('~')}`)).toBeNull();
  });

  it('drops text that is not an address, and keeps the stop', () => {
    expect(decodePlan('1~1_2_10_%E0%A4%A')).toEqual([{ lat: 1, lon: 2, minutes: 10 }]);
  });

  it('tells two different plans apart', () => {
    expect(samePlan(plan, plan.slice(0, 2))).toBe(false);
    expect(samePlan(plan, [{ ...plan[0], minutes: 46 }, plan[1], plan[2]])).toBe(false);
  });
});
