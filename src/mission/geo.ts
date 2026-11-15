/**
 * Geometry on the surface of Mars.
 *
 * Every distance in the app comes from here. Map libraries assume the radius of Earth, so a
 * length taken from one of them would be almost twice too long.
 *
 * Mars is treated as a sphere with its mean radius. The planet is flattened by about 0.6 %, which
 * is far below the uncertainty of a walk measured in kilometres.
 */

/** Mean radius of Mars in metres (IAU: 3389.5 km). */
export const MARS_RADIUS_M = 3_389_500;

/** Metres covered by one degree of latitude anywhere on Mars (about 59.16 km). */
export const METRES_PER_DEGREE = (Math.PI * MARS_RADIUS_M) / 180;

/** A point on the surface. Longitude is east-positive, stored as -180..180. */
export type LatLon = {
  lat: number;
  lon: number;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Wraps a longitude into -180..180 (180 itself maps to -180). */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** The convention used on screen and by most Mars products: 0..360 degrees east. */
export function toEast360(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

/** Great-circle distance between two points, in metres (haversine). */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, in degrees clockwise from north, 0..360. */
export function bearing(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** The point reached by leaving `from` on `bearingDeg` and travelling `metres` along the surface. */
export function destination(from: LatLon, bearingDeg: number, metres: number): LatLon {
  const angular = metres / MARS_RADIUS_M;
  const theta = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lon: normalizeLon(toDeg(lon2)) };
}

/** Length of a path through the given points, in metres. */
export function pathLength(points: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

/**
 * The point `metres` along a path through the given points. Before the start it is the first
 * point and past the end the last. Null for a path with no points.
 */
export function pointAlong(points: readonly LatLon[], metres: number): LatLon | null {
  if (points.length === 0) return null;
  if (metres <= 0) return points[0];
  let left = metres;
  for (let i = 1; i < points.length; i += 1) {
    const leg = distance(points[i - 1], points[i]);
    if (left <= leg) {
      return leg === 0
        ? points[i]
        : destination(points[i - 1], bearing(points[i - 1], points[i]), left);
    }
    left -= leg;
  }
  return points[points.length - 1];
}
