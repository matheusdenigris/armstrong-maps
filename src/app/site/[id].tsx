import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EnvironmentPanel } from '@/components/environment-panel';
import { HazardPanel } from '@/components/hazard-panel';
import { MarsClockPanel } from '@/components/mars-clock-panel';
import { SafetyCheck, type StartPlan } from '@/components/safety-check';
import { WeatherChart } from '@/components/weather-chart';
import { LayerPanel } from '@/components/layer-panel';
import { PhotosPanel } from '@/components/photos-panel';
import { ScaleBar } from '@/components/scale-bar';
import {
  SurfaceMap,
  type MapMarker,
  type MapArea,
  type MapArrow,
  type MapImage,
  type MapPath,
  type MapRing,
} from '@/components/surface-map';
import { WalkControls } from '@/components/walk-controls';
import { WalkDetails, WalkSummary } from '@/components/walk-panel';
import { WindPanel } from '@/components/wind-panel';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { duneQueryUrl, parseDunes } from '@/data/dunes';
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
import { INSIGHT_SITE, insightWeatherUrl, parseInsightWind } from '@/data/wind';
import type { MapView } from '@/mission/camera';
import { elapsedSeconds } from '@/mission/clock';
import { formatLatLon } from '@/mission/format';
import { distance } from '@/mission/geo';
import { walkProgress } from '@/mission/progress';
import { TILE_PIXELS, tileSpan } from '@/mission/tiles';
import { WALK_ASSUMPTIONS, evaluateWalk } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { useFeed } from '@/state/use-feed';
import { useTerrain } from '@/state/use-terrain';
import { routeCrosses, routeSlope } from '@/mission/terrain';
import { useNow } from '@/state/use-now';
import { mars24Sun, nextSunCrossing, tableSun, walkDaylight } from '@/mission/mars-time';
import { horizonsSunUrl, parseHorizonsSun } from '@/data/horizons';

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

/**
 * DONKI on the shared DEMO_KEY allows a few calls an hour per visitor, and its model runs change a
 * few times a day, so its answers are kept on the device for a while.
 */
const ENLIL_CACHE = { key: 'donki-enlil', freshForHours: 3 };
const SEP_CACHE = { key: 'donki-sep', freshForHours: 3 };
/** Wind InSight measured in 2020 does not change; the dune outlines barely do. */
const INSIGHT_CACHE = { key: 'insight-wind', freshForHours: 24 };
const DUNES_CACHE_HOURS = 24 * 7;

