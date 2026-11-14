import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EnvironmentPanel } from '@/components/environment-panel';
import { LayerPanel } from '@/components/layer-panel';
import { PhotosPanel } from '@/components/photos-panel';
import { ScaleBar } from '@/components/scale-bar';
import {
  SurfaceMap,
  type MapMarker,
  type MapPath,
  type MapRing,
} from '@/components/surface-map';
import { WalkControls } from '@/components/walk-controls';
import { WalkDetails, WalkSummary } from '@/components/walk-panel';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { imageSearchUrl, parseImageSearch } from '@/data/image-library';
import { GLOBAL_LAYERS, VIKING_GLOBAL } from '@/data/layers';
import { SURFACE_RADIATION } from '@/data/radiation';
import { ROVERS, parseRoverTrack } from '@/data/rover';
import { RAW_IMAGE_FEEDS, parseRawImages, rawImagesUrl } from '@/data/rover-images';
import { SITES, findSite, type Site } from '@/data/sites';
import {
  donkiUrls,
  marsSpaceWeather,
  parseMarsArrivals,
  parseSepEvents,
} from '@/data/space-weather';
import { REMS_FEED, parseWeather } from '@/data/weather';
import type { MapView } from '@/mission/camera';
import { elapsedSeconds } from '@/mission/clock';
import { formatLatLon } from '@/mission/format';
import { distance } from '@/mission/geo';
import { walkProgress } from '@/mission/progress';
import { TILE_PIXELS, tileSpan } from '@/mission/tiles';
import { WALK_ASSUMPTIONS, evaluateWalk } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { useFeed } from '@/state/use-feed';
import { useNow } from '@/state/use-now';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** The map opens about 30 km across on a phone: the landing point with its surroundings. */
const OPENING_PIXELS_PER_DEGREE = 700;
/** The whole planet fits on a small screen at this scale. */
const WIDEST_PIXELS_PER_DEGREE = 2;
/** From this width the panel sits beside the map instead of under it. */
const SIDE_BY_SIDE = 900;
const PANEL_WIDTH = 380;

/** Layers that go over the optical base: everything planet-wide except the base itself. */
const OVERLAYS = GLOBAL_LAYERS.filter((layer) => layer !== VIKING_GLOBAL);

/** The weather station is on Curiosity, which landed at Gale crater. */
const GALE = SITES[0].landing;

