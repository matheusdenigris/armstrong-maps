/**
 * Every source of data in the app, in one list. The docs page is drawn from it, so the addresses
 * shown there are the ones the code calls.
 *
 * NASA sources come first and carry the most weight: they are the data the app is built on. The
 * others are references a number depends on (a published constant) or partners whose instrument
 * NASA hosts.
 */
import { DUNE_CREDIT } from './dunes';
import { HORIZONS_API, HORIZONS_CREDIT } from './horizons';
import { IMAGE_LIBRARY_API } from './image-library';
import { SURFACE_RADIATION } from './radiation';
import { PANORAMAS } from './panoramas';
import { RAW_IMAGE_FEEDS } from './rover-images';
import { MARS_WIND } from './sounds';
import { ROVERS } from './rover';
import { DONKI_BASE } from './space-weather';
import { REMS_FEED } from './weather';
import { AIR_DENSITY_SOURCE, INSIGHT_CREDIT } from './wind';

export type SourceKind =
  /** Read by the app every time it runs. */
  | 'live'
  /** A published value, written into the code with its citation. */
  | 'published'
  /** Read by the team when the code was written, and copied into it. */
  | 'catalogue';

export type DataSource = {
  id: string;
  name: string;
  /** Who publishes it. */
  publisher: string;
  /** True when NASA (a NASA centre, mission or service) publishes it. */
  nasa: boolean;
  kind: SourceKind;
  /** What the app takes from it. */
  gives: string;
  /** Where it shows up in the app. */
  usedIn: string;
  /** The address the code calls, with its placeholders, or the citation. */
  endpoint: string;
  /** "None", or what key it needs. */
  key: string;
  /** How fresh it is, and its limits. */
  notes: string;
  /** Where to read more. */
  reference: string;
};

