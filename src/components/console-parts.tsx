import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** The numbered title of a panel of the ship console, with a rule to the edge. */
export function PanelHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelNumber}>{number}</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.panelRule} />
    </View>
  );
}

/** The title of a section inside a panel, with a marker in the colour of its subject. */
export function SectionHeading({ title, color }: { title: string; color: string }) {
  return (
    <View style={styles.heading} accessible accessibilityRole="header">
      <View style={[styles.headingMarker, { backgroundColor: color }]} />
      <Text style={styles.headingText}>{title}</Text>
    </View>
  );
}

/** One line about the state of a feed: waiting, failed, or empty. */
export function StatusNote({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.statusNote, { borderLeftColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  panelNumber: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  panelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingMarker: {
    width: 8,
    height: 8,
    borderRadius: Radius.small,
  },
  headingText: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.small,
    marginTop: Spacing.one + Spacing.half,
  },
  statusText: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
