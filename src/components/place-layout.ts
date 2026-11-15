/**
 * Lays the frames of a place round the astronaut, each where its camera pointed.
 *
 * The frames come from a wide lens that bends straight lines, and they overlap. The view is cut
 * into small cells of compass direction and elevation. Each cell is a flat piece standing where
 * that part of the sky or the ground is, and shows the part of one frame that saw it. Over the
 * few degrees of a cell the bend of the lens is small enough for a flat piece to follow it.
 *
 * Nothing here touches the screen: the numbers are for `panorama-view.web.tsx` to draw with.
 * Everything is in pixels, with the astronaut at the origin, x to the right, y down and the
 * view at heading 0 looking along minus z, the way the browser lays out three dimensions.
 */
import { PLACE_FLOOR_DEG, lookUp, type PlaceView } from '@/data/place-views';
import { add, cross, directionOf, length, scale, subtract, type Vec3 } from '@/mission/cahvore';

/** Every frame is drawn this wide, whatever the size of its file. */
export const PICTURE_WIDTH = 1200;

/** The size of a cell, in degrees of compass and of elevation. */
const STEP = 6;
/** The outer edge of a frame is left out, as a share of its width: the lens darkens there. */
const EDGE = 0.025;
/** The corners are left out too, beyond this share of the way from the centre to a corner. */
const CORNER = 0.86;
/** Either side of the join between two frames, they are mixed over this many degrees. */
const BLEND = 5;
/**
 * How high above the horizon a frame is shown: all it has about its middle, less towards its
 * sides, where the lens darkens the sky into a block that does not match the frame beside it.
 * Degrees of elevation, and how far from the middle of the frame each holds, in degrees.
 */
const SKY_SHOWN = { middle: 6, side: 2, from: 14, to: 36 };
/** The top of a frame fades into the drawn sky over this many degrees. */
const FADE = 4;
/** The drawn sky goes up to this elevation; the head cannot tilt far enough to see past it. */
const SKY_TOP = 62;
/** A sky sample is taken at most this far to the side of the middle of its frame, in degrees. */
const SKY_REACH = 20;
/** The drawn sky starts a little below the horizon, behind the frames. */
const SKY_FOOT = -3;
/** Under the frames there is the inside of the helmet, down to here. */
const BELOW_FOOT = -86;

/** A flat piece of the view: its size and where it stands, as the 16 numbers of a 3D transform. */
type Piece = { width: number; height: number; matrix: readonly number[] };

export type PlaceCell = Piece & {
  key: string;
  /** The compass direction of its middle: what is behind the astronaut is not drawn. */
  azimuth: number;
  /** Which frame of the view it shows. */
  frame: number;
  /**
   * The six numbers of the 2D transform that lays the frame, drawn `PICTURE_WIDTH` wide from its
   * top left corner, over the cell.
   */
  picture: readonly number[];
  /**
   * Near a join this cell lies over the neighbouring frame and lets it through: how solid it is
   * at its left and right edges, 0 to 1. Null for a cell that is solid.
   */
  side: readonly [number, number] | null;
  /** The topmost cell of its column fades into the sky behind it. */
  fades: boolean;
};

export type SkyCell = Piece & {
  key: string;
  azimuth: number;
  /** Which column of the view it stands in, counted from north through east. */
  column: number;
};

export type PlainCell = Piece & { key: string; azimuth: number };

/** A patch of sky near the top of a frame, whose colour is carried on upwards. */
export type SkyMark = {
  frame: number;
  /** The middle of the patch, in pixels of the frame drawn `PICTURE_WIDTH` wide. */
  x: number;
  y: number;
};

export type PlaceLayout = {
  cells: PlaceCell[];
  sky: SkyCell[];
  /** The inside of the helmet under the frames. */
  below: PlainCell[];
  /**
   * One sky sample for each column, from north through east: the patch at the top of the frame
   * that shows the column. Null for a column no frame shows.
   */
  marks: (SkyMark | null)[];
  /**
   * For each frame, the patch of sky over its middle. The camera set its exposure frame by
   * frame, so two neighbours can differ a great deal; how bright each made its own sky is what
   * they are evened out by. Null for a frame that shows no sky there.
   */
  levels: (SkyMark | null)[];
  /** How many degrees of compass a column covers. */
  step: number;
  /** The height each frame is drawn at, for its width of `PICTURE_WIDTH`. */
  pictureHeights: number[];
};

