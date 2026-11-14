import { afterEach, describe, expect, it, vi } from 'vitest';

import { MapController } from './map-controller';

type Frame = FrameRequestCallback;

const home = { lat: -4.59, lon: 137.44, pixelsPerDegree: 1000 };
const limits = { min: 2, max: 5000 };
const size = { width: 400, height: 800 };

describe('MapController.recentre', () => {
  afterEach(() => vi.restoreAllMocks());

  it('eases the map back to the landing site instead of jumping there', () => {
    const frames = new Map<number, Frame>();
    let frameId = 0;
    let now = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: Frame) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const nextFrame = () => {
      const frame = frames.entries().next().value;
      expect(frame).toBeDefined();
      const [id, callback] = frame!;
      frames.delete(id);
      callback(now);
    };

    const controller = new MapController({
      home,
      limits,
      reduceMotion: false,
      onCamera: vi.fn(),
    });
    controller.setSize(size);
    controller.begin([{ x: 200, y: 400 }]);
    controller.move([{ x: 300, y: 400 }]);
    nextFrame();
    const moved = controller.currentCamera().view;

    controller.recentre();
    now = 160;
    nextFrame();
    const halfway = controller.currentCamera().view;

    expect(halfway.lon).toBeGreaterThan(moved.lon);
    expect(halfway.lon).toBeLessThan(home.lon);

    now = 320;
    // Showing the midpoint reports the view on one frame and schedules the next tween frame.
    nextFrame();
    nextFrame();
    expect(controller.currentCamera().view).toEqual(home);
  });

  it('returns immediately when reduced motion is enabled', () => {
    const controller = new MapController({
      home,
      limits,
      reduceMotion: true,
      onCamera: vi.fn(),
    });
    controller.setSize(size);
    controller.begin([{ x: 200, y: 400 }]);
    controller.move([{ x: 300, y: 400 }]);

    controller.recentre();

    expect(controller.currentCamera().view).toEqual(home);
  });
});
