import { describe, expect, it } from 'vitest';

import { formatDistance, formatLat, formatLatLon, formatLon, roundLength } from './format';

describe('coordinates', () => {
  it('writes the hemisphere instead of a sign', () => {
    expect(formatLat(-4.589467)).toBe('4.5895° S');
    expect(formatLat(18.4447)).toBe('18.4447° N');
  });

  it('writes longitude as 0 to 360 east', () => {
    expect(formatLon(137.441633)).toBe('137.4416° E');
    expect(formatLon(-5.5266)).toBe('354.4734° E');
    expect(formatLon(-0.00001)).toBe('0.0000° E');
  });

  it('joins the two', () => {
    expect(formatLatLon({ lat: -1.9462, lon: -5.5266 }, 2)).toBe('1.95° S  354.47° E');
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(849.6)).toBe('850 m');
  });

  it('uses fewer decimals as the distance grows', () => {
    expect(formatDistance(1250)).toBe('1.25 km');
    expect(formatDistance(12_440)).toBe('12.4 km');
    expect(formatDistance(340_400)).toBe('340 km');
  });
});

describe('roundLength', () => {
  it('picks 1, 2 or 5 times a power of ten', () => {
    expect(roundLength(1)).toBe(1);
    expect(roundLength(180)).toBe(100);
    expect(roundLength(260)).toBe(200);
    expect(roundLength(999)).toBe(500);
    expect(roundLength(74_000)).toBe(50_000);
  });

  it('returns zero when nothing fits', () => {
    expect(roundLength(0)).toBe(0);
    expect(roundLength(-5)).toBe(0);
  });
});
