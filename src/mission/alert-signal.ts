/**
 * When the visor makes itself heard: a tone and a vibration for an alert that has just appeared.
 *
 * An alert is an event when it comes on. While it stays on it says nothing more; if it goes away
 * and comes back, that is a new event. The screen decides whether the person wants to hear it.
 */
import { worstPriority, type MessagePriority } from './messages';
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
 * Everything the visor makes a sound for: the two levels of alert, and a message from the ship
 * at each of its priorities.
 */
export type SignalKind = SignalLevel | `message-${MessagePriority}`;

/**
 * A caution is one soft tone and a warning is three higher ones. A message from the ship starts
 * with two rising notes, so it is not taken for an alert, and says how serious it is by what
 * follows: nothing for a routine one, the pair again for one that needs attention, and three
 * high notes for an urgent one. They are short on purpose: the display says what it is, the
 * signal only says to look, and how soon.
 */
export const ALERT_SIGNALS: Readonly<Record<SignalKind, AlertSignal>> = {
  caution: { tones: [{ hz: 660, ms: 220, gapMs: 0 }], vibration: [180] },
  warning: {
    tones: [
      { hz: 880, ms: 170, gapMs: 110 },
      { hz: 880, ms: 170, gapMs: 110 },
      { hz: 880, ms: 170, gapMs: 0 },
    ],
    vibration: [220, 110, 220, 110, 220],
  },
  'message-routine': {
    tones: [
      { hz: 587, ms: 130, gapMs: 50 },
      { hz: 880, ms: 200, gapMs: 0 },
    ],
    vibration: [90, 60, 90],
  },
  'message-attention': {
    tones: [
      { hz: 587, ms: 130, gapMs: 50 },
      { hz: 880, ms: 170, gapMs: 140 },
      { hz: 587, ms: 130, gapMs: 50 },
      { hz: 880, ms: 200, gapMs: 0 },
    ],
    vibration: [130, 70, 130, 70, 130],
  },
  'message-urgent': {
    tones: [
      { hz: 587, ms: 110, gapMs: 40 },
      { hz: 880, ms: 110, gapMs: 90 },
      { hz: 1175, ms: 150, gapMs: 70 },
      { hz: 1175, ms: 150, gapMs: 70 },
      { hz: 1175, ms: 220, gapMs: 0 },
    ],
    vibration: [220, 80, 220, 80, 320],
  },
};

/**
 * The sound for the messages that have just arrived: `shown` lists the priority of every message
 * the visor has shown, oldest first, and `shownBefore` is how many there were at the last look.
 * Null when none is new: a message that stays on screen does not sound again. Several at once
 * make one sound, for the most serious.
 */
export function messageSignal(
  shownBefore: number,
  shown: readonly MessagePriority[],
): SignalKind | null {
  const worst = worstPriority(shown.slice(Math.max(0, shownBefore)));
  return worst === null ? null : `message-${worst}`;
}
