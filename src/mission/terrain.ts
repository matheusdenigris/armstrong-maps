/**
 * Terrain hazards from an elevation model: how steep the ground is, and whether a route crosses
 * ground that is too steep or a field of loose sand.
 *
 * Pure TypeScript. Distances use the radius of Mars from `geo.ts`.
 */
import { METRES_PER_DEGREE, distance, type LatLon } from './geo';
import type { Bounds } from './tiles';

/**
 * Heights on a regular latitude and longitude grid. Row 0 is the northern edge and column 0 the
 * western edge; each value is the height at the centre of its cell, in metres. A cell without
 * data is NaN.
 */
export type ElevationGrid = {
  bounds: Bounds;
  width: number;
  height: number;
  heights: Float32Array;
};

/** The same grid shape holding slopes, in degrees from the horizontal. */
export type SlopeGrid = {
  bounds: Bounds;
  width: number;
  height: number;
  degrees: Float32Array;
  /** The size of one cell on the ground, in metres: the baseline the slope is measured over. */
  cellM: number;
};

/** Where a grid's cell centres are, in degrees. */
const cellSize = (grid: { bounds: Bounds; width: number; height: number }) => ({
  lon: (grid.bounds.east - grid.bounds.west) / grid.width,
  lat: (grid.bounds.north - grid.bounds.south) / grid.height,
});

/**
 * The slope of each cell, from the heights of its neighbours (central differences, one-sided at
 * the edges). A cell next to a missing height gets no slope. The east-west spacing shrinks with
 * the cosine of latitude, as it does on the ground.
 */
export function slopeGrid(grid: ElevationGrid): SlopeGrid {
  const { width, height, heights, bounds } = grid;
  const size = cellSize(grid);
  const dy = size.lat * METRES_PER_DEGREE;
  const degrees = new Float32Array(width * height);
  const at = (col: number, row: number) => heights[row * width + col];

  for (let row = 0; row < height; row += 1) {
    const lat = bounds.north - (row + 0.5) * size.lat;
    const dx = size.lon * METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
    for (let col = 0; col < width; col += 1) {
      const west = Math.max(0, col - 1);
      const east = Math.min(width - 1, col + 1);
      const north = Math.max(0, row - 1);
      const south = Math.min(height - 1, row + 1);
      const dzdx = (at(east, row) - at(west, row)) / ((east - west) * dx);
      const dzdy = (at(col, north) - at(col, south)) / ((south - north) * dy);
      const gradient = Math.hypot(dzdx, dzdy);
      degrees[row * width + col] = Number.isFinite(gradient)
        ? (Math.atan(gradient) * 180) / Math.PI
        : Number.NaN;
    }
  }
  const midLat = (bounds.north + bounds.south) / 2;
  const cellM = Math.min(dy, size.lon * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180));
  return { bounds, width, height, degrees, cellM };
}

/** The slope of the cell under a point, or null outside the grid or where there is no data. */
export function slopeAt(grid: SlopeGrid, point: LatLon): number | null {
  const { bounds, width, height } = grid;
  if (
    point.lat > bounds.north ||
    point.lat < bounds.south ||
    point.lon < bounds.west ||
    point.lon > bounds.east
  ) {
    return null;
  }
  const size = cellSize(grid);
  const col = Math.min(width - 1, Math.floor((point.lon - bounds.west) / size.lon));
  const row = Math.min(height - 1, Math.floor((bounds.north - point.lat) / size.lat));
  const value = grid.degrees[row * width + col];
  return Number.isFinite(value) ? value : null;
}

/** How steep counts as dangerous for a walk. Assumptions of this project, not NASA rules. */
export type SlopeLimits = {
  /** From this slope the walk earns a caution. */
  cautionDeg: number;
  /** From this slope the walk is refused. */
  noGoDeg: number;
};

export type SlopeClass = 'ok' | 'caution' | 'no-go';

export function classifySlope(degrees: number, limits: SlopeLimits): SlopeClass {
  if (degrees >= limits.noGoDeg) return 'no-go';
  if (degrees >= limits.cautionDeg) return 'caution';
  return 'ok';
}

/** The steepest ground under a route, and how much of the route was covered by data. */
export type RouteSlope = {
  /** The steepest slope found, in degrees; null when no point of the route had data. */
  maxDeg: number | null;
  /** Where it is. */
  at: LatLon | null;
  /** The baseline of the grid that measured it, in metres. */
  cellM: number | null;
  /** The share of sampled points that had data, 0 to 1. */
  covered: number;
};

/** Points every `stepM` metres or less along a path, both ends included. */
export function samplePath(points: readonly LatLon[], stepM: number): LatLon[] {
  if (points.length === 0) return [];
  const samples: LatLon[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const steps = Math.max(1, Math.ceil(distance(from, to) / stepM));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      samples.push({ lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t });
    }
  }
  return samples;
}

/**
 * The steepest ground along a route. Each point is read from the finest grid that covers it, so
 * a sharp model near the base is used where it exists and a coarse one beyond it.
 *
 * @param grids from the finest to the coarsest
 */
export function routeSlope(points: readonly LatLon[], grids: readonly SlopeGrid[]): RouteSlope {
  const finest = grids.reduce((step, grid) => Math.min(step, grid.cellM), Number.POSITIVE_INFINITY);
  const samples = samplePath(points, Number.isFinite(finest) ? finest / 2 : 50);
  let maxDeg: number | null = null;
  let at: LatLon | null = null;
  let cellM: number | null = null;
  let covered = 0;
  for (const point of samples) {
    for (const grid of grids) {
      const value = slopeAt(grid, point);
      if (value === null) continue;
      covered += 1;
      if (maxDeg === null || value > maxDeg) {
        maxDeg = value;
        at = point;
        cellM = grid.cellM;
      }
      break;
    }
  }
  return { maxDeg, at, cellM, covered: samples.length ? covered / samples.length : 0 };
}

/** A closed outline on the map, as a list of points (the last joins the first). */
export type Polygon = readonly LatLon[];

/** Even-odd test: is the point inside the outline? */
export function insidePolygon(point: LatLon, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.lat > point.lat !== b.lat > point.lat &&
      point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when any part of the route, sampled every `stepM` metres, lies inside one of the areas. */
export function routeCrosses(
  points: readonly LatLon[],
  areas: readonly Polygon[],
  stepM = 50,
): boolean {
  if (points.length === 0 || areas.length === 0) return false;
  return samplePath(points, stepM).some((point) => areas.some((area) => insidePolygon(point, area)));
}
