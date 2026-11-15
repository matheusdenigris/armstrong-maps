/**
 * Places inside a site that NASA publishes with their coordinates: where Perseverance took each
 * sample, where it left the tubes of the Three Forks depot, and where the Ingenuity helicopter
 * landed after each flight.
 *
 * Nothing here is placed by eye. A point is on the map only because a NASA file gives its
 * latitude and longitude, and each set says what that position is the position of.
 */
import { formatDistance } from '@/mission/format';
import type { LatLon } from '@/mission/geo';

export type PointSetId = 'targets' | 'samples' | 'depot' | 'flights';

export type MissionPoint = {
  id: string;
  set: PointSetId;
  point: LatLon;
  name: string;
  /** The published facts about the place, one short line each. */
  lines: readonly string[];
  /** Where its facts were published, when that is not the source of the whole set. */
  source?: string;
  /** What the crew could do there: a suggestion of this project, not a NASA plan. */
  task?: string;
};

export type PointSet = {
  id: PointSetId;
  name: string;
  /** What a point of the set is, and what its position is the position of. */
  reads: string;
  /** Who publishes it, in a few words. */
  source: string;
  /** The address the app reads at run time. Absent when the points are copied into the code. */
  feed?: string;
};

const LAYERS = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json';

/** The file the NASA location map draws its sample markers from. */
export const SAMPLE_SITES_FEED = `${LAYERS}/M20_SAMPLE_v3.json`;
/** One record per Ingenuity flight, with where it landed. */
export const HELICOPTER_FEED = `${LAYERS}/m20_heli_waypoints.json`;
/** The table the depot positions below were copied from, and its citation. */
export const SAMPLE_DEPOT_TABLE =
  'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_depot_three_forks/miscellaneous/sample_metadata/sample_tube_locations.csv';
export const SAMPLE_DEPOT_DOI = '10.17189/wmc5-cw60';
/** Where the corrected position of a sample comes from. */
export const SAMPLE_DOSSIER =
  'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_dossier/initial_reports/initial_reports_volume4.pdf';

export const POINT_SETS: Readonly<Record<PointSetId, PointSet>> = {
  targets: {
    id: 'targets',
    name: 'Science targets',
    reads:
      'Places where Curiosity stopped to do science. Each mark is where NASA says the rover stood on that sol.',
    source: 'NASA/JPL-Caltech, Curiosity location feed',
  },
  samples: {
    id: 'samples',
    name: 'Sample sites',
    reads: 'Where Perseverance cored rock, scooped regolith or sealed a tube of air.',
    source: 'NASA/JPL-Caltech, Mars 2020 location map',
    feed: SAMPLE_SITES_FEED,
  },
  depot: {
    id: 'depot',
    name: 'Sample depot',
    reads:
      'The ten tubes left on the ground at Three Forks. Each mark is where the rover stood when it dropped the tube.',
    source: 'NASA Planetary Data System, Mars 2020 sample depot',
  },
  flights: {
    id: 'flights',
    name: 'Ingenuity flights',
    reads: 'Where the helicopter landed after each flight.',
    source: 'NASA/JPL-Caltech, Mars 2020 location map',
    feed: HELICOPTER_FEED,
  },
};

/** The sets each site has. A site that is not listed has none: NASA publishes none for it. */
export const SITE_POINT_SETS: Readonly<Record<string, readonly PointSetId[]>> = {
  gale: ['targets'],
  jezero: ['samples', 'depot', 'flights'],
};

type Properties = Record<string, unknown>;

const featuresOf = (raw: unknown): Properties[] => {
  const features = (raw as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => (feature as { properties?: Properties } | null)?.properties)
    .filter((properties): properties is Properties => typeof properties === 'object' && properties !== null);
};
const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown): string | null => {
  const string = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  // The files join the words of a few names with underscores.
  const clean = string.replaceAll('_', ' ').trim();
  return clean === '' || clean.toLowerCase() === 'n/a' ? null : clean;
};
const position = (lat: unknown, lon: unknown): LatLon | null => {
  const latitude = finite(lat);
  const longitude = finite(lon);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lon: longitude };
};

/**
 * Positions the sample file gets wrong, with the value NASA prints elsewhere.
 *
 * In `M20_SAMPLE_v3.json` (checked on 2026-11-14) the record of Lefroy Bay carries the latitude
 * and longitude of the sample before it, while its own easting and northing are different. The
 * Sample Dossier in the Planetary Data System (Initial Reports, volume 4) prints the position
 * below, which is also what that easting and northing convert to. It is used only while the file
 * still repeats the neighbour; a sample in the same state with no entry here is left off the map.
 */
export const SAMPLE_POSITION_FIXES: Readonly<Record<string, LatLon>> = {
  'Lefroy Bay': { lat: 18.48867278, lon: 77.34704595 },
};

/**
 * The sample sites in the NASA map file. Two samples taken from one rock share one record there,
 * and one mark here.
 */
