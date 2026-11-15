/**
 * Wind measured on Mars.
 *
 * The only wind measurements NASA serves as an API come from the TWINS sensors of the InSight
 * lander at Elysium Planitia (api.nasa.gov/insight_weather, NASA/JPL and Cornell). The feed keeps
 * the last seven sols InSight sent, in October 2020; the lander has been silent since 2022.
 * Curiosity's wind sensor was damaged at landing (the REMS feed reports no wind), and the public
 * MEDA feed of Perseverance carries no wind either. So the app shows InSight's wind as what it
 * is: measured, at one place, in 2020.
 *
 * In the API, a wind direction is where the wind blows from, to within 11.25 degrees.
 */
import { NASA_API_KEY } from './space-weather';

export const INSIGHT_SITE = { lat: 4.5024, lon: 135.6234 } as const;

export const INSIGHT_CREDIT = 'InSight TWINS, NASA/JPL and Cornell University, via api.nasa.gov';

export function insightWeatherUrl(key = NASA_API_KEY): string {
  return `https://api.nasa.gov/insight_weather/?api_key=${encodeURIComponent(key)}&feedtype=json&ver=1.0`;
}

export type WindSol = {
  sol: number;
  /** First and last UTC time of the sol's data, YYYY-MM-DD. */
  firstDate: string;
  season: string | null;
  /** Horizontal wind speed in m/s over the sol: mean, lowest and highest sample. */
  meanMs: number;
  minMs: number;
  maxMs: number;
  /** The most common direction the wind blew from, in degrees from north, and its compass name. */
  fromDeg: number | null;
  fromPoint: string | null;
};

type Entry = Record<string, unknown>;
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The sols with a valid wind speed, newest first. */
export function parseInsightWind(raw: unknown): WindSol[] {
  const feed = (raw ?? {}) as Entry;
  const keys = Array.isArray(feed.sol_keys) ? (feed.sol_keys as unknown[]) : [];
  const sols: WindSol[] = [];
  for (const key of keys) {
    const entry = feed[String(key)] as Entry | undefined;
    const speed = entry?.HWS as Entry | undefined;
    const mean = num(speed?.av);
    const min = num(speed?.mn);
    const max = num(speed?.mx);
    const sol = Number(key);
    if (!entry || mean === null || min === null || max === null || !Number.isFinite(sol)) continue;
    const common = (entry.WD as Entry | undefined)?.most_common as Entry | null | undefined;
    sols.push({
      sol,
      firstDate: typeof entry.First_UTC === 'string' ? entry.First_UTC.slice(0, 10) : '',
      season: typeof entry.Season === 'string' ? entry.Season : null,
      meanMs: mean,
      minMs: min,
      maxMs: max,
      fromDeg: num(common?.compass_degrees),
      fromPoint: typeof common?.compass_point === 'string' ? common.compass_point : null,
    });
  }
  return sols.sort((a, b) => b.sol - a.sol);
}

/**
 * Air density at the surface, in kg/m^3, from NASA's planetary fact sheets (nssdc.gsfc.nasa.gov,
 * read on 2026-11-14): Mars about 0.016, give or take 0.006, and the Earth 1.217. The push of the
 * wind grows with density times the square of its speed.
 */
export const AIR_DENSITY = { mars: 0.016, earth: 1.217 } as const;

export const AIR_DENSITY_SOURCE = 'NASA planetary fact sheets: Mars ~0.016 ± 0.006 kg/m³, Earth 1.217 kg/m³';

/** The wind speed on Earth that pushes as hard as `ms` on Mars. */
export function earthEquivalentMs(ms: number): number {
  return ms * Math.sqrt(AIR_DENSITY.mars / AIR_DENSITY.earth);
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** The nearest of the 16 compass points to a direction in degrees. */
export function compassPoint(degrees: number): string {
  return POINTS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}
