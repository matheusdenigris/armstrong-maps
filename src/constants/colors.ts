/**
 * The colours of the app. They are plain values in a file of their own, with no platform code,
 * so that a test can read them: the contrast check of the visor does.
 */
export const Colors = {
  /** Screen background: deep space. */
  background: '#04060A',
  /** Panels and sheets that sit on the background. */
  surface: '#090D14',
  /** Raised or pressed surface. */
  surfaceRaised: '#0F141D',
  /** Hairlines between panels. */
  border: '#1B2433',
  /** Stronger technical rules and button outlines. */
  borderStrong: '#2C394D',
  text: '#EEF2F7',
  textMuted: '#8794A6',
  /** Mars: the planet and the brand. */
  mars: '#FC3D21',
  /** The light of the planet behind the documentation, just off the top of the screen. */
  marsGlow: 'rgba(252, 61, 33, 0.1)',
  /** The mark of a NASA source in the documentation. A colour only, never the NASA insignia. */
  nasa: '#FC3D21',
  /** The fill behind the icon of a NASA source. */
  nasaTint: 'rgba(252, 61, 33, 0.14)',
  /** Navigation: routes, coverage areas, links. */
  nav: '#2F6BFF',
  /** Deeper navigation blue for map labels and overlays. */
  navDeep: '#0B3D91',
  /** Live-data, focus, and route telemetry accent. */
  cyan: '#5EEAD4',
  /** Walk status. */
  go: '#4ADE80',
  caution: '#FBBF24',
  noGo: '#F87171',
  /** Source-specific map-layer accents. */
  topographic: '#F59E0B',
  thermal: '#FB7185',
  spectral: '#A78BFA',
  /** Uncovered map fallback behind imagery. */
  mapBackground: '#120B08',
  /** Translucent mission-control HUD surfaces. */
  glass: 'rgba(4, 6, 10, 0.82)',
  glassStrong: 'rgba(4, 6, 10, 0.92)',
  /** Selected settings and layer card fill. */
  selectedSurface: '#121A27',
  /** Low-emphasis divider and spotlight overlays. */
  overlay: 'rgba(255, 255, 255, 0.08)',
  /** Glass over the globe: a faint fill, its edge, and the fill under the pointer. */
  glassLight: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassHover: 'rgba(255, 255, 255, 0.12)',
  /** Dark glass behind a label that sits on the planet. */
  glassDark: 'rgba(4, 6, 10, 0.5)',
  /**
   * The plate behind every text of the visor, and the rim of the helmet. The plate is dark
   * enough for the secondary text to pass a contrast of 4.5 over a white sky, which the
   * lighter glass does not (`src/mission/contrast.test.ts`).
   */
  visorPlate: 'rgba(4, 6, 10, 0.82)',
  visorRim: 'rgba(4, 6, 10, 0.96)',
  /**
   * The astronaut's own suit in the visor, which is drawn: the cloth in the light, in the shade
   * and close to the body, its seams, the boots, the dust of Mars on them and the shade the
   * body casts.
   */
  suit: '#D8D2C8',
  suitShade: '#A9A298',
  suitDeep: '#5F5A54',
  suitSeam: '#3B3733',
  suitBoot: '#8C867D',
  suitDust: '#A8704E',
  suitShadow: '#140C08',
  /** A warning that is not an alarm. */
  cautionTint: 'rgba(251, 191, 36, 0.1)',
  /** Secondary and tertiary text, on the globe and in the panels. */
  textSoft: 'rgba(238, 242, 247, 0.62)',
  textFaint: 'rgba(238, 242, 247, 0.42)',
  /** A named white keeps controls free of ad-hoc colour literals. */
  white: '#FFFFFF',
  /** Dune fields on the map: loose sand. */
  duneFill: 'rgba(251, 191, 36, 0.18)',
  duneStroke: '#FBBF24',
  /** Wind arrows on the map and in the wind panel. */
  wind: '#8FD6FF',
  /** Soft fill behind an active item. */
  navTint: 'rgba(47, 107, 255, 0.14)',
} as const;