export function parseSampleSites(raw: unknown): MissionPoint[] {
  const points: MissionPoint[] = [];
  let before: { lat: number; lon: number; easting: unknown; northing: unknown } | null = null;

  for (const properties of featuresOf(raw)) {
    const name = text(properties.sample_name);
    const number = text(properties.sample_num);
    const published = position(properties.lat, properties.lon);
    if (!name || !number || !published) continue;

    // The same degrees as the record before, from a different place on the ground: a copy.
    const repeated =
      before !== null &&
      before.lat === published.lat &&
      before.lon === published.lon &&
      (before.easting !== properties.easting || before.northing !== properties.northing);
    before = { ...published, easting: properties.easting, northing: properties.northing };
    const fixed = repeated ? SAMPLE_POSITION_FIXES[name] : undefined;
    if (repeated && !fixed) continue;

    const kind = [text(properties.sample_type), text(properties.rock_type)].filter(Boolean);
    const outcrop = text(properties.outcrop_name);
    const area = text(properties.sample_location);
    const sol = text(properties.sol);
    const date = text(properties.date);
    const dated = sol !== null && sol !== 'TBD';

    points.push({
      id: `sample-${number.replaceAll(' ', '')}`,
      set: 'samples',
      point: fixed ?? published,
      name,
      lines: [
        ...(kind.length > 0 ? [kind.join(' · ')] : []),
        ...(outcrop || area
          ? [[outcrop ? `Outcrop ${outcrop}` : null, area].filter(Boolean).join(' · ')]
          : []),
        dated
          ? `Sample ${number} · sol ${sol}${date ? ` · ${date}` : ''}`
          : `Sample ${number} · sol and date not published`,
        ...(fixed ? ['Position from the PDS sample dossier; the map file repeats its neighbour here'] : []),
      ],
    });
  }
  return points;
}

/**
 * Where the helicopter landed after each flight. The file also has a record numbered 0, with no
 * distance and no time in the air, for the helicopter standing where it was set down; it is left
 * out, because the first flight landed on the same spot.
 */
export function parseHelicopterFlights(raw: unknown): MissionPoint[] {
  const flights: { flight: number; point: MissionPoint }[] = [];

  for (const properties of featuresOf(raw)) {
    const flight = finite(properties.Flight);
    const landed = position(properties.Lat, properties.Lon);
    if (flight === null || flight < 1 || !landed) continue;

    const airfield = text(properties.ToAirfld);
    const sol = finite(properties.Sol);
    const date = text(properties.Earth_Date);
    const metres = finite(properties.Dist_m);
    const seconds = finite(properties.Duration_s);
    const height = finite(properties.Max_Alt_m);
    const when = [sol !== null ? `Sol ${sol}` : null, date].filter(Boolean).join(' · ');
    const flown = [
      metres !== null ? `${formatDistance(metres)} over the ground` : null,
      seconds !== null ? `${Math.round(seconds)} s in the air` : null,
      height !== null ? `up to ${height} m` : null,
    ].filter(Boolean);

    flights.push({
      flight,
      point: {
        id: `flight-${flight}`,
        set: 'flights',
        point: landed,
        name: `Flight ${flight}`,
        lines: [
          ...(airfield ? [`Landed at ${airfield}`] : []),
          ...(when ? [when] : []),
          ...(flown.length > 0 ? [flown.join(' · ')] : []),
        ],
      },
    });
  }

  flights.sort((one, other) => one.flight - other.flight);
  const last = flights[flights.length - 1];
  if (last) last.point = { ...last.point, lines: [...last.point.lines, 'The last flight in the file'] };
  return flights.map((entry) => entry.point);
}

/**
 * The Three Forks depot, copied on 2026-11-14 from `sample_tube_locations.csv` of the Mars 2020
 * sample depot bundle in the Planetary Data System (see SAMPLE_DEPOT_TABLE and SAMPLE_DEPOT_DOI).
 * The table has not changed since 2024, and its server does not let a browser read it, so the
 * ten rows are here: designation, name, sol of the drop, latitude, longitude.
 *
 * The bundle says what the positions are: "Locations of the rover during sample tube drop
 * events". They are not surveyed positions of the tubes.
 */
const DEPOT_ROWS: readonly (readonly [string, string, number, number, number])[] = [
  ['M2020-00337-08', 'Malay', 653, 18.45262651, 77.40775601],
  ['M2020-00579-17', 'Mageik', 655, 18.4525234, 77.40784692],
  ['M2020-00639-21', 'Crosswind Lake', 661, 18.45267034, 77.408056],
  ['M2020-00164-02', 'Roubion', 666, 18.45276569, 77.40807823],
  ['M2020-00271-06', 'Coulettes', 668, 18.45272365, 77.4082],
  ['M2020-00190-03', 'Montdenier', 672, 18.45281322, 77.40824352],
  ['M2020-00516-15', 'Bearwallow', 675, 18.45272753, 77.40833585],
  ['M2020-00495-12', 'Skyland', 680, 18.45300487, 77.4085047],
  ['M2020-00374-10', 'Atsah', 682, 18.45306554, 77.40860064],
  ['M2020-00586-18', 'Amalik Witness', 690, 18.45337179, 77.40844668],
];

export const SAMPLE_DEPOT: readonly MissionPoint[] = DEPOT_ROWS.map(
  ([designation, name, sol, lat, lon]) => ({
    id: `depot-${designation}`,
    set: 'depot' as const,
    point: { lat, lon },
    name: `${name} tube`,
    lines: [
      'Three Forks sample depot',
      `Dropped on sol ${sol} · ${designation}`,
      'Position of the rover at the drop, not of the tube',
    ],
  }),
);
