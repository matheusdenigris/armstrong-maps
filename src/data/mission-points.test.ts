import { describe, expect, it } from 'vitest';

import { distance } from '@/mission/geo';

import {
  POINT_SETS,
  SAMPLE_DEPOT,
  SAMPLE_POSITION_FIXES,
  SITE_POINT_SETS,
  parseHelicopterFlights,
  parseSampleSites,
} from './mission-points';
import { SITES, findSite } from './sites';

/** A record shaped like the ones in the NASA sample file. */
const sample = (number: string, name: string, lon: number, lat: number, extra: object = {}) => ({
  type: 'Feature',
  properties: {
    sample_num: number,
    date: 'Sept. 24, 2023',
    sol: '923',
    sample_name: name,
    outcrop_name: 'Hans Amundsen Memorial Workspace',
    sample_location: 'Margin',
    sample_type: 'Rock Core',
    rock_type: 'Sedimentary',
    easting: 4348858.623,
    northing: 1095600.725,
    lon,
    lat,
    ...extra,
  },
  geometry: { type: 'Point', coordinates: [lon, lat] },
});

/** The two records as the file has them: the second repeats the degrees of the first. */
const pelican = sample('22', 'Pelican Point', 77.35065098, 18.48344692);
const lefroy = sample('23', 'Lefroy Bay', 77.35065098, 18.48344692, {
  easting: 4348655.939,
  northing: 1095910.487,
  sol: '942',
  date: 'Oct. 13, 2023',
});

describe('parseSampleSites', () => {
  it('reads the name, the place and the facts of a sample', () => {
    const [point] = parseSampleSites({ features: [pelican] });
    expect(point).toEqual({
      id: 'sample-22',
      set: 'samples',
      point: { lat: 18.48344692, lon: 77.35065098 },
      name: 'Pelican Point',
      lines: [
        'Rock Core · Sedimentary',
        'Outcrop Hans Amundsen Memorial Workspace · Margin',
        'Sample 22 · sol 923 · Sept. 24, 2023',
      ],
    });
  });

  it('keeps a pair of samples as one mark, and says when the sol is not published', () => {
    const [pair, pending] = parseSampleSites({
      features: [
        sample('2 & 3', 'Montdenier + Montagnac', 77.444, 18.43, { sol: '194 & 196', rock_type: 'n/a' }),
        sample('30', 'Gallants', 77.257, 18.46, { sol: 'TBD', date: 'TBD', easting: 1, northing: 2 }),
      ],
    });
    expect(pair.id).toBe('sample-2&3');
    expect(pair.lines[0]).toBe('Rock Core');
    expect(pair.lines).toContain('Sample 2 & 3 · sol 194 & 196 · Sept. 24, 2023');
    expect(pending.lines).toContain('Sample 30 · sol and date not published');
  });

  it('moves a sample that repeats its neighbour to the position NASA prints elsewhere', () => {
    const [first, second] = parseSampleSites({ features: [pelican, lefroy] });
    expect(first.point).toEqual({ lat: 18.48344692, lon: 77.35065098 });
    expect(second.point).toEqual(SAMPLE_POSITION_FIXES['Lefroy Bay']);
    expect(second.lines[second.lines.length - 1]).toMatch(/PDS sample dossier/);
  });

  it('takes the position from the file once the file no longer repeats the neighbour', () => {
    const corrected = sample('23', 'Lefroy Bay', 77.347, 18.4887, { easting: 4348655.939, northing: 1095910.487 });
    const [, second] = parseSampleSites({ features: [pelican, corrected] });
    expect(second.point).toEqual({ lat: 18.4887, lon: 77.347 });
    expect(second.lines.join(' ')).not.toMatch(/dossier/);
  });

  it('leaves out a repeated sample it has no published position for', () => {
    const copy = sample('24', 'Somewhere Else', 77.35065098, 18.48344692, { easting: 1, northing: 2 });
    expect(parseSampleSites({ features: [pelican, copy] })).toHaveLength(1);
  });

  it('skips records without a name or a position, and anything that is not the file', () => {
    expect(
      parseSampleSites({
        features: [sample('1', '', 77.4, 18.4), sample('2', 'No Place', Number.NaN, 18.4), null],
      }),
    ).toEqual([]);
    expect(parseSampleSites(null)).toEqual([]);
    expect(parseSampleSites({ message: 'This page was not found' })).toEqual([]);
  });
});

