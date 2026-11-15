import { describe, expect, it } from 'vitest';

import type { LogEntry } from '@/mission/walk-log';

import { describeEntry, logFilename, logText } from './walk-log-text';

const entries: LogEntry[] = [
  { atHours: 0, kind: 'start' },
  { atHours: 0.05, kind: 'message-sent', text: 'Hold your position' },
  { atHours: 0.07, kind: 'message-shown', text: 'Hold your position' },
  { atHours: 0.09, kind: 'message-acknowledged', text: 'Hold your position' },
  { atHours: 0.275, kind: 'link-lost' },
  { atHours: 0.5, kind: 'link-back' },
  { atHours: 1.4, kind: 'waypoint-reached', stop: 0 },
  { atHours: 1.6, kind: 'alert', alert: 'near-walk-back-limit' },
  { atHours: 1.7, kind: 'alert', alert: 'turn-back-now' },
  { atHours: 1.73, kind: 'work-done', stop: 0 },
  { atHours: 1.8, kind: 'alert-over', alert: 'near-walk-back-limit' },
  { atHours: 1.9, kind: 'ended-early' },
];

describe('describeEntry', () => {
  it('writes a sentence for every kind of entry', () => {
    expect(entries.map(describeEntry)).toEqual([
      'Left the base',
      'Ship: "Hold your position"',
      'Shown in the visor: "Hold your position"',
      'Acknowledged: "Hold your position"',
      'Link lost: no line of sight to the base',
      'Link back: line of sight to the base',
      'Reached waypoint 1',
      'Caution: near the walk-back limit',
      'Warning: turn back now',
      'Finished the work at waypoint 1',
      'Over: near the walk-back limit',
      'Ended by the ship before the return',
    ]);
    expect(describeEntry({ atHours: 3, kind: 'back-at-base' })).toBe('Back at the base');
  });
});

describe('logText', () => {
  const header = {
    site: 'Jezero Crater',
    startedMs: Date.UTC(2026, 10, 15, 2, 5),
    endedMs: Date.UTC(2026, 10, 15, 2, 20),
    stops: 1,
  };

  it('says what the file is before the entries, and that the walk is simulated', () => {
    const lines = logText(header, entries).split('\n');

    expect(lines[0]).toBe('Armstrong Maps - walk log - Jezero Crater');
    expect(lines[1]).toContain('simulated');
    expect(lines).toContain('Waypoints in the route: 1');
    expect(lines).toContain('Started: 2026-11-15 02:05 UTC');
    expect(lines).toContain('Ended: 2026-11-15 02:20 UTC');
  });

  it('gives one line an entry, stamped with the time of the walk', () => {
    const text = logText(header, entries);

    expect(text).toContain('00:00:00  Left the base');
    expect(text).toContain('00:16:30  Link lost: no line of sight to the base');
    expect(text).toContain('01:24:00  Reached waypoint 1');
    expect(text.trimEnd().split('\n').pop()).toBe('01:54:00  Ended by the ship before the return');
  });

  it('says so when the walk was still going on', () => {
    const text = logText({ ...header, startedMs: null, endedMs: null }, entries.slice(0, 2));
    expect(text).toContain('Still in progress when exported.');
    expect(text).not.toContain('Started:');
  });
});

describe('logFilename', () => {
  it('names the site and the day', () => {
    expect(logFilename('jezero', Date.UTC(2026, 10, 15, 2, 20))).toBe(
      'armstrong-maps-walk-jezero-2026-11-15.txt',
    );
  });
});
