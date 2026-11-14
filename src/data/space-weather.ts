/**
 * Space weather from DONKI, the Space Weather Database Of Notifications, Knowledge, Information
 * run by NASA's Community Coordinated Modeling Center (CCMC, Goddard), served through api.nasa.gov.
 *
 * Two queries are used:
 *
 * - WSA-Enlil simulations. CCMC runs this model for every coronal mass ejection (CME) worth
 *   following, and its `impactList` says when the CME is forecast to reach each planet. The
 *   entries with `location: "Mars"` are the only Mars-specific space weather NASA publishes.
 * - Solar energetic particle (SEP) events. These are detected near the Earth, not at Mars, so they
 *   say how active the Sun has been, not what reached Gale or Jezero.
 *
 * Nothing here is a measurement taken on the surface of Mars, and the interface says so.
 */

export const DONKI_BASE = 'https://api.nasa.gov/DONKI';

/**
 * The api.nasa.gov key. The web app is a static export, so whatever is set here ends up in the
 * page and anyone can read it. Without one, the shared DEMO_KEY is used: its limit is counted per
 * visitor's address, which is enough for a few site visits an hour.
 */
export const NASA_API_KEY = process.env.EXPO_PUBLIC_NASA_API_KEY || 'DEMO_KEY';

/** How far back the app looks. DONKI refuses SEP queries longer than 60 days. */
export const DONKI_WINDOW_DAYS = 30;

/**
 * How close to an arrival at Mars a walk counts as exposed. Assumptions of this project, not NASA
 * rules: the shock of a CME passes in hours, and a walk is planned a few sols ahead.
 */
export const CME_WINDOW = {
  /** An arrival forecast up to this many hours ahead puts a walk on caution. */
  aheadHours: 72,
  /** An arrival up to this many hours ago still counts as passing. */
  behindHours: 24,
} as const;

export const DONKI_CREDIT = 'NASA DONKI, Community Coordinated Modeling Center (CCMC, Goddard)';

const day = (date: Date) => date.toISOString().slice(0, 10);

/** The DONKI addresses for the `days` days up to `now`. They only change once a day. */
export function donkiUrls(now: Date, days = DONKI_WINDOW_DAYS, key = NASA_API_KEY) {
  const from = day(new Date(now.getTime() - days * 86_400_000));
  const to = day(now);
  const query = `startDate=${from}&endDate=${to}&api_key=${encodeURIComponent(key)}`;
  return {
    from,
    to,
    enlil: `${DONKI_BASE}/WSAEnlilSimulations?${query}`,
    sep: `${DONKI_BASE}/SEP?${query}`,
  };
}

/** A CME arrival at Mars, as forecast by one WSA-Enlil run. */
export type MarsArrival = {
  /** ISO time of the forecast arrival, in UTC. */
  arrivalTime: string;
  /** The model expects only the flank of the CME to reach Mars. */
  glancing: boolean;
  /** The model rates the impact as minor. */
  minor: boolean;
  /** The CMEs that went into the run, sorted. */
  cmeIds: string[];
  /** When CCMC finished the run. */
  modelTime: string;
  /** The run's page on DONKI, when the feed gives one. */
  link: string | null;
};

/** A solar energetic particle event, detected near the Earth. */
export type SepEvent = {
  id: string;
  /** ISO time of the event, in UTC. */
  time: string;
  /** The instruments that saw it, for instance "STEREO A: IMPACT 13-100 MeV". */
  instruments: string[];
  link: string | null;
};

type Entry = Record<string, unknown>;
const entries = (value: unknown): Entry[] =>
  Array.isArray(value) ? value.filter((item): item is Entry => !!item && typeof item === 'object') : [];
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/**
 * The forecast arrivals at Mars, earliest first. CCMC runs the model again as a CME is better
 * observed, so only the latest run for each set of CMEs is kept.
 */
export function parseMarsArrivals(raw: unknown): MarsArrival[] {
  const latest = new Map<string, MarsArrival>();
  for (const run of entries(raw)) {
    const cmeIds = entries(run.cmeInputs)
      .map((input) => text(input.CMEID))
      .filter((id): id is string => id !== null)
      .sort();
    const modelTime = text(run.modelCompletionTime) ?? '';
    for (const impact of entries(run.impactList)) {
      const arrivalTime = text(impact.arrivalTime);
      if (impact.location !== 'Mars' || !arrivalTime || !Number.isFinite(Date.parse(arrivalTime))) {
        continue;
      }
      const key = cmeIds.join('|') || arrivalTime;
      const previous = latest.get(key);
      if (previous && previous.modelTime >= modelTime) continue;
      latest.set(key, {
        arrivalTime,
        glancing: impact.isGlancingBlow === true,
        minor: impact.isMinorImpact === true,
        cmeIds,
        modelTime,
        link: text(run.link),
      });
    }
  }
  return [...latest.values()].sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime));
}

/** The SEP events, newest first. */
export function parseSepEvents(raw: unknown): SepEvent[] {
  return entries(raw)
    .map((event) => ({
      id: text(event.sepID) ?? '',
      time: text(event.eventTime) ?? '',
      instruments: entries(event.instruments)
        .map((instrument) => text(instrument.displayName))
        .filter((name): name is string => name !== null),
      link: text(event.link),
    }))
    .filter((event) => event.id !== '' && Number.isFinite(Date.parse(event.time)))
    .sort((a, b) => b.time.localeCompare(a.time));
}

/**
 * What the forecast means for a walk now.
 *
 * - `arriving`: a CME is forecast to reach Mars within `CME_WINDOW.aheadHours`.
 * - `passing`: one reached Mars less than `CME_WINDOW.behindHours` ago.
 * - `quiet`: no arrival in that window. `arrival` is the next one after it, if any.
 */
export type MarsSpaceWeather = {
  level: 'arriving' | 'passing' | 'quiet';
  arrival: MarsArrival | null;
  /** Hours from now to `arrival`: negative once it has passed. */
  hours: number | null;
};

export function marsSpaceWeather(arrivals: readonly MarsArrival[], now: Date): MarsSpaceWeather {
  const t = now.getTime();
  const hoursTo = (arrival: MarsArrival) => (Date.parse(arrival.arrivalTime) - t) / 3_600_000;

  const arriving = arrivals
    .filter((arrival) => hoursTo(arrival) >= 0 && hoursTo(arrival) <= CME_WINDOW.aheadHours)
    .sort((a, b) => hoursTo(a) - hoursTo(b))[0];
  if (arriving) return { level: 'arriving', arrival: arriving, hours: hoursTo(arriving) };

  const passing = arrivals
    .filter((arrival) => hoursTo(arrival) < 0 && hoursTo(arrival) >= -CME_WINDOW.behindHours)
    .sort((a, b) => hoursTo(b) - hoursTo(a))[0];
  if (passing) return { level: 'passing', arrival: passing, hours: hoursTo(passing) };

  const next = arrivals.find((arrival) => hoursTo(arrival) > CME_WINDOW.aheadHours) ?? null;
  return { level: 'quiet', arrival: next, hours: next ? hoursTo(next) : null };
}
