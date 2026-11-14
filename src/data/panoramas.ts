/**
 * Real 360-degree photographs taken by the rovers, used as what the astronaut sees in the visor.
 *
 * They come from NASA's Image and Video Library (images.nasa.gov/details/<nasaId>). Each is a
 * mosaic of many frames taken from one spot, so it wraps all the way round: the left edge meets
 * the right edge. The visor puts the astronaut in the middle of it.
 *
 * What is measured: the picture, the sol it was taken on, and (for Gale and Jezero) the place,
 * read from the rover's published traverse for that sol. What was set by eye for this app: the
 * row of the horizon, the band of the picture that is free of the black gaps of the mosaic, and
 * the colour used to continue the sky above that band.
 */
import { distance, type LatLon } from '@/mission/geo';

export type Panorama = {
  nasaId: string;
  /** Size of the full picture, in pixels. The smaller renditions keep the same shape. */
  width: number;
  height: number;
  /** How far down the picture the horizon is, as a fraction of its height. */
  horizon: number;
  /** The rows the visor shows, as fractions of the height: above and below are gaps or the deck. */
  band: { top: number; bottom: number };
  /** Colour of the sky at the top of the band, to continue it upwards. */
  sky: string;
  /**
   * Where north is, as a fraction of the width, when the caption of the picture says so. Null
   * when it does not: then the picture is real but is not lined up with the compass.
   */
  north: number | null;
  /** What the picture is and when it was taken. */
  caption: string;
  credit: string;
  /** Where it was taken, when the traverse of the rover gives the place for that sol. */
  point: LatLon | null;
  site: string;
};

const file = (id: string, rendition: 'orig' | 'large') =>
  `https://images-assets.nasa.gov/image/${id}/${id}~${rendition}.jpg`;

/** The full picture on a wide screen; a 1920-pixel one on a phone, where the full one is too heavy. */
export function panoramaUrl(panorama: Panorama, wideScreen: boolean): string {
  return file(panorama.nasaId, wideScreen ? 'orig' : 'large');
}

export const PANORAMAS: readonly Panorama[] = [
  {
    nasaId: 'PIA16101',
    width: 14494,
    height: 3560,
    horizon: 0.24,
    band: { top: 0.185, bottom: 0.74 },
    sky: '#e6dccb',
    north: null,
    caption: 'Curiosity Mastcam, the landing site with Mount Sharp, August 2012',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.589467, lon: 137.441633 },
    site: 'gale',
  },
  {
    nasaId: 'PIA20840',
    width: 10000,
    height: 2848,
    horizon: 0.24,
    band: { top: 0.15, bottom: 0.72 },
    sky: '#e3d9cf',
    // "North is at both ends and south is in the center."
    north: 0,
    caption: 'Curiosity Mastcam amid the Murray Buttes, sol 1451 (2016)',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.694173, lon: 137.353128 },
    site: 'gale',
  },
  {
    nasaId: 'PIA22545',
    width: 10000,
    height: 2886,
    horizon: 0.15,
    band: { top: 0.11, bottom: 0.8 },
    sky: '#a98463',
    north: null,
    caption: 'Curiosity Mastcam on Vera Rubin Ridge during a dust storm, sol 2137 (2018)',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.725593, lon: 137.378061 },
    site: 'gale',
  },
  {
    nasaId: 'PIA26019',
    width: 9000,
    height: 2394,
    horizon: 0.27,
    band: { top: 0.17, bottom: 0.72 },
    sky: '#9db3c6',
    north: null,
    caption: 'Curiosity Mastcam below Gediz Vallis Ridge, sol 3928 (2023)',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.773331, lon: 137.400627 },
    site: 'gale',
  },
  {
    nasaId: 'PIA24264',
    width: 9238,
    height: 2451,
    horizon: 0.07,
    band: { top: 0.02, bottom: 0.62 },
    sky: '#a3835f',
    north: null,
    caption: 'Perseverance Mastcam-Z at its landing site, sol 3 (2021)',
    credit: 'NASA/JPL-Caltech/MSSS/ASU',
    point: { lat: 18.444627, lon: 77.450886 },
    site: 'jezero',
  },
  {
    nasaId: 'PIA26369',
    width: 5400,
    height: 1320,
    horizon: 0.22,
    band: { top: 0, bottom: 0.62 },
    sky: '#bcd2e4',
    north: null,
    caption: 'Perseverance Mastcam-Z at Bright Angel, sol 1178 (2024), colour enhanced',
    credit: 'NASA/JPL-Caltech/ASU/MSSS',
    point: { lat: 18.496112, lon: 77.303836 },
    site: 'jezero',
  },
  {
    nasaId: 'PIA16440',
    width: 11174,
    height: 3162,
    horizon: 0.13,
    band: { top: 0, bottom: 0.9 },
    sky: '#a98a62',
    north: null,
    caption: 'Spirit Pancam, the McMurdo panorama from Low Ridge, 2006',
    credit: 'NASA/JPL-Caltech/Cornell',
    // Spirit has no published traverse feed here, so the place is not given.
    point: null,
    site: 'gusev',
  },
];

export type Chosen = {
  panorama: Panorama;
  /** How far from the astronaut it was taken, in metres, when its place is known. */
  awayM: number | null;
  /** The site has no photograph of its own; this one is from Gale. */
  borrowed: boolean;
};

/**
 * The photograph for an astronaut at `position`: of the ones taken at this site, the nearest.
 * A site without any borrows the first one from Gale, and says so.
 */
export function panoramaNear(siteId: string, position: LatLon): Chosen {
  const own = PANORAMAS.filter((panorama) => panorama.site === siteId);
  if (own.length === 0) return { panorama: PANORAMAS[0], awayM: null, borrowed: true };
  let best = own[0];
  let bestM = best.point ? distance(position, best.point) : Number.POSITIVE_INFINITY;
  for (const candidate of own.slice(1)) {
    const away = candidate.point ? distance(position, candidate.point) : Number.POSITIVE_INFINITY;
    if (away < bestM) {
      best = candidate;
      bestM = away;
    }
  }
  return { panorama: best, awayM: Number.isFinite(bestM) ? bestM : null, borrowed: false };
}

/**
 * Where a compass heading falls across the picture, as a fraction of its width. Pictures that are
 * not lined up with the compass put heading 0 at their middle, which keeps the join between the
 * two ends of the mosaic behind the astronaut at first. Turning still turns the view by the right
 * amount, but what is ahead in the picture is not what is ahead on the ground.
 */
export function headingToFraction(panorama: Panorama, heading: number): number {
  const turn = (((heading % 360) + 360) % 360) / 360;
  return (((panorama.north ?? 0.5) + turn) % 1 + 1) % 1;
}
