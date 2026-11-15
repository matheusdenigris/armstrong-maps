/**
 * Short messages from the ship to the crew member on the surface.
 *
 * A message is written at the console, shown in the visor and acknowledged there. Each step is
 * stamped with the time of the walk, so the walk log can tell the story afterwards. A message
 * cannot be shown while the link is down: it waits, and the console says so.
 */

export type ShipMessage = {
  id: string;
  text: string;
  /** Walk time when the ship sent it, in hours. */
  sentHours: number;
  /** Walk time when the visor first showed it, or null while it has not. */
  shownHours: number | null;
  /** Walk time when the crew member acknowledged it, or null while they have not. */
  ackHours: number | null;
};

/** A message is a line, not a letter. */
export const MESSAGE_MAX_LENGTH = 120;

/** What the ship most often has to say, one press away. */
export const QUICK_MESSAGES = [
  'Return to the base',
  'Hold your position',
  'Check your life support',
  'All clear, carry on',
] as const;

/** The text as it will be sent: one line, trimmed, cut to length. Null when nothing is left. */
export function cleanMessage(text: string): string | null {
  const line = text.replace(/\s+/g, ' ').trim().slice(0, MESSAGE_MAX_LENGTH).trim();
  return line.length > 0 ? line : null;
}

/** The list with a new message at its end. Text that cleans to nothing adds nothing. */
export function withMessage(
  list: readonly ShipMessage[],
  id: string,
  text: string,
  atHours: number,
): readonly ShipMessage[] {
  const line = cleanMessage(text);
  if (line === null) return list;
  return [...list, { id, text: line, sentHours: atHours, shownHours: null, ackHours: null }];
}

/** The list with every message not yet shown marked as shown now. The same list if none was. */
export function withShown(list: readonly ShipMessage[], atHours: number): readonly ShipMessage[] {
  if (list.every((message) => message.shownHours !== null)) return list;
  return list.map((message) =>
    message.shownHours === null
      ? { ...message, shownHours: Math.max(atHours, message.sentHours) }
      : message,
  );
}

/** The list with one message acknowledged. Only a message that was shown can be. */
export function withAcknowledged(
  list: readonly ShipMessage[],
  id: string,
  atHours: number,
): readonly ShipMessage[] {
  const target = list.find((message) => message.id === id);
  if (!target || target.shownHours === null || target.ackHours !== null) return list;
  return list.map((message) =>
    message.id === id ? { ...message, ackHours: Math.max(atHours, target.shownHours ?? 0) } : message,
  );
}

/** The message the visor is asking the crew member to acknowledge: the oldest one waiting. */
export function messageToAcknowledge(list: readonly ShipMessage[]): ShipMessage | null {
  return list.find((message) => message.shownHours !== null && message.ackHours === null) ?? null;
}

export type MessageState =
  /** Not shown yet, and the link is down: it cannot get through. */
  | 'waiting-for-link'
  /** Not shown yet: the visor has not picked it up. */
  | 'sent'
  | 'shown'
  | 'acknowledged';

export function messageState(message: ShipMessage, linkDown: boolean): MessageState {
  if (message.ackHours !== null) return 'acknowledged';
  if (message.shownHours !== null) return 'shown';
  return linkDown ? 'waiting-for-link' : 'sent';
}
