import { describe, expect, it } from 'vitest';

import {
  MESSAGE_MAX_LENGTH,
  cleanMessage,
  messageState,
  messageToAcknowledge,
  withAcknowledged,
  withMessage,
  withShown,
  type ShipMessage,
} from './messages';

const none: readonly ShipMessage[] = [];

describe('cleanMessage', () => {
  it('makes one trimmed line of what was typed', () => {
    expect(cleanMessage('  Return   to\nthe base  ')).toBe('Return to the base');
  });

  it('cuts a long text to a line', () => {
    expect(cleanMessage('x'.repeat(400))).toHaveLength(MESSAGE_MAX_LENGTH);
  });

  it('has nothing to send from blanks', () => {
    expect(cleanMessage('   \n ')).toBeNull();
  });
});

describe('a message from the ship', () => {
  it('starts as sent, not shown and not acknowledged', () => {
    const [message] = withMessage(none, 'a', 'Hold your position', 0.5);

    expect(message).toEqual({
      id: 'a',
      text: 'Hold your position',
      sentHours: 0.5,
      shownHours: null,
      ackHours: null,
    });
    expect(messageState(message, false)).toBe('sent');
  });

  it('is not added when there is nothing to say', () => {
    expect(withMessage(none, 'a', '   ', 0.5)).toBe(none);
  });

  it('waits while the link is down', () => {
    const [message] = withMessage(none, 'a', 'Return to the base', 1);
    expect(messageState(message, true)).toBe('waiting-for-link');
  });

  it('is shown once, at the time the visor first has it', () => {
    const sent = withMessage(none, 'a', 'Return to the base', 1);
    const shown = withShown(sent, 1.02);
    const again = withShown(shown, 1.5);

    expect(shown[0].shownHours).toBe(1.02);
    expect(messageState(shown[0], false)).toBe('shown');
    // Nothing new to show: the list is the same, so nothing is saved again.
    expect(again).toBe(shown);
  });

  it('is never shown before it was sent', () => {
    const sent = withMessage(none, 'a', 'Return to the base', 1);
    expect(withShown(sent, 0.9)[0].shownHours).toBe(1);
  });

  it('is acknowledged only after it was shown, and only once', () => {
    const sent = withMessage(none, 'a', 'Return to the base', 1);
    expect(withAcknowledged(sent, 'a', 1.1)).toBe(sent);

    const shown = withShown(sent, 1.02);
    const done = withAcknowledged(shown, 'a', 1.05);
    expect(done[0].ackHours).toBe(1.05);
    expect(messageState(done[0], false)).toBe('acknowledged');
    expect(withAcknowledged(done, 'a', 2)).toBe(done);
    expect(withAcknowledged(shown, 'other', 1.05)).toBe(shown);
  });
});

describe('messageToAcknowledge', () => {
  it('is the oldest message shown and still waiting', () => {
    let list = withMessage(none, 'a', 'Hold your position', 1);
    list = withMessage(list, 'b', 'Return to the base', 1.1);
    expect(messageToAcknowledge(list)).toBeNull();

    list = withShown(list, 1.2);
    expect(messageToAcknowledge(list)?.id).toBe('a');

    list = withAcknowledged(list, 'a', 1.3);
    expect(messageToAcknowledge(list)?.id).toBe('b');

    list = withAcknowledged(list, 'b', 1.4);
    expect(messageToAcknowledge(list)).toBeNull();
  });
});
