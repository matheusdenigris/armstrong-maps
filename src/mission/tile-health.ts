/**
 * What to do with a map tile that did not load.
 *
 * A tile fails for two reasons that look the same to the app. The product has no picture there:
 * its coverage is a rectangle on paper and an irregular footprint in fact, so a hole is expected.
 * Or the request itself failed: a phone between two cells, a service that is busy. The first
 * needs nothing; the second needs another try, and a word to the person if it lasts.
 */

/** The wait before each new try of a tile that failed, in milliseconds. One entry a retry. */
export const TILE_RETRY_DELAYS_MS: readonly number[] = [800, 2500];

/**
 * The wait before the next try of a tile that has now failed `failures` times, or null when it
 * has had all its tries.
 */
export function retryDelay(failures: number): number | null {
  if (!Number.isInteger(failures) || failures < 1) return null;
  return TILE_RETRY_DELAYS_MS[failures - 1] ?? null;
}

/** What a tile that kept failing turned out to be. */
export type TileVerdict = 'no-coverage' | 'service-down';

/**
 * A tile that fails every try is a hole in the product when the service still answers for
 * another tile of the same product, and a failure of the service when it does not.
 */
export const tileVerdict = (serviceAnswers: boolean): TileVerdict =>
  serviceAnswers ? 'no-coverage' : 'service-down';
