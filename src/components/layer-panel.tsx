import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LayerKind, LayerLegend, MapLayer } from '@/data/layers';
import { formatShare } from '@/mission/format';

type LayerPanelProps = {
  /** The optical mosaics of the site. They are the base of the map and are always on. */
  base: readonly MapLayer[];
  /** Layers that can be drawn over the base. */
  overlays: readonly MapLayer[];
  /** Opacity of each overlay that is on, by layer id. */
  active: Readonly<Record<string, number>>;
  onToggle: (id: string) => void;
  onOpacity: (id: string, opacity: number) => void;
};

const KINDS: { kind: LayerKind; title: string }[] = [
  { kind: 'topographic', title: 'TOPOGRAPHIC' },
  { kind: 'thermal', title: 'THERMAL' },
  { kind: 'spectral', title: 'SPECTRAL' },
];

const OPACITIES = [0.25, 0.5, 0.75, 1];

/** The layers of the map by kind of data, with a switch and an opacity for each overlay. */
export function LayerPanel({ base, overlays, active, onToggle, onOpacity }: LayerPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.kind} accessibilityRole="header">
        OPTICAL · ALWAYS ON
      </Text>
      {base.map((layer) => (
        <View key={layer.id} style={styles.layer}>
          <Text style={styles.name}>{layer.name}</Text>
          <Text style={styles.source}>{layer.source}</Text>
          <Text style={styles.reads}>{layer.reads}</Text>
        </View>
      ))}

      {KINDS.map(({ kind, title }) => {
        const group = overlays.filter((layer) => layer.kind === kind);
        if (group.length === 0) return null;
        return (
          <View key={kind} style={styles.group}>
            <Text style={styles.kind} accessibilityRole="header">
              {title}
            </Text>
            {group.map((layer) => {
              const opacity = active[layer.id];
              const on = opacity !== undefined;
              return (
                <View key={layer.id} style={[styles.layer, on && styles.layerOn]}>
                  <Pressable
                    onPress={() => onToggle(layer.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${layer.name}, ${layer.source}`}
                    style={styles.toggle}>
                    <View style={[styles.switch, on && styles.switchOn]}>
                      <View style={[styles.knob, on && styles.knobOn]} />
                    </View>
                    <View style={styles.text}>
                      <Text style={styles.name}>{layer.name}</Text>
                      <Text style={styles.source}>{layer.source}</Text>
                    </View>
                  </Pressable>
                  <Text style={styles.reads}>{layer.reads}</Text>
                  {on && layer.legend ? <LayerKey legend={layer.legend} /> : null}
                  {on ? (
                    <View style={styles.opacity} accessibilityRole="radiogroup">
                      <Text style={styles.opacityLabel}>Opacity</Text>
                      {OPACITIES.map((value) => {
                        const chosen = Math.abs(opacity - value) < 0.01;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => onOpacity(layer.id, value)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: chosen }}
                            accessibilityLabel={`${layer.name} opacity ${formatShare(value)}`}
                            style={[styles.step, chosen && styles.stepChosen]}>
                            <Text style={[styles.stepText, chosen && styles.stepTextChosen]}>
                              {formatShare(value)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      <Text style={styles.credit}>
        Every layer is served by NASA/JPL Mars Trek. A layer is blank where its instrument has no
        coverage.
      </Text>
    </View>
  );
}

/** The key to a layer's colours: the ramp, what each end means, the unit, the range and the source. */
function LayerKey({ legend }: { legend: LayerLegend }) {
  return (
    <View
      style={styles.key}
      accessible
      accessibilityLabel={`Colour key: ${legend.quantity}. ${legend.low}. ${legend.high}.`}>
      <View style={styles.ramp}>
        {legend.colors.map((color, index) => (
          <View key={index} style={[styles.rampStep, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{legend.low}</Text>
        <Text style={[styles.end, styles.endHigh]}>{legend.high}</Text>
      </View>
      <Text style={styles.keyText}>
        <Text style={styles.keyQuantity}>{legend.quantity}</Text>
        {' · '}
        {legend.unit ?? 'relative scale, no unit'}
      </Text>
      {legend.range ? <Text style={styles.keyText}>{legend.range}</Text> : null}
      <Text style={styles.keySource}>
        Source: {legend.source}.{' '}
        {legend.range
          ? 'The range is the published one; a colour on the map is an approximate value.'
          : 'Mars Trek does not publish the numeric scale of these colours.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  key: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  ramp: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  rampStep: {
    flex: 1,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  end: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  endHigh: {
    textAlign: 'right',
  },
  keyText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  keyQuantity: {
    fontWeight: '600',
  },
  keySource: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  panel: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  group: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  kind: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  layer: {
    gap: Spacing.one,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  layerOn: {
    borderColor: Colors.nav,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: Colors.border,
  },
  switchOn: {
    backgroundColor: Colors.nav,
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textMuted,
  },
  knobOn: {
    backgroundColor: Colors.text,
    marginLeft: 18,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  source: {
    color: Colors.mars,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  reads: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  opacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  opacityLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    paddingRight: Spacing.one,
  },
  step: {
    minWidth: 52,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stepChosen: {
    borderColor: Colors.nav,
    backgroundColor: 'rgba(76, 141, 255, 0.18)',
  },
  stepText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  stepTextChosen: {
    color: Colors.text,
  },
  credit: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    paddingTop: Spacing.two,
  },
});
