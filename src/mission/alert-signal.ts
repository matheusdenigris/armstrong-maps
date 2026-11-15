/**
 * When the visor makes itself heard: a tone and a vibration for an alert that has just appeared.
 *
 * An alert is an event when it comes on. While it stays on it says nothing more; if it goes away
 * and comes back, that is a new event. The screen decides whether the person wants to hear it.
 */
import { alertLevel, type SafetyAlert } from './safety';

/** The alerts that are on now and were not on at the last look. */
export function newAlerts(
  before: readonly SafetyAlert[],
  now: readonly SafetyAlert[],
): SafetyAlert[] {
  return now.filter((alert) => !before.includes(alert));
}

export type SignalLevel = 'caution' | 'warning';

/** How serious what just appeared is, or null when nothing did. One signal, for the worst of it. */
export function signalFor(
  before: readonly SafetyAlert[],
  now: readonly SafetyAlert[],
): SignalLevel | null {
  const fresh = newAlerts(before, now);
  if (fresh.length === 0) return null;
  return fresh.some((alert) => alertLevel(alert) === 'warning') ? 'warning' : 'caution';
}

export type AlertSignal = {
  /** Tones played one after the other: pitch in hertz, length and the silence after it in ms. */
  tones: readonly { hz: number; ms: number; gapMs: number }[];
  /** Vibration and pauses in turn, in ms, as phones take it. */
  vibration: readonly number[];
};

/**
 * A caution is one soft tone; a warning is three higher ones. They are short on purpose: the
 * display says what the alert is, the signal only says to look.
 */
export const ALERT_SIGNALS: Readonly<Record<SignalLevel, AlertSignal>> = {
  caution: { tones: [{ hz: 660, ms: 220, gapMs: 0 }], vibration: [180] },
  warning: {
    tones: [
      { hz: 880, ms: 170, gapMs: 110 },
      { hz: 880, ms: 170, gapMs: 110 },
      { hz: 880, ms: 170, gapMs: 0 },
    ],
    vibration: [220, 110, 220, 110, 220],
  },
};
