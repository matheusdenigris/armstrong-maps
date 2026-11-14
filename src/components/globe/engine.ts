/**
 * Runs the globe in a browser: the WebGL renderer, the texture painted from Mars Trek tiles, the
 * pointer controls and the labels that follow the landing sites. Web only; it is imported by
 * `mars-globe.web.tsx`.
 */
import * as THREE from 'three';

import { VIKING_GLOBAL, tileUrl } from '@/data/layers';
import type { Site } from '@/data/sites';
import { columnsAt, rowsAt } from '@/mission/tiles';

import { FIELD_OF_VIEW, createGlobeScene, fitDistance, toVector } from './scene';

export type GlobeCallbacks = {
  /** A site was chosen and the camera has arrived over it. */
  onOpen: (site: Site) => void;
  /** The element that carries the label of a site; the engine moves it every frame. */
  labelOf: (id: string) => HTMLElement | undefined;
};

export type GlobeEngine = {
  /** Turns the globe to a site, moves in, then reports it as opened. */
  flyTo: (site: Site) => void;
  stop: () => void;
};

const RAD = Math.PI / 180;
/** Closer than this the mosaic turns to blur; the surface map takes over from here. */
const MIN_DISTANCE = 1.9;
/** How close a flight to a site ends. */
const ARRIVAL_DISTANCE = 2.1;
const TAP_MAX_TRAVEL = 8;
const TAP_MAX_MS = 300;
/** How close to a marker a tap has to land, in pixels. */
const TAP_REACH = 34;
/** Degrees per second of the idle spin, eastwards. */
const IDLE_SPIN = 2.4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** The shortest way round from one longitude to another, in degrees. */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * Paints the Viking colour mosaic into a canvas, coarse tiles first so the planet appears at
 * once and sharpens as the rest arrive. Returns a function that cancels the pending tiles.
 */
function paintMosaic(canvas: HTMLCanvasElement, levels: number[], onPaint: () => void) {
  const context = canvas.getContext('2d');
  const pending = new Set<HTMLImageElement>();
  if (!context) return () => {};
  context.fillStyle = '#3a2219';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const paintLevel = (index: number) => {
    const level = levels[index];
    if (level === undefined) return;
    const columns = columnsAt(level);
    const rows = rowsAt(level);
    const width = canvas.width / columns;
    const height = canvas.height / rows;
    let left = columns * rows;
    const done = () => {
      left -= 1;
      if (left === 0) paintLevel(index + 1);
    };
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.onload = () => {
          pending.delete(image);
          context.drawImage(image, col * width, row * height, width, height);
          onPaint();
          done();
        };
        image.onerror = () => {
          pending.delete(image);
          done();
        };
        pending.add(image);
        image.src = tileUrl(VIKING_GLOBAL, { level, row, col });
      }
    }
  };
  paintLevel(0);

  return () => {
    for (const image of pending) {
      image.onload = image.onerror = null;
      image.src = '';
    }
    pending.clear();
  };
}

