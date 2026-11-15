/**
 * The height of the whole planet on a coarse grid, for the relief of the globe.
 *
 * The grid is equirectangular: rows from north to south, columns from 180 W to 180 E, each value
 * the height of the middle of its cell in metres above the MOLA areoid. It wraps round the planet
 * in longitude.
 */
import { MARS_RADIUS_M, type LatLon } from './geo';

export type GlobalRelief = {
  width: number;
  height: number;
  /** Metres above the areoid, row by row from the north. */
  metres: Int16Array;
};

/** The grid that `scripts/build-globe-relief.mjs` writes. */
export const RELIEF_WIDTH = 512;
export const RELIEF_HEIGHT = 256;

/**
 * How many times taller than life the globe draws its relief. At true scale Olympus Mons is 0.6%
 * of the radius of Mars, which is a pixel or two on a screen. A project choice, not a NASA value.
 */
export const RELIEF_EXAGGERATION = 6;

const RADIUS_M = MARS_RADIUS_M;

/** Reads the file: little-endian 16-bit heights. Null when it is not the grid that was expected. */
export function parseGlobalRelief(
  buffer: ArrayBuffer,
  width = RELIEF_WIDTH,
  height = RELIEF_HEIGHT,
): GlobalRelief | null {
  if (buffer.byteLength !== width * height * 2) return null;
  const view = new DataView(buffer);
  const metres = new Int16Array(width * height);
  for (let index = 0; index < metres.length; index += 1) {
    metres[index] = view.getInt16(index * 2, true);
  }
  return { width, height, metres };
}

/** The height at a point, in metres, between the four cells around it. */
export function heightAt(relief: GlobalRelief, { lat, lon }: LatLon): number {
  const { width, height, metres } = relief;
  const x = ((lon + 180) / 360) * width - 0.5;
  const y = Math.min(height - 1, Math.max(0, ((90 - lat) / 180) * height - 0.5));
  const column = Math.floor(x);
  const row = Math.min(height - 2, Math.floor(y));
  const across = x - column;
  const down = y - row;
  const west = ((column % width) + width) % width;
  const east = (west + 1) % width;
  const top = metres[row * width + west] * (1 - across) + metres[row * width + east] * across;
  const bottom =
    metres[(row + 1) * width + west] * (1 - across) + metres[(row + 1) * width + east] * across;
  return top * (1 - down) + bottom * down;
}

/**
 * The radius of the drawn globe at a point, where the areoid is 1: the real height over the real
 * radius, times the exaggeration. Without a grid the globe is a smooth sphere.
 */
export function drawnRadius(
  relief: GlobalRelief | null,
  point: LatLon,
  exaggeration = RELIEF_EXAGGERATION,
): number {
  if (!relief) return 1;
  return 1 + (heightAt(relief, point) / RADIUS_M) * exaggeration;
}

/**
 * The highest drawn radius within `reachDeg` of a point: where something flat has to lie to clear
 * the ground around it.
 */
export function highestRadiusNear(
  relief: GlobalRelief | null,
  { lat, lon }: LatLon,
  reachDeg: number,
  exaggeration = RELIEF_EXAGGERATION,
): number {
  if (!relief) return 1;
  const step = 180 / relief.height;
  const widen = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  let highest = drawnRadius(relief, { lat, lon }, exaggeration);
  for (let north = -reachDeg; north <= reachDeg; north += step) {
    const at = lat + north;
    if (at < -90 || at > 90) continue;
    for (let east = -reachDeg * widen; east <= reachDeg * widen; east += step * widen) {
      highest = Math.max(highest, drawnRadius(relief, { lat: at, lon: lon + east }, exaggeration));
    }
  }
  return highest;
}

/**
 * The slope of the ground at every cell as a tangent-space normal map: red is the lean to the
 * east, green to the north, blue straight up, four bytes a cell, rows from the south (the way a
 * texture counts them). The slopes are taken at the drawn scale, so the shading agrees with the
 * shape.
 */
export function reliefNormals(
  relief: GlobalRelief,
  exaggeration = RELIEF_EXAGGERATION,
): Uint8Array {
  const { width, height, metres } = relief;
  const out = new Uint8Array(width * height * 4);
  const cellNorthM = (Math.PI * RADIUS_M) / height;
  for (let row = 0; row < height; row += 1) {
    const lat = 90 - ((row + 0.5) / height) * 180;
    // Cells narrow towards the poles; the floor keeps the last rows from turning into spikes.
    const cellEastM = ((2 * Math.PI * RADIUS_M) / width) * Math.max(0.05, Math.cos((lat * Math.PI) / 180));
    const above = Math.max(0, row - 1);
    const below = Math.min(height - 1, row + 1);
    for (let column = 0; column < width; column += 1) {
      const west = (column + width - 1) % width;
      const east = (column + 1) % width;
      const toEast = (metres[row * width + east] - metres[row * width + west]) / (2 * cellEastM);
      const toNorth =
        (metres[above * width + column] - metres[below * width + column]) /
        ((below - above) * cellNorthM);
      const x = -toEast * exaggeration;
      const y = -toNorth * exaggeration;
      const length = Math.hypot(x, y, 1);
      const index = ((height - 1 - row) * width + column) * 4;
      out[index] = Math.round((x / length) * 127.5 + 127.5);
      out[index + 1] = Math.round((y / length) * 127.5 + 127.5);
      out[index + 2] = Math.round((1 / length) * 127.5 + 127.5);
      out[index + 3] = 255;
    }
  }
  return out;
}
