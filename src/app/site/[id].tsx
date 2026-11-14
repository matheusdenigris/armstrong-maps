import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EnvironmentPanel } from '@/components/environment-panel';
import { LayerPanel } from '@/components/layer-panel';
import { MapLegend } from '@/components/map-legend';
import { PhotosPanel } from '@/components/photos-panel';
import { Logo } from '@/components/logo';
import { ScaleBar } from '@/components/scale-bar';
import {
  SurfaceMap,
  type MapMarker,
  type MapPath,
  type MapPreview,
  type MapRing,
} from '@/components/surface-map';
import { WalkControls } from '@/components/walk-controls';
import { RouteActions, WalkDetails, WalkSummary } from '@/components/walk-panel';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { imageSearchUrl, parseImageSearch } from '@/data/image-library';
import { GLOBAL_LAYERS, VIKING_GLOBAL, type MapLayer } from '@/data/layers';
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
import { formatDistance, formatDuration, formatLatLon } from '@/mission/format';
import { distance } from '@/mission/geo';
import { walkHoursPlayed, walkProgress } from '@/mission/progress';
import { TILE_PIXELS, tileSpan } from '@/mission/tiles';
import { WALK_ASSUMPTIONS, evaluateWalk, type WalkEvaluation } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { useFeed } from '@/state/use-feed';
import { useNow } from '@/state/use-now';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/**
 * The map opens close to the base, at about 3 m a pixel: the scale bar reads 200 m and a phone
 * shows about a kilometre across. Where the imagery of a site is not that sharp, the map opens
 * at its closest instead.
 */
const OPENING_PIXELS_PER_DEGREE = 20_000;
/** The whole planet fits on a small screen at this scale. */
const WIDEST_PIXELS_PER_DEGREE = 2;
/** The full three-column ship console starts here. */
const DESKTOP_CONSOLE = 1100;
/** The science brief has room beside the navigation only on very wide screens. */
const SCIENCE_BAR = 1500;
const LAYERS_PANEL_WIDTH = 300;
const WALK_PANEL_WIDTH = 340;
const COLLAPSED_PANEL_WIDTH = 52;

/** Layers that go over the optical base: everything planet-wide except the base itself. */
const OVERLAYS = GLOBAL_LAYERS.filter((layer) => layer !== VIKING_GLOBAL);

/** The weather station is on Curiosity, which landed at Gale crater. */
const GALE = SITES[0].landing;

/**
 * DONKI allows few requests an hour with the shared demo key, and its model runs change only a
 * few times a day, so its answers are kept on the device for a while.
 */
const ENLIL_CACHE = { key: 'donki-enlil', freshForHours: 3 };
const SEP_CACHE = { key: 'donki-sep', freshForHours: 3 };

