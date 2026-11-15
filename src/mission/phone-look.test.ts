import { describe, expect, it } from 'vitest';

import { isReading, lookSince, phoneDirection } from './phone-look';

const upright = (alpha: number, beta = 90, gamma = 0) => ({ alpha, beta, gamma });

describe('phoneDirection', () => {
  it('points at the horizon when the phone stands upright', () => {
    const { heading, pitch } = phoneDirection(upright(0));
    expect(heading).toBeCloseTo(0, 6);
    expect(pitch).toBeCloseTo(0, 6);
  });

  it('points down when the phone lies flat on a table', () => {
    expect(phoneDirection({ alpha: 0, beta: 0, gamma: 0 }).pitch).toBeCloseTo(-90, 6);
  });

  it('points up as the top of the phone tilts back towards the person', () => {
    expect(phoneDirection(upright(0, 120)).pitch).toBeCloseTo(30, 6);
    expect(phoneDirection(upright(0, 70)).pitch).toBeCloseTo(-20, 6);
  });

  it('turns the other way from alpha, which grows counter-clockwise', () => {
    // A quarter turn counter-clockwise seen from above is a turn to the left: heading 270.
    expect(phoneDirection(upright(90)).heading).toBeCloseTo(270, 6);
    expect(phoneDirection(upright(270)).heading).toBeCloseTo(90, 6);
  });
});

describe('lookSince', () => {
  it('is nothing while the phone is held as it was', () => {
    const look = lookSince(upright(140, 80), upright(140, 80));
    expect(look.yaw).toBeCloseTo(0, 6);
    expect(look.pitch).toBeCloseTo(0, 6);
  });

  it('turns right as the phone turns right, by as much', () => {
    // Turning right is clockwise from above: alpha goes down.
    expect(lookSince(upright(100), upright(70)).yaw).toBeCloseTo(30, 6);
    expect(lookSince(upright(100), upright(130)).yaw).toBeCloseTo(-30, 6);
  });

  it('takes the short way round across the sensor zero', () => {
    expect(lookSince(upright(10), upright(350)).yaw).toBeCloseTo(20, 6);
    expect(lookSince(upright(350), upright(10)).yaw).toBeCloseTo(-20, 6);
  });

  it('tilts with the phone', () => {
    expect(lookSince(upright(0, 85), upright(0, 100)).pitch).toBeCloseTo(15, 6);
  });

  it('keeps the turn it had when the phone points straight up, where there is no heading', () => {
    const look = lookSince(upright(0), upright(200, 175), 42);
    expect(look.yaw).toBe(42);
    expect(look.pitch).toBeGreaterThan(80);
  });

  it('works with the phone on its side', () => {
    // On its side, upright, the back still points at the horizon; turning it turns the view.
    const side = (alpha: number) => ({ alpha, beta: 0, gamma: -90 });
    expect(phoneDirection(side(0)).pitch).toBeCloseTo(0, 6);
    expect(Math.abs(lookSince(side(100), side(70)).yaw)).toBeCloseTo(30, 6);
  });
});

describe('isReading', () => {
  it('refuses the nulls a device without sensors reports', () => {
    expect(isReading({ alpha: null, beta: null, gamma: null })).toBe(false);
    expect(isReading({ alpha: 10, beta: 90, gamma: null })).toBe(false);
    expect(isReading({ alpha: 10, beta: 90, gamma: 0 })).toBe(true);
  });
});
