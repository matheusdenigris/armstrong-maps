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

/** The height under a point, between the four cells around it, in metres; null where there is none. */
export function heightAt(grid: ElevationGrid, point: LatLon): number | null {
  const { bounds, width, height, heights } = grid;
  if (
    point.lat > bounds.north ||
    point.lat < bounds.south ||
    point.lon < bounds.west ||
    point.lon > bounds.east
  ) {
    return null;
  }
  const size = cellSize(grid);
  // Cell centres are half a cell in from the edges; a point nearer the edge takes the edge cell.
  const x = Math.min(width - 1, Math.max(0, (point.lon - bounds.west) / size.lon - 0.5));
  const y = Math.min(height - 1, Math.max(0, (bounds.north - point.lat) / size.lat - 0.5));
  if (width < 2 || height < 2) {
    const only = heights[Math.round(y) * width + Math.round(x)];
    return Number.isFinite(only) ? only : null;
  }
  const col = Math.min(width - 2, Math.floor(x));
  const row = Math.min(height - 2, Math.floor(y));
  const across = x - col;
  const down = y - row;
  const value =
    heights[row * width + col] * (1 - across) * (1 - down) +
    heights[row * width + col + 1] * across * (1 - down) +
    heights[(row + 1) * width + col] * (1 - across) * down +
    heights[(row + 1) * width + col + 1] * across * down;
  return Number.isFinite(value) ? value : null;
}

/** The heights along a route, and how much it climbs and descends. */
export type RouteProfile = {
  /** One sample every step: how far along the route it is, and its height where there is one. */
  samples: { distanceM: number; heightM: number | null }[];
  totalM: number;
  /** The sum of every rise along the route, in metres; null when no sample had a height. */
  ascentM: number | null;
  /** The sum of every drop, in metres, as a positive number. */
  descentM: number | null;
  lowestM: number | null;
  highestM: number | null;
  /** The share of samples that had a height, 0 to 1. */
  covered: number;
  /** The cell of the coarsest grid that was used, in metres: smaller bumps do not show. */
  cellM: number | null;
};

/**
 * The profile of a route. Each sample is read from the finest grid that covers it. The climb is
 * counted between samples one step apart, so a rise narrower than a cell of the model is not in
 * it: the real ground climbs at least this much.
 *
 * @param grids elevation grids from the finest to the coarsest
 */
export function routeProfile(
  points: readonly LatLon[],
  grids: readonly ElevationGrid[],
): RouteProfile {
  const cells = grids.map((grid) => {
    const size = cellSize(grid);
    const midLat = (grid.bounds.north + grid.bounds.south) / 2;
    return Math.min(
      size.lat * METRES_PER_DEGREE,
      size.lon * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180),
    );
  });
  const finest = cells.reduce((step, cell) => Math.min(step, cell), Number.POSITIVE_INFINITY);
  const path = samplePath(points, Number.isFinite(finest) ? finest : 50);
  const samples: RouteProfile['samples'] = [];
  let along = 0;
  let ascent = 0;
  let descent = 0;
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  let covered = 0;
  let coarsest = 0;
  let previous: number | null = null;
  path.forEach((point, index) => {
    if (index > 0) along += distance(path[index - 1], point);
    let heightM: number | null = null;
    for (let grid = 0; grid < grids.length; grid += 1) {
      heightM = heightAt(grids[grid], point);
      if (heightM !== null) {
        coarsest = Math.max(coarsest, cells[grid]);
        break;
      }
    }
    samples.push({ distanceM: along, heightM });
    if (heightM === null) return;
    covered += 1;
    lowest = Math.min(lowest, heightM);
    highest = Math.max(highest, heightM);
    if (previous !== null) {
      if (heightM > previous) ascent += heightM - previous;
      else descent += previous - heightM;
    }
    previous = heightM;
  });
  const any = covered > 0;
  return {
    samples,
    totalM: along,
    ascentM: any ? ascent : null,
    descentM: any ? descent : null,
    lowestM: any ? lowest : null,
    highestM: any ? highest : null,
    covered: path.length ? covered / path.length : 0,
    cellM: any ? coarsest : null,
  };
}

/** What a search for a way round steep ground found. */
export type WayRound = {
  /** The points to pass through between the two ends, in order. Empty when the straight line is clear. */
  via: LatLon[];
  /** The steepest ground under the way found, in degrees. */
  maxDeg: number;
  /** The length of the way found, in metres. */
  lengthM: number;
};

/** How much longer a metre over caution ground counts than a metre over clear ground. */
const CAUTION_COST = 6;

/**
 * A way from one point to another that stays off ground too steep to walk and prefers ground
 * under the caution slope: the shortest path over the cells of the slope grid (A*, eight
 * neighbours), then cut down to the few points where it has to turn.
 *
 * Null when either end is outside the grid, or when no way exists that avoids the no-go slope.
 * A cell without data is not walked over: unknown is not safe.
 *
 * The grid gives the mean slope of each cell, so the way is clear at the scale of the model
 * only; the interface says so.
 */
