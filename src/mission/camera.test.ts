import { describe, expect, it } from 'vitest';

import {
  clampView,
  hasDrifted,
  limitsForSurfaceFrame,
  project,
  unproject,
  viewAround,
  visibleBounds,
  type MapView,
} from './camera';

const size = { width: 400, height: 800 };
const view: MapView = { lat: -4.59, lon: 137.44, pixelsPerDegree: 1000 };

describe('project and unproject', () => {
  it('put the centre of the view in the middle of the screen', () => {
    expect(project(view, size, view)).toEqual({ x: 200, y: 400 });
  });

  it('put north up and east to the right', () => {
    const north = project(view, size, { lat: view.lat + 0.1, lon: view.lon });
    const east = project(view, size, { lat: view.lat, lon: view.lon + 0.1 });
    expect(north.y).toBeCloseTo(300, 6);
    expect(east.x).toBeCloseTo(300, 6);
  });

  it('are inverses', () => {
    const pixel = { x: 37, y: 612 };
    const back = project(view, size, unproject(view, size, pixel));
    expect(back.x).toBeCloseTo(pixel.x, 6);
    expect(back.y).toBeCloseTo(pixel.y, 6);
  });
});

describe('viewAround', () => {
  it('keeps a place under the finger while the scale changes', () => {
    const finger = { x: 90, y: 150 };
    const place = unproject(view, size, finger);
    const zoomed = viewAround(place, finger, 4000, size);
    const after = project(zoomed, size, place);
    expect(after.x).toBeCloseTo(finger.x, 6);
    expect(after.y).toBeCloseTo(finger.y, 6);
    expect(zoomed.pixelsPerDegree).toBe(4000);
  });

  it('moves the map with the finger', () => {
    const start = { x: 200, y: 400 };
    const place = unproject(view, size, start);
    const dragged = viewAround(place, { x: 300, y: 400 }, view.pixelsPerDegree, size);
    // Dragging right by 100 px moves the centre 0.1 degrees west.
    expect(dragged.lon).toBeCloseTo(view.lon - 0.1, 9);
    expect(dragged.lat).toBeCloseTo(view.lat, 9);
  });
});

describe('clampView', () => {
  const limits = { min: 2, max: 5000 };

  it('keeps the scale inside the limits', () => {
    expect(clampView({ ...view, pixelsPerDegree: 0.1 }, limits).pixelsPerDegree).toBe(2);
    expect(clampView({ ...view, pixelsPerDegree: 9e9 }, limits).pixelsPerDegree).toBe(5000);
  });

  it('keeps the centre on the planet', () => {
    const lost = clampView({ lat: 120, lon: -400, pixelsPerDegree: 10 }, limits);
    expect(lost).toEqual({ lat: 90, lon: -180, pixelsPerDegree: 10 });
  });
});

describe('limitsForSurfaceFrame', () => {
  it('prevents a surface map from showing a whole-planet equirectangular frame', () => {
    expect(limitsForSurfaceFrame({ min: 2, max: 5000 }, { width: 400, height: 720 })).toEqual({
      min: 8,
      max: 5000,
    });
  });

  it('preserves a stricter caller minimum and never exceeds the maximum', () => {
    expect(limitsForSurfaceFrame({ min: 12, max: 5000 }, { width: 400, height: 720 })).toEqual({
      min: 12,
      max: 5000,
    });
    expect(limitsForSurfaceFrame({ min: 2, max: 6 }, { width: 400, height: 720 })).toEqual({
      min: 6,
      max: 6,
    });
  });
});

describe('visibleBounds', () => {
  it('is the rectangle on screen', () => {
    const bounds = visibleBounds(view, size);
    expect(bounds.east - bounds.west).toBeCloseTo(0.4, 9);
    expect(bounds.north - bounds.south).toBeCloseTo(0.8, 9);
  });

  it('grows by a fraction of the screen on every side', () => {
    const bounds = visibleBounds(view, size, 0.5);
    expect(bounds.east - bounds.west).toBeCloseTo(0.8, 9);
    expect(bounds.north - bounds.south).toBeCloseTo(1.6, 9);
  });
});

describe('hasDrifted', () => {
  it('is false for a small move', () => {
    expect(hasDrifted(view, { ...view, lon: view.lon + 0.05 }, size)).toBe(false);
    expect(hasDrifted(view, { ...view, pixelsPerDegree: 1200 }, size)).toBe(false);
  });

  it('is true after a third of the screen or half a level', () => {
    expect(hasDrifted(view, { ...view, lon: view.lon + 0.2 }, size)).toBe(true);
    expect(hasDrifted(view, { ...view, lat: view.lat - 0.3 }, size)).toBe(true);
    expect(hasDrifted(view, { ...view, pixelsPerDegree: 1500 }, size)).toBe(true);
    expect(hasDrifted(view, { ...view, pixelsPerDegree: 600 }, size)).toBe(true);
  });
});
