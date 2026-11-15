/**
 * Elevation models of each site, read from the image services behind NASA's Mars Trek
 * (trek.nasa.gov/mars/trekarcgis, NASA/JPL). The app asks for a grid of heights over an area and
 * works out the slope itself (`src/mission/terrain.ts`).
 *
 * Two areas per site:
 *
 * - near the base, the sharpest model there is: 1 m HiRISE models at Gale and Gusev, the 20 m
 *   InSight mosaic at Elysium, and the 200 m global blend elsewhere;
 * - the surroundings, about 60 km across, from the global MOLA and HRSC blend at 200 m.
 *
 * Each service, its pixel size and its coverage were read from its description
 * (`<service>/ImageServer?f=json`) on 2026-11-14.
 *
 * The same services give the height of one point (`identify`), which is how the map reads the
 * ground where the person presses. The global blend covers every site, so a point always has
 * a model to ask; the vertical reference of each model was not checked, so a height is shown
 * as the model gives it and compared only with the base in the same model.
 */
import type { LatLon } from '@/mission/geo';
import { contains, intersect, type Bounds } from '@/mission/tiles';
import type { ElevationGrid } from '@/mission/terrain';

import type { Site } from './sites';

const SERVICES = 'https://trek.nasa.gov/mars/trekarcgis/rest/services';

export type ElevationModel = {
  /** Image service name on Mars Trek. */
  service: string;
  name: string;
  /** Instruments and team behind it. */
  source: string;
  /** Native pixel size in metres. */
  resolutionM: number;
  coverage: Bounds;
  /** How the heights come over the wire. */
  pixelType: 'F32' | 'S16';
};

const GLOBAL_BLEND: ElevationModel = {
  service: 'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw',
  name: 'MOLA and HRSC blended elevation',
  source: 'MGS MOLA and Mars Express HRSC (NASA, ESA, DLR, FU Berlin), Fergason et al. 2018',
  resolutionM: 200,
  coverage: { west: -180, south: -90, east: 180, north: 90 },
  pixelType: 'S16',
};

/** The sharpest model at each site, where one is served. */
const LOCAL: Record<string, ElevationModel> = {
  gale: {
    service: 'Gale_DEM_SMG_1m',
    name: 'HiRISE elevation model of the Curiosity landing area',
    source: 'MRO HiRISE stereo, NASA/JPL/University of Arizona',
    resolutionM: 1,
    coverage: { west: 137.1224, south: -4.9254, east: 137.7298, north: -4.249 },
    pixelType: 'F32',
  },
  gusev: {
    service: 'DEM_1m_ColumbiaHills',
    name: 'HiRISE elevation model of the Columbia Hills',
    source: 'MRO HiRISE stereo, NASA/JPL/University of Arizona',
    resolutionM: 1,
    coverage: { west: 175.444, south: -14.682, east: 175.561, north: -14.495 },
    pixelType: 'F32',
  },
  elysium: {
    service: 'InSight_HiRISE_CTX_HRSC_dem_mosaic_50pix_sigma5_exp3_gcs',
    name: 'InSight landing area elevation mosaic',
    source: 'MRO HiRISE and CTX, Mars Express HRSC, for the InSight mission (NASA/JPL)',
    resolutionM: 20,
    coverage: { west: 133.9356, south: 3.7286, east: 137.2759, north: 5.0697 },
    pixelType: 'F32',
  },
};

/** Half the side of each area, in degrees of latitude. */
const NEAR_HALF_DEG = 0.1;
const AROUND_HALF_DEG = 0.5;

/** Pixels across each grid: about 60 m cells near the base, 200 m around it. */
const NEAR_PIXELS = 200;
const AROUND_PIXELS = 300;

export type TerrainArea = {
  id: 'near' | 'around';
  model: ElevationModel;
  bounds: Bounds;
  width: number;
  height: number;
};

/** A square on the ground around a point, widened in longitude away from the equator. */
function around(site: Site, halfDeg: number): Bounds {
  const { lat, lon } = site.landing;
  const halfLon = halfDeg / Math.cos((lat * Math.PI) / 180);
  return { west: lon - halfLon, east: lon + halfLon, south: lat - halfDeg, north: lat + halfDeg };
}

