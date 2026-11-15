/**
 * The pages of the docs, as data. Each page is a title, a lead and sections of blocks; the screen
 * at `/docs` draws them and builds the navigation from them. The data pages are generated from
 * `sources.ts`, and the guide reads its numbers from the mission code and the catalogues, so what
 * is written here follows the code.
 */
import type { IconName } from '@/components/docs/icon';
import { CLOCK_RATES, DEFAULT_RATE } from '@/mission/clock';
import { formatLatLon } from '@/mission/format';
import { MARS_RADIUS_M } from '@/mission/geo';
import { WORK_PLAYBACK } from '@/mission/progress';
import { LOW_MARGIN_HOURS } from '@/mission/safety';
import { RELIEF_EXAGGERATION, RELIEF_HEIGHT, RELIEF_WIDTH } from '@/mission/relief';
import { WALK_ASSUMPTIONS } from '@/mission/walk';

import { COVERAGE, COVERAGE_READ_ON } from './coverage';
import { GLOBAL_LAYERS, type LayerKind } from './layers';
import { PANORAMAS, SCENE_EVERY_M, SCENE_MIN_SECONDS } from './panoramas';
import { SURFACE_RADIATION } from './radiation';
import { SITES } from './sites';
import { MARS_WIND } from './sounds';
import { CME_WINDOW, DONKI_WINDOW_DAYS } from './space-weather';
import { NASA_SOURCES, OTHER_SOURCES, SOURCES, KIND_LABELS, type DataSource } from './sources';
import { STALE_AFTER_DAYS } from './weather';

/** How serious a line of a `levels` block is. */
export type Level = 'go' | 'caution' | 'no-go' | 'warning';

export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'steps'; items: readonly { title: string; text: string }[] }
  | {
      kind: 'cards';
      items: readonly {
        icon: IconName;
        title: string;
        text: string;
        /** Another page of the docs. */
        page?: string;
        /** A screen of the app, by its address. */
        href?: string;
        nasa?: boolean;
      }[];
    }
  | { kind: 'stats'; items: readonly { value: string; label: string }[] }
  | { kind: 'levels'; items: readonly { level: Level; title: string; text?: string }[] }
  | {
      kind: 'layers';
      items: readonly {
        name: string;
        tag: string;
        source: string;
        reads: string;
        /** The colour key, for a layer whose colour stands for a quantity. */
        key?: { colors: readonly string[]; low: string; high: string; quantity: string };
      }[];
    }
  | { kind: 'flow'; items: readonly string[] }
  | { kind: 'callout'; tone: 'note' | 'warning' | 'nasa'; title: string; text: string }
  | { kind: 'code'; label: string; text: string }
  | { kind: 'table'; rows: readonly (readonly [string, string])[] }
  | { kind: 'link'; label: string; url: string };

export type Section = { id: string; title: string; blocks: readonly Block[] };

export type DocPage = {
  id: string;
  /** The tab and the group of the navigation it sits in. */
  tab: 'guide' | 'data';
  group: string;
  icon: IconName;
  title: string;
  /** The short line under the title. */
  lead: string;
  /** A NASA source page is marked with the NASA colour. */
  nasa?: boolean;
  sections: readonly Section[];
};

export const DOC_TABS = [
  { id: 'guide', label: 'Guide' },
  { id: 'data', label: 'Data and APIs' },
] as const;

const REPOSITORY = 'https://github.com/matheusdenigris/armstrong-maps';
/** The mean radius every distance is worked out on, as the docs write it. */
const MARS_RADIUS_KM = (MARS_RADIUS_M / 1000).toFixed(1);

const a = WALK_ASSUMPTIONS;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const reserve = percent(a.reserveFraction);
const nearLimit = percent(a.nearLimitFraction);
const lowMarginMinutes = Math.round(LOW_MARGIN_HOURS * 60);
const speeds = CLOCK_RATES.map((rate) => (rate === 1 ? 'real time' : `${rate}x`)).join(', ');
const playedStopSeconds = Math.round((a.minutesPerStop * 60) / WORK_PLAYBACK / DEFAULT_RATE);

const LAYER_TAGS: Record<LayerKind, string> = {
  optical: 'Optical',
  topographic: 'Topographic',
  thermal: 'Thermal',
  spectral: 'Spectral',
};

const closeUps = SITES.reduce((count, site) => count + site.layers.length, 0);
const liveSources = SOURCES.filter((source) => source.kind === 'live').length;
/** The width of one cell of the relief grid at the equator, in whole kilometres. */
const reliefCellKm = Math.round((2 * Math.PI * MARS_RADIUS_M) / RELIEF_WIDTH / 1000);
const keyedSources = SOURCES.filter((source) => source.key !== 'None').length;
const siteNames = SITES.map((site) => site.name.split(' ')[0]);
const siteList = `${siteNames.slice(0, -1).join(', ')} or ${siteNames[siteNames.length - 1]}`;
const photographsAt = (siteId: string) => PANORAMAS.filter((item) => item.site === siteId).length;
const sitesWithRover = SITES.filter((site) => site.rover).map((site) => site.name).join(' and ');

