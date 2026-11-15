import { describe, expect, it } from 'vitest';

import { layoutPlace } from '@/components/place-layout';

import { SOL_20_FEED } from './place-views.fixture';
import {
  PLACE_FLOOR_DEG,
  PLACE_WITHIN_M,
  clearAhead,
  goesAllRound,
  lookUp,
  parsePlaceFrames,
  placeFramesUrl,
  placeGaps,
  placeViewOf,
  stopsNear,
} from './place-views';
import type { RoverStop } from './rover';

/** The stop of Perseverance on sol 20, as its traverse gives it. */
const STOP: RoverStop = {
  sol: 20,
  point: { lat: 18.44514836, lon: 77.45185605 },
  site: 3,
  drive: 770,
};

describe('the frames of a stop', () => {
  const frames = parsePlaceFrames(SOL_20_FEED, STOP);

  it('keeps the whole frames taken at that stop, one for each direction', () => {
    // The quarter of a frame and the frame of another stop are left out.
    expect(frames).toHaveLength(5);
    for (const frame of frames) {
      expect(frame.url).toMatch(/^https:\/\/mars\.nasa\.gov\/mars2020-raw-images\//);
      expect(frame.width).toBe(1280);
      expect(frame.height).toBe(960);
      expect(frame.elevation).toBeGreaterThan(-35);
      expect(frame.elevation).toBeLessThan(-25);
    }
  });

  it('puts them in order round the compass, a fifth of a turn apart', () => {
    const azimuths = frames.map((frame) => frame.azimuth);
    expect([...azimuths].sort((a, b) => a - b)).toEqual(azimuths);
    azimuths.forEach((azimuth, index) => {
      const next = azimuths[(index + 1) % azimuths.length];
      const step = (((next - azimuth) % 360) + 360) % 360;
      expect(step).toBeGreaterThan(68);
      expect(step).toBeLessThan(76);
    });
  });

  it('go all the way round, and do not with one missing', () => {
    expect(goesAllRound(frames)).toBe(true);
    expect(goesAllRound(frames.slice(1))).toBe(false);
    expect(goesAllRound([])).toBe(false);
  });

  it('show their own pointing near their middle', () => {
    for (const frame of frames) {
      const pixel = lookUp(frame, frame.azimuth, frame.elevation)!;
      expect(Math.abs(pixel.x - frame.width / 2)).toBeLessThan(40);
      expect(Math.abs(pixel.y - frame.height / 2)).toBeLessThan(40);
    }
  });

  it('are none for another stop, or for an answer that is not the feed', () => {
    expect(parsePlaceFrames(SOL_20_FEED, { ...STOP, drive: 1 })).toEqual([]);
    expect(parsePlaceFrames(null, STOP)).toEqual([]);
    expect(parsePlaceFrames({ images: 'none' }, STOP)).toEqual([]);
  });
});

describe('the view from a stop', () => {
  const view = placeViewOf('perseverance', STOP, SOL_20_FEED)!;

  it('is made when the frames go all the way round', () => {
    expect(view.id).toBe('perseverance-3-770');
    expect(view.frames).toHaveLength(5);
    // The traverse gives a yaw of 127.8 degrees for this stop.
    expect(view.yaw).toBeCloseTo(127.8, 0);
  });

  it('is not made from too few frames', () => {
    const fewer = { images: SOL_20_FEED.images.slice(2) };
    expect(placeViewOf('perseverance', STOP, fewer)).toBeNull();
  });

  it('says where the rover itself shows, turned to the compass', () => {
    const gaps = placeGaps(view);
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.from).toBeGreaterThanOrEqual(0);
      expect(gap.from).toBeLessThan(360);
      expect(gap.top).toBeGreaterThan(PLACE_FLOOR_DEG);
    }
    // Straight behind the rover, which faces 127.8, is 307.8.
    const behind = gaps.find((gap) => {
      const span = (gap.to - gap.from + 360) % 360;
      return (307.8 - gap.from + 360) % 360 <= span;
    });
    expect(behind).toBeDefined();
  });

  it('is clear ahead of the rover and not behind it', () => {
    expect(clearAhead(view, 127.8)).toBe(true);
    expect(clearAhead(view, 127.8 + 90)).toBe(true);
    expect(clearAhead(view, 307.8)).toBe(false);
    expect(clearAhead(view, 307.8 + 360)).toBe(false);
  });

  it('lays out cells all the way round, with sky above and a level for each frame', () => {
    const layout = layoutPlace(view, 700);
    expect(layout.step).toBe(6);
    expect(layout.marks).toHaveLength(60);
    expect(layout.marks.every((mark) => mark !== null)).toBe(true);
    expect(layout.levels.every((level) => level !== null)).toBe(true);
    expect(layout.sky).toHaveLength(180);
    expect(layout.below).toHaveLength(60);
    // Every column of compass has cells of its own, not only cells let through at a join.
    const solid = layout.cells.filter((cell) => cell.side === null);
    expect(new Set(solid.map((cell) => cell.azimuth)).size).toBe(60);
    // One cell at the top of each column fades into the sky.
    expect(solid.filter((cell) => cell.fades)).toHaveLength(60);
    for (const cell of layout.cells) {
      expect(cell.width).toBeGreaterThan(0);
      expect(cell.height).toBeGreaterThan(0);
      expect(cell.matrix).toHaveLength(16);
      expect([...cell.matrix, ...cell.picture].every(Number.isFinite)).toBe(true);
      if (cell.side) cell.side.forEach((share) => expect(share).toBeLessThanOrEqual(1));
    }
  });
});

describe('the stops near a position', () => {
  const stops: RoverStop[] = [
    STOP,
    { sol: 23, point: { lat: 18.44520229, lon: 77.45177711 }, site: 3, drive: 792 },
    { sol: 130, point: { lat: 18.4533, lon: 77.4519 }, site: 5, drive: 0 },
  ];

  it('are the ones within reach, nearest first', () => {
    const near = stopsNear(stops, STOP.point);
    expect(near.map((entry) => entry.stop.drive)).toEqual([770, 792]);
    expect(near[0].awayM).toBeCloseTo(0, 6);
    expect(near[1].awayM).toBeLessThan(PLACE_WITHIN_M);
  });

  it('are none far from the traverse', () => {
    expect(stopsNear(stops, { lat: 18.6, lon: 77.6 })).toEqual([]);
  });
});

describe('the address of the frames of a sol', () => {
  it('asks the raw image feed for the navigation camera on that sol', () => {
    const url = placeFramesUrl('perseverance', 20)!;
    expect(url).toContain('category=mars2020');
    expect(url).toContain('NAVCAM_LEFT');
    expect(url).toMatch(/&sol=20$/);
  });

  it('is none for a rover whose feed does not tie a frame to a stop', () => {
    expect(placeFramesUrl('curiosity', 20)).toBeNull();
  });
});
