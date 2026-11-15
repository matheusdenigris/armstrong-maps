import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SURFACE_RADIATION } from '@/data/radiation';
import { formatDistance, formatDose, formatDuration, formatShare } from '@/mission/format';
import {
  formatMarsClock,
  inDustSeason,
  localTrueSolarTime,
  marsTime,
  type WalkDaylight,
} from '@/mission/mars-time';
import type { RouteSlope } from '@/mission/terrain';
import { WALK_ASSUMPTIONS, type WalkEvaluation, type WalkReason } from '@/mission/walk';

export type StartPlan = 'now' | 'morning';

type Status = 'ok' | 'caution' | 'no-go' | 'unknown' | 'info';

type SafetyCheckProps = {
  walk: WalkEvaluation;
  stops: number;
  lonEast: number;
  startPlan: StartPlan;
  onStartPlan: (plan: StartPlan) => void;
  /** Null until there is a route to time. */
  daylight: WalkDaylight | null;
  /** The planned start, on Earth's clock. */
  start: Date;
  /** 'quiet' or 'alert' once DONKI answered, 'unknown' while it has not. */
  spaceWeather: 'quiet' | 'alert' | 'unknown';
  /** Null while the elevation model has not answered. */
  ground: RouteSlope | null;
  groundKnown: boolean;
  dunes: 'clear' | 'crossed' | 'unknown';
  /** Where the Sun of the daylight check comes from. */
  sunSource: 'horizons' | 'mars24';
};

const COLOR: Record<Status, string> = {
  ok: Colors.go,
  caution: Colors.caution,
  'no-go': Colors.noGo,
  unknown: Colors.textMuted,
  info: Colors.nav,
};

const LABEL: Record<Status, string> = {
  ok: 'Clear',
  caution: 'Caution',
  'no-go': 'No-go',
  unknown: 'Not checked',
  info: 'Measured',
};

/** The status a factor takes from the reasons of the verdict. */
function statusOf(reasons: readonly WalkReason[], noGo: WalkReason[], caution: WalkReason[]): Status {
  if (reasons.some((reason) => noGo.includes(reason))) return 'no-go';
  if (reasons.some((reason) => caution.includes(reason))) return 'caution';
  return 'ok';
}

const localTime = (date: Date, lonEast: number) =>
  formatMarsClock(localTrueSolarTime(marsTime(date), lonEast));

/**
 * Every factor of the verdict on one card: its status, the number behind it and where that number
 * comes from. A factor whose source has not answered says so instead of passing.
 */
