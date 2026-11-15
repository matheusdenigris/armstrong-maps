import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { REMS_CREDIT, type SolWeather } from '@/data/weather';

type WeatherChartProps = {
  /** Newest first, as the feed gives them. */
  sols: readonly SolWeather[];
};

const HEIGHT = 132;
const CARD_PADDING = Spacing.two + Spacing.one;
const PAD = { left: 40, right: 8, top: 10, bottom: 22 };

type Series = { values: (number | null)[]; color: string; dashed?: boolean };

/** Nice round ticks between two values. */
function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let value = first; value <= max + 1e-9; value += step) out.push(Number(value.toFixed(6)));
  return out;
}

/** The path of a series, broken where a value is missing. */
function pathOf(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  values.forEach((value, index) => {
    if (value === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)} `;
    pen = true;
  });
  return d;
}

/** Temperature and pressure over the sols the REMS feed returns, oldest on the left. */
export function WeatherChart({ sols }: WeatherChartProps) {
  const [width, setWidth] = useState(0);
  const ordered = [...sols].reverse();
  if (ordered.length < 2) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading} accessibilityRole="header">
        LAST {ordered.length} SOLS AT GALE
      </Text>
      <View style={styles.card} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            <Chart
              title="Air temperature"
              unit="°C"
              width={width - 2 * CARD_PADDING - 2}
              sols={ordered.map((sol) => sol.sol)}
              series={[
                { values: ordered.map((sol) => sol.maxAirC), color: Colors.caution },
                { values: ordered.map((sol) => sol.minAirC), color: Colors.nav },
              ]}
            />
            <View style={styles.legend}>
              <Key color={Colors.caution} label="Highest of the sol" />
              <Key color={Colors.nav} label="Lowest" />
            </View>
            <Chart
              title="Air pressure"
              unit="Pa"
              width={width - 2 * CARD_PADDING - 2}
              sols={ordered.map((sol) => sol.sol)}
              series={[{ values: ordered.map((sol) => sol.pressurePa), color: Colors.wind }]}
            />
          </>
        ) : null}
        <Text style={styles.source}>
          {REMS_CREDIT}. Sols {ordered[0].sol} to {ordered[ordered.length - 1].sol} (
          {ordered[0].earthDate} to {ordered[ordered.length - 1].earthDate} on Earth). A gap in a
          line is a sol the station did not report.
        </Text>
      </View>
    </View>
  );
}

type ChartProps = { title: string; unit: string; width: number; sols: number[]; series: Series[] };

function Chart({ title, unit, width, sols, series }: ChartProps) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0) {
    return <Text style={styles.empty}>{title}: no reading in these sols.</Text>;
  }
  const low = Math.min(...all);
  const high = Math.max(...all);
  const yTicks = ticks(low, high);
  const min = Math.min(low, yTicks[0]);
  const max = Math.max(high, yTicks[yTicks.length - 1]);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (sols.length === 1 ? 0 : (i / (sols.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * plotH;
  const xLabels = [0, Math.floor((sols.length - 1) / 2), sols.length - 1];

  return (
    <View style={styles.chart} accessible accessibilityLabel={`${title} over sols ${sols[0]} to ${sols[sols.length - 1]}, from ${low} to ${high} ${unit}`}>
      <Text style={styles.chartTitle}>
        {title} <Text style={styles.unit}>({unit})</Text>
      </Text>
      <Svg width={width} height={HEIGHT}>
        {yTicks.map((tick) => (
          <Line key={`g${tick}`} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={Colors.border} strokeWidth={1} />
        ))}
        {yTicks.map((tick) => (
          <SvgText key={`t${tick}`} x={PAD.left - 6} y={y(tick) + 4} fill={Colors.textMuted} fontSize={10} fontFamily={Fonts.mono} textAnchor="end">
            {tick}
          </SvgText>
        ))}
        {xLabels.map((index) => (
          <SvgText key={`x${index}`} x={x(index)} y={HEIGHT - 6} fill={Colors.textMuted} fontSize={10} fontFamily={Fonts.mono} textAnchor={index === 0 ? 'start' : index === sols.length - 1 ? 'end' : 'middle'}>
            {`sol ${sols[index]}`}
          </SvgText>
        ))}
        {series.map((s, index) => (
          <Path key={index} d={pathOf(s.values, x, y)} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </Svg>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyLine, { backgroundColor: color }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
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
    gap: Spacing.two,
    padding: CARD_PADDING,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  chart: {
    gap: Spacing.one,
  },
  chartTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  unit: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  keyLine: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  keyText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  empty: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  source: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
