/**
 * The record of a walk: when it started, when each waypoint was reached, the alerts that came
 * up, the link dropping and coming back, the messages exchanged, and the end.
 *
 * A simulated walk follows its plan exactly, so most of the record is worked out, not written
 * down as it happens: the same plan always gives the same log, on any screen. Only the messages
 * are recorded, since someone typed them. The interface writes the sentences; this module gives
 * the entries, each stamped with the time of the walk.
 */
import { distance, type LatLon } from './geo';
import { priorityOf, type MessagePriority, type ShipMessage } from './messages';
import { walkProgress } from './progress';
import { walkSafety, type SafetyAlert } from './safety';
import {
  WALK_ASSUMPTIONS,
  legSlow,
  stopMinutes,
  type WalkAssumptions,
  type WalkStop,
} from './walk';

export type LogEntry = { atHours: number } & (
  | { kind: 'start' }
  /** `stop` counts from 0. */
  | { kind: 'waypoint-reached'; stop: number }
  | { kind: 'work-done'; stop: number }
  | { kind: 'back-at-base' }
  | { kind: 'alert'; alert: SafetyAlert }
  | { kind: 'alert-over'; alert: SafetyAlert }
  | { kind: 'link-lost' }
  | { kind: 'link-back' }
  | { kind: 'message-sent'; text: string; priority: MessagePriority }
  | { kind: 'message-shown'; text: string }
  | { kind: 'message-acknowledged'; text: string }
  /** The ship ended the walk before the astronaut was back. */
  | { kind: 'ended-early' }
);

/** How finely the walk is looked at for alerts and for the link, in hours: half a minute. */
export const WATCH_STEP_HOURS = 1 / 120;

export type LogOptions = {
  doseRateMsvPerDay: number;
  assumptions?: WalkAssumptions;
  /**
   * Whether the link is down with the crew member at a place: true when the line of sight is
   * blocked, false when it is clear, null when it cannot be told. Left out, the link is not
   * followed.
   */
  linkDownAt?: (position: LatLon) => boolean | null;
  messages?: readonly ShipMessage[];
  /** The walk was ended by the ship at `uptoHours`, before its plan was over. */
  endedEarly?: boolean;
};

/** Start, each waypoint and the return, from the plan, up to `uptoHours`. */
function planEntries(
  base: LatLon,
  waypoints: readonly WalkStop[],
  uptoHours: number,
  doseRate: number,
  assumptions: WalkAssumptions,
): LogEntry[] {
  const entries: LogEntry[] = [{ atHours: 0, kind: 'start' }];
  const total = walkProgress(base, waypoints, 0, doseRate, assumptions).totalHours;
  const metresPerHour = assumptions.walkingSpeedKmh * 1000;
  // The time each waypoint is reached is the time the work there starts.
  let clock = 0;
  const points = [base, ...waypoints];
  waypoints.forEach((_, stop) => {
    clock += (distance(points[stop], points[stop + 1]) / metresPerHour) * legSlow(waypoints, stop);
    if (clock <= uptoHours) entries.push({ atHours: clock, kind: 'waypoint-reached', stop });
    // Each stop lasts as long as the plan gives it. A point the walk only passes through has no
    // work to finish.
    const stopHours = stopMinutes(waypoints[stop], assumptions) / 60;
    clock += stopHours;
    if (stopHours > 0 && clock <= uptoHours) {
      entries.push({ atHours: clock, kind: 'work-done', stop });
    }
  });
  if (waypoints.length > 0 && total <= uptoHours) {
    entries.push({ atHours: total, kind: 'back-at-base' });
  }
  return entries;
}

