import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { HeadingTape, turnTo } from '@/components/heading-tape';
import { MiniMap } from '@/components/mini-map';
import { PanoramaView } from '@/components/panorama-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { VIKING_GLOBAL } from '@/data/layers';
import { sceneForWalk, sceneStretch } from '@/data/panoramas';
import { SURFACE_RADIATION } from '@/data/radiation';
import { SITES, findSite, type Site } from '@/data/sites';
import { MARS_WIND } from '@/data/sounds';
import { REMS_CREDIT, REMS_FEED, parseWeather } from '@/data/weather';
import { elapsedSeconds } from '@/mission/clock';
import {
  formatClock,
  formatDistance,
  formatDose,
  formatDuration,
  formatShare,
} from '@/mission/format';
import { bearing } from '@/mission/geo';
import { walkProgress, type WalkProgress } from '@/mission/progress';
import { walkSafety, type SafetyAlert, type SafetyLevel, type WalkSafety } from '@/mission/safety';
import { WALK_ASSUMPTIONS } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { AMBIENT_SOUND_AVAILABLE, useAmbientSound } from '@/state/use-ambient-sound';
import { useFeed } from '@/state/use-feed';
import { useNow } from '@/state/use-now';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** Degrees the head turns for each pixel dragged, and for each press of an arrow key. */
const LOOK_PER_PIXEL = 0.22;
const LOOK_PER_KEY = 6;
/** The head starts tilted a little down, at the ground ahead. */
const RESTING_PITCH = -4;
/** How far up and down the head can tilt, in degrees: the photographs are bands, not spheres. */
const PITCH_UP = 22;
const PITCH_DOWN = -14;
/** Length of a step, in metres, and how far it lifts the view, in pixels. */
const STEP = 0.75;
const SWAY = 5;
/** The minimap shows about 300 m around the astronaut. */
const MINIMAP_PIXELS_PER_DEGREE = 26_000;
/** From this width the instruments sit in one row along the rim of the helmet. */
const WIDE = 760;

type Look = { yaw: number; pitch: number };
const AHEAD: Look = { yaw: 0, pitch: RESTING_PITCH };

const clampPitch = (pitch: number) => Math.min(PITCH_UP, Math.max(PITCH_DOWN, pitch));
const bearingText = (degrees: number) =>
  `${String(Math.round(((degrees % 360) + 360) % 360) % 360).padStart(3, '0')}°`;
const webOnly = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);

const LEVEL_COLOR: Record<SafetyLevel, string> = {
  nominal: Colors.go,
  caution: Colors.caution,
  warning: Colors.noGo,
};

/** The sentence for each alert code. The numbers come from the walk assumptions. */
function alertText(alert: SafetyAlert, safety: WalkSafety): string {
  const a = WALK_ASSUMPTIONS;
  switch (alert) {
    case 'life-support-exhausted':
      return 'LIFE SUPPORT EXHAUSTED';
    case 'turn-back-now':
      return 'TURN BACK NOW · the way home will use the reserve';
    case 'beyond-walk-back-limit':
      return `BEYOND THE ${a.walkBackLimitKm} km WALK-BACK LIMIT`;
    case 'return-margin-low':
      return `TURN BACK WITHIN ${formatDuration(safety.marginHours).toUpperCase()}`;
    case 'life-support-reserve':
      return `INTO THE ${formatShare(a.reserveFraction)} LIFE-SUPPORT RESERVE`;
    case 'near-walk-back-limit':
      return `NEAR THE ${a.walkBackLimitKm} km WALK-BACK LIMIT`;
  }
}

export default function VisorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = findSite(id);
  return site ? <Visor key={site.id} site={site} /> : <UnknownSite />;
}

