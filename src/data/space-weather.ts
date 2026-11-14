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
 * True when the model expects the CME itself to hit Mars. Most forecast arrivals are rated minor
 * or only a glancing blow by the flank: in the 30 days to 2026-11-14 all ten were, and counting
 * them would have kept walks on caution 61% of the time. Those are shown, but they do not change
 * the verdict.
 */
export const isSignificant = (arrival: MarsArrival) => !arrival.minor && !arrival.glancing;

/** An arrival and how far it is from now, in hours (negative once it has passed). */
export type ArrivalAt = { arrival: MarsArrival; hours: number };

/**
 * What the forecast means for a walk now.
 *
 * - `arriving`: a significant CME is forecast to reach Mars within `CME_WINDOW.aheadHours`.
 * - `passing`: one reached Mars less than `CME_WINDOW.behindHours` ago.
 * - `quiet`: no significant arrival in that window.
 *
 * `next` is the significant arrival the level is about (or the next one after the window), and
 * `weak` the nearest minor or glancing arrival inside the window, shown for information only.
 */
export type MarsSpaceWeather = {
  level: 'arriving' | 'passing' | 'quiet';
  next: ArrivalAt | null;
  weak: ArrivalAt | null;
};

export function marsSpaceWeather(arrivals: readonly MarsArrival[], now: Date): MarsSpaceWeather {
  const t = now.getTime();
  const timed = arrivals.map((arrival) => ({
    arrival,
    hours: (Date.parse(arrival.arrivalTime) - t) / 3_600_000,
  }));
  const ahead = (item: ArrivalAt) => item.hours >= 0 && item.hours <= CME_WINDOW.aheadHours;
  const behind = (item: ArrivalAt) => item.hours < 0 && item.hours >= -CME_WINDOW.behindHours;
  const nearest = (items: ArrivalAt[]) =>
    items.sort((a, b) => Math.abs(a.hours) - Math.abs(b.hours))[0] ?? null;

  const strong = timed.filter((item) => isSignificant(item.arrival));
  const weak = nearest(timed.filter((item) => !isSignificant(item.arrival) && (ahead(item) || behind(item))));

  const arriving = nearest(strong.filter(ahead));
  if (arriving) return { level: 'arriving', next: arriving, weak };
  const passing = nearest(strong.filter(behind));
  if (passing) return { level: 'passing', next: passing, weak };
  const later = strong.filter((item) => item.hours > CME_WINDOW.aheadHours).sort((a, b) => a.hours - b.hours)[0] ?? null;
  return { level: 'quiet', next: later, weak };
}
