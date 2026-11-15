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
import { WHOLE_PLANET, tileAt, type Bounds, type TileAddress } from '@/mission/tiles';

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
  /** The key to its colours, for layers whose colour stands for a quantity. */
  legend?: LayerLegend;
};

/**
 * What the colours of a layer mean. Mars Trek does not publish the calibration from colour to
 * value for these tiles, so numbers are given only where the science source publishes them.
 */
export type LayerLegend = {
  /** What the colour measures. */
  quantity: string;
  /** Its unit, or null when the scale is relative. */
  unit: string | null;
  /** The colour ramp from low to high, as read from the level-0 tiles. */
  colors: readonly string[];
  low: string;
  high: string;
  /** The span of values, only where the source publishes it. */
  range?: string;
  /** The science reference for the product. */
  source: string;
};

/**
 * Colour ramps read from the level-0 tiles of each product on 2026-11-14. The TES maps and the
 * MOLA relief run from violet and blue (low) to red; the relief ends in white on the highest
 * volcanoes. THEMIS is greyscale.
 */
const RAINBOW = ['#4b1fc4', '#2448f0', '#13b6e8', '#36d455', '#e8e23a', '#f08a1e', '#dc2518'];
const RELIEF = [...RAINBOW, '#f4f0ec'];
const GREY = ['#141414', '#f2f2f2'];

const THEMIS_SOURCE = 'Mars Odyssey THEMIS, Christensen et al. 2004, Space Science Reviews 110';

export const LEGENDS = {
  relief: {
    quantity: 'Elevation',
    unit: 'm',
    colors: RELIEF,
    low: 'Low: the floor of the Hellas basin',
    high: 'High: the Tharsis volcanoes',
    range:
      'Mars spans about 30 km of relief, from about -8 km in Hellas to +21 km on Olympus Mons, relative to the MOLA areoid.',
    source: 'Smith et al. 2001, JGR 106 (MOLA); Jaumann et al. 2007, Planetary and Space Science 55 (HRSC)',
  },
  themisDay: {
    quantity: 'Daytime surface temperature',
    unit: null,
    colors: GREY,
    low: 'Dark: cooler, shaded slopes',
    high: 'Bright: warmer, sunward slopes',
    source: THEMIS_SOURCE,
  },
  themisNight: {
    quantity: 'Nighttime surface temperature',
    unit: null,
    colors: GREY,
    low: 'Dark: dust and loose sand',
    high: 'Bright: rock that holds heat',
    source: THEMIS_SOURCE,
  },
  inertia: {
    quantity: 'Thermal inertia',
    unit: 'J m⁻² K⁻¹ s⁻½',
    colors: RAINBOW,
    low: 'Low: fine dust',
    high: 'High: rock and bedrock',
    source: 'MGS TES, Putzig et al. 2005, Icarus 173',
  },
  dust: {
    quantity: 'Dust cover',
    unit: null,
    colors: RAINBOW,
    low: 'Less dust',
    high: 'More dust',
    source: 'MGS TES dust cover index, Ruff and Christensen 2002, JGR 107',
  },
  glassClay: {
    quantity: 'Sheet silicates and high-silica glass',
    unit: null,
    colors: RAINBOW,
    low: 'Low concentration',
    high: 'High concentration',
    range: 'Share of the surface: 0 to 0.10 in bright regions, up to 0.20 in the dark northern plains.',
    source: 'MGS TES, Bandfield 2002, JGR 107',
  },
} satisfies Record<string, LayerLegend>;

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';

export function tileUrl(layer: MapLayer, { level, row, col }: TileAddress): string {
  return `${TREK}/${layer.id}/1.0.0/default/default028mm/${level}/${row}/${col}.${layer.format}`;
}

/**
 * A tile every product has: the one of the widest level over the middle of its coverage. The
 * stamp keeps a copy held by the device from answering in place of the service.
 */
export function probeUrl(layer: MapLayer, stamp: number): string {
  const { west, south, east, north } = layer.coverage;
  const middle = { lat: (south + north) / 2, lon: (west + east) / 2 };
  return `${tileUrl(layer, tileAt(0, middle))}?probe=${stamp}`;
}

/**
 * Whether Mars Trek answers for a product right now. A tile that keeps failing while this is
 * true is a hole in the product; while it is false, the service or the network is down.
 */
export async function tileServiceAnswers(layer: MapLayer): Promise<boolean> {
  try {
    const response = await fetch(probeUrl(layer, Date.now()), { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
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
    legend: LEGENDS.relief,
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
    legend: LEGENDS.themisDay,
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
    legend: LEGENDS.themisNight,
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
    legend: LEGENDS.inertia,
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
    legend: LEGENDS.dust,
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
    legend: LEGENDS.glassClay,
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
