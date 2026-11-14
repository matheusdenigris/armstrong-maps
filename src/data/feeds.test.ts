import { describe, expect, it } from 'vitest';

import { ROVERS, parseRoverTrack } from './rover';
import { REMS_FEED, parseWeather } from './weather';

/** A waypoint shaped like the ones in the feed. */
const waypoint = (sol: number, lat: number, lon: number, km: number) => ({
  type: 'Feature',
  properties: { sol, lat, lon, dist_km: km, dist_total_m: km * 1000 },
  geometry: { type: 'Point', coordinates: [lon, lat, -4500] },
});

describe('parseRoverTrack', () => {
  const feed = {
    type: 'FeatureCollection',
    features: [
      waypoint(3, -4.589467, 137.441633, 0),
      waypoint(16, -4.589, 137.442, 0.07),
      waypoint(21, -4.5885, 137.4425, 0.11),
      waypoint(5073, -4.82602331, 137.388886, 38.32),
    ],
  };

  it('reads the traverse in order', () => {
    const track = parseRoverTrack(feed);
    expect(track.path).toHaveLength(4);
    expect(track.path[0]).toEqual({ lat: -4.589467, lon: 137.441633 });
  });

  it('reports the last waypoint as the latest position', () => {
    expect(parseRoverTrack(feed).latest).toEqual({
      point: { lat: -4.82602331, lon: 137.388886 },
      sol: 5073,
      drivenKm: 38.32,
    });
  });

  it('thins a long traverse but keeps both ends', () => {
    const long = {
      features: Array.from({ length: 1000 }, (_, index) =>
        waypoint(index, -4.5 - index * 0.0001, 137.4, index * 0.03),
      ),
    };
    const track = parseRoverTrack(long, 100);
    expect(track.path.length).toBeLessThanOrEqual(101);
    expect(track.path[0].lat).toBeCloseTo(-4.5, 9);
    expect(track.path[track.path.length - 1].lat).toBeCloseTo(-4.5999, 9);
    expect(track.latest?.sol).toBe(999);
  });

  it('skips waypoints without coordinates', () => {
    const broken = {
      features: [
        { properties: { sol: 1 } },
        { properties: { sol: 2, lat: 'north', lon: 137 } },
        waypoint(3, -4.6, 137.4, 0.5),
      ],
    };
    expect(parseRoverTrack(broken).path).toEqual([{ lat: -4.6, lon: 137.4 }]);
  });

  it('is empty for anything that is not the feed', () => {
    for (const raw of [null, undefined, 'error', {}, { features: 'none' }, { features: [] }]) {
      expect(parseRoverTrack(raw)).toEqual({ path: [], latest: null });
    }
  });

  it('knows a feed for each rover', () => {
    expect(ROVERS.curiosity.feed).toMatch(/^https:\/\/mars\.nasa\.gov\/.+MSL_waypoints\.json$/);
    expect(ROVERS.perseverance.feed).toMatch(/^https:\/\/mars\.nasa\.gov\/.+M20_waypoints\.json$/);
  });
});

describe('parseWeather', () => {
  // The first entry is copied from the feed; the second has the gaps the early sols have.
  const feed = {
    descriptions: {},
    soles: [
      {
        id: '4746',
        terrestrial_date: '2026-08-25',
        sol: '4995',
        ls: '341',
        season: 'Month 12',
        min_temp: '-71',
        max_temp: '-5',
        pressure: '777',
        pressure_string: 'Higher',
        abs_humidity: '--',
        wind_speed: '--',
        wind_direction: '--',
        atmo_opacity: 'Sunny',
        sunrise: '06:46',
        sunset: '18:51',
        local_uv_irradiance_index: 'Moderate',
        min_gts_temp: '-84',
        max_gts_temp: '4',
      },
      {
        id: '1',
        terrestrial_date: '2012-08-07',
        sol: '1',
        ls: '150',
        min_temp: '--',
        max_temp: '--',
        pressure: '--',
        atmo_opacity: 'Sunny',
        sunrise: '05:30',
        sunset: '17:22',
        local_uv_irradiance_index: '--',
        min_gts_temp: '--',
        max_gts_temp: '--',
      },
    ],
  };

  it('turns the text of the feed into numbers', () => {
    expect(parseWeather(feed)[0]).toEqual({
      sol: 4995,
      earthDate: '2026-08-25',
      solarLongitude: 341,
      minAirC: -71,
      maxAirC: -5,
      minGroundC: -84,
      maxGroundC: 4,
      pressurePa: 777,
      sky: 'Sunny',
      uvIndex: 'Moderate',
      sunrise: '06:46',
      sunset: '18:51',
    });
  });

  it('keeps a missing reading as null instead of zero', () => {
    const early = parseWeather(feed)[1];
    expect(early.minAirC).toBeNull();
    expect(early.pressurePa).toBeNull();
    expect(early.uvIndex).toBeNull();
    expect(early.sky).toBe('Sunny');
  });

  it('keeps the newest sols up to the limit', () => {
    expect(parseWeather(feed, 1).map((reading) => reading.sol)).toEqual([4995]);
  });

  it('is empty for anything that is not the feed', () => {
    for (const raw of [null, undefined, 'error', {}, { soles: {} }]) {
      expect(parseWeather(raw)).toEqual([]);
    }
  });

  it('reads from mars.nasa.gov', () => {
    expect(REMS_FEED).toMatch(/^https:\/\/mars\.nasa\.gov\//);
  });
});
