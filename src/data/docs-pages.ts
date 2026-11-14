/**
 * The pages of the docs, as data. Each page is a title, a lead and sections of blocks; the screen
 * at `/docs` draws them and builds the navigation from them. The data pages are generated from
 * `sources.ts`, so the addresses shown are the ones the code calls.
 */
import type { IconName } from '@/components/docs/icon';
import { WALK_ASSUMPTIONS } from '@/mission/walk';

import { SURFACE_RADIATION } from './radiation';
import { CME_WINDOW, DONKI_WINDOW_DAYS } from './space-weather';
import { KIND_LABELS, NASA_SOURCES, OTHER_SOURCES, SOURCES, type DataSource } from './sources';

export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'steps'; items: readonly { title: string; text: string }[] }
  | {
      kind: 'cards';
      items: readonly { icon: IconName; title: string; text: string; page?: string; nasa?: boolean }[];
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

const a = WALK_ASSUMPTIONS;

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
              { title: 'Pick a landing site', text: 'Gale, Jezero, Meridiani, Gusev or Elysium, on the globe or in the list.' },
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
              { icon: 'globe', title: 'Globe', text: 'Mars in 3D with the regions where high-resolution mosaics exist. Choose a site and fly down to it.' },
              { icon: 'map', title: 'Ship console', text: 'The map of a site with its layers, the route, the verdict and the live data.', page: 'first-walk' },
              { icon: 'helmet', title: 'Astronaut visor', text: 'First person: heading, next waypoint, life support and dose over a real rover panorama.' },
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
    ],
  },
  {
    id: 'first-walk',
    tab: 'guide',
    group: 'Getting started',
    icon: 'route',
    title: 'Plan your first walk',
    lead: 'From the list of sites to a walk the visor follows, in five steps.',
    sections: [
      {
        id: 'steps',
        title: 'Step by step',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Open a site', text: 'Choose Gale Crater in the list. The map opens on the landing point, where the base stands.' },
              { title: 'Add waypoints', text: `Tap the map. Stay inside the dashed ring: it is the ${a.walkBackLimitKm} km walk-back limit.` },
              { title: 'Open the panel', text: 'Press More. The Walk tab gives distance, time outside, life support used and the dose.' },
              { title: 'Add layers', text: 'In the Layers tab, switch on relief or infrared to see the ground the route crosses.' },
              { title: 'Start the walk', text: 'Press Start the walk, then open the astronaut visor. Pause in one and the other stops.' },
            ],
          },
        ],
      },
      {
        id: 'tabs',
        title: 'The tabs of the panel',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['Walk', 'The verdict, its reasons, the numbers of the walk and the controls of the simulated walk.'],
              ['Layers', 'Optical, topographic, thermal and spectral layers, each with a switch, an opacity and a colour key.'],
              ['Site', 'Weather from Curiosity, the radiation average, space weather from DONKI and the rover.'],
              ['Photos', 'The newest raw images of the rover and archive pictures from the NASA library.'],
            ],
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
        id: 'reasons',
        title: 'Reasons',
        blocks: [
          {
            kind: 'table',
            rows: [
              ['No-go', `The walk takes longer than the ${a.lifeSupportHours} h of life support.`],
              ['No-go', `A waypoint is more than ${a.walkBackLimitKm} km from the base.`],
              ['Caution', `The walk uses part of the ${Math.round(a.reserveFraction * 100)}% life-support reserve.`],
              ['Caution', `A waypoint is past ${Math.round(a.nearLimitFraction * 100)}% of the walk-back limit.`],
              ['Caution', `NASA's WSA-Enlil model forecasts a CME hitting Mars within ${CME_WINDOW.aheadHours} h.`],
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
            kind: 'table',
            rows: [
              ['Walking speed', `${a.walkingSpeedKmh} km/h in a suit over rough ground`],
              ['Time at each waypoint', `${a.minutesPerStop} min`],
              ['Life support', `${a.lifeSupportHours} h, with ${Math.round(a.reserveFraction * 100)}% kept in reserve`],
              ['Walk-back limit', `${a.walkBackLimitKm} km from the base, with a warning past ${Math.round(a.nearLimitFraction * 100)}%`],
              ['CME window', `${CME_WINDOW.aheadHours} h before a forecast arrival to ${CME_WINDOW.behindHours} h after`],
            ],
          },
          {
            kind: 'text',
            text: 'They live in src/mission/walk.ts and src/data/space-weather.ts: change them there and every number in the app follows.',
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
            ],
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
        { kind: 'flow', items: ['NASA service', 'Parser in src/data', 'Mission code', 'Screen, with its source'] },
        {
          kind: 'text',
          text: 'Each feed is read by a small parser with tests, kept apart from the screens. A feed that does not answer reaches the screen as a gap, not as a guess.',
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
