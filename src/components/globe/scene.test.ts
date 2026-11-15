import { describe, expect, it } from 'vitest';

import { SITES } from '@/data/sites';
import { marsTime, sunElevation } from '@/mission/mars-time';

import { toVector } from './scene';

describe('the light of the globe', () => {
  it('stands as high over each site as the Mars clock says the Sun does', () => {
    // The globe lights a point by the angle between its ground and the direction of the Sun.
    for (const date of ['2026-11-14T12:00:00Z', '2027-03-02T05:30:00Z', '2021-02-18T20:55:00Z']) {
      const time = marsTime(new Date(date));
      const sun = toVector({ lat: time.declination, lon: time.subsolarLon });
      for (const site of SITES) {
        const ground = toVector(site.landing);
        const lit = Math.asin(ground.dot(sun)) / (Math.PI / 180);
        const clock = sunElevation(time, site.landing.lat, site.landing.lon);
        expect(lit, `${site.id} at ${date}`).toBeCloseTo(clock, 6);
      }
    }
  });

  it('puts east to the right of a viewer who has north up', () => {
    const here = toVector({ lat: 0, lon: 0 });
    const east = toVector({ lat: 0, lon: 90 });
    const north = toVector({ lat: 90, lon: 0 });
    // Right-handed: north crossed with the direction to the viewer points east.
    expect(north.clone().cross(here).dot(east)).toBeCloseTo(1, 9);
  });
});
