import { describe, expect, it } from 'vitest';

import { ALERT_SIGNALS, newAlerts, signalFor } from './alert-signal';

describe('newAlerts', () => {
  it('finds what has just come on', () => {
    expect(newAlerts([], ['return-margin-low'])).toEqual(['return-margin-low']);
    expect(newAlerts(['return-margin-low'], ['turn-back-now', 'return-margin-low'])).toEqual([
      'turn-back-now',
    ]);
  });

  it('says nothing about an alert that stays on, or one that went away', () => {
    expect(newAlerts(['near-walk-back-limit'], ['near-walk-back-limit'])).toEqual([]);
    expect(newAlerts(['near-walk-back-limit'], [])).toEqual([]);
  });
});

describe('signalFor', () => {
  it('fires once: not again while the alert stays on', () => {
    expect(signalFor([], ['life-support-reserve'])).toBe('caution');
    expect(signalFor(['life-support-reserve'], ['life-support-reserve'])).toBeNull();
  });

  it('fires again when an alert that went away comes back', () => {
    expect(signalFor(['near-walk-back-limit'], [])).toBeNull();
    expect(signalFor([], ['near-walk-back-limit'])).toBe('caution');
  });

  it('gives one signal for the worst of what appeared', () => {
    expect(signalFor([], ['turn-back-now', 'life-support-reserve'])).toBe('warning');
    // A warning that was already on does not make a new caution a warning.
    expect(signalFor(['turn-back-now'], ['turn-back-now', 'life-support-reserve'])).toBe('caution');
  });
});

describe('the signals', () => {
  it('are short, and a warning is more insistent than a caution', () => {
    const length = (level: 'caution' | 'warning') =>
      ALERT_SIGNALS[level].tones.reduce((sum, tone) => sum + tone.ms + tone.gapMs, 0);

    expect(length('caution')).toBeLessThan(length('warning'));
    expect(length('warning')).toBeLessThan(1000);
    expect(ALERT_SIGNALS.warning.tones.length).toBeGreaterThan(ALERT_SIGNALS.caution.tones.length);
    for (const level of ['caution', 'warning'] as const) {
      // A pattern of vibration starts and ends with a vibration.
      expect(ALERT_SIGNALS[level].vibration.length % 2).toBe(1);
    }
  });
});
