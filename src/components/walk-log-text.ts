/**
 * The walk log in words: one sentence an entry, and the text file the log is exported as. It is
 * kept apart from the component that draws the log so it can be tested on its own.
 */
import { formatClock } from '@/mission/format';
import { alertLevel, type SafetyAlert } from '@/mission/safety';
import type { LogEntry } from '@/mission/walk-log';

/** What each alert is called in the log. The visor writes its own, longer sentences. */
const ALERT_NAME: Record<SafetyAlert, string> = {
  'life-support-exhausted': 'life support exhausted',
  'turn-back-now': 'turn back now',
  'beyond-walk-back-limit': 'beyond the walk-back limit',
  'return-margin-low': 'little time to spare before turning back',
  'life-support-reserve': 'into the life-support reserve',
  'near-walk-back-limit': 'near the walk-back limit',
};

/** One entry of the log, as a sentence. */
export function describeEntry(entry: LogEntry): string {
  switch (entry.kind) {
    case 'start':
      return 'Left the base';
    case 'waypoint-reached':
      return `Reached waypoint ${entry.stop + 1}`;
    case 'work-done':
      return `Finished the work at waypoint ${entry.stop + 1}`;
    case 'back-at-base':
      return 'Back at the base';
    case 'alert':
      return `${alertLevel(entry.alert) === 'warning' ? 'Warning' : 'Caution'}: ${ALERT_NAME[entry.alert]}`;
    case 'alert-over':
      return `Over: ${ALERT_NAME[entry.alert]}`;
    case 'link-lost':
      return 'Link lost: no line of sight to the base';
    case 'link-back':
      return 'Link back: line of sight to the base';
    case 'message-sent':
      return `Ship: "${entry.text}"`;
    case 'message-shown':
      return `Shown in the visor: "${entry.text}"`;
    case 'message-acknowledged':
      return `Acknowledged: "${entry.text}"`;
    case 'ended-early':
      return 'Ended by the ship before the return';
  }
}

export type LogHeader = {
  site: string;
  /** When the walk started and ended on the wall clock, when known. */
  startedMs: number | null;
  endedMs: number | null;
  stops: number;
};

const stamp = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** The log as a text file: a header that says what it is, then one line an entry. */
export function logText(header: LogHeader, entries: readonly LogEntry[]): string {
  const lines = [
    `Armstrong Maps - walk log - ${header.site}`,
    'A simulated walk: the position, the clock and the alerts follow the plan. Times are walk time since leaving the base.',
    `Waypoints in the route: ${header.stops}`,
  ];
  if (header.startedMs !== null) lines.push(`Started: ${stamp(header.startedMs)}`);
  lines.push(
    header.endedMs !== null ? `Ended: ${stamp(header.endedMs)}` : 'Still in progress when exported.',
    '',
    ...entries.map((entry) => `${formatClock(entry.atHours)}  ${describeEntry(entry)}`),
    '',
  );
  return lines.join('\n');
}

/** A file name for the log of a walk at a site. */
export function logFilename(siteId: string, atMs: number): string {
  return `armstrong-maps-walk-${siteId}-${new Date(atMs).toISOString().slice(0, 10)}.txt`;
}
