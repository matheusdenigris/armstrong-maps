/**
 * Real 360-degree photographs taken by the rovers, used as what the astronaut sees in the visor.
 *
 * They come from NASA's Image and Video Library (images.nasa.gov/details/<nasaId>). Each is a
 * mosaic of many frames taken from one spot, so it wraps all the way round: the left edge meets
 * the right edge. The visor puts the astronaut in the middle of it.
 *
 * What is measured: the picture, the sol it was taken on, and (for Gale and Jezero) the place,
 * read from the rover's published traverse for that sol. What was set by eye for this app: the
 * row of the horizon, the band of the picture that is free of the black gaps of the mosaic, the
 * colour used to continue the sky above that band, the patches of sky the mosaic has no frame
 * for inside it, and the stretches where it has no ground.
 *
 * North: the caption of each picture was read in the NASA library and on the JPL Photojournal
 * (photojournal.jpl.nasa.gov/catalog/<nasaId>) on 2026-11-15. Two say where north is, PIA20840
 * and PIA11754, and only those are lined up with the compass. The others do not say, and no
 * pointing comes with the mosaics, so they are left as they are and the visor says so.
 */
import { distance, type LatLon } from '@/mission/geo';

/**
 * A patch of sky inside the band that the mosaic has no frame for. It starts at the top of the
 * band and its lower edge is a straight line. The visor draws the sky there, in the colours the
 * photograph has on either side of it. All four numbers are fractions of the picture.
 */
export type SkyGap = {
  left: number;
  right: number;
  /** How far down the gap reaches at its left and right edges. */
  bottomLeft: number;
  bottomRight: number;
  /** The colour of the sky at the left and at the right of the gap. */
  sky: readonly [string, string];
};

/**
 * A stretch of the picture with nothing to show below `top`: the mosaic has no frame for the
 * ground there, or the rover that took the picture stands in the way. The astronaut is not the
 * rover, so the rover is kept out of the view like a gap. Ground is never drawn in. The visor
 * tilts the view up instead while it faces the stretch, so that what is missing stays under
 * the rim of the helmet. Fractions of the picture.
 */
