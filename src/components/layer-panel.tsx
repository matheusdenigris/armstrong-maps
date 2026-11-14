import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LayerKind, MapLayer } from '@/data/layers';
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

const KINDS: { kind: LayerKind; title: string; color: string }[] = [
  { kind: 'topographic', title: 'TOPOGRAPHIC', color: Colors.topographic },
  { kind: 'thermal', title: 'THERMAL', color: Colors.thermal },
  { kind: 'spectral', title: 'SPECTRAL', color: Colors.spectral },
];

const OPACITIES = [0.25, 0.5, 0.75, 1];

/** The layers of the map by kind of data, with a switch and an opacity for each overlay. */
export function LayerPanel({ base, overlays, active, onToggle, onOpacity }: LayerPanelProps) {
  return (
    <View style={styles.panel}>
      <PanelHeading number="02" title="MAP LAYERS" />
      <CategoryHeading title="OPTICAL · ALWAYS ON" color={Colors.nav} />
      {base.map((layer) => (
        <View key={layer.id} style={[styles.layer, { borderLeftColor: Colors.nav }]}>
          <View style={styles.layerTop}>
            <View style={styles.text}>
              <Text style={styles.name}>{layer.name}</Text>
              <Text style={[styles.source, { color: Colors.nav }]}>{layer.source}</Text>
            </View>
            <Text style={styles.baseState}>BASE</Text>
          </View>
          <Text style={styles.reads}>{layer.reads}</Text>
        </View>
      ))}

      {KINDS.map(({ kind, title, color }) => {
        const group = overlays.filter((layer) => layer.kind === kind);
        if (group.length === 0) return null;
        return (
          <View key={kind} style={styles.group}>
            <CategoryHeading title={title} color={color} />
            {group.map((layer) => {
              const opacity = active[layer.id];
              const on = opacity !== undefined;
              return (
                <View
                  key={layer.id}
                  style={[
                    styles.layer,
                    { borderLeftColor: color },
                    on && styles.layerOn,
                    on && { borderColor: color },
                  ]}>
                  <Pressable
                    onPress={() => onToggle(layer.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${layer.name}, ${layer.source}`}
                    style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
                    <View style={[styles.switch, { borderColor: color }, on && { backgroundColor: color }]}>
                      <View style={[styles.knob, on && styles.knobOn]} />
                    </View>
                    <View style={styles.text}>
                      <Text style={styles.name}>{layer.name}</Text>
                      <Text style={[styles.source, { color }]}>{layer.source}</Text>
                    </View>
                  </Pressable>
                  <Text style={styles.reads}>{layer.reads}</Text>
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
                            style={[
                              styles.step,
                              chosen && styles.stepChosen,
                              chosen && { borderColor: color },
                            ]}>
                            <Text style={[styles.stepText, chosen && { color }]}>
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

function PanelHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelNumber}>{number}</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.panelRule} />
    </View>
  );
}

function CategoryHeading({ title, color }: { title: string; color: string }) {
  return (
    <View style={styles.categoryHeading} accessible accessibilityRole="header">
      <View style={[styles.categoryMarker, { backgroundColor: color }]} />
      <Text style={styles.kind}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  group: {
    gap: Spacing.two,
  },
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
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kind: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  categoryMarker: {
    width: 8,
    height: 8,
    borderRadius: Radius.small,
  },
  layer: {
    gap: Spacing.two,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  layerOn: {
    backgroundColor: Colors.surfaceRaised,
  },
  layerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  togglePressed: {
    opacity: 0.76,
  },
  switch: {
    width: 34,
    height: 20,
    borderRadius: Radius.small,
    padding: Spacing.half,
    backgroundColor: Colors.border,
    borderWidth: 1,
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: Radius.small,
    backgroundColor: Colors.textMuted,
  },
  knobOn: {
    backgroundColor: Colors.text,
    marginLeft: 14,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  source: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  baseState: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.nav,
  },
  reads: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  opacity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  opacityLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingRight: Spacing.two,
  },
  step: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stepChosen: {
    backgroundColor: Colors.surface,
  },
  stepText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  credit: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
