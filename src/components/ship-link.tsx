import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionHeading } from '@/components/console-parts';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatClock, formatDistance } from '@/mission/format';
import { LINK_ASSUMPTIONS } from '@/mission/line-of-sight';
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_PRIORITIES,
  QUICK_MESSAGES,
  cleanMessage,
  messageState,
  priorityOf,
  type MessagePriority,
  type ShipMessage,
} from '@/mission/messages';
import type { Sight } from '@/state/use-walk-record';

type ShipLinkProps = {
  sight: Sight;
  messages: readonly ShipMessage[];
  onSend: (text: string, priority: MessagePriority) => void;
};

/** How each priority is named and coloured, at the console and in the visor. */
export const PRIORITY_LABEL: Record<MessagePriority, string> = {
  routine: 'Routine',
  attention: 'Attention',
  urgent: 'Urgent',
};
export const PRIORITY_COLOR: Record<MessagePriority, string> = {
  routine: Colors.nav,
  attention: Colors.caution,
  urgent: Colors.noGo,
};

function stateText(message: ShipMessage, linkDown: boolean): string {
  switch (messageState(message, linkDown)) {
    case 'acknowledged':
      return `Acknowledged ${formatClock(message.ackHours ?? 0)}`;
    case 'shown':
      return `Shown in the visor ${formatClock(message.shownHours ?? 0)}`;
    case 'waiting-for-link':
      return 'Waiting for line of sight';
    case 'sent':
      return 'Sent, not shown yet';
  }
}

/**
 * The link between the ship and the astronaut during a walk: whether they can see each other
 * over the ground, and the short messages the ship sends. A message waits while the line of
 * sight is blocked, and the visor shows it when the link is back.
 */
export function ShipLink({ sight, messages, onSend }: ShipLinkProps) {
  const [draft, setDraft] = useState('');
  // How serious the message being written is: the visor sounds and colours it by this.
  const [priority, setPriority] = useState<MessagePriority>('routine');
  const linkDown = sight.status === 'ready' && !sight.line.clear;
  const ready = cleanMessage(draft) !== null;

  const send = (text: string, as: MessagePriority) => {
    if (cleanMessage(text) === null) return;
    onSend(text, as);
    setDraft('');
  };

  const heading =
    sight.status === 'ready'
      ? sight.line.clear
        ? 'SHIP LINK · LINE OF SIGHT'
        : 'SHIP LINK · NO LINE OF SIGHT'
      : 'SHIP LINK · NOT CHECKED';
  const color =
    sight.status === 'ready' ? (sight.line.clear ? Colors.go : Colors.caution) : Colors.textMuted;

  return (
    <View style={styles.block}>
      <SectionHeading title={heading} color={color} />
      <View style={styles.card}>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {sight.status === 'ready'
            ? sight.line.clear
              ? `The base sees the astronaut, ${formatDistance(sight.line.lengthM)} away. The line clears the ground by ${Math.max(0, sight.line.clearanceM).toFixed(1)} m at its tightest.`
              : `The ground is in the way ${formatDistance(sight.line.tightestAtM)} from the base, by ${Math.abs(sight.line.clearanceM).toFixed(1)} m. Messages wait until the astronaut is in sight again.`
            : sight.status === 'loading'
              ? 'Reading the elevation model to check the line of sight.'
              : 'The elevation model has no answer here, so the line of sight is not checked.'}
        </Text>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft, priority)}
            placeholder="Message to the astronaut"
            placeholderTextColor={Colors.textFaint}
            maxLength={MESSAGE_MAX_LENGTH}
            returnKeyType="send"
            accessibilityLabel="Message to the astronaut"
            style={styles.input}
          />
          <Pressable
            onPress={() => send(draft, priority)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Send the message to the astronaut"
            accessibilityState={{ disabled: !ready }}
            style={({ pressed }) => [
              styles.send,
              !ready && styles.sendDisabled,
              pressed && ready && styles.pressed,
            ]}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>

        <View style={styles.priorities} accessibilityRole="radiogroup">
          <Text style={styles.priorityLabel}>Priority</Text>
          {MESSAGE_PRIORITIES.map((option) => {
            const chosen = option === priority;
            return (
              <Pressable
                key={option}
                onPress={() => setPriority(option)}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                accessibilityLabel={`Priority of the message: ${PRIORITY_LABEL[option]}`}
                style={[styles.priority, chosen && styles.priorityChosen]}>
                <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[option] }]} />
                <Text style={[styles.priorityText, chosen && styles.priorityTextChosen]}>
                  {PRIORITY_LABEL[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ready-made messages go out with the priority that suits them. */}
        <View style={styles.quick}>
          {QUICK_MESSAGES.map((quick) => (
            <Pressable
              key={quick.text}
              onPress={() => send(quick.text, quick.priority)}
              accessibilityRole="button"
              accessibilityLabel={`Send, ${PRIORITY_LABEL[quick.priority]}: ${quick.text}`}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <View
                style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[quick.priority] }]}
              />
              <Text style={styles.chipText}>{quick.text}</Text>
            </Pressable>
          ))}
        </View>

        {messages.length > 0 ? (
          <View style={styles.sent}>
            {/* The newest first: it is the one whose state is changing. */}
            {[...messages].reverse().map((message) => (
              <View key={message.id} style={styles.message}>
                <View style={styles.messageHead}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_COLOR[priorityOf(message)] },
                    ]}
                  />
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
                <Text style={styles.messageState}>
                  {`${PRIORITY_LABEL[priorityOf(message)]} · sent ${formatClock(message.sentHours)} · ${stateText(message, linkDown)}`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.note}>
          Line of sight from a {LINK_ASSUMPTIONS.baseAntennaM} m mast at the base to an antenna{' '}
          {LINK_ASSUMPTIONS.suitAntennaM} m up on the suit, over the NASA elevation model and the
          curve of the planet. The antenna heights are assumptions of this project
          {sight.status === 'ready'
            ? `, and the model gives one height for each ${formatDistance(sight.cellM)} of ground, so a boulder or a low bank does not show`
            : ''}
          . The signal itself takes microseconds over these distances: there is no delay to show.
        </Text>
      </View>
    </View>
  );
}

/**
 * The same card before a walk: there is nobody to talk to yet, so it says what the link will
 * do, where someone looking for it finds it.
 */
export function ShipLinkIdle() {
  return (
    <View style={styles.block}>
      <SectionHeading title="SHIP LINK · OPENS WITH THE WALK" color={Colors.textMuted} />
      <View style={styles.card}>
        <Text style={styles.status}>
          Start a walk and this shows whether the base sees the astronaut over the ground, and
          lets the ship send short messages. The visor shows each one until the astronaut
          acknowledges it.
        </Text>
        <Text style={styles.note}>
          Line of sight from a {LINK_ASSUMPTIONS.baseAntennaM} m mast at the base to an antenna{' '}
          {LINK_ASSUMPTIONS.suitAntennaM} m up on the suit, over the NASA elevation model. The
          antenna heights are assumptions of this project.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    gap: Spacing.two + Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  status: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  send: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassHover,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.76,
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  priorities: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  priorityLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginRight: Spacing.one,
  },
  priority: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    minHeight: 32,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  priorityChosen: {
    backgroundColor: Colors.text,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  priorityTextChosen: {
    color: Colors.background,
  },
  messageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  chipText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  sent: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  message: {
    gap: Spacing.half,
  },
  messageText: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
  },
  messageState: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  note: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
});
