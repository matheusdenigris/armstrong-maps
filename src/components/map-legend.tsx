import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LayerLegend, MapLayer } from '@/data/layers';

type MapLegendProps = {
  /** The layers that are on over the base. Those without a colour key are skipped. */
  layers: readonly MapLayer[];
  /** On a phone the science reference is left to the layer panel, to save room on the map. */
  compact?: boolean;
};

/**
 * The key to the colours of the layers that are on, drawn on the map itself: a colour over the
 * ground means nothing without what it measures and which end is high.
 */
export function MapLegend({ layers, compact = false }: MapLegendProps) {
  const keyed = layers.filter((layer) => layer.legend !== undefined);
  if (keyed.length === 0) return null;
  return (
    <View style={styles.stack} accessibilityRole="list">
      {keyed.map((layer) =>
        layer.legend ? (
          <Key key={layer.id} name={layer.name} legend={layer.legend} compact={compact} />
        ) : null,
      )}
    </View>
  );
}

type KeyProps = { name: string; legend: LayerLegend; compact: boolean };

function Key({ name, legend, compact }: KeyProps) {
  const measures = legend.unit ? `${legend.quantity} · ${legend.unit}` : legend.quantity;
  // A browser blends the colours into a ramp; elsewhere they are laid side by side.
  const blended =
    Platform.OS === 'web'
      ? ({ backgroundImage: `linear-gradient(90deg, ${legend.colors.join(', ')})` } as ViewStyle)
      : null;
  return (
    <View
      style={styles.key}
      accessible
      accessibilityLabel={`${name}. ${measures}. From ${legend.low} to ${legend.high}.${legend.range ? ` ${legend.range}.` : ''}`}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {/* Some layers are named after what they measure: once is enough. */}
      {measures.toLowerCase() === name.toLowerCase() ? null : (
        <Text style={styles.measures} numberOfLines={2}>
          {measures}
        </Text>
      )}
      <View style={[styles.ramp, blended]}>
        {blended
          ? null
          : legend.colors.map((color) => (
              <View key={color} style={[styles.step, { backgroundColor: color }]} />
            ))}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end} numberOfLines={2}>
          {legend.low}
        </Text>
        <Text style={[styles.end, styles.endHigh]} numberOfLines={2}>
          {legend.high}
        </Text>
      </View>
      {legend.range ? <Text style={styles.range}>{legend.range}</Text> : null}
      {compact ? null : (
        <Text style={styles.source} numberOfLines={2}>
          {legend.source}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
  key: {
    width: 228,
    maxWidth: '100%',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  measures: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  ramp: {
    flexDirection: 'row',
    height: 8,
    marginTop: Spacing.half,
    borderRadius: 4,
    overflow: 'hidden',
  },
  step: {
    flex: 1,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  end: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
  },
  endHigh: {
    textAlign: 'right',
  },
  range: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  source: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 13,
  },
});