const GUIDE: DocPage[] = [
  {
    id: 'about',
    tab: 'guide',
    group: 'Getting started',
    icon: 'book',
    title: 'About Armstrong Maps',
    lead: 'A layered map of Mars for planning a walk on the surface and following it, built on NASA data.',
    sections: [
      {
        id: 'what',
        title: 'What it is',
        blocks: [
          {
            kind: 'text',
            text: 'A crew on Mars needs one map that answers three questions before anyone steps outside: where are we going, is it safe today, and can we get back. Armstrong Maps stacks NASA orbital and rover data over five landing sites and turns a tapped route into a go, caution or no-go verdict, with the reasons.',
          },
          {
            kind: 'text',
            text: 'It is an entry for the Interplanetary Survival Guide: Martian Map challenge of the NASA Space Apps Challenge 2026. It runs on Android, iOS and the web from the same code.',
          },
          {
            kind: 'stats',
            items: [
              { value: String(SITES.length), label: 'landing sites' },
              { value: String(GLOBAL_LAYERS.length + closeUps), label: 'map layers from Mars Trek' },
              { value: `${NASA_SOURCES.length} of ${SOURCES.length}`, label: 'sources are NASA\'s' },
              { value: String(PANORAMAS.length), label: 'real 360-degree photographs' },
            ],
          },
        ],
      },
      {
        id: 'how',
        title: 'How a walk is checked',
        blocks: [
          { kind: 'flow', items: ['Pick a site', 'Tap the route', 'Read the verdict', 'Walk it, from the ship and the visor'] },
          {
            kind: 'steps',
            items: [
              { title: 'Pick a landing site', text: `${siteList}, on the globe or in the list.` },
              { title: 'Tap the route', text: 'Each tap adds a waypoint. The return to the base is a straight line.' },
              { title: 'Read the verdict', text: 'Life support, the walk-back limit, the radiation dose and space weather decide it.' },
              { title: 'Walk it', text: 'Start the simulated walk in the console and follow it in the astronaut visor.' },
            ],
          },
        ],
      },
      {
        id: 'views',
        title: 'The three views',
        blocks: [
          {
            kind: 'cards',
            items: [
              { icon: 'globe', title: 'Globe', text: 'Mars from orbit, in the daylight it has now, with its relief, the landing sites and a pale patch on every area with close-up imagery. Choose a site and fly down to it.', page: 'globe' },
              { icon: 'map', title: 'Ship console', text: 'The map of a site with its layers, the route, the verdict and the live data.', page: 'console' },
              { icon: 'helmet', title: 'Astronaut visor', text: 'First person: life support, the way back, the next waypoint and alerts over a real rover panorama.', page: 'visor' },
              { icon: 'satellite', title: 'NASA data', text: 'Every map, rover, weather and space weather source, with the address the app calls.', page: 'data-overview' },
            ],
          },
          {
            kind: 'callout',
            tone: 'nasa',
            title: 'Built on NASA data',
            text: `${NASA_SOURCES.length} of the ${SOURCES.length} sources the app reads are NASA's. Each number on screen carries its source or a label that says it is simulated or assumed.`,
          },
        ],
      },
      {
        id: 'next',
        title: 'Where to go next',
        blocks: [
          {
            kind: 'cards',
            items: [
              { icon: 'route', title: 'Plan your first walk', text: 'From the globe to a walk the visor follows, in five steps.', page: 'first-walk' },
              { icon: 'shield', title: 'The verdict', text: 'What makes a walk a go, a caution or a no-go.', page: 'verdict' },
              { icon: 'eye', title: 'Measured, assumed or simulated', text: 'Which numbers are data and which are choices of this project.', page: 'honest-data' },
              { icon: 'blocks', title: 'How it is built', text: 'The parts of the code and the rules they keep.', page: 'architecture' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'first-walk',
    tab: 'guide',
    group: 'Getting started',
    icon: 'route',
    title: 'Plan your first walk',
    lead: 'From the globe to a walk the visor follows, in five steps.',
    sections: [
      {
        id: 'steps',
        title: 'Step by step',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Open a site', text: 'Pick Gale Crater on the globe or in the bar of sites. The view flies down and the map opens on the landing point, where the base stands.' },
              { title: 'Mark waypoints', text: `Click or tap the map: each press adds a waypoint, and the leg under the pointer is previewed before you press. Stay inside the dashed ring: it is the ${a.walkBackLimitKm} km walk-back limit.` },
              { title: 'Read the verdict', text: 'The Walk panel gives the verdict with its reasons, the distance out and back, the time outside, the life support used and the dose. Undo removes the last waypoint and Clear removes them all.' },
              { title: 'Add layers', text: 'In the Layers panel, switch on relief or infrared to see the ground the route crosses. Each layer has an opacity, and a colour key appears on the map.' },
              { title: 'Start the walk', text: 'Press Start the walk. The astronaut visor opens in a new tab and the walk starts when it has loaded. Pause in the console and the visor holds.' },
            ],
          },
          {
            kind: 'cards',
            items: [{ icon: 'map', title: 'Open the map of Gale Crater', text: 'Try it now: the console opens on Bradbury Landing.', href: '/site/gale' }],
          },
        ],
      },
      {
        id: 'tabs',
        title: 'The panels of the console',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Layers', 'Optical, topographic, thermal and spectral layers, each with a switch, an opacity and a colour key.'],
              ['Walk', 'The verdict, its reasons, the numbers of the walk and the controls of the simulated walk.'],
              ['Site', 'Weather from Curiosity, the radiation average, space weather from DONKI and the rover.'],
              ['Photos', 'The newest raw images of the rover and archive pictures from the NASA library.'],
            ],
          },
          {
            kind: 'text',
            text: 'On a wide screen the layers sit in one panel and Walk, Site and Photos share the other, behind three tabs. On a phone the map fills the screen and Map, Layers, Walk, Site and Photos are tabs at the foot: each one opens as a sheet over the map.',
          },
        ],
      },
    ],
  },
  {
    id: 'verdict',
    tab: 'guide',
    group: 'Getting started',
    icon: 'shield',
    title: 'The go, caution or no-go verdict',
    lead: 'How the app decides whether a planned walk fits the limits, and what each reason means.',
    sections: [
      {
        id: 'numbers',
        title: 'What goes into it',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Distance', 'From the base through every waypoint, plus a straight line from the last one back to the base. Measured on Mars, not on the map.'],
              ['Time outside', `The distance at ${a.walkingSpeedKmh} km/h, plus ${a.minutesPerStop} min of work at each waypoint.`],
              ['Life support used', `The time outside as a share of the ${a.lifeSupportHours} h the suit lasts.`],
              ['Radiation dose', `The time outside at ${SURFACE_RADIATION.msvPerDay} mSv a day.`],
              ['Farthest from base', 'The greatest straight-line distance between a waypoint and the base.'],
            ],
          },
        ],
      },
      {
        id: 'reasons',
        title: 'Reasons',
        blocks: [
          {
            kind: 'levels',
            items: [
              { level: 'go', title: 'The walk fits the limits', text: 'None of the reasons below applies.' },
              { level: 'no-go', title: 'Longer than the life support', text: `The walk takes more than the ${a.lifeSupportHours} h the suit lasts.` },
              { level: 'no-go', title: 'Beyond the walk-back limit', text: `A waypoint is more than ${a.walkBackLimitKm} km from the base.` },
              { level: 'caution', title: 'Into the reserve', text: `The walk uses part of the ${reserve} of life support that must be left on return.` },
              { level: 'caution', title: 'Near the walk-back limit', text: `A waypoint is past ${nearLimit} of the walk-back limit.` },
              { level: 'caution', title: 'A CME is forecast at Mars', text: `NASA's WSA-Enlil model forecasts a coronal mass ejection reaching Mars within ${CME_WINDOW.aheadHours} h, or one arrived in the last ${CME_WINDOW.behindHours} h, and it is not rated minor or a glancing blow.` },
            ],
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'The dose',
            text: `Every walk counts ${SURFACE_RADIATION.msvPerDay} mSv a day, the average Curiosity's RAD measured at Gale. A CME adds a caution, not a dose: DONKI forecasts its arrival, not what it brings.`,
          },
        ],
      },
      {
        id: 'not-counted',
        title: 'What does not change it yet',
        blocks: [
          {
            kind: 'list',
            items: [
              'Daylight and the weather. They are shown in the Site panel and in the visor, and the verdict leaves them out.',
              'Arrivals the model rates minor or a glancing blow. Most forecasts at Mars are one or the other; they are listed in the Site panel.',
              'Slopes and obstacles. The terrain is taken as flat, so a climb does not slow the walk.',
              'A feed that does not answer. Without DONKI the verdict leaves space weather out, and the Site panel says so.',
            ],
          },
          {
            kind: 'cards',
            items: [
              { icon: 'bell', title: 'Alerts during the walk', text: 'What the helmet says once the walk is under way.', page: 'alerts' },
              { icon: 'sliders', title: 'Project assumptions', text: 'The values behind every limit on this page.', page: 'assumptions' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'globe',
    tab: 'guide',
    group: 'Using the app',
    icon: 'globe',
    title: 'The globe',
    lead: 'The entry screen: Mars from orbit, with the places a mission has landed.',
    sections: [
      {
        id: 'use',
        title: 'Using it',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Drag', 'Turns the planet. Let go and it starts turning by itself again.'],
              ['Pinch or wheel', 'Moves the view closer to the surface or away from it.'],
              ['Point at a site', 'Its name, mission, science and coordinates appear beside the globe.'],
              ['Press a site', 'On the planet or in the bar at the foot: the view flies down to it and its map opens.'],
            ],
          },
          {
            kind: 'text',
            text: 'The planet is textured with the Viking colour mosaic, the same imagery that is the base of every map. The marks of the landing sites lie on the ground.',
          },
        ],
      },
      {
        id: 'shows',
        title: 'What it shows',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Day and night', 'The lit side is where it is day on Mars at this moment. The place where the Sun is overhead comes from the Mars24 algorithm of NASA GISS, the same one behind the Mars clock of a site, and it is worked out again every minute.'],
              ['Relief', `The surface is raised with the MOLA and HRSC blended elevation model, on a grid of ${RELIEF_WIDTH} by ${RELIEF_HEIGHT} heights (about ${reliefCellKm} km a cell at the equator). It is drawn ${RELIEF_EXAGGERATION} times taller than it is: at true scale Olympus Mons would be a pixel or two.`],
              ['Pale patches', `Each soft, pale patch on the ground is an area where Mars Trek publishes a regional image mosaic: ${COVERAGE.length} of them, from CTX, HiRISE and HRSC, read from the Mars Trek catalogue on ${COVERAGE_READ_ON} by a script. The five landing sites are among them. A patch fades towards its edge, and an area under 1.6° across is drawn that wide so it can be seen.`],
            ],
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'If the heights do not arrive',
            text: 'The globe stays a smooth sphere, and the line under it no longer names the relief.',
          },
        ],
      },
      {
        id: 'limits',
        title: 'What is decoration',
        blocks: [
          {
            kind: 'list',
            items: [
              'The stars behind the globe are not a star catalogue.',
              'The night side of the globe is lit faintly so the ground and the sites can be read; a real night on Mars is dark.',
              'The glow round the planet is a hint of its thin atmosphere, not a measurement.',
            ],
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'On Android and iOS',
            text: 'The globe is on the web for now. The phone apps open on the same sites as a list.',
          },
        ],
      },
    ],
  },
  {
    id: 'console',
    tab: 'guide',
    group: 'Using the app',
    icon: 'map',
    title: 'The ship console',
    lead: 'The seat of the crew that stays in the ship: the map of a site, the route, the verdict and the live data.',
    sections: [
      {
        id: 'map',
        title: 'The map',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Drag', 'Moves the map, with one finger or the mouse.'],
              ['Pinch or wheel', 'Zooms around the fingers or the pointer. The + and - buttons zoom by a step.'],
              ['Click or tap', 'Marks a waypoint. With a mouse, the next leg is previewed under the pointer.'],
              ['Recentre', 'Brings the view back to where the map opened, on the base.'],
              ['Scale bar', `Measured on Mars (mean radius ${MARS_RADIUS_KM} km), not on the Earth the map libraries assume. The map opens at 200 m.`],
              ['Coordinates', 'Shown as latitude and longitude from 0 to 360 degrees east.'],
            ],
          },
          {
            kind: 'text',
            text: 'The map never shows the empty space beside the planet: the view stops at the edge of the imagery.',
          },
        ],
      },
      {
        id: 'drawn',
        title: 'What is drawn on it',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Base', 'On the landing point of the mission at the site.'],
              ['Route', 'From the base through the waypoints, with the straight return as a dashed line.'],
              ['Walk-back ring', `${a.walkBackLimitKm} km round the base: the farthest a waypoint may be.`],
              ['Rover', `The published traverse and the latest position, at ${sitesWithRover}.`],
              ['Astronaut', 'While a walk runs, where the simulated astronaut is on the route.'],
              ['Colour key', 'For every layer that is on and whose colour stands for a quantity.'],
            ],
          },
        ],
      },
      {
        id: 'walk',
        title: 'Playing the walk',
        blocks: [
          {
            kind: 'text',
            text: `Start the walk opens the astronaut visor in a new tab and waits for it to load. The console can play the walk at ${speeds}; it starts at ${DEFAULT_RATE}x. The route is locked while the walk runs, and End the walk unlocks it.`,
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'Stops are played faster',
            text: `The work at a waypoint is played ${WORK_PLAYBACK} times faster than the walking, so a ${a.minutesPerStop}-minute stop takes about ${playedStopSeconds} seconds on screen at the default speed. The plan, the mission clock, life support and the dose still count the whole stop.`,
          },
          {
            kind: 'cards',
            items: [
              { icon: 'layers', title: 'Map layers', text: 'Every layer, what it reads and its colour key.', page: 'layers' },
              { icon: 'helmet', title: 'The astronaut visor', text: 'The same walk from inside the helmet.', page: 'visor' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'layers',
    tab: 'guide',
    group: 'Using the app',
    icon: 'layers',
    title: 'Map layers',
    lead: 'What each layer of the map shows, which spacecraft took it and how to read its colours.',
    sections: [
      {
        id: 'planet',
        title: 'Layers of the whole planet',
        blocks: [
          {
            kind: 'layers',
            items: GLOBAL_LAYERS.map((layer) => ({
              name: layer.name,
              tag: LAYER_TAGS[layer.kind],
              source: layer.source,
              reads: layer.reads,
              key: layer.legend
                ? {
                    colors: layer.legend.colors,
                    low: layer.legend.low,
                    high: layer.legend.high,
                    quantity: layer.legend.unit
                      ? `${layer.legend.quantity} (${layer.legend.unit})`
                      : layer.legend.quantity,
                  }
                : undefined,
            })),
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'A colour is not a number',
            text: 'Mars Trek does not publish the calibration from colour to value for these tiles. The colour keys give low and high, and a span of values only where the science source publishes one.',
          },
        ],
      },
      {
        id: 'close-up',
        title: 'Close-up imagery of each site',
        blocks: [
          {
            kind: 'table',
            rows: SITES.map(
              (site) =>
                [
                  site.name,
                  site.layers.map((layer) => `${layer.name} (${layer.source})`).join(', then '),
                ] as const,
            ),
          },
          {
            kind: 'text',
            text: 'The regional mosaics are about 6 m per pixel and the high-resolution ones about 25 cm per pixel, enough to see single rocks and dunes. The map moves from one to the next as you zoom in, and keeps the tiles it has while the sharper ones arrive.',
          },
        ],
      },
      {
        id: 'tiles',
        title: 'How the tiles are addressed',
        blocks: [
          {
            kind: 'text',
            text: 'Mars Trek serves equirectangular tiles, not the Web Mercator of Earth maps. Level L has 2^(L+1) columns and 2^L rows, and the map of the app is equirectangular too.',
          },
          {
            kind: 'code',
            label: 'GET',
            text: 'https://trek.nasa.gov/tiles/Mars/EQ/{product}/1.0.0/default/default028mm/{level}/{row}/{column}.{jpg|png}',
          },
          {
            kind: 'cards',
            items: [
              { icon: 'layers', title: 'Mars Trek map tiles', text: 'The service, its limits and its credit.', page: 'mars-trek-tiles', nasa: true },
              { icon: 'database', title: 'Mars Trek product descriptions', text: 'Where the id, the format and the deepest level of each product come from.', page: 'mars-trek-capabilities', nasa: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'visor',
    tab: 'guide',
    group: 'Using the app',
    icon: 'helmet',
    title: 'The astronaut visor',
    lead: 'The walk from inside the helmet: a real photograph of the site, and on the display what keeps the astronaut alive.',
    sections: [
      {
        id: 'what',
        title: 'What it is',
        blocks: [
          {
            kind: 'text',
            text: 'The visor is the second seat of the same walk. It opens in another tab when the console starts the walk, and it only reads the mission: the ship starts, pauses and ends it. The two tabs have to be in the same browser.',
          },
          {
            kind: 'text',
            text: 'Through the glass is a real 360-degree photograph taken by a rover at that site, which you turn with the mouse or a finger. The lower rim of the helmet holds the instruments.',
          },
        ],
      },
      {
        id: 'display',
        title: 'On the display',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Life support', 'How much is left, as time and as a share used.'],
              ['Way back to base', 'The time a straight walk home takes from where the astronaut is.'],
              ['Time to spare', 'What is left before turning back becomes mandatory.'],
              ['Next waypoint', 'Its bearing, its distance and the time of arrival.'],
              ['Heading', 'A compass tape that turns with the view.'],
              ['Round map', 'The route and the base, turned so that ahead is up.'],
              ['Mission clock', 'Time outside against the time planned, and the waypoints done.'],
              ['Dose', 'The radiation picked up so far and the rate it is counted at.'],
              ['Weather', 'Air temperature and pressure, only where there is a station: Gale Crater.'],
            ],
          },
          {
            kind: 'cards',
            items: [{ icon: 'bell', title: 'Alerts during the walk', text: 'When the helmet raises a caution or a warning, and how the time to spare is worked out.', page: 'alerts' }],
          },
        ],
      },
      {
        id: 'photographs',
        title: 'The photographs',
        blocks: [
          {
            kind: 'stats',
            items: [
              { value: String(photographsAt('gale')), label: 'at Gale Crater' },
              { value: String(photographsAt('jezero')), label: 'at Jezero Crater' },
              { value: String(photographsAt('gusev')), label: 'at Gusev Crater' },
              { value: `${SCENE_EVERY_M} m`, label: 'walked between scenes' },
            ],
          },
          {
            kind: 'text',
            text: `Each photograph is a mosaic taken from one fixed spot. To give the sense of ground being covered, the visor goes through the photographs of the site in order, from the one taken nearest to the landing point outwards, and changes scene every ${SCENE_EVERY_M} m walked. Played fast, a scene still stays at least ${SCENE_MIN_SECONDS} seconds. Meridiani and Elysium borrow the photographs of Gale, and the visor says so.`,
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'Real pictures, illustrative framing',
            text: 'The photographs are real and from that site, but they were not taken on the planned route, and only one is lined up with the compass. The move into the picture and the dust between two scenes are drawn. The visor says how far from the simulated position each photograph was taken.',
          },
          {
            kind: 'cards',
            items: [{ icon: 'image', title: 'Visor panoramas', text: 'The catalogue of photographs and where each one comes from.', page: 'visor-photographs', nasa: true }],
          },
        ],
      },
      {
        id: 'sound',
        title: 'Sound',
        blocks: [
          {
            kind: 'text',
            text: `The Sound button plays wind recorded on Mars by the SuperCam microphone of Perseverance, on ${MARS_WIND.when}. It starts only from a press, plays on a loop and is louder than the file NASA publishes, because wind is faint in air a hundredth as dense as the Earth's. It was recorded at Jezero; at the other sites the visor says it was not recorded there.`,
          },
          {
            kind: 'cards',
            items: [{ icon: 'sound', title: 'Wind recorded on Mars', text: 'The recording, its credit and what the app does to it.', page: 'mars-wind-sound', nasa: true }],
          },
        ],
      },
    ],
  },
  {
    id: 'alerts',
    tab: 'guide',
    group: 'Using the app',
    icon: 'bell',
    title: 'Alerts during the walk',
    lead: 'What the helmet says once the walk is under way, and the one number behind most of it: the time to spare.',
    sections: [
      {
        id: 'margin',
        title: 'The time to spare',
        blocks: [
          {
            kind: 'code',
            label: 'src/mission/safety.ts',
            text: 'time to spare = life support left - reserve - time to walk straight back to the base',
          },
          {
            kind: 'text',
            text: `The reserve is ${reserve} of the ${a.lifeSupportHours} h of life support, and the way back is a straight line at ${a.walkingSpeedKmh} km/h, like the return leg of the plan. At zero the astronaut has to turn back now; below zero they would arrive with less than the reserve.`,
          },
        ],
      },
      {
        id: 'list',
        title: 'The alerts',
        blocks: [
          {
            kind: 'levels',
            items: [
              { level: 'warning', title: 'Life support exhausted', text: 'Nothing is left.' },
              { level: 'warning', title: 'Turn back now', text: 'The time to spare is zero or less: the way home will use the reserve.' },
              { level: 'warning', title: 'Beyond the walk-back limit', text: `The astronaut is more than ${a.walkBackLimitKm} km from the base.` },
              { level: 'caution', title: 'Turn back within a given time', text: `Less than ${lowMarginMinutes} minutes to spare.` },
              { level: 'caution', title: 'Into the reserve', text: `Life support is below the ${reserve} reserve.` },
              { level: 'caution', title: 'Near the walk-back limit', text: `Past ${nearLimit} of the limit.` },
            ],
          },
          {
            kind: 'text',
            text: 'Everything that applies is shown, the most serious first. The mission code returns numbers and alert codes; the visor only writes the sentences.',
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'Assumptions, not NASA rules',
            text: 'Every limit here comes from the walk assumptions of this project. The astronaut and the clock are simulated.',
          },
        ],
      },
    ],
  },
  {
    id: 'sites',
    tab: 'guide',
    group: 'Using the app',
    icon: 'pin',
    title: 'Landing sites',
    lead: 'The five places the app covers. Each is where a NASA mission touched down, so its position and its imagery are published data.',
    sections: [
      {
        id: 'open',
        title: 'Open a site',
        blocks: [
          {
            kind: 'cards',
            items: SITES.map((site) => ({
              icon: 'pin' as const,
              title: site.name,
              text: `${site.mission}. ${site.science}`,
              href: `/site/${site.id}`,
            })),
          },
        ],
      },
      {
        id: 'where',
        title: 'Where the base stands',
        blocks: [
          {
            kind: 'table',
            rows: SITES.map(
              (site) => [site.name, `${site.landing.name}, ${formatLatLon(site.landing, 2)}`] as const,
            ),
          },
          {
            kind: 'text',
            text: 'The base of a simulated walk stands on the landing point of the mission. Longitudes are stored from -180 to 180 and shown from 0 to 360 degrees east.',
          },
        ],
      },
      {
        id: 'differences',
        title: 'What differs from site to site',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Rover traverse', `Published live for ${sitesWithRover}, the two sites with a working rover.`],
              ['Weather', `Measured at Gale Crater only. At the other sites it is shown as a reference, with the distance to the station. A reading older than ${STALE_AFTER_DAYS} days is called out as old.`],
              ['Close-up imagery', 'A regional mosaic everywhere; a high-resolution one at every site but Elysium Planitia.'],
              ['Visor photographs', 'Gale, Jezero and Gusev have their own. Meridiani and Elysium borrow the ones from Gale.'],
              ['Radiation', 'The same published average everywhere: it was measured at Gale.'],
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'honest-data',
    tab: 'guide',
    group: 'Trust',
    icon: 'eye',
    title: 'Measured, assumed or simulated',
    lead: 'The app mixes real data with simulation, and always says which is which.',
    sections: [
      {
        id: 'labels',
        title: 'The four labels',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Measured', 'Map imagery, rover traverses and pictures, weather at Gale and the radiation average, each with its source and date.'],
              ['Forecast', 'CME arrivals at Mars, from the WSA-Enlil model run by NASA\'s CCMC. Not a reading on Mars.'],
              ['Assumption', 'Choices of this project, not NASA rules: walking speed, life support, the walk-back limit, the CME window.'],
              ['Simulated', 'The walk itself: nobody is walking the route, and the base stands on the landing point.'],
            ],
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'A gap is shown as a gap',
            text: 'When a source does not answer, the app says so and leaves the value out. It never fills it with a made-up number.',
          },
        ],
      },
      {
        id: 'measured',
        title: 'Measured, and how fresh',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Weather', `The latest sol the station feed has. It can be weeks behind, so the app shows the sol, the Earth date and the age of the reading, and calls it old after ${STALE_AFTER_DAYS} days.`],
              ['Radiation', `${SURFACE_RADIATION.msvPerDay} ± ${SURFACE_RADIATION.uncertaintyMsvPerDay} mSv per Earth day: a published average over about 300 sols at Gale, not a live reading. RAD has no public feed.`],
              ['Space weather', `The last ${DONKI_WINDOW_DAYS} days of model runs, kept on the device for a few hours. Solar particle events are seen near the Earth, not at Mars.`],
              ['Rover', 'The traverse and the latest position, read each time the site opens.'],
            ],
          },
        ],
      },
      {
        id: 'simulated',
        title: 'Simulated',
        blocks: [
          {
            kind: 'list',
            items: [
              'The walk: the position of the astronaut, the heading, the time outside, life support and the dose all follow the plan at the assumed speed.',
              `The work at a waypoint is played ${WORK_PLAYBACK} times faster than the walking. The plan and the mission clock still count the whole stop.`,
              'The base stands on the landing point of the mission at each site.',
            ],
          },
        ],
      },
      {
        id: 'illustrative',
        title: 'Illustrative',
        blocks: [
          {
            kind: 'list',
            items: [
              'The photographs in the visor are real, but they were not taken on the planned route. The visor says how far away each one was taken.',
              'Within a scene the view moves slowly into a still picture. Nothing in it shifts against anything else, as it would on a real walk.',
              'The change of scene is a gust of dust that rises over the view and clears on the next photograph. The dust is drawn.',
              'The picture does not rise and fall with the steps. When the device asks for reduced motion, it does not move into the photograph either.',
              'Only one photograph has a caption that says where north is. The others are not lined up with the compass, and the visor says which case it is.',
              'Where a mosaic has no frame for a patch of sky, the visor draws the sky in the colours beside it. The ground is never filled in: a gap in it stays black.',
              'The wind was recorded at Jezero and plays at every site, louder than published.',
            ],
          },
        ],
      },
      {
        id: 'decoration',
        title: 'Decoration',
        blocks: [
          {
            kind: 'list',
            items: [
              'The stars behind the globe are not a star catalogue.',
              'The night side of the globe is lit faintly so the ground and the sites can be read; a real night on Mars is dark.',
              'The glow round the planet is a hint of its thin atmosphere, not a measurement.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'assumptions',
    tab: 'guide',
    group: 'Trust',
    icon: 'sliders',
    title: 'Project assumptions',
    lead: 'The values the team chose. They are plausible for a suited walk, and they are not NASA requirements.',
    sections: [
      {
        id: 'values',
        title: 'Values',
        blocks: [
          {
            kind: 'stats',
            items: [
              { value: `${a.walkingSpeedKmh} km/h`, label: 'walking speed in a suit' },
              { value: `${a.lifeSupportHours} h`, label: 'life support' },
              { value: `${a.walkBackLimitKm} km`, label: 'walk-back limit' },
              { value: `${a.minutesPerStop} min`, label: 'at each waypoint' },
            ],
          },
          {
            kind: 'table',
            rows: [
              ['Walking speed', `${a.walkingSpeedKmh} km/h in a suit over rough ground`],
              ['Time at each waypoint', `${a.minutesPerStop} min`],
              ['Life support', `${a.lifeSupportHours} h, with ${reserve} kept in reserve`],
              ['Walk-back limit', `${a.walkBackLimitKm} km from the base, with a warning past ${nearLimit}`],
              ['Low time to spare', `A caution under ${lowMarginMinutes} min before the turn-back point`],
              ['CME window', `${CME_WINDOW.aheadHours} h before a forecast arrival to ${CME_WINDOW.behindHours} h after`],
            ],
          },
          {
            kind: 'text',
            text: 'They live in src/mission/walk.ts, src/mission/safety.ts and src/data/space-weather.ts: change them there and every number in the app, and on these pages, follows.',
          },
        ],
      },
      {
        id: 'simplifications',
        title: 'Simplifications',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Return leg', 'A straight line from the last waypoint to the base.'],
              ['Terrain', 'Flat: slopes and obstacles do not slow the walk.'],
              ['Dose', 'The published average at every site and at every hour.'],
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'architecture',
    tab: 'guide',
    group: 'Project',
    icon: 'blocks',
    title: 'How it is built',
    lead: 'One codebase for Android, iOS and the web, with the mission logic kept apart from the screens.',
    sections: [
      {
        id: 'parts',
        title: 'The parts',
        blocks: [
          { kind: 'flow', items: ['NASA service', 'Parser in src/data', 'Mission code', 'Screen, with its source'] },
          {
            kind: 'table',
            rows: [
              ['src/mission', 'Distances on Mars, tiles, the camera of the map, the walk, its clock and its safety. Pure TypeScript with tests: no React, no device APIs.'],
              ['src/data', 'The catalogues (sites, layers, photographs, sources) and a small tested parser for each feed.'],
              ['src/state', 'The mission saved on the device, and the reading of the feeds.'],
              ['src/components', 'The globe, the map, the panels and the pieces of the visor.'],
              ['src/app', 'The screens: the globe, the console of a site, the visor and these docs.'],
            ],
          },
        ],
      },
      {
        id: 'rules',
        title: 'Rules the code keeps',
        blocks: [
          {
            kind: 'list',
            items: [
              `Mars is not the Earth. Every distance comes from the mission code, on a sphere of ${MARS_RADIUS_KM} km; none is taken from a map library.`,
              'The mission code returns numbers and reason codes. The screens turn them into sentences.',
              'Tiles and the map are equirectangular, not Web Mercator.',
              'A feed that fails reaches the screen as a gap, never as a guess.',
              'Every number on screen has a source or a label: simulated, or assumption.',
            ],
          },
        ],
      },
      {
        id: 'link',
        title: 'The ship and the visor',
        blocks: [
          {
            kind: 'text',
            text: 'The ship owns the walk: only the console starts, pauses or ends it, and the visor reads the state. The clock does not tick. It stores a moment and how much walk time had passed by then, so every tab works out the same time from its own clock.',
          },
          {
            kind: 'text',
            text: 'The mission is saved on the device, and the two tabs follow each other through the saved state and the storage event of the browser. That is why both have to be in the same browser: a link between two devices is not built yet.',
          },
        ],
      },
      {
        id: 'web',
        title: 'On the web',
        blocks: [
          {
            kind: 'text',
            text: 'The web version is a static export: every page is rendered ahead of time and served as files, with no server of its own. The app calls the NASA services straight from the device, and keeps the DONKI answers for a few hours because that service limits calls.',
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'Photographs are not textures',
            text: 'The NASA image library does not let its files be used as WebGL textures, so the visor wraps the real mosaic round the astronaut with plain strips of the picture instead of a 3D scene.',
          },
        ],
      },
    ],
  },
  {
    id: 'run',
    tab: 'guide',
    group: 'Project',
    icon: 'terminal',
    title: 'Run it yourself',
    lead: 'The code is public. It needs Node and nothing else to run on the web.',
    sections: [
      {
        id: 'start',
        title: 'Start',
        blocks: [
          { kind: 'code', label: 'Install and start', text: 'npm install\nnpm start' },
          {
            kind: 'text',
            text: 'npm start runs the Expo dev server: press w for the web or a for Android. To run on a phone, install Expo Go and scan the code it prints.',
          },
          { kind: 'link', label: 'The code on GitHub', url: REPOSITORY },
        ],
      },
      {
        id: 'commands',
        title: 'Commands',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['npm run web', 'The web version only.'],
              ['npm test', 'The unit tests of the mission code and of the feed parsers.'],
              ['npm run check', 'The English-only gate, the typecheck, the lint and the tests. Run it before calling a change done.'],
              ['npm run build:web', 'The static web export, into dist.'],
            ],
          },
          {
            kind: 'cards',
            items: [{ icon: 'key', title: 'The NASA API key', text: 'Only space weather needs one, and the app works without it.', page: 'nasa-key' }],
          },
        ],
      },
    ],
  },
  {
    id: 'nasa-key',
    tab: 'guide',
    group: 'Project',
    icon: 'key',
    title: 'The NASA API key',
    lead: 'Which sources need a key, and what happens without one.',
    sections: [
      {
        id: 'key',
        title: 'Setting the key',
        blocks: [
          {
            kind: 'text',
            text: `Only api.nasa.gov takes a key (DONKI space weather). The app asks for the last ${DONKI_WINDOW_DAYS} days and keeps the answer on the device for a few hours. Every other source needs no key.`,
          },
          { kind: 'code', label: '.env.local or the Vercel project', text: 'EXPO_PUBLIC_NASA_API_KEY=your-key-from-api.nasa.gov' },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'The key is public',
            text: 'The web app is a static export, so the key ends up in the page. Use a key made for this app only. Without one the app falls back to DEMO_KEY, which allows only a few calls an hour per visitor.',
          },
          { kind: 'link', label: 'Get a key at api.nasa.gov', url: 'https://api.nasa.gov/' },
        ],
      },
    ],
  },
  {
    id: 'testing',
    tab: 'guide',
    group: 'Project',
    icon: 'phone',
    title: 'Testing on phones',
    lead: 'What is checked on real devices, and how a problem is reported.',
    sections: [
      {
        id: 'checked',
        title: 'What is checked',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Globe', 'It turns without stuttering, a drag does not scroll the page, and a site flies down to its map.'],
              ['Map', 'Tiles load, one finger drags, two pinch, a tap adds a waypoint, and nothing hides under the browser bar.'],
              ['Sheets and tabs', 'Each panel scrolls inside itself, layers switch on and off, and a colour key shows for each one.'],
              ['The walk', 'The verdict follows the waypoints; Start, Pause, Resume and End work; every number has its label.'],
              ['Visor', 'Numbers stay readable over a bright sky, outdoors and on a small screen, upright and sideways.'],
              ['General', 'Larger system text, a weak signal, and five minutes of use without the phone freezing.'],
            ],
          },
          {
            kind: 'text',
            text: 'The minimum is one Android phone with Chrome and one iPhone with Safari, on each of the five sites.',
          },
        ],
      },
      {
        id: 'report',
        title: 'Reporting a problem',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Open an issue', text: 'New issue, then Device test finding.' },
              { title: 'Fill the form', text: 'The device, the screen, the steps, what was expected, what happened and a screenshot.' },
              { title: 'Label it', text: 'The interface or the data and logic, so it reaches the right person.' },
            ],
          },
          { kind: 'link', label: 'Issues on GitHub', url: `${REPOSITORY}/issues` },
        ],
      },
      {
        id: 'not-built',
        title: 'Not built yet',
        blocks: [
          {
            kind: 'list',
            items: [
              'The globe inside the Android and iOS apps: they open on the list of sites.',
              'The link between two different devices: the console and the visor have to be two tabs of one browser.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'roadmap',
    tab: 'guide',
    group: 'Project',
    icon: 'flag',
    title: 'Roadmap',
    lead: 'How the work is grouped. The issues on GitHub are the source of truth.',
    sections: [
      {
        id: 'milestones',
        title: 'Milestones',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Foundation', text: 'The Expo app, the checks, the English-only gate, the web deploy and the Android build.' },
              { title: 'Mars globe', text: 'The entry screen: a 3D globe with coverage areas and landing sites.' },
              { title: 'Surface map and layers', text: 'A touch map of each site with NASA layers and the rover traverse.' },
              { title: 'Safety and environment', text: 'Weather, radiation, daylight and the go, caution or no-go verdict.' },
              { title: 'Walk planning', text: 'Tap a route, get distance, time, life support and dose.' },
              { title: 'Astronaut visor', text: 'The first-person view with compass, round map and vitals.' },
              { title: 'Ship and astronaut link', text: 'What the ship changes shows up in the visor.' },
              { title: 'Mobile release', text: 'Icons, offline use, device testing and the store build.' },
              { title: 'Hackathon submission', text: 'What Space Apps asks for: project page, demo, credits.' },
            ],
          },
        ],
      },
      {
        id: 'order',
        title: 'Order of work',
        blocks: [
          {
            kind: 'list',
            items: [
              'Foundation first: nothing ships without the build and the gates.',
              'The surface map and the walk verdict are the core of the challenge, so they come before the globe is polished.',
              'The visor reads the same mission state as the console, so it follows walk planning.',
              'Mobile release and the submission run alongside from the first working screen.',
            ],
          },
          { kind: 'link', label: 'Milestones on GitHub', url: `${REPOSITORY}/milestones` },
        ],
      },
    ],
  },
  {
    id: 'credits',
    tab: 'guide',
    group: 'Project',
    icon: 'code',
    title: 'Software and credits',
    lead: 'What the app is built with, and how AI was used.',
    sections: [
      {
        id: 'software',
        title: 'Software',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Expo and React Native', 'The app on Android, iOS and the web'],
              ['Expo Router', 'The screens and their addresses'],
              ['three.js', 'The globe, on WebGL'],
              ['Zustand', 'The mission state, saved on the device'],
              ['TypeScript, Vitest and ESLint', 'Strict types, the unit tests and the lint'],
              ['Michroma, Space Grotesk, JetBrains Mono', 'The three typefaces, from Google Fonts'],
            ],
          },
        ],
      },
      {
        id: 'data',
        title: 'Data',
        blocks: [
          {
            kind: 'text',
            text: 'The imagery, the rover data, the photographs, the recording of wind and the space weather belong to their sources, and each is credited where it is shown. The full list, with addresses and limits, is under Data and APIs.',
          },
          {
            kind: 'cards',
            items: [{ icon: 'satellite', title: 'Data and APIs', text: `All ${SOURCES.length} sources, NASA first.`, page: 'data-overview' }],
          },
        ],
      },
      {
        id: 'ai',
        title: 'Use of AI',
        blocks: [
          {
            kind: 'text',
            text: 'The app is developed with the help of Claude (Anthropic) working as a coding agent under the team\'s direction. No AI-generated image, sound or dataset is presented as NASA data.',
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'No official link to NASA',
            text: 'Armstrong Maps is a NASA Space Apps Challenge 2026 project. It does not use the NASA logotype or insignia. The code is under the MIT License; the data belongs to its sources.',
          },
        ],
      },
    ],
  },
];