export type GroundGap = {
  left: number;
  right: number;
  /** The row from which there is nothing to show. */
  top: number;
};

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
  /** Patches of sky inside the band with no frame, where the mosaic has any. */
  skyGaps?: readonly SkyGap[];
  /** Stretches with no ground to show inside the band, where the picture has any. */
  groundGaps?: readonly GroundGap[];
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
    // The rover and the black steps of the mosaic, at the left and the right of the picture. Set by eye on the picture.
    groundGaps: [
      { left: 0, right: 0.03, top: 0.285 },
      { left: 0.03, right: 0.124, top: 0.32 },
      { left: 0.124, right: 0.155, top: 0.39 },
      { left: 0.155, right: 0.26, top: 0.55 },
      { left: 0.26, right: 0.355, top: 0.49 },
      { left: 0.936, right: 0.968, top: 0.55 },
      { left: 0.968, right: 1, top: 0.32 },
    ],
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
    band: { top: 0.155, bottom: 0.72 },
    sky: '#e3d9cf',
    // Measured on the picture: a notch left of the first butte, and a sliver along the top edge
    // of the last quarter.
    skyGaps: [
      { left: 0.064, right: 0.163, bottomLeft: 0.241, bottomRight: 0.185, sky: ['#c7bab1', '#b8b0aa'] },
      { left: 0.765, right: 0.885, bottomLeft: 0.162, bottomRight: 0.18, sky: ['#eff1f2', '#d9d7d6'] },
      { left: 0.885, right: 1, bottomLeft: 0.18, bottomRight: 0.164, sky: ['#d9d7d6', '#cdc5c0'] },
    ],
    // Measured on the picture: the rover deck was masked out, and to the north the frames stop
    // a little below the horizon.
    groundGaps: [
      { left: 0, right: 0.045, top: 0.4 },
      { left: 0.045, right: 0.285, top: 0.5 },
      { left: 0.94, right: 1, top: 0.415 },
    ],
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
    // The rover is in this picture: its mast, its deck and its arm. Set by eye on the picture.
    groundGaps: [
      { left: 0.175, right: 0.245, top: 0.43 },
      { left: 0.245, right: 0.4, top: 0.2 },
      { left: 0.4, right: 0.44, top: 0.44 },
      { left: 0.44, right: 0.615, top: 0.21 },
    ],
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
    // The rover at both ends of the picture. Set by eye on the picture.
    groundGaps: [
      { left: 0, right: 0.055, top: 0.54 },
      { left: 0.94, right: 1, top: 0.44 },
    ],
    north: null,
    caption: 'Curiosity Mastcam below Gediz Vallis Ridge, sol 3928 (2023)',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.773331, lon: 137.400627 },
    site: 'gale',
  },
  {
    nasaId: 'PIA26554',
    width: 3645,
    height: 931,
    horizon: 0.23,
    band: { top: 0.17, bottom: 0.72 },
    sky: '#6b7b8d',
    // The rover and a black step of the mosaic, left of the middle. Set by eye on the picture.
    groundGaps: [
      { left: 0.355, right: 0.44, top: 0.4 },
      { left: 0.44, right: 0.475, top: 0.51 },
    ],
    north: null,
    caption: 'Curiosity Mastcam at the Ubajara sampling site, sol 3815 (2023)',
    credit: 'NASA/JPL-Caltech/MSSS',
    point: { lat: -4.768075, lon: 137.398608 },
    site: 'gale',
  },
  {
    nasaId: 'PIA24264',
    width: 9238,
    height: 2451,
    horizon: 0.07,
    band: { top: 0.02, bottom: 0.62 },
    sky: '#a3835f',
    // The rover is in this picture: its mast and its deck, right of the middle. Set by eye on the picture.
    groundGaps: [
      { left: 0.44, right: 0.485, top: 0.39 },
      { left: 0.485, right: 0.53, top: 0.13 },
      { left: 0.53, right: 0.64, top: 0.19 },
      { left: 0.64, right: 0.745, top: 0.36 },
      { left: 0.745, right: 0.86, top: 0.285 },
    ],
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
    // The rover at the left, and its mast and deck at the right. Set by eye on the picture.
    groundGaps: [
      { left: 0.085, right: 0.19, top: 0.48 },
      { left: 0.76, right: 0.825, top: 0.56 },
      { left: 0.825, right: 0.855, top: 0.29 },
      { left: 0.855, right: 0.965, top: 0.36 },
    ],
    north: null,
    caption: 'Perseverance Mastcam-Z at Bright Angel, sol 1178 (2024), colour enhanced',
    credit: 'NASA/JPL-Caltech/ASU/MSSS',
    point: { lat: 18.496112, lon: 77.303836 },
    site: 'jezero',
  },
  {
    nasaId: 'PIA26474',
    width: 5000,
    height: 1222,
    horizon: 0.2,
    band: { top: 0, bottom: 0.62 },
    sky: '#f0eeec',
    // The rover at the left, and its mast and deck at the right. Set by eye on the picture.
    groundGaps: [
      { left: 0.04, right: 0.155, top: 0.43 },
      { left: 0.755, right: 0.8, top: 0.5 },
      { left: 0.8, right: 0.83, top: 0.225 },
      { left: 0.83, right: 0.925, top: 0.29 },
      { left: 0.925, right: 0.975, top: 0.4 },
    ],
    north: null,
    caption: 'Perseverance Mastcam-Z at Rio Chiquito, sol 1337 (2024), colour enhanced',
    credit: 'NASA/JPL-Caltech/ASU/MSSS',
    point: { lat: 18.46511, lon: 77.286718 },
    site: 'jezero',
  },
  {
    nasaId: 'PIA26644',
    width: 3000,
    height: 733,
    horizon: 0.25,
    band: { top: 0, bottom: 0.6 },
    sky: '#3e73b4',
    // The arm of the rover at the left, and its mast and deck at the right. Set by eye on the picture.
    groundGaps: [
      { left: 0.13, right: 0.215, top: 0.49 },
      { left: 0.8, right: 0.84, top: 0.56 },
      { left: 0.84, right: 0.86, top: 0.41 },
      { left: 0.86, right: 0.89, top: 0.29 },
      { left: 0.89, right: 0.965, top: 0.36 },
      { left: 0.965, right: 0.995, top: 0.49 },
    ],
    north: null,
    caption: 'Perseverance Mastcam-Z at Falbreen, sol 1516 (2025), colour enhanced',
    credit: 'NASA/JPL-Caltech/ASU/MSSS',
    point: { lat: 18.452484, lon: 77.252956 },
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
  {
    // The Santorini panorama: approximate true colour, 276 exposures of the panoramic camera.
    nasaId: 'PIA11754',
    width: 23123,
    height: 4000,
    horizon: 0.114,
    // Under 0.57 the rover deck is masked out in black.
    band: { top: 0, bottom: 0.57 },
    sky: '#dbba6b',
    // The top of the rover's low-gain antenna stands in the foreground here.
    groundGaps: [{ left: 0.668, right: 0.705, top: 0.415 }],
    // "North is in the center of the panorama."
    north: 0.5,
    caption: 'Opportunity Pancam, the Santorini panorama, sols 1716 to 1719 (2008)',
    credit: 'NASA/JPL/Cornell University',
    // About a kilometre southwest of the south rim of Victoria Crater, the caption says.
    // Opportunity has no published traverse feed here, so the place is not given.
    point: null,
    site: 'meridiani',
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

/** How far the astronaut walks, in metres, before the scenery changes. */
export const SCENE_EVERY_M = 120;
/** A scene stays on screen at least this long, in seconds, however fast the walk is played. */
export const SCENE_MIN_SECONDS = 8;

/**
 * The stretch of walking each scene covers when the walk is played at `rate` times real time. At
 * walking pace it is `SCENE_EVERY_M`; played fast, the stretch grows so that the scenery does not
 * flicker past.
 */
export function sceneStretch(walkingSpeedKmh: number, rate: number): number {
  const metresPerSecond = (walkingSpeedKmh * 1000) / 3600;
  return Math.max(SCENE_EVERY_M, metresPerSecond * rate * SCENE_MIN_SECONDS);
}

export type Scene = Chosen & {
  /** Which scene of the walk this is, from 0, and how many the site has. */
  index: number;
  count: number;
};

/**
 * The photographs of a site in the order a walk goes through them: the one taken nearest to the
 * landing point first, then outwards. A site without any borrows the ones from Gale.
 */
export function scenesOf(siteId: string, landing: LatLon): { scenes: Panorama[]; borrowed: boolean } {
  const own = PANORAMAS.filter((panorama) => panorama.site === siteId);
  const borrowed = own.length === 0;
  const pool = borrowed ? PANORAMAS.filter((panorama) => panorama.site === PANORAMAS[0].site) : own;
  // Borrowed scenes keep the order they have at their own site.
  const from = borrowed ? (PANORAMAS[0].point ?? landing) : landing;
  const reach = (panorama: Panorama) =>
    panorama.point ? distance(from, panorama.point) : Number.POSITIVE_INFINITY;
  return { scenes: [...pool].sort((a, b) => reach(a) - reach(b)), borrowed };
}

/**
 * The scenery for an astronaut who has walked `walkedM`. A walk has no film of its own: nobody
 * has walked on Mars. So the visor goes through the real photographs of the site, a new one every
 * `everyM`, to give the sense of ground being covered. Each is real and from this site,
 * but it was not taken on the route, and `awayM` says how far off it was. At the base, before the
 * walk and after it, the scene is always the first.
 */
export function sceneForWalk(
  siteId: string,
  landing: LatLon,
  position: LatLon,
  walkedM: number,
  atBase: boolean,
  everyM: number = SCENE_EVERY_M,
): Scene {
  const { scenes, borrowed } = scenesOf(siteId, landing);
  const index = atBase ? 0 : Math.floor(Math.max(0, walkedM) / everyM) % scenes.length;
  const panorama = scenes[index];
  return {
    panorama,
    awayM: borrowed || !panorama.point ? null : distance(position, panorama.point),
    borrowed,
    index,
    count: scenes.length,
  };
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

const RAD = Math.PI / 180;

/** The lens of the visor, in degrees from top to bottom. A tall phone gets a wider one. */
export const lensDeg = (size: { width: number; height: number }) =>
  size.width < size.height ? 82 : 58;

/** Distance from the eye to the picture, in pixels, for a lens that suits the shape of the screen. */
export function eyeDistance(size: { width: number; height: number }): number {
  return size.height / 2 / Math.tan((lensDeg(size) * RAD) / 2);
}

/**
 * How far below the horizon a row of the picture is, in degrees, seen from the middle of it. The
 * picture is wrapped round the eye, so its width is the whole circle.
 */
export function depressionOf(panorama: Panorama, row: number): number {
  const drop = (row - panorama.horizon) * (panorama.height / panorama.width) * 2 * Math.PI;
  return Math.atan(drop) / RAD;
}

/** Beyond the edge of the view, the tilt eases off over this many degrees of heading. */
const GAP_EASE_DEG = 14;

export type ViewReach = {
  /** How far below its centre the view shows, down to the rim of the helmet, in degrees. */
  downDeg: number;
  /** How far to each side of its centre the view shows, in degrees. */
  sideDeg: number;
  /** The lowest the view tilts anywhere, in degrees. */
  lowest: number;
};

/**
 * A stretch of a view with nothing to show from some way below the horizon: its two ends as
 * fractions of the full circle, and how far below the horizon it starts, in degrees. A stretch
 * may run through the join of the circle, its left end then being the larger number.
 */
export type ViewGap = { left: number; right: number; depression: number };

/**
 * The lowest the view may tilt while its centre is at `centre` (a fraction of the full circle),
 * so that a stretch with nothing to show stays under the rim of the helmet. Null when no such
 * stretch is near the view. The tilt comes in gradually as a stretch nears the edge of the view,
 * so turning does not jolt it.
 */
export function lowestPitchOver(
  gaps: readonly ViewGap[],
  centre: number,
  reach: ViewReach,
): number | null {
  let floor = reach.lowest;
  for (const gap of gaps) {
    // How far the stretch is from the centre of the view, the short way round, in degrees.
    const inside =
      gap.left <= gap.right
        ? centre >= gap.left && centre <= gap.right
        : centre >= gap.left || centre <= gap.right;
    const away = (edge: number) => {
      const turn = Math.abs(centre - edge);
      return Math.min(turn, 1 - turn) * 360;
    };
    const distance = inside ? 0 : Math.min(away(gap.left), away(gap.right));
    const weight =
      distance <= reach.sideDeg
        ? 1
        : Math.max(0, 1 - (distance - reach.sideDeg) / GAP_EASE_DEG);
    if (weight === 0) continue;
    // At this tilt the row where the gap starts sits on the lower edge of the view.
    const needed = reach.downDeg - gap.depression;
    // Smooth at both ends of the ramp.
    const eased = weight * weight * (3 - 2 * weight);
    floor = Math.max(floor, reach.lowest + (needed - reach.lowest) * eased);
  }
  return floor > reach.lowest ? floor : null;
}

/**
 * The lowest the view may tilt while it faces `heading`, so that a stretch of the photograph
 * with no ground stays under the rim of the helmet. Null when the picture has no such stretch
 * near the view.
 */
export function lowestPitch(panorama: Panorama, heading: number, reach: ViewReach): number | null {
  return lowestPitchOver(
    (panorama.groundGaps ?? []).map((gap) => ({
      left: gap.left,
      right: gap.right,
      depression: depressionOf(panorama, gap.top),
    })),
    headingToFraction(panorama, heading),
    reach,
  );
}
