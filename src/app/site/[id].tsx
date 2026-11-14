import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScaleBar } from '@/components/scale-bar';
import {
  SurfaceMap,
  type MapMarker,
  type MapPath,
  type MapRing,
} from '@/components/surface-map';
import { WalkPanel } from '@/components/walk-panel';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { VIKING_GLOBAL } from '@/data/layers';
import { SURFACE_RADIATION } from '@/data/radiation';
import { SITES, findSite, type Site } from '@/data/sites';
import type { MapView } from '@/mission/camera';
import { formatLatLon } from '@/mission/format';
import { TILE_PIXELS, tileSpan } from '@/mission/tiles';
import { WALK_ASSUMPTIONS, evaluateWalk } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** The map opens about 30 km across on a phone: the landing point with its surroundings. */
const OPENING_PIXELS_PER_DEGREE = 700;
/** The whole planet fits on a small screen at this scale. */
const WIDEST_PIXELS_PER_DEGREE = 2;
/** From this width the walk panel sits beside the map instead of under it. */
const SIDE_BY_SIDE = 900;
const PANEL_WIDTH = 380;

/** False on the page rendered ahead of time, which does not know the size of the window. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function SiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = findSite(id);
  return site ? <SiteMap key={site.id} site={site} /> : <UnknownSite />;
}

function SiteMap({ site }: { site: Site }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const hydrated = useHydrated();
  const sideBySide = hydrated && width >= SIDE_BY_SIDE;
  // The page rendered ahead of time has no window, so it must not carry a size computed from one.
  const sheetLimit = hydrated ? Math.round(height * 0.55) : undefined;

  const route = useRoute(site.id);
  const addWaypoint = useMission((state) => state.addWaypoint);
  const removeLastWaypoint = useMission((state) => state.removeLastWaypoint);
  const clearRoute = useMission((state) => state.clearRoute);
  const [expanded, setExpanded] = useState(false);

  // The map lays its tiles out again when these change, so they must not change on every frame.
  const { home, layers, limits, sources } = useMemo(() => {
    const stack = [VIKING_GLOBAL, ...site.layers];
    const sharpest = site.layers[site.layers.length - 1];
    const opening: MapView = {
      lat: site.landing.lat,
      lon: site.landing.lon,
      pixelsPerDegree: OPENING_PIXELS_PER_DEGREE,
    };
    return {
      home: opening,
      layers: stack,
      // Past twice the natural size of the sharpest tiles there is nothing more to see.
      limits: {
        min: WIDEST_PIXELS_PER_DEGREE,
        max: (2 * TILE_PIXELS) / tileSpan(sharpest.maxLevel),
      },
      sources: [...new Set(stack.map((layer) => layer.source))].join(', '),
    };
  }, [site]);
  const [view, setView] = useState(home);

  // The walk: out from the base through the waypoints, and straight back.
  const { walk, markers, paths, rings } = useMemo(() => {
    const base = site.landing;
    const pins: MapMarker[] = [
      { id: 'base', point: base, label: `Base · ${base.name}`, color: Colors.mars },
      ...route.map((point, index) => ({
        id: `waypoint-${index}`,
        point,
        label: String(index + 1),
        color: Colors.nav,
      })),
    ];
    const lines: MapPath[] =
      route.length === 0
        ? []
        : [
            { id: 'outbound', points: [base, ...route], color: Colors.nav },
            {
              id: 'return',
              points: [route[route.length - 1], base],
              color: Colors.nav,
              dashed: true,
              width: 2,
            },
          ];
    const circles: MapRing[] = [
      {
        id: 'walk-back-limit',
        centre: base,
        radiusM: WALK_ASSUMPTIONS.walkBackLimitKm * 1000,
        color: Colors.caution,
      },
    ];
    return {
      walk: evaluateWalk(base, route, SURFACE_RADIATION.msvPerDay),
      markers: pins,
      paths: lines,
      rings: circles,
    };
  }, [site, route]);

  const panel = (
    <WalkPanel
      walk={walk}
      stops={route.length}
      collapsible={!sideBySide}
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      onUndo={() => removeLastWaypoint(site.id)}
      onClear={() => clearRoute(site.id)}
    />
  );

  return (
    <View style={[styles.screen, sideBySide && styles.row]}>
      <Head>
        <title>{`${site.name} | Armstrong Maps`}</title>
        <meta name="description" content={`Map of ${site.name} on Mars. ${site.science}`} />
      </Head>

      <View style={styles.column}>
        <View style={styles.mapArea}>
          <SurfaceMap
            layers={layers}
            home={home}
            limits={limits}
            markers={markers}
            paths={paths}
            rings={rings}
            onViewChange={setView}
            onPress={(point) => addWaypoint(site.id, point)}
            accessibilityLabel={`Map of ${site.name}. Drag to move, pinch or use the buttons to zoom, tap to add a waypoint.`}
          />

          <View
            style={[styles.header, { paddingTop: insets.top + Spacing.two }]}
            pointerEvents="box-none">
            <Link
              href="/"
              style={styles.back}
              accessibilityRole="link"
              accessibilityLabel="Back to the sites">
              {'‹'} Sites
            </Link>
            <View style={styles.title} pointerEvents="none">
              <Text style={styles.name} numberOfLines={1}>
                {site.name.toUpperCase()}
              </Text>
              <Text style={styles.mission} numberOfLines={1}>
                {site.mission}
              </Text>
            </View>
          </View>
        </View>

        {sideBySide ? null : (
          <View style={[styles.sheet, { maxHeight: sheetLimit }]}>
            <ScrollView style={styles.sheetScroll}>{panel}</ScrollView>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.two }]}>
          <View style={styles.readout}>
            <Text style={styles.label}>MAP CENTRE</Text>
            <Text style={styles.value}>{formatLatLon(view)}</Text>
            <Text style={styles.credit} numberOfLines={1}>
              Imagery: NASA/JPL Mars Trek. {sources}
            </Text>
          </View>
          <ScaleBar pixelsPerDegree={view.pixelsPerDegree} />
        </View>
      </View>

      {sideBySide ? (
        <View style={[styles.side, { paddingTop: insets.top }]}>
          <ScrollView>{panel}</ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function UnknownSite() {
  return (
    <View style={[styles.screen, styles.unknown]}>
      <Head>
        <title>Site not found | Armstrong Maps</title>
      </Head>
      <Text style={styles.name}>SITE NOT FOUND</Text>
      <Text style={styles.mission}>There is no landing site with this address.</Text>
      <Link href="/" style={styles.back} accessibilityRole="link">
        {'‹'} Sites
      </Link>
    </View>
  );
}

const PANEL = 'rgba(7, 9, 13, 0.82)';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  mapArea: {
    flex: 1,
  },
  unknown: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: PANEL,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  back: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    // A comfortable target for a thumb.
    paddingVertical: Spacing.two + Spacing.one,
    paddingRight: Spacing.two,
    minHeight: 44,
    borderRadius: Radius.small,
  },
  title: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  mission: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  // As tall as its content, up to the limit of the sheet; it must not stretch or collapse.
  sheetScroll: {
    flexGrow: 0,
  },
  side: {
    width: PANEL_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  readout: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  value: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  credit: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
});
