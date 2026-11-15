import { describe, expect, it } from 'vitest';

import { Colors } from '@/constants/colors';

import {
  READABLE_CONTRAST,
  contrastOnPlate,
  contrastRatio,
  luminance,
  over,
  parseColor,
} from './contrast';

describe('parseColor', () => {
  it('reads the notations the theme uses', () => {
    expect(parseColor('#04060A')).toEqual({ r: 4, g: 6, b: 10, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgba(238, 242, 247, 0.62)')).toEqual({ r: 238, g: 242, b: 247, a: 0.62 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });

  it('refuses what it cannot read', () => {
    expect(() => parseColor('tomato')).toThrow();
  });
});

describe('contrast', () => {
  const white = parseColor('#ffffff');
  const black = parseColor('#000000');

  it('runs from 1 to 21', () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 6);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 6);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 6);
  });

  it('measures luminance as the guidelines do', () => {
    expect(luminance(white)).toBeCloseTo(1, 6);
    expect(luminance(black)).toBe(0);
    // Mid grey is far darker than half: the scale is not linear.
    expect(luminance(parseColor('#808080'))).toBeCloseTo(0.2159, 3);
  });

  it('lays a see-through colour over an opaque one', () => {
    expect(over({ r: 0, g: 0, b: 0, a: 0.5 }, white)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });
});

/**
 * Every text of the visor, on the plate it is written on, over the brightest thing a photograph
 * can put behind it. White is brighter than any sky in the catalogue, so a text that passes here
 * passes over every photograph, on every screen width: the plates do not change with the width.
 */
describe('the visor is readable over the brightest photograph', () => {
  const BRIGHTEST = '#ffffff';
  const plates = {
    'the plate of the display': Colors.visorPlate,
    'the alert and the sources panel': Colors.glassStrong,
    'the rim of the helmet': Colors.visorRim,
  };
  const texts = {
    'the main text': Colors.text,
    'the secondary text': Colors.textSoft,
  };

  for (const [plateName, plate] of Object.entries(plates)) {
    for (const [textName, text] of Object.entries(texts)) {
      it(`${textName} on ${plateName}`, () => {
        expect(contrastOnPlate(text, plate, BRIGHTEST)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
      });
    }
  }

  it('the colours of the safety levels on the rim, where life support is written', () => {
    for (const level of [Colors.go, Colors.caution, Colors.noGo]) {
      expect(contrastOnPlate(level, Colors.visorRim, BRIGHTEST)).toBeGreaterThanOrEqual(READABLE_CONTRAST);
    }
  });

  it('would not pass on the lighter glass the display used before', () => {
    // Why the plate is its own colour: half-dark glass over a white sky leaves the secondary
    // text under the mark.
    expect(contrastOnPlate(Colors.textSoft, Colors.glassDark, BRIGHTEST)).toBeLessThan(READABLE_CONTRAST);
  });
});
