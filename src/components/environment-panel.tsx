import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SURFACE_RADIATION } from '@/data/radiation';
import type { RoverTrack } from '@/data/rover';
import {
  CME_WINDOW,
  DONKI_CREDIT,
  DONKI_WINDOW_DAYS,
  marsSpaceWeather,
  type MarsArrival,
  type SepEvent,
} from '@/data/space-weather';
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
  /** Space weather from NASA DONKI, and the moment it is judged at. */
  space: { arrivals: Feed<MarsArrival[]>; sep: Feed<SepEvent[]>; now: Date };
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
  space,
}: EnvironmentPanelProps) {
  // Within a few kilometres of Bradbury Landing the readings are local.
  const local = distanceFromGaleM < 50_000;
  const latest = weather.status === 'ready' ? weather.data[0] : undefined;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading} accessibilityRole="header">
        WEATHER · MEASURED AT GALE CRATER
      </Text>
      {!local ? (
        <Text style={styles.warning}>
          {siteName} is {formatDistance(distanceFromGaleM)} from the weather station. These
          readings are a reference, not the weather here.
        </Text>
      ) : null}
      {weather.status === 'loading' || weather.status === 'idle' ? (
        <Text style={styles.note}>Asking the station for its latest sol.</Text>
      ) : null}
      {weather.status === 'failed' ? (
        <Text style={styles.note}>The weather feed did not answer. No reading to show.</Text>
      ) : null}
      {weather.status === 'ready' && !latest ? (
        <Text style={styles.note}>The weather feed answered without any sol.</Text>
      ) : null}
      {latest ? (
        <View style={styles.card}>
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

      <Text style={styles.heading} accessibilityRole="header">
        RADIATION · PUBLISHED AVERAGE
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {SURFACE_RADIATION.msvPerDay} ± {SURFACE_RADIATION.uncertaintyMsvPerDay} mSv per Earth day
        </Text>
        <Text style={styles.note}>{SURFACE_RADIATION.caveat}</Text>
        <Text style={styles.source}>{SURFACE_RADIATION.source}. Not a live reading.</Text>
      </View>

      <Text style={styles.heading} accessibilityRole="header">
        SPACE WEATHER · NASA DONKI
      </Text>
      <SpaceWeatherCard {...space} />

      {rover ? (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            ROVER · {rover.name.toUpperCase()}
          </Text>
          <View style={styles.card}>
            {rover.track.status === 'loading' || rover.track.status === 'idle' ? (
              <Text style={styles.note}>Asking for the traverse.</Text>
            ) : null}
            {rover.track.status === 'failed' ? (
              <Text style={styles.note}>The traverse feed did not answer. No position to show.</Text>
            ) : null}
            {rover.track.status === 'ready' && !rover.track.data.latest ? (
              <Text style={styles.note}>The traverse feed answered without a position.</Text>
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

/** "2026-10-27T12:00Z" as "2026-10-27 12:00 UTC". */
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

const hours = (value: number) =>
  Math.abs(value) < 48 ? `${Math.round(Math.abs(value))} h` : `${Math.round(Math.abs(value) / 24)} days`;

/** The CME forecast for Mars and the recent solar particle events, each labelled for what it is. */
function SpaceWeatherCard({ arrivals, sep, now }: EnvironmentPanelProps['space']) {
  const forecast = arrivals.status === 'ready' ? marsSpaceWeather(arrivals.data, now) : null;
  const alert = forecast !== null && forecast.level !== 'quiet';
  const weakKind = forecast?.weak
    ? forecast.weak.arrival.glancing
      ? 'glancing blow'
      : 'minor impact'
    : '';

  return (
    <View style={[styles.card, alert && styles.cardAlert]}>
      {arrivals.status === 'idle' || arrivals.status === 'loading' ? (
        <Text style={styles.note}>Asking DONKI for CME forecasts at Mars.</Text>
      ) : null}
      {arrivals.status === 'failed' ? (
        <Text style={styles.note}>
          DONKI did not answer (it may be busy or over its hourly limit). No forecast to show, and
          the walk verdict does not count space weather.
        </Text>
      ) : null}
      {forecast ? (
        <>
          <Text style={[styles.cardTitle, alert && styles.alertText]}>
            {forecast.level === 'arriving' && forecast.next
              ? `CME forecast to hit Mars in ${hours(forecast.next.hours)}`
              : forecast.level === 'passing' && forecast.next
                ? `A CME hit Mars ${hours(forecast.next.hours)} ago`
                : `No CME forecast to hit Mars in the next ${CME_WINDOW.aheadHours} h`}
          </Text>
          {forecast.next ? (
            <Text style={styles.mono}>
              {forecast.level === 'quiet' ? 'Next forecast: ' : ''}
              {utc(forecast.next.arrival.arrivalTime)}
            </Text>
          ) : null}
          {forecast.weak ? (
            <Text style={styles.note}>
              Also forecast: a {weakKind} at Mars,{' '}
              {forecast.weak.hours >= 0 ? `in ${hours(forecast.weak.hours)}` : `${hours(forecast.weak.hours)} ago`}{' '}
              ({utc(forecast.weak.arrival.arrivalTime)}). The model rates it too weak to change the verdict.
            </Text>
          ) : null}
          <Text style={styles.note}>
            {alert
              ? 'The walk verdict adds a caution: solar particles could raise the dose above the average.'
              : `Only a CME the model expects to hit Mars squarely changes the verdict. ${arrivals.status === 'ready' ? arrivals.data.length : 0} arrivals at Mars in the model runs of the last ${DONKI_WINDOW_DAYS} days.`}
          </Text>
        </>
      ) : null}

      <View style={styles.stack}>
        <Text style={styles.readingLabel}>
          Solar particle events near the Earth, last {DONKI_WINDOW_DAYS} days
        </Text>
        <Text style={styles.readingValue}>
          {sep.status === 'ready'
            ? sep.data.length === 0
              ? 'None'
              : `${sep.data.length} · latest ${utc(sep.data[0].time)}`
            : sep.status === 'failed'
              ? 'No answer from DONKI'
              : 'Asking'}
        </Text>
      </View>
      <Text style={styles.source}>
        {DONKI_CREDIT}. CME arrivals are a WSA-Enlil model forecast; particle events are seen near
        the Earth. Neither is a reading on Mars. The {CME_WINDOW.aheadHours} h window is a project
        assumption.
      </Text>
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
  cardAlert: {
    borderColor: Colors.caution,
  },
  alertText: {
    color: Colors.caution,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
  },
  reading: {
    width: '50%',
    paddingRight: Spacing.two,
    gap: Spacing.half,
  },
  stack: {
    gap: Spacing.half,
  },
  readingLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  readingValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  mono: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
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
