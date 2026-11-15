import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDuration } from '@/mission/format';
import {
  formatMarsClock,
  localMeanSolarTime,
  localTrueSolarTime,
  marsTime,
  nextSunCrossing,
  season,
  type SunAt,
} from '@/mission/mars-time';

/** Where the Sun comes from: NASA/JPL Horizons, or the app's own algorithm when it has not answered. */
export type SunSource = 'horizons' | 'mars24';

type MarsClockPanelProps = {
  siteName: string;
  lat: number;
  lonEast: number;
  /** The moment to show, on Earth's clock. */
  now: Date;
  /** The Sun's elevation over time at the site, and where it comes from. */
  sun: SunAt;
  sunSource: SunSource;
};

/** The time at the site, where the Sun is, and how long the daylight lasts. */
export function MarsClockPanel({ siteName, lat, lonEast, now, sun, sunSource }: MarsClockPanelProps) {
  const time = marsTime(now);
  const ltst = localTrueSolarTime(time, lonEast);
  const lmst = localMeanSolarTime(time, lonEast);
  const elevation = sun(now.getTime());
  const up = elevation >= 0;
  const sunset = up ? nextSunCrossing(now, sun, false) : null;
  const sunrise = nextSunCrossing(up && sunset ? sunset : now, sun, true);
  // At night the second line looks one more step ahead: the sunset of the coming day.
  const nextSunset = !up && sunrise ? nextSunCrossing(sunrise, sun, false) : null;
  const hoursTo = (date: Date | null) => (date ? (date.getTime() - now.getTime()) / 3_600_000 : null);
  const local = (date: Date | null) => (date ? formatMarsClock(localTrueSolarTime(marsTime(date), lonEast)) : '--:--');

  return (
    <View style={styles.panel}>
      <Text style={styles.heading} accessibilityRole="header">
        MARS CLOCK · {siteName.toUpperCase()}
      </Text>
      <View style={styles.card}>
        <View style={styles.top}>
          <SunDial ltst={ltst} up={up} />
          <View style={styles.topText}>
            <Text style={styles.label}>Local true solar time</Text>
            <Text style={styles.clock}>{formatMarsClock(ltst)}</Text>
            <Text style={styles.mono}>
              Sun {up ? `${elevation.toFixed(0)}° up` : `${(-elevation).toFixed(0)}° below the horizon`}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Item label={up ? 'Sunset' : 'Sunrise'} value={up ? local(sunset) : local(sunrise)} />
          <Item
            label={up ? 'Daylight left' : 'Night left'}
            value={formatDuration(Math.max(0, hoursTo(up ? sunset : sunrise) ?? 0))}
          />
          <Item label="Mean solar time" value={formatMarsClock(lmst)} />
          <Item label="Mars Sol Date" value={Math.floor(time.msd).toLocaleString('en-US')} />
          <Item label="Season here" value={`${season(time.ls, lat)}, Ls ${time.ls.toFixed(0)}°`} />
          {up ? (
            <Item label="Next sunrise" value={local(sunrise)} />
          ) : (
            <Item label="Next sunset" value={local(nextSunset)} />
          )}
        </View>

        <Text style={styles.source}>
          {sunSource === 'horizons'
            ? 'Sun, sunrise and sunset from NASA/JPL Horizons, the ephemeris of JPL. '
            : 'Sun computed in the app: NASA/JPL Horizons has not answered. '}
          Clock times with the Mars24 algorithm of NASA GISS (Allison and McEwen 2000), which
          agrees with Horizons within about a minute. Durations are Earth hours; a sol is 24 h 40
          min.
        </Text>
      </View>
    </View>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/** A half dial from 06:00 to 18:00 with the Sun on it by local solar time. */
function SunDial({ ltst, up }: { ltst: number; up: boolean }) {
  const width = 88;
  const height = 52;
  const cx = width / 2;
  const cy = height - 6;
  const r = 38;
  // 06:00 on the left, noon on top, 18:00 on the right; clamped to the arc at night.
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, (ltst - 6) / 12)));
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  return (
    <Svg width={width} height={height}>
      <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke={Colors.border} strokeWidth={2} fill="none" />
      <Line x1={4} y1={cy} x2={width - 4} y2={cy} stroke={Colors.textMuted} strokeWidth={1} />
      <Circle cx={x} cy={y} r={6} fill={up ? Colors.caution : Colors.surface} stroke={Colors.caution} strokeWidth={1.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  heading: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  topText: {
    flex: 1,
    gap: Spacing.half,
  },
  clock: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
  },
  item: {
    width: '50%',
    gap: Spacing.half,
    paddingRight: Spacing.two,
  },
  label: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  value: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  mono: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  source: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
