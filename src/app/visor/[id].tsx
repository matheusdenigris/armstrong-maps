import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
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

import { HeadingTape, turnTo } from '@/components/heading-tape';
import { MiniMap } from '@/components/mini-map';
import { PanoramaView } from '@/components/panorama-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { VIKING_GLOBAL } from '@/data/layers';
import { panoramaNear } from '@/data/panoramas';
import { SURFACE_RADIATION } from '@/data/radiation';
import { SITES, findSite, type Site } from '@/data/sites';
import { MARS_WIND } from '@/data/sounds';
import { elapsedSeconds } from '@/mission/clock';
import { formatDistance, formatDose, formatDuration, formatShare } from '@/mission/format';
import { walkProgress } from '@/mission/progress';
import { WALK_ASSUMPTIONS } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { AMBIENT_SOUND_AVAILABLE, useAmbientSound } from '@/state/use-ambient-sound';
import { useNow } from '@/state/use-now';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** Degrees the head turns for each pixel dragged, and for each press of an arrow key. */
const LOOK_PER_PIXEL = 0.22;
const LOOK_PER_KEY = 6;
/** The head starts tilted a little down, at the ground ahead. */
const RESTING_PITCH = -6;
/** How far up and down the head can tilt, in degrees: the photographs are bands, not spheres. */
const PITCH_UP = 22;
const PITCH_DOWN = -32;
/** Length of a step, in metres, and how far it lifts the view, in pixels. */
const STEP = 0.75;
const SWAY = 5;
/** The minimap shows about 300 m around the astronaut. */
const MINIMAP_PIXELS_PER_DEGREE = 26_000;

type Look = { yaw: number; pitch: number };
const AHEAD: Look = { yaw: 0, pitch: RESTING_PITCH };

const clampPitch = (pitch: number) => Math.min(PITCH_UP, Math.max(PITCH_DOWN, pitch));
const bearingText = (degrees: number) =>
  `${String(Math.round(((degrees % 360) + 360) % 360) % 360).padStart(3, '0')}°`;
