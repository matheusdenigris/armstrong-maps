import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { GLOBE_AVAILABLE, MarsGlobe, type GlobeHandle } from '@/components/mars-globe';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SITES, type Site } from '@/data/sites';
import { formatLatLon } from '@/mission/format';

/** From this width the globe and the list sit side by side. */
const SIDE_BY_SIDE = 900;
const PANEL_WIDTH = 420;

/** A press on the web is a mouse event and on a phone a touch; both can be cancelled. */
type Cancellable = { preventDefault: () => void };

const TAGLINE = 'A layered map of Mars for planning and following walks on the surface.';

/**
 * False while the page is still the HTML that was rendered ahead of time, which knows nothing
 * about the size of the window. The first render in the browser has to match that HTML.
 */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const hydrated = useHydrated();
  const globe = useRef<GlobeHandle>(null);

  const sideBySide = GLOBE_AVAILABLE && hydrated && width >= SIDE_BY_SIDE;
  const stacked = GLOBE_AVAILABLE && hydrated && !sideBySide;

  const open = (site: Site) => router.push({ pathname: '/site/[id]', params: { id: site.id } });

  /** With a globe on screen, a card first flies there and the map opens on arrival. */
  const choose = (site: Site, event: Cancellable) => {
    if (!globe.current) return;
    event.preventDefault();
    globe.current.flyTo(site);
  };

  const list = (
    <ScrollView contentContainerStyle={styles.list}>
      {!GLOBE_AVAILABLE || !hydrated ? <Hero /> : null}
      <Text style={styles.section} accessibilityRole="header">
        LANDING SITES
      </Text>
      {sideBySide ? <Text style={styles.intro}>{TAGLINE}</Text> : null}
      {SITES.map((site) => (
        <SiteCard key={site.id} site={site} onPress={(event) => choose(site, event)} />
      ))}
      <Text style={styles.footer}>
        Imagery from NASA/JPL Mars Trek. A NASA Space Apps Challenge 2026 project, with no official
        link to NASA.
      </Text>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Armstrong Maps</title>
        <meta name="description" content={TAGLINE} />
      </Head>

      {sideBySide ? (
        <View style={styles.row}>
          <View style={styles.stage}>
            <MarsGlobe ref={globe} sites={SITES} onOpen={open} />
            <View style={styles.brandOverlay} pointerEvents="none">
              <Brand />
            </View>
            <Text style={styles.hint} pointerEvents="none">
              Drag to turn, scroll to move in. Blue outlines: high-resolution coverage.
            </Text>
          </View>
          <View style={styles.panel}>{list}</View>
        </View>
      ) : (
        <>
          {stacked ? (
            <>
              <View style={styles.brandBar}>
                <Brand />
              </View>
              <View style={{ height: Math.max(260, Math.round(height * 0.44)) }}>
                <MarsGlobe ref={globe} sites={SITES} onOpen={open} />
              </View>
            </>
          ) : null}
          <View style={styles.fill}>{list}</View>
        </>
      )}
    </SafeAreaView>
  );
}

/** The symbol and the name on one line. */
function Brand() {
  return (
    <View style={styles.brand}>
      <Logo size={40} />
      <View>
        <Text style={styles.brandName}>ARMSTRONG</Text>
        <Text style={styles.brandSub}>MAPS</Text>
      </View>
    </View>
  );
}

/** The opening block when there is no globe to carry the screen. */
function Hero() {
  return (
    <View style={styles.hero}>
      <Logo size={72} />
      <View style={styles.wordmark}>
        <Text style={styles.name}>ARMSTRONG</Text>
        <Text style={styles.sub}>MAPS</Text>
      </View>
      <Text style={styles.tagline}>{TAGLINE}</Text>
    </View>
  );
}

type SiteCardProps = { site: Site; onPress: (event: Cancellable) => void };

function SiteCard({ site, onPress }: SiteCardProps) {
  return (
    <Link href={{ pathname: '/site/[id]', params: { id: site.id } }} onPress={onPress} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open the map of ${site.name}`}>
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
  fill: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  stage: {
    flex: 1,
  },
  panel: {
    width: PANEL_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  brandOverlay: {
    position: 'absolute',
    top: Spacing.four,
    left: Spacing.four,
  },
  brandBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  brandSub: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 7,
  },
  hint: {
    position: 'absolute',
    left: Spacing.four,
    bottom: Spacing.four,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  list: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  wordmark: {
    alignItems: 'center',
    gap: Spacing.one,
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
  section: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
  },
  intro: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  cardHovered: {
    borderColor: Colors.nav,
  },
  cardPressed: {
    backgroundColor: Colors.border,
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
  },
});
