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
  /** The pointer is over a site on the globe (its marker or its label), or over none. */
  onHover?: (site: Site | null) => void;
  /** The globe has raised its surface with the grid of heights. Until then it is a smooth sphere. */
  onRelief?: () => void;
  ref?: Ref<GlobeHandle>;
};
