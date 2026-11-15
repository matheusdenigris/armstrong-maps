/**
 * Weather on Mars, measured by the REMS station on the Curiosity rover in Gale crater and, for a
 * few sols of 2024, by the MEDA station on the Perseverance rover in Jezero crater.
 *
 * The REMS feed is published for outreach by the Centro de Astrobiologia (CSIC-INTA), the team
 * behind the instrument, through mars.nasa.gov. It exists for Gale only: at any other site these
 * readings are a reference, not a local measurement.
 */
export const REMS_FEED = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';

export const REMS_CREDIT = 'Curiosity REMS, Centro de Astrobiologia (CSIC-INTA), outreach feed';

/**
 * The weather feed of Perseverance, in the same family as the REMS one. Read on 2026-11-14 it
 * held seven sols, 1127 to 1133 (April 2024), and had not moved since: it is a dated measurement
 * at Jezero, not its weather today. It has air temperature, pressure, sunrise and sunset; no
 * ground temperature, no ultraviolet, no wind and no sky.
 */
export const MEDA_FEED =
  'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json';

export const MEDA_CREDIT = 'Perseverance MEDA, NASA/JPL-Caltech and Centro de Astrobiologia (CSIC-INTA)';

/**
 * What the "atmo_opacity" word of the REMS feed is worth, counted over the whole feed on
 * 2026-11-14: it said "Sunny" on all but three of its sols, the 81 sols of the global dust storm
 * of 2018 (10 June to 31 August) included, when the sky over Gale was dark with dust. So it does
 * not tell dust from clear sky, and the app shows it as a word of the feed, never as a measurement.
 */
export const SKY_WORD_CHECK = {
  checkedOn: '2026-11-14',
  sols: 4745,
  sunny: 4742,
  stormSols2018: 81,
  sunnyInStorm2018: 81,
} as const;

/** One sol of readings. A reading the station did not report is null, never a guess. */
export type SolWeather = {
  /** Sol of the Curiosity mission. */
  sol: number;
  /** The same day on Earth, as YYYY-MM-DD. */
  earthDate: string;
  /** Solar longitude of Mars in degrees: 0 is the northern spring equinox. */
  solarLongitude: number | null;
  minAirC: number | null;
  maxAirC: number | null;
  minGroundC: number | null;
  maxGroundC: number | null;
  pressurePa: number | null;
  /** The sky as the feed words it, for instance "Sunny". */
  sky: string | null;
  uvIndex: string | null;
  /** Local time at Gale, HH:MM. */
  sunrise: string | null;
  sunset: string | null;
};

/** From this many days on, a reading is called out as old: it is not the weather of today. */
export const STALE_AFTER_DAYS = 7;

/**
 * How many whole Earth days before `now` a reading was taken, or null when its date cannot be
 * read. The feed is not kept up to date sol by sol, so the age is shown with the reading.
 */
export function readingAgeDays(earthDate: string, now: Date): number | null {
  const taken = Date.parse(`${earthDate}T00:00:00Z`);
  if (!Number.isFinite(taken)) return null;
  return Math.max(0, Math.floor((now.getTime() - taken) / 86_400_000));
}

/** "today", "yesterday" or "81 days ago". */
export function describeAge(days: number): string {
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** The feeds write a value as text or as a number, and a missing one as "--". */
const number = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '' || value === '--') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' && value !== '--' ? value.trim() : null;

/** Reads the feed, newest sol first, keeping at most `limit` sols. */
export function parseWeather(raw: unknown, limit = 30): SolWeather[] {
  const sols = (raw as { soles?: unknown } | null)?.soles;
  if (!Array.isArray(sols)) return [];
  const readings: SolWeather[] = [];
  for (const entry of sols as Record<string, unknown>[]) {
    const sol = number(entry?.sol);
    if (sol === null) continue;
    readings.push({
      sol,
      earthDate: text(entry.terrestrial_date) ?? '',
      solarLongitude: number(entry.ls),
      minAirC: number(entry.min_temp),
      maxAirC: number(entry.max_temp),
      minGroundC: number(entry.min_gts_temp),
      maxGroundC: number(entry.max_gts_temp),
      pressurePa: number(entry.pressure),
      sky: text(entry.atmo_opacity),
      uvIndex: text(entry.local_uv_irradiance_index),
      sunrise: text(entry.sunrise),
      sunset: text(entry.sunset),
    });
    if (readings.length === limit) break;
  }
  return readings;
}

/** "06:18:07" as "06:18": the clock of the other feed. */
const clock = (value: unknown): string | null => {
  const time = text(value);
  return time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : time;
};

/**
 * Reads the Perseverance feed, newest sol first. It lists its sols oldest first and has fewer
 * readings than the REMS one: what it does not carry stays null.
 */
export function parseMedaWeather(raw: unknown): SolWeather[] {
  const sols = (raw as { sols?: unknown } | null)?.sols;
  if (!Array.isArray(sols)) return [];
  const readings: SolWeather[] = [];
  for (const entry of sols as Record<string, unknown>[]) {
    const sol = number(entry?.sol);
    if (sol === null) continue;
    readings.push({
      sol,
      earthDate: text(entry.terrestrial_date) ?? '',
      solarLongitude: number(entry.ls),
      minAirC: number(entry.min_temp),
      maxAirC: number(entry.max_temp),
      minGroundC: null,
      maxGroundC: null,
      pressurePa: number(entry.pressure),
      sky: null,
      uvIndex: null,
      sunrise: clock(entry.sunrise),
      sunset: clock(entry.sunset),
    });
  }
  return readings.sort((one, other) => other.sol - one.sol);
}

/** The newest sol on which the station reported a temperature or a pressure, if any. */
export function latestMeasured(sols: readonly SolWeather[]): SolWeather | undefined {
  return sols.find(
    (sol) => sol.minAirC !== null || sol.maxAirC !== null || sol.pressurePa !== null,
  );
}
