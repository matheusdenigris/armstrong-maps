import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { MissionPoint, PointSet, PointSetId } from '@/data/mission-points';
import { formatLatLon } from '@/mission/format';

/** The colour of each set of mission points, on the map and wherever the set is named. */
export const POINT_COLORS: Readonly<Record<PointSetId, string>> = {
  samples: Colors.cyan,
  depot: Colors.spectral,
  flights: Colors.thermal,
};

type PointsKeyProps = {
  /** The sets that are drawn on the map now. */
  sets: readonly PointSet[];
};

/** The key to the marks of the mission points that are on the map. */
export function PointsKey({ sets }: PointsKeyProps) {
  if (sets.length === 0) return null;
  return (
    <View
      style={styles.key}
      accessible
      accessibilityLabel={`Mission points on the map: ${sets.map((set) => set.name).join(', ')}. Published by NASA.`}>
      {sets.map((set) => (
        <View key={set.id} style={styles.keyRow}>
          <View style={[styles.keyDot, { backgroundColor: POINT_COLORS[set.id] }]} />
          <Text style={styles.keyName} numberOfLines={1}>
            {set.name}
          </Text>
        </View>
      ))}
      <Text style={styles.keyNote}>Positions published by NASA</Text>
    </View>
  );
}

type PointCardProps = {
  point: MissionPoint;
  set: PointSet;
  /** Adds the place to the walk. Absent while the route cannot change. */
  onAdd?: () => void;
  onClose: () => void;
};

/** What NASA published about one mission point, shown beside its mark on the map. */
export function PointCard({ point, set, onAdd, onClose }: PointCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.keyDot, { backgroundColor: POINT_COLORS[set.id] }]} />
        <Text style={styles.cardSet} numberOfLines={1}>
          {set.name}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${point.name}`}
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.cardName}>{point.name}</Text>
      {point.lines.map((line) => (
        <Text key={line} style={styles.cardLine}>
          {line}
        </Text>
      ))}
      <Text style={styles.cardPlace}>{formatLatLon(point.point, 5)}</Text>
      <Text style={styles.cardSource}>{set.source}</Text>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${point.name} to the walk`}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Text style={styles.addText}>Add to the walk</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  key: {
    gap: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  keyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  keyName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  keyNote: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 13,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardSet: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  closePressed: {
    backgroundColor: Colors.glassHover,
  },
  closeText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 18,
  },
  cardName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  cardLine: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  cardPlace: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
    paddingTop: Spacing.one,
  },
  cardSource: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  add: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
  },
  addPressed: {
    opacity: 0.82,
  },
  addText: {
    color: Colors.background,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
});
