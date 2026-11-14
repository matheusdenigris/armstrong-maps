import type { MarsGlobeProps } from './globe/types';

export type { GlobeHandle } from './globe/types';

/**
 * The 3D globe runs on WebGL in the browser (`mars-globe.web.tsx`). The Android and iOS apps do
 * not draw it yet, so screens check this before giving it room and offer the list of sites.
 */
export const GLOBE_AVAILABLE = false;

export function MarsGlobe(_props: MarsGlobeProps) {
  return null;
}
