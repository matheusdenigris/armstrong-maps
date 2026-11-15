/**
 * Design tokens. The visual language is mission control: a dark console, one warm accent for
 * Mars and one cool accent for navigation. The app is dark only, on every platform.
 */
import { Platform } from 'react-native';

import { Colors } from './colors';

export { Colors } from './colors';

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
  /** Cards inside a panel, and the panels themselves. */
  card: 16,
  pane: 24,
  /** Fully rounded ends, whatever the height. */
  pill: 999,
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
