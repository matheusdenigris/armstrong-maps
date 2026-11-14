import { describe, expect, it } from 'vitest';

import { duneQueryUrl, meanDirection, parseDunes } from './dunes';
import { findSite } from './sites';
import { elevationUrl, parseElevation, terrainAreas } from './terrain';
import { earthEquivalentMs, insightWeatherUrl, parseInsightWind } from './wind';

describe('terrain areas', () => {
  it('uses the sharpest model near the base and the global blend around it', () => {
    const [near, around] = terrainAreas(findSite('gale')!);
    expect(near.model.service).toBe('Gale_DEM_SMG_1m');
    expect(around.model.service).toBe('Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw');
    expect(near.bounds.north - near.bounds.south).toBeCloseTo(0.2, 6);
  });

  it('keeps the near area inside the coverage of its model', () => {
    const [near] = terrainAreas(findSite('gusev')!);
    expect(near.model.service).toBe('DEM_1m_ColumbiaHills');
    expect(near.bounds.west).toBeGreaterThanOrEqual(175.444);
    expect(near.bounds.east).toBeLessThanOrEqual(175.561);
  });

  it('falls back to the global blend where no sharper model is served', () => {
    const [near] = terrainAreas(findSite('jezero')!);
    expect(near.model.resolutionM).toBe(200);
  });

  it('asks for raw heights of the right size', () => {
    const [near] = terrainAreas(findSite('gale')!);
    const url = elevationUrl(near);
    expect(url).toContain('/Gale_DEM_SMG_1m/ImageServer/exportImage?');
    expect(url).toContain(`size=${near.width},${near.height}`);
    expect(url).toContain('format=bsq');
    expect(url).toContain('pixelType=F32');
  });

  it('reads little-endian heights and turns no-data into gaps', () => {
    const [near] = terrainAreas(findSite('gale')!);
    const area = { ...near, width: 2, height: 1 };
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);
    view.setFloat32(0, -4500.5, true);
    view.setFloat32(4, -3.4028230607370965e38, true);
    const grid = parseElevation(buffer, area);
    expect(grid.heights[0]).toBeCloseTo(-4500.5, 3);
    expect(Number.isNaN(grid.heights[1])).toBe(true);
  });

  it('reads 16-bit heights for the global blend', () => {
    const [, around] = terrainAreas(findSite('gale')!);
    const area = { ...around, width: 1, height: 1 };
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt16(0, -4120, true);
    expect(parseElevation(buffer, area).heights[0]).toBe(-4120);
  });

  it('refuses a short answer', () => {
    const [near] = terrainAreas(findSite('gale')!);
    expect(() => parseElevation(new ArrayBuffer(8), near)).toThrow();
  });
});

describe('dune fields', () => {
  it('asks for the fields in an area', () => {
    const url = duneQueryUrl({ west: 135, south: -6, east: 139, north: -3 });
    expect(url).toContain('/Dune_Field/MapServer/0/query?');
    expect(url).toContain('geometry=135,-6,139,-3');
  });

  it('averages directions as vectors', () => {
    expect(meanDirection([{ azimuthDeg: 350, count: 1 }, { azimuthDeg: 10, count: 1 }])).toBeCloseTo(0, 6);
    expect(meanDirection([{ azimuthDeg: 90, count: 3 }, { azimuthDeg: 180, count: 0 }])).toBeCloseTo(90, 6);
    expect(meanDirection([{ azimuthDeg: 0, count: 0 }])).toBeNull();
  });

  it('reads outlines and the slip-face direction', () => {
    const fields = parseDunes({
      features: [
        {
          attributes: { Dune_ID: '1370-050', SF_1_Az: 132.5, SF_1_Count: 105, SF_2_Azimu: 352.5, SF_2_Count: 67, SF_3_Azimu: 0, SF_3_Count: 0, SF_4_Azimu: 0, SF_4_Count: 0 },
          geometry: { rings: [[[136.9, -4.9], [137.0, -4.9], [137.0, -5.0], [136.9, -4.9]]] },
        },
        { attributes: { Dune_ID: 'empty' }, geometry: { rings: [[[1, 1]]] } },
      ],
    });
    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe('1370-050');
    expect(fields[0].outlines[0][0]).toEqual({ lat: -4.9, lon: 136.9 });
    expect(fields[0].slipFaces).toBe(172);
    expect(fields[0].downwindDeg).not.toBeNull();
  });
});

describe('InSight wind', () => {
  it('asks api.nasa.gov with a key', () => {
    expect(insightWeatherUrl('TEST')).toBe(
      'https://api.nasa.gov/insight_weather/?api_key=TEST&feedtype=json&ver=1.0',
    );
  });

  it('reads the sols with a wind speed, newest first', () => {
    const sols = parseInsightWind({
      sol_keys: ['675', '676', '677'],
      '675': {
        HWS: { av: 7.233, mn: 1.051, mx: 22.455 },
        WD: { most_common: { compass_degrees: 292.5, compass_point: 'WNW' } },
        First_UTC: '2020-10-19T18:32:20Z',
        Season: 'fall',
      },
      '676': { HWS: { av: 6.1, mn: 0.9, mx: 19.2 }, WD: { most_common: null } },
      '677': { AT: { av: -60 } },
    });
    expect(sols.map((sol) => sol.sol)).toEqual([676, 675]);
    expect(sols[1]).toMatchObject({ meanMs: 7.233, maxMs: 22.455, fromDeg: 292.5, fromPoint: 'WNW', firstDate: '2020-10-19' });
    expect(sols[0].fromDeg).toBeNull();
  });

  it('compares the push of the wind on Mars and on the Earth', () => {
    // sqrt(0.016 / 1.217) is about 0.115.
    expect(earthEquivalentMs(20)).toBeCloseTo(2.29, 2);
  });
});
