/**
 * Map layers served by NASA's Mars Trek (trek.nasa.gov, NASA/JPL).
 *
 * Every id, image format, deepest level and coverage below was read from the product's
 * `WMTSCapabilities.xml` on 2026-11-14:
 *
 *   https://trek.nasa.gov/tiles/Mars/EQ/<id>/1.0.0/WMTSCapabilities.xml
 *
 * Check a new product the same way before adding it here.
 */
import { WHOLE_PLANET, type Bounds, type TileAddress } from '@/mission/tiles';

export type LayerKind = 'optical' | 'topographic' | 'thermal' | 'spectral';

export type MapLayer = {
  /** Product id on Mars Trek. */
  id: string;
  name: string;
  kind: LayerKind;
  /** Spacecraft and instrument that took the data. */
  source: string;
  format: 'jpg' | 'png';
  /** Deepest tile level the product has. */
  maxLevel: number;
  coverage: Bounds;
  /** What a crew member reads from this layer. */
  reads: string;
};

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';

export function tileUrl(layer: MapLayer, { level, row, col }: TileAddress): string {
  return `${TREK}/${layer.id}/1.0.0/default/default028mm/${level}/${row}/${col}.${layer.format}`;
}

/** The colour mosaic of the whole planet: the base of every map and the texture of the globe. */
export const VIKING_GLOBAL: MapLayer = {
  id: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
  name: 'Colour mosaic',
  kind: 'optical',
  source: 'Viking Orbiter, MDIM 2.1',
  format: 'jpg',
  maxLevel: 7,
  coverage: WHOLE_PLANET,
  reads: 'What the surface looks like, at 232 m per pixel.',
};

/** Layers that cover the whole planet (or, for THEMIS, the band between 65 S and 65 N). */
export const GLOBAL_LAYERS: readonly MapLayer[] = [
  VIKING_GLOBAL,
  {
    id: 'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw',
    name: 'Colour relief',
    kind: 'topographic',
    source: 'MGS MOLA and Mars Express HRSC',
    format: 'jpg',
    maxLevel: 8,
    coverage: WHOLE_PLANET,
    reads: 'Elevation and the shape of the terrain, at 200 m per pixel. Blue is low, red and white are high.',
  },
  {
    id: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
    name: 'Daytime infrared',
    kind: 'thermal',
    source: 'Mars Odyssey THEMIS',
    format: 'png',
    maxLevel: 9,
    coverage: { west: -180, south: -65, east: 180, north: 65 },
    reads: 'Ground temperature by day, at 100 m per pixel. Slopes that face the Sun look bright.',
  },
  {
    id: 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018',
    name: 'Nighttime infrared',
    kind: 'thermal',
    source: 'Mars Odyssey THEMIS',
    format: 'png',
    maxLevel: 9,
    coverage: { west: -180, south: -65, east: 180, north: 65 },
    reads: 'Ground that holds heat at night. Exposed rock looks bright; dust and loose sand look dark.',
  },
  {
    id: 'TES_Thermal_Inertia',
    name: 'Thermal inertia',
    kind: 'thermal',
    source: 'MGS TES',
    format: 'png',
    maxLevel: 1,
    coverage: WHOLE_PLANET,
    reads: 'Firm ground (high inertia) against loose dust (low). A regional view only.',
  },
  {
    id: 'TES_Dust',
    name: 'Dust cover',
    kind: 'spectral',
    source: 'MGS TES',
    format: 'png',
    maxLevel: 1,
    coverage: WHOLE_PLANET,
    reads: 'Where dust hides the rock. A regional view only.',
  },
  {
    id: 'TES_Glass_Clay',
    name: 'Glass and clay',
    kind: 'spectral',
    source: 'MGS TES',
    format: 'png',
    maxLevel: 1,
    coverage: WHOLE_PLANET,
    reads: 'Minerals altered by water, a science target. A regional view only.',
  },
];

/** A regional mosaic from the Context Camera, about 6 m per pixel. */
export function ctxMosaic(id: string, coverage: Bounds, maxLevel = 12): MapLayer {
  return {
    id,
    name: 'Regional mosaic',
    kind: 'optical',
    source: 'Mars Reconnaissance Orbiter CTX',
    format: 'png',
    maxLevel,
    coverage,
    reads: 'The surroundings of the site, at about 6 m per pixel.',
  };
}

/** A mosaic from HiRISE around a landing point, about 25 cm per pixel. */
export function hiriseMosaic(id: string, coverage: Bounds, maxLevel: number): MapLayer {
  return {
    id,
    name: 'High-resolution mosaic',
    kind: 'optical',
    source: 'Mars Reconnaissance Orbiter HiRISE',
    format: 'png',
    maxLevel,
    coverage,
    reads: 'Individual rocks and dunes, at about 25 cm per pixel.',
  };
}
