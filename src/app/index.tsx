import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState, useSyncExternalStore } from 'react';
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
  const [activeSite, setActiveSite] = useState<Site>(SITES[0]);

  const wideGlobe = GLOBE_AVAILABLE && hydrated && width >= WIDE_GLOBE;
  const stacked = GLOBE_AVAILABLE && hydrated && !wideGlobe;

  const open = (site: Site) => router.push({ pathname: '/site/[id]', params: { id: site.id } });

  /** With a globe on screen, a card first flies there and the map opens on arrival. */
  const choose = (site: Site, event: Cancellable) => {
    setActiveSite(site);
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
      {SITES.map((site) => (
        <SiteCard key={site.id} site={site} onPress={(event) => choose(site, event)} />
      ))}
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

          #mission-navigation [role="link"] {
            -webkit-backdrop-filter: blur(18px) saturate(150%);
            backdrop-filter: blur(18px) saturate(150%);
          }

          #mission-navigation [id^="mission-tile-"] {
            transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
          }

          @media (prefers-reduced-motion: reduce) {
            #mission-navigation [id^="mission-tile-"] {
              transition: none;
            }
          }
        `}</style>
      </Head>

      {wideGlobe ? (
        <View style={styles.stage}>
          <MarsGlobe ref={globe} sites={SITES} onOpen={open} />
          <View style={styles.topBar} pointerEvents="none">
            <Brand />
          </View>
          <MissionNavigation activeSite={activeSite} onInspect={setActiveSite} onPress={choose} />
          <MissionDetails site={activeSite} />
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

type SiteCardProps = { site: Site; onPress: (event: Cancellable) => void };

type MissionNavigationProps = {
  activeSite: Site;
  onInspect: (site: Site) => void;
  onPress: (site: Site, event: Cancellable) => void;
};

function MissionNavigation({ activeSite, onInspect, onPress }: MissionNavigationProps) {
  return (
    <View nativeID="mission-navigation" style={styles.missionNavigation}>
      <ScrollView
        horizontal
        style={styles.missionNavigationScroll}
        contentContainerStyle={styles.missionNavigationContent}
        showsHorizontalScrollIndicator={false}>
        {SITES.map((site) => (
          <Link key={site.id} href={{ pathname: '/site/[id]', params: { id: site.id } }} onPress={(event) => onPress(site, event)} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Inspect ${site.name}`}
              onFocus={() => onInspect(site)}
              onHoverIn={() => onInspect(site)}
              onPressIn={() => onInspect(site)}>
              {(state) => (
                <View
                  nativeID={`mission-tile-${site.id}`}
                  style={[
                    styles.missionTile,
                    activeSite.id === site.id && styles.missionTileActive,
                    // `hovered` exists on the web only, and the native types do not know it.
                    (state as { hovered?: boolean }).hovered && styles.missionTileHovered,
                  ]}>
                  <Text style={styles.missionTileName}>
                    {site.name}
                  </Text>
                </View>
              )}
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

function MissionDetails({ site }: { site: Site }) {
  return (
    <View style={styles.missionDetails} pointerEvents="none">
      <Text style={styles.section}>MISSION BRIEFING</Text>
      <Text style={styles.detailName}>{site.name}</Text>
      <Text style={styles.detailMission}>{site.mission}</Text>
      <Text style={styles.detailScience}>{site.science}</Text>
      <Text style={styles.detailCoords}>{formatLatLon(site.landing, 2)}</Text>
    </View>
  );
}

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
  missionNavigation: {
    position: 'absolute',
    top: Spacing.three,
    right: 0,
    left: 0,
    zIndex: 1,
    alignItems: 'center',
  },
  missionNavigationContent: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  missionNavigationScroll: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  missionTile: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: 160,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.medium,
    backgroundColor: Colors.surfaceGlass,
  },
  missionTileActive: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceGlassActive,
  },
  missionTileHovered: {
    borderColor: Colors.mars,
    backgroundColor: Colors.surfaceGlassActive,
    transform: [{ translateY: -2 }],
  },
  missionTileName: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  missionDetails: {
    position: 'absolute',
    top: 88,
    right: Spacing.four,
    zIndex: 1,
    width: 340,
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.medium,
    backgroundColor: Colors.surfaceGlass,
  },
  detailName: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '700',
  },
  detailMission: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  detailScience: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 21,
  },
  detailCoords: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
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
    padding: Spacing.three,
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
});
