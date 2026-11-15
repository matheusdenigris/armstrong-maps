import { describe, expect, it } from 'vitest';

import { destination, distance } from './geo';
import { withAcknowledged, withMessage, withShown } from './messages';
import { walkProgress } from './progress';
import { walkLog, type LogEntry } from './walk-log';
import { WALK_ASSUMPTIONS } from './walk';

const base = { lat: -4.589467, lon: 137.441633 };
const DOSE = 0.64;
const options = { doseRateMsvPerDay: DOSE };

/** A waypoint 1 km north and one 1 km east of it: 2.5 km/h, so 24 minutes a kilometre. */
const first = destination(base, 0, 1000);
const second = destination(first, 90, 1000);
const route = [first, second];

const kinds = (entries: LogEntry[]) => entries.map((entry) => entry.kind);
const at = (entries: LogEntry[], kind: LogEntry['kind']) =>
  entries.filter((entry) => entry.kind === kind).map((entry) => entry.atHours);

describe('walkLog', () => {
  it('is empty without a route', () => {
    expect(walkLog(base, [], 1, options)).toEqual([]);
  });

  it('starts with the start, and holds only what has happened so far', () => {
    expect(kinds(walkLog(base, route, 0.1, options))).toEqual(['start']);
  });

  it('tells each waypoint, the work there and the return, at the times of the plan', () => {
    const total = walkProgress(base, route, 0, DOSE).totalHours;
    const log = walkLog(base, route, total + 1, options);
    const stop = WALK_ASSUMPTIONS.minutesPerStop / 60;

    expect(kinds(log)).toEqual([
      'start',
      'waypoint-reached',
      'work-done',
      'waypoint-reached',
      'work-done',
      'back-at-base',
    ]);
    expect(at(log, 'waypoint-reached')[0]).toBeCloseTo(0.4, 3);
    expect(at(log, 'work-done')[0]).toBeCloseTo(0.4 + stop, 3);
    expect(at(log, 'waypoint-reached')[1]).toBeCloseTo(0.8 + stop, 3);
    expect(at(log, 'back-at-base')[0]).toBeCloseTo(total, 6);
    // The way back is the diagonal: about 1.41 km.
    expect(total).toBeCloseTo(0.8 + 2 * stop + distance(second, base) / 2500, 6);
  });

  it('marks the walk as ended early when the ship ends it', () => {
    const log = walkLog(base, route, 0.5, { ...options, endedEarly: true });
    expect(kinds(log)).toEqual(['start', 'waypoint-reached', 'ended-early']);
    expect(log[log.length - 1].atHours).toBe(0.5);
  });

  it('records an alert when it comes on and when it goes away', () => {
    // 4.5 km out is past 80% of the 5 km walk-back limit, and back inside on the way home.
    const far = [destination(base, 0, 4500)];
    const total = walkProgress(base, far, 0, DOSE).totalHours;
    const log = walkLog(base, far, total + 1, options);
    const near = log.filter(
      (entry) =>
        (entry.kind === 'alert' || entry.kind === 'alert-over') &&
        entry.alert === 'near-walk-back-limit',
    );

    expect(near.map((entry) => entry.kind)).toEqual(['alert', 'alert-over']);
    // 4 km at 2.5 km/h is 1.6 h, found within a look of half a minute.
    expect(near[0].atHours).toBeGreaterThanOrEqual(1.6);
    expect(near[0].atHours).toBeLessThan(1.62);
    expect(near[1].atHours).toBeGreaterThan(near[0].atHours);
  });

  it('records the link dropping and coming back', () => {
    // No line of sight more than 600 m north of the base.
    const linkDownAt = (position: { lat: number; lon: number }) =>
      distance(base, position) > 600 && position.lon < base.lon + 0.001;
    const log = walkLog(base, [first], 10, { ...options, linkDownAt });

    expect(kinds(log).filter((kind) => kind.startsWith('link'))).toEqual(['link-lost', 'link-back']);
    expect(at(log, 'link-lost')[0]).toBeCloseTo(0.24, 1);
  });

  it('leaves out a loss of link that is undone at the very next look', () => {
    // Down for one look of half a minute, 500 m out: a line grazing the ground, not an event.
    const blip = (position: { lat: number; lon: number }) => {
      const out = distance(base, position);
      return out > 500 && out < 515;
    };
    const log = walkLog(base, [first], 0.3, { ...options, linkDownAt: blip });
    expect(kinds(log).some((kind) => kind.startsWith('link'))).toBe(false);
  });

  it('keeps the link as it was while it cannot be told', () => {
    const log = walkLog(base, [first], 10, { ...options, linkDownAt: () => null });
    expect(kinds(log).some((kind) => kind.startsWith('link'))).toBe(false);
  });

  it('weaves the messages in at their times', () => {
    let messages = withMessage([], 'a', 'Return to the base', 0.2);
    messages = withShown(messages, 0.21);
    messages = withAcknowledged(messages, 'a', 0.25);
    const log = walkLog(base, route, 0.3, { ...options, messages });

    expect(kinds(log)).toEqual(['start', 'message-sent', 'message-shown', 'message-acknowledged']);
    const sent = log[1];
    expect(sent.kind === 'message-sent' && sent.text).toBe('Return to the base');
  });

  it('leaves out what has not happened yet', () => {
    let messages = withMessage([], 'a', 'Hold your position', 0.2);
    messages = withShown(messages, 0.6);
    expect(kinds(walkLog(base, route, 0.3, { ...options, messages }))).toEqual([
      'start',
      'message-sent',
    ]);
  });

  it('is in order of time', () => {
    const total = walkProgress(base, route, 0, DOSE).totalHours;
    const log = walkLog(base, route, total, options);
    for (let i = 1; i < log.length; i += 1) {
      expect(log[i].atHours).toBeGreaterThanOrEqual(log[i - 1].atHours);
    }
  });
});
