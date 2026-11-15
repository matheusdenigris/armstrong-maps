import { describe, expect, it } from 'vitest';

import { TILE_RETRY_DELAYS_MS, retryDelay, tileVerdict } from './tile-health';

describe('retryDelay', () => {
  it('waits longer before each new try', () => {
    expect(retryDelay(1)).toBe(TILE_RETRY_DELAYS_MS[0]);
    expect(retryDelay(2)).toBe(TILE_RETRY_DELAYS_MS[1]);
    expect(retryDelay(2)!).toBeGreaterThan(retryDelay(1)!);
  });

  it('gives up once a tile has had every try', () => {
    expect(retryDelay(TILE_RETRY_DELAYS_MS.length + 1)).toBeNull();
  });

  it('has nothing to wait for before a first failure', () => {
    expect(retryDelay(0)).toBeNull();
    expect(retryDelay(-1)).toBeNull();
    expect(retryDelay(1.5)).toBeNull();
  });
});

describe('tileVerdict', () => {
  it('calls a lasting failure a hole in the product when the service still answers', () => {
    expect(tileVerdict(true)).toBe('no-coverage');
  });

  it('calls it a failure of the service when nothing answers', () => {
    expect(tileVerdict(false)).toBe('service-down');
  });
});