const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360;

/** A direction as a point at `radius` from the astronaut. */
function at(azimuth: number, elevation: number, radius: number): Vec3 {
  const d = directionOf(azimuth, elevation);
  return [radius * d[1], radius * d[2], -radius * d[0]];
}

/** The flat piece with these three corners: top left, top right and bottom left. */
function piece(topLeft: Vec3, topRight: Vec3, bottomLeft: Vec3): Piece {
  const across = subtract(topRight, topLeft);
  const down = subtract(bottomLeft, topLeft);
  const width = length(across);
  const height = length(down);
  const x = scale(across, 1 / width);
  const y = scale(down, 1 / height);
  const z = cross(x, y);
  return {
    width,
    height,
    matrix: [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, topLeft[0], topLeft[1], topLeft[2], 1],
  };
}

/**
 * A piece between two elevations of one column, as wide all the way as it is at its wider end,
 * so that no wedge opens between two columns where the meridians close in.
 */
function band(azimuth: number, high: number, low: number, radius: number): Piece {
  const top = [at(azimuth, high, radius), at(azimuth + STEP, high, radius)] as const;
  const foot = [at(azimuth, low, radius), at(azimuth + STEP, low, radius)] as const;
  const wideAtFoot = Math.abs(low) < Math.abs(high);
  const wide = wideAtFoot ? foot : top;
  const narrow = wideAtFoot ? top : foot;
  // From the middle of the wide edge to the middle of the narrow one.
  const lift = subtract(scale(add(narrow[0], narrow[1]), 0.5), scale(add(wide[0], wide[1]), 0.5));
  return wideAtFoot
    ? piece(add(wide[0], lift), add(wide[1], lift), wide[0])
    : piece(wide[0], wide[1], add(wide[0], lift));
}

