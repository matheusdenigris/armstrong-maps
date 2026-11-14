/**
 * The map camera: which part of Mars is on screen.
 *
 * The projection is equirectangular, like the tiles: a degree of longitude and a degree of
 * latitude take the same number of pixels. That makes panning and zooming plain arithmetic.
 */
import type { LatLon } from './geo';
import type { Bounds } from './tiles';

/** The point at the centre of the screen and the scale of the map. */
export type MapView = LatLon & {
  pixelsPerDegree: number;
};

export type Size = { width: number; height: number };
export type Pixel = { x: number; y: number };

export type ScaleLimits = { min: number; max: number };

/**
 * A surface map remains useful while it shows a regional frame. Beyond this it becomes a flat
 * equirectangular overview; the landing screen's globe is the appropriate whole-planet view.
 */
export const MAX_SURFACE_FRAME_HEIGHT_DEGREES = 90;

/**
 * Raises a map's minimum scale when necessary to keep a whole-planet rectangle out of its frame.
 * The caller's limits still win when they are more restrictive.
 */
export function limitsForSurfaceFrame(limits: ScaleLimits, size: Size): ScaleLimits {
  return {
    ...limits,
    min: Math.min(
      limits.max,
      Math.max(limits.min, size.height / MAX_SURFACE_FRAME_HEIGHT_DEGREES),
    ),
  };
}

/** Where a place on Mars falls on screen. */
export function project(view: MapView, size: Size, point: LatLon): Pixel {
  return {
    x: size.width / 2 + (point.lon - view.lon) * view.pixelsPerDegree,
    y: size.height / 2 - (point.lat - view.lat) * view.pixelsPerDegree,
  };
}

/** The place on Mars under a point of the screen. */
export function unproject(view: MapView, size: Size, pixel: Pixel): LatLon {
  return {
    lon: view.lon + (pixel.x - size.width / 2) / view.pixelsPerDegree,
    lat: view.lat - (pixel.y - size.height / 2) / view.pixelsPerDegree,
  };
}

/**
 * The view that puts `anchor` under `pixel` at the given scale. Dragging and pinching are both
 * this: keep the place under the fingers where the fingers are.
 */
export function viewAround(
  anchor: LatLon,
  pixel: Pixel,
  pixelsPerDegree: number,
  size: Size,
): MapView {
  return {
    pixelsPerDegree,
    lon: anchor.lon - (pixel.x - size.width / 2) / pixelsPerDegree,
    lat: anchor.lat + (pixel.y - size.height / 2) / pixelsPerDegree,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps the centre on the planet and the scale inside its limits. */
export function clampView(view: MapView, limits: ScaleLimits): MapView {
  return {
    lat: clamp(view.lat, -90, 90),
    lon: clamp(view.lon, -180, 180),
    pixelsPerDegree: clamp(view.pixelsPerDegree, limits.min, limits.max),
  };
}

/**
 * The rectangle of Mars on screen. `margin` widens it by a fraction of the screen on every side
 * (0.5 adds half a screen), to load tiles just outside the edges.
 */
export function visibleBounds(view: MapView, size: Size, margin = 0): Bounds {
  const halfWidth = ((size.width / 2) * (1 + 2 * margin)) / view.pixelsPerDegree;
  const halfHeight = ((size.height / 2) * (1 + 2 * margin)) / view.pixelsPerDegree;
  return {
    west: view.lon - halfWidth,
    east: view.lon + halfWidth,
    south: view.lat - halfHeight,
    north: view.lat + halfHeight,
  };
}

/**
 * True when `view` has moved far enough from `base` that tiles chosen for `base` no longer serve:
 * the scale changed by half a level or the centre moved a third of the screen.
 */
export function hasDrifted(base: MapView, view: MapView, size: Size): boolean {
  const zoom = Math.abs(Math.log2(view.pixelsPerDegree / base.pixelsPerDegree));
  const dx = Math.abs(view.lon - base.lon) * view.pixelsPerDegree;
  const dy = Math.abs(view.lat - base.lat) * view.pixelsPerDegree;
  return zoom > 0.5 || dx > size.width / 3 || dy > size.height / 3;
}
