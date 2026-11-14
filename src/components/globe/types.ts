import type { Ref } from 'react';

import type { Site } from '@/data/sites';

export type GlobeHandle = {
  /** Turns the globe to a site, moves in, then calls `onOpen`. */
  flyTo: (site: Site) => void;
};

export type MarsGlobeProps = {
  sites: readonly Site[];
  /** A site was chosen on the globe, or `flyTo` has arrived. */
  onOpen: (site: Site) => void;
  ref?: Ref<GlobeHandle>;
};