export function layoutPlace(view: PlaceView, radius: number): PlaceLayout {
  const frames = view.frames;
  const pictureHeights = frames.map((frame) => (PICTURE_WIDTH * frame.height) / frame.width);

  /** Where a direction shows in a frame, in pixels of the frame as drawn, when it is usable there. */
  const seen = (index: number, azimuth: number, elevation: number) => {
    const frame = frames[index];
    const pixel = lookUp(frame, azimuth, elevation);
    if (!pixel) return null;
    const edge = EDGE * frame.width;
    if (pixel.x < edge || pixel.x > frame.width - edge) return null;
    if (pixel.y < edge || pixel.y > frame.height - edge) return null;
    const fromCentre = Math.hypot(pixel.x - frame.width / 2, pixel.y - frame.height / 2);
    if (fromCentre > CORNER * Math.hypot(frame.width / 2, frame.height / 2)) return null;
    const k = PICTURE_WIDTH / frame.width;
    return { x: pixel.x * k, y: pixel.y * k };
  };

  /** The highest elevation a frame shows along both edges of a column, or null. */
  const topOf = (index: number, azimuth: number): number | null => {
    const both = (elevation: number) =>
      seen(index, azimuth, elevation) !== null && seen(index, azimuth + STEP, elevation) !== null;
    if (!both(-20)) return null;
    let low = -20;
    let high = 40;
    for (let i = 0; i < 14; i += 1) {
      const middle = (low + high) / 2;
      if (both(middle)) low = middle;
      else high = middle;
    }
    const off = turn(frames[index].azimuth, azimuth + STEP / 2);
    const out = Math.max(0, Math.min(1, (off - SKY_SHOWN.from) / (SKY_SHOWN.to - SKY_SHOWN.from)));
    return Math.min(low, SKY_SHOWN.middle + (SKY_SHOWN.side - SKY_SHOWN.middle) * out);
  };

  const cells: PlaceCell[] = [];
  const column = (
    index: number,
    azimuth: number,
    cellRadius: number,
    side: readonly [number, number] | null,
  ) => {
    const top = topOf(index, azimuth);
    if (top === null) return;
    let elevation = top;
    let first = true;
    while (elevation > PLACE_FLOOR_DEG) {
      const next = first
        ? elevation - FADE
        : Math.max(PLACE_FLOOR_DEG, Math.floor((elevation - 0.5) / STEP) * STEP);
      const corners = [
        seen(index, azimuth, elevation),
        seen(index, azimuth + STEP, elevation),
        seen(index, azimuth, next),
        seen(index, azimuth + STEP, next),
      ];
      const [q0, q1, q2, q3] = corners;
      if (!q0 || !q1 || !q2 || !q3) break;
      const shape = piece(
        at(azimuth, elevation, cellRadius),
        at(azimuth + STEP, elevation, cellRadius),
        at(azimuth, next, cellRadius),
      );
      // The frame is laid so that three corners of the cell show what the lens saw there.
      const a = [q1.x - q0.x, q1.y - q0.y];
      const b = [q2.x - q0.x, q2.y - q0.y];
      const det = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(det) < 1e-6) break;
      const m00 = (shape.width * b[1]) / det;
      const m01 = (-shape.width * b[0]) / det;
      const m10 = (-shape.height * a[1]) / det;
      const m11 = (shape.height * a[0]) / det;
      cells.push({
        ...shape,
        key: `${side ? 'b' : 'a'}${index}-${azimuth}-${elevation.toFixed(2)}`,
        azimuth: wrap(azimuth + STEP / 2),
        frame: index,
        picture: [m00, m10, m01, m11, -(m00 * q0.x + m01 * q0.y), -(m10 * q0.x + m11 * q0.y)],
        side,
        fades: first,
      });
      elevation = next;
      first = false;
    }
  };

  const nearest = (middle: number) =>
    frames
      .map((_, index) => index)
      .sort((one, other) => turn(frames[one].azimuth, middle) - turn(frames[other].azimuth, middle));

  for (let azimuth = 0; azimuth < 360; azimuth += STEP) {
    const order = nearest(azimuth + STEP / 2);
    column(order[0], azimuth, radius, null);
    if (order.length < 2) continue;
    // Towards the join with the next frame the two are mixed, half and half at the join itself.
    const share = (where: number) => {
      const inside =
        (turn(frames[order[1]].azimuth, where) - turn(frames[order[0]].azimuth, where)) / 2;
      return Math.max(0, Math.min(1, 0.5 * (1 - inside / BLEND)));
    };
    const side = [share(azimuth), share(azimuth + STEP)] as const;
    // A little nearer than the frame under it, so the two never fight for the same depth.
    if (side[0] > 0 || side[1] > 0) column(order[1], azimuth, radius * 0.996, side);
  }

  const levels = frames.map((frame, index): SkyMark | null => {
    const top = topOf(index, frame.azimuth - STEP / 2);
    const pixel = top === null ? null : seen(index, frame.azimuth, top - 1.5);
    return pixel ? { frame: index, x: pixel.x, y: pixel.y } : null;
  });

  const marks: (SkyMark | null)[] = [];
  const sky: SkyCell[] = [];
  const below: PlainCell[] = [];
  for (let azimuth = 0; azimuth < 360; azimuth += STEP) {
    const middle = azimuth + STEP / 2;
    // The sky of a column is the colour its frame has just under its top edge. Towards the
    // sides of a frame the lens darkens, so the patch is never taken further out than this.
    let mark: SkyMark | null = null;
    for (const index of nearest(middle)) {
      const off = ((middle - frames[index].azimuth + 540) % 360) - 180;
      const from = frames[index].azimuth + Math.max(-SKY_REACH, Math.min(SKY_REACH, off));
      const top = topOf(index, from - STEP / 2);
      const pixel = top === null ? null : seen(index, from, top - 1.5);
      if (pixel) {
        mark = { frame: index, x: pixel.x, y: pixel.y };
        break;
      }
    }
    marks.push(mark);
    // Behind the frames, and in three bands so that it stays behind them all the way up.
    for (const [low, high] of [
      [SKY_FOOT, 12],
      [12, 36],
      [36, SKY_TOP],
    ]) {
      sky.push({
        ...band(azimuth, high, low, radius * 1.02),
        key: `s${azimuth}-${low}`,
        azimuth: wrap(middle),
        column: azimuth / STEP,
      });
    }
    below.push({
      ...band(azimuth, PLACE_FLOOR_DEG, BELOW_FOOT, radius),
      key: `u${azimuth}`,
      azimuth: wrap(middle),
    });
  }

  return {
    cells,
    sky,
    below,
    marks,
    levels,
    step: STEP,
    pictureHeights,
  };
}
