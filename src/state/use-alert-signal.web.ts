import { useEffect, useRef } from 'react';

import { ALERT_SIGNALS, signalFor, type SignalLevel } from '@/mission/alert-signal';
import type { SafetyAlert } from '@/mission/safety';

export const ALERT_SIGNAL_AVAILABLE = true;

/** How loud the tone is, from 0 to 1: enough to hear over the wind, not enough to startle. */
const VOLUME = 0.22;

function play(context: AudioContext, level: SignalLevel) {
  let at = context.currentTime + 0.02;
  for (const tone of ALERT_SIGNALS[level].tones) {
    const length = tone.ms / 1000;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = tone.hz;
    // In and out over a few milliseconds, or the tone clicks.
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(VOLUME, at + 0.015);
    envelope.gain.setValueAtTime(VOLUME, at + length - 0.03);
    envelope.gain.linearRampToValueAtTime(0, at + length);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + length + 0.01);
    at += length + tone.gapMs / 1000;
  }
}

/**
 * A tone and a vibration when an alert appears, once for each time it appears. Nothing is heard
 * unless `enabled`: the screen ties it to its sound switch, so switching the sound off silences
 * the alerts too. A browser only lets sound start from a press, so the screen calls `arm` from
 * the press that switches the sound on. The tone goes through the audio of the page, which a
 * phone mutes with its silent switch; vibration runs only where the browser offers it.
 */
export function useAlertSignal(alerts: readonly SafetyAlert[], enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  const before = useRef<readonly SafetyAlert[]>(alerts);
  // The list is a new array on every draw; its text changes only when the alerts do.
  const key = alerts.join(' ');

  useEffect(() => {
    const now = key === '' ? [] : (key.split(' ') as SafetyAlert[]);
    const level = signalFor(before.current, now);
    // What is on is remembered even while silent: switching the sound on later does not replay it.
    before.current = now;
    if (!enabled || level === null) return;
    if (context.current) play(context.current, level);
    try {
      navigator.vibrate?.([...ALERT_SIGNALS[level].vibration]);
    } catch {
      // No vibration here: the tone and the display carry the alert.
    }
  }, [key, enabled]);

  useEffect(
    () => () => {
      void context.current?.close();
      context.current = null;
    },
    [],
  );

  function arm() {
    context.current ??= new AudioContext();
    void context.current.resume();
  }

  return { arm };
}
