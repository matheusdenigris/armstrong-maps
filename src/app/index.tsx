import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SITES, type Site } from '@/data/sites';
import { formatLatLon } from '@/mission/format';

/** The list is one column on a phone and widens to two and three on larger screens. */
const columnsFor = (width: number) => (width >= 1080 ? 3 : width >= 700 ? 2 : 1);
const MAX_WIDTH = 1120;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const columns = columnsFor(width);
  const wide = columns > 1;

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Armstrong Maps</title>
        <meta
          name="description"
          content="A layered map of Mars for planning and following walks on the surface."
        />
      </Head>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.content, wide && styles.contentWide]}>
          <View style={[styles.hero, wide && styles.heroWide]}>
            <Logo size={wide ? 96 : 72} />
            <View style={[styles.heroText, wide && styles.heroTextWide]}>
              <View style={[styles.wordmark, wide && styles.wordmarkWide]}>
                <Text style={styles.name}>ARMSTRONG</Text>
                <Text style={styles.sub}>MAPS</Text>
              </View>
              <Text style={[styles.tagline, wide && styles.taglineWide]}>
                A layered map of Mars for planning and following walks on the surface.
              </Text>
            </View>
          </View>

          <Text style={styles.section} accessibilityRole="header">
            LANDING SITES
          </Text>
          <View style={styles.grid}>
            {SITES.map((site) => (
              <View key={site.id} style={{ width: `${100 / columns}%` }}>
                <SiteCard site={site} />
              </View>
            ))}
          </View>

          <Text style={styles.footer}>
            Imagery from NASA/JPL Mars Trek. A NASA Space Apps Challenge 2026 project, with no
            official link to NASA.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SiteCard({ site }: { site: Site }) {
  return (
    <Link href={{ pathname: '/site/[id]', params: { id: site.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open the map of ${site.name}`}
        style={styles.cardHit}>
        {(state) => (
          <View
            style={[
              styles.card,
              // `hovered` exists on the web only, and the native types do not know it.
              (state as { hovered?: boolean }).hovered && styles.cardHovered,
              state.pressed && styles.cardPressed,
            ]}>
            <Text style={styles.cardName}>{site.name}</Text>
            <Text style={styles.cardMission}>{site.mission}</Text>
            <Text style={styles.cardScience}>{site.science}</Text>
            <Text style={styles.cardCoords}>{formatLatLon(site.landing, 2)}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
  contentWide: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  heroWide: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  heroText: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTextWide: {
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  wordmark: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  wordmarkWide: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
  },
  sub: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 18,
    letterSpacing: 10,
  },
  tagline: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  taglineWide: {
    textAlign: 'left',
    maxWidth: 520,
  },
  section: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardHit: {
    flex: 1,
    padding: Spacing.two,
  },
  card: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardHovered: {
    borderColor: Colors.nav,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  cardName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMission: {
    color: Colors.mars,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  cardScience: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  cardCoords: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    paddingTop: Spacing.one,
  },
  footer: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.four,
  },
});