type Tab = 'map' | 'layers' | 'walk' | 'site' | 'photos';
/** What the right-hand panel of the desktop console shows: one subject at a time. */
type PanelTab = 'walk' | 'site' | 'photos';
const PANEL_TABS: readonly { id: PanelTab; label: string }[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'site', label: 'Site' },
  { id: 'photos', label: 'Photos' },
];

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
  const desktopConsole = hydrated && width >= DESKTOP_CONSOLE;
  const showScience = desktopConsole && width >= SCIENCE_BAR;
  // The page rendered ahead of time has no window, so it must not carry a size computed from one.
  const sheetLimit = hydrated ? Math.round(height * 0.64) : undefined;

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
  const [tab, setTab] = useState<Tab>('map');
  const [panelTab, setPanelTab] = useState<PanelTab>('walk');

  // The walk in progress, if there is one. Its position is simulated from the plan.
  const now = useNow(clock?.running ?? false);
  const progress = walkProgress(
    site.landing,
    route,
    clock ? walkHoursPlayed(site.landing, route, elapsedSeconds(clock, now) / 3600) : 0,
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
  const [layersVisible, setLayersVisible] = useState(true);
  const [walkVisible, setWalkVisible] = useState(true);

  // The traverse is map data, so it is requested at once. Weather waits until its mission panel
  // is meaningful on a phone, but is ready with the full desktop console.
  const rover = site.rover ? ROVERS[site.rover] : null;
  const track = useFeed(rover?.feed ?? null, parseRoverTrack);
  const showSite = desktopConsole ? panelTab === 'site' : tab === 'site';
  const weather = useFeed(showSite ? REMS_FEED : null, parseWeather);
  // Space weather changes the verdict, so the CME forecast is asked for at once. The addresses
  // only change once a day, and each is asked for once per visit.
  const [visitStart] = useState(() => new Date());
  const donki = useMemo(() => donkiUrls(visitStart), [visitStart]);
  const arrivals = useFeed(donki.enlil, parseMarsArrivals, ENLIL_CACHE);
  const sep = useFeed(showSite ? donki.sep : null, parseSepEvents, SEP_CACHE);
  const cmeAtMars =
    arrivals.status === 'ready' && marsSpaceWeather(arrivals.data, visitStart).level !== 'quiet';
  // Pictures wait until their panel is on screen.
  const showPhotos = desktopConsole ? panelTab === 'photos' : tab === 'photos';
  const rawImages = useFeed(
    showPhotos && site.rover ? rawImagesUrl(site.rover) : null,
    parseRawImages,
  );
  const library = useFeed(showPhotos ? imageSearchUrl(site.photoQuery) : null, parseImageSearch);

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
      // Past the native size of the sharpest tiles there is no further image detail to reveal.
      limits: {
        min: WIDEST_PIXELS_PER_DEGREE,
        max: TILE_PIXELS / tileSpan(sharpest.maxLevel),
      },
    };
  }, [site]);
  const [view, setView] = useState(home);

  // The optical base of the site, then the overlays that are on, in catalogue order.
  const { base, layers, coloured, sources } = useMemo(() => {
    const optical = [VIKING_GLOBAL, ...site.layers];
    const on = OVERLAYS.filter((layer) => overlays[layer.id] !== undefined);
    const stack = [...optical, ...on];
    return {
      base: optical,
      layers: stack,
      // The layers whose colours need a key on the map.
      coloured: on,
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
        color: Colors.white,
      });
    }
    if (astronaut) {
      pins.push({ id: 'astronaut', point: astronaut, label: 'EV1 · simulated', color: Colors.go });
    }
    // The real traverse goes under the planned route.
    const lines: MapPath[] = driven
      ? [{ id: 'traverse', points: driven.path, color: Colors.white, width: 2 }]
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

  // Under a mouse pointer the map shows the leg a press would add. Not while a walk runs: the
  // route is locked then.
  const preview = useMemo<MapPreview | null>(() => {
    if (clock !== null) return null;
    const from = route.length > 0 ? route[route.length - 1] : site.landing;
    const origin = route.length > 0 ? `waypoint ${route.length}` : 'the base';
    return {
      from,
      color: Colors.nav,
      describe: (to) => {
        const metres = distance(from, to);
        const hours = metres / 1000 / WALK_ASSUMPTIONS.walkingSpeedKmh;
        return {
          title: `Click to mark waypoint ${route.length + 1}`,
          detail: `${formatDistance(metres)} · ${formatDuration(hours)} from ${origin}`,
        };
      },
    };
  }, [clock, route, site]);

  const roverSol =
    rover && track.status === 'ready' && track.data.latest
      ? String(track.data.latest.sol)
      : rover
        ? '—'
        : 'No rover';

  const layersContent = (
    <LayerPanel
      base={base}
      overlays={OVERLAYS}
      active={overlays}
      onToggle={toggleOverlay}
      onOpacity={setOverlayOpacity}
    />
  );

  const walkContent = (
    <>
      <WalkSummary
        walk={walk}
        stops={route.length}
        collapsible={false}
        expanded
        onToggle={() => undefined}
      />
      <RouteActions
        stops={route.length}
        locked={clock !== null}
        onUndo={() => removeLastWaypoint(site.id)}
        onClear={() => clearRoute(site.id)}
      />
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
      <WalkDetails walk={walk} stops={route.length} />
    </>
  );

  const siteContent = (
    <EnvironmentPanel
      siteName={site.name}
      distanceFromGaleM={distance(site.landing, GALE)}
      weather={weather}
      rover={rover ? { name: rover.name, track } : null}
      space={{ arrivals, sep, now: visitStart }}
    />
  );

  const photosContent = (
    <PhotosPanel
      siteName={site.name}
      rover={
        rover && site.rover
          ? { name: rover.name, gallery: RAW_IMAGE_FEEDS[site.rover].gallery, images: rawImages }
          : null
      }
      library={library}
    />
  );

  const map = (
    <MapStage
      site={site}
      home={home}
      limits={limits}
      layers={layers}
      overlays={overlays}
      markers={markers}
      paths={paths}
      rings={rings}
      view={view}
      onViewChange={setView}
      onPress={(point) => addWaypoint(site.id, point)}
      preview={preview}
      walk={walk}
      stops={route.length}
      sources={sources}
      legends={coloured}
      desktop={desktopConsole}
      showFoot={desktopConsole || tab === 'map'}
      onOpenWalk={desktopConsole ? undefined : () => setTab('walk')}
    />
  );

  return (
    <View style={styles.screen}>
      <Head>
        <title>{`${site.name} | Armstrong Maps`}</title>
        <meta name="description" content={`Map of ${site.name} on Mars. ${site.science}`} />
      </Head>

      <ConsoleHeader
        site={site}
        view={view}
        roverSol={roverSol}
        layers={layers.length}
        desktop={desktopConsole}
        showScience={showScience}
        topInset={insets.top}
      />

      {desktopConsole ? (
        <View style={styles.desktopMain}>
          <DesktopPanel
            side="left"
            visible={layersVisible}
            width={LAYERS_PANEL_WIDTH}
            onToggle={() => setLayersVisible((visible) => !visible)}>
            {layersContent}
          </DesktopPanel>
          <View style={styles.mapColumn}>{map}</View>
          <DesktopPanel
            side="right"
            visible={walkVisible}
            width={WALK_PANEL_WIDTH}
            onToggle={() => setWalkVisible((visible) => !visible)}
            scrollKey={panelTab}
            header={<PanelTabs selected={panelTab} onChange={setPanelTab} />}>
            {panelTab === 'walk' ? walkContent : panelTab === 'site' ? siteContent : photosContent}
          </DesktopPanel>
        </View>
      ) : (
        <View style={styles.mobileMain}>
          <View style={styles.mobileMapStack}>
            {map}
            {tab !== 'map' ? (
              <View style={[styles.mobileSheet, hydrated && { maxHeight: sheetLimit }]}>
                <ScrollView
                  style={styles.mobileSheetScroll}
                  contentContainerStyle={styles.mobileSheetContent}
                  showsVerticalScrollIndicator={false}>
                  {tab === 'layers'
                    ? layersContent
                    : tab === 'photos'
                      ? photosContent
                      : tab === 'site'
                        ? siteContent
                        : walkContent}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <MobileTabs selected={tab} onChange={setTab} bottomInset={insets.bottom} />
        </View>
      )}
    </View>
  );
}

type ConsoleHeaderProps = {
  site: Site;
  view: MapView;
  roverSol: string;
  layers: number;
  desktop: boolean;
  showScience: boolean;
  topInset: number;
};

/** The source console's compact brand, site identity and live map telemetry. */
function ConsoleHeader({
  site,
  view,
  roverSol,
  layers,
  desktop,
  showScience,
  topInset,
}: ConsoleHeaderProps) {
  const telemetry = (
    <TelemetryStrip
      desktop={desktop}
      items={[
        { label: 'Base', value: formatLatLon(site.landing, 2) },
        { label: 'Centre', value: formatLatLon(view, 2) },
        { label: 'Sol', value: roverSol },
        { label: 'Layers', value: String(layers) },
      ]}
    />
  );

  return (
    <View
      style={[
        styles.controlBar,
        desktop && styles.controlBarDesktop,
        { paddingTop: topInset + Spacing.two },
      ]}>
      <View style={[styles.headerTop, desktop && styles.headerTopDesktop]}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to the landing sites"
            style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}>
            <View style={styles.brandIdentity}>
              <Logo size={26} />
              {desktop ? (
                <Text numberOfLines={1} style={styles.brandName}>
                  ARMSTRONG <Text style={styles.brandAccent}>MAPS</Text>
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Link>
        <View style={[styles.siteIdentity, desktop && styles.siteIdentityDesktop]}>
          <Text style={styles.siteName} numberOfLines={1}>
            {site.name}
          </Text>
          <Text style={styles.siteMission} numberOfLines={1}>
            {site.mission}
          </Text>
        </View>
        {showScience ? (
          <Text style={styles.science} numberOfLines={2}>
            {site.science}
          </Text>
        ) : null}
        {desktop ? telemetry : null}
      </View>
      {desktop ? null : telemetry}
    </View>
  );
}

type TelemetryItem = { label: string; value: string };

function TelemetryStrip({ desktop, items }: { desktop: boolean; items: readonly TelemetryItem[] }) {
  const cells = (
    <View style={[styles.telemetry, desktop && styles.telemetryDesktop]}>
      {items.map((item) => (
        <View key={item.label} style={styles.telemetryCell}>
          <Text style={styles.telemetryLabel}>{item.label}</Text>
          <Text style={styles.telemetryValue} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );

  return desktop ? (
    cells
  ) : (
    <ScrollView
      horizontal
      contentContainerStyle={styles.telemetryScrollContent}
      showsHorizontalScrollIndicator={false}
      style={styles.telemetryScroll}>
      {cells}
    </ScrollView>
  );
}

type MapStageProps = {
  site: Site;
  home: MapView;
  limits: { min: number; max: number };
  layers: Parameters<typeof SurfaceMap>[0]['layers'];
  overlays: Readonly<Record<string, number>>;
  markers: readonly MapMarker[];
  paths: readonly MapPath[];
  rings: readonly MapRing[];
  view: MapView;
  onViewChange: (view: MapView) => void;
  onPress: (point: { lat: number; lon: number }) => void;
  preview: MapPreview | null;
  walk: WalkEvaluation;
  stops: number;
  sources: string;
  legends: readonly MapLayer[];
  desktop: boolean;
  showFoot: boolean;
  onOpenWalk?: () => void;
};

function MapStage({
  site,
  home,
  limits,
  layers,
  overlays,
  markers,
  paths,
  rings,
  view,
  onViewChange,
  onPress,
  preview,
  walk,
  stops,
  sources,
  legends,
  desktop,
  showFoot,
  onOpenWalk,
}: MapStageProps) {
  return (
    <View style={styles.mapArea}>
      <SurfaceMap
        layers={layers}
        opacity={overlays}
        home={home}
        limits={limits}
        markers={markers}
        paths={paths}
        rings={rings}
        onViewChange={onViewChange}
        onPress={onPress}
        preview={preview}
        // The zoom buttons stand clear of what is at the foot of the map, which is taller while
        // the route is empty and the first step is spelled out.
        controlsBottom={showFoot ? (stops === 0 ? 176 : desktop ? 112 : 116) : Spacing.three}
        accessibilityLabel={`Map of ${site.name}. Drag to move, pinch or use the buttons to zoom, tap to add a waypoint.`}>
        <MapHud
          view={view}
          walk={walk}
          stops={stops}
          sources={sources}
          legends={legends}
          desktop={desktop}
          showFoot={showFoot}
          onOpenWalk={onOpenWalk}
        />
      </SurfaceMap>
    </View>
  );
}

type MapHudProps = {
  view: MapView;
  walk: WalkEvaluation;
  stops: number;
  sources: string;
  /** The layers that are on over the base: each gets its colour key on the map. */
  legends: readonly MapLayer[];
  desktop: boolean;
  showFoot: boolean;
  onOpenWalk?: () => void;
};

/** Readouts sit on the map without competing with its gesture surface. */
function MapHud({
  view,
  walk,
  stops,
  sources,
  legends,
  desktop,
  showFoot,
  onOpenWalk,
}: MapHudProps) {
  const verdict = walkLabel(walk.verdict);
  const routeSummary = `${formatDistance(walk.totalM)} · ${formatDuration(walk.durationHours)}`;

  return (
    // It fills the map: without a size of its own, what is pinned to its bottom lands above it.
    <View pointerEvents="box-none" style={styles.hud}>
      <View pointerEvents="none" style={[styles.mapReadout, desktop && styles.mapReadoutDesktop]}>
        <View style={styles.scaleReadout} accessible accessibilityLabel="Map scale on Mars">
          <ScaleBar pixelsPerDegree={view.pixelsPerDegree} />
        </View>
        <MapLegend layers={legends} compact={!desktop} />
      </View>

      {showFoot ? (
        <View pointerEvents="box-none" style={[styles.mapFoot, desktop && styles.mapFootDesktop]}>
          {stops > 0 ? (
            <Pressable
              onPress={onOpenWalk}
              disabled={!onOpenWalk}
              accessibilityRole="button"
              accessibilityLabel={`Open walk plan. ${verdict}. ${routeSummary}`}
              style={({ pressed }) => [
                styles.routeStatus,
                { borderColor: walkColor(walk) },
                pressed && onOpenWalk && styles.routeStatusPressed,
              ]}>
              <Text style={[styles.routeVerdict, { color: walkColor(walk) }]}>{verdict}</Text>
              <Text style={styles.routeSummary}>{routeSummary}</Text>
            </Pressable>
          ) : null}
          {/* With no route yet, the way to make one is the loudest thing on the map. */}
          {stops === 0 ? (
            <View style={styles.mapCoach}>
              <Text style={styles.mapCoachTitle}>Click or tap the map to mark the first waypoint</Text>
              <Text style={styles.mapCoachText}>
                The walk goes from the base through each point you mark, and straight back.
              </Text>
            </View>
          ) : null}
          <View style={styles.mapHint}>
            {stops === 0 ? null : (
              <Text style={styles.mapHintText} numberOfLines={desktop ? 1 : 2}>
                {`${stops} ${stops === 1 ? 'waypoint' : 'waypoints'} · click or tap the map to add another`}
              </Text>
            )}
            <Text style={styles.mapCredit} numberOfLines={1}>
              North is up · {sources}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function walkLabel(verdict: WalkEvaluation['verdict']) {
  if (verdict === 'no-go') return 'NO-GO';
  return verdict.toUpperCase();
}

function walkColor(walk: WalkEvaluation) {
  switch (walk.verdict) {
    case 'go':
      return Colors.go;
    case 'caution':
      return Colors.caution;
    case 'no-go':
      return Colors.noGo;
  }
}

type DesktopPanelProps = {
  side: 'left' | 'right';
  visible: boolean;
  width: number;
  onToggle: () => void;
  /** Stays at the top of the panel, beside the button that folds it, while the content scrolls. */
  header?: ReactNode;
  /** A new key sends the content back to its top, as when the panel changes subject. */
  scrollKey?: string;
  children: ReactNode;
};

/** A desktop panel preserves the source console's collapsible three-column framing. */
function DesktopPanel({
  side,
  visible,
  width,
  onToggle,
  header,
  scrollKey,
  children,
}: DesktopPanelProps) {
  const expanding = side === 'left' ? 'Show layers panel' : 'Show walk plan panel';
  const collapsing = side === 'left' ? 'Hide layers panel' : 'Hide walk plan panel';
  const arrow = side === 'left' ? (visible ? '‹' : '›') : visible ? '›' : '‹';

  return (
    <View
      style={[
        styles.desktopPanel,
        side === 'left' ? styles.layersPanel : styles.walkPanel,
        { width: visible ? width : COLLAPSED_PANEL_WIDTH },
      ]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? collapsing : expanding}
        accessibilityState={{ expanded: visible }}
        style={({ pressed }) => [
          styles.panelToggle,
          side === 'left' ? styles.layersToggle : styles.walkToggle,
          !visible && (side === 'left' ? styles.layersToggleCollapsed : styles.walkToggleCollapsed),
          pressed && styles.panelTogglePressed,
        ]}>
        <Text style={styles.panelToggleText}>{arrow}</Text>
      </Pressable>
      {/* A solid band behind the controls at the top: the content scrolls under it, not through it. */}
      {visible ? <View pointerEvents="none" style={styles.panelBar} /> : null}
      {visible && header ? (
        <View style={[styles.panelHeader, side === 'left' ? styles.panelHeaderLeft : styles.panelHeaderRight]}>
          {header}
        </View>
      ) : null}
      {visible ? (
        <ScrollView
          key={scrollKey}
          style={styles.desktopPanelScroll}
          contentContainerStyle={styles.desktopPanelContent}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** The subjects of the right-hand panel, as one rounded control. */
function PanelTabs({
  selected,
  onChange,
}: {
  selected: PanelTab;
  onChange: (tab: PanelTab) => void;
}) {
  return (
    <View style={styles.panelTabs} accessibilityRole="tablist">
      {PANEL_TABS.map(({ id, label }) => {
        const chosen = id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: chosen }}
            style={({ pressed }) => [
              styles.panelTab,
              chosen && styles.tabSelected,
              pressed && !chosen && styles.tabPressed,
            ]}>
            <Text style={[styles.panelTabText, chosen && styles.tabTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MobileTabs({
  selected,
  onChange,
  bottomInset,
}: {
  selected: Tab;
  onChange: (tab: Tab) => void;
  bottomInset: number;
}) {
  return (
    <View
      style={[styles.mobileTabs, { marginBottom: bottomInset + Spacing.two }]}
      accessibilityRole="tablist">
      <TabButton label="Map" selected={selected === 'map'} onPress={() => onChange('map')} />
      <TabButton
        label="Layers"
        selected={selected === 'layers'}
        onPress={() => onChange('layers')}
      />
      <TabButton label="Walk" selected={selected === 'walk'} onPress={() => onChange('walk')} />
      <TabButton label="Site" selected={selected === 'site'} onPress={() => onChange('site')} />
      <TabButton
        label="Photos"
        selected={selected === 'photos'}
        onPress={() => onChange('photos')}
      />
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
      style={({ pressed }) => [
        styles.tab,
        selected && styles.tabSelected,
        pressed && styles.tabPressed,
      ]}>
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
      <Logo size={52} />
      <Text style={styles.unknownTitle}>Site not found</Text>
      <Text style={styles.unknownText}>There is no landing site with this address.</Text>
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          style={({ pressed }) => [styles.unknownLink, pressed && styles.brandPressed]}>
          <Text style={styles.unknownLinkText}>Back to the sites</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Colors.background,
  },
  controlBar: {
    zIndex: 10,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: Colors.background,
  },
  controlBarDesktop: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
  },
  headerTopDesktop: {
    gap: Spacing.three,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    minHeight: 44,
    paddingRight: Spacing.two,
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  brandPressed: {
    opacity: 0.7,
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandName: {
    flexShrink: 0,
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  brandAccent: {
    color: Colors.mars,
  },
  siteIdentity: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  siteIdentityDesktop: {
    flex: 0,
    minWidth: 210,
    paddingLeft: Spacing.two,
  },
  siteName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  siteMission: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  science: {
    flex: 1,
    minWidth: 0,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  telemetryScroll: {
    minHeight: 36,
  },
  telemetryScrollContent: {
    paddingRight: Spacing.three,
  },
  telemetry: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  telemetryDesktop: {
    marginLeft: 'auto',
    gap: Spacing.three,
  },
  telemetryCell: {
    minWidth: 82,
    gap: Spacing.half,
  },
  telemetryLabel: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  telemetryValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  desktopMain: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingBottom: Spacing.two + Spacing.one,
  },
  mapColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: Radius.pane,
    overflow: 'hidden',
  },
  mobileMain: {
    flex: 1,
    minHeight: 0,
  },
  mobileMapStack: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  mapArea: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: Colors.mapBackground,
  },
  hud: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  mapReadout: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: 72,
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  mapReadoutDesktop: {
    top: Spacing.four,
    left: Spacing.four,
  },
  scaleReadout: {
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  mapFoot: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  mapFootDesktop: {
    left: Spacing.four,
    right: Spacing.four,
    bottom: Spacing.four,
  },
  routeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  routeStatusPressed: {
    opacity: 0.8,
  },
  routeVerdict: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  routeSummary: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  mapCoach: {
    alignItems: 'center',
    gap: Spacing.half,
    maxWidth: 420,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.large,
    backgroundColor: Colors.text,
  },
  mapCoachTitle: {
    color: Colors.background,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  mapCoachText: {
    color: Colors.surfaceRaised,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    opacity: 0.72,
  },
  mapHint: {
    alignItems: 'center',
    gap: Spacing.half,
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.card,
  },
  mapHintText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  mapCredit: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
  desktopPanel: {
    position: 'relative',
    flexShrink: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: Radius.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  layersPanel: {
    flexGrow: 0,
  },
  walkPanel: {
    flexGrow: 0,
  },
  desktopPanelScroll: {
    flex: 1,
  },
  desktopPanelContent: {
    paddingTop: Spacing.three + 44 + Spacing.two,
    paddingBottom: Spacing.four,
  },
  panelToggle: {
    position: 'absolute',
    zIndex: 3,
    top: Spacing.two + Spacing.one,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassLight,
    borderRadius: Radius.pill,
  },
  layersToggle: {
    right: Spacing.two + Spacing.one,
  },
  walkToggle: {
    left: Spacing.two + Spacing.one,
  },
  layersToggleCollapsed: {
    right: Spacing.two,
  },
  walkToggleCollapsed: {
    left: Spacing.two,
  },
  panelTogglePressed: {
    backgroundColor: Colors.glassHover,
  },
  panelToggleText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 22,
  },
  panelBar: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    height: Spacing.three + 44,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  panelHeader: {
    position: 'absolute',
    zIndex: 3,
    top: Spacing.two + Spacing.one,
    height: 36,
  },
  // Beside the button that folds the panel, which is 36 wide and 12 from the edge.
  panelHeaderLeft: {
    left: Spacing.two + Spacing.one,
    right: Spacing.two + Spacing.one + 36 + Spacing.two,
  },
  panelHeaderRight: {
    left: Spacing.two + Spacing.one + 36 + Spacing.two,
    right: Spacing.two + Spacing.one,
  },
  panelTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.half,
    padding: Spacing.half + 1,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceRaised,
  },
  panelTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  panelTabText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  dataDivider: {
    height: Spacing.three,
  },
  mobileSheet: {
    position: 'absolute',
    zIndex: 6,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: Colors.glassStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glassBorder,
    borderTopLeftRadius: Radius.pane,
    borderTopRightRadius: Radius.pane,
  },
  mobileSheetScroll: {
    flexGrow: 0,
  },
  mobileSheetContent: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  mobileTabs: {
    zIndex: 7,
    flexDirection: 'row',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  tabSelected: {
    backgroundColor: Colors.text,
  },
  tabPressed: {
    backgroundColor: Colors.glassHover,
  },
  tabText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  tabTextSelected: {
    color: Colors.background,
  },
  unknown: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  unknownTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  unknownText: {
    maxWidth: 320,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  unknownLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
  },
  unknownLinkText: {
    color: Colors.background,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
