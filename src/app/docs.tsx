import { Link, type Href } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
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

      <View style={styles.missionBar}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to the landing sites"
            style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}>
            <View style={styles.brandIdentity}>
              <Logo size={26} />
              <Text style={styles.brandName} numberOfLines={1}>
                ARMSTRONG <Text style={styles.brandAccent}>MAPS</Text>
              </Text>
            </View>
          </Pressable>
        </Link>
        <View style={styles.barDivider} />
        <Text style={styles.barLabel}>MISSION DOCUMENTATION</Text>
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>INTERPLANETARY SURVIVAL GUIDE</Text>
          <Text style={styles.title} accessibilityRole="header">
            MISSION
          </Text>
          <Text style={[styles.title, styles.titleAccent]} accessibilityRole="header">
            DOCUMENTATION
          </Text>
          <Text style={styles.lead}>
            Armstrong Maps puts NASA data about Mars in layers on a map and turns a tapped route into a
            go, caution or no-go verdict. This page lists every source the app reads, the address it
            calls, and where each one shows up.
          </Text>
        </View>

        <View style={styles.counts}>
          <Count value={NASA_SOURCES.length} label="NASA sources" accent />
          <Count value={SOURCES.filter((s) => s.kind === 'live').length} label="read live" />
          <Count value={OTHER_SOURCES.length} label="other reference" />
        </View>

        <SectionHeading number="01" title="NASA DATA AND APIS" />
        <Text style={styles.body}>
          NASA sources carry the most weight in the app: the map, the rover traverses and pictures,
          the space weather and the radiation figure all come from NASA missions and services. They
          are listed first, and each one is credited where it appears.
        </Text>
        {NASA_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}

        <SectionHeading number="02" title="OTHER REFERENCES" />
        {OTHER_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}

        <SectionHeading number="03" title="USING THE NASA KEY" />
        <Text style={styles.body}>
          Only DONKI, on api.nasa.gov, takes a key. The app reads it from{' '}
          <Text style={styles.code}>EXPO_PUBLIC_NASA_API_KEY</Text> when it is built and falls back
          to the shared <Text style={styles.code}>DEMO_KEY</Text>, whose limit is counted per
          visitor. The web app is a static export, so a key set there is visible in the page: use a
          key made for this app only. Every other source needs no key. The app asks DONKI for the
          last {DONKI_WINDOW_DAYS} days, once per visit.
        </Text>

        <SectionHeading number="04" title="MEASURED, ASSUMED OR SIMULATED" />
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

        <SectionHeading number="05" title="SOFTWARE" />
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

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.sectionHeading} accessibilityRole="header">
      <Text style={styles.sectionNumber}>{number}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
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
  missionBar: {
    zIndex: 2,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.glassStrong,
  },
  brand: {
    width: 176,
    flexShrink: 0,
    minHeight: 44,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
  },
  brandPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
  },
  brandAccent: {
    color: Colors.mars,
  },
  barDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  barLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  page: {
    width: '100%',
    maxWidth: MaxContentWidth + 160,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  hero: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eyebrow: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 34,
    fontWeight: '400',
    letterSpacing: 1,
    lineHeight: 40,
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: Colors.mars,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.4,
    marginTop: -Spacing.two,
  },
  lead: {
    maxWidth: 620,
    marginTop: Spacing.two,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  counts: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  count: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'space-between',
    padding: Spacing.three,
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  countAccent: {
    borderLeftWidth: 3,
    borderColor: Colors.mars,
    borderLeftColor: Colors.mars,
  },
  countValue: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '400',
  },
  countValueAccent: {
    color: Colors.mars,
  },
  countLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionNumber: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  body: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 23,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardNasa: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.mars,
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
    borderRadius: Radius.small - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tagNasa: {
    color: Colors.background,
    fontWeight: '700',
    borderColor: Colors.mars,
    backgroundColor: Colors.mars,
  },
  cardName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  cardNameNasa: {
    fontSize: 14,
    color: Colors.white,
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
    color: Colors.cyan,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    padding: Spacing.two,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderStrong,
    backgroundColor: Colors.background,
  },
  link: {
    color: Colors.cyan,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingTop: Spacing.one,
    minHeight: 44,
  },
  rule: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ruleLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  softwareRow: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  footer: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