/** Alerts and the link, found by looking at the walk every half minute. */
function watchEntries(
  base: LatLon,
  waypoints: readonly LatLon[],
  uptoHours: number,
  doseRate: number,
  assumptions: WalkAssumptions,
  linkDownAt: LogOptions['linkDownAt'],
): LogEntry[] {
  const entries: LogEntry[] = [];
  let alerts: readonly SafetyAlert[] = [];
  let linkDown = false;
  const total = walkProgress(base, waypoints, 0, doseRate, assumptions).totalHours;
  const last = Math.min(uptoHours, total);
  for (let step = 0; step * WATCH_STEP_HOURS <= last; step += 1) {
    const atHours = step * WATCH_STEP_HOURS;
    const progress = walkProgress(base, waypoints, atHours, doseRate, assumptions);
    const now = walkSafety(progress, assumptions).alerts;
    for (const alert of now) {
      if (!alerts.includes(alert)) entries.push({ atHours, kind: 'alert', alert });
    }
    for (const alert of alerts) {
      if (!now.includes(alert)) entries.push({ atHours, kind: 'alert-over', alert });
    }
    alerts = now;
    const down = linkDownAt?.(progress.position);
    // An unknown changes nothing: the link is reported as it was last known.
    if (down === true && !linkDown) entries.push({ atHours, kind: 'link-lost' });
    if (down === false && linkDown) entries.push({ atHours, kind: 'link-back' });
    if (down !== null && down !== undefined) linkDown = down;
  }
  return withoutBlips(entries);
}

/**
 * A line of sight that grazes the ground can read blocked at one look and clear at the next, on
 * a difference of centimetres the elevation model cannot stand behind. A change of the link that
 * is undone at the very next look is left out of the log, both entries of it.
 */
function withoutBlips(entries: LogEntry[]): LogEntry[] {
  const isLink = (entry: LogEntry) => entry.kind === 'link-lost' || entry.kind === 'link-back';
  const kept: LogEntry[] = [];
  for (const entry of entries) {
    const last = [...kept].reverse().find(isLink);
    if (
      isLink(entry) &&
      last &&
      last.kind !== entry.kind &&
      entry.atHours - last.atHours <= WATCH_STEP_HOURS * 1.5
    ) {
      kept.splice(kept.lastIndexOf(last), 1);
      continue;
    }
    kept.push(entry);
  }
  return kept;
}

function messageEntries(messages: readonly ShipMessage[], uptoHours: number): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const message of messages) {
    const { text } = message;
    if (message.sentHours <= uptoHours) {
      entries.push({
        atHours: message.sentHours,
        kind: 'message-sent',
        text,
        priority: priorityOf(message),
      });
    }
    if (message.shownHours !== null && message.shownHours <= uptoHours) {
      entries.push({ atHours: message.shownHours, kind: 'message-shown', text });
    }
    if (message.ackHours !== null && message.ackHours <= uptoHours) {
      entries.push({ atHours: message.ackHours, kind: 'message-acknowledged', text });
    }
  }
  return entries;
}

/** In what order entries of the same moment are told. */
const ORDER: Record<LogEntry['kind'], number> = {
  start: 0,
  'waypoint-reached': 1,
  'work-done': 2,
  'alert-over': 3,
  alert: 4,
  'link-back': 5,
  'link-lost': 6,
  'message-sent': 7,
  'message-shown': 8,
  'message-acknowledged': 9,
  'back-at-base': 10,
  'ended-early': 11,
};

/** The log of a walk up to `uptoHours` of walk time, oldest entry first. */
export function walkLog(
  base: LatLon,
  waypoints: readonly LatLon[],
  uptoHours: number,
  options: LogOptions,
): LogEntry[] {
  if (waypoints.length === 0) return [];
  const assumptions = options.assumptions ?? WALK_ASSUMPTIONS;
  const upto = Math.max(0, uptoHours);
  const entries = [
    ...planEntries(base, waypoints, upto, options.doseRateMsvPerDay, assumptions),
    ...watchEntries(base, waypoints, upto, options.doseRateMsvPerDay, assumptions, options.linkDownAt),
    ...messageEntries(options.messages ?? [], upto),
  ];
  if (options.endedEarly) entries.push({ atHours: upto, kind: 'ended-early' });
  return entries.sort((a, b) => a.atHours - b.atHours || ORDER[a.kind] - ORDER[b.kind]);
}
