import { describe, expect, it } from 'vitest';

import { COVERAGE, COVERAGE_READ_ON } from './coverage';
import { SITES } from './sites';

describe('the areas with a regional mosaic', () => {
  it('were read from the catalogue on a known day', () => {
    expect(COVERAGE_READ_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(COVERAGE.length).toBeGreaterThan(50);
  });

  it('are parts of the planet, each with a real area', () => {
    for (const { id, bounds } of COVERAGE) {
      expect(bounds.south, id).toBeGreaterThanOrEqual(-90);
      expect(bounds.north, id).toBeLessThanOrEqual(90);
      expect(bounds.north, id).toBeGreaterThan(bounds.south);
      expect(bounds.west, id).toBeGreaterThanOrEqual(-180);
      expect(bounds.east, id).toBeLessThanOrEqual(180);
      const width = bounds.east >= bounds.west ? bounds.east - bounds.west : bounds.east + 360 - bounds.west;
      expect(width, id).toBeGreaterThan(0);
      expect(width, id).toBeLessThanOrEqual(90);
    }
  });

  it('have one entry a product', () => {
    expect(new Set(COVERAGE.map((area) => area.id)).size).toBe(COVERAGE.length);
  });

  it('include the mosaics of every landing site, where the app says they are', () => {
    for (const site of SITES) {
      for (const layer of site.layers) {
        const area = COVERAGE.find((entry) => entry.id === layer.id);
        expect(area, `${site.id}: ${layer.id}`).toBeDefined();
        if (!area) continue;
        expect(area.bounds.west).toBeCloseTo(layer.coverage.west, 2);
        expect(area.bounds.south).toBeCloseTo(layer.coverage.south, 2);
        expect(area.bounds.east).toBeCloseTo(layer.coverage.east, 2);
        expect(area.bounds.north).toBeCloseTo(layer.coverage.north, 2);
      }
    }
  });
});