/** The icon of each source page. */
const SOURCE_ICONS: Record<string, IconName> = {
  'mars-trek-tiles': 'layers',
  'mars-trek-capabilities': 'database',
  'rover-waypoints': 'route',
  'donki-enlil': 'sun',
  'donki-sep': 'radiation',
  'raw-images': 'camera',
  'image-library': 'image',
  'visor-photographs': 'helmet',
  'mars-wind-sound': 'sound',
  'rems-weather': 'thermometer',
  'rad-average': 'radiation',
  'mars-radius': 'ruler',
  'elevation-models': 'mountain',
  'dune-fields': 'wind',
  'insight-wind': 'wind',
};

export const sourceIcon = (source: DataSource): IconName => SOURCE_ICONS[source.id] ?? 'satellite';

function sourcePage(source: DataSource): DocPage {
  return {
    id: source.id,
    tab: 'data',
    group: source.nasa ? 'NASA sources' : 'Other references',
    icon: sourceIcon(source),
    title: source.name,
    lead: source.gives,
    nasa: source.nasa,
    sections: [
      {
        id: 'in-the-app',
        title: 'In the app',
        blocks: [{ kind: 'text', text: source.usedIn }],
      },
      {
        id: 'endpoint',
        title: source.kind === 'published' ? 'Citation' : 'Endpoint',
        blocks: [
          { kind: 'code', label: source.kind === 'published' ? 'Reference' : 'GET', text: source.endpoint },
          {
            kind: 'table',
            rows: [
              ['Publisher', source.publisher],
              ['Kind', KIND_LABELS[source.kind].toLowerCase()],
              ['Key', source.key],
            ],
          },
        ],
      },
      {
        id: 'notes',
        title: 'Notes and limits',
        blocks: [
          { kind: 'callout', tone: source.nasa ? 'nasa' : 'note', title: 'Good to know', text: source.notes },
          { kind: 'link', label: 'Read more at the source', url: source.reference },
        ],
      },
    ],
  };
}

