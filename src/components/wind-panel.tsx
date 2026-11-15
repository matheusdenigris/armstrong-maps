import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { DUNE_CREDIT, type DuneField } from '@/data/dunes';
import {
  AIR_DENSITY_SOURCE,
  INSIGHT_CREDIT,
  compassPoint,
  earthEquivalentMs,
  type WindSol,
} from '@/data/wind';
import { formatDistance } from '@/mission/format';
import type { Feed } from '@/state/use-feed';

type WindPanelProps = {
  siteName: string;
  /** How far the site is from InSight, where the wind was measured, in metres. */
  distanceFromInsightM: number;
  sols: Feed<WindSol[]>;
  dunes: Feed<DuneField[]>;
};

const ms = (value: number) => `${value.toFixed(1)} m/s`;

/** Measured wind, and the wind written in the dunes of the region. Real data only. */
export function WindPanel({ siteName, distanceFromInsightM, sols, dunes }: WindPanelProps) {
  const local = distanceFromInsightM < 50_000;
  const latest = sols.status === 'ready' ? sols.data[0] : undefined;
  const strongest = sols.status === 'ready' ? Math.max(...sols.data.map((sol) => sol.maxMs)) : 0;
  const shaped = dunes.status === 'ready' ? dunes.data.filter((field) => field.downwindDeg !== null) : [];

  return (
    <View style={styles.panel}>
      <Text style={styles.heading} accessibilityRole="header">
        WIND · MEASURED BY INSIGHT, 2020
      </Text>
      {!local ? (
        <Text style={styles.warning}>
          {siteName} is {formatDistance(distanceFromInsightM)} from InSight, the only lander whose
          wind NASA serves. This is a reference, not the wind here.
        </Text>
      ) : null}
      <View style={styles.card}>
        {sols.status === 'idle' || sols.status === 'loading' ? (
          <Text style={styles.note}>Asking for InSight&apos;s wind.</Text>
        ) : null}
        {sols.status === 'failed' ? (
          <Text style={styles.note}>The InSight feed did not answer. No wind to show.</Text>
        ) : null}
        {sols.status === 'ready' && !latest ? (
          <Text style={styles.note}>The InSight feed answered without any wind.</Text>
        ) : null}
        {latest && sols.status === 'ready' ? (
          <>
            <View style={styles.top}>
              <WindRose fromDeg={latest.fromDeg} />
              <View style={styles.topText}>
                <Text style={styles.title}>
                  Sol {latest.sol} · {latest.firstDate}
                </Text>
                <Text style={styles.big}>{ms(latest.meanMs)} mean</Text>
                <Text style={styles.mono}>
                  {ms(latest.minMs)} to {ms(latest.maxMs)}
                </Text>
                <Text style={styles.mono}>
                  {latest.fromPoint && latest.fromDeg !== null
                    ? `From the ${latest.fromPoint} (${latest.fromDeg}°)`
                    : 'No valid direction this sol'}
                </Text>
              </View>
            </View>
            <View style={styles.bars} accessible accessibilityLabel="Mean and highest wind of each sol">
              {[...sols.data].reverse().map((sol) => (
                <View key={sol.sol} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barMax, { height: `${(sol.maxMs / strongest) * 100}%` }]} />
                    <View style={[styles.barMean, { height: `${(sol.meanMs / strongest) * 100}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{sol.sol}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>
              Light bar: the strongest gust of each sol. Dark bar: the mean. The strongest gust,{' '}
              {ms(strongest)}, pushes like {ms(earthEquivalentMs(strongest))} on Earth: the air of
              Mars is about 75 times thinner. Wind does not enter the verdict; the dust it lifts
              can hide the ground.
            </Text>
            <Text style={styles.source}>
              {INSIGHT_CREDIT}. The last seven sols InSight sent, measured at Elysium Planitia; the
              lander has been silent since 2022. Densities: {AIR_DENSITY_SOURCE}.
            </Text>
          </>
        ) : null}
      </View>

      <Text style={styles.heading} accessibilityRole="header">
        WIND WRITTEN IN THE DUNES
      </Text>
      <View style={styles.card}>
        <Text style={styles.note}>
          {dunes.status !== 'ready'
            ? dunes.status === 'failed'
              ? 'The dune database did not answer.'
              : 'Asking the dune database.'
            : shaped.length === 0
              ? 'No dune field with measured slip faces in this region.'
              : shaped
                  .map(
                    (field) =>
                      `Field ${field.id}: ${field.slipFaces} slip faces face the ${compassPoint(field.downwindDeg!)} (${Math.round(field.downwindDeg!)}°), so the wind that built it blew towards there.`,
                  )
                  .join(' ')}
        </Text>
        <Text style={styles.source}>
          {DUNE_CREDIT}. Slip faces show the prevailing wind at the last time the dunes changed
          much, not today&apos;s wind.
        </Text>
      </View>
    </View>
  );
}

/** A compass with the wind coming in from the direction it blew from. */
function WindRose({ fromDeg }: { fromDeg: number | null }) {
  const size = 72;
  const c = size / 2;
  return (
    <Svg width={size} height={size} accessible={false}>
      <Circle cx={c} cy={c} r={c - 2} stroke={Colors.border} strokeWidth={1.5} fill="none" />
      <Line x1={c} y1={4} x2={c} y2={12} stroke={Colors.textMuted} strokeWidth={2} />
      {fromDeg !== null ? (
        <Path
          // An arrow from the rim, on the side the wind came from, towards the centre.
          d={`M ${c} ${6} L ${c} ${c + 10} M ${c - 7} ${c + 2} L ${c} ${c + 12} L ${c + 7} ${c + 2}`}
          stroke={Colors.wind}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          transform={`rotate(${fromDeg} ${c} ${c})`}
        />
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  heading: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    paddingTop: Spacing.two,
  },
  warning: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: Spacing.two + Spacing.one,
    borderLeftWidth: 3,
    borderLeftColor: Colors.caution,
  },
  card: {
    gap: Spacing.two,
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
  title: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  big: {
    color: Colors.wind,
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontWeight: '700',
  },
  mono: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.one,
    height: 72,
  },
  barColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  barMax: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  barMean: {
    borderRadius: 2,
    backgroundColor: Colors.wind,
  },
  barLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    textAlign: 'center',
  },
  note: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  source: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
