import { Link, type Href } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  KIND_LABELS,
  NASA_SOURCES,
  OTHER_SOURCES,
  SOURCES,
  type DataSource,
} from '@/data/sources';
import { CME_WINDOW, DONKI_WINDOW_DAYS } from '@/data/space-weather';
import { WALK_ASSUMPTIONS } from '@/mission/walk';

const DESCRIPTION =
  'How Armstrong Maps works: every NASA API and data source it reads, what it takes from each, and what is measured, assumed or simulated.';

const SOFTWARE: readonly { name: string; use: string; url: string }[] = [
  { name: 'Expo and React Native', use: 'The app on Android, iOS and the web', url: 'https://expo.dev/' },
  { name: 'Expo Router', use: 'The screens and their addresses', url: 'https://docs.expo.dev/router/introduction/' },
  { name: 'three.js', use: 'The globe, on WebGL', url: 'https://threejs.org/' },
  { name: 'Zustand', use: 'The mission state, saved on the device', url: 'https://zustand.docs.pmnd.rs/' },
];

/** The docs: what the app is, every API and source it reads, and how far to trust each number. */
export default function DocsScreen() {
  const a = WALK_ASSUMPTIONS;
  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Docs | Armstrong Maps</title>
        <meta name="description" content={DESCRIPTION} />
      </Head>

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Link href="/" style={styles.back} accessibilityRole="link" accessibilityLabel="Back to the sites">
            {'‹'} Sites
          </Link>
          <Text style={styles.title} accessibilityRole="header">
            DOCS
          </Text>
        </View>

        <Text style={styles.lead}>
          Armstrong Maps puts NASA data about Mars in layers on a map and turns a tapped route into a
          go, caution or no-go verdict. This page lists every source the app reads, the address it
          calls, and where each one shows up.
        </Text>

        <View style={styles.counts}>
          <Count value={NASA_SOURCES.length} label="NASA sources" accent />
          <Count value={SOURCES.filter((s) => s.kind === 'live').length} label="read live" />
          <Count value={OTHER_SOURCES.length} label="other reference" />
        </View>

        <Text style={styles.section} accessibilityRole="header">
          NASA DATA AND APIS
        </Text>
        <Text style={styles.body}>
          NASA sources carry the most weight in the app: the map, the rover traverses and pictures,
          the space weather and the radiation figure all come from NASA missions and services. They
          are listed first, and each one is credited where it appears.
        </Text>
        {NASA_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}

        <Text style={styles.section} accessibilityRole="header">
          OTHER REFERENCES
        </Text>
        {OTHER_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}

        <Text style={styles.section} accessibilityRole="header">
          USING THE NASA KEY
        </Text>
        <Text style={styles.body}>
          Only DONKI, on api.nasa.gov, takes a key. The app reads it from{' '}
          <Text style={styles.code}>EXPO_PUBLIC_NASA_API_KEY</Text> when it is built and falls back
          to the shared <Text style={styles.code}>DEMO_KEY</Text>, whose limit is counted per
          visitor. The web app is a static export, so a key set there is visible in the page: use a
          key made for this app only. Every other source needs no key. The app asks DONKI for the
          last {DONKI_WINDOW_DAYS} days, once per visit.
        </Text>

        <Text style={styles.section} accessibilityRole="header">
          MEASURED, ASSUMED OR SIMULATED
        </Text>
        <Rule
          label="MEASURED"
          color={Colors.go}
          text="Map imagery, rover traverses and pictures, weather at Gale and the radiation average. Each is shown with its source and date."
        />
        <Rule
          label="FORECAST"
          color={Colors.nav}
          text="CME arrivals at Mars come from the WSA-Enlil model run by NASA's CCMC. They are a forecast, not a reading on Mars."
        />
        <Rule
          label="ASSUMPTION"
          color={Colors.caution}
          text={`Choices of this project, not NASA rules: walking at ${a.walkingSpeedKmh} km/h, ${a.lifeSupportHours} h of life support with a ${Math.round(a.reserveFraction * 100)}% reserve, ${a.minutesPerStop} min per stop, a ${a.walkBackLimitKm} km walk-back limit, and a CME counting against a walk from ${CME_WINDOW.aheadHours} h before its arrival to ${CME_WINDOW.behindHours} h after.`}
        />
        <Rule
          label="SIMULATED"
          color={Colors.textMuted}
          text="The walk itself: nobody is walking the route, and the base stands on the landing point of each mission."
        />

        <Text style={styles.section} accessibilityRole="header">
          SOFTWARE
        </Text>
        {SOFTWARE.map((item) => (
          <View key={item.name} style={styles.softwareRow}>
            <ExternalLink url={item.url} style={styles.link}>
              {item.name}
            </ExternalLink>
            <Text style={styles.small}>{item.use}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Armstrong Maps is a NASA Space Apps Challenge 2026 project with no official link to NASA.
          The data belongs to its sources. Code under the MIT License.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  return (
    <View style={[styles.card, source.nasa && styles.cardNasa]}>
      <View style={styles.tags}>
        {source.nasa ? <Text style={[styles.tag, styles.tagNasa]}>NASA</Text> : null}
        <Text style={styles.tag}>{KIND_LABELS[source.kind]}</Text>
      </View>
      <Text style={[styles.cardName, source.nasa && styles.cardNameNasa]}>{source.name}</Text>
      <Text style={styles.publisher}>{source.publisher}</Text>
      <Field label="Gives" value={source.gives} />
      <Field label="In the app" value={source.usedIn} />
      <Text style={styles.fieldLabel}>{source.kind === 'published' ? 'Citation' : 'Endpoint'}</Text>
      <Text style={styles.endpoint} selectable>
        {source.endpoint}
      </Text>
      <Field label="Key" value={source.key} />
      <Field label="Notes" value={source.notes} />
      <ExternalLink url={source.reference} style={styles.link}>
        Read more {'›'}
      </ExternalLink>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.small}>{value}</Text>
    </View>
  );
}

function Count({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={[styles.count, accent && styles.countAccent]}>
      <Text style={[styles.countValue, accent && styles.countValueAccent]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Rule({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <View style={[styles.rule, { borderLeftColor: color }]}>
      <Text style={[styles.ruleLabel, { color }]}>{label}</Text>
      <Text style={styles.small}>{text}</Text>
    </View>
  );
}

type ExternalLinkProps = { url: string; style: object; children: ReactNode };

/** Opens outside the app: a new tab on the web, the browser on a phone. */
function ExternalLink({ url, style, children }: ExternalLinkProps) {
  return (
    <Link href={url as Href} target="_blank" rel="noopener noreferrer" style={style} accessibilityRole="link">
      {children}
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  page: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  back: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
    paddingRight: Spacing.two,
    minHeight: 44,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  lead: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 25,
  },
  counts: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  count: {
    flex: 1,
    padding: Spacing.two + Spacing.one,
    gap: Spacing.half,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  countAccent: {
    borderColor: Colors.nasa,
  },
  countValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 24,
    fontWeight: '700',
  },
  countValueAccent: {
    color: Colors.nasa,
  },
  countLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  section: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
    paddingTop: Spacing.three,
  },
  body: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardNasa: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.nasa,
    backgroundColor: Colors.surfaceRaised,
  },
  tags: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tag: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tagNasa: {
    color: Colors.text,
    fontWeight: '700',
    borderColor: Colors.nasa,
    backgroundColor: Colors.nasa,
  },
  cardName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
  },
  cardNameNasa: {
    fontSize: 18,
    fontWeight: '700',
  },
  publisher: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  field: {
    gap: Spacing.half,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  small: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  endpoint: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    padding: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: Colors.background,
  },
  link: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  rule: {
    gap: Spacing.one,
    paddingLeft: Spacing.two + Spacing.one,
    borderLeftWidth: 3,
  },
  ruleLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  softwareRow: {
    gap: Spacing.half,
  },
  footer: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
});
