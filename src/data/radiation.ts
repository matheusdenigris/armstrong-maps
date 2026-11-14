/**
 * Radiation on the surface of Mars, as measured by the RAD instrument of the Curiosity rover in
 * Gale crater.
 *
 * RAD has no public feed, so this is the published figure, not a live reading:
 * Hassler et al., "Mars' Surface Radiation Environment Measured with the Mars Science
 * Laboratory's Curiosity Rover", Science 343, 1244797 (2014).
 */
export const SURFACE_RADIATION = {
  /** Dose equivalent from galactic cosmic rays on the surface, in millisieverts per Earth day. */
  msvPerDay: 0.64,
  uncertaintyMsvPerDay: 0.12,
  source: 'MSL RAD, Hassler et al. 2014 (Science 343)',
  caveat:
    'An average over about 300 sols at Gale crater. A solar particle event raises it for hours or days.',
} as const;
