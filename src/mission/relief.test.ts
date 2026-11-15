/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  RELIEF_EXAGGERATION,
  RELIEF_HEIGHT,
  RELIEF_WIDTH,
  drawnRadius,
  heightAt,
  highestRadiusNear,
  parseGlobalRelief,
  reliefNormals,
  type GlobalRelief,
} from './relief';

/** A small planet of one height everywhere, with one cell changed. */
function flat(metres: number, width = 8, height = 4): GlobalRelief {
  return { width, height, metres: new Int16Array(width * height).fill(metres) };
}

describe('heightAt', () => {
  it('gives the height of a cell at its middle', () => {
    const relief = flat(100);
    relief.metres[1 * 8 + 4] = 900;
    // Row 1 of 4 is centred on 22.5 N; column 4 of 8 on 22.5 E.
    expect(heightAt(relief, { lat: 22.5, lon: 22.5 })).toBeCloseTo(900, 6);
  });

  it('blends between cells', () => {
    const relief = flat(0);
    relief.metres[1 * 8 + 4] = 1000;
    // Half a cell to the east of the middle of the raised cell.
    expect(heightAt(relief, { lat: 22.5, lon: 45 })).toBeCloseTo(500, 6);
  });

  it('wraps round the planet at 180 degrees', () => {
    const relief = flat(0);
    relief.metres[1 * 8 + 0] = 800;
    relief.metres[1 * 8 + 7] = 800;
    expect(heightAt(relief, { lat: 22.5, lon: 180 })).toBeCloseTo(800, 6);
    expect(heightAt(relief, { lat: 22.5, lon: -180 })).toBeCloseTo(800, 6);
  });

  it('holds at the poles', () => {
    expect(heightAt(flat(-250), { lat: 90, lon: 10 })).toBe(-250);
    expect(heightAt(flat(-250), { lat: -90, lon: 10 })).toBe(-250);
  });
});

describe('drawnRadius', () => {
  it('is a smooth sphere without a grid', () => {
    expect(drawnRadius(null, { lat: 0, lon: 0 })).toBe(1);
    expect(highestRadiusNear(null, { lat: 0, lon: 0 }, 3)).toBe(1);
  });

  it('is the real height over the real radius, times the exaggeration', () => {
    // The grid holds whole metres: 6779 m is two thousandths of the radius of Mars.
    const radius = drawnRadius(flat(6779), { lat: 0, lon: 0 }, 6);
    expect(radius).toBeCloseTo(1 + 0.002 * 6, 9);
  });

  it('finds the highest ground within reach, and not beyond it', () => {
    const relief = flat(0, 360, 180);
    // A peak two degrees east of the point.
    relief.metres[89 * 360 + 182] = 10_000;
    const here = { lat: 0.5, lon: 0.5 };
    expect(highestRadiusNear(relief, here, 3)).toBeGreaterThan(drawnRadius(relief, here) + 0.01);
    expect(highestRadiusNear(relief, here, 0.5)).toBeCloseTo(drawnRadius(relief, here), 9);
  });
});

describe('reliefNormals', () => {
  it('points straight up on flat ground', () => {
    const normals = reliefNormals(flat(1200));
    expect([...normals.slice(0, 4)]).toEqual([128, 128, 255, 255]);
  });

  it('leans away from higher ground', () => {
    const relief = flat(0, 64, 32);
    // The ground rises to the east across row 16, just south of the equator.
    for (let column = 0; column < 64; column += 1) relief.metres[16 * 64 + column] = column * 2000;
    const normals = reliefNormals(relief, 1);
    // Row 16 from the north is row 15 from the south in the texture.
    const index = (15 * 64 + 30) * 4;
    expect(normals[index]).toBeLessThan(128);
    expect(normals[index + 2]).toBeGreaterThan(128);
  });
});

describe('the grid of the globe', () => {
  const file = readFileSync(new URL('../../public/globe/relief.bin', import.meta.url));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const relief = parseGlobalRelief(buffer as ArrayBuffer);

  it('is the size the app expects', () => {
    expect(relief).not.toBeNull();
    expect(relief?.width).toBe(RELIEF_WIDTH);
    expect(relief?.height).toBe(RELIEF_HEIGHT);
    expect(parseGlobalRelief(new ArrayBuffer(12))).toBeNull();
  });

  it('has the heights of Mars where they are', () => {
    if (!relief) throw new Error('The grid did not parse');
    // Published by MOLA: Olympus Mons about +21 km, the floor of Hellas about -8 km.
    expect(heightAt(relief, { lat: 18.65, lon: -133.8 })).toBeGreaterThan(17_000);
    expect(heightAt(relief, { lat: -42.4, lon: 70.5 })).toBeLessThan(-6000);
    // Gale: the floor of the crater near Bradbury Landing is about -4.5 km.
    const gale = heightAt(relief, { lat: -4.59, lon: 137.44 });
    expect(gale).toBeLessThan(-2000);
    expect(gale).toBeGreaterThan(-5500);
  });

  it('keeps the drawn planet inside its atmosphere', () => {
    if (!relief) throw new Error('The grid did not parse');
    let highest = -Infinity;
    for (const metres of relief.metres) highest = Math.max(highest, metres);
    // The glow of the atmosphere is a shell at 1.13 radii.
    expect(1 + (highest / 3_389_500) * RELIEF_EXAGGERATION).toBeLessThan(1.1);
  });
});
