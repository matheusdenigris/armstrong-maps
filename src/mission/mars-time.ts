/**
 * Time on Mars and where the Sun stands in the sky of a site.
 *
 * The algorithm of Allison and McEwen (2000), as NASA GISS publishes it for its Mars24 sunclock:
 * https://www.giss.nasa.gov/tools/mars24/help/algorithm.html. The tests check it against the two
 * worked examples on that page.
 *
 * Longitudes here are east-positive, as in the rest of the app; the algorithm counts west, and
 * this module converts. Latitudes are used as given: the app's are planetocentric and Mars24's
 * planetographic, which differ by under half a degree at the landing sites.
 */

/** Length of a Mars solar day, in Earth days. */
export const SOL_IN_EARTH_DAYS = 1.0274912517;

/** Terrestrial Time minus UTC: 37 leap seconds (unchanged since 2017) plus 32.184 s. */
export const TT_MINUS_UTC_S = 69.184;

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const mod = (value: number, by: number) => ((value % by) + by) % by;

/** The perturbations by other planets: amplitude, period in Julian years, phase (B-3). */
const PERTURBERS = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
] as const;

export type MarsTime = {
  /** Mars Sol Date: a running count of sols, like a Julian date for Mars. */
  msd: number;
  /** Mean solar time at the prime meridian (Airy Mean Time), in hours 0..24. */
  mst: number;
  /** Areocentric solar longitude, the season: 0 is the northern spring equinox, in degrees. */
  ls: number;
  /** Equation of time: true minus mean solar time, in degrees (15 degrees is one hour). */
  eot: number;
  /** Longitude where the Sun is overhead, east-positive, -180..180. */
  subsolarLon: number;
  /** Latitude where the Sun is overhead: the solar declination, in degrees. */
  declination: number;
  /** Mean anomaly and equation of centre, kept for the tests. */
  meanAnomaly: number;
  equationOfCentre: number;
};

/**
 * Where Mars and its Sun are at a moment on Earth. `ttMinusUtcS` is there for the worked examples,
 * which use the leap-second count of their time (64.184 s).
 */
export function marsTime(date: Date, ttMinusUtcS = TT_MINUS_UTC_S): MarsTime {
  const jdUt = 2440587.5 + date.getTime() / 86_400_000;
  const jdTt = jdUt + ttMinusUtcS / 86_400;
  const dt = jdTt - 2451545.0;

  const meanAnomaly = mod(19.3871 + 0.52402073 * dt, 360);
  const fictitiousSun = mod(270.3871 + 0.524038496 * dt, 360);
  const perturbers = PERTURBERS.reduce(
    (sum, [amplitude, period, phase]) => sum + amplitude * cos((0.985626 * dt) / period + phase),
    0,
  );
  const m = meanAnomaly;
  const equationOfCentre =
    (10.691 + 3.0e-7 * dt) * sin(m) +
    0.623 * sin(2 * m) +
    0.05 * sin(3 * m) +
    0.005 * sin(4 * m) +
    0.0005 * sin(5 * m) +
    perturbers;
  const ls = mod(fictitiousSun + equationOfCentre, 360);
  const eot = 2.861 * sin(2 * ls) - 0.071 * sin(4 * ls) + 0.002 * sin(6 * ls) - equationOfCentre;

  const msd = (jdTt - 2451549.5) / SOL_IN_EARTH_DAYS + 44796.0 - 0.0009626;
  const mst = mod(24 * msd, 24);
  // C-5 gives the subsolar longitude west of the prime meridian.
  const subsolarWest = mod(mst * 15 + eot + 180, 360);
  const subsolarLon = mod(-subsolarWest + 180, 360) - 180;
  const declination = Math.asin(0.42565 * sin(ls)) / RAD + 0.25 * sin(ls);

  return { msd, mst, ls, eot, subsolarLon, declination, meanAnomaly, equationOfCentre };
}

/** Local mean solar time at an east longitude, in hours 0..24. */
export function localMeanSolarTime(time: MarsTime, lonEast: number): number {
  return mod(time.mst + lonEast / 15, 24);
}

/** Local true solar time (the Sun's own hour) at an east longitude, in hours 0..24. */
export function localTrueSolarTime(time: MarsTime, lonEast: number): number {
  return mod(localMeanSolarTime(time, lonEast) + time.eot / 15, 24);
}

