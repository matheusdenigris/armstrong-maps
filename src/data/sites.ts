/**
 * Landing sites with high-resolution coverage on Mars Trek.
 *
 * Each site is a place a NASA mission landed, so its position, its regional mosaics and (for the
 * two active rovers) its traverse are published data. The landing point doubles as the position
 * of the base in a simulated walk.
 */
import type { LatLon } from '@/mission/geo';
import type { Bounds } from '@/mission/tiles';

import { ctxMosaic, hiriseMosaic, type MapLayer } from './layers';

export type Rover = 'curiosity' | 'perseverance';

export type Site = {
  id: string;
  name: string;
  mission: string;
  /** Where the mission touched down. */
  landing: LatLon & { name: string };
  /** The area with regional coverage. */
  region: Bounds;
  /** Why the place matters. */
  science: string;
  /** The rover whose traverse NASA publishes, when there is one. */
  rover?: Rover;
  /** Optical layers of the site, from the widest to the sharpest. */
  layers: readonly MapLayer[];
};

const GALE: Bounds = { west: 135.1842593, south: -6.5732988, east: 139.2413012, north: -2.8077809 };
const JEZERO: Bounds = { west: 75.1537692, south: 15.9058484, east: 78.8717121, north: 19.4453003 };
const MERIDIANI: Bounds = { west: -8.093484, south: -4.8925742, east: -2.8037058, north: -0.6078623 };
const GUSEV: Bounds = { west: 173.2463549, south: -16.2218451, east: 178.4633349, north: -10.9930557 };
const ELYSIUM: Bounds = { west: 133.935732, south: 3.728413, east: 137.2761299, north: 5.0696168 };

export const SITES: readonly Site[] = [
  {
    id: 'gale',
    name: 'Gale Crater',
    mission: 'Curiosity (Mars Science Laboratory), since 2012',
    landing: { lat: -4.589467, lon: 137.441633, name: 'Bradbury Landing' },
    region: GALE,
    science: 'The sedimentary layers of Mount Sharp, a record of ancient water.',
    rover: 'curiosity',
    layers: [
      ctxMosaic('Gale_CTX_BlockAdj_dd', GALE),
      hiriseMosaic(
        'curiosity_hirise_mosaic',
        { west: 137.1224669, south: -4.9254743, east: 137.7298129, north: -4.2489588 },
        16,
      ),
    ],
  },
  {
    id: 'jezero',
    name: 'Jezero Crater',
    mission: 'Perseverance (Mars 2020), since 2021',
    landing: { lat: 18.4447, lon: 77.4508, name: 'Octavia E. Butler Landing' },
    region: JEZERO,
    science: 'The delta of an ancient river, one of the best places to look for signs of past life.',
    rover: 'perseverance',
    layers: [
      ctxMosaic('Jezero_CTX_BlockAdj_dd', JEZERO),
      hiriseMosaic(
        'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',
        { west: 77.2229331, south: 18.3067994, east: 77.583964, north: 18.669315 },
        17,
      ),
    ],
  },
  {
    id: 'meridiani',
    name: 'Meridiani Planum',
    mission: 'Opportunity (Mars Exploration Rover B), 2004 to 2018',
    landing: { lat: -1.9462, lon: -5.5266, name: 'Eagle Crater' },
    region: MERIDIANI,
    science: 'Hematite spherules and sulfates, evidence of acidic water in the past.',
    layers: [
      ctxMosaic('S_Meridiani_Sinus_Planium_CTX_BlockAdj_dd', MERIDIANI),
      hiriseMosaic(
        'opportunity_hirise_mosaic',
        { west: -5.5964391, south: -2.7513281, east: -4.9954112, north: -1.8994384 },
        17,
      ),
    ],
  },
  {
    id: 'gusev',
    name: 'Gusev Crater',
    mission: 'Spirit (Mars Exploration Rover A), 2004 to 2010',
    landing: { lat: -14.5684, lon: 175.4726, name: 'Columbia Memorial Station' },
    region: GUSEV,
    science: 'Silica from hot springs at Home Plate, an environment that could have hosted life.',
    layers: [
      ctxMosaic('Gusev_CTX_BlockAdj_dd', GUSEV),
      hiriseMosaic(
        'spirit_hirise_mosaic',
        { west: 175.4278511, south: -14.6925026, east: 175.5858031, north: -14.5357546 },
        17,
      ),
    ],
  },
  {
    id: 'elysium',
    name: 'Elysium Planitia',
    mission: 'InSight, 2018 to 2022',
    landing: { lat: 4.5024, lon: 135.6234, name: 'InSight landing site' },
    region: ELYSIUM,
    science: 'A smooth plain where InSight measured marsquakes and the interior of the planet.',
    layers: [ctxMosaic('InSightCTXMosaic_112917', ELYSIUM, 13)],
  },
];

export function findSite(id: string): Site | undefined {
  return SITES.find((site) => site.id === id);
}
