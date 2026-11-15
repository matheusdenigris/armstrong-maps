import { describe, expect, it } from 'vitest';

import {
  formatClock,
  formatDistance,
  formatHeight,
  formatHeightFrom,
  formatDose,
  formatDuration,
  formatLat,
  formatLatLon,
  formatLon,
  formatShare,
  roundLength,
} from './format';

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

describe('formatDuration', () => {
  it('uses minutes below an hour', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(0.75)).toBe('45 min');
  });

  it('uses hours and two-digit minutes from an hour', () => {
    expect(formatDuration(1)).toBe('1 h 00 min');
    expect(formatDuration(1 + 5 / 60)).toBe('1 h 05 min');
    expect(formatDuration(7.999)).toBe('8 h 00 min');
  });
});

describe('formatClock', () => {
  it('writes hours, minutes and seconds with two digits each', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(1 + 5 / 60 + 9 / 3600)).toBe('01:05:09');
    expect(formatClock(12.5)).toBe('12:30:00');
  });

  it('does not go below zero', () => {
    expect(formatClock(-1)).toBe('00:00:00');
  });
});

describe('formatShare and formatDose', () => {
  it('writes a share as a whole percentage', () => {
    expect(formatShare(0.142)).toBe('14%');
    expect(formatShare(1.25)).toBe('125%');
  });

  it('writes a dose with three decimals', () => {
    expect(formatDose(0.0302)).toBe('0.030 mSv');
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

describe('heights', () => {
  it('writes a height in whole metres with its sign', () => {
    expect(formatHeight(-4502.99)).toBe('-4,503 m');
    expect(formatHeight(21229.4)).toBe('21,229 m');
    expect(formatHeight(-0.2)).toBe('0 m');
    expect(formatHeight(812)).toBe('812 m');
  });

  it('says how far up or down a place is from another', () => {
    expect(formatHeightFrom(12.4, 'the base')).toBe('12 m above the base');
    expect(formatHeightFrom(-1234.6, 'the base')).toBe('1,235 m below the base');
    expect(formatHeightFrom(0.3, 'the base')).toBe('Level with the base');
  });
});
