import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** The title of a panel of the ship console. */
export function PanelHeading({ title }: { title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelTitle}>{title}</Text>
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
    paddingTop: Spacing.one,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headingText: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.one + Spacing.half,
  },
  statusText: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
