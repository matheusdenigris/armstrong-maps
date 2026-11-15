/**
 * Where the rovers have driven. NASA publishes the localisation of Curiosity and Perseverance
 * after each drive as GeoJSON waypoints (mars.nasa.gov, the data behind its "Where is the rover"
 * maps). This reads that feed; nothing here is simulated.
 */
import type { LatLon } from '@/mission/geo';

import type { Rover } from './sites';

export const ROVERS: Record<Rover, { name: string; feed: string }> = {
  curiosity: {
    name: 'Curiosity',
    feed: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
  },
  perseverance: {
    name: 'Perseverance',
    feed: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
  },
};

/**
 * A place where the rover stopped. The site and drive counters are how NASA names the stop: the
 * raw images taken there carry the same pair, which is what ties a picture to a place.
 */
export type RoverStop = {
  /** The sol of the mission on which the rover reached it. */
  sol: number;
  point: LatLon;
  /** The site and drive counters of the stop, or null where the feed does not give them. */
  site: number | null;
  drive: number | null;
};

export type RoverTrack = {
  /** The traverse from the landing point to the latest waypoint, thinned for drawing. */
  path: LatLon[];
  /** The last waypoint in the feed, or null when the feed has none. */
  latest: {
    point: LatLon;
    /** The sol of the mission on which the rover reached it. */
    sol: number;
    /** Total distance driven, in km, as the feed reports it. */
    drivenKm: number | null;
  } | null;
  /** Every waypoint that has a sol, in the order of the drive: where the rover stopped, and when. */
  stops: RoverStop[];
};

/**
 * Where the rover stood on a sol: the end of its last drive on or before that sol. Null before
 * its first waypoint.
 */
export function positionOnSol(track: RoverTrack, sol: number): LatLon | null {
  let found: LatLon | null = null;
  for (const stop of track.stops) {
    if (stop.sol > sol) break;
    found = stop.point;
  }
  return found;
}

const finite = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? number : null;
};

/**
 * Reduces the waypoints feed to a line and a latest position. The line keeps at most `maxPoints`
 * points, always including the first and the last. Waypoints without coordinates are skipped.
 */
export function parseRoverTrack(raw: unknown, maxPoints = 600): RoverTrack {
  const features = (raw as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return { path: [], latest: null, stops: [] };

  const waypoints: {
    point: LatLon;
    sol: number | null;
    drivenKm: number | null;
    site: number | null;
    drive: number | null;
  }[] = [];
  for (const feature of features) {
    const properties = (feature as { properties?: Record<string, unknown> } | null)?.properties;
    const lat = finite(properties?.lat);
    const lon = finite(properties?.lon);
    if (lat === null || lon === null) continue;
    waypoints.push({
      point: { lat, lon },
      sol: finite(properties?.sol),
      drivenKm: finite(properties?.dist_km),
      site: finite(properties?.site),
      drive: finite(properties?.drive),
    });
  }
  if (waypoints.length === 0) return { path: [], latest: null, stops: [] };

  const step = Math.max(1, Math.ceil(waypoints.length / maxPoints));
  const path = waypoints
    .filter((_, index) => index % step === 0 || index === waypoints.length - 1)
    .map((waypoint) => waypoint.point);

  const last = waypoints[waypoints.length - 1];
  return {
    path,
    latest: last.sol === null ? null : { point: last.point, sol: last.sol, drivenKm: last.drivenKm },
    stops: waypoints
      .flatMap((waypoint) =>
        waypoint.sol === null
          ? []
          : [{ sol: waypoint.sol, point: waypoint.point, site: waypoint.site, drive: waypoint.drive }],
      )
      .sort((one, other) => one.sol - other.sol),
  };
}
