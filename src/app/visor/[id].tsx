import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeadingTape, turnTo } from '@/components/heading-tape';
import { MiniMap } from '@/components/mini-map';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { VIKING_GLOBAL } from '@/data/layers';
import { panoramaFor, type Panorama } from '@/data/panoramas';
import { SURFACE_RADIATION } from '@/data/radiation';
import { SITES, findSite, type Site } from '@/data/sites';
import { elapsedSeconds } from '@/mission/clock';
import { formatDistance, formatDose, formatDuration, formatShare } from '@/mission/format';
import { walkProgress } from '@/mission/progress';
import { WALK_ASSUMPTIONS } from '@/mission/walk';
import { useMission, useRoute } from '@/state/mission';
import { useNow } from '@/state/use-now';

/** One page per site in the static web export. */
export function generateStaticParams() {
  return SITES.map((site) => ({ id: site.id }));
}

/** Degrees the view turns for each pixel dragged. */
const LOOK_PER_PIXEL = 0.25;
/** The minimap shows about 300 m around the astronaut. */
const MINIMAP_PIXELS_PER_DEGREE = 26_000;

const bearingText = (degrees: number) =>
  `${String(Math.round(((degrees % 360) + 360) % 360) % 360).padStart(3, '0')}°`;

export default function VisorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = findSite(id);
  return site ? <Visor key={site.id} site={site} /> : <UnknownSite />;
}

function Visor({ site }: { site: Site }) {
  const insets = useSafeAreaInsets();
  const route = useRoute(site.id);
  const clock = useMission((state) => state.clocks[site.id]) ?? null;
  const now = useNow(clock?.running ?? false);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The astronaut can look around; the walk decides where they are and which way they walk.
  const [look, setLook] = useState(0);
  const drag = useRef<{ x: number; look: number } | null>(null);

  const elapsedHours = clock ? elapsedSeconds(clock, now) / 3600 : 0;
  const progress = walkProgress(site.landing, route, elapsedHours, SURFACE_RADIATION.msvPerDay);
  const heading = (((progress.heading + look) % 360) + 360) % 360;

  const over = clock !== null && progress.totalHours > 0 && elapsedHours >= progress.totalHours;
  const moving = clock !== null && !over && progress.phase !== 'at-base';
  const offTarget = moving ? turnTo(heading, progress.bearingToTarget) : 0;

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

  const { panorama, borrowed } = panoramaFor(site.id);
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
  const pageX = (event: GestureResponderEvent) => event.nativeEvent.pageX;

  return (
    <View
      style={styles.screen}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        drag.current = { x: pageX(event), look };
      }}
      onResponderMove={(event) => {
        const start = drag.current;
        if (start) setLook(start.look - (pageX(event) - start.x) * LOOK_PER_PIXEL);
      }}
      onResponderRelease={() => {
        drag.current = null;
      }}>
      <Head>
        <title>{`Visor, ${site.name} | Armstrong Maps`}</title>
        <meta name="description" content={`Astronaut visor for a walk at ${site.name} on Mars.`} />
      </Head>

      {size ? <Backdrop panorama={panorama} size={size} heading={heading} /> : null}

      {/* Top: where I am facing and where the next point is. */}
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
        </View>
      </View>

      {/* Middle: the next point to reach. */}
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
                : `Turn ${offTarget < 0 ? 'left' : 'right'} ${Math.round(Math.abs(offTarget))}°`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom: what keeps me alive, and the map around me. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.dash} pointerEvents="box-none">
          <View style={styles.vitals}>
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
              <Text style={styles.vitalLabel}>Radiation dose</Text>
              <Text style={styles.vitalValue}>{formatDose(progress.doseMsv)}</Text>
            </View>
            <View style={styles.vital}>
              <Text style={styles.vitalLabel}>Base</Text>
              <Text style={styles.vitalValue}>{formatDistance(progress.distanceToBaseM)}</Text>
            </View>
          </View>

          <View style={styles.mapColumn} pointerEvents="box-none">
            {Math.abs(look) > 1 ? (
              <Pressable
                onPress={() => setLook(0)}
                accessibilityRole="button"
                accessibilityLabel="Look the way I am walking again"
                style={styles.recentre}>
                <Text style={styles.recentreText}>Face ahead</Text>
              </Pressable>
            ) : null}
            <MiniMap
              layers={layers}
              centre={progress.position}
              heading={heading}
              pixelsPerDegree={MINIMAP_PIXELS_PER_DEGREE}
              diameter={132}
              route={path}
              base={site.landing}
            />
          </View>
        </View>

        <Text style={styles.credit} pointerEvents="none">
          Photo: {panorama.caption}. {panorama.credit}.{' '}
          {borrowed ? `There is no photo from ${site.name}; this one is from Gale Crater. ` : ''}
          The framing is illustrative: it does not follow the real heading. Dose at{' '}
          {SURFACE_RADIATION.msvPerDay} mSv a day ({SURFACE_RADIATION.source}).
        </Text>
      </View>
    </View>
  );
}

type BackdropProps = {
  panorama: Panorama;
  size: { width: number; height: number };
  heading: number;
};

/**
 * The clean part of the photograph, scaled to cover the screen, sliding sideways as the astronaut
 * turns. It goes from one edge of the clean part at north to the other at south and back, so the
 * picture never runs into the black gaps of the mosaic.
 */
function Backdrop({ panorama, size, heading }: BackdropProps) {
  const { window: clean } = panorama;
  const cleanWidth = (clean.right - clean.left) * panorama.width;
  const cleanHeight = (clean.bottom - clean.top) * panorama.height;
  const scale = Math.max(size.width / cleanWidth, size.height / cleanHeight);
  const slack = cleanWidth * scale - size.width;
  const sweep = 1 - Math.abs(heading / 180 - 1);
  const left = -(clean.left * panorama.width * scale + slack * sweep);
  const top = -(clean.top * panorama.height * scale + (cleanHeight * scale - size.height) / 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: panorama.url }}
        style={{
          position: 'absolute',
          left,
          top,
          width: panorama.width * scale,
          height: panorama.height * scale,
        }}
        contentFit="fill"
        cachePolicy="memory-disk"
        accessibilityLabel={panorama.caption}
      />
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

const PANEL = 'rgba(7, 9, 13, 0.78)';

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
    backgroundColor: PANEL,
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
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  middle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  reticle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: 'rgba(7, 9, 13, 0.25)',
  },
  next: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.nav,
    backgroundColor: PANEL,
  },
  nextLabel: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  nextValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
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
    backgroundColor: PANEL,
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
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
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
  mapColumn: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  recentre: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.text,
    backgroundColor: PANEL,
  },
  recentreText: {
    color: Colors.text,
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
    backgroundColor: PANEL,
  },
});
