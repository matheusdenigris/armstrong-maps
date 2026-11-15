import { describe, expect, it } from 'vitest';

import { WHOLE_PLANET, contains, intersect, type Bounds } from '@/mission/tiles';

import { GLOBAL_LAYERS, VIKING_GLOBAL, probeUrl, tileUrl, type MapLayer } from './layers';
import { SITES, findSite } from './sites';

const siteLayers = SITES.flatMap((site) => site.layers);
const allLayers: MapLayer[] = [...GLOBAL_LAYERS, ...siteLayers];

const isValid = (b: Bounds) =>
  b.west < b.east && b.south < b.north && b.west >= -180 && b.east <= 180 && b.south >= -90 && b.north <= 90;

describe('layers', () => {
  it('have unique product ids', () => {
    const ids = allLayers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allLayers.map((layer) => [layer.id, layer] as const))('%s is complete', (_id, layer) => {
    expect(layer.name).not.toBe('');
    expect(layer.source).not.toBe('');
    expect(layer.reads).not.toBe('');
    expect(['jpg', 'png']).toContain(layer.format);
    expect(Number.isInteger(layer.maxLevel)).toBe(true);
    expect(layer.maxLevel).toBeGreaterThanOrEqual(0);
    expect(layer.maxLevel).toBeLessThanOrEqual(17);
    expect(isValid(layer.coverage)).toBe(true);
  });

  it('keep the planet-wide base first', () => {
    expect(GLOBAL_LAYERS[0]).toBe(VIKING_GLOBAL);
    expect(VIKING_GLOBAL.coverage).toEqual(WHOLE_PLANET);
  });

  it('build the tile address Mars Trek expects', () => {
    expect(tileUrl(VIKING_GLOBAL, { level: 3, row: 2, col: 5 })).toBe(
      'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/3/2/5.jpg',
    );
  });
});

describe('sites', () => {
  it('have unique ids that work in a link', () => {
    const ids = SITES.map((site) => site.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  it.each(SITES.map((site) => [site.id, site] as const))('%s is consistent', (_id, site) => {
    expect(isValid(site.region)).toBe(true);
    expect(contains(site.region, site.landing)).toBe(true);
    expect(site.layers.length).toBeGreaterThan(0);
    for (const layer of site.layers) {
      expect(layer.kind).toBe('optical');
      // A site layer has to show something of the site.
      expect(intersect(layer.coverage, site.region)).not.toBeNull();
    }
    // Layers go from the widest to the sharpest.
    const levels = site.layers.map((layer) => layer.maxLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('are found by id', () => {
    expect(findSite('gale')?.name).toBe('Gale Crater');
    expect(findSite('olympus')).toBeUndefined();
  });

  it('name the two rovers with a published traverse', () => {
    expect(findSite('gale')?.rover).toBe('curiosity');
    expect(findSite('jezero')?.rover).toBe('perseverance');
  });
});

describe('probeUrl', () => {
  it('asks for the widest tile over the middle of the product, past any copy on the device', () => {
    const insight = findSite('elysium')!.layers.find((layer) => layer.id.startsWith('ESP_058005'))!;
    // 135.6 E is in the eastern half of the planet: the second of the two tiles of level 0.
    expect(probeUrl(insight, 42)).toBe(
      'https://trek.nasa.gov/tiles/Mars/EQ/ESP_058005_1845_RED_spline_rect/1.0.0/default/default028mm/0/0/1.png?probe=42',
    );
    // Meridiani is west of the prime meridian: the first tile.
    const meridiani = findSite('meridiani')!.layers[0];
    expect(probeUrl(meridiani, 7)).toContain('/0/0/0.png?probe=7');
  });
});