export function startGlobe(
  host: HTMLElement,
  sites: readonly Site[],
  callbacks: GlobeCallbacks,
): GlobeEngine {
  // Throws when the browser cannot give a WebGL context; the caller shows the fallback.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    touchAction: 'none',
    cursor: 'grab',
    outline: 'none',
  });
  host.prepend(canvas);

  // A 4096 px mosaic on screens that can show it; half that on phones, where it is plenty.
  const large = renderer.capabilities.maxTextureSize >= 4096 && host.clientWidth >= 700;
  const mosaic = document.createElement('canvas');
  mosaic.width = large ? 4096 : 2048;
  mosaic.height = mosaic.width / 2;
  const surface = new THREE.CanvasTexture(mosaic);
  surface.colorSpace = THREE.SRGBColorSpace;
  surface.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const { scene, camera, dispose } = createGlobeScene(sites, surface);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // What the camera looks at, and from how far.
  const view = { lat: 8, lon: 110, distance: 4 };
  let size = { width: 1, height: 1 };
  let farthest = 6;
  let idle = !reduceMotion;
  let dirty = true;
  let texturePending = true;
  let textureAt = 0;
  let spin = { lat: 0, lon: 0 };
  let flight: null | {
    from: typeof view;
    to: typeof view;
    started: number;
    duration: number;
    site: Site;
  } = null;
  let frame = 0;
  let previous = performance.now();
  let stopped = false;
  let firstLayout = true;

  const cancelMosaic = paintMosaic(mosaic, large ? [0, 2, 3] : [0, 2], () => {
    texturePending = true;
  });

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    size = { width, height };
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const fit = fitDistance(camera.aspect);
    const wasFarthest = view.distance >= farthest - 1e-6;
    farthest = fit * 1.25;
    // Keep the whole planet in view when the window changes shape, unless the user moved in.
    if (firstLayout || wasFarthest || view.distance > farthest) view.distance = fit;
    firstLayout = false;
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  /** Radius of the planet on screen, in pixels: what a drag is measured against. */
  const radiusOnScreen = () =>
    size.height / 2 / Math.tan((FIELD_OF_VIEW * RAD) / 2) / Math.sqrt(view.distance ** 2 - 1);

  const direction = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function placeCamera() {
    toVector(view, view.distance, camera.position);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }

  /** Where a site is on screen, or null when it is on the far side. */
  function onScreen(site: Site) {
    toVector(site.landing, 1, normal);
    direction.copy(camera.position).sub(normal).normalize();
    if (normal.dot(direction) < 0.12) return null;
    projected.copy(normal).multiplyScalar(1.012).project(camera);
    return {
      x: ((projected.x + 1) / 2) * size.width,
      y: ((1 - projected.y) / 2) * size.height,
    };
  }

  function placeLabels() {
    for (const site of sites) {
      const label = callbacks.labelOf(site.id);
      if (!label) continue;
      const at = onScreen(site);
      label.style.opacity = at ? '1' : '0';
      label.style.pointerEvents = at ? 'auto' : 'none';
      if (at) {
        // Near the right edge the label goes to the left of its marker, so it is not cut off.
        const flip = at.x > size.width * 0.62;
        const x = Math.round(at.x) + (flip ? -12 : 12);
        label.style.transform = `translate(${x}px, ${Math.round(at.y)}px) translate(${flip ? '-100%' : '0'}, -50%)`;
      }
    }
  }

  function tick(now: number) {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    const seconds = Math.min(0.1, (now - previous) / 1000);
    previous = now;

    if (flight) {
      const t = clamp((now - flight.started) / flight.duration, 0, 1);
      const eased = easeInOut(t);
      view.lat = flight.from.lat + (flight.to.lat - flight.from.lat) * eased;
      view.lon = flight.from.lon + turn(flight.from.lon, flight.to.lon) * eased;
      view.distance = flight.from.distance + (flight.to.distance - flight.from.distance) * eased;
      dirty = true;
      if (t === 1) {
        const { site } = flight;
        flight = null;
        callbacks.onOpen(site);
      }
    } else if (pointers.size === 0) {
      if (Math.abs(spin.lat) + Math.abs(spin.lon) > 0.4) {
        // Coast after a drag, losing speed.
        view.lon -= spin.lon * seconds;
        view.lat = clamp(view.lat + spin.lat * seconds, -85, 85);
        const keep = Math.exp(-3.2 * seconds);
        spin = { lat: spin.lat * keep, lon: spin.lon * keep };
        dirty = true;
      } else if (idle) {
        view.lon += IDLE_SPIN * seconds;
        dirty = true;
      }
    }

    if (texturePending && now - textureAt > 250) {
      surface.needsUpdate = true;
      texturePending = false;
      textureAt = now;
      dirty = true;
    }

    if (!dirty) return;
    dirty = false;
    placeCamera();
    renderer.render(scene, camera);
    placeLabels();
  }

  // --- Pointers: one drags, two pinch. -------------------------------------------------------

  const pointers = new Map<number, { x: number; y: number }>();
  let press: { at: number; x: number; y: number; travelled: number } | null = null;
  let pinch = 0;
  let last = { x: 0, y: 0, at: 0 };

  const local = (event: PointerEvent | WheelEvent) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const centre = () => {
    let x = 0;
    let y = 0;
    for (const point of pointers.values()) {
      x += point.x;
      y += point.y;
    }
    return { x: x / pointers.size, y: y / pointers.size };
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  function takeOver() {
    idle = false;
    flight = null;
    spin = { lat: 0, lon: 0 };
  }

  function onPointerDown(event: PointerEvent) {
    try {
      // Keeps the drag alive when the pointer leaves the canvas.
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the drag simply ends at the edge.
    }
    const point = local(event);
    pointers.set(event.pointerId, point);
    takeOver();
    const middle = centre();
    last = { ...middle, at: performance.now() };
    pinch = spread();
    press = pointers.size === 1 ? { at: last.at, x: point.x, y: point.y, travelled: 0 } : null;
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, local(event));
    const middle = centre();
    const now = performance.now();
    const dx = middle.x - last.x;
    const dy = middle.y - last.y;
    const elapsed = Math.max(1, now - last.at) / 1000;
    // At the centre of the planet the surface follows the finger exactly.
    const degrees = 1 / RAD / radiusOnScreen();
    view.lon -= dx * degrees;
    view.lat = clamp(view.lat + dy * degrees, -85, 85);
    spin = { lon: (dx * degrees) / elapsed, lat: (dy * degrees) / elapsed };
    if (press) {
      press.travelled = Math.max(
        press.travelled,
        Math.hypot(middle.x - press.x, middle.y - press.y),
      );
    }
    const apart = spread();
    if (pointers.size >= 2 && pinch > 0 && apart > 0) {
      view.distance = clamp(view.distance * (pinch / apart), MIN_DISTANCE, farthest);
      pinch = apart;
    }
    last = { ...middle, at: now };
    dirty = true;
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size > 0) {
      // One finger left after a pinch: carry on from where it is, without a jump or a throw.
      last = { ...centre(), at: performance.now() };
      pinch = 0;
      press = null;
      spin = { lat: 0, lon: 0 };
      return;
    }
    canvas.style.cursor = 'grab';
    const now = performance.now();
    // A finger that stopped before lifting does not throw the globe.
    if (now - last.at > 90) spin = { lat: 0, lon: 0 };
    const tapped = press && press.travelled <= TAP_MAX_TRAVEL && now - press.at <= TAP_MAX_MS;
    if (tapped && press) {
      spin = { lat: 0, lon: 0 };
      const site = nearestSite(press.x, press.y);
      if (site) flyTo(site);
    }
    press = null;
    dirty = true;
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    takeOver();
    const pixels = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
    view.distance = clamp(
      view.distance * Math.exp(clamp(pixels, -240, 240) * 0.0012),
      MIN_DISTANCE,
      farthest,
    );
    dirty = true;
  }

  function nearestSite(x: number, y: number): Site | null {
    placeCamera();
    let best: Site | null = null;
    let reach = TAP_REACH;
    for (const site of sites) {
      const at = onScreen(site);
      if (!at) continue;
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance < reach) {
        reach = distance;
        best = site;
      }
    }
    return best;
  }

  function flyTo(site: Site) {
    idle = false;
    spin = { lat: 0, lon: 0 };
    const to = { lat: site.landing.lat, lon: site.landing.lon, distance: ARRIVAL_DISTANCE };
    if (reduceMotion) {
      Object.assign(view, to);
      dirty = true;
      callbacks.onOpen(site);
      return;
    }
    flight = { from: { ...view }, to, started: performance.now(), duration: 1100, site };
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  frame = requestAnimationFrame(tick);

  return {
    flyTo,
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      cancelMosaic();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      dispose();
      surface.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
