import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionHeading } from '@/components/console-parts';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { DUNE_CREDIT, type DuneField } from '@/data/dunes';
import { TERRAIN_CREDIT } from '@/data/terrain';
import { formatDistance } from '@/mission/format';
import type { RouteSlope } from '@/mission/terrain';
import { WALK_ASSUMPTIONS } from '@/mission/walk';
import type { Feed } from '@/state/use-feed';
import type { TerrainLayer } from '@/state/use-terrain';

type HazardPanelProps = {
  slopeOn: boolean;
  dunesOn: boolean;
  onToggleSlope: () => void;
  onToggleDunes: () => void;
  near: Feed<TerrainLayer>;
  around: Feed<TerrainLayer>;
  dunes: Feed<DuneField[]>;
  /** The steepest ground under the planned route, or null with no waypoints. */
  route: RouteSlope | null;
};

const percent = (share: number) =>
  share === 0 ? '0%' : share < 0.001 ? 'under 0.1%' : `${(share * 100).toFixed(1)}%`;

/**
 * Dangerous ground on the map: slopes too steep to walk, and fields of loose sand. It is one
 * group of the layers panel and is drawn like the others: a card is told apart by its switch and
 * a lighter fill, never by a border.
 */
export function HazardPanel({
  slopeOn,
  dunesOn,
  onToggleSlope,
  onToggleDunes,
  near,
  around,
  dunes,
  route,
}: HazardPanelProps) {
  const a = WALK_ASSUMPTIONS;
  return (
    <View style={styles.panel}>
      <SectionHeading title="HAZARDS" color={Colors.caution} />

      <View style={[styles.card, slopeOn && styles.cardOn]}>
        <Switch
          on={slopeOn}
          onPress={onToggleSlope}
          title="Steep ground"
          subtitle="Slope from NASA elevation models"
        />
        <View style={styles.key}>
          <Swatch color={Colors.caution} label={`${a.cautionSlopeDeg}° to ${a.noGoSlopeDeg}°: caution`} />
          <Swatch color={Colors.noGo} label={`${a.noGoSlopeDeg}° or more: no-go`} />
        </View>
        <AreaLine title="Near the base" feed={near} />
        <AreaLine title="Around it" feed={around} />
        {route ? (
          <Text style={styles.route}>
            {route.maxDeg === null
              ? 'No elevation data under the route yet.'
              : `Steepest ground under the route: ${route.maxDeg.toFixed(1)}°, measured over ${formatDistance(route.cellM ?? 0)}.`}
          </Text>
        ) : (
          <Text style={styles.note}>Add waypoints and the route is checked against this slope.</Text>
        )}
        <Text style={styles.credit}>
          {TERRAIN_CREDIT}. A model gives the mean slope of each cell: a ledge or a boulder smaller
          than a cell does not show, so real ground can be steeper. The {a.cautionSlopeDeg}° and{' '}
          {a.noGoSlopeDeg}° limits are assumptions of this project, not NASA rules.
        </Text>
      </View>

      <View style={[styles.card, dunesOn && styles.cardOn]}>
        <Switch
          on={dunesOn}
          onPress={onToggleDunes}
          title="Dune fields"
          subtitle="Loose sand, and the wind that shaped it"
        />
        <Text style={styles.note}>
          {dunes.status === 'ready'
            ? dunes.data.length === 0
              ? 'No mapped dune field in this region.'
              : `${dunes.data.length} dune ${dunes.data.length === 1 ? 'field' : 'fields'} in this region, outlined on the map. Arrows point the way the wind that built them blew.`
            : dunes.status === 'failed'
              ? 'The dune database did not answer. No fields to show.'
              : 'Fetching the dune database.'}
        </Text>
        <Text style={styles.credit}>
          {DUNE_CREDIT}. Fields mapped from orbit between 65° S and 65° N; small patches of sand are
          not in it. A route into a field earns a caution.
        </Text>
      </View>
    </View>
  );
}

function AreaLine({ title, feed }: { title: string; feed: Feed<TerrainLayer> }) {
  return (
    <View style={styles.area}>
      <Text style={styles.areaTitle}>{title}</Text>
      <Text style={styles.areaText}>
        {feed.status === 'ready'
          ? `${feed.data.area.model.name}, ${formatDistance(feed.data.area.model.resolutionM)} model read as ${formatDistance(feed.data.slopes.cellM)} cells. Too steep: ${percent(feed.data.cautionShare)} of the area (no-go ${percent(feed.data.noGoShare)}); steepest ${feed.data.steepestDeg.toFixed(1)}°.`
          : feed.status === 'failed'
            ? 'The elevation service did not answer. This area is not checked.'
            : 'Reading the elevation model.'}
      </Text>
    </View>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchColor, { backgroundColor: color }]} />
      <Text style={styles.swatchText}>{label}</Text>
    </View>
  );
}

type SwitchProps = { on: boolean; onPress: () => void; title: string; subtitle: string };

function Switch({ on, onPress, title, subtitle }: SwitchProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  cardOn: {
    backgroundColor: Colors.glassHover,
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
  switchOn: {
    backgroundColor: Colors.caution,
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
  subtitle: {
    color: Colors.caution,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  key: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  swatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  swatchColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  swatchText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  area: {
    gap: Spacing.half,
  },
  areaTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  areaText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  route: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  credit: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
});
