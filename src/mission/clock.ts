/**
 * The clock of a simulated walk.
 *
 * It does not tick. It records a moment on the wall clock and how much walk time had passed by
 * then, so any screen, in any tab, works out the same elapsed time from its own clock. Pausing
 * and changing the speed move that anchor.
 */
export type WalkClock = {
  running: boolean;
  /** Wall-clock time of the anchor, in milliseconds since the epoch. */
  anchorMs: number;
  /** Walk time that had passed at the anchor, in seconds. */
  elapsedS: number;
  /** Walk seconds per real second: 60 plays a minute of walking every second. */
  rate: number;
};

/** The speeds the console offers. Real time is there, but a walk of hours needs the others. */
export const CLOCK_RATES = [1, 60, 600] as const;
export const DEFAULT_RATE = 60;

/** Walk time passed at `nowMs`, in seconds. Never negative, even if the device clock steps back. */
export function elapsedSeconds(clock: WalkClock, nowMs: number): number {
  if (!clock.running) return clock.elapsedS;
  return clock.elapsedS + Math.max(0, (nowMs - clock.anchorMs) / 1000) * clock.rate;
}

export function startClock(nowMs: number, rate: number = DEFAULT_RATE): WalkClock {
  return { running: true, anchorMs: nowMs, elapsedS: 0, rate };
}

export function pauseClock(clock: WalkClock, nowMs: number): WalkClock {
  return { ...clock, running: false, anchorMs: nowMs, elapsedS: elapsedSeconds(clock, nowMs) };
}

export function resumeClock(clock: WalkClock, nowMs: number): WalkClock {
  return clock.running ? clock : { ...clock, running: true, anchorMs: nowMs };
}

/** Changes the speed from now on, keeping the time that has already passed. */
export function withRate(clock: WalkClock, rate: number, nowMs: number): WalkClock {
  return { ...clock, rate, anchorMs: nowMs, elapsedS: elapsedSeconds(clock, nowMs) };
}
