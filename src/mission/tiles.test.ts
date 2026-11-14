import { describe, expect, it } from 'vitest';

import {
  TILE_PIXELS,
  WHOLE_PLANET,
  columnsAt,
  contains,
  intersect,
  levelForScale,
  rowsAt,
  tileAt,
  tileBounds,
  tileCount,
  tileSpan,
  tilesCovering,
  tilesFor,
} from './tiles';

const GALE = { lat: -4.5895, lon: 137.4417 };

describe('the grid', () => {
  it('has two tiles at level 0 and doubles each level', () => {
    expect([columnsAt(0), rowsAt(0)]).toEqual([2, 1]);
    expect([columnsAt(1), rowsAt(1)]).toEqual([4, 2]);
    expect([columnsAt(7), rowsAt(7)]).toEqual([256, 128]);
  });

  it('halves the span of a tile each level', () => {
    expect(tileSpan(0)).toBe(180);
    expect(tileSpan(1)).toBe(90);
    expect(tileSpan(10)).toBeCloseTo(0.17578125, 12);
  });

  it('starts at the north pole and at 180 W', () => {
    expect(tileBounds({ level: 0, row: 0, col: 0 })).toEqual({
      west: -180,
      east: 0,
      north: 90,
      south: -90,
    });
    expect(tileBounds({ level: 1, row: 1, col: 3 })).toEqual({
      west: 90,
      east: 180,
      north: 0,
      south: -90,
    });
  });
});

describe('tileAt', () => {
  it('finds the tile that contains a point', () => {
    for (const level of [0, 3, 10, 16]) {
      const tile = tileAt(level, GALE);
      expect(contains(tileBounds(tile), GALE)).toBe(true);
    }
  });

  it('computes the address of Gale at level 10', () => {
    // A level 10 tile spans 180 / 1024 = 0.17578125 degrees.
    // Row: (90 + 4.5895) / 0.17578125 = 538.1. Column: (137.4417 + 180) / 0.17578125 = 1805.9.
    expect(tileAt(10, GALE)).toEqual({ level: 10, row: 538, col: 1805 });
  });

  it('keeps the poles and the antimeridian inside the grid', () => {
    expect(tileAt(2, { lat: 90, lon: -180 })).toEqual({ level: 2, row: 0, col: 0 });
    expect(tileAt(2, { lat: -90, lon: 180 })).toEqual({ level: 2, row: 3, col: 7 });
  });
});

describe('intersect', () => {
  const a = { west: 0, south: 0, east: 10, north: 10 };

  it('returns the overlap', () => {
    expect(intersect(a, { west: 5, south: -5, east: 20, north: 5 })).toEqual({
      west: 5,
      south: 0,
      east: 10,
      north: 5,
    });
  });

  it('is null when the rectangles only touch or are apart', () => {
    expect(intersect(a, { west: 10, south: 0, east: 20, north: 10 })).toBeNull();
    expect(intersect(a, { west: 30, south: 30, east: 40, north: 40 })).toBeNull();
  });
});

describe('tilesCovering', () => {
  it('covers the planet with every tile of the level', () => {
    expect(tilesCovering(WHOLE_PLANET, 0)).toHaveLength(2);
    expect(tilesCovering(WHOLE_PLANET, 2)).toHaveLength(32);
    expect(tileCount(WHOLE_PLANET, 3)).toBe(128);
  });

  it('does not take the next tile when the area ends on a border', () => {
    const oneTile = tileBounds({ level: 4, row: 5, col: 9 });
    expect(tilesCovering(oneTile, 4)).toEqual([{ level: 4, row: 5, col: 9 }]);
  });

  it('lists tiles row by row from the north-west', () => {
    const area = { west: -1, south: -1, east: 1, north: 1 };
    expect(tilesCovering(area, 1)).toEqual([
      { level: 1, row: 0, col: 1 },
      { level: 1, row: 0, col: 2 },
      { level: 1, row: 1, col: 1 },
      { level: 1, row: 1, col: 2 },
    ]);
  });

  it('ignores the part of an area that is off the planet', () => {
    const area = { west: 170, south: 80, east: 200, north: 120 };
    expect(tilesCovering(area, 0)).toEqual([{ level: 0, row: 0, col: 1 }]);
  });
});

describe('levelForScale', () => {
  it('is the level whose tiles are drawn at natural size', () => {
    for (const level of [0, 5, 12]) {
      const pixelsPerDegree = TILE_PIXELS / tileSpan(level);
      expect(levelForScale(pixelsPerDegree)).toBeCloseTo(level, 9);
    }
  });
});

describe('tilesFor', () => {
  const view = { west: 137.2, south: -4.8, east: 137.7, north: -4.3 };
  const coverage = { west: 135.18, south: -6.57, east: 139.24, north: -2.81 };
  const natural = (level: number) => TILE_PIXELS / tileSpan(level);

  it('uses the level that matches the scale', () => {
    const tiles = tilesFor({ maxLevel: 12, coverage, view, pixelsPerDegree: natural(10) });
    expect(tiles.length).toBeGreaterThan(0);
    expect(new Set(tiles.map((t) => t.level))).toEqual(new Set([10]));
  });

  it('never goes deeper than the product', () => {
    const tiles = tilesFor({ maxLevel: 7, coverage, view, pixelsPerDegree: natural(14) });
    expect(new Set(tiles.map((t) => t.level))).toEqual(new Set([7]));
  });

  it('asks for nothing outside the coverage', () => {
    const elsewhere = { west: -60, south: 20, east: -50, north: 30 };
    expect(tilesFor({ maxLevel: 12, coverage, view: elsewhere, pixelsPerDegree: 500 })).toEqual([]);
  });

  it('only returns tiles that overlap both the view and the coverage', () => {
    const wide = { west: 130, south: -10, east: 145, north: 0 };
    const tiles = tilesFor({ maxLevel: 12, coverage, view: wide, pixelsPerDegree: natural(8) });
    for (const tile of tiles) {
      expect(intersect(tileBounds(tile), coverage)).not.toBeNull();
    }
  });

  it('drops to a coarser level instead of exceeding the limit', () => {
    const request = { maxLevel: 12, coverage, view: coverage, pixelsPerDegree: natural(12) };
    const tiles = tilesFor({ ...request, limit: 30 });
    expect(tiles.length).toBeLessThanOrEqual(30);
    expect(tiles[0].level).toBeLessThan(12);
  });
});
