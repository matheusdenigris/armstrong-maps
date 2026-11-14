import Slider from '@react-native-community/slider';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LayerKind, MapLayer } from '@/data/layers';
import type { PointSet, PointSetId } from '@/data/mission-points';
import { formatShare } from '@/mission/format';

import { POINT_COLORS } from './mission-points';

/** One set of mission points of the site, and what the map has of it. */
export type PointSetRow = {
  set: PointSet;
  on: boolean;
  /** Where the file of the set stands. A set that is off has not been asked for. */
  status: 'off' | 'loading' | 'ready' | 'failed';
  /** How many places of the set are on the map. */
  count: number;
};

type LayerPanelProps = {
  /** The optical mosaics of the site. They are the base of the map and are always on. */
  base: readonly MapLayer[];
  /** Layers that can be drawn over the base. */
  overlays: readonly MapLayer[];
  /** Opacity of each overlay that is on, by layer id. */
  active: Readonly<Record<string, number>>;
  onToggle: (id: string) => void;
  onOpacity: (id: string, opacity: number) => void;
  /** The sets of published places of the site. A site without any leaves the group out. */
  points?: readonly PointSetRow[];
  onTogglePoints?: (id: PointSetId) => void;
};

/** What the map has of a set that is on, in words. A gap is said, never filled. */
function pointState({ status, count }: PointSetRow): string {
  if (status === 'loading') return 'Fetching the file from NASA';
  if (status === 'failed') return 'The file did not answer, so nothing is drawn';
  if (count === 0) return 'The file has no place the app can read';
  return `${count} on the map`;
}

const KINDS: { kind: LayerKind; title: string; color: string }[] = [
  { kind: 'topographic', title: 'TOPOGRAPHIC', color: Colors.topographic },
  { kind: 'thermal', title: 'THERMAL', color: Colors.thermal },
  { kind: 'spectral', title: 'SPECTRAL', color: Colors.spectral },
];

const LAYER_CONTROL_TRANSITION_MS = 160;
const LAYER_LAYOUT_TRANSITION = LinearTransition.duration(LAYER_CONTROL_TRANSITION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

/** The layers of the map by kind of data, with a switch and adjustable opacity for each overlay. */
export function LayerPanel({
  base,
  overlays,
  active,
  onToggle,
  onOpacity,
  points = [],
  onTogglePoints,
}: LayerPanelProps) {
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

      {points.length > 0 ? (
        <View style={styles.group}>
          <CategoryHeading title="MISSION POINTS" color={Colors.cyan} />
          {points.map((row) => {
            const { set, on } = row;
            const color = POINT_COLORS[set.id];
            return (
              <Animated.View
                key={set.id}
                layout={LAYER_LAYOUT_TRANSITION}
                style={[styles.layer, on && styles.layerOn]}>
                <Pressable
                  onPress={() => onTogglePoints?.(set.id)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${set.name}, ${set.source}`}
                  style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
                  <LayerSwitch on={on} color={color} />
                  <View style={styles.text}>
                    <Text style={styles.name}>{set.name}</Text>
                    <Text style={[styles.source, { color }]}>{set.source}</Text>
                  </View>
                </Pressable>
                <Text style={styles.reads}>{set.reads}</Text>
                {on ? <Text style={styles.pointState}>{pointState(row)}</Text> : null}
              </Animated.View>
            );
          })}
        </View>
      ) : null}

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
                <Animated.View
                  key={layer.id}
                  layout={LAYER_LAYOUT_TRANSITION}
                  style={[styles.layer, on && styles.layerOn]}>
                  <Pressable
                    onPress={() => onToggle(layer.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${layer.name}, ${layer.source}`}
                    style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
                    <LayerSwitch on={on} color={color} />
                    <View style={styles.text}>
                      <Text style={styles.name}>{layer.name}</Text>
                      <Text style={[styles.source, { color }]}>{layer.source}</Text>
                    </View>
                  </Pressable>
                  <Text style={styles.reads}>{layer.reads}</Text>
                  {on ? (
                    <View style={styles.opacity}>
                      <View style={styles.opacityHeading}>
                        <Text style={styles.opacityLabel}>Opacity</Text>
                        <Text style={styles.opacityValue}>{formatShare(opacity)}</Text>
                      </View>
                      <Slider
                        accessibilityLabel={`${layer.name} opacity`}
                        accessibilityValue={{
                          min: 0,
                          max: 100,
                          now: Math.round(opacity * 100),
                          text: formatShare(opacity),
                        }}
                        minimumValue={0}
                        maximumValue={1}
                        step={0.01}
                        value={opacity}
                        onValueChange={(value) => onOpacity(layer.id, value)}
                        minimumTrackTintColor={color}
                        maximumTrackTintColor={Colors.glassBorder}
                        thumbTintColor={Colors.text}
                        style={styles.slider}
                      />
                    </View>
                  ) : null}
                </Animated.View>
              );
            })}
          </View>
        );
      })}

      <Text style={styles.credit}>
        Every map layer is served by NASA/JPL Mars Trek. A layer is blank where its instrument has
        no coverage.
      </Text>
    </View>
  );
}

function LayerSwitch({ on, color }: { on: boolean; color: string }) {
  const progress = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(on ? 1 : 0, {
      duration: LAYER_CONTROL_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [on, progress]);

  const switchStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [Colors.glassBorder, color]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  return (
    <Animated.View style={[styles.switch, switchStyle]}>
      <Animated.View style={[styles.knob, knobStyle]} />
    </Animated.View>
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
  pointState: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  opacity: {
    gap: Spacing.half,
    paddingTop: Spacing.one,
  },
  opacityHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opacityLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  opacityValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  slider: {
    height: 36,
    marginHorizontal: -Spacing.one,
  },
  credit: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: Spacing.two,
  },
});
