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

/** "45 min", "1 h 05 min", "8 h 00 min". */
export function formatDuration(hours: number): string {
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** A mission clock: hours, minutes and seconds, "01:05:09". */
export function formatClock(hours: number): string {
  // A hair is added before rounding down: 3909 seconds written as hours comes back as 3908.9999.
  const seconds = Math.max(0, Math.floor(hours * 3600 + 1e-6));
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(Math.floor(seconds / 3600))}:${two(Math.floor(seconds / 60) % 60)}:${two(seconds % 60)}`;
}

/** A share as a whole percentage: 0.142 is "14%". */
export function formatShare(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** A dose equivalent in millisieverts, with three decimals: a walk is a few hundredths. */
export function formatDose(msv: number): string {
  return `${msv.toFixed(3)} mSv`;
}

/** The longest round length (1, 2 or 5 times a power of ten) that fits in `maxMetres`. */
export function roundLength(maxMetres: number): number {
  if (!(maxMetres > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(maxMetres));
  const lead = maxMetres / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}
