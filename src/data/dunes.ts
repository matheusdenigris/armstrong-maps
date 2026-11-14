/**
 * Dune fields: loose sand a crew should stay out of (Spirit was trapped in soft sand at Gusev in
 * 2009, and Curiosity crossed the Bagnold dunes at Gale with care). They are also a record of the
 * wind: a dune's slip face, its steep lee side, faces downwind.
 *
 * Source: the Mars Global Digital Dune Database (Hayward et al. 2007, USGS Open-File Report
 * 2007-1158), served by NASA/JPL Mars Trek. It maps dune fields between 65 S and 65 N; its
 * slip-face directions "represent the prevailing wind direction at the last time of significant
 * dune modification".
 */
import type { LatLon } from '@/mission/geo';
import type { Polygon } from '@/mission/terrain';
import type { Bounds } from '@/mission/tiles';

const DUNE_LAYER = 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Dune_Field/MapServer/0';

export const DUNE_CREDIT = 'Mars Global Digital Dune Database, Hayward et al. 2007 (USGS), via NASA/JPL Mars Trek';

/** The dune fields that touch an area, outlines simplified to about 100 m. */
export function duneQueryUrl(area: Bounds): string {
  const query = [
    'where=1%3D1',
    `geometry=${area.west},${area.south},${area.east},${area.north}`,
    'geometryType=esriGeometryEnvelope',
    'inSR=104905',
    'outSR=104905',
    'spatialRel=esriSpatialRelIntersects',
    'outFields=Dune_ID,Dune_Type,MDHeight,SF_1_Az,SF_1_Count,SF_2_Azimu,SF_2_Count,SF_3_Azimu,SF_3_Count,SF_4_Azimu,SF_4_Count',
    'returnGeometry=true',
    'maxAllowableOffset=0.002',
    'f=json',
  ].join('&');
  return `${DUNE_LAYER}/query?${query}`;
}

export type DuneField = {
  id: string;
  /** The outer outline of each part of the field. */
  outlines: Polygon[];
  /** The middle of its largest outline, for a label or an arrow. */
  centre: LatLon;
  /**
   * The direction the slip faces face, in degrees from north: where the wind that shaped the
   * dunes blew towards. Null when the database has no slip-face measurement for the field.
   */
  downwindDeg: number | null;
  /** How many slip faces were measured. */
  slipFaces: number;
};

type Entry = Record<string, unknown>;
const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * The mean direction of the slip faces, weighted by how many were measured in each group. Angles
 * are averaged as vectors, so 350 and 10 degrees give 0, not 180.
 */
export function meanDirection(groups: readonly { azimuthDeg: number; count: number }[]): number | null {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const { azimuthDeg, count } of groups) {
    if (count <= 0) continue;
    const rad = (azimuthDeg * Math.PI) / 180;
    x += Math.sin(rad) * count;
    y += Math.cos(rad) * count;
    total += count;
  }
  if (total === 0 || Math.hypot(x, y) < 1e-9) return null;
  return (((Math.atan2(x, y) * 180) / Math.PI) + 360) % 360;
}

function centreOf(outline: Polygon): LatLon {
  let lat = 0;
  let lon = 0;
  for (const point of outline) {
    lat += point.lat;
    lon += point.lon;
  }
  return { lat: lat / outline.length, lon: lon / outline.length };
}

export function parseDunes(raw: unknown): DuneField[] {
  const features = (raw as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const fields: DuneField[] = [];
  for (const feature of features as Entry[]) {
    const attributes = (feature?.attributes ?? {}) as Entry;
    const rings = ((feature?.geometry as Entry | undefined)?.rings ?? []) as unknown[];
    const outlines = rings
      .filter(Array.isArray)
      .map((ring) =>
        (ring as unknown[])
          .map((pair) => (Array.isArray(pair) ? { lon: num(pair[0]), lat: num(pair[1]) } : null))
          .filter((point): point is LatLon => point !== null && point.lat !== null && point.lon !== null),
      )
      .filter((outline) => outline.length >= 3);
    if (outlines.length === 0) continue;

    const groups = [
      ['SF_1_Az', 'SF_1_Count'],
      ['SF_2_Azimu', 'SF_2_Count'],
      ['SF_3_Azimu', 'SF_3_Count'],
      ['SF_4_Azimu', 'SF_4_Count'],
    ].map(([azimuth, count]) => ({
      azimuthDeg: num(attributes[azimuth]) ?? 0,
      count: num(attributes[count]) ?? 0,
    }));
    const largest = outlines.reduce((a, b) => (b.length > a.length ? b : a));
    fields.push({
      id: String(attributes.Dune_ID ?? fields.length),
      outlines,
      centre: centreOf(largest),
      downwindDeg: meanDirection(groups),
      slipFaces: groups.reduce((sum, group) => sum + Math.max(0, group.count), 0),
    });
  }
  return fields;
}
