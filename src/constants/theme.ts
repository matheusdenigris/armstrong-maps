/**
 * Design tokens. The visual language is mission control: a dark console, one warm accent for
 * Mars and one cool accent for navigation. The app is dark only, on every platform.
 */
import { Platform } from 'react-native';

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
  /** Source cards on the documentation screen. A colour only, never the NASA insignia. */
  nasa: '#FC3D21',
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
  /** A named white keeps controls free of ad-hoc colour literals. */
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof Colors;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 6,
  medium: 12,
  large: 20,
} as const;

/**
 * The three source type roles. The root layout loads matching font files under these family
 * names; platform fallbacks keep static HTML legible before hydration.
 */
export const Fonts = Platform.select({
  ios: { display: 'Michroma', sans: 'SpaceGrotesk', mono: 'JetBrainsMono' },
  web: {
    display: 'Michroma, Eurostile, system-ui, sans-serif',
    sans: 'SpaceGrotesk, ui-sans-serif, system-ui, sans-serif',
    mono: 'JetBrainsMono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  default: { display: 'Michroma', sans: 'SpaceGrotesk', mono: 'JetBrainsMono' },
})!;

/** Content never grows wider than this on tablets and desktop browsers. */
export const MaxContentWidth = 720;
