import { useCallback, useRef, useState } from 'react';

import type { Site } from '@/data/sites';
import { heightAt, readHeight, type HeightAnswer } from '@/data/terrain';
import type { LatLon } from '@/mission/geo';

/** What the elevation models say about one point of the map. */
export type GroundReading = {
  point: LatLon;
  height: HeightAnswer | { status: 'loading' };
  /**
   * The height of the base in the same model, to say how far up or down the point is. Null until
   * it is known, and when the model has no height at the base.
   */
  baseMetres: number | null;
};

/**
 * Reads the ground at a point on request. Only the latest request counts: an answer that comes
 * back after another point was asked for is dropped.
 */
export function useGroundReading(site: Site) {
  const [reading, setReading] = useState<GroundReading | null>(null);
  const asked = useRef(0);
  // The base is read once for each model: it does not move.
  const bases = useRef(new Map<string, number | null>());

  const read = useCallback(
    (point: LatLon) => {
      asked.current += 1;
      const request = asked.current;
      setReading({ point, height: { status: 'loading' }, baseMetres: null });
      void heightAt(site, point).then(async (height) => {
        if (asked.current !== request) return;
        setReading({ point, height, baseMetres: null });
        if (height.status !== 'ready') return;
        const key = `${site.id}:${height.model.service}`;
        let base = bases.current.get(key);
        if (base === undefined) {
          base = await readHeight(height.model, site.landing).catch(() => null);
          bases.current.set(key, base);
        }
        if (asked.current === request && base !== null) {
          setReading({ point, height, baseMetres: base });
        }
      });
    },
    [site],
  );

  const clear = useCallback(() => {
    asked.current += 1;
    setReading(null);
  }, []);

  return { reading, read, clear };
}