/** How high the Sun is above the horizon of a site, in degrees; negative below it (D-5). */
export function sunElevation(time: MarsTime, lat: number, lonEast: number): number {
  const hourAngle = lonEast - time.subsolarLon;
  const cosZenith =
    sin(time.declination) * sin(lat) + cos(time.declination) * cos(lat) * cos(hourAngle);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
}

/** The season of a hemisphere from Ls, in the words NASA uses. */
export function season(ls: number, lat: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  const northern = (['spring', 'summer', 'autumn', 'winter'] as const)[Math.floor(mod(ls, 360) / 90)];
  if (lat >= 0) return northern;
  return ({ spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' } as const)[northern];
}

const MS_PER_SOL = SOL_IN_EARTH_DAYS * 86_400_000;

/** The Sun's elevation at a site, in degrees, at a moment given in milliseconds since the epoch. */
export type SunAt = (ms: number) => number;

/** The Sun of a site from this module's own algorithm, which works with no network. */
export function mars24Sun(lat: number, lonEast: number): SunAt {
  return (ms) => sunElevation(marsTime(new Date(ms)), lat, lonEast);
}

/**
 * The Sun from a table of elevations at regular times (an ephemeris), linearly interpolated, and
 * from `fallback` outside the table.
 */
export function tableSun(
  table: { times: readonly number[]; elevations: readonly number[] },
  fallback: SunAt,
): SunAt {
  const { times, elevations } = table;
  return (ms) => {
    if (times.length < 2 || ms < times[0] || ms > times[times.length - 1]) return fallback(ms);
    let low = 0;
    let high = times.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (times[middle] <= ms) low = middle;
      else high = middle;
    }
    const t = (ms - times[low]) / (times[high] - times[low] || 1);
    return elevations[low] + (elevations[high] - elevations[low]) * t;
  };
}

/**
 * The next time after `from` that the Sun crosses `elevation`, going up (`rising`) or down.
 * Searched in steps of about four Mars minutes, then refined. Null if it does not happen within two
 * sols (polar day or night; never at the landing sites).
 */
export function nextSunCrossing(from: Date, sun: SunAt, rising: boolean, elevation = 0): Date | null {
  const step = MS_PER_SOL / 360;
  const height = (ms: number) => sun(ms) - elevation;
  let previous = height(from.getTime());
  for (let t = from.getTime() + step; t <= from.getTime() + 2 * MS_PER_SOL; t += step) {
    const current = height(t);
    if (rising ? previous < 0 && current >= 0 : previous >= 0 && current < 0) {
      let low = t - step;
      let high = t;
      for (let i = 0; i < 30; i += 1) {
        const middle = (low + high) / 2;
        const below = height(middle) < 0;
        if (rising ? below : !below) low = middle;
        else high = middle;
      }
      return new Date((low + high) / 2);
    }
    previous = current;
  }
  return null;
}

/** What the Sun does over a walk, for the verdict. */
export type WalkDaylight = {
  /** Sun elevation at the start, in degrees. */
  startElevation: number;
  /** The lowest the Sun gets during the walk, in degrees. */
  lowestElevation: number;
  /** When the walk ends, on Earth's clock. */
  endsAt: Date;
  /** The next sunset after the start, or null. */
  sunset: Date | null;
  /** Hours of daylight left at the end of the walk; negative when it ends after sunset. */
  hoursToSpare: number | null;
};

/** Follows the Sun over a walk that starts at `start` and lasts `durationHours` Earth hours. */
export function walkDaylight(start: Date, durationHours: number, sun: SunAt): WalkDaylight {
  const startMs = start.getTime();
  const endMs = startMs + durationHours * 3_600_000;
  let lowest = sun(startMs);
  const steps = Math.max(1, Math.ceil((endMs - startMs) / (5 * 60_000)));
  for (let i = 1; i <= steps; i += 1) lowest = Math.min(lowest, sun(startMs + ((endMs - startMs) * i) / steps));
  const sunset = sun(startMs) >= 0 ? nextSunCrossing(start, sun, false) : null;
  return {
    startElevation: sun(startMs),
    lowestElevation: lowest,
    endsAt: new Date(endMs),
    sunset,
    hoursToSpare: sunset ? (sunset.getTime() - endMs) / 3_600_000 : null,
  };
}

/** "HH:MM" from decimal hours. */
export function formatMarsClock(hours: number): string {
  const total = Math.floor(mod(hours, 24) * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