export function wayRound(
  from: LatLon,
  to: LatLon,
  grid: SlopeGrid,
  limits: SlopeLimits,
): WayRound | null {
  const { bounds, width, height, degrees } = grid;
  const size = cellSize(grid);
  const cellOf = (point: LatLon) => {
    if (
      point.lat > bounds.north ||
      point.lat < bounds.south ||
      point.lon < bounds.west ||
      point.lon > bounds.east
    ) {
      return null;
    }
    const col = Math.min(width - 1, Math.floor((point.lon - bounds.west) / size.lon));
    const row = Math.min(height - 1, Math.floor((bounds.north - point.lat) / size.lat));
    return row * width + col;
  };
  const centre = (cell: number): LatLon => ({
    lat: bounds.north - (Math.floor(cell / width) + 0.5) * size.lat,
    lon: bounds.west + ((cell % width) + 0.5) * size.lon,
  });
  const start = cellOf(from);
  const goal = cellOf(to);
  if (start === null || goal === null) return null;
  // The ends are where the crew chose to be; only the ground between them is searched.
  const walkable = (cell: number) =>
    cell === start ||
    cell === goal ||
    (Number.isFinite(degrees[cell]) && degrees[cell] < limits.noGoDeg);
  const weight = (cell: number) =>
    Number.isFinite(degrees[cell]) && degrees[cell] >= limits.cautionDeg ? CAUTION_COST : 1;

  const midLat = (bounds.north + bounds.south) / 2;
  const dx = size.lon * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180);
  const dy = size.lat * METRES_PER_DEGREE;
  const goalCol = goal % width;
  const goalRow = Math.floor(goal / width);
  const reach = (cell: number) =>
    Math.hypot(((cell % width) - goalCol) * dx, (Math.floor(cell / width) - goalRow) * dy);

  const cost = new Float64Array(width * height).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  // A binary heap of cells, ordered by the cost so far plus the straight distance left.
  const rank = new Float64Array(width * height);
  const heap: number[] = [];
  const push = (cell: number) => {
    let index = heap.push(cell) - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (rank[heap[parent]] <= rank[heap[index]]) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let least = index;
        if (left < heap.length && rank[heap[left]] < rank[heap[least]]) least = left;
        if (right < heap.length && rank[heap[right]] < rank[heap[least]]) least = right;
        if (least === index) break;
        [heap[least], heap[index]] = [heap[index], heap[least]];
        index = least;
      }
    }
    return top;
  };

  cost[start] = 0;
  rank[start] = reach(start);
  push(start);
  let found = false;
  while (heap.length > 0) {
    const cell = pop();
    if (closed[cell]) continue;
    closed[cell] = 1;
    if (cell === goal) {
      found = true;
      break;
    }
    const col = cell % width;
    const row = Math.floor(cell / width);
    for (let down = -1; down <= 1; down += 1) {
      for (let across = -1; across <= 1; across += 1) {
        if (down === 0 && across === 0) continue;
        const nextCol = col + across;
        const nextRow = row + down;
        if (nextCol < 0 || nextCol >= width || nextRow < 0 || nextRow >= height) continue;
        const next = nextRow * width + nextCol;
        if (closed[next] || !walkable(next)) continue;
        // A diagonal step must not squeeze between two cells that cannot be walked.
        if (down !== 0 && across !== 0) {
          if (!walkable(row * width + nextCol) || !walkable(nextRow * width + col)) continue;
        }
        const step = Math.hypot(across * dx, down * dy) * ((weight(cell) + weight(next)) / 2);
        const reached = cost[cell] + step;
        if (reached < cost[next]) {
          cost[next] = reached;
          cameFrom[next] = cell;
          rank[next] = reached + reach(next);
          push(next);
        }
      }
    }
  }
  if (!found) return null;

  const cells: number[] = [];
  for (let cell = goal; cell !== -1; cell = cameFrom[cell]) cells.push(cell);
  cells.reverse();
  // The ends are the real points; the cells between them are their centres.
  const line: LatLon[] = [from, ...cells.slice(1, -1).map(centre), to];

  // Keep only the points where the way has to turn: from each kept point, go straight to the
  // farthest later point the line reaches without getting steeper than the way found allows.
  const between = cells.slice(1, -1);
  const steepestFound = between.reduce(
    (steepest, cell) => (Number.isFinite(degrees[cell]) ? Math.max(steepest, degrees[cell]) : steepest),
    0,
  );
  const allowed = steepestFound >= limits.cautionDeg ? limits.noGoDeg : limits.cautionDeg;
  const kept: LatLon[] = [from];
  let index = 0;
  while (index < line.length - 1) {
    let next = index + 1;
    for (let far = line.length - 1; far > index + 1; far -= 1) {
      // The end cells are the crew's choice and may be steep: the line is judged between them.
      const steepest = steepestInside(grid, line[index], line[far], start, goal, cellOf);
      if (steepest !== null && steepest < allowed) {
        next = far;
        break;
      }
    }
    kept.push(line[next]);
    index = next;
  }

  let maxDeg = 0;
  let lengthM = 0;
  for (let at = 1; at < kept.length; at += 1) {
    lengthM += distance(kept[at - 1], kept[at]);
    maxDeg = Math.max(maxDeg, steepestInside(grid, kept[at - 1], kept[at], start, goal, cellOf) ?? 0);
  }
  return { via: kept.slice(1, -1), maxDeg, lengthM };
}

/**
 * The steepest slope under the straight line between two points, leaving out the two cells the
 * way starts and ends in. Null where a point of the line has no data.
 */
function steepestInside(
  grid: SlopeGrid,
  from: LatLon,
  to: LatLon,
  start: number,
  goal: number,
  cellOf: (point: LatLon) => number | null,
): number | null {
  let steepest = 0;
  for (const point of samplePath([from, to], grid.cellM / 2)) {
    const cell = cellOf(point);
    if (cell === start || cell === goal) continue;
    const value = slopeAt(grid, point);
    if (value === null) return null;
    steepest = Math.max(steepest, value);
  }
  return steepest;
}