/** "Next morning" starts the walk when the Sun is this high, in degrees: a project assumption. */
const MORNING_SUN_DEG = 15;

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
  const arrivals = useFeed(donki.enlil, parseMarsArrivals, ENLIL_CACHE);
  const sep = useFeed(tab === 'site' ? donki.sep : null, parseSepEvents, SEP_CACHE);
  const cmeAtMars =
    arrivals.status === 'ready' && marsSpaceWeather(arrivals.data, visitStart).level !== 'quiet';
  // Pictures wait for the panel. The raw-image feed takes seconds to answer, so it is asked for as
  // soon as the panel opens; the library answers fast and waits for its tab.
  const rawImages = useFeed(
    (sideBySide || expanded) && site.rover ? rawImagesUrl(site.rover) : null,
    parseRawImages,
  );
  const library = useFeed(tab === 'photos' ? imageSearchUrl(site.photoQuery) : null, parseImageSearch);
  // The ground: slope from NASA elevation models near the base and around it, and dune fields.
  // Both enter the verdict, so they are asked for at once.
  const terrain = useTerrain(site);
  const dunesCache = useMemo(
    () => ({ key: `dunes-${site.id}`, freshForHours: DUNES_CACHE_HOURS }),
    [site.id],
  );
  const dunes = useFeed(duneQueryUrl(site.region), parseDunes, dunesCache);
  const wind = useFeed(tab === 'site' ? insightWeatherUrl() : null, parseInsightWind, INSIGHT_CACHE);
  const [hazards, setHazards] = useState({ slope: true, dunes: true });

  // The Sun over the walk. The Mars clock moves on once a minute; the walk starts now or the next
  // morning, when the Sun is MORNING_SUN_DEG up.
  const minute = useNow(true, 60_000);
  const [startPlan, setStartPlan] = useState<StartPlan>('now');
  // The Sun of the site from NASA/JPL Horizons: three days from the start of today (UT), asked
  // once a day. The web goes through its own forwarder, since Horizons sends no CORS header.
  const today = new Date(minute).toISOString().slice(0, 10);
  const horizonsCache = useMemo(
    () => ({ key: `horizons-${site.id}`, freshForHours: 24 }),
    [site.id],
  );
  const horizons = useFeed(
    horizonsSunUrl(site.landing.lat, site.landing.lon, new Date(`${today}T00:00:00Z`), Platform.OS === 'web'),
    parseHorizonsSun,
    horizonsCache,
  );
  const sun = useMemo(() => {
    const own = mars24Sun(site.landing.lat, site.landing.lon);
    return horizons.status === 'ready' ? tableSun(horizons.data, own) : own;
  }, [horizons, site]);
  const sunSource = horizons.status === 'ready' ? 'horizons' : 'mars24';
  const plannedStart = useMemo(() => {
    const from = new Date(minute);
    if (startPlan === 'now') return from;
    return nextSunCrossing(from, sun, true, MORNING_SUN_DEG) ?? from;
  }, [minute, startPlan, sun]);
  const daylight = useMemo(() => {
    if (route.length === 0) return null;
    const hours = evaluateWalk(site.landing, route, SURFACE_RADIATION.msvPerDay).durationHours;
    return walkDaylight(plannedStart, hours, sun);
  }, [plannedStart, route, site, sun]);

  // The ground under the whole walk, out and back.
  const { groundSlope, crossesDunes } = useMemo(() => {
    if (route.length === 0) return { groundSlope: null, crossesDunes: false };
    const loop = [site.landing, ...route, site.landing];
    const grids = [terrain.near, terrain.around].flatMap((feed) =>
      feed.status === 'ready' ? [feed.data.slopes] : [],
    );
    return {
      groundSlope: grids.length > 0 ? routeSlope(loop, grids) : null,
      crossesDunes:
        dunes.status === 'ready' &&
        routeCrosses(
          loop,
          dunes.data.flatMap((field) => field.outlines),
        ),
    };
  }, [site, route, terrain.near, terrain.around, dunes]);

  // What the map draws for the hazards: the slope pictures (the wide one under the near one), the
  // dune outlines and the way their wind blew.
  const { hazardImages, hazardAreas, windArrows } = useMemo(() => {
    const images: MapImage[] = hazards.slope
      ? [terrain.around, terrain.near].flatMap((feed) =>
          feed.status === 'ready'
            ? [{ id: `slope-${feed.data.area.id}`, uri: feed.data.image, bounds: feed.data.area.bounds }]
            : [],
        )
      : [];
    const fields = hazards.dunes && dunes.status === 'ready' ? dunes.data : [];
    const areas: MapArea[] = fields.flatMap((field) =>
      field.outlines.map((outline, index) => ({
        id: `dune-${field.id}-${index}`,
        outline,
        fill: Colors.duneFill,
        stroke: Colors.duneStroke,
      })),
    );
    const arrows: MapArrow[] = fields.flatMap((field) =>
      field.downwindDeg === null
        ? []
        : [{ id: `wind-${field.id}`, point: field.centre, bearingDeg: field.downwindDeg, color: Colors.wind }],
    );
    return { hazardImages: images, hazardAreas: areas, windArrows: arrows };
  }, [hazards, terrain.near, terrain.around, dunes]);

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
        maxSlopeDeg: groundSlope?.maxDeg ?? null,
        crossesDunes,
        daylight,
      }),
      markers: pins,
      paths: lines,
      rings: circles,
    };
  }, [site, route, rover, track, astronaut, cmeAtMars, groundSlope, crossesDunes, daylight]);

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
              <SafetyCheck
                walk={walk}
                stops={route.length}
                lonEast={site.landing.lon}
                startPlan={startPlan}
                onStartPlan={setStartPlan}
                daylight={daylight}
                start={plannedStart}
                spaceWeather={arrivals.status === 'ready' ? (cmeAtMars ? 'alert' : 'quiet') : 'unknown'}
                ground={groundSlope}
                groundKnown={terrain.near.status === 'ready' || terrain.around.status === 'ready'}
                dunes={dunes.status === 'ready' ? (crossesDunes ? 'crossed' : 'clear') : 'unknown'}
                sunSource={sunSource}
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
            <HazardPanel
              slopeOn={hazards.slope}
              dunesOn={hazards.dunes}
              onToggleSlope={() => setHazards((value) => ({ ...value, slope: !value.slope }))}
              onToggleDunes={() => setHazards((value) => ({ ...value, dunes: !value.dunes }))}
              near={terrain.near}
              around={terrain.around}
              dunes={dunes}
              route={groundSlope}
            />
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
            <MarsClockPanel
              siteName={site.name}
              lat={site.landing.lat}
              lonEast={site.landing.lon}
              now={new Date(minute)}
              sun={sun}
              sunSource={sunSource}
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
          {tab === 'site' && weather.status === 'ready' ? <WeatherChart sols={weather.data} /> : null}
          {tab === 'site' ? (
            <WindPanel
              siteName={site.name}
              distanceFromInsightM={distance(site.landing, INSIGHT_SITE)}
              sols={wind}
              dunes={dunes}
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
            images={hazardImages}
            areas={hazardAreas}
            arrows={windArrows}
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
