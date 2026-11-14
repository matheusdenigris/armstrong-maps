/**
 * The tile grid of NASA's Mars Trek.
 *
 * Trek serves equirectangular tiles, not Web Mercator: one degree of longitude and one degree of
 * latitude take the same number of pixels everywhere. Level 0 is two tiles side by side, and each
 * level doubles both directions, so level L has 2^(L+1) columns and 2^L rows. Row 0 touches the
 * north pole and column 0 starts at 180 W.
 */
import type { LatLon } from './geo';

/** A rectangle in degrees. Longitudes are -180..180 and `west` is less than `east`. */
export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type TileAddress = {
  level: number;
  row: number;
  col: number;
};

export const WHOLE_PLANET: Bounds = { west: -180, south: -90, east: 180, north: 90 };

/** Tiles are 256 pixels square. */
export const TILE_PIXELS = 256;

export const columnsAt = (level: number) => 2 ** (level + 1);
export const rowsAt = (level: number) => 2 ** level;

/** Degrees covered by one side of a tile at `level`. */
export const tileSpan = (level: number) => 180 / 2 ** level;

export function tileBounds({ level, row, col }: TileAddress): Bounds {
  const span = tileSpan(level);
  return {
    west: -180 + col * span,
    east: -180 + (col + 1) * span,
    north: 90 - row * span,
    south: 90 - (row + 1) * span,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The tile that contains a point. Points on the east or south edge belong to the last tile. */
export function tileAt(level: number, point: LatLon): TileAddress {
  const span = tileSpan(level);
  return {
    level,
    row: clamp(Math.floor((90 - point.lat) / span), 0, rowsAt(level) - 1),
    col: clamp(Math.floor((point.lon + 180) / span), 0, columnsAt(level) - 1),
  };
}

export function contains(bounds: Bounds, point: LatLon): boolean {
  return (
    point.lon >= bounds.west &&
    point.lon <= bounds.east &&
    point.lat >= bounds.south &&
    point.lat <= bounds.north
  );
}

/** The overlap of two rectangles, or null when they only touch or do not meet. */
export function intersect(a: Bounds, b: Bounds): Bounds | null {
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);
  return west < east && south < north ? { west, south, east, north } : null;
}

/**
 * The level whose tiles are drawn at their natural size for a given map scale. Fractional: 4.5
 * means level 4 tiles would be stretched and level 5 tiles squeezed.
 */
export function levelForScale(pixelsPerDegree: number): number {
  return Math.log2((pixelsPerDegree * 180) / TILE_PIXELS);
}

/** How many tiles of `level` it takes to cover `area`. */
export function tileCount(area: Bounds, level: number): number {
  const range = tileRange(area, level);
  return range ? (range.lastCol - range.firstCol + 1) * (range.lastRow - range.firstRow + 1) : 0;
}

/** Every tile of `level` that overlaps `area`, row by row from the north-west. */
export function tilesCovering(area: Bounds, level: number): TileAddress[] {
  const range = tileRange(area, level);
  if (!range) return [];
  const tiles: TileAddress[] = [];
  for (let row = range.firstRow; row <= range.lastRow; row += 1) {
    for (let col = range.firstCol; col <= range.lastCol; col += 1) {
      tiles.push({ level, row, col });
    }
  }
  return tiles;
}

function tileRange(area: Bounds, level: number) {
  const visible = intersect(area, WHOLE_PLANET);
  if (!visible) return null;
  const span = tileSpan(level);
  // The east and south edges are exclusive: an area that ends on a tile border does not need the
  // next tile.
  return {
    firstCol: Math.floor((visible.west + 180) / span),
    lastCol: Math.min(columnsAt(level) - 1, Math.ceil((visible.east + 180) / span) - 1),
    firstRow: Math.floor((90 - visible.north) / span),
    lastRow: Math.min(rowsAt(level) - 1, Math.ceil((90 - visible.south) / span) - 1),
  };
}

export type TileRequest = {
  /** Never ask a product for a level deeper than it has. */
  maxLevel: number;
  /** The product's coverage; nothing is requested outside it. */
  coverage: Bounds;
  /** The part of the planet on screen. */
  view: Bounds;
  pixelsPerDegree: number;
  /** Upper bound on the answer. The level drops until the tiles fit. */
  limit?: number;
};

/**
 * The tiles to draw for one product: sharp enough for the scale, inside the product's coverage,
 * and never more than `limit`.
 */
export function tilesFor({
  maxLevel,
  coverage,
  view,
  pixelsPerDegree,
  limit = 40,
}: TileRequest): TileAddress[] {
  const area = intersect(view, coverage);
  if (!area) return [];
  // A quarter of a level of tolerance: slightly stretched tiles beat four times as many requests.
  let level = clamp(Math.ceil(levelForScale(pixelsPerDegree) - 0.25), 0, maxLevel);
  while (level > 0 && tileCount(area, level) > limit) level -= 1;
  return tilesCovering(area, level);
}
