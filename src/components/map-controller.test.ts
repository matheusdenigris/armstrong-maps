import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('MapController taps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const tapping = () => {
    const onPress = vi.fn();
    const controller = new MapController({
      home,
      limits,
      reduceMotion: true,
      onCamera: vi.fn(),
      onPress,
    });
    controller.setSize(size);
    const tap = (x: number, y: number) => {
      controller.begin([{ x, y }]);
      controller.end();
    };
    return { controller, onPress, tap };
  };

  it('reports a single tap once it is clear no second one follows', () => {
    const { onPress, tap } = tapping();

    tap(200, 400);
    expect(onPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);

    expect(onPress).toHaveBeenCalledTimes(1);
    // The middle of the map is the place the map is centred on.
    expect(onPress.mock.calls[0][0].lat).toBeCloseTo(home.lat, 6);
    expect(onPress.mock.calls[0][0].lon).toBeCloseTo(home.lon, 6);
  });

  it('zooms in one step on a double tap, around the place tapped, without a press', () => {
    const { controller, onPress, tap } = tapping();

    tap(300, 200);
    vi.advanceTimersByTime(120);
    tap(304, 203);
    vi.advanceTimersByTime(1000);

    expect(onPress).not.toHaveBeenCalled();
    const view = controller.currentCamera().view;
    expect(view.pixelsPerDegree).toBe(home.pixelsPerDegree * 2);
    // The map moved towards the tap, which was right of and above the middle.
    expect(view.lon).toBeGreaterThan(home.lon);
    expect(view.lat).toBeGreaterThan(home.lat);
  });

  it('keeps both taps when two quick ones land in different places', () => {
    const { controller, onPress, tap } = tapping();

    tap(100, 300);
    vi.advanceTimersByTime(150);
    tap(320, 600);
    // The first is reported as soon as the second shows it was not half of a double tap.
    expect(onPress).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(onPress.mock.calls[0][0].lon).toBeLessThan(home.lon);
    expect(onPress.mock.calls[1][0].lon).toBeGreaterThan(home.lon);
    expect(controller.currentCamera().view.pixelsPerDegree).toBe(home.pixelsPerDegree);
  });

  it('does not take a drag for a tap', () => {
    const { onPress, controller } = tapping();

    controller.begin([{ x: 200, y: 400 }]);
    controller.move([{ x: 260, y: 400 }]);
    controller.end();
    vi.advanceTimersByTime(1000);

    expect(onPress).not.toHaveBeenCalled();
  });
});
