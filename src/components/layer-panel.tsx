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
      <PanelHeading title="Map layers" />
      <CategoryHeading title="OPTICAL · ALWAYS ON" color={Colors.nav} />
      {base.map((layer) => (
        <View key={layer.id} style={styles.layer}>
          <View style={styles.layerTop}>
            <View style={styles.text}>
              <Text style={styles.name}>{layer.name}</Text>
              <Text style={[styles.source, { color: Colors.nav }]}>{layer.source}</Text>
            </View>
            <Text style={styles.baseState}>Always on</Text>
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
                  style={[styles.layer, on && styles.layerOn]}>
                  <Pressable
                    onPress={() => onToggle(layer.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${layer.name}, ${layer.source}`}
                    style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
                    <View style={[styles.switch, on && { backgroundColor: color }]}>
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

function PanelHeading({ title }: { title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelTitle}>{title}</Text>
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
    paddingTop: Spacing.one,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kind: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  categoryMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  layer: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  layerOn: {
    backgroundColor: Colors.glassHover,
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
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: Spacing.half,
    backgroundColor: Colors.glassBorder,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
  },
  knobOn: {
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
    lineHeight: 20,
  },
  source: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  baseState: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  reads: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  opacity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  opacityLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    paddingRight: Spacing.two,
  },
  step: {
    minWidth: 52,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  stepChosen: {
    backgroundColor: Colors.text,
  },
  stepText: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  stepTextChosen: {
    color: Colors.background,
  },
  credit: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: Spacing.two,
  },
});
