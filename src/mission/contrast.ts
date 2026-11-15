/**
 * How readable a text is over what is behind it, as the Web Content Accessibility Guidelines
 * measure it: the contrast ratio of two colours, from 1 (the same) to 21 (black on white).
 *
 * The visor writes over photographs, so "what is behind" is a stack: the photograph, a dark
 * plate over it, and the text, which may itself let some of the plate through. These helpers
 * flatten the stack and give the ratio.
 */

export type Rgba = { r: number; g: number; b: number; a: number };

/** Reads `#rgb`, `#rrggbb`, `rgb(r, g, b)` and `rgba(r, g, b, a)`. */
export function parseColor(color: string): Rgba {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => Number(part.trim()));
    if ((parts.length === 3 || parts.length === 4) && parts.every((part) => Number.isFinite(part))) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    }
  }
  throw new Error(`Not a colour this module reads: ${color}`);
}

/** A colour laid over an opaque one. The result is opaque. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (above: number, below: number) => above * top.a + below * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** Relative luminance of an opaque colour, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const share = channel / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The contrast ratio of two opaque colours. */
export function contrastRatio(one: Rgba, other: Rgba): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The contrast of a text on a plate that lies over something else. `behind` is what the plate
 * covers: for the visor, the brightest thing a photograph can show.
 */
export function contrastOnPlate(text: string, plate: string, behind: string): number {
  const ground = over(parseColor(plate), parseColor(behind));
  return contrastRatio(over(parseColor(text), ground), ground);
}

/** What the guidelines ask of text of ordinary size (level AA). */
export const READABLE_CONTRAST = 4.5;
