import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SURFACE_RADIATION } from '@/data/radiation';
import type { RoverTrack } from '@/data/rover';
import { REMS_CREDIT, type SolWeather } from '@/data/weather';
import { formatDistance, formatLatLon } from '@/mission/format';
import type { Feed } from '@/state/use-feed';

type EnvironmentPanelProps = {
  siteName: string;
  /** How far the site is from Gale crater, where the weather is measured, in metres. */
  distanceFromGaleM: number;
  weather: Feed<SolWeather[]>;
  /** The rover of this site and its traverse, when the site has one. */
  rover: { name: string; track: Feed<RoverTrack> } | null;
};

const degrees = (value: number | null) => (value === null ? 'No reading' : `${value} °C`);
const range = (low: number | null, high: number | null) =>
  low === null && high === null ? 'No reading' : `${degrees(low)} to ${degrees(high)}`;

/** What the place is like: weather, radiation, and where its rover is. Measured data only. */
export function EnvironmentPanel({
  siteName,
  distanceFromGaleM,
  weather,
  rover,
}: EnvironmentPanelProps) {
  // Within a few kilometres of Bradbury Landing the readings are local.
  const local = distanceFromGaleM < 50_000;
  const latest = weather.status === 'ready' ? weather.data[0] : undefined;

  return (
    <View style={styles.panel}>
      <PanelHeading number="03" title="SITE CONDITIONS" />
      <SectionHeading title="WEATHER · MEASURED AT GALE CRATER" color={Colors.nav} />
      {!local ? (
        <Text style={[styles.warning, { borderLeftColor: Colors.caution }]}>
          {siteName} is {formatDistance(distanceFromGaleM)} from the weather station. These
          readings are a reference, not the weather here.
        </Text>
      ) : null}
      {weather.status === 'loading' || weather.status === 'idle' ? (
        <StatusNote text="Asking the station for its latest sol." color={Colors.nav} />
      ) : null}
      {weather.status === 'failed' ? (
        <StatusNote text="The weather feed did not answer. No reading to show." color={Colors.noGo} />
      ) : null}
      {weather.status === 'ready' && !latest ? (
        <StatusNote text="The weather feed answered without any sol." color={Colors.caution} />
      ) : null}
      {latest ? (
        <View style={[styles.card, { borderLeftColor: Colors.nav }]}>
          <Text style={styles.cardTitle}>
            Sol {latest.sol} · {latest.earthDate} on Earth
          </Text>
          <View style={styles.grid}>
            <Reading label="Air temperature" value={range(latest.minAirC, latest.maxAirC)} />
            <Reading label="Ground temperature" value={range(latest.minGroundC, latest.maxGroundC)} />
            <Reading
              label="Pressure"
              value={latest.pressurePa === null ? 'No reading' : `${latest.pressurePa} Pa`}
            />
            <Reading label="Sky" value={latest.sky ?? 'No reading'} />
            <Reading label="Ultraviolet" value={latest.uvIndex ?? 'No reading'} />
            <Reading
              label="Sunrise and sunset"
              value={
                latest.sunrise && latest.sunset ? `${latest.sunrise} to ${latest.sunset}` : 'No reading'
              }
            />
          </View>
          <Text style={styles.source}>
            {REMS_CREDIT}. The latest sol the feed has; it can be weeks behind today.
          </Text>
        </View>
      ) : null}

      <SectionHeading title="RADIATION · PUBLISHED AVERAGE" color={Colors.caution} />
      <View style={[styles.card, { borderLeftColor: Colors.caution }]}>
        <Text style={styles.cardTitle}>
          {SURFACE_RADIATION.msvPerDay} ± {SURFACE_RADIATION.uncertaintyMsvPerDay} mSv per Earth day
        </Text>
        <Text style={styles.note}>{SURFACE_RADIATION.caveat}</Text>
        <Text style={styles.source}>{SURFACE_RADIATION.source}. Not a live reading.</Text>
      </View>

      {rover ? (
        <>
          <SectionHeading title={`ROVER · ${rover.name.toUpperCase()}`} color={Colors.mars} />
          <View style={[styles.card, { borderLeftColor: Colors.mars }]}>
            {rover.track.status === 'loading' || rover.track.status === 'idle' ? (
              <StatusNote text="Asking for the traverse." color={Colors.mars} />
            ) : null}
            {rover.track.status === 'failed' ? (
              <StatusNote
                text="The traverse feed did not answer. No position to show."
                color={Colors.noGo}
              />
            ) : null}
            {rover.track.status === 'ready' && !rover.track.data.latest ? (
              <StatusNote text="The traverse feed answered without a position." color={Colors.caution} />
            ) : null}
            {rover.track.status === 'ready' && rover.track.data.latest ? (
              <>
                <Text style={styles.cardTitle}>
                  Sol {rover.track.data.latest.sol}
                  {rover.track.data.latest.drivenKm === null
                    ? ''
                    : ` · ${rover.track.data.latest.drivenKm.toFixed(2)} km driven`}
                </Text>
                <Text style={styles.mono}>{formatLatLon(rover.track.data.latest.point)}</Text>
                <Text style={styles.note}>
                  The white line on the map is the real traverse since landing.
                </Text>
              </>
            ) : null}
            <Text style={styles.source}>Waypoints published by NASA/JPL on mars.nasa.gov.</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function PanelHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelNumber}>{number}</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.panelRule} />
    </View>
  );
}

function SectionHeading({ title, color }: { title: string; color: string }) {
  return (
    <View style={styles.heading} accessible accessibilityRole="header">
      <View style={[styles.headingMarker, { backgroundColor: color }]} />
      <Text style={styles.headingText}>{title}</Text>
    </View>
  );
}

function StatusNote({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.statusNote, { borderLeftColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.note}>{text}</Text>
    </View>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reading}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={styles.readingValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  panelNumber: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  panelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingMarker: {
    width: 8,
    height: 8,
    borderRadius: Radius.small,
  },
  headingText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  warning: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  reading: {
    width: '49%',
    minHeight: 68,
    gap: Spacing.one,
    padding: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surfaceRaised,
  },
  readingLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  readingValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  mono: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.small,
    marginTop: Spacing.one + Spacing.half,
  },
  note: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  source: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