/** The two areas of a site, the one near the base first. */
export function terrainAreas(site: Site): TerrainArea[] {
  const local = LOCAL[site.id] ?? GLOBAL_BLEND;
  const near = intersect(around(site, NEAR_HALF_DEG), local.coverage) ?? around(site, NEAR_HALF_DEG);
  const aspect = (bounds: Bounds) =>
    ((bounds.east - bounds.west) * Math.cos((site.landing.lat * Math.PI) / 180)) /
    (bounds.north - bounds.south);
  const grid = (bounds: Bounds, pixels: number) => {
    const ratio = aspect(bounds);
    return ratio >= 1
      ? { width: pixels, height: Math.max(2, Math.round(pixels / ratio)) }
      : { width: Math.max(2, Math.round(pixels * ratio)), height: pixels };
  };
  const wide = around(site, AROUND_HALF_DEG);
  return [
    { id: 'near', model: local, bounds: near, ...grid(near, NEAR_PIXELS) },
    { id: 'around', model: GLOBAL_BLEND, bounds: wide, ...grid(wide, AROUND_PIXELS) },
  ];
}

/** The address of a grid of heights over an area, as raw little-endian numbers. */
export function elevationUrl(area: TerrainArea): string {
  const { west, south, east, north } = area.bounds;
  const query = [
    `bbox=${west},${south},${east},${north}`,
    'bboxSR=104905',
    'imageSR=104905',
    `size=${area.width},${area.height}`,
    'format=bsq',
    `pixelType=${area.model.pixelType}`,
    'interpolation=RSP_BilinearInterpolation',
    'f=image',
  ].join('&');
  return `${SERVICES}/${area.model.service}/ImageServer/exportImage?${query}`;
}

/** Heights below the deepest point or above the highest of Mars are gaps in the model. */
const LOWEST_M = -9000;
const HIGHEST_M = 22000;

/** Reads the raw grid. A height out of the range of Mars (the services' no-data value) is NaN. */
export function parseElevation(buffer: ArrayBuffer, area: TerrainArea): ElevationGrid {
  const count = area.width * area.height;
  const bytesPerValue = area.model.pixelType === 'F32' ? 4 : 2;
  if (buffer.byteLength < count * bytesPerValue) {
    throw new Error(`The elevation service sent ${buffer.byteLength} bytes for ${count} heights`);
  }
  const view = new DataView(buffer);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const value =
      bytesPerValue === 4 ? view.getFloat32(i * 4, true) : view.getInt16(i * 2, true);
    heights[i] = value >= LOWEST_M && value <= HIGHEST_M ? value : Number.NaN;
  }
  return { bounds: area.bounds, width: area.width, height: area.height, heights };
}

export const TERRAIN_CREDIT = 'Elevation models served by NASA/JPL Mars Trek';

/** The models that can have a height for a point of a site, the sharpest first. */
export function elevationModelsAt(site: Site, point: LatLon): ElevationModel[] {
  const local = LOCAL[site.id];
  return local && contains(local.coverage, point) ? [local, GLOBAL_BLEND] : [GLOBAL_BLEND];
}

/** The address that returns the height of a model at one point. */
export function heightUrl(model: ElevationModel, point: LatLon): string {
  const geometry = encodeURIComponent(JSON.stringify({ x: point.lon, y: point.lat }));
  const query = [
    `geometry=${geometry}`,
    'geometryType=esriGeometryPoint',
    'returnGeometry=false',
    'returnCatalogItems=false',
    'f=json',
  ].join('&');
  return `${SERVICES}/${model.service}/ImageServer/identify?${query}`;
}

/**
 * The height in an answer of the service, in metres, or null where the model has none ("NoData",
 * or a value out of the range of Mars). An answer that reports an error is thrown.
 */
export function parseHeight(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    throw new Error('The elevation service sent no answer to read');
  }
  if ('error' in body) throw new Error('The elevation service reported an error');
  const raw = (body as { value?: unknown }).value;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(value) && value >= LOWEST_M && value <= HIGHEST_M ? value : null;
}

/** The height one model has at a point, or null where it has none. Throws when it does not answer. */
export async function readHeight(model: ElevationModel, point: LatLon): Promise<number | null> {
  const response = await fetch(heightUrl(model, point));
  if (!response.ok) throw new Error(`The elevation service answered ${response.status}`);
  return parseHeight(await response.json());
}

export type HeightAnswer =
  | { status: 'ready'; metres: number; model: ElevationModel }
  /** Every model that covers the point answered, and none has a height there. */
  | { status: 'no-data' }
  /** A model did not answer, and none gave a height. */
  | { status: 'failed' };

/** The height of a point of a site, from the sharpest model that has one. */
export async function heightAt(site: Site, point: LatLon): Promise<HeightAnswer> {
  let failed = false;
  for (const model of elevationModelsAt(site, point)) {
    try {
      const metres = await readHeight(model, point);
      if (metres !== null) return { status: 'ready', metres, model };
    } catch {
      failed = true;
    }
  }
  return failed ? { status: 'failed' } : { status: 'no-data' };
}
