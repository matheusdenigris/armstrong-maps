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

/** From this width the site dock can overlay the globe without crowding it. */
const WIDE_GLOBE = 980;

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

  const wideGlobe = GLOBE_AVAILABLE && hydrated && width >= WIDE_GLOBE;
  const stacked = GLOBE_AVAILABLE && hydrated && !wideGlobe;

  const open = (site: Site) => router.push({ pathname: '/site/[id]', params: { id: site.id } });

  /** With a globe on screen, a card first flies there and the map opens on arrival. */
  const choose = (site: Site, event: Cancellable) => {
    if (!globe.current) return;
    event.preventDefault();
    globe.current.flyTo(site);
  };

  const list = (
    <ScrollView nativeID="landing-site-dock" contentContainerStyle={styles.list}>
      {!GLOBE_AVAILABLE || !hydrated ? <Hero /> : null}
      <Text style={styles.section} accessibilityRole="header">
        LANDING SITES
      </Text>
      {SITES.map((site, index) => (
        <SiteCard key={site.id} index={index + 1} site={site} onPress={(event) => choose(site, event)} />
      ))}
      <Link href="/docs" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Docs: the NASA data and APIs behind the map">
          {(state) => (
            <View
              style={[
                styles.docsCard,
                (state as { hovered?: boolean }).hovered && styles.cardHovered,
                state.pressed && styles.cardPressed,
              ]}>
              <Text style={styles.docsTitle}>Docs and data sources {'›'}</Text>
              <Text style={styles.cardScience}>
                Every NASA API the map reads, what it takes from each, and what is measured, assumed
                or simulated.
              </Text>
            </View>
          )}
        </Pressable>
      </Link>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Armstrong Maps</title>
        <meta name="description" content={TAGLINE} />
        <style>{`
          #landing-site-dock {
            scrollbar-color: ${Colors.mars} transparent;
            scrollbar-width: thin;
          }

          #landing-site-dock::-webkit-scrollbar {
            width: 10px;
            background: transparent;
          }

          #landing-site-dock::-webkit-scrollbar-track {
            background: transparent;
          }

          #landing-site-dock::-webkit-scrollbar-thumb {
            background: ${Colors.mars};
            border: 1px solid ${Colors.text};
            border-radius: ${Radius.large}px;
          }
        `}</style>
      </Head>

      {wideGlobe ? (
        <View style={styles.stage}>
          <MarsGlobe ref={globe} sites={SITES} onOpen={open} />
          <View style={styles.topBar} pointerEvents="none">
            <Brand />
          </View>
          <View style={styles.siteDock}>{list}</View>
          <View style={styles.globeCaption} pointerEvents="none">
            <Text style={styles.hint} numberOfLines={1}>
              Drag to turn, scroll to move in. Blue outlines: high-resolution coverage.
            </Text>
            <Text style={styles.credit}>
              Imagery from NASA/JPL Mars Trek. A NASA Space Apps Challenge 2026 project, with no
              official link to NASA.
            </Text>
          </View>
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

type SiteCardProps = { index: number; site: Site; onPress: (event: Cancellable) => void };

function SiteCard({ index, site, onPress }: SiteCardProps) {
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
            <Text style={styles.cardIndex}>{String(index).padStart(2, '0')}</Text>
            <View style={styles.cardDetails}>
              <Text style={styles.cardName}>{site.name}</Text>
              <Text style={styles.cardMission}>{site.mission}</Text>
              <Text style={styles.cardScience}>{site.science}</Text>
              <Text style={styles.cardCoords}>{formatLatLon(site.landing, 2)}</Text>
            </View>
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
  stage: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  brandBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  brandSub: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 7,
  },
  siteDock: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.four,
    bottom: Spacing.four,
    zIndex: 1,
    width: 340,
  },
  globeCaption: {
    position: 'absolute',
    left: Spacing.four,
    bottom: Spacing.four,
    zIndex: 1,
    gap: Spacing.one,
    maxWidth: 620,
  },
  hint: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  credit: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 16,
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
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
  },
  sub: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 18,
    letterSpacing: 10,
  },
  tagline: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
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
  card: {
    flexDirection: 'row',
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  cardHovered: {
    borderColor: Colors.nav,
  },
  cardPressed: {
    borderColor: Colors.textMuted,
  },
  cardIndex: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 22,
  },
  cardDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  cardName: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMission: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  cardScience: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  cardCoords: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    paddingTop: Spacing.one,
  },
  docsCard: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.nasa,
    backgroundColor: Colors.surface,
  },
  docsTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
  },
});