describe('the correction of Lefroy Bay', () => {
  it('agrees with the easting and northing of its own record', () => {
    // The projection of the Mars 2020 map files: metres on a sphere of 3 396 190 m, with
    // eastings scaled at the latitude of the landing site.
    const metresPerDegree = (3_396_190 * Math.PI) / 180;
    const fromRecord = {
      lat: 1095910.487 / metresPerDegree,
      lon: 4348655.939 / metresPerDegree / Math.cos((18.4663 * Math.PI) / 180),
    };
    expect(distance(fromRecord, SAMPLE_POSITION_FIXES['Lefroy Bay'])).toBeLessThan(2);
    // And it is a different place from the one the file repeats.
    expect(distance(fromRecord, { lat: 18.48344692, lon: 77.35065098 })).toBeGreaterThan(300);
  });
});

/** A record shaped like the ones in the NASA helicopter file. */
const flight = (number: number, to: string, extra: object = {}) => ({
  type: 'Feature',
  properties: {
    Flight: number,
    Sol: 43 + number,
    Lon: 77.451 - number * 0.001,
    Lat: 18.4449,
    Dist_m: 266.2,
    Max_Alt_m: 5,
    Duration_s: 51.9,
    Earth_Date: 'April 22, 2021',
    FromAirfld: 'Wright Brothers Field',
    ToAirfld: to,
    ...extra,
  },
});

describe('parseHelicopterFlights', () => {
  it('reads where each flight landed, in order, and marks the last', () => {
    const flights = parseHelicopterFlights({
      features: [flight(2, 'Airfield B'), flight(0, 'Wright Brothers Field', { Dist_m: 0 }), flight(1, 'Wright Brothers Field')],
    });
    expect(flights.map((point) => point.name)).toEqual(['Flight 1', 'Flight 2']);
    expect(flights[0]).toMatchObject({
      id: 'flight-1',
      set: 'flights',
      lines: ['Landed at Wright Brothers Field', 'Sol 44 · April 22, 2021', '266 m over the ground · 52 s in the air · up to 5 m'],
    });
    expect(flights[1].lines[flights[1].lines.length - 1]).toBe('The last flight in the file');
  });

  it('skips records without a position, and anything that is not the file', () => {
    expect(parseHelicopterFlights({ features: [flight(3, 'Airfield C', { Lat: null })] })).toEqual([]);
    expect(parseHelicopterFlights(undefined)).toEqual([]);
  });
});

describe('the sample depot', () => {
  it('has the ten tubes, each inside the mapped region of Jezero', () => {
    const jezero = findSite('jezero');
    expect(SAMPLE_DEPOT).toHaveLength(10);
    expect(new Set(SAMPLE_DEPOT.map((point) => point.id)).size).toBe(10);
    for (const tube of SAMPLE_DEPOT) {
      expect(tube.point.lat).toBeGreaterThan(jezero!.region.south);
      expect(tube.point.lat).toBeLessThan(jezero!.region.north);
      expect(tube.point.lon).toBeGreaterThan(jezero!.region.west);
      expect(tube.point.lon).toBeLessThan(jezero!.region.east);
    }
  });

  it('lies within a few hundred metres, as a depot does', () => {
    const [first, ...others] = SAMPLE_DEPOT;
    for (const tube of others) expect(distance(first.point, tube.point)).toBeLessThan(200);
  });

  it('says that a mark is the position of the rover', () => {
    for (const tube of SAMPLE_DEPOT) expect(tube.lines.join(' ')).toMatch(/Position of the rover/);
  });
});

describe('point sets', () => {
  it('belong to sites that exist', () => {
    const ids = new Set(SITES.map((site) => site.id));
    for (const site of Object.keys(SITE_POINT_SETS)) expect(ids.has(site)).toBe(true);
  });

  it('each name a source and what a point is', () => {
    for (const set of Object.values(POINT_SETS)) {
      expect(set.source.length).toBeGreaterThan(10);
      expect(set.reads.length).toBeGreaterThan(20);
      if (set.feed) expect(set.feed).toMatch(/^https:\/\/mars\.nasa\.gov\//);
    }
  });
});
