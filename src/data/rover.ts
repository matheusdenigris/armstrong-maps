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
};

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
  if (!Array.isArray(features)) return { path: [], latest: null };

  const waypoints: { point: LatLon; sol: number | null; drivenKm: number | null }[] = [];
  for (const feature of features) {
    const properties = (feature as { properties?: Record<string, unknown> } | null)?.properties;
    const lat = finite(properties?.lat);
    const lon = finite(properties?.lon);
    if (lat === null || lon === null) continue;
    waypoints.push({
      point: { lat, lon },
      sol: finite(properties?.sol),
      drivenKm: finite(properties?.dist_km),
    });
  }
  if (waypoints.length === 0) return { path: [], latest: null };

  const step = Math.max(1, Math.ceil(waypoints.length / maxPoints));
  const path = waypoints
    .filter((_, index) => index % step === 0 || index === waypoints.length - 1)
    .map((waypoint) => waypoint.point);

  const last = waypoints[waypoints.length - 1];
  return {
    path,
    latest: last.sol === null ? null : { point: last.point, sol: last.sol, drivenKm: last.drivenKm },
  };
}
