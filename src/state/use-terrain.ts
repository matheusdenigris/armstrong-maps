import { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { elevationUrl, parseElevation, terrainAreas, type TerrainArea } from '@/data/terrain';
import type { Site } from '@/data/sites';
import { encodeIndexedPng, pngDataUri, type PaletteColor } from '@/mission/png';
import {
  classifySlope,
  slopeGrid,
  type ElevationGrid,
  type SlopeGrid,
  type SlopeLimits,
} from '@/mission/terrain';
import { WALK_ASSUMPTIONS } from '@/mission/walk';

import type { Feed } from './use-feed';

/** The slope of one area of a site, and the picture that marks its dangerous ground. */
export type TerrainLayer = {
  area: TerrainArea;
  /** The heights the slopes were worked out from, kept for the profile of a route. */
  heights: ElevationGrid;
  slopes: SlopeGrid;
  /** A PNG over `area.bounds`: clear where the ground is walkable, coloured where it is not. */
  image: string;
  /** Share of the area at or past the caution slope, and at or past the no-go slope. */
  cautionShare: number;
  noGoShare: number;
  /** The steepest cell, in degrees. */
  steepestDeg: number;
};

const LIMITS: SlopeLimits = {
  cautionDeg: WALK_ASSUMPTIONS.cautionSlopeDeg,
  noGoDeg: WALK_ASSUMPTIONS.noGoSlopeDeg,
};

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

/** Clear, then the caution colour, then the no-go colour, each partly see-through. */
const PALETTE: PaletteColor[] = [
  [0, 0, 0, 0],
  [...hexToRgb(Colors.caution), 140],
  [...hexToRgb(Colors.noGo), 190],
];

function buildLayer(area: TerrainArea, buffer: ArrayBuffer): TerrainLayer {
  const heights = parseElevation(buffer, area);
  const slopes = slopeGrid(heights);
  const indices = new Uint8Array(slopes.degrees.length);
  let caution = 0;
  let noGo = 0;
  let measured = 0;
  let steepestDeg = 0;
  slopes.degrees.forEach((degrees, index) => {
    if (!Number.isFinite(degrees)) return;
    measured += 1;
    steepestDeg = Math.max(steepestDeg, degrees);
    const kind = classifySlope(degrees, LIMITS);
    if (kind === 'caution') {
      indices[index] = 1;
      caution += 1;
    } else if (kind === 'no-go') {
      indices[index] = 2;
      noGo += 1;
    }
  });
  const png = encodeIndexedPng(slopes.width, slopes.height, indices, PALETTE);
  return {
    area,
    heights,
    slopes,
    image: pngDataUri(png),
    cautionShare: measured ? (caution + noGo) / measured : 0,
    noGoShare: measured ? noGo / measured : 0,
    steepestDeg,
  };
}

/** One request per area for the life of the page. A failure is forgotten, so it can be retried. */
const layers = new Map<string, Promise<TerrainLayer>>();

function loadLayer(area: TerrainArea): Promise<TerrainLayer> {
  const url = elevationUrl(area);
  let pending = layers.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`The elevation service answered ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => buildLayer(area, buffer));
    pending.catch(() => layers.delete(url));
    layers.set(url, pending);
  }
  return pending;
}

type TerrainState = { siteId: string; near: Feed<TerrainLayer>; around: Feed<TerrainLayer> };

const LOADING = { status: 'loading' } as const;

/**
 * The slope of the ground near the base and around it. The near area is asked for first, since
 * the walk is checked against it; the wider one follows.
 */
export function useTerrain(site: Site): { near: Feed<TerrainLayer>; around: Feed<TerrainLayer> } {
  const [state, setState] = useState<TerrainState | null>(null);

  useEffect(() => {
    let current = true;
    const [nearArea, aroundArea] = terrainAreas(site);
    const update = (part: 'near' | 'around', feed: Feed<TerrainLayer>) => {
      if (!current) return;
      setState((previous) => ({
        siteId: site.id,
        near: previous?.siteId === site.id ? previous.near : LOADING,
        around: previous?.siteId === site.id ? previous.around : LOADING,
        [part]: feed,
      }));
    };
    const settle = (part: 'near' | 'around', area: TerrainArea) =>
      loadLayer(area).then(
        (data) => update(part, { status: 'ready', data }),
        () => update(part, { status: 'failed' }),
      );
    void settle('near', nearArea).then(() => settle('around', aroundArea));
    return () => {
      current = false;
    };
  }, [site]);

  if (state?.siteId !== site.id) return { near: LOADING, around: LOADING };
  return { near: state.near, around: state.around };
}