const DATA_OVERVIEW: DocPage = {
  id: 'data-overview',
  tab: 'data',
  group: 'Overview',
  icon: 'satellite',
  title: 'Data and APIs',
  lead: 'Every source the app reads, NASA first. Open one for the address it calls, its key and its limits.',
  sections: [
    {
      id: 'path',
      title: 'From NASA to the screen',
      blocks: [
        {
          kind: 'stats',
          items: [
            { value: String(SOURCES.length), label: 'sources' },
            { value: String(NASA_SOURCES.length), label: 'published by NASA' },
            { value: String(liveSources), label: 'read live, each time' },
            { value: String(keyedSources), label: 'take the api.nasa.gov key' },
          ],
        },
        { kind: 'flow', items: ['NASA service', 'Parser in src/data', 'Mission code', 'Screen, with its source'] },
        {
          kind: 'text',
          text: 'Each feed is read by a small parser with tests, kept apart from the screens. A feed that does not answer reaches the screen as a gap, not as a guess.',
        },
        {
          kind: 'table',
          rows: [
            ['Live', 'Read by the app every time it runs.'],
            ['Published value', 'A number from a paper or a standard, written into the code with its citation.'],
            ['Catalogue', 'Read by the team when the code was written, and copied into it.'],
          ],
        },
      ],
    },
    {
      id: 'nasa',
      title: 'NASA sources',
      blocks: [
        {
          kind: 'cards',
          items: NASA_SOURCES.map((source) => ({
            icon: sourceIcon(source),
            title: source.name,
            text: source.usedIn,
            page: source.id,
            nasa: source.nasa,
          })),
        },
      ],
    },
    {
      id: 'other',
      title: 'Other references',
      blocks: [
        {
          kind: 'cards',
          items: OTHER_SOURCES.map((source) => ({
            icon: sourceIcon(source),
            title: source.name,
            text: source.usedIn,
            page: source.id,
            nasa: source.nasa,
          })),
        },
      ],
    },
  ],
};