export const SOURCES: readonly DataSource[] = [
  {
    id: 'mars-trek-tiles',
    name: 'Mars Trek map tiles (WMTS)',
    publisher: 'NASA/JPL, Solar System Treks',
    nasa: true,
    kind: 'live',
    gives:
      'Every map image: the Viking colour mosaic of the planet, the CTX and HiRISE mosaics of each site, MOLA and HRSC relief, THEMIS infrared and TES composition layers.',
    usedIn: 'The globe, the surface map and the Layers tab.',
    endpoint:
      'https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/default/default028mm/{level}/{row}/{col}.{jpg|png}',
    key: 'None',
    notes:
      'Equirectangular grid: level L has 2^(L+1) columns and 2^L rows. A tile outside a product\'s coverage answers 404.',
    reference: 'https://trek.nasa.gov/mars/',
  },
  {
    id: 'mars-trek-capabilities',
    name: 'Mars Trek product descriptions',
    publisher: 'NASA/JPL, Solar System Treks',
    nasa: true,
    kind: 'catalogue',
    gives: 'The id, image format, deepest level and coverage of every layer.',
    usedIn: 'The layer list in src/data/layers.ts and the site outlines on the globe.',
    endpoint: 'https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/WMTSCapabilities.xml',
    key: 'None',
    notes: 'Checked on 2026-11-14. A new layer is checked here before it is added.',
    reference: 'https://trek.nasa.gov/mars/',
  },
  {
    id: 'elevation-models',
    name: 'Elevation models: slope near the base and around it',
    publisher: 'NASA/JPL Mars Trek image services; MOLA, HRSC and HiRISE teams',
    nasa: true,
    kind: 'live',
    gives:
      'Grids of heights the app turns into slope: 1 m HiRISE models at Gale and Gusev, the InSight mosaic at Elysium, and the 200 m MOLA and HRSC blend everywhere (Fergason et al. 2018).',
    usedIn: 'The steep ground shading on the map, the Hazards card in the Layers tab, and a caution or no-go in the walk verdict.',
    endpoint:
      'https://trek.nasa.gov/mars/trekarcgis/rest/services/{model}/ImageServer/exportImage?bbox={west,south,east,north}&size={w},{h}&format=bsq&pixelType={F32|S16}&f=image',
    key: 'None',
    notes:
      'Raw little-endian heights in metres; -3.4e38 marks no data. Slope is measured over each cell (about 60 m near the base, 200 m around it), so ground can be steeper than the model shows.',
    reference: 'https://trek.nasa.gov/mars/',
  },
  {
    id: 'insight-wind',
    name: 'InSight wind',
    publisher: INSIGHT_CREDIT,
    nasa: true,
    kind: 'live',
    gives: 'Mean, lowest and highest wind speed and the most common direction of the last seven sols InSight sent (October 2020).',
    usedIn: 'The wind panel of the Site tab, as a measurement at Elysium Planitia and a reference elsewhere.',
    endpoint: 'https://api.nasa.gov/insight_weather/?api_key={key}&feedtype=json&ver=1.0',
    key: 'api.nasa.gov key, or the shared DEMO_KEY',
    notes: `The direction is where the wind blew from, within 11.25°. The lander has been silent since 2022. The push of the wind is compared with the Earth using air density: ${AIR_DENSITY_SOURCE}.`,
    reference: 'https://mars.nasa.gov/insight/weather/',
  },
  {
    id: 'jpl-horizons',
    name: 'JPL Horizons: the Sun over each site',
    publisher: HORIZONS_CREDIT,
    nasa: true,
    kind: 'live',
    gives: "The Sun's elevation seen from the landing point, every 10 minutes over three days: sunrise, sunset and how high the Sun is during a walk.",
    usedIn: 'The Mars clock of the Site tab, the daylight line of the safety check, and the daylight reasons of the verdict.',
    endpoint: `${HORIZONS_API}?COMMAND='10'&CENTER='coord@499'&SITE_COORD='{-east lon},{lat},0'&QUANTITIES='4'&STEP_SIZE='10 m'&format=json`,
    key: 'None',
    notes:
      'Horizons sends no CORS header, so the web app asks through its own forwarder (api/horizons.js); the phone apps ask directly. When it does not answer, the app computes the Sun with the Mars24 algorithm of NASA GISS, which agrees within about a minute.',
    reference: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
  },
  {
    id: 'rover-waypoints',
    name: 'Rover traverses',
    publisher: 'NASA/JPL-Caltech, mars.nasa.gov',
    nasa: true,
    kind: 'live',
    gives: 'The path each rover has driven since landing, and its latest position, sol and distance.',
    usedIn: 'The white line on the Gale and Jezero maps, and the Rover card in the Site tab.',
    endpoint: `${ROVERS.curiosity.feed}\n${ROVERS.perseverance.feed}`,
    key: 'None',
    notes: 'Updated after drives are localised, usually within days.',
    reference: 'https://mars.nasa.gov/msl/mission/where-is-the-rover/',
  },
  {
    id: 'donki-enlil',
    name: 'DONKI: WSA-Enlil CME arrivals at Mars',
    publisher: 'NASA Community Coordinated Modeling Center (Goddard), through api.nasa.gov',
    nasa: true,
    kind: 'live',
    gives:
      'When a coronal mass ejection is forecast to reach Mars. This is a model forecast, not a measurement on Mars.',
    usedIn: 'The space weather card in the Site tab, and a caution in the walk verdict when the model expects a direct hit.',
    endpoint: `${DONKI_BASE}/WSAEnlilSimulations?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}&api_key={key}`,
    key: 'api.nasa.gov key, or the shared DEMO_KEY',
    notes:
      'The app asks for the last 30 days and keeps the answer on the device for 3 hours. Only impacts with location "Mars" are read, and only the latest model run for each CME.',
    reference: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  },
  {
    id: 'donki-sep',
    name: 'DONKI: solar energetic particle events',
    publisher: 'NASA Community Coordinated Modeling Center (Goddard), through api.nasa.gov',
    nasa: true,
    kind: 'live',
    gives: 'Solar particle events of the last 30 days, detected near the Earth.',
    usedIn: 'The space weather card in the Site tab, next to the radiation average.',
    endpoint: `${DONKI_BASE}/SEP?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}&api_key={key}`,
    key: 'api.nasa.gov key, or the shared DEMO_KEY',
    notes: 'Seen near the Earth, so it says how active the Sun is, not what reached Mars.',
    reference: 'https://api.nasa.gov/',
  },
  {
    id: 'raw-images',
    name: 'Rover raw images',
    publisher: 'NASA/JPL-Caltech, mars.nasa.gov',
    nasa: true,
    kind: 'live',
    gives: 'The newest pictures from the navigation, mast and hazard cameras of Curiosity and Perseverance.',
    usedIn: 'The Photos tab at Gale and Jezero.',
    endpoint:
      'https://mars.nasa.gov/rss/api/?feed=raw_images&category={msl|mars2020}&feedtype=json&num=24&page=0&order=sol+desc&search={|CAMERA|CAMERA}',
    key: 'None',
    notes: `Raw, unprocessed frames, often within a day of the downlink. Galleries: ${RAW_IMAGE_FEEDS.curiosity.gallery} and ${RAW_IMAGE_FEEDS.perseverance.gallery}. The old api.nasa.gov Mars Rover Photos service no longer answers.`,
    reference: RAW_IMAGE_FEEDS.perseverance.gallery,
  },
  {
    id: 'image-library',
    name: 'NASA Image and Video Library',
    publisher: 'NASA',
    nasa: true,
    kind: 'live',
    gives: 'Archive pictures of each site, including the ones whose mission has ended.',
    usedIn: 'The Photos tab of every site.',
    endpoint: `${IMAGE_LIBRARY_API}/search?q={site query}&media_type=image`,
    key: 'None',
    notes: 'Ranked by the library\'s own search. Each picture links to its page with the full credit.',
    reference: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf',
  },
  {
    id: 'visor-photographs',
    name: 'Visor panoramas',
    publisher: 'NASA/JPL-Caltech and the camera teams, NASA Image and Video Library',
    nasa: true,
    kind: 'catalogue',
    gives: `The real 360-degree rover panoramas the astronaut stands in: ${PANORAMAS.map((panorama) => panorama.nasaId).join(', ')}.`,
    usedIn: 'The astronaut visor, which switches to the panorama taken nearest to the astronaut.',
    endpoint: PANORAMAS.map((panorama) => `https://images.nasa.gov/details/${panorama.nasaId}`).join(
      '\n',
    ),
    key: 'None',
    notes: 'Each was taken from one fixed spot, so the view does not move forward between two photographs. Listed in src/data/panoramas.ts.',
    reference: 'https://images.nasa.gov',
  },
  {
    id: 'mars-wind-sound',
    name: 'Wind recorded on Mars',
    publisher: MARS_WIND.credit,
    nasa: true,
    kind: 'catalogue',
    gives: `${MARS_WIND.title}, ${MARS_WIND.when}, ${MARS_WIND.seconds} s.`,
    usedIn: 'The Sound button of the astronaut visor, at every site.',
    endpoint: MARS_WIND.url,
    key: 'None',
    notes: 'The NASA file, unchanged, served from the app itself. Recorded at Jezero; played everywhere.',
    reference: MARS_WIND.source,
  },
  {
    id: 'rems-weather',
    name: 'Curiosity REMS weather',
    publisher: 'Centro de Astrobiologia (CSIC-INTA), served by NASA/JPL on mars.nasa.gov',
    nasa: true,
    kind: 'live',
    gives: 'Air and ground temperature, pressure, sky, ultraviolet, sunrise and sunset of the latest sol.',
    usedIn: 'The weather card in the Site tab.',
    endpoint: REMS_FEED,
    key: 'None',
    notes:
      'Measured at Gale only; elsewhere it is a reference. An outreach feed that can be weeks behind today.',
    reference: 'https://mars.nasa.gov/msl/weather/',
  },
  {
    id: 'rad-average',
    name: 'Surface radiation, MSL RAD',
    publisher: 'Hassler et al. 2014, Science 343, 1244797 (Curiosity\'s RAD instrument)',
    nasa: true,
    kind: 'published',
    gives: `The dose equivalent on the surface: ${SURFACE_RADIATION.msvPerDay} ± ${SURFACE_RADIATION.uncertaintyMsvPerDay} mSv per Earth day.`,
    usedIn: 'The dose of every walk, and the radiation card in the Site tab.',
    endpoint: 'Hassler et al. 2014, Science 343, 1244797',
    key: 'None',
    notes: 'An average over about 300 sols at Gale. RAD has no public live feed.',
    reference: 'https://doi.org/10.1126/science.1244797',
  },
  {
    id: 'dune-fields',
    name: 'Dune fields and the wind that shaped them',
    publisher: DUNE_CREDIT,
    nasa: false,
    kind: 'live',
    gives:
      'Outlines of mapped dune fields, and the direction their slip faces face: the prevailing wind at the last time the dunes changed much.',
    usedIn: 'The dune outlines and wind arrows on the map, the wind panel of the Site tab, and a caution in the walk verdict.',
    endpoint:
      'https://trek.nasa.gov/mars/trekarcgis/rest/services/Dune_Field/MapServer/0/query?geometry={west,south,east,north}&returnGeometry=true&f=json',
    key: 'None',
    notes: 'Mapped between 65° S and 65° N from THEMIS and MOC images. USGS data, served by NASA/JPL Mars Trek.',
    reference: 'https://pubs.usgs.gov/of/2007/1158/',
  },
  {
    id: 'mars-radius',
    name: 'Mean radius of Mars',
    publisher: 'IAU Working Group on Cartographic Coordinates and Rotational Elements, Archinal et al. 2018',
    nasa: false,
    kind: 'published',
    gives: 'The 3389.5 km radius every distance on the map is measured with.',
    usedIn: 'Distances, the scale bar and the walk (src/mission/geo.ts).',
    endpoint: 'Archinal et al. 2018, Celestial Mechanics and Dynamical Astronomy 130, 22',
    key: 'None',
    notes: 'Map libraries assume the Earth; the app never takes a distance from one.',
    reference: 'https://doi.org/10.1007/s10569-017-9805-5',
  },
];

export const NASA_SOURCES = SOURCES.filter((source) => source.nasa);
export const OTHER_SOURCES = SOURCES.filter((source) => !source.nasa);

/** The labels the docs page puts on each kind. */
export const KIND_LABELS: Record<SourceKind, string> = {
  live: 'LIVE',
  published: 'PUBLISHED VALUE',
  catalogue: 'CATALOGUE',
};
