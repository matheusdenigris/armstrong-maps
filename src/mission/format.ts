/**
 * How numbers are written on screen. Kept with the mission code so every screen agrees.
 */
import { toEast360, type LatLon } from './geo';

/** "4.5895° S" */
export function formatLat(lat: number, digits = 4): string {
  return `${Math.abs(lat).toFixed(digits)}° ${lat < 0 ? 'S' : 'N'}`;
}

/** Longitude as Mars products write it: 0 to 360 degrees east. "137.4417° E" */
export function formatLon(lon: number, digits = 4): string {
  const east = toEast360(lon);
  // 359.99996 would print as 360.0000; that is 0.
  const shown = Number(east.toFixed(digits)) >= 360 ? 0 : east;
  return `${shown.toFixed(digits)}° E`;
}

export function formatLatLon(point: LatLon, digits = 4): string {
  return `${formatLat(point.lat, digits)}  ${formatLon(point.lon, digits)}`;
}

/** Metres below one kilometre, kilometres above: "850 m", "1.25 km", "12.4 km", "340 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** The longest round length (1, 2 or 5 times a power of ten) that fits in `maxMetres`. */
export function roundLength(maxMetres: number): number {
  if (!(maxMetres > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(maxMetres));
  const lead = maxMetres / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}