export function SafetyCheck({
  walk,
  stops,
  lonEast,
  startPlan,
  onStartPlan,
  daylight,
  start,
  spaceWeather,
  ground,
  groundKnown,
  dunes,
  sunSource,
}: SafetyCheckProps) {
  const a = WALK_ASSUMPTIONS;
  const r = walk.reasons;
  const empty = stops === 0;
  const ls = marsTime(start).ls;

  const rows: { title: string; status: Status; value: string; source: string }[] = [
    {
      title: 'Life support',
      status: empty ? 'unknown' : statusOf(r, ['life-support-exceeded'], ['into-reserve']),
      value: empty
        ? 'Add waypoints to time the walk.'
        : `${formatShare(walk.lifeSupportUsed)} of ${a.lifeSupportHours} h used, ${formatDuration(walk.durationHours)} outside.`,
      source: 'Assumption',
    },
    {
      title: 'Walk-back limit',
      status: empty ? 'unknown' : statusOf(r, ['beyond-walk-back-limit'], ['near-walk-back-limit']),
      value: empty
        ? `Stay within ${a.walkBackLimitKm} km of the base.`
        : `Farthest waypoint ${formatDistance(walk.farthestM)} of ${a.walkBackLimitKm} km.`,
      source: 'Assumption',
    },
    {
      title: 'Daylight',
      status:
        empty || !daylight ? 'unknown' : statusOf(r, ['starts-in-dark', 'into-night'], ['low-sun']),
      value:
        empty || !daylight
          ? `Start at ${localTime(start, lonEast)} local solar time.`
          : daylight.hoursToSpare === null
            ? `Starts at ${localTime(start, lonEast)} local solar time, with the Sun down.`
            : daylight.hoursToSpare >= 0
              ? `${localTime(start, lonEast)} to ${localTime(daylight.endsAt, lonEast)} local time, ${formatDuration(daylight.hoursToSpare)} before sunset.`
              : `Ends ${formatDuration(-daylight.hoursToSpare)} after sunset (${localTime(daylight.endsAt, lonEast)} local time).`,
      source: sunSource === 'horizons' ? 'NASA/JPL Horizons' : 'Mars24 algorithm (Horizons not reached)',
    },
    {
      title: 'Radiation',
      status: empty ? 'unknown' : 'info',
      value: empty
        ? `${SURFACE_RADIATION.msvPerDay} mSv a day on the surface.`
        : `${formatDose(walk.doseMsv)} for the walk, at ${SURFACE_RADIATION.msvPerDay} mSv a day.`,
      source: 'MSL RAD',
    },
    {
      title: 'Space weather',
      status: spaceWeather === 'unknown' ? 'unknown' : spaceWeather === 'alert' ? 'caution' : 'ok',
      value:
        spaceWeather === 'unknown'
          ? 'DONKI has not answered: not counted.'
          : spaceWeather === 'alert'
            ? 'A CME is forecast to hit Mars around the walk.'
            : 'No CME forecast to hit Mars around the walk.',
      source: 'NASA DONKI',
    },
    {
      // No source measures dust, so this factor never passes: it says it was not checked.
      title: 'Dust',
      status: 'unknown',
      value: `No opacity reading is published. Ls ${Math.round(ls)}°: ${inDustSeason(ls) ? 'in' : 'outside'} the dust storm season.`,
      source: 'No feed; season from Kass et al. 2016',
    },
    {
      title: 'Steep ground',
      status: !groundKnown ? 'unknown' : empty ? 'unknown' : statusOf(r, ['too-steep'], ['steep-ground']),
      value: !groundKnown
        ? 'The elevation model has not answered.'
        : empty || !ground || ground.maxDeg === null
          ? `Under ${a.cautionSlopeDeg}° is clear; ${a.noGoSlopeDeg}° or more is a no-go.`
          : `Steepest ${ground.maxDeg.toFixed(1)}° under the route, over ${formatDistance(ground.cellM ?? 0)}.`,
      source: 'NASA elevation models',
    },
    {
      title: 'Loose sand',
      status: dunes === 'unknown' ? 'unknown' : empty ? 'unknown' : dunes === 'crossed' ? 'caution' : 'ok',
      value:
        dunes === 'unknown'
          ? 'The dune database has not answered.'
          : empty
            ? 'Mapped dune fields are outlined on the map.'
            : dunes === 'crossed'
              ? 'The route enters a mapped dune field.'
              : 'The route stays out of mapped dune fields.',
      source: 'USGS dune database',
    },
  ];

  const counted = rows.filter((row) => row.status === 'ok' || row.status === 'caution' || row.status === 'no-go');
  const clear = counted.filter((row) => row.status === 'ok').length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          SAFETY CHECK
        </Text>
        <Text style={styles.tally}>
          {empty ? 'No route yet' : `${clear} of ${counted.length} clear`}
        </Text>
      </View>

      <View style={styles.planRow} accessibilityRole="radiogroup">
        <Text style={styles.planLabel}>Start</Text>
        {(
          [
            ['now', 'Now'],
            ['morning', 'Next morning'],
          ] as const
        ).map(([plan, label]) => (
          <Pressable
            key={plan}
            onPress={() => onStartPlan(plan)}
            accessibilityRole="radio"
            accessibilityState={{ checked: startPlan === plan }}
            style={[styles.chip, startPlan === plan && styles.chipOn]}>
            <Text style={[styles.chipText, startPlan === plan && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.map((row) => (
        <View key={row.title} style={styles.row}>
          <StatusMark status={row.status} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={[styles.rowStatus, { color: COLOR[row.status] }]}>{LABEL[row.status]}</Text>
            </View>
            <Text style={styles.rowValue}>{row.value}</Text>
            <Text style={styles.rowSource}>{row.source}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A tick, an exclamation, a cross or a dash in a ring of the status colour. */
function StatusMark({ status }: { status: Status }) {
  const color = COLOR[status];
  const glyph: Record<Status, string> = {
    ok: 'M7 12.5l3 3 7-7',
    caution: 'M12 7v6 M12 16.5v0.5',
    'no-go': 'M8.5 8.5l7 7 M15.5 8.5l-7 7',
    unknown: 'M8 12h8',
    info: 'M12 11v6 M12 7.5v0.5',
  };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d={glyph[status]} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  tally: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  planLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  chipOn: {
    backgroundColor: Colors.text,
  },
  chipText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  chipTextOn: {
    color: Colors.background,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glassBorder,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  rowStatus: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  rowValue: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  rowSource: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
});
