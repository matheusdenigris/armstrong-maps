import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScaleBar } from '@/components/scale-bar';
import { SurfaceMap, type MapMarker } from '@/components/surface-map';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { VIKING_GLOBAL } from '@/data/layers';
import { SITES, findSite, type Site } from '@/data/sites';
import type { MapView } from '@/mission/camera';
import { formatLatLon } from '@/mission/format';
import { TILE_PIXELS, tileSpan } from '@/mission/tiles';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** The map opens about 30 km across on a phone: the landing point with its surroundings. */
const OPENING_PIXELS_PER_DEGREE = 700;
/** The whole planet fits on a small screen at this scale. */
const WIDEST_PIXELS_PER_DEGREE = 2;

export default function SiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = findSite(id);
  return site ? <SiteMap key={site.id} site={site} /> : <UnknownSite />;
}

function SiteMap({ site }: { site: Site }) {
  const insets = useSafeAreaInsets();
  // The map lays its tiles out again when these change, so they must not change on every frame.
  const { home, layers, limits, markers, sources } = useMemo(() => {
    const stack = [VIKING_GLOBAL, ...site.layers];
    const sharpest = site.layers[site.layers.length - 1];
    const opening: MapView = {
      lat: site.landing.lat,
      lon: site.landing.lon,
      pixelsPerDegree: OPENING_PIXELS_PER_DEGREE,
    };
    const pins: MapMarker[] = [
      { id: 'landing', point: site.landing, label: site.landing.name, color: Colors.mars },
    ];
    return {
      home: opening,
      layers: stack,
      // Past twice the natural size of the sharpest tiles there is nothing more to see.
      limits: {
        min: WIDEST_PIXELS_PER_DEGREE,
        max: (2 * TILE_PIXELS) / tileSpan(sharpest.maxLevel),
      },
      markers: pins,
      sources: [...new Set(stack.map((layer) => layer.source))].join(', '),
    };
  }, [site]);
  const [view, setView] = useState(home);
  const footerHeight = 76 + insets.bottom;

  return (
    <View style={styles.screen}>
      <Head>
        <title>{`${site.name} | Armstrong Maps`}</title>
        <meta name="description" content={`Map of ${site.name} on Mars. ${site.science}`} />
      </Head>
      <SurfaceMap
        layers={layers}
        home={home}
        limits={limits}
        markers={markers}
        onViewChange={setView}
        controlsBottom={footerHeight + Spacing.three}
        accessibilityLabel={`Map of ${site.name}. Drag to move, pinch or use the buttons to zoom.`}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <Link href="/" style={styles.back} accessibilityRole="link" accessibilityLabel="Back to the sites">
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

      <View
        style={[styles.footer, { height: footerHeight, paddingBottom: insets.bottom + Spacing.two }]}
        pointerEvents="none">
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    backgroundColor: PANEL,
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
