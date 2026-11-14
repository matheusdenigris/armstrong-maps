/**
 * Where the Sun stands in the sky of a site, from NASA/JPL Horizons, the ephemeris service of the
 * Solar System Dynamics group at JPL (ssd.jpl.nasa.gov/horizons).
 *
 * The app asks Horizons for the Sun's elevation, seen from the landing point on Mars, every 10
 * minutes over three days. Sunrise, sunset and the daylight of a walk are read from that table;
 * where it does not reach, or when Horizons does not answer, the app's own Mars24 algorithm takes
 * over (`src/mission/mars-time.ts`). The two agree within about a minute.
 *
 * Horizons sends no CORS header, so a browser cannot call it: the web app goes through
 * `api/horizons.js`, a function on the same host that forwards the request. The phone apps call it
 * directly.
 */

export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** The web app's own forwarder (`api/horizons.js` on Vercel). */
export const HORIZONS_PROXY = '/api/horizons';

export const HORIZONS_CREDIT = 'NASA/JPL Horizons, Solar System Dynamics';

/** Days of table asked for, and its step. */
export const HORIZONS_DAYS = 3;
export const HORIZONS_STEP_MIN = 10;

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The query, as Horizons parameters. Mars counts longitude westwards, and Horizons takes an east
 * longitude as a negative number on such a body.
 */
export function horizonsParams(lat: number, lonEast: number, from: Date): Record<string, string> {
  const start = day(from);
  const stop = day(new Date(from.getTime() + HORIZONS_DAYS * 86_400_000));
  return {
    format: 'json',
    COMMAND: "'10'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@499'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${(-lonEast).toFixed(6)},${lat.toFixed(6)},0'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${HORIZONS_STEP_MIN} m'`,
    QUANTITIES: "'4'",
    CSV_FORMAT: "'YES'",
  };
}

const query = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

/**
 * The address to ask. Through the forwarder only the site and the day travel; the forwarder
 * builds the same query from them.
 */
export function horizonsSunUrl(lat: number, lonEast: number, from: Date, viaProxy: boolean): string {
  return viaProxy
    ? `${HORIZONS_PROXY}?lat=${lat.toFixed(6)}&lon=${lonEast.toFixed(6)}&start=${day(from)}`
    : `${HORIZONS_API}?${query(horizonsParams(lat, lonEast, from))}`;
}

/** Elevations of the Sun at regular times. */
export type SunTable = { times: number[]; elevations: number[] };

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Reads the table out of Horizons' answer: the rows between $$SOE and $$EOE, each
 * "2026-Nov-14 18:00,*, , 284.703361,    35.648734,". The time is UT; the last number is the
 * apparent elevation in degrees.
 */
export function parseHorizonsSun(raw: unknown): SunTable {
  const result = (raw as { result?: unknown } | null)?.result;
  if (typeof result !== 'string') throw new Error('Horizons answered without a result');
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error('Horizons answered without a table');
  const times: number[] = [];
  const elevations: number[] = [];
  for (const line of result.slice(start + 5, end).split('\n')) {
    const cells = line.split(',').map((cell) => cell.trim());
    const when = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(cells[0] ?? '');
    const elevation = Number(cells[4]);
    if (!when || !(when[2] in MONTHS) || !Number.isFinite(elevation) || cells[4] === '') continue;
    times.push(
      Date.UTC(Number(when[1]), MONTHS[when[2]], Number(when[3]), Number(when[4]), Number(when[5])),
    );
    elevations.push(elevation);
  }
  if (times.length < 2) throw new Error('Horizons answered with an empty table');
  return { times, elevations };
}
