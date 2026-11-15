import { describe, expect, it } from 'vitest';

import { ALERT_SIGNALS, messageSignal, newAlerts, signalFor } from './alert-signal';

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
    for (const level of Object.keys(ALERT_SIGNALS) as (keyof typeof ALERT_SIGNALS)[]) {
      // A pattern of vibration starts and ends with a vibration.
      expect(ALERT_SIGNALS[level].vibration.length % 2).toBe(1);
    }
  });
});

describe('a message from the ship', () => {
  const length = (kind: keyof typeof ALERT_SIGNALS) =>
    ALERT_SIGNALS[kind].tones.reduce((sum, tone) => sum + tone.ms + tone.gapMs, 0);

  it('sounds when it arrives, by its priority, and not again while it waits', () => {
    expect(messageSignal(0, ['routine'])).toBe('message-routine');
    expect(messageSignal(1, ['routine'])).toBeNull();
    expect(messageSignal(1, ['routine', 'urgent'])).toBe('message-urgent');
    expect(messageSignal(2, ['routine', 'urgent', 'attention'])).toBe('message-attention');
  });

  it('makes one sound, for the most serious, when several arrive together', () => {
    expect(messageSignal(0, ['routine', 'attention', 'urgent'])).toBe('message-urgent');
    expect(messageSignal(1, ['urgent', 'routine', 'attention'])).toBe('message-attention');
  });

  it('says nothing when the list is cleared for a new walk', () => {
    expect(messageSignal(2, [])).toBeNull();
  });

  it('starts every message with the same two rising notes, unlike an alert', () => {
    for (const kind of ['message-routine', 'message-attention', 'message-urgent'] as const) {
      const [first, second] = ALERT_SIGNALS[kind].tones;
      expect(second.hz).toBeGreaterThan(first.hz);
      expect(first.hz).not.toBe(ALERT_SIGNALS.caution.tones[0].hz);
    }
  });

  it('is longer and higher the more serious the message is', () => {
    expect(length('message-routine')).toBeLessThan(length('message-attention'));
    expect(length('message-attention')).toBeLessThan(length('message-urgent'));
    const highest = (kind: keyof typeof ALERT_SIGNALS) =>
      Math.max(...ALERT_SIGNALS[kind].tones.map((tone) => tone.hz));
    expect(highest('message-urgent')).toBeGreaterThan(highest('message-attention'));
    expect(length('message-urgent')).toBeLessThan(1400);
  });
});
