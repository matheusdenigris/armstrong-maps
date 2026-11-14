/**
 * Design tokens. The visual language is mission control: a dark console, one warm accent for
 * Mars and one cool accent for navigation. The app is dark only, on every platform.
 */
import { Platform } from 'react-native';

export const Colors = {
  /** Screen background: deep space. */
  background: '#07090D',
  /** Panels and sheets that sit on the background. */
  surface: '#10141B',
  /** Raised or pressed surface. */
  surfaceRaised: '#19202A',
  /** Hairlines between panels. */
  border: '#242C38',
  text: '#F2F4F7',
  textMuted: '#9AA4B2',
  /** Mars: the planet and the brand. */
  mars: '#E2562F',
  /** Navigation: routes, coverage areas, links. */
  nav: '#4C8DFF',
  /** Walk status. */
  go: '#3DD68C',
  caution: '#F5B83D',
  noGo: '#F0513F',
  /** Marks a NASA source on the docs page. A colour only: never the NASA insignia. */
  nasa: '#FC3D21',
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

/** Sans for reading, mono for telemetry and labels. */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  web: {
    sans: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  default: { sans: 'normal', mono: 'monospace' },
})!;

/** Content never grows wider than this on tablets and desktop browsers. */
export const MaxContentWidth = 720;
