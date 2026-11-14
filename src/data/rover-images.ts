/**
 * The raw images the rovers send down, from the public feed behind the raw-image galleries on
 * mars.nasa.gov (NASA/JPL-Caltech). No key is needed. The older api.nasa.gov "Mars Rover Photos"
 * service has been shut down, so this feed is the live source for rover pictures.
 *
 * Only cameras that see roughly what a person standing there would see are asked for: the
 * navigation, mast and hazard cameras. Science cameras shoot close-ups of rock.
 */
import type { Rover } from './sites';

export const RAW_IMAGE_FEEDS: Record<Rover, { category: string; cameras: readonly string[]; gallery: string }> = {
  curiosity: {
    category: 'msl',
    cameras: ['NAV_LEFT_B', 'MAST_LEFT', 'FHAZ_LEFT_B'],
    gallery: 'https://mars.nasa.gov/msl/multimedia/raw-images/',
  },
  perseverance: {
    category: 'mars2020',
    cameras: ['NAVCAM_LEFT', 'MCZ_LEFT', 'FRONT_HAZCAM_LEFT_A'],
    gallery: 'https://mars.nasa.gov/mars2020/multimedia/raw-images/',
  },
};

/** Plain names of the camera codes the feed uses. */
export const CAMERA_NAMES: Record<string, string> = {
  NAV_LEFT_B: 'Navcam',
  MAST_LEFT: 'Mastcam',
  FHAZ_LEFT_B: 'Front Hazcam',
  NAVCAM_LEFT: 'Navcam',
  MCZ_LEFT: 'Mastcam-Z',
  FRONT_HAZCAM_LEFT_A: 'Front Hazcam',
};

/** The newest `count` images from the chosen cameras of a rover. */
export function rawImagesUrl(rover: Rover, count = 24): string {
  const feed = RAW_IMAGE_FEEDS[rover];
  const search = encodeURIComponent(`|${feed.cameras.join('|')}`);
  return (
    'https://mars.nasa.gov/rss/api/?feed=raw_images' +
    `&category=${feed.category}&feedtype=json&num=${count}&page=0&order=sol+desc&search=${search}`
  );
}

export type RoverImage = {
  id: string;
  /** Sol of the mission on which it was taken. */
  sol: number;
  /** ISO time it was taken, in UTC, as the feed gives it. */
  takenUtc: string;
  /** Camera code, see CAMERA_NAMES. */
  camera: string;
  /**
   * About 320 pixels wide: enough for the photo grid on a phone at 2x, and about a sixth of the
   * weight of the 800-pixel version. The full frame is on the linked page.
   */
  image: string;
  /**
   * The same frame at the largest size the feed has as a JPEG: what a press on the photo opens.
   * The feed also names a page for each image, but for Curiosity those pages answer "not found"
   * (checked on 2026-11-14), so the file itself is the link that always works.
   */
  full: string;
  credit: string;
};

type Entry = Record<string, unknown>;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
const https = (url: string | null) => (url ? url.replace(/^http:\/\//, 'https://') : null);

/**
 * Full frames only (thumbnails and subframes are dropped), newest first.
 *
 * Up to `perCamera` images of each camera are taken first, so a mix of cameras wins. When the feed
 * has too few of the others (Perseverance often sends only Mastcam-Z for days), the free places
 * go to the newest frames.
 */
export function parseRawImages(raw: unknown, limit = 6, perCamera = 2): RoverImage[] {
  const images = (raw as { images?: unknown } | null)?.images;
  if (!Array.isArray(images)) return [];

  const frames: RoverImage[] = [];
  for (const item of images as Entry[]) {
    if (!item || String(item.sample_type ?? '').toLowerCase() !== 'full') continue;
    const files = (item.image_files ?? {}) as Entry;
    const image = https(text(files.small) ?? text(files.medium) ?? text(files.large));
    const sol = Number(item.sol);
    if (!image || !Number.isFinite(sol)) continue;
    frames.push({
      id: text(item.imageid) ?? image,
      sol,
      takenUtc: text(item.date_taken_utc) ?? '',
      camera: text((item.camera as Entry | undefined)?.instrument) ?? text(item.instrument) ?? '',
      image,
      full:
        https(text(files.large) ?? text(files.medium) ?? text(files.full_res) ?? text(files.small)) ??
        image,
      credit: text(item.credit) ?? 'NASA/JPL-Caltech',
    });
  }

  const picked = new Set<RoverImage>();
  const perCameraCount = new Map<string, number>();
  for (const frame of frames) {
    if (picked.size >= limit) break;
    const taken = perCameraCount.get(frame.camera) ?? 0;
    if (taken >= perCamera) continue;
    perCameraCount.set(frame.camera, taken + 1);
    picked.add(frame);
  }
  for (const frame of frames) {
    if (picked.size >= limit) break;
    picked.add(frame);
  }
  return frames.filter((frame) => picked.has(frame));
}
