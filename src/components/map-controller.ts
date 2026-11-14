/**
 * Turns fingers, the mouse wheel and the zoom buttons into map views.
 *
 * It is a plain object, not a hook: a gesture produces many views per second and most of its
 * state (where the fingers came down, pending timers) never needs to reach React. The component
 * hears about a new camera once per frame.
 */
import {
  clampScale,
  clampView,
  hasDrifted,
  unproject,
  viewAround,
  type MapView,
  type Pixel,
  type ScaleLimits,
  type Size,
} from '@/mission/camera';
import type { LatLon } from '@/mission/geo';

/**
 * `view` is what is on screen right now. `base` is the view the tiles were laid out for. While a
 * gesture runs only `view` changes, and the tile plane follows it with one transform; the tiles
 * are laid out again when the view settles or drifts too far from `base`.
 */
export type Camera = { view: MapView; base: MapView };

export type MapOptions = {
  home: MapView;
  limits: ScaleLimits;
  reduceMotion: boolean;
  onCamera: (camera: Camera) => void;
  onViewChange?: (view: MapView) => void;
  onPress?: (point: LatLon) => void;
};

type Gesture = {
  /** The place on Mars under the fingers when they came down. */
  anchor: LatLon;
  fingers: number;
  /** Distance between two fingers at the start; 0 with one finger. */
  spread: number;
  scale: number;
  startedAt: number;
  startedOn: Pixel;
  travelled: number;
  last: Pixel;
};

const TAP_MAX_TRAVEL = 8;
const TAP_MAX_MS = 280;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_REACH = 30;
const SETTLE_MS = 140;
const TWEEN_MS = 180;

export const ZOOM_STEP = 2;

export const openingCamera = (home: MapView, limits: ScaleLimits): Camera => {
  const view = clampView(home, limits);
  return { view, base: view };
};

const middle = (points: Pixel[]): Pixel =>
  points.length > 1
    ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
    : points[0];

const spreadOf = (points: Pixel[]) =>
  points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;

export class MapController {
  private camera: Camera;
  private size: Size | null = null;
  private gesture: Gesture | null = null;
  private lastTap: { at: number; on: Pixel } | null = null;
  private frame: number | null = null;
  private tween: number | null = null;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  private options: MapOptions;

  constructor(options: MapOptions) {
    this.options = options;
    this.camera = openingCamera(options.home, options.limits);
  }

  configure(options: MapOptions) {
    this.options = options;
    // A resized map can raise its minimum scale. Keep the rendered camera within those new bounds.
    this.camera = {
      view: clampView(this.camera.view, options.limits, this.size ?? undefined),
      base: clampView(this.camera.base, options.limits, this.size ?? undefined),
    };
  }

  currentCamera() {
    return this.camera;
  }

  setSize(size: Size) {
    this.size = size;
  }

