import { describe, expect, it } from 'vitest';

import {
  formatMarsClock,
  localMeanSolarTime,
  localTrueSolarTime,
  mars24Sun,
  marsTime,
  nextSunCrossing,
  season,
  inDustSeason,
  sunElevation,
  tableSun,
  walkDaylight,
} from './mars-time';

/**
 * The two worked examples of the Mars24 algorithm page (NASA GISS), with the leap-second count
 * they were computed with.
 */
const PAGE_TT_MINUS_UTC = 64.184;

describe('marsTime, against the Mars24 worked examples', () => {
  it('matches the near-coincident midnight of 2000-01-06', () => {
    const time = marsTime(new Date(947116800000), PAGE_TT_MINUS_UTC);
    expect(time.meanAnomaly).toBeCloseTo(21.74558, 4);
    expect(time.equationOfCentre).toBeCloseTo(4.44193, 4);
    expect(time.ls).toBeCloseTo(277.18758, 4);
    expect(time.eot).toBeCloseTo(-5.18774, 4);
    expect(time.mst).toBeCloseTo(23.99425, 4);
    expect(localTrueSolarTime(time, 0)).toBeCloseTo(23.6484, 3);
    expect(time.subsolarLon).toBeCloseTo(-174.726, 3);
    expect(time.declination).toBeCloseTo(-25.22825, 4);
    // Zenith angle 154.26182 degrees at 0 N 0 E.
    expect(sunElevation(time, 0, 0)).toBeCloseTo(90 - 154.26182, 3);
  });

  it('matches the landing of Spirit, at local true midnight', () => {
    const time = marsTime(new Date(1073137591000), PAGE_TT_MINUS_UTC);
    const lonEast = -184.702;
    expect(time.ls).toBeCloseTo(327.32416, 4);
    expect(time.eot).toBeCloseTo(-12.77553, 4);
    expect(time.mst).toBeCloseTo(13.16537, 4);
    expect(localMeanSolarTime(time, lonEast)).toBeCloseTo(0.8519, 3);
    // 00:00:00 true solar time: within a second of midnight, either side.
    const ltst = localTrueSolarTime(time, lonEast);
    expect(Math.min(ltst, 24 - ltst) * 3600).toBeLessThan(2);
    // Within a thousandth of a degree (under 4 arcseconds): the page rounds its intermediate values.
    expect(time.declination).toBeCloseTo(-13.42065, 3);
  });
});

describe('the Sun over a site', () => {
  const gale = { lat: -4.589467, lon: 137.441633 };
  const sun = mars24Sun(gale.lat, gale.lon);

  it('rises and sets about once a sol, about 24.6 h apart', () => {
    const from = new Date(Date.UTC(2026, 10, 14, 0, 0, 0));
    const rise = nextSunCrossing(from, sun, true)!;
    const set = nextSunCrossing(rise, sun, false)!;
    const nextRise = nextSunCrossing(set, sun, true)!;
    expect(sunElevation(marsTime(rise), gale.lat, gale.lon)).toBeCloseTo(0, 2);
    expect((nextRise.getTime() - rise.getTime()) / 3_600_000).toBeCloseTo(24.66, 0);
    // Near the equator a day lasts about half a sol.
    const dayHours = (set.getTime() - rise.getTime()) / 3_600_000;
    expect(dayHours).toBeGreaterThan(11);
    expect(dayHours).toBeLessThan(13.5);
    // Sunrise falls near 06:00 local true solar time.
    const ltst = localTrueSolarTime(marsTime(rise), gale.lon);
    expect(Math.abs(ltst - 6)).toBeLessThan(0.75);
  });

  it('follows the Sun over a walk', () => {
    const from = new Date(Date.UTC(2026, 10, 14, 0, 0, 0));
    const rise = nextSunCrossing(from, sun, true)!;
    const morning = new Date(rise.getTime() + 2 * 3_600_000);
    const short = walkDaylight(morning, 2, sun);
    expect(short.startElevation).toBeGreaterThan(0);
    expect(short.hoursToSpare).toBeGreaterThan(0);
    const long = walkDaylight(morning, 14, sun);
    expect(long.hoursToSpare).toBeLessThan(0);
    expect(long.lowestElevation).toBeLessThan(0);
  });

  it('agrees with NASA/JPL Horizons on the Sun over Gale', () => {
    // Horizons, observer at 137.441633 E -4.589467 on Mars, 2026-11-14 18:00 UT: elevation 35.648734.
    expect(sun(Date.parse('2026-11-14T18:00:00Z'))).toBeCloseTo(35.649, 1);
    // Horizons lists sunset at 20:31 UT, by the upper limb; the centre sets about a minute earlier.
    const set = nextSunCrossing(new Date('2026-11-14T18:00:00Z'), sun, false)!;
    expect(Math.abs(set.getTime() - Date.parse('2026-11-14T20:31:00Z')) / 60_000).toBeLessThan(2);
  });

  it('reads the Sun from a table, and from the fallback outside it', () => {
    const table = tableSun({ times: [0, 600_000], elevations: [10, 20] }, () => -99);
    expect(table(300_000)).toBeCloseTo(15, 9);
    expect(table(900_000)).toBe(-99);
  });

  it('names the season of each hemisphere', () => {
    expect(season(10, 18)).toBe('spring');
    expect(season(10, -4)).toBe('autumn');
    expect(season(277, -4)).toBe('summer');
  });

  it('formats a Mars clock', () => {
    expect(formatMarsClock(23.6484)).toBe('23:38');
    expect(formatMarsClock(24.5)).toBe('00:30');
  });
});

describe('the dust storm season', () => {
  it('is the second half of the Mars year', () => {
    expect(inDustSeason(0)).toBe(false);
    expect(inDustSeason(179.9)).toBe(false);
    expect(inDustSeason(180)).toBe(true);
    expect(inDustSeason(341)).toBe(true);
    expect(inDustSeason(359.9)).toBe(true);
    expect(inDustSeason(360)).toBe(false);
  });

  it('held the global dust storm of 2018', () => {
    // The storm was first seen on 30 May 2018 and covered the planet in June.
    expect(inDustSeason(marsTime(new Date('2018-06-20T00:00:00Z')).ls)).toBe(true);
  });
});
