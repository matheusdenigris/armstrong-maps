import { describe, expect, it } from 'vitest';

import {
  directionOf,
  directionToPixel,
  inverse,
  parseCameraModel,
  parseQuaternion,
  pointingOf,
  rotate,
  type Vec3,
} from './cahvore';

/**
 * A whole frame of the navigation camera of Perseverance, sol 20, as the raw image feed gives
 * it: 1280 by 960 pixels, the mast turned 2.4 degrees from straight ahead and tilted 30.7 down.
 */
const MODEL =
  '(0.956412,0.352839,-1.90225);(0.854471,0.0474836,0.517339);(514.582,769.387,333.13);' +
  '(32.561,4.47494,883.909);(0.854332,0.0489022,0.517437);(2e-06,0.049535,-0.015973);' +
  '(-0.003612,0.013016,-0.023961);2.0;0.0';
const ATTITUDE = '(0.43967,-0.00139028,0.0100708,0.898102)';

describe('rotations', () => {
  const q = parseQuaternion(ATTITUDE)!;

  it('reads the orientation of the rover', () => {
    // The traverse gives a yaw of 127.8 degrees for this stop.
    expect(pointingOf(rotate(q, [1, 0, 0])).azimuth).toBeCloseTo(127.8, 0);
  });

  it('undoes a rotation with its inverse', () => {
    const v: Vec3 = [0.3, -0.5, 0.8];
    const back = rotate(inverse(q), rotate(q, v));
    back.forEach((value, index) => expect(value).toBeCloseTo(v[index], 9));
  });

  it('rejects what is not a rotation', () => {
    expect(parseQuaternion('')).toBeNull();
    expect(parseQuaternion('(1,2,3)')).toBeNull();
    expect(parseQuaternion(undefined)).toBeNull();
  });
});

describe('directions', () => {
  it('turns a compass direction into north, east, down and back', () => {
    const east = directionOf(90, 0);
    expect(east[0]).toBeCloseTo(0, 9);
    expect(east[1]).toBeCloseTo(1, 9);
    expect(directionOf(0, 90)[2]).toBeCloseTo(-1, 9);
    const there = pointingOf(directionOf(213, -17));
    expect(there.azimuth).toBeCloseTo(213, 6);
    expect(there.elevation).toBeCloseTo(-17, 6);
  });
});

describe('the camera model', () => {
  const model = parseCameraModel(MODEL, 'CAHVORE')!;
  const q = parseQuaternion(ATTITUDE)!;

  it('is read as a fisheye', () => {
    expect(model).not.toBeNull();
    expect(model.linearity).toBe(0);
  });

  it('points where the mast pointed', () => {
    // 2.4 degrees right of the rover's heading of 127.8, and 30.7 degrees down.
    const { azimuth, elevation } = pointingOf(rotate(q, model.a));
    expect(azimuth).toBeGreaterThan(129);
    expect(azimuth).toBeLessThan(132);
    expect(elevation).toBeGreaterThan(-32);
    expect(elevation).toBeLessThan(-30);
  });

  it('shows its own axis at the middle of the frame', () => {
    const pixel = directionToPixel(model, model.o)!;
    expect(pixel.x).toBeGreaterThan(600);
    expect(pixel.x).toBeLessThan(680);
    expect(pixel.y).toBeGreaterThan(440);
    expect(pixel.y).toBeLessThan(520);
  });

  it('shows what is to the right further right, and what is higher further up', () => {
    const { azimuth, elevation } = pointingOf(rotate(q, model.o));
    const at = (az: number, el: number) =>
      directionToPixel(model, rotate(inverse(q), directionOf(az, el)))!;
    const middle = at(azimuth, elevation);
    expect(at(azimuth + 10, elevation).x).toBeGreaterThan(middle.x + 80);
    expect(at(azimuth, elevation + 10).y).toBeLessThan(middle.y - 80);
  });

  it('covers about 96 degrees across, as the camera is specified', () => {
    const { azimuth, elevation } = pointingOf(rotate(q, model.o));
    const at = (az: number) =>
      directionToPixel(model, rotate(inverse(q), directionOf(az, elevation)))!;
    // 48 degrees to one side lands near the edge of a frame 1280 pixels wide.
    const edge = at(azimuth + 48 / Math.cos((elevation * Math.PI) / 180));
    expect(edge.x).toBeGreaterThan(1180);
    expect(edge.x).toBeLessThan(1400);
  });

  it('sees nothing behind the lens', () => {
    const back: Vec3 = [-model.o[0], -model.o[1], -model.o[2]];
    expect(directionToPixel(model, back)).toBeNull();
  });

  it('rejects a list it does not know', () => {
    expect(parseCameraModel('', 'CAHVORE')).toBeNull();
    expect(parseCameraModel(MODEL, 'SOMETHING')).toBeNull();
    expect(parseCameraModel(undefined, 'CAHVORE')).toBeNull();
    // A plain perspective model has no lens terms to read.
    expect(parseCameraModel(MODEL, 'CAHV')?.linearity).toBe(1);
  });
});