const webOnly = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);

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
  // The walk decides where the astronaut is and which way they walk; the head is theirs to turn.
  const [look, setLook] = useState<Look>(AHEAD);
  const drag = useRef<{ x: number; y: number; look: Look } | null>(null);
  // Real wind, recorded on Mars. It starts only when the astronaut asks for it.
  const sound = useAmbientSound(MARS_WIND.url);

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
  const heading = (((progress.heading + look.yaw) % 360) + 360) % 360;

  const over = clock !== null && progress.totalHours > 0 && elapsedHours >= progress.totalHours;
  const moving = clock !== null && !over && progress.phase !== 'at-base';
  const offTarget = moving ? turnTo(heading, progress.bearingToTarget) : 0;
  const turned = Math.abs(turnTo(0, look.yaw)) > 2 || Math.abs(look.pitch - RESTING_PITCH) > 2;

  const a = WALK_ASSUMPTIONS;
  const hoursLeft = Math.max(0, a.lifeSupportHours * (1 - progress.lifeSupportUsed));
  const supply =
    progress.lifeSupportUsed > 1
      ? Colors.noGo
      : progress.lifeSupportUsed > 1 - a.reserveFraction
        ? Colors.caution
        : Colors.go;

  const status =
    clock === null
      ? 'STANDBY · Waiting for the ship to start the walk'
      : over
        ? 'WALK OVER · Back at the base'
        : !clock.running
          ? 'PAUSED BY THE SHIP'
          : progress.phase === 'working'
            ? `WORKING AT WAYPOINT ${(progress.stop ?? 0) + 1}`
            : progress.phase === 'returning'
              ? 'RETURNING TO THE BASE'
              : `WALKING TO WAYPOINT ${(progress.stop ?? 0) + 1}`;

  // The real photograph taken nearest to where the astronaut is now.
  const { panorama, awayM, borrowed } = panoramaNear(site.id, progress.position);
  // Steps lift the view a little, near real time only: played fast it would be a blur.
  const stepping =
    clock?.running === true &&
    clock.rate <= 10 &&
    (progress.phase === 'walking' || progress.phase === 'returning');
  const sway = stepping ? Math.abs(Math.sin((progress.walkedM / STEP) * Math.PI)) * SWAY : 0;
  const layers = [VIKING_GLOBAL, ...site.layers];
  const path = [site.landing, ...route, site.landing];

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
          styles.glass,
          webOnly({
            backgroundImage:
              'radial-gradient(ellipse at 50% 46%, rgba(7,9,13,0) 52%, rgba(7,9,13,0.38) 82%, rgba(7,9,13,0.82) 100%)',
          }),
        ]}
        pointerEvents="none"
      />

      {/* Top of the display: where I am facing and where the next point is. */}
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
          <Text style={styles.status} numberOfLines={2} accessibilityLiveRegion="polite">
            {status}
          </Text>
          <Text style={styles.heading}>HDG {bearingText(heading)}</Text>
          {AMBIENT_SOUND_AVAILABLE ? (
            <Pressable
              onPress={() => void sound.toggle()}
              accessibilityRole="switch"
              accessibilityState={{ checked: sound.playing }}
              accessibilityLabel="Sound of the wind on Mars, recorded by Perseverance"
              style={[styles.sound, sound.playing && styles.soundOn]}>
              <Text style={styles.soundText}>
                {sound.failed ? 'No sound' : sound.playing ? 'Sound on' : 'Sound off'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Middle: the point I am walking to. */}
      <View style={styles.middle} pointerEvents="none">
        <View style={styles.reticle} />
        {moving ? (
          <View style={styles.next}>
            <Text style={styles.nextLabel}>
              {progress.stop === null ? 'BASE' : `WAYPOINT ${progress.stop + 1}`}
            </Text>
            <Text style={styles.nextValue}>{formatDistance(progress.distanceToTargetM)}</Text>
            <Text style={styles.nextHint}>
              {Math.abs(offTarget) < 8
                ? `Ahead, bearing ${bearingText(progress.bearingToTarget)}`
                : `${offTarget < 0 ? '◀ Look left' : 'Look right ▶'} ${Math.round(Math.abs(offTarget))}°`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom of the display: what keeps me alive, and the map around me. */}
      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.two }]}
        pointerEvents="box-none">
        <View style={styles.dash} pointerEvents="box-none">
          <View style={styles.vitals} pointerEvents="none">
            <Text style={styles.simulated}>SIMULATED WALK · {site.name.toUpperCase()}</Text>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Life support left</Text>
              <Text style={[styles.vitalValue, { color: supply }]}>
                {formatDuration(hoursLeft)}
              </Text>
            </View>
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
                    backgroundColor: supply,
                  },
                ]}
              />
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Time outside</Text>
              <Text style={styles.vitalValue}>{formatDuration(progress.elapsedHours)}</Text>
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Walked</Text>
              <Text style={styles.vitalValue}>{formatDistance(progress.walkedM)}</Text>
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Radiation dose</Text>
              <Text style={styles.vitalValue}>{formatDose(progress.doseMsv)}</Text>
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Base</Text>
              <Text style={styles.vitalValue}>{formatDistance(progress.distanceToBaseM)}</Text>
            </View>
          </View>

          <View style={styles.mapColumn} pointerEvents="box-none">
            {turned ? (
              <Pressable
                onPress={() => setLook(AHEAD)}
                accessibilityRole="button"
                accessibilityLabel="Look the way I am walking again"
                style={styles.recentre}>
                <Text style={styles.recentreText}>Face ahead</Text>
              </Pressable>
            ) : (
              <Text style={styles.tip} pointerEvents="none">
                DRAG TO LOOK AROUND
              </Text>
            )}
            {/* Drawn in the browser only: how sharp its tiles are depends on the screen. */}
            {size ? (
              <MiniMap
                layers={layers}
                centre={progress.position}
                heading={heading}
                pixelsPerDegree={MINIMAP_PIXELS_PER_DEGREE}
                diameter={132}
                route={path}
                base={site.landing}
              />
            ) : (
              <View style={styles.mapSpace} />
            )}
          </View>
        </View>

        <Text style={styles.credit} pointerEvents="none">
          Real photo: {panorama.caption}. {panorama.credit}, images.nasa.gov/details/
          {panorama.nasaId}.{' '}
          {borrowed
            ? `There is no 360-degree photo from ${site.name} in the catalogue; this one is from Gale Crater. `
            : awayM === null
              ? 'Where exactly it was taken is not in the data. '
              : `Taken ${formatDistance(awayM)} from your simulated position. `}
          {panorama.north === null
            ? 'It is not lined up with the compass.'
            : 'It is lined up with the compass.'}{' '}
          It is a mosaic: black areas are where the camera took no frame, and the sky above the
          frames is filled in.{' '}
          {sound.playing
            ? `Sound: real wind recorded by the SuperCam microphone of Perseverance at Jezero Crater on ${MARS_WIND.when}, on a loop${
                site.id === MARS_WIND.site ? '' : '; it was not recorded at this site'
              }. ${MARS_WIND.credit}. `
            : ''}
          Dose at {SURFACE_RADIATION.msvPerDay} mSv a day (
          {SURFACE_RADIATION.source}).
        </Text>
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
      <Text style={styles.status}>SITE NOT FOUND</Text>
      <Link href="/" style={styles.back} accessibilityRole="link">
        {'‹'} Sites
      </Link>
    </View>
  );
}

/** Behind every block of text on the display, so it reads over bright ground and sky. */
const PLATE = 'rgba(7, 9, 13, 0.62)';
/** The colour of the display: the green of a go, like the numbers it shows when all is well. */
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
  glass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bar: {
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
  status: {
    flex: 1,
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    ...glow,
  },
  sound: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 224, 0.45)',
  },
  soundOn: {
    borderColor: DISPLAY,
    backgroundColor: 'rgba(61, 214, 140, 0.18)',
  },
  soundText: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heading: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    ...glow,
  },
  middle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  reticle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: DISPLAY,
  },
  next: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.nav,
    backgroundColor: PLATE,
  },
  nextLabel: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  nextValue: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    ...glow,
  },
  nextHint: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  dash: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  vitals: {
    flex: 1,
    maxWidth: 300,
    gap: Spacing.one + Spacing.half,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 224, 0.35)',
    backgroundColor: PLATE,
  },
  simulated: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  vital: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  vitalLabel: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  vitalValue: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 16,
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
  mapSpace: {
    width: 132,
    height: 132,
  },
  mapColumn: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  tip: {
    color: DISPLAY,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    backgroundColor: PLATE,
    overflow: 'hidden',
  },
  recentre: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: DISPLAY,
    backgroundColor: PLATE,
  },
  recentreText: {
    color: DISPLAY,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  credit: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    padding: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: PLATE,
  },
});
