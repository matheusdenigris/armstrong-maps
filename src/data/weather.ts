/**
 * Weather on Mars, measured by the REMS station on the Curiosity rover in Gale crater.
 *
 * The feed is published for outreach by the Centro de Astrobiologia (CSIC-INTA), the team behind
 * the instrument, through mars.nasa.gov. It exists for Gale only: at any other site these
 * readings are a reference, not a local measurement.
 */
export const REMS_FEED = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';

export const REMS_CREDIT = 'Curiosity REMS, Centro de Astrobiologia (CSIC-INTA), outreach feed';

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

/** The feed writes every value as text and a missing one as "--". */
const number = (value: unknown): number | null => {
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
