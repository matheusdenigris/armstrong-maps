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
import {
  MEDA_CREDIT,
  REMS_CREDIT,
  SKY_WORD_CHECK,
  STALE_AFTER_DAYS,
  describeAge,
  latestMeasured,
  readingAgeDays,
  type SolWeather,
} from '@/data/weather';
import { formatDistance, formatLatLon } from '@/mission/format';
import { DUST_SEASON_LS, DUST_SEASON_SOURCE, inDustSeason, marsTime } from '@/mission/mars-time';
import type { Feed } from '@/state/use-feed';

type EnvironmentPanelProps = {
  siteName: string;
  /** How far the site is from Gale crater, where the weather is measured, in metres. */
  distanceFromGaleM: number;
  weather: Feed<SolWeather[]>;
  /**
   * The site's own weather station, when NASA serves one: Perseverance's at Jezero. Its feed
   * stopped in 2024, so it is a dated measurement beside the Gale reference, not instead of it.
   */
  ownStation?: Feed<SolWeather[]> | null;
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
  ownStation = null,
  rover,
  space,
}: EnvironmentPanelProps) {
  // Within a few kilometres of Bradbury Landing the readings are local.
  const local = distanceFromGaleM < 50_000;
  const latest = weather.status === 'ready' ? weather.data[0] : undefined;
  // The feed can stop for months: how old the reading is belongs beside the reading.
  const age = latest ? readingAgeDays(latest.earthDate, space.now) : null;
  const stale = age !== null && age > STALE_AFTER_DAYS;
  // The season comes from the Mars clock, so it is of this moment even when the feed is old.
  const ls = marsTime(space.now).ls;
  const dusty = inDustSeason(ls);

  return (
    <View style={styles.panel}>
      <PanelHeading title="Site conditions" />
      {ownStation ? <OwnStationCard siteName={siteName} feed={ownStation} now={space.now} /> : null}
      <SectionHeading title="WEATHER · MEASURED AT GALE CRATER" color={Colors.nav} />
      {!local ? (
        <Text style={styles.warning}>
          {siteName} is {formatDistance(distanceFromGaleM)} from the weather station. These
          readings are a reference, not the weather here.
        </Text>
      ) : null}
      {weather.status === 'loading' || weather.status === 'idle' ? (
        <StatusNote text="Fetching the latest sol." color={Colors.nav} />
      ) : null}
      {weather.status === 'failed' ? (
        <StatusNote text="The weather feed failed. No reading to show." color={Colors.noGo} />
      ) : null}
      {weather.status === 'ready' && !latest ? (
        <StatusNote text="The weather feed didn't return any sol." color={Colors.caution} />
      ) : null}
      {latest ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Sol {latest.sol} · {latest.earthDate} on Earth
          </Text>
          {age !== null ? (
            <View style={styles.age}>
              <View
                style={[styles.ageDot, { backgroundColor: stale ? Colors.caution : Colors.go }]}
              />
              <Text style={[styles.ageText, stale && styles.ageTextStale]}>
                {stale
                  ? `Measured ${describeAge(age)}: not the weather of today`
                  : `Measured ${describeAge(age)}`}
              </Text>
            </View>
          ) : null}
          <View style={styles.grid}>
            <Reading label="Air temperature" value={range(latest.minAirC, latest.maxAirC)} />
            <Reading label="Ground temperature" value={range(latest.minGroundC, latest.maxGroundC)} />
            <Reading
              label="Pressure"
              value={latest.pressurePa === null ? 'No reading' : `${latest.pressurePa} Pa`}
            />
            <Reading label="Sky, as the feed words it" value={latest.sky ?? 'No reading'} />
            <Reading label="Ultraviolet" value={latest.uvIndex ?? 'No reading'} />
            <Reading
              label="Sunrise and sunset"
              value={
                latest.sunrise && latest.sunset ? `${latest.sunrise} to ${latest.sunset}` : 'No reading'
              }
            />
          </View>
          <Text style={styles.source}>
            {REMS_CREDIT}. The latest sol the feed has
            {age === null ? '; it can be weeks behind today.' : '.'}
          </Text>
        </View>
      ) : null}

      <SectionHeading title="DUST · NO MEASUREMENT" color={Colors.caution} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>No dust reading is published for any site</Text>
        <Text style={styles.note}>
          NASA serves no feed of atmospheric opacity. The sky word of the weather feed said
          &quot;Sunny&quot; on {SKY_WORD_CHECK.sunny.toLocaleString('en-US')} of its{' '}
          {SKY_WORD_CHECK.sols.toLocaleString('en-US')} sols, the {SKY_WORD_CHECK.stormSols2018}{' '}
          sols of the global dust storm of 2018 included, so it does not tell dust from clear sky.
        </Text>
        <View style={styles.grid}>
          <View style={[styles.reading, styles.readingWide]}>
            <Text style={styles.readingLabel}>Season on Mars now</Text>
            <Text style={styles.readingValue}>
              Ls {Math.round(ls)}° · {dusty ? 'in' : 'outside'} the dust storm season (Ls{' '}
              {DUST_SEASON_LS.from}° to {DUST_SEASON_LS.to}°)
            </Text>
          </View>
        </View>
        <Text style={styles.note}>
          {dusty
            ? 'Regional and global dust storms happen in this half of the Mars year. A season is not a forecast: check the latest orbital images before a walk.'
            : 'The large dust storms happen in the other half of the Mars year. A local storm can still rise at any time.'}{' '}
          Dust does not change the walk verdict: there is no measurement to judge it with.
        </Text>
        <Text style={styles.source}>
          Season: {DUST_SEASON_SOURCE}; Ls from the Mars24 algorithm (NASA GISS). Sky word counted
          over the whole feed on {SKY_WORD_CHECK.checkedOn}.
        </Text>
      </View>

      <SectionHeading title="RADIATION · PUBLISHED AVERAGE" color={Colors.caution} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {SURFACE_RADIATION.msvPerDay} ± {SURFACE_RADIATION.uncertaintyMsvPerDay} mSv per Earth day
        </Text>
        <Text style={styles.note}>{SURFACE_RADIATION.caveat}</Text>
        <Text style={styles.source}>{SURFACE_RADIATION.source}. Not a live reading.</Text>
      </View>

      <SectionHeading title="SPACE WEATHER · NASA DONKI" color={Colors.cyan} />
      <SpaceWeatherCard {...space} />

      {rover ? (
        <>
          <SectionHeading title={`ROVER · ${rover.name.toUpperCase()}`} color={Colors.mars} />
          <View style={styles.card}>
            {rover.track.status === 'loading' || rover.track.status === 'idle' ? (
              <StatusNote text="Fetching the traverse." color={Colors.mars} />
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

/**
 * What the site's own station measured, on the last sol its feed has a reading for. The feed of
 * Perseverance stopped in 2024, so the card leads with the date.
 */
function OwnStationCard({
  siteName,
  feed,
  now,
}: {
  siteName: string;
  feed: Feed<SolWeather[]>;
  now: Date;
}) {
  const sols = feed.status === 'ready' ? feed.data : [];
  const measured = latestMeasured(sols);
  const age = measured ? readingAgeDays(measured.earthDate, now) : null;
  const stale = age !== null && age > STALE_AFTER_DAYS;
  const first = sols.length > 0 ? sols[sols.length - 1].sol : null;
  const last = sols.length > 0 ? sols[0].sol : null;
  return (
    <>
      <SectionHeading
        title={`WEATHER · MEASURED AT ${siteName.toUpperCase()}`}
        color={Colors.nav}
      />
      {feed.status === 'loading' || feed.status === 'idle' ? (
        <StatusNote text="Fetching what Perseverance measured here." color={Colors.nav} />
      ) : null}
      {feed.status === 'failed' ? (
        <StatusNote
          text="The Perseverance weather feed failed. No reading from this site to show."
          color={Colors.noGo}
        />
      ) : null}
      {feed.status === 'ready' && !measured ? (
        <StatusNote
          text="The Perseverance weather feed has no sol with a reading."
          color={Colors.caution}
        />
      ) : null}
      {measured ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Sol {measured.sol} · {measured.earthDate} on Earth
          </Text>
          {age !== null ? (
            <View style={styles.age}>
              <View
                style={[styles.ageDot, { backgroundColor: stale ? Colors.caution : Colors.go }]}
              />
              <Text style={[styles.ageText, stale && styles.ageTextStale]}>
                {stale
                  ? `Measured ${describeAge(age)}: not the weather of today`
                  : `Measured ${describeAge(age)}`}
              </Text>
            </View>
          ) : null}
          <View style={styles.grid}>
            <Reading label="Air temperature" value={range(measured.minAirC, measured.maxAirC)} />
            <Reading
              label="Pressure"
              value={measured.pressurePa === null ? 'No reading' : `${measured.pressurePa} Pa`}
            />
            <Reading
              label="Sunrise and sunset"
              value={
                measured.sunrise && measured.sunset
                  ? `${measured.sunrise} to ${measured.sunset}`
                  : 'No reading'
              }
            />
            <Reading
              label="Season then"
              value={
                measured.solarLongitude === null
                  ? 'No reading'
                  : `Ls ${Math.round(measured.solarLongitude)}°`
              }
            />
          </View>
          <Text style={styles.source}>
            {MEDA_CREDIT}.{' '}
            {first !== null && last !== null
              ? `The public feed holds sols ${first} to ${last} and has not moved since. `
              : ''}
            It has no ground temperature, ultraviolet, wind or sky.
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** "2026-10-27T12:00Z" as "2026-10-27 12:00 UTC". */
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

const hours = (value: number) =>
  Math.abs(value) < 48
    ? `${Math.round(Math.abs(value))} h`
    : `${Math.round(Math.abs(value) / 24)} days`;

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
    <>
      {arrivals.status === 'idle' || arrivals.status === 'loading' ? (
        <StatusNote text="Fetching DONKI for CME forecasts at Mars." color={Colors.cyan} />
      ) : null}
      {arrivals.status === 'failed' ? (
        <StatusNote
          text="DONKI did not answer (it may be busy or over its hourly limit). No forecast to show, and the walk verdict does not count space weather."
          color={Colors.noGo}
        />
      ) : null}
      <View style={styles.card}>
        {forecast ? (
          <>
            <Text style={[styles.cardTitle, alert && { color: Colors.caution }]}>
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
                {forecast.weak.hours >= 0
                  ? `in ${hours(forecast.weak.hours)}`
                  : `${hours(forecast.weak.hours)} ago`}{' '}
                ({utc(forecast.weak.arrival.arrivalTime)}). The model rates it too weak to change
                the verdict.
              </Text>
            ) : null}
            <Text style={styles.note}>
              {alert
                ? 'The walk verdict adds a caution: solar particles could raise the dose above the average.'
                : `Only a CME the model expects to hit Mars squarely changes the verdict. ${arrivals.status === 'ready' ? arrivals.data.length : 0} arrivals at Mars in the model runs of the last ${DONKI_WINDOW_DAYS} days.`}
            </Text>
          </>
        ) : null}
        <View style={styles.grid}>
          <View style={[styles.reading, styles.readingWide]}>
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
                  : 'Fetching'}
            </Text>
          </View>
        </View>
        <Text style={styles.source}>
          {DONKI_CREDIT}. CME arrivals are a WSA-Enlil model forecast; particle events are seen
          near the Earth. Neither is a reading on Mars. The {CME_WINDOW.aheadHours} h window is a
          project assumption.
        </Text>
      </View>
    </>
  );
}

function PanelHeading({ title }: { title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelTitle}>{title}</Text>
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
    <View style={styles.statusNote}>
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
    paddingTop: Spacing.one,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headingText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  warning: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.cautionTint,
    overflow: 'hidden',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  age: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ageText: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  ageTextStale: {
    color: Colors.caution,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  reading: {
    width: '48.6%',
    minHeight: 64,
    gap: Spacing.one,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: Colors.glassLight,
  },
  readingWide: {
    width: '100%',
    minHeight: 0,
  },
  readingLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
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
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.one + Spacing.half,
  },
  note: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  source: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
