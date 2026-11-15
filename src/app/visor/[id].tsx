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
import {
  eyeDistance,
  lowestPitch,
  panoramaUrl,
  sceneForWalk,
  sceneStretch,
  scenesOf,
} from '@/data/panoramas';
import { SURFACE_RADIATION } from '@/data/radiation';
import { SITES, findSite, type Site } from '@/data/sites';
import { MARS_WIND } from '@/data/sounds';
import { REMS_CREDIT, REMS_FEED, parseWeather, readingAgeDays } from '@/data/weather';
import { elapsedSeconds } from '@/mission/clock';
import { LINK_ASSUMPTIONS } from '@/mission/line-of-sight';
import { messageToAcknowledge } from '@/mission/messages';
import {
  formatClock,
  formatDistance,
  formatDose,
  formatDuration,
  formatShare,
} from '@/mission/format';
import { bearing } from '@/mission/geo';
import {
  WORK_PLAYBACK,
  walkHoursPlayed,
  walkProgress,
  type WalkProgress,
} from '@/mission/progress';
import { walkSafety, type SafetyAlert, type SafetyLevel, type WalkSafety } from '@/mission/safety';
import { WALK_ASSUMPTIONS } from '@/mission/walk';
import { VISOR_READY_KEY, useMessages, useMission, useRoute } from '@/state/mission';
import { useAlertSignal } from '@/state/use-alert-signal';
import { AMBIENT_SOUND_AVAILABLE, useAmbientSound } from '@/state/use-ambient-sound';
import { useFeed } from '@/state/use-feed';
import { useNow } from '@/state/use-now';
import { usePhoneLook } from '@/state/use-phone-look';
import { useReducedMotion } from '@/state/use-reduced-motion';

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
      return 'Life support exhausted';
    case 'turn-back-now':
      return 'Turn back now: the way home will use the reserve';
    case 'beyond-walk-back-limit':
      return `Beyond the ${a.walkBackLimitKm} km walk-back limit`;
    case 'return-margin-low':
      return `Turn back within ${formatDuration(safety.marginHours)}`;
    case 'life-support-reserve':
      return `Into the ${formatShare(a.reserveFraction)} life-support reserve`;
    case 'near-walk-back-limit':
      return `Near the ${a.walkBackLimitKm} km walk-back limit`;
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
  // Asked for less movement, the picture holds still and a change of scene is a plain fade.
  const calm = useReducedMotion();
  // Fast enough for the move into the photograph to be smooth.
  const now = useNow(clock?.running ?? false, 60);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The mission decides where the astronaut is and which way they walk; the head is theirs.
  const [look, setLook] = useState<Look>(AHEAD);
  const [sources, setSources] = useState(false);
  const drag = useRef<{ x: number; y: number; look: Look } | null>(null);
  // Real wind, recorded on Mars. It starts only when the astronaut asks for it.
  const sound = useAmbientSound(MARS_WIND.url);
  // The head can follow the phone instead of a finger. It turns by as much as the phone turned
  // since this was switched on, from where the head was then: it is not a compass.
  const lookAtStart = useRef<Look>(AHEAD);
  const phone = usePhoneLook((change) =>
    setLook({
      yaw: lookAtStart.current.yaw + change.yaw,
      pitch: clampPitch(lookAtStart.current.pitch + change.pitch),
    }),
  );
  // The only weather station is at Gale; elsewhere there is no reading to put on the display.
  const weather = useFeed(site.id === 'gale' ? REMS_FEED : null, parseWeather);

  // The ship console holds the start of a walk until this tab has something to show: say so
  // once the first photograph is in, or after a while if it does not come.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let told = false;
    const tell = () => {
      if (told) return;
      told = true;
      try {
        window.localStorage.setItem(
          VISOR_READY_KEY,
          JSON.stringify({ site: site.id, at: Date.now() }),
        );
      } catch {
        // No storage here: the console starts the walk by itself after a few seconds.
      }
    };
    const opening = scenesOf(site.id, site.landing).scenes[0];
    const timer = setTimeout(tell, 6000);
    if (opening) {
      const first = new Image();
      first.src = panoramaUrl(opening, false);
      first.decode().then(tell, tell);
    } else {
      tell();
    }
    return () => clearTimeout(timer);
  }, [site]);

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

  // The same reading of the clock as the ship console: walking as it is, work at a stop faster.
  const elapsedHours = clock
    ? walkHoursPlayed(site.landing, route, elapsedSeconds(clock, now) / 3600)
    : 0;
  const progress = walkProgress(site.landing, route, elapsedHours, SURFACE_RADIATION.msvPerDay);
  const safety = walkSafety(progress);
  // A new alert is heard as well as shown, once, while the sound is on.
  const alertSignal = useAlertSignal(safety.alerts, sound.playing);

  // The link with the ship. The ship works out whether it sees the astronaut over the
  // ground; while it does not, nothing it sends gets through.
  const messages = useMessages(site.id);
  const linkState = useMission((state) => state.links[site.id]) ?? null;
  const showMessages = useMission((state) => state.showMessages);
  const acknowledgeMessage = useMission((state) => state.acknowledgeMessage);
  const linkDown = clock !== null && linkState === 'blocked';
  const unshown = messages.filter((message) => message.shownHours === null).length;
  const walkHours = progress.elapsedHours;
  useEffect(() => {
    // A message is marked as shown the moment the visor can show it. This and the
    // acknowledgement are all the visor writes: the clock stays with the ship.
    if (clock !== null && !linkDown && unshown > 0) showMessages(site.id, walkHours);
  }, [clock, linkDown, unshown, showMessages, site.id, walkHours]);
  const toAcknowledge = clock !== null ? messageToAcknowledge(messages) : null;
  const heading = (((progress.heading + look.yaw) % 360) + 360) % 360;

  const over = clock !== null && progress.totalHours > 0 && elapsedHours >= progress.totalHours;
  const moving = clock !== null && !over && progress.phase !== 'at-base';
  const offTarget = moving ? turnTo(heading, progress.bearingToTarget) : 0;
  const turned = Math.abs(turnTo(0, look.yaw)) > 2 || Math.abs(look.pitch - RESTING_PITCH) > 2;
  const homeBearing = bearing(progress.position, site.landing);
  const etaHours = progress.distanceToTargetM / 1000 / WALK_ASSUMPTIONS.walkingSpeedKmh;

  const status =
    clock === null
      ? 'Standby'
      : over
        ? 'Mission complete'
        : !clock.running
          ? 'On hold · paused by the ship'
          : progress.phase === 'working'
            ? `Working at waypoint ${(progress.stop ?? 0) + 1}`
            : progress.phase === 'returning'
              ? 'Returning to the base'
              : `Walking to waypoint ${(progress.stop ?? 0) + 1}`;
  const link =
    clock === null
      ? 'Ship link · waiting for the ship to start the walk'
      : linkDown
        ? 'Ship link · lost · no line of sight to the base'
        : `Ship link · ${clock.running ? 'live' : 'on hold'} · ${clock.rate === 1 ? 'real time' : `${clock.rate}x`}`;

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
  // How far through this scene's stretch the astronaut is: the view moves that far into it.
  // That slow move is the only movement of the picture. It does not rise and fall with the
  // steps: at the speeds a walk is played, that reads as shaking.
  const advance =
    progress.phase === 'at-base' ? 0 : (progress.walkedM % stretch) / stretch;
  const layers = [VIKING_GLOBAL, ...site.layers];
  const path = [site.landing, ...route, site.landing];
  const latest = weather.status === 'ready' ? weather.data[0] : undefined;

  const wide = (size?.width ?? 0) >= WIDE;
  // The lower rim of the helmet carries the instruments, and keeps the bottom of the photograph,
  // where the rover that took it shows, out of the astronaut's view.
  const rim = (wide ? 214 : 318) + insets.bottom;

  // Where the photograph has no ground to show (a mosaic without frames there, or the rover in
  // the way), the view is held a little higher, so that what is missing stays under the rim.
  const RAD = Math.PI / 180;
  const eye = size ? eyeDistance(size) : null;
  const floor =
    size && eye
      ? lowestPitch(panorama, heading, {
          downDeg: Math.atan((size.height / 2 - rim) / eye) / RAD,
          sideDeg: Math.atan(size.width / 2 / eye) / RAD,
          lowest: PITCH_DOWN,
        })
      : null;
  const pitch = floor === null ? look.pitch : Math.max(look.pitch, Math.min(PITCH_UP, floor));

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
    <Instrument title="Life support">
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
        Base {formatDistance(progress.distanceToBaseM)} · {bearingText(homeBearing)}
      </Text>
    </View>
  );

  const mission = (
    <Instrument title="Mission">
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

  const weatherAge = latest ? readingAgeDays(latest.earthDate, new Date(now)) : null;

  const environment = (
    <Instrument title="Environment">
      <Reading label="Dose" value={formatDose(progress.doseMsv)} />
      <Reading label="Dose rate" value={`${SURFACE_RADIATION.msvPerDay} mSv/day`} />
      <Reading
        label="Air"
        value={
          latest && latest.minAirC !== null && latest.maxAirC !== null
            ? `${latest.minAirC} to ${latest.maxAirC} °C`
            : weather.status === 'loading'
              ? 'Fetching'
              : 'No reading'
        }
      />
      <Reading
        label="Pressure"
        value={latest && latest.pressurePa !== null ? `${latest.pressurePa} Pa` : 'No reading'}
      />
      {/* The weather is the last the station sent, which can be months old: the display says so. */}
      {weatherAge !== null ? (
        <Reading label="Weather" value={weatherAge === 0 ? 'today' : `${weatherAge} d ago`} />
      ) : null}
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
        // While the head follows the phone, a finger does not turn it too.
        drag.current = phone.on ? null : { ...pointer(event), look };
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
          pitch={pitch}
          size={size}
          advance={advance}
          still={calm}
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
        <View style={[styles.bar, TOP_SHADE]} pointerEvents="box-none">
          <Link
            href={{ pathname: '/site/[id]', params: { id: site.id } }}
            style={[styles.back, GLASS, webOnly({ whiteSpace: 'nowrap' })]}
            accessibilityRole="link"
            accessibilityLabel="Go to the ship console of this site">
            {'‹'} Console
          </Link>
          {wide ? (
            <View style={styles.state} pointerEvents="none">
              {/* On its own plate, like every text here: the sky behind it can be white. */}
              <View style={[styles.statePlate, GLASS]}>
                <Text style={styles.status} numberOfLines={1} accessibilityLiveRegion="polite">
                  {status}
                </Text>
                <Text style={[styles.link, linkDown && styles.linkDown]} numberOfLines={1}>
                  {link}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.state} />
          )}
          <View style={[styles.headingPill, GLASS]} pointerEvents="none">
            <Text style={styles.headingLabel}>Heading</Text>
            <Text style={styles.heading}>{bearingText(heading)}</Text>
          </View>
          {AMBIENT_SOUND_AVAILABLE ? (
            <Toggle
              label="Sound of the wind on Mars, recorded by Perseverance, and a tone when an alert appears"
              text={sound.failed ? 'No sound' : sound.playing ? 'Sound on' : 'Sound off'}
              on={sound.playing}
              onPress={() => {
                // The same press lets the alert tone play: a browser starts sound only from one.
                alertSignal.arm();
                void sound.toggle();
              }}
            />
          ) : null}
        </View>
        {/* On a phone the bar has no room for it, so the state of the mission has its own line. */}
        {wide ? null : (
          <View style={[styles.stateLine, GLASS]} pointerEvents="none">
            <Text style={styles.status} numberOfLines={1} accessibilityLiveRegion="polite">
              {status}
            </Text>
            <Text style={[styles.link, linkDown && styles.linkDown]} numberOfLines={1}>
              {link}
            </Text>
          </View>
        )}

        {safety.alerts.slice(0, 2).map((alert) => (
          <View
            key={alert}
            style={[styles.alert, GLASS, { borderColor: LEVEL_COLOR[safety.level] }]}
            pointerEvents="none"
            accessibilityRole="alert">
            <View style={[styles.alertDot, { backgroundColor: LEVEL_COLOR[safety.level] }]} />
            <Text style={styles.alertText}>{alertText(alert, safety)}</Text>
          </View>
        ))}

        {/* The point to walk to, at the side so it does not cover the way ahead. It follows
            the state of the mission and any alert, so it never lands on top of them. */}
        {moving ? (
          <View style={[styles.side, { marginLeft: insets.left + Spacing.three }]} pointerEvents="none">
            <Target
              progress={progress}
              offTarget={offTarget}
              etaHours={etaHours}
              stops={route.length}
            />
          </View>
        ) : null}

        {/* A message from the ship, until the astronaut says it was read. */}
        {toAcknowledge ? (
          <View style={[styles.side, { marginLeft: insets.left + Spacing.three }]}>
            <View style={[styles.message, GLASS]} accessibilityRole="alert">
              <Text style={styles.messageFrom}>
                From the ship · {formatClock(toAcknowledge.sentHours)}
              </Text>
              <Text style={styles.messageText}>{toAcknowledge.text}</Text>
              <Pressable
                onPress={() => acknowledgeMessage(site.id, toAcknowledge.id, walkHours)}
                accessibilityRole="button"
                accessibilityLabel="Acknowledge the message from the ship"
                style={({ pressed }) => [styles.messageAck, pressed && styles.messageAckPressed]}>
                <Text style={styles.messageAckText}>Acknowledge</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Through the glass: where the astronaut looks. The middle of the view stays clear. */}
      <View style={[styles.through, { bottom: rim }]} pointerEvents="none">
        <View style={styles.reticle} />
        {clock === null ? (
          <View style={[styles.waiting, GLASS]}>
            <Text style={styles.waitingText}>
              {route.length === 0
                ? 'No walk planned. Draw a route in the ship console.'
                : 'Route loaded. The ship starts the walk.'}
            </Text>
          </View>
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
          {/* On a phone the buttons leave it no room on their line, so it has its own. */}
          <Text
            style={[styles.tag, !wide && styles.tagOwnLine]}
            numberOfLines={1}
            pointerEvents="none">
            Simulated mission · real photo {scene.index + 1}/{scene.count} and sound of Mars
          </Text>
          {phone.available ? (
            <Toggle
              label="Turn the view by turning the phone. It follows the phone, not a compass."
              text={
                phone.on
                  ? 'Phone look on'
                  : phone.failed === 'blocked'
                    ? 'Motion blocked'
                    : phone.failed === 'no-sensor'
                      ? 'No motion sensor'
                      : 'Phone look'
              }
              on={phone.on}
              onPress={() => {
                lookAtStart.current = look;
                void phone.toggle();
              }}
            />
          ) : null}
          {turned && !phone.on ? (
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
        <View style={[styles.sources, GLASS, { bottom: rim + Spacing.two }]} pointerEvents="none">
          <Text style={styles.sourcesText}>
            The position, the clock, life support and the dose are simulated from the plan. The
            work at a waypoint is played {WORK_PLAYBACK} times faster than the walking. The
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
            Black areas are where the camera took no frame; the sky above the frames, and any gap in it, is filled in.
            {panorama.groundGaps
              ? ' Where this photograph has no ground to show, the view is held a little higher: ground is never drawn in.'
              : ''}
            {scene.count > 1
              ? ` The scenery changes every ${formatDistance(stretch)} walked, through the ${scene.count} photographs of this site, to give the sense of ground being covered. Within a scene the view moves slowly into the still photograph. No camera filmed the way between two of them, and the dust in the cut from one to the next is drawn.`
              : ''}
          </Text>
          <Text style={styles.sourcesText}>
            Sound: real wind recorded by the SuperCam microphone of Perseverance at Jezero Crater on{' '}
            {MARS_WIND.when}, on a loop and played louder than published
            {site.id === MARS_WIND.site ? '' : '; it was not recorded at this site'}.{' '}
            {MARS_WIND.credit}. With the sound on, a short tone marks each alert when it appears,
            with a vibration where the phone allows it. The tone is drawn, not recorded.
          </Text>
          {phone.available ? (
            <Text style={styles.sourcesText}>
              Phone look: the view turns by as much as the phone has turned since it was switched
              on. It is not a compass reading: Mars has no global magnetic field to take one from.
            </Text>
          ) : null}
          <Text style={styles.sourcesText}>
            Ship link: the ship works out whether it sees the astronaut over the ground, from
            the NASA elevation model, a {LINK_ASSUMPTIONS.baseAntennaM} m mast at the base and an
            antenna {LINK_ASSUMPTIONS.suitAntennaM} m up on the suit. The antenna heights are
            assumptions. While there is no line of sight, messages from the ship wait.
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
      <Path d={`${edge}L${width} ${height}L0 ${height}Z`} fill={Colors.visorRim} />
      <Path d={edge} fill="none" stroke={Colors.white} strokeWidth={1} opacity={0.22} />
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

type TargetProps = {
  progress: WalkProgress;
  offTarget: number;
  etaHours: number;
  /** How many waypoints the route has. */
  stops: number;
};

/**
 * The next point to reach: how far, which way, and when. At a stop it is the work in hand
 * instead: how long is left of it, and where the walk goes afterwards.
 */
function Target({ progress, offTarget, etaHours, stops }: TargetProps) {
  if (progress.phase === 'working') {
    const stop = progress.stop ?? 0;
    const stopHours = WALK_ASSUMPTIONS.minutesPerStop / 60;
    const done = Math.min(1, Math.max(0, 1 - progress.phaseHoursLeft / stopHours));
    const next = stop + 1 < stops ? `waypoint ${stop + 2}` : 'the base';
    return (
      <View style={[styles.target, GLASS]}>
        <Text style={styles.targetLabel}>{`Working at waypoint ${stop + 1}`}</Text>
        <Text style={styles.targetValue}>{formatClock(progress.phaseHoursLeft)}</Text>
        <View
          style={styles.work}
          accessibilityRole="progressbar"
          accessibilityLabel={`Work done at this stop: ${formatShare(done)}`}>
          <View style={[styles.workDone, { width: `${done * 100}%` }]} />
        </View>
        <Text style={styles.targetHint}>
          {`Work played ${WORK_PLAYBACK}x faster · then ${next}, ${formatDistance(progress.distanceToTargetM)} at ${bearingText(progress.bearingToTarget)}`}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.target, GLASS]}>
      <Text style={styles.targetLabel}>
        {progress.stop === null ? 'Base' : `Waypoint ${progress.stop + 1}`}
      </Text>
      <Text style={styles.targetValue}>{formatDistance(progress.distanceToTargetM)}</Text>
      <Text style={styles.targetHint}>
        {Math.abs(offTarget) < 8
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
      style={({ pressed }) => [
        styles.toggle,
        GLASS,
        on && styles.toggleOn,
        pressed && styles.togglePressed,
      ]}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{text}</Text>
    </Pressable>
  );
}

function UnknownSite() {
  return (
    <View style={[styles.screen, styles.unknown]}>
      <Head>
        <title>Site not found | Armstrong Maps</title>
      </Head>
      <Text style={styles.status}>Site not found</Text>
      <Link href="/" style={styles.back} accessibilityRole="link">
        {'‹'} Sites
      </Link>
    </View>
  );
}

/**
 * Glass over the photograph: what is behind is blurred, so text reads over bright ground and
 * sky. Where a browser cannot blur, the dark fill of the piece does the work alone.
 */
const GLASS = webOnly({
  backdropFilter: 'blur(18px) saturate(140%)',
  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
});
/** The top of the display darkens the sky behind the controls, and lets go of it lower down. */
const TOP_SHADE = webOnly({
  backgroundImage: 'linear-gradient(rgba(4, 6, 10, 0.72), rgba(4, 6, 10, 0))',
});

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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  back: {
    flexShrink: 0,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    minHeight: 36,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
    overflow: 'hidden',
  },
  state: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statePlate: {
    maxWidth: '100%',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  stateLine: {
    alignSelf: 'flex-start',
    gap: Spacing.half,
    marginLeft: Spacing.three,
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  status: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  linkDown: {
    color: Colors.caution,
  },
  message: {
    alignItems: 'flex-start',
    gap: Spacing.one + Spacing.half,
    maxWidth: 280,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  messageFrom: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  messageText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  messageAck: {
    minHeight: 40,
    justifyContent: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
  },
  messageAckPressed: {
    opacity: 0.82,
  },
  messageAckText: {
    color: Colors.background,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  link: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  headingPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  headingLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  heading: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: Colors.glassStrong,
    maxWidth: '92%',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertText: {
    flexShrink: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.white,
    opacity: 0.7,
  },
  waiting: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
    maxWidth: '90%',
  },
  waitingText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
  },
  side: {
    alignSelf: 'flex-start',
  },
  target: {
    alignItems: 'flex-start',
    gap: Spacing.one,
    minWidth: 150,
    maxWidth: 230,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  targetLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  targetValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 26,
    lineHeight: 32,
  },
  targetHint: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  work: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  workDone: {
    height: 4,
    backgroundColor: Colors.text,
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
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  big: {
    fontFamily: Fonts.mono,
    fontSize: 26,
    lineHeight: 32,
  },
  meter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.glassBorder,
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
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  readingValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
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
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    flexWrap: 'wrap',
    rowGap: Spacing.one,
  },
  tag: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  tagOwnLine: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '100%',
  },
  toggle: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.visorPlate,
  },
  toggleOn: {
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  togglePressed: {
    opacity: 0.8,
  },
  toggleTextOn: {
    color: Colors.background,
  },
  toggleText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  sources: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  sourcesText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
});
