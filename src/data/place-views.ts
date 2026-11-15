/**
 * The view from a place where a rover stood: the navigation camera frames it took there, each
 * with the direction it was looking in.
 *
 * NASA publishes three things that make this possible, and all three are measured:
 * the stops of the rover with their coordinates (`rover.ts`), the raw frames with the stop they
 * were taken at (the site and drive counters), and with each frame the camera model and the
 * orientation of the rover (`mission/cahvore.ts`). So a frame can be put back where the camera
 * pointed, and a walk that passes a stop can show the ground of that very place, lined up with
 * the compass.
 *
 * What is set by eye for this app: where the rover itself shows in its own pictures
 * (`PERSEVERANCE_BODY`), measured once on the frames of sol 20, in the frame of the rover.
 *
 * Only Perseverance is read. Its feed carries the stop and the pointing with every frame; the
 * feed of Curiosity leaves the stop empty, and its navigation camera needs a dozen frames to go
 * all the way round.
 */
import {
  directionToPixel,
  inverse,
  parseCameraModel,
  parseQuaternion,
  pointingOf,
  rotate,
  directionOf,
  type CameraModel,
  type Quaternion,
} from '@/mission/cahvore';
import { distance, type LatLon } from '@/mission/geo';

import type { RoverStop } from './rover';
import type { Rover } from './sites';

/** The rovers whose frames can be put back in place, with what the feed calls them. */
export const PLACE_FEEDS: Partial<Record<Rover, { category: string; camera: string; name: string }>> = {
  perseverance: { category: 'mars2020', camera: 'NAVCAM_LEFT', name: 'Perseverance' },
};

/** The whole sensor of the navigation camera of Perseverance, as the feed writes it. */
const WHOLE_SENSOR = '(1,1,5120,3840)';

/** Every frame the navigation camera took on a sol. One sol is at most a few hundred frames. */
export function placeFramesUrl(rover: Rover, sol: number): string | null {
  const feed = PLACE_FEEDS[rover];
  if (!feed) return null;
  return (
    'https://mars.nasa.gov/rss/api/?feed=raw_images' +
    `&category=${feed.category}&feedtype=json&num=300&page=0&order=sol+desc` +
    `&search=${encodeURIComponent(`|${feed.camera}`)}&sol=${sol}`
  );
}

export type PlaceFrame = {
  id: string;
  /** The frame as a JPEG about 1200 pixels wide. */
  url: string;
  /** The size the camera model is written for, in pixels. The file keeps the same shape. */
  width: number;
  height: number;
  model: CameraModel;
  /** The orientation of the rover when the frame was taken. */
  attitude: Quaternion;
  /** Where the camera pointed: compass direction and elevation, in degrees. */
  azimuth: number;
  elevation: number;
  /** ISO time it was taken, in UTC, as the feed gives it. */
  takenUtc: string;
};

export type PlaceView = {
  /** Unique to the stop: rover, site counter and drive counter. */
  id: string;
  rover: Rover;
  stop: RoverStop;
  frames: readonly PlaceFrame[];
  /** Which way the rover faced, in compass degrees. */
  yaw: number;
  credit: string;
};

type Entry = Record<string, unknown>;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** Frames closer together than this are the same look taken twice; one is kept. */
const SAME_LOOK_DEG = 30;
/** The frames of a look round the horizon point a little down. Others look at the deck or the sky. */
const LOOK_ELEVATION = { lowest: -45, highest: -10 };
/**
 * The widest step between two frames that still leaves no hole: the lens sees 96 degrees across,
 * less towards its upper corners, where the horizon is.
 */
export const WIDEST_STEP_DEG = 80;

const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * The frames taken at `stop` that show the whole field of the camera, one for each direction it
 * looked in. Frames of other stops of the same sol, crops and thumbnails are dropped.
 */
