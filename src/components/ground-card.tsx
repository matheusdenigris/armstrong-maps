import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { TERRAIN_CREDIT } from '@/data/terrain';
import { formatDistance, formatHeight, formatHeightFrom, formatLatLon } from '@/mission/format';
import { classifySlope, type SlopeLimits } from '@/mission/terrain';
import type { GroundReading } from '@/state/use-ground-reading';

/** The slope of the cell under the point, and the size of that cell. */
export type GroundSlope = { degrees: number; cellM: number };

type GroundCardProps = {
  reading: GroundReading;
  /** Null where no slope grid of the site covers the point, or while none has arrived. */
  slope: GroundSlope | null;
  limits: SlopeLimits;
  /** Adds the point to the walk. Absent while the route cannot change. */
  onAdd?: () => void;
  onClose: () => void;
};

const SLOPE_WORD = { ok: 'clear', caution: 'caution', 'no-go': 'no-go' } as const;
const SLOPE_COLOR = { ok: Colors.go, caution: Colors.caution, 'no-go': Colors.noGo } as const;

/**
 * What the elevation models say about a point the person pressed: its height, how far up or down
 * it is from the base, and the slope of the ground there. Each number names its model. Where no
 * model has a value, the card says so; it never estimates one.
 */
export function GroundCard({ reading, slope, limits, onAdd, onClose }: GroundCardProps) {
  const { height, baseMetres, point } = reading;
  const steepness = slope ? classifySlope(slope.degrees, limits) : null;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.dot} />
        <Text style={styles.kind} numberOfLines={1}>
          Ground at this point
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the reading of this point"
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {height.status === 'ready' ? (
        <>
          <Text style={styles.value} accessibilityLabel={`Elevation ${formatHeight(height.metres)}`}>
            {formatHeight(height.metres)}
          </Text>
          {baseMetres !== null ? (
            <Text style={styles.line}>{formatHeightFrom(height.metres - baseMetres, 'the base')}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.line}>
          {height.status === 'loading'
            ? 'Reading the elevation model.'
            : height.status === 'failed'
              ? 'The elevation service did not answer. No height to show.'
              : 'No elevation model has a height at this point.'}
        </Text>
      )}

      {slope && steepness ? (
        <View style={styles.slope}>
          <View style={[styles.slopeDot, { backgroundColor: SLOPE_COLOR[steepness] }]} />
          <Text style={styles.slopeText}>
            Slope <Text style={styles.number}>{slope.degrees.toFixed(1)}°</Text> ·{' '}
            {SLOPE_WORD[steepness]}, over {formatDistance(slope.cellM)}
          </Text>
        </View>
      ) : (
        <Text style={styles.line}>No slope here: the terrain model has no cell under this point.</Text>
      )}

      <Text style={styles.place}>{formatLatLon(point, 5)}</Text>
      <Text style={styles.source}>
        {height.status === 'ready'
          ? `${height.model.name}, ${formatDistance(height.model.resolutionM)} a pixel. ${TERRAIN_CREDIT}. The height is as the model gives it.`
          : `${TERRAIN_CREDIT}.`}{' '}
        Temperature, dust and minerals cannot be read at a point: Mars Trek serves those layers as
        pictures, without values.
      </Text>

      {onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add this point to the walk"
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Text style={styles.addText}>Add to the walk</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.cyan,
  },
  kind: {
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
  value: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 24,
    lineHeight: 30,
  },
  line: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  slope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.half,
  },
  slopeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slopeText: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  number: {
    fontFamily: Fonts.mono,
  },
  place: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
    paddingTop: Spacing.one,
  },
  source: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  add: {
    alignSelf: 'flex-start',
    minHeight: 40,
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