export const DOC_PAGES: readonly DocPage[] = [
  ...GUIDE,
  DATA_OVERVIEW,
  ...NASA_SOURCES.map(sourcePage),
  ...OTHER_SOURCES.map(sourcePage),
];

export const findDocPage = (id: string | undefined): DocPage =>
  DOC_PAGES.find((page) => page.id === id) ?? DOC_PAGES[0];

/** Everything a block says, for the search. */
function blockText(block: Block): string {
  switch (block.kind) {
    case 'text':
      return block.text;
    case 'list':
    case 'flow':
      return block.items.join(' ');
    case 'steps':
    case 'cards':
      return block.items.map((item) => `${item.title} ${item.text}`).join(' ');
    case 'levels':
      return block.items.map((item) => `${item.title} ${item.text ?? ''}`).join(' ');
    case 'stats':
      return block.items.map((item) => `${item.value} ${item.label}`).join(' ');
    case 'layers':
      return block.items.map((item) => `${item.name} ${item.tag} ${item.source} ${item.reads}`).join(' ');
    case 'callout':
      return `${block.title} ${block.text}`;
    case 'code':
      return `${block.label} ${block.text}`;
    case 'table':
      return block.rows.map((row) => row.join(' ')).join(' ');
    case 'link':
      return block.label;
  }
}

const SEARCH_TEXT = new Map(
  DOC_PAGES.map((page) => [
    page.id,
    [
      page.title,
      page.lead,
      page.group,
      ...page.sections.flatMap((section) => [section.title, ...section.blocks.map(blockText)]),
    ]
      .join(' ')
      .toLowerCase(),
  ]),
);

/** The pages that say every word of `query` somewhere: a match in the title first. */
export function searchDocs(query: string): DocPage[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const found = DOC_PAGES.filter((page) =>
    words.every((word) => SEARCH_TEXT.get(page.id)!.includes(word)),
  );
  const inTitle = (page: DocPage) => words.every((word) => page.title.toLowerCase().includes(word));
  return [...found.filter(inTitle), ...found.filter((page) => !inTitle(page))];
}

/** The pages of a tab, grouped in navigation order. */
export function docGroups(tab: DocPage['tab']): { group: string; pages: DocPage[] }[] {
  const groups: { group: string; pages: DocPage[] }[] = [];
  for (const page of DOC_PAGES.filter((item) => item.tab === tab)) {
    const last = groups[groups.length - 1];
    if (last?.group === page.group) last.pages.push(page);
    else groups.push({ group: page.group, pages: [page] });
  }
  return groups;
}