export function parsePlaceFrames(raw: unknown, stop: RoverStop): PlaceFrame[] {
  const images = (raw as { images?: unknown } | null)?.images;
  if (!Array.isArray(images)) return [];

  const frames: PlaceFrame[] = [];
  for (const item of images as Entry[]) {
    if (!item || String(item.sample_type ?? '').toLowerCase() !== 'full') continue;
    if (Number(item.site) !== stop.site || Number(item.drive) !== stop.drive) continue;
    if (item.site === '' || item.drive === '') continue;
    const extended = (item.extended ?? {}) as Entry;
    if (extended.subframeRect !== WHOLE_SENSOR) continue;
    const size = /^\((\d+),(\d+)\)$/.exec(String(extended.dimension ?? ''));
    const camera = (item.camera ?? {}) as Entry;
    const model = parseCameraModel(camera.camera_model_component_list, camera.camera_model_type);
    const attitude = parseQuaternion(item.attitude);
    const url = text(((item.image_files ?? {}) as Entry).large);
    if (!size || !model || !attitude || !url) continue;

    const { azimuth, elevation } = pointingOf(rotate(attitude, model.a));
    if (elevation < LOOK_ELEVATION.lowest || elevation > LOOK_ELEVATION.highest) continue;
    if (frames.some((kept) => turn(kept.azimuth, azimuth) < SAME_LOOK_DEG)) continue;
    frames.push({
      id: text(item.imageid) ?? url,
      url: url.replace(/^http:\/\//, 'https://'),
      width: Number(size[1]),
      height: Number(size[2]),
      model,
      attitude,
      azimuth,
      elevation,
      takenUtc: text(item.date_taken_utc) ?? '',
    });
  }
  return frames.sort((one, other) => one.azimuth - other.azimuth);
}

/** Whether the frames leave no direction out: no step between two of them is too wide. */
export function goesAllRound(frames: readonly PlaceFrame[]): boolean {
  if (frames.length < 4) return false;
  const sorted = frames.map((frame) => frame.azimuth).sort((a, b) => a - b);
  return sorted.every((azimuth, index) => {
    const next = sorted[(index + 1) % sorted.length];
    return (((next - azimuth) % 360) + 360) % 360 <= WIDEST_STEP_DEG;
  });
}

/** The view from a stop, or null when its frames do not go all the way round. */
export function placeViewOf(rover: Rover, stop: RoverStop, raw: unknown): PlaceView | null {
  const frames = parsePlaceFrames(raw, stop);
  if (!goesAllRound(frames)) return null;
  // Forward for the rover is the first axis of its frame.
  const yaw = pointingOf(rotate(frames[0].attitude, [1, 0, 0])).azimuth;
  return {
    id: `${rover}-${stop.site}-${stop.drive}`,
    rover,
    stop,
    frames,
    yaw,
    credit: 'NASA/JPL-Caltech',
  };
}

/** Where in a frame a compass direction shows, in pixels of the size the model is written for. */
export function lookUp(
  frame: PlaceFrame,
  azimuth: number,
  elevation: number,
): { x: number; y: number } | null {
  return directionToPixel(frame.model, rotate(inverse(frame.attitude), directionOf(azimuth, elevation)));
}

/** A walk shows the view of a stop only when it passes this close to it, in metres. */
export const PLACE_WITHIN_M = 150;
/** How many of the nearest stops are asked about before giving up. Each is one request. */
export const PLACE_TRIES = 6;

/** The stops within reach of `position`, nearest first, with how far each is. */
export function stopsNear(
  stops: readonly RoverStop[],
  position: LatLon,
  withinM: number = PLACE_WITHIN_M,
): { stop: RoverStop; awayM: number }[] {
  return stops
    .map((stop) => ({ stop, awayM: distance(position, stop.point) }))
    .filter((near) => near.awayM <= withinM)
    .sort((one, other) => one.awayM - other.awayM);
}

/**
 * A stretch of the view with nothing to show below `top`: degrees of compass, and the elevation
 * from which the rover that took the frames stands in the way.
 */
export type PlaceGap = { from: number; to: number; top: number };

/**
 * Where Perseverance shows in the frames of its own navigation camera, in its own frame: degrees
 * clockwise from straight ahead, and the elevation its deck, its wheels and what stands on the
 * deck reach. The camera is on the mast, at the front right, so the rover fills the view behind
 * and to the left. Set by eye on the frames of sol 20, with two degrees to spare, but for one
 * thing: straight behind, a box on the deck stands up to the horizon. Hiding all of it would
 * leave nothing but sky that way, so its top is let show above the rim of the helmet.
 */
const PERSEVERANCE_BODY: readonly PlaceGap[] = [
  { from: 158, to: 170, top: -30 },
  { from: 170, to: 178, top: -5 },
  { from: 178, to: 196, top: -4 },
  { from: 196, to: 290, top: -7 },
  { from: 290, to: 328, top: -13 },
  { from: 328, to: 336, top: -44 },
];

/**
 * Below this elevation the frames are not shown in any direction: close under the mast, the
 * deck and the arm come into every one of them.
 */
export const PLACE_FLOOR_DEG = -52;

/** Where the rover shows in a view, in compass degrees. A stretch may run through north. */
export function placeGaps(view: PlaceView): PlaceGap[] {
  const wrap = (degrees: number) => ((degrees % 360) + 360) % 360;
  return PERSEVERANCE_BODY.map((gap) => ({
    from: wrap(gap.from + view.yaw),
    to: wrap(gap.to + view.yaw),
    top: gap.top,
  }));
}

/** The rover counts as in the way where it reaches higher than this, in degrees of elevation. */
const IN_THE_WAY_DEG = -12;
/** The view ahead is this wide either side of the heading, in degrees. */
const AHEAD_EACH_SIDE = 25;

/**
 * Whether the rover stays out of the view of an astronaut who looks along `heading`. Where it
 * does not, the view has to be held higher to keep the rover under the rim of the helmet, and
 * little ground is left to see: a stop whose view ahead is clear is the better one to stand in.
 */
export function clearAhead(view: PlaceView, heading: number): boolean {
  const facing = ((heading % 360) + 360) % 360;
  return placeGaps(view)
    .filter((gap) => gap.top > IN_THE_WAY_DEG)
    .every((gap) => {
      const from = gap.from - AHEAD_EACH_SIDE;
      const span = ((gap.to - gap.from + 360) % 360) + 2 * AHEAD_EACH_SIDE;
      return ((facing - from + 720) % 360) > span;
    });
}

/** The page of the raw image gallery where the frames of a sol can be seen. */
export const PLACE_GALLERY = 'mars.nasa.gov/mars2020/multimedia/raw-images';
