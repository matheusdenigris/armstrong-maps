/**
 * The camera model NASA publishes with each raw image of a rover (CAHVORE, after Gennery, 2006),
 * and the orientation of the rover that comes with it. Together they say which way every pixel
 * of a frame was looking, which is what lets a frame be placed where the camera pointed.
 *
 * Only the direction is used here: from a direction to the pixel that shows it. The small shift
 * of the entrance pupil (the E terms) matters for things within a metre or two of the lens and
 * is left out.
 */

export type Vec3 = readonly [number, number, number];
/** A rotation, scalar part first, as the feed writes it. It turns the rover frame into north-east-down. */
export type Quaternion = readonly [number, number, number, number];

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => scale(a, 1 / length(a));

/** Turns `v` by the rotation `q`. */
export function rotate(q: Quaternion, v: Vec3): Vec3 {
  const axis: Vec3 = [q[1], q[2], q[3]];
  const t = scale(cross(axis, v), 2);
  return add(add(v, scale(t, q[0])), cross(axis, t));
}

/** The rotation that undoes `q`. */
export const inverse = (q: Quaternion): Quaternion => [q[0], -q[1], -q[2], -q[3]];

const RAD = Math.PI / 180;

/** A compass direction and an elevation, in degrees, as a vector: north, east, down. */
export function directionOf(azimuth: number, elevation: number): Vec3 {
  const flat = Math.cos(elevation * RAD);
  return [flat * Math.cos(azimuth * RAD), flat * Math.sin(azimuth * RAD), -Math.sin(elevation * RAD)];
}

/** The compass direction (0 to 360) and the elevation of a north-east-down vector, in degrees. */
export function pointingOf(direction: Vec3): { azimuth: number; elevation: number } {
  const d = unit(direction);
  return {
    azimuth: (Math.atan2(d[1], d[0]) / RAD + 360) % 360,
    elevation: -Math.asin(Math.max(-1, Math.min(1, d[2]))) / RAD,
  };
}

export type CameraModel = {
  /** The axis the image plane is square to. */
  a: Vec3;
  /** Across and down the image: each holds the focal length and the centre, in pixels. */
  h: Vec3;
  v: Vec3;
  /** The optical axis, about which the lens distorts. */
  o: Vec3;
  /** The radial distortion, as a polynomial. */
  r: Vec3;
  /**
   * How the lens spreads angles: 1 for a plain perspective lens, 0 for a fisheye, in between for
   * the lenses in between.
   */
  linearity: number;
};

const vector = (text: string): Vec3 | null => {
  const parts = text.replace(/[()]/g, '').split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? [parts[0], parts[1], parts[2]] : null;
};

/** Reads a rotation as the feed writes it: "(w,x,y,z)". */
export function parseQuaternion(text: unknown): Quaternion | null {
  if (typeof text !== 'string') return null;
  const parts = text.replace(/[()]/g, '').split(',').map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const size = Math.hypot(parts[0], parts[1], parts[2], parts[3]);
  if (size < 0.5) return null;
  return [parts[0] / size, parts[1] / size, parts[2] / size, parts[3] / size];
}

/**
 * Reads the list the feed calls `camera_model_component_list`: C;A;H;V;O;R and, for the wide
 * lenses, E, the kind of lens and its parameter. Null when it is not a model this code knows.
 */
export function parseCameraModel(list: unknown, type: unknown): CameraModel | null {
  if (typeof list !== 'string') return null;
  const parts = list.split(';');
  const [a, h, v] = [parts[1], parts[2], parts[3]].map((part) => (part ? vector(part) : null));
  if (!a || !h || !v) return null;
  const kind = typeof type === 'string' ? type.toUpperCase() : '';
  if (kind === 'CAHV') return { a, h, v, o: a, r: [0, 0, 0], linearity: 1 };
  const o = parts[4] ? vector(parts[4]) : null;
  const r = parts[5] ? vector(parts[5]) : null;
  if (!o || !r) return null;
  if (kind === 'CAHVOR') return { a, h, v, o, r, linearity: 1 };
  if (kind !== 'CAHVORE') return null;
  // 1 is perspective, 2 is fisheye, 3 is general, with the linearity as its parameter.
  const lens = Number(parts[7]);
  const parameter = Number(parts[8]);
  if (lens === 1) return { a, h, v, o, r, linearity: 1 };
  if (lens === 2) return { a, h, v, o, r, linearity: 0 };
  if (lens === 3 && Number.isFinite(parameter)) return { a, h, v, o, r, linearity: parameter };
  return null;
}

/** The widest angle from the optical axis that is asked of a lens, in degrees. */
const WIDEST_DEG = 100;

/**
 * The pixel of a frame that shows what lies in `direction`, a vector in the frame the model is
 * written in (the rover's own). Null when the direction is behind the lens or beyond what it can
 * bend in. The pixel may fall outside the frame: the caller knows its size.
 */
export function directionToPixel(
  model: CameraModel,
  direction: Vec3,
): { x: number; y: number } | null {
  const d = unit(direction);
  const o = unit(model.o);
  const along = Math.max(-1, Math.min(1, dot(d, o)));
  const theta = Math.acos(along);
  if (theta > WIDEST_DEG * RAD) return null;
  const across = subtract(d, scale(o, along));
  const size = length(across);

  const l = model.linearity;
  let chi: number;
  if (l < -1e-6) chi = Math.sin(l * theta) / l;
  else if (l > 1e-6) {
    // A perspective lens sees less than a quarter turn from its axis.
    if (l * theta > 85 * RAD) return null;
    chi = Math.tan(l * theta) / l;
  } else chi = theta;

  const chi2 = chi * chi;
  const mu = model.r[0] + model.r[1] * chi2 + model.r[2] * chi2 * chi2;
  const point = size < 1e-12 ? o : add(o, scale(across, (chi * (1 + mu)) / size));
  const depth = dot(point, model.a);
  if (depth <= 1e-9) return null;
  return { x: dot(point, model.h) / depth, y: dot(point, model.v) / depth };
}