type Tab = 'walk' | 'layers' | 'site' | 'photos';

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
  const sheetLimit = hydrated ? Math.round(height * 0.6) : undefined;

  const route = useRoute(site.id);
  const addWaypoint = useMission((state) => state.addWaypoint);
  const removeLastWaypoint = useMission((state) => state.removeLastWaypoint);
  const clearRoute = useMission((state) => state.clearRoute);
  const overlays = useMission((state) => state.overlays);
  const toggleOverlay = useMission((state) => state.toggleOverlay);
  const setOverlayOpacity = useMission((state) => state.setOverlayOpacity);
  const clock = useMission((state) => state.clocks[site.id]) ?? null;
  const startWalk = useMission((state) => state.startWalk);
  const pauseWalk = useMission((state) => state.pauseWalk);
  const resumeWalk = useMission((state) => state.resumeWalk);
  const setWalkRate = useMission((state) => state.setWalkRate);
  const endWalk = useMission((state) => state.endWalk);
  // The walk in progress, if there is one. Its position is simulated from the plan.
  const now = useNow(clock?.running ?? false);
  const progress = walkProgress(
    site.landing,
    route,
    clock ? elapsedSeconds(clock, now) / 3600 : 0,
    SURFACE_RADIATION.msvPerDay,
  );
  // The same object while the astronaut stands still, so the map is not rebuilt on every frame.
  const astronautLat = clock ? progress.position.lat : null;
  const astronautLon = clock ? progress.position.lon : null;
  const astronaut = useMemo(
    () =>
      astronautLat === null || astronautLon === null
        ? null
        : { lat: astronautLat, lon: astronautLon },
    [astronautLat, astronautLon],
  );
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('walk');

  // Live data. The traverse is drawn on the map, so it is asked for at once; the weather waits
  // until its tab is opened.
  const rover = site.rover ? ROVERS[site.rover] : null;
  const track = useFeed(rover?.feed ?? null, parseRoverTrack);
  const weather = useFeed(tab === 'site' ? REMS_FEED : null, parseWeather);
  // Space weather changes the verdict, so the CME forecast is asked for at once. The addresses
  // only change once a day, and each is asked for once per visit.
  const [visitStart] = useState(() => new Date());
  const donki = useMemo(() => donkiUrls(visitStart), [visitStart]);
  const arrivals = useFeed(donki.enlil, parseMarsArrivals);
  const sep = useFeed(tab === 'site' ? donki.sep : null, parseSepEvents);
  const cmeAtMars =
    arrivals.status === 'ready' && marsSpaceWeather(arrivals.data, visitStart).level !== 'quiet';
  // Pictures wait for their tab.
  const rawImages = useFeed(
    tab === 'photos' && site.rover ? rawImagesUrl(site.rover) : null,
    parseRawImages,
  );
  const library = useFeed(tab === 'photos' ? imageSearchUrl(site.photoQuery) : null, parseImageSearch);

  // The map lays its tiles out again when these change, so they must not change on every frame.
  const { home, limits } = useMemo(() => {
    const sharpest = site.layers[site.layers.length - 1];
    const opening: MapView = {
      lat: site.landing.lat,
      lon: site.landing.lon,
      pixelsPerDegree: OPENING_PIXELS_PER_DEGREE,
    };
    return {
      home: opening,
      // Past twice the natural size of the sharpest tiles there is nothing more to see.
      limits: {
        min: WIDEST_PIXELS_PER_DEGREE,
        max: (2 * TILE_PIXELS) / tileSpan(sharpest.maxLevel),
      },
    };
  }, [site]);
  const [view, setView] = useState(home);

  // The optical base of the site, then the overlays that are on, in catalogue order.
  const { base, layers, sources } = useMemo(() => {
    const optical = [VIKING_GLOBAL, ...site.layers];
    const stack = [...optical, ...OVERLAYS.filter((layer) => overlays[layer.id] !== undefined)];
    return {
      base: optical,
      layers: stack,
      sources: [...new Set(stack.map((layer) => layer.source))].join(', '),
    };
  }, [site, overlays]);

  // The walk: out from the base through the waypoints, and straight back.
  const { walk, markers, paths, rings } = useMemo(() => {
    const landing = site.landing;
    const driven = track.status === 'ready' ? track.data : null;
    const pins: MapMarker[] = [
      { id: 'base', point: landing, label: `Base · ${landing.name}`, color: Colors.mars },
      ...route.map((point, index) => ({
        id: `waypoint-${index}`,
        point,
        label: String(index + 1),
        color: Colors.nav,
      })),
    ];
    if (rover && driven?.latest) {
      pins.push({
        id: 'rover',
        point: driven.latest.point,
        label: `${rover.name} · sol ${driven.latest.sol}`,
        color: Colors.text,
      });
    }
    if (astronaut) {
      pins.push({ id: 'astronaut', point: astronaut, label: 'EV1 · simulated', color: Colors.go });
    }
    // The real traverse goes under the planned route.
    const lines: MapPath[] = driven
      ? [{ id: 'traverse', points: driven.path, color: Colors.text, width: 2 }]
      : [];
    if (route.length > 0) {
      lines.push(
        { id: 'outbound', points: [landing, ...route], color: Colors.nav },
        {
          id: 'return',
          points: [route[route.length - 1], landing],
          color: Colors.nav,
          dashed: true,
          width: 2,
        },
      );
    }
    const circles: MapRing[] = [
      {
        id: 'walk-back-limit',
        centre: landing,
        radiusM: WALK_ASSUMPTIONS.walkBackLimitKm * 1000,
        color: Colors.caution,
      },
    ];
    return {
      walk: evaluateWalk(landing, route, SURFACE_RADIATION.msvPerDay, WALK_ASSUMPTIONS, {
        cmeAtMars,
      }),
      markers: pins,
      paths: lines,
      rings: circles,
    };
  }, [site, route, rover, track, astronaut, cmeAtMars]);

  const open = sideBySide || expanded;
  const panel = (
    <>
      <WalkSummary
        walk={walk}
        stops={route.length}
        collapsible={!sideBySide}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      {open ? (
        <>
          <View style={styles.tabs} accessibilityRole="tablist">
            <TabButton label="Walk" selected={tab === 'walk'} onPress={() => setTab('walk')} />
            <TabButton
              label={`Layers (${layers.length})`}
              selected={tab === 'layers'}
              onPress={() => setTab('layers')}
            />
            <TabButton label="Site" selected={tab === 'site'} onPress={() => setTab('site')} />
            <TabButton label="Photos" selected={tab === 'photos'} onPress={() => setTab('photos')} />
          </View>
          {tab === 'walk' ? (
            <>
              <WalkControls
                siteId={site.id}
                stops={route.length}
                clock={clock}
                progress={progress}
                onStart={() => startWalk(site.id)}
                onPause={() => pauseWalk(site.id)}
                onResume={() => resumeWalk(site.id)}
                onEnd={() => endWalk(site.id)}
                onRate={(rate) => setWalkRate(site.id, rate)}
              />
              <WalkDetails
                walk={walk}
                stops={route.length}
                locked={clock !== null}
                onUndo={() => removeLastWaypoint(site.id)}
                onClear={() => clearRoute(site.id)}
              />
            </>
          ) : null}
          {tab === 'layers' ? (
            <LayerPanel
              base={base}
              overlays={OVERLAYS}
              active={overlays}
              onToggle={toggleOverlay}
              onOpacity={setOverlayOpacity}
            />
          ) : null}
          {tab === 'site' ? (
            <EnvironmentPanel
              siteName={site.name}
              distanceFromGaleM={distance(site.landing, GALE)}
              weather={weather}
              rover={rover ? { name: rover.name, track } : null}
              space={{ arrivals, sep, now: visitStart }}
            />
          ) : null}
          {tab === 'photos' ? (
            <PhotosPanel
              siteName={site.name}
              rover={
                rover && site.rover
                  ? { name: rover.name, gallery: RAW_IMAGE_FEEDS[site.rover].gallery, images: rawImages }
                  : null
              }
              library={library}
            />
          ) : null}
        </>
      ) : null}
    </>
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
            opacity={overlays}
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
            <Link
              href="/docs"
              style={styles.docs}
              accessibilityRole="link"
              accessibilityLabel="Docs: the NASA data and APIs behind the map">
              Docs
            </Link>
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

type TabButtonProps = { label: string; selected: boolean; onPress: () => void };

function TabButton({ label, selected, onPress }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.tab, selected && styles.tabSelected]}>
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
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
  docs: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
    paddingLeft: Spacing.two,
    minHeight: 44,
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
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tabSelected: {
    borderColor: Colors.nav,
    backgroundColor: 'rgba(76, 141, 255, 0.18)',
  },
  tabText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextSelected: {
    color: Colors.text,
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
