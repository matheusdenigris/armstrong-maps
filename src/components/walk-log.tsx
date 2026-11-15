import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionHeading } from '@/components/console-parts';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatClock } from '@/mission/format';
import { alertLevel } from '@/mission/safety';
import type { LogEntry } from '@/mission/walk-log';

import { describeEntry } from './walk-log-text';

type WalkLogProps = {
  /** The walk is still going on: the log grows. */
  live: boolean;
  entries: readonly LogEntry[];
  onExport: () => void;
};

const DOT: Partial<Record<LogEntry['kind'], string>> = {
  'link-lost': Colors.caution,
  'link-back': Colors.go,
  'back-at-base': Colors.go,
  'ended-early': Colors.textMuted,
};

function dotColor(entry: LogEntry): string {
  if (entry.kind === 'alert') {
    return alertLevel(entry.alert) === 'warning' ? Colors.noGo : Colors.caution;
  }
  if (entry.kind.startsWith('message')) return Colors.nav;
  return DOT[entry.kind] ?? Colors.textSoft;
}

/**
 * The record of a walk, newest entry last, with a button that hands it over as a text file. It
 * is shown while the walk runs and stays, as the last walk, after it ends.
 */
export function WalkLog({ live, entries, onExport }: WalkLogProps) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionHeading
        title={live ? 'WALK LOG · IN PROGRESS' : 'WALK LOG · LAST WALK'}
        color={live ? Colors.go : Colors.textMuted}
      />
      <View style={styles.card}>
        {entries.map((entry, index) => (
          <View key={`${entry.kind}-${entry.atHours}-${index}`} style={styles.entry}>
            <Text style={styles.time}>{formatClock(entry.atHours)}</Text>
            <View style={[styles.dot, { backgroundColor: dotColor(entry) }]} />
            <Text style={styles.text}>{describeEntry(entry)}</Text>
          </View>
        ))}
        <Pressable
          onPress={onExport}
          accessibilityRole="button"
          accessibilityLabel="Export the walk log as a text file"
          style={({ pressed }) => [styles.export, pressed && styles.exportPressed]}>
          <Text style={styles.exportText}>Export the log</Text>
        </Pressable>
        <Text style={styles.note}>
          A simulated walk: times are walk time since leaving the base, and the entries follow the
          plan. Only the messages were typed by someone.
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
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  time: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  text: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  export: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassHover,
  },
  exportPressed: {
    opacity: 0.76,
  },
  exportText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  note: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
});
