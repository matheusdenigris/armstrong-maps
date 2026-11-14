/**
 * Real photographs from the rovers, used as what the astronaut sees in the visor.
 *
 * They come from NASA's Image and Video Library (images.nasa.gov). Each is a mosaic taken from
 * one fixed spot, with black gaps and the rover's own deck in it. `window` is the part with clean
 * ground and sky, as fractions of the picture: left, top, right, bottom. The visor only shows
 * that part, and pans inside it. It is a real picture of the site, but it does not turn with the
 * real heading: the framing is illustrative, and the visor says so.
 */
export type Panorama = {
  /** Identifier in the NASA library; the picture's page is images.nasa.gov/details/<id>. */
  nasaId: string;
  url: string;
  /** Size of the file at `url`, in pixels. */
  width: number;
  height: number;
  window: { left: number; top: number; right: number; bottom: number };
  /** What the picture is, for the caption. */
  caption: string;
  credit: string;
  /** The site where it was taken. */
  site: string;
};

const large = (id: string) => `https://images-assets.nasa.gov/image/${id}/${id}~large.jpg`;

const GALE: Panorama = {
  nasaId: 'PIA25176',
  url: large('PIA25176'),
  width: 1920,
  height: 533,
  window: { left: 0.47, top: 0.09, right: 0.86, bottom: 0.72 },
  caption: 'Curiosity Mastcam panorama on Greenheugh, sol 3423 (2022)',
  credit: 'NASA/JPL-Caltech/MSSS',
  site: 'gale',
};

const JEZERO: Panorama = {
  nasaId: 'PIA24264',
  url: large('PIA24264'),
  width: 1920,
  height: 509,
  window: { left: 0.02, top: 0.02, right: 0.44, bottom: 0.62 },
  caption: 'Perseverance Mastcam-Z panorama at its landing site, sol 3 (2021)',
  credit: 'NASA/JPL-Caltech/MSSS/ASU',
  site: 'jezero',
};

const BY_SITE: Record<string, Panorama> = { gale: GALE, jezero: JEZERO };

/**
 * The photograph for a site. Only Gale and Jezero have one of their own; elsewhere the visor
 * borrows the one from Gale, and `borrowed` lets it say so.
 */
export function panoramaFor(siteId: string): { panorama: Panorama; borrowed: boolean } {
  const own = BY_SITE[siteId];
  return own ? { panorama: own, borrowed: false } : { panorama: GALE, borrowed: true };
}