function Visor({ site }: { site: Site }) {
  const insets = useSafeAreaInsets();
  const route = useRoute(site.id);
  const clock = useMission((state) => state.clocks[site.id]) ?? null;
  // Fast enough for the sway of the steps to look like walking.
  const now = useNow(clock?.running ?? false, 60);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The mission decides where the astronaut is and which way they walk; the head is theirs.
  const [look, setLook] = useState<Look>(AHEAD);
  const [sources, setSources] = useState(false);
  const drag = useRef<{ x: number; y: number; look: Look } | null>(null);
  // Real wind, recorded on Mars. It starts only when the astronaut asks for it.
  const sound = useAmbientSound(MARS_WIND.url);
  // The only weather station is at Gale; elsewhere there is no reading to put on the display.
  const weather = useFeed(site.id === 'gale' ? REMS_FEED : null, parseWeather);

  // The arrow keys turn the head too, for whoever is not using a pointer.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const turn = (event: KeyboardEvent) => {
      const step: Partial<Record<string, Look>> = {
        ArrowLeft: { yaw: -LOOK_PER_KEY, pitch: 0 },
        ArrowRight: { yaw: LOOK_PER_KEY, pitch: 0 },
        ArrowUp: { yaw: 0, pitch: LOOK_PER_KEY },
        ArrowDown: { yaw: 0, pitch: -LOOK_PER_KEY },
      };
      const by = step[event.key];
      if (!by) return;
      event.preventDefault();
      setLook((from) => ({ yaw: from.yaw + by.yaw, pitch: clampPitch(from.pitch + by.pitch) }));
    };
    window.addEventListener('keydown', turn);
    return () => window.removeEventListener('keydown', turn);
  }, []);

  const elapsedHours = clock ? elapsedSeconds(clock, now) / 3600 : 0;
  const progress = walkProgress(site.landing, route, elapsedHours, SURFACE_RADIATION.msvPerDay);
  const safety = walkSafety(progress);
  const heading = (((progress.heading + look.yaw) % 360) + 360) % 360;

  const over = clock !== null && progress.totalHours > 0 && elapsedHours >= progress.totalHours;
  const moving = clock !== null && !over && progress.phase !== 'at-base';
  const offTarget = moving ? turnTo(heading, progress.bearingToTarget) : 0;
  const turned = Math.abs(turnTo(0, look.yaw)) > 2 || Math.abs(look.pitch - RESTING_PITCH) > 2;
  const homeBearing = bearing(progress.position, site.landing);
  const etaHours = progress.distanceToTargetM / 1000 / WALK_ASSUMPTIONS.walkingSpeedKmh;

  const status =
    clock === null
      ? 'STANDBY'
      : over
        ? 'MISSION COMPLETE'
        : !clock.running
          ? 'HOLD · PAUSED BY THE SHIP'
          : progress.phase === 'working'
            ? `WORKING AT WAYPOINT ${(progress.stop ?? 0) + 1}`
            : progress.phase === 'returning'
              ? 'RETURNING TO THE BASE'
              : `WALKING TO WAYPOINT ${(progress.stop ?? 0) + 1}`;
  const link =
    clock === null
      ? 'SHIP LINK · waiting for the ship to start the walk'
      : `SHIP LINK · ${clock.running ? 'live' : 'on hold'} · ${clock.rate === 1 ? 'real time' : `${clock.rate}x`}`;

  // The scenery: a real photograph of the site, and a new one every stretch of walking.
  const stretch = sceneStretch(WALK_ASSUMPTIONS.walkingSpeedKmh, clock?.rate ?? 1);
  const scene = sceneForWalk(
    site.id,
    site.landing,
    progress.position,
    progress.walkedM,
    progress.phase === 'at-base',
    stretch,
  );
  const { panorama, awayM, borrowed } = scene;
  // Steps lift the view a little, near real time only: played fast it would be a blur.
  const stepping =
    clock?.running === true &&
    clock.rate <= 10 &&
    (progress.phase === 'walking' || progress.phase === 'returning');
  const sway = stepping ? Math.abs(Math.sin((progress.walkedM / STEP) * Math.PI)) * SWAY : 0;
  const layers = [VIKING_GLOBAL, ...site.layers];
  const path = [site.landing, ...route, site.landing];
  const latest = weather.status === 'ready' ? weather.data[0] : undefined;

  const wide = (size?.width ?? 0) >= WIDE;
  // The lower rim of the helmet carries the instruments, and keeps the bottom of the photograph,
  // where the rover that took it shows, out of the astronaut's view.
  const rim = (wide ? 214 : 318) + insets.bottom;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  };
  const pointer = (event: GestureResponderEvent) => ({
    x: event.nativeEvent.pageX,
    y: event.nativeEvent.pageY,
  });

  const lifeSupport = (
    <Instrument title="LIFE SUPPORT">
      <Text style={[styles.big, { color: LEVEL_COLOR[safety.level] }]}>
        {formatDuration(safety.hoursLeft)}
      </Text>
      <View
        style={styles.meter}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Life support used: ${formatShare(progress.lifeSupportUsed)}`}>
        <View
          style={[
            styles.meterFill,
            {
              width: `${Math.max(0, 1 - Math.min(1, progress.lifeSupportUsed)) * 100}%`,
              backgroundColor: LEVEL_COLOR[safety.level],
            },
          ]}
        />
        {/* Below this mark is the reserve. */}
        <View
          style={[styles.meterMark, { left: `${WALK_ASSUMPTIONS.reserveFraction * 100}%` }]}
        />
      </View>
      <Reading label="Way back to base" value={formatDuration(safety.returnHours)} />
      <Reading
        label="Time to spare"
        value={safety.marginHours > 0 ? formatDuration(safety.marginHours) : 'None'}
        color={
          safety.marginHours <= 0
            ? Colors.noGo
            : safety.alerts.includes('return-margin-low')
              ? Colors.caution
              : undefined
        }
      />
    </Instrument>
  );

  const navigation = (
    <View style={styles.navigation}>
      {/* Drawn in the browser only: how sharp its tiles are depends on the screen. */}
      {size ? (
        <MiniMap
          layers={layers}
          centre={progress.position}
          heading={heading}
          pixelsPerDegree={MINIMAP_PIXELS_PER_DEGREE}
          diameter={wide ? 132 : 116}
          route={path}
          base={site.landing}
        />
      ) : (
        <View style={styles.mapSpace} />
      )}
      <Text style={styles.home}>
        BASE {formatDistance(progress.distanceToBaseM)} · {bearingText(homeBearing)}
      </Text>
    </View>
  );

  const mission = (
    <Instrument title="MISSION">
      <Reading
        label="Waypoints done"
        value={route.length === 0 ? 'No route' : `${progress.stopsDone} of ${route.length}`}
      />
      <Reading
        label={progress.phase === 'working' ? 'Work left here' : 'This leg'}
        value={moving ? formatDuration(progress.phaseHoursLeft) : 'None'}
      />
      <Reading label="Mission clock" value={formatClock(progress.elapsedHours)} />
      <Reading label="Planned" value={formatClock(progress.totalHours)} />
    </Instrument>
  );

  const environment = (
    <Instrument title="ENVIRONMENT">
      <Reading label="Radiation dose" value={formatDose(progress.doseMsv)} />
      <Reading label="Dose rate" value={`${SURFACE_RADIATION.msvPerDay} mSv/day`} />
      <Reading
        label="Air"
        value={
          latest && latest.minAirC !== null && latest.maxAirC !== null
            ? `${latest.minAirC} to ${latest.maxAirC} °C`
            : weather.status === 'loading'
              ? 'Asking'
              : 'No reading'
        }
      />
      <Reading
        label="Pressure"
        value={latest && latest.pressurePa !== null ? `${latest.pressurePa} Pa` : 'No reading'}
      />
    </Instrument>
  );

  return (
    <View
      style={[styles.screen, webOnly({ cursor: 'grab', touchAction: 'none', userSelect: 'none' })]}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        drag.current = { ...pointer(event), look };
      }}
      onResponderMove={(event) => {
        const start = drag.current;
        if (!start) return;
        const at = pointer(event);
        // Like turning a globe from inside: the scene follows the pointer.
        setLook({
          yaw: start.look.yaw - (at.x - start.x) * LOOK_PER_PIXEL,
          pitch: clampPitch(start.look.pitch + (at.y - start.y) * LOOK_PER_PIXEL),
        });
      }}
      onResponderRelease={() => {
        drag.current = null;
      }}>
      <Head>
        <title>{`Visor, ${site.name} | Armstrong Maps`}</title>
        <meta name="description" content={`Astronaut visor for a walk at ${site.name} on Mars.`} />
      </Head>

      {size ? (
        <PanoramaView
          panorama={panorama}
          heading={heading}
          pitch={look.pitch}
          size={size}
          sway={sway}
        />
      ) : null}

      {/* The glass of the helmet: darker towards the rim. */}
      <View
        style={[
          styles.fill,
          webOnly({
            backgroundImage:
              'radial-gradient(ellipse at 50% 40%, rgba(7,9,13,0) 50%, rgba(7,9,13,0.4) 80%, rgba(7,9,13,0.85) 100%)',
          }),
        ]}
        pointerEvents="none"
      />
      {size ? <Rim width={size.width} height={size.height} rim={rim} /> : null}

      {/* Top of the display: heading, state of the mission, link with the ship. */}
      <View style={[styles.top, { paddingTop: insets.top }]} pointerEvents="box-none">
        {size ? (
          <HeadingTape
            heading={heading}
            target={moving ? progress.bearingToTarget : null}
            width={size.width}
          />
        ) : null}
        <View style={styles.bar} pointerEvents="box-none">
          <Link
            href={{ pathname: '/site/[id]', params: { id: site.id } }}
            style={styles.back}
            accessibilityRole="link"
            accessibilityLabel="Go to the ship console of this site">
            {'‹'} Console
          </Link>
          {wide ? (
            <View style={styles.state} pointerEvents="none">
              <Text style={styles.status} numberOfLines={1} accessibilityLiveRegion="polite">
                {status}
              </Text>
              <Text style={styles.link} numberOfLines={1}>
                {link}
              </Text>
            </View>
          ) : (
            <View style={styles.state} />
          )}
          <Text style={styles.heading} pointerEvents="none">
            HDG {bearingText(heading)}
          </Text>
          {AMBIENT_SOUND_AVAILABLE ? (
            <Toggle
              label="Sound of the wind on Mars, recorded by Perseverance"
              text={sound.failed ? 'No sound' : sound.playing ? 'Sound on' : 'Sound off'}
              on={sound.playing}
              onPress={() => void sound.toggle()}
            />
          ) : null}
        </View>
        {/* On a phone the bar has no room for it, so the state of the mission has its own line. */}
        {wide ? null : (
          <View style={styles.stateLine} pointerEvents="none">
            <Text style={styles.status} numberOfLines={1} accessibilityLiveRegion="polite">
              {status}
            </Text>
            <Text style={styles.link} numberOfLines={1}>
              {link}
            </Text>
          </View>
        )}

        {safety.alerts.slice(0, 2).map((alert) => (
          <View
            key={alert}
            style={[styles.alert, { borderColor: LEVEL_COLOR[safety.level] }]}
            pointerEvents="none"
            accessibilityRole="alert">
            <Text style={[styles.alertText, { color: LEVEL_COLOR[safety.level] }]}>
              {alertText(alert, safety)}
            </Text>
          </View>
        ))}
      </View>

      {/* Through the glass: the point to walk to. */}
      <View style={[styles.through, { bottom: rim }]} pointerEvents="none">
        <View style={styles.reticle} />
        {moving ? <Target progress={progress} offTarget={offTarget} etaHours={etaHours} /> : null}
        {clock === null ? (
          <Text style={styles.waiting}>
            {route.length === 0
              ? 'No walk planned. Draw a route in the ship console.'
              : 'Route loaded. The ship starts the walk.'}
          </Text>
        ) : null}
      </View>

      {/* On the rim of the helmet: what keeps the astronaut alive and the mission on course. */}
      <View
        style={[styles.cluster, { height: rim - 30, paddingBottom: insets.bottom + Spacing.two }]}
        pointerEvents="box-none">
        {wide ? (
          <View style={styles.row} pointerEvents="none">
            {lifeSupport}
            {mission}
            {navigation}
            {environment}
          </View>
        ) : (
          <>
            <View style={styles.row} pointerEvents="none">
              {lifeSupport}
              {navigation}
            </View>
            <View style={styles.row} pointerEvents="none">
              {mission}
              {environment}
            </View>
          </>
        )}
        <View style={styles.foot} pointerEvents="box-none">
          <Text style={styles.tag} numberOfLines={1} pointerEvents="none">
            SIMULATED MISSION · REAL PHOTO {scene.index + 1}/{scene.count} AND SOUND OF MARS
          </Text>
          {turned ? (
            <Toggle
              label="Look the way I am walking again"
              text="Face ahead"
              on={false}
              onPress={() => setLook(AHEAD)}
            />
          ) : null}
          <Toggle
            label="What on this display is measured, simulated or assumed"
            text="Sources"
            on={sources}
            onPress={() => setSources((open) => !open)}
          />
        </View>
      </View>

      {sources ? (
        <View style={[styles.sources, { bottom: rim + Spacing.two }]} pointerEvents="none">
          <Text style={styles.sourcesText}>
            The position, the clock, life support and the dose are simulated from the plan. The
            limits are project assumptions, not NASA rules: {WALK_ASSUMPTIONS.lifeSupportHours} h of
            life support with a {formatShare(WALK_ASSUMPTIONS.reserveFraction)} reserve,{' '}
            {WALK_ASSUMPTIONS.walkingSpeedKmh} km/h on foot, a {WALK_ASSUMPTIONS.walkBackLimitKm} km
            walk-back limit.
          </Text>
          <Text style={styles.sourcesText}>
            Photo: {panorama.caption}. {panorama.credit}, images.nasa.gov/details/
            {panorama.nasaId}. A real 360-degree mosaic taken by the rover;{' '}
            {borrowed
              ? `there is none from ${site.name}, so this one is from Gale Crater. `
              : awayM === null
                ? 'where exactly is not in the data. '
                : `taken ${formatDistance(awayM)} from the simulated position. `}
            {panorama.north === null
              ? 'It is not lined up with the compass.'
              : 'It is lined up with the compass.'}{' '}
            Black areas are where the camera took no frame; the sky above the frames is filled in.
            {scene.count > 1
              ? ` The scenery changes every ${formatDistance(stretch)} walked, through the ${scene.count} photographs of this site, to give the sense of ground being covered: no camera filmed the way between them, and the dust in the cut from one to the next is drawn.`
              : ''}
          </Text>
          <Text style={styles.sourcesText}>
            Sound: real wind recorded by the SuperCam microphone of Perseverance at Jezero Crater on{' '}
            {MARS_WIND.when}, on a loop and played louder than published
            {site.id === MARS_WIND.site ? '' : '; it was not recorded at this site'}.{' '}
            {MARS_WIND.credit}.
          </Text>
          <Text style={styles.sourcesText}>
            Dose rate: {SURFACE_RADIATION.source}, a published average.{' '}
            {site.id === 'gale'
              ? latest
                ? `Weather: ${REMS_CREDIT}, sol ${latest.sol} (${latest.earthDate}).`
                : 'Weather: the station feed has not answered.'
              : 'Weather: the only station is at Gale Crater, so none is shown here.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The lower rim of the helmet, with an edge that catches the light. */
function Rim({ width, height, rim }: { width: number; height: number; rim: number }) {
  const top = height - rim;
  const rise = 30;
  const edge = `M0 ${top + rise}Q${width / 2} ${top - rise} ${width} ${top + rise}`;
  return (
    <Svg width={width} height={height} style={styles.overlay} pointerEvents="none">
      <Path d={`${edge}L${width} ${height}L0 ${height}Z`} fill={Colors.background} opacity={0.96} />
      <Path d={edge} fill="none" stroke={DISPLAY} strokeWidth={1.5} opacity={0.5} />
    </Svg>
  );
}

function Instrument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.instrument}>
      <Text style={styles.instrumentTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Reading({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.reading}>
      <Text style={styles.readingLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.readingValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type TargetProps = { progress: WalkProgress; offTarget: number; etaHours: number };

/** The next point to reach: how far, which way, and when. */
function Target({ progress, offTarget, etaHours }: TargetProps) {
  return (
    <View style={styles.target}>
      <Text style={styles.targetLabel}>
        {progress.stop === null ? 'BASE' : `WAYPOINT ${progress.stop + 1}`}
      </Text>
      <Text style={styles.targetValue}>{formatDistance(progress.distanceToTargetM)}</Text>
      <Text style={styles.targetHint}>
        {progress.phase === 'working'
          ? `Next after the work here · ${bearingText(progress.bearingToTarget)}`
          : Math.abs(offTarget) < 8
            ? `Ahead · ${bearingText(progress.bearingToTarget)} · ${formatDuration(etaHours)}`
            : `${offTarget < 0 ? '◀ Look left' : 'Look right ▶'} ${Math.round(Math.abs(offTarget))}°`}
      </Text>
    </View>
  );
}

type ToggleProps = { label: string; text: string; on: boolean; onPress: () => void };

function Toggle({ label, text, on, onPress }: ToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.toggle, on && styles.toggleOn]}>
      <Text style={styles.toggleText}>{text}</Text>
    </Pressable>
  );
}

function UnknownSite() {
  return (
    <View style={[styles.screen, styles.unknown]}>
      <Head>
        <title>Site not found | Armstrong Maps</title>
      </Head>
      <Text style={styles.status}>SITE NOT FOUND</Text>
      <Link href="/" style={styles.back} accessibilityRole="link">
        {'‹'} Sites
      </Link>
    </View>
  );
}

/** Behind text that sits on the photograph, so it reads over bright ground and sky. */
const PLATE = 'rgba(7, 9, 13, 0.66)';
/** The colour of the display. */
const DISPLAY = '#B8FFE0';
const glow = webOnly({ textShadow: '0 0 8px rgba(61, 214, 140, 0.55)' });

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  unknown: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.two,
  },
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: PLATE,
  },
  back: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
    minHeight: 44,
  },
  state: {
    flex: 1,
    gap: Spacing.half,
  },
  stateLine: {
    alignSelf: 'stretch',
    gap: Spacing.half,
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: PLATE,
  },
  status: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    ...glow,
  },
  link: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  heading: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    ...glow,
  },
  alert: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1.5,
    backgroundColor: 'rgba(7, 9, 13, 0.85)',
    maxWidth: '92%',
  },
  alertText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  through: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  reticle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: DISPLAY,
  },
  waiting: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: PLATE,
    textAlign: 'center',
    overflow: 'hidden',
  },
  target: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.nav,
    backgroundColor: PLATE,
  },
  targetLabel: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  targetValue: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    ...glow,
  },
  targetHint: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  cluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  instrument: {
    flex: 1,
    maxWidth: 280,
    gap: Spacing.one,
  },
  instrumentTitle: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  big: {
    fontFamily: Fonts.mono,
    fontSize: 24,
    fontWeight: '700',
    ...glow,
  },
  meter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
  },
  meterMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.text,
  },
  reading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  readingLabel: {
    flexShrink: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  readingValue: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  navigation: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  mapSpace: {
    width: 116,
    height: 116,
  },
  home: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  tag: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  toggle: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 224, 0.45)',
    backgroundColor: 'rgba(7, 9, 13, 0.5)',
  },
  toggleOn: {
    borderColor: DISPLAY,
    backgroundColor: 'rgba(61, 214, 140, 0.2)',
  },
  toggleText: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sources: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 224, 0.35)',
    backgroundColor: 'rgba(7, 9, 13, 0.92)',
  },
  sourcesText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
});
