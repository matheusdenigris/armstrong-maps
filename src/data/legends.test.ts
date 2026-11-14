import { describe, expect, it } from 'vitest';

import { GLOBAL_LAYERS, VIKING_GLOBAL } from './layers';

describe('layer legends', () => {
  it('gives every coloured overlay a key, and the optical base none', () => {
    for (const layer of GLOBAL_LAYERS) {
      if (layer === VIKING_GLOBAL) expect(layer.legend).toBeUndefined();
      else expect(layer.legend, layer.id).toBeDefined();
    }
  });

  it('gives each key a ramp of real colours and a source', () => {
    for (const layer of GLOBAL_LAYERS) {
      if (!layer.legend) continue;
      expect(layer.legend.colors.length).toBeGreaterThanOrEqual(2);
      for (const color of layer.legend.colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(layer.legend.source.length).toBeGreaterThan(10);
    }
  });
});