  dispose() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.tween !== null) cancelAnimationFrame(this.tween);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.frame = this.tween = null;
  }

  /** Fingers came down, or their number changed. `points` are relative to the map. */
  begin(points: Pixel[]) {
    this.stopTween();
    this.start(points);
  }

  move(points: Pixel[]) {
    const { size, gesture } = this;
    if (!size || !gesture || points.length === 0) return;
    // A finger came down or went up: start again from here so the map does not jump.
    if (points.length !== gesture.fingers) {
      this.start(points, { ...gesture, travelled: TAP_MAX_TRAVEL + 1 });
      return;
    }
    const at = middle(points);
    gesture.travelled = Math.max(
      gesture.travelled,
      Math.hypot(at.x - gesture.startedOn.x, at.y - gesture.startedOn.y),
    );
    gesture.last = at;
    const spread = spreadOf(points);
    const scale =
      gesture.spread > 0 && spread > 0 ? gesture.scale * (spread / gesture.spread) : gesture.scale;
    this.show(this.zoomedView(gesture.anchor, at, scale, size));
  }

  end() {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture) return;
    const wasTap =
      gesture.fingers === 1 &&
      gesture.travelled <= TAP_MAX_TRAVEL &&
      Date.now() - gesture.startedAt <= TAP_MAX_MS;
    if (!wasTap) {
      this.settle();
      return;
    }
    const now = Date.now();
    const previous = this.lastTap;
    const isDouble =
      previous !== null &&
      now - previous.at <= DOUBLE_TAP_MS &&
      Math.hypot(previous.on.x - gesture.last.x, previous.on.y - gesture.last.y) <=
        DOUBLE_TAP_REACH;
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (isDouble) {
      this.lastTap = null;
      this.zoomBy(ZOOM_STEP, gesture.last);
      return;
    }
    this.lastTap = { at: now, on: gesture.last };
    // Wait to see whether a second tap follows before reporting a single one.
    const on = gesture.last;
    this.tapTimer = setTimeout(() => {
      if (this.size) this.options.onPress?.(unproject(this.camera.view, this.size, on));
    }, DOUBLE_TAP_MS);
  }

  /** The mouse wheel: zooms around the pointer. `delta` is in pixels, positive away from the user. */
  wheel(delta: number, at: Pixel) {
    if (!this.size) return;
    this.stopTween();
    const factor = Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.002);
    const { view } = this.camera;
    const anchor = unproject(view, this.size, at);
    this.show(this.zoomedView(anchor, at, view.pixelsPerDegree * factor, this.size));
    this.settleSoon();
  }

  /** Zooms by `factor`, keeping the place under `focus` (the centre by default) where it is. */
  zoomBy(factor: number, focus?: Pixel) {
    const size = this.size;
    if (!size) return;
    this.stopTween();
    const at = focus ?? { x: size.width / 2, y: size.height / 2 };
    const from = this.camera.view;
    const anchor = unproject(from, size, at);
    if (this.options.reduceMotion) {
      this.show(this.zoomedView(anchor, at, from.pixelsPerDegree * factor, size));
      this.settleSoon();
      return;
    }
    const started = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - started) / TWEEN_MS);
      const eased = 1 - (1 - t) ** 3;
      this.show(this.zoomedView(anchor, at, from.pixelsPerDegree * factor ** eased, size));
      if (t < 1) {
        this.tween = requestAnimationFrame(step);
      } else {
        this.tween = null;
        this.settleSoon();
      }
    };
    this.tween = requestAnimationFrame(step);
  }

  recentre() {
    this.stopTween();
    this.show(this.options.home);
    this.settleSoon();
  }

  private start(points: Pixel[], keep?: Gesture) {
    if (!this.size || points.length === 0) return;
    const at = middle(points);
    this.gesture = {
      anchor: unproject(this.camera.view, this.size, at),
      fingers: points.length,
      spread: spreadOf(points),
      scale: this.camera.view.pixelsPerDegree,
      startedAt: keep?.startedAt ?? Date.now(),
      startedOn: keep?.startedOn ?? at,
      travelled: keep?.travelled ?? 0,
      last: at,
    };
  }

  /** Clamp scale before anchoring a zoom so attempts past a limit cannot shift the map. */
  private zoomedView(anchor: LatLon, at: Pixel, scale: number, size: Size): MapView {
    return viewAround(anchor, at, clampScale(scale, this.options.limits), size);
  }

  /** Shows a view on the next frame. Tiles are laid out again only when it has drifted. */
  private show(next: MapView) {
    const size = this.size;
    if (!size) return;
    const view = clampView(next, this.options.limits, size);
    this.camera = { view, base: this.camera.base };
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const latest = this.camera.view;
      if (hasDrifted(this.camera.base, latest, size)) {
        this.camera = { view: latest, base: latest };
      }
      this.options.onCamera(this.camera);
      this.options.onViewChange?.(latest);
    });
  }

  /** The movement is over: lay the tiles out for where the map stopped. */
  private settle() {
    const { view } = this.camera;
    this.camera = { view, base: view };
    this.options.onCamera(this.camera);
    this.options.onViewChange?.(view);
  }

  private settleSoon() {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.settle(), SETTLE_MS);
  }

  private stopTween() {
    if (this.tween !== null) cancelAnimationFrame(this.tween);
    this.tween = null;
  }
}
