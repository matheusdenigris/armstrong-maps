import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { GLOBE_AVAILABLE, MarsGlobe, type GlobeHandle } from '@/components/mars-globe';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { GLOBAL_LAYERS } from '@/data/layers';
import { SITES, type Site } from '@/data/sites';
import { formatLatLon } from '@/mission/format';

/** The reference screen swaps its horizontal rail for a right-side mission stack here. */
const WIDE_LAYOUT = 980;
const SHORT_VIEWPORT = 520;

const TAGLINE = 'A layered map of Mars for planning and following walks on the surface.';
const MOSAIC_COUNT = SITES.reduce((count, site) => count + site.layers.length, 0);

/** A press on the web is a mouse event and on a phone a touch; both can be cancelled. */
type Cancellable = { preventDefault: () => void };

/**
 * False while the page is still the HTML rendered ahead of time, which does not know the window
 * size. The first browser render must agree with that HTML before responsive globe UI appears.
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
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [pickedSite, setPickedSite] = useState<string | null>(null);

  const showGlobe = GLOBE_AVAILABLE && hydrated;
  const wide = showGlobe && width >= WIDE_LAYOUT && height > SHORT_VIEWPORT;
  const shortViewport = showGlobe && height <= SHORT_VIEWPORT;
  const titleSize = wide ? Math.min(50, Math.max(28, Math.round(width * 0.038))) : 28;

  const open = (site: Site) => router.push({ pathname: '/site/[id]', params: { id: site.id } });

  /** With a globe on screen, a card first flies there and the map opens on arrival. */
  const choose = (site: Site, event: Cancellable) => {
    setPickedSite(site.id);
    if (!globe.current) return;
    event.preventDefault();
    globe.current.flyTo(site);
  };

  const isActive = (site: Site) => site.id === hoveredSite || site.id === pickedSite;

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Armstrong Maps</title>
        <meta name="description" content={TAGLINE} />
        <style>{`
          #landing-globe [id^="landing-site-"],
          #landing-globe #landing-docs,
          #landing-globe [id^="globe-label-"] {
            cursor: pointer;
          }

          #landing-globe [id^="landing-site-"],
          #landing-globe #landing-docs {
            transition: transform 180ms cubic-bezier(0.2, 0.7, 0.2, 1), border-color 180ms ease, box-shadow 180ms ease;
          }

          #landing-globe [id^="landing-site-"]:hover,
          #landing-globe #landing-docs:hover {
            transform: translateX(-4px);
          }

          @media (max-width: ${WIDE_LAYOUT - 1}px) {
            #landing-globe [id^="landing-site-"]:hover,
            #landing-globe #landing-docs:hover {
              transform: none;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            #landing-globe [id^="landing-site-"] {
              transition: none;
            }
          }
        `}</style>
      </Head>

      {showGlobe ? (
        <View nativeID="landing-globe" style={styles.globeScreen}>
          <MarsGlobe ref={globe} sites={SITES} onOpen={open} />
          <GlobeVignette wide={wide} />
          <MissionBar wide={wide} />
          <GlobeIntro compact={shortViewport} titleSize={titleSize} wide={wide} />

          {!shortViewport ? (
            <Text
              pointerEvents="none"
              style={[styles.globeHint, wide ? styles.globeHintWide : styles.globeHintMobile]}>
              {pickedSite
                ? `DESCENDING TO ${SITES.find((site) => site.id === pickedSite)?.name ?? 'MISSION SITE'}…`
                : 'DRAG TO ROTATE · TAP A SITE'}
            </Text>
          ) : null}

          <SiteRail
            active={isActive}
            onHoverIn={(site) => setHoveredSite(site.id)}
            onHoverOut={(site) =>
              setHoveredSite((current) => (current === site.id ? null : current))
            }
            onPress={choose}
            wide={wide}
          />
          <CoverageLegend wide={wide} />
        </View>
      ) : (
        <FallbackLanding
          active={isActive}
          onHoverIn={(site) => setHoveredSite(site.id)}
          onHoverOut={(site) =>
            setHoveredSite((current) => (current === site.id ? null : current))
          }
          onPress={choose}
        />
      )}
    </SafeAreaView>
  );
}

type ActiveSite = (site: Site) => boolean;
type HoverSite = (site: Site) => void;
type SitePress = (site: Site, event: Cancellable) => void;

/** The mission-control strip anchors the landing screen without taking focus from the globe. */
function MissionBar({ wide }: { wide: boolean }) {
  return (
    <View pointerEvents="none" style={styles.missionBar}>
      <Brand logoSize={30} />
      {wide ? <MissionBadge text="SPACE APPS 2026" /> : null}
      <View style={styles.barSpacer} />
      {wide ? <MissionBadge live text="NASA/JPL DATA" /> : null}
    </View>
  );
}

/** The symbol and wordmark share the disciplined, technical typography of the reference screen. */
function Brand({ logoSize }: { logoSize: number }) {
  return (
    <View style={styles.brand}>
      <Logo size={logoSize} />
      <Text style={styles.brandName}>
        ARMSTRONG <Text style={styles.brandAccent}>MAPS</Text>
      </Text>
    </View>
  );
}

function MissionBadge({ live = false, text }: { live?: boolean; text: string }) {
  return (
    <View style={styles.missionBadge}>
      {live ? <View style={styles.liveDot} /> : null}
      <Text style={styles.missionBadgeText}>{text}</Text>
    </View>
  );
}

function GlobeVignette({ wide }: { wide: boolean }) {
  return (
    <View pointerEvents="none" style={styles.vignette}>
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteTopFade} />
      <View style={styles.vignetteBottomFade} />
      <View style={styles.vignetteBottom} />
      {wide ? (
        <>
          <View style={styles.vignetteLeft} />
          <View style={styles.vignetteLeftFade} />
          <View style={styles.vignetteRightFade} />
          <View style={styles.vignetteRight} />
        </>
      ) : null}
    </View>
  );
}

function GlobeIntro({
  compact,
  titleSize,
  wide,
}: {
  compact: boolean;
  titleSize: number;
  wide: boolean;
}) {
  const headlineSize = compact ? 20 : titleSize;
  const headlineStyle = { fontSize: headlineSize, lineHeight: Math.round(headlineSize * 1.12) };

  return (
    <View
      pointerEvents="none"
      style={[styles.globeIntro, wide ? styles.globeIntroWide : styles.globeIntroMobile]}>
      <Text style={styles.eyebrow}>INTERPLANETARY SURVIVAL GUIDE</Text>
      <View accessibilityRole="header">
        <Text style={[styles.globeTitle, headlineStyle]}>MARS,</Text>
        <Text style={[styles.globeTitle, styles.globeTitleAccent, headlineStyle]}>
          LAYER BY LAYER
        </Text>
      </View>
      {!compact ? (
        <Text style={styles.lede}>
          Pick a marked landing site to descend to the surface, cross-check mission data and plan the
          walk.
        </Text>
      ) : null}
      {wide ? <GlobeStats /> : null}
    </View>
  );
}

function GlobeStats() {
  return (
    <View style={styles.stats}>
      <Stat label="MISSION SITES" value={String(SITES.length).padStart(2, '0')} />
      <Stat label="REGIONAL MOSAICS" value={String(MOSAIC_COUNT)} />
      <Stat label="GLOBAL LAYERS" value={String(GLOBAL_LAYERS.length).padStart(2, '0')} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SiteRail({
  active,
  onHoverIn,
  onHoverOut,
  onPress,
  wide,
}: {
  active: ActiveSite;
  onHoverIn: HoverSite;
  onHoverOut: HoverSite;
  onPress: SitePress;
  wide: boolean;
}) {
  return (
    <View style={[styles.siteRailFrame, wide ? styles.siteRailFrameWide : styles.siteRailFrameMobile]}>
      {wide ? <Text style={styles.siteRailLabel}>MISSION SITES</Text> : null}
      <ScrollView
        horizontal={!wide}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={wide}
        contentContainerStyle={[
          styles.siteRailContent,
          wide ? styles.siteRailContentWide : styles.siteRailContentMobile,
        ]}
        style={styles.siteRail}>
        {SITES.map((site, index) => (
          <SiteCard
            key={site.id}
            active={active(site)}
            index={index}
            onHoverIn={() => onHoverIn(site)}
            onHoverOut={() => onHoverOut(site)}
            onPress={(event) => onPress(site, event)}
            site={site}
            wide={wide}
          />
        ))}
        <DocsTile wide={wide} />
      </ScrollView>
    </View>
  );
}

/** The field guide is a first-class destination beside the sites it documents. */
function DocsTile({ wide }: { wide: boolean }) {
  return (
    <Link href="/docs" asChild>
      <Pressable
        nativeID="landing-docs"
        accessibilityLabel="Open mission documentation"
        accessibilityRole="link"
        style={({ pressed }) => [
          styles.siteCardPressable,
          wide && styles.siteCardPressableWide,
          pressed && styles.siteCardPressed,
        ]}>
        {({ pressed }) => (
          <View style={[styles.siteCard, styles.docsCard, pressed && styles.siteCardPressedSurface]}>
            <View pointerEvents="none" style={[styles.siteCardEdge, styles.docsCardEdge]} />
            <View style={styles.siteCardContent}>
              <Text style={styles.siteIndex}>{String(SITES.length + 1).padStart(2, '0')}</Text>
              <View style={styles.siteCardCopy}>
                <Text numberOfLines={1} style={styles.siteName}>
                  Mission docs
                </Text>
                <Text numberOfLines={1} style={styles.siteMission}>
                  Methods, sources and field guide
                </Text>
                <Text style={styles.docsAction}>OPEN DOCUMENTATION →</Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

type SiteCardProps = {
  active: boolean;
  index: number;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: (event: Cancellable) => void;
  site: Site;
  wide: boolean;
};

/** A focused card is the non-WebGL version of the reference's moving spotlight surface. */
function SiteCard({ active, index, onHoverIn, onHoverOut, onPress, site, wide }: SiteCardProps) {
  const [spotlight, setSpotlight] = useState<{ x: number; y: number } | null>(null);

  return (
    <Link href={{ pathname: '/site/[id]', params: { id: site.id } }} onPress={onPress} asChild>
      <Pressable
        nativeID={`landing-site-${site.id}`}
        accessibilityLabel={`Open the map of ${site.name}`}
        accessibilityRole="link"
        onHoverIn={onHoverIn}
        onHoverOut={() => {
          setSpotlight(null);
          onHoverOut();
        }}
        onFocus={onHoverIn}
        onBlur={onHoverOut}
        onPointerMove={(event) =>
          setSpotlight({ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY })
        }
        style={({ pressed }) => [
          styles.siteCardPressable,
          wide && styles.siteCardPressableWide,
          pressed && styles.siteCardPressed,
        ]}>
        {({ pressed }) => (
          <View style={[styles.siteCard, active && styles.siteCardActive, pressed && styles.siteCardPressedSurface]}>
            <View
              pointerEvents="none"
              style={[
                styles.siteCardSpotlight,
                active && styles.siteCardSpotlightActive,
                spotlight && {
                  left: spotlight.x - 110,
                  top: spotlight.y - 110,
                },
              ]}>
              <View style={styles.siteCardSpotlightCore} />
            </View>
            <View pointerEvents="none" style={[styles.siteCardEdge, active && styles.siteCardEdgeActive]} />
            <View style={styles.siteCardContent}>
              <Text style={styles.siteIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.siteCardCopy}>
                <Text numberOfLines={1} style={styles.siteName}>
                  {site.name}
                </Text>
                <Text numberOfLines={1} style={styles.siteMission}>
                  {site.mission}
                </Text>
                <Text style={styles.siteCoords}>{formatLatLon(site.landing, 2)}</Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function CoverageLegend({ inline = false, wide }: { inline?: boolean; wide: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.coverageLegend, inline && styles.coverageLegendInline]}>
      <View style={styles.legendLead}>
        <View style={styles.coverageSwatch} />
        <Text style={styles.legendText}>MARKED LANDING SITES HAVE HIGH-RESOLUTION DATA</Text>
      </View>
      {wide ? (
        <Text style={styles.legendCredit}>
          Image: NASA/JPL/USGS, Viking MDIM 2.1 · Hackathon project, not affiliated with NASA
        </Text>
      ) : null}
    </View>
  );
}

/** Native platforms and pre-hydration HTML still offer every site without a browser-only globe. */
function FallbackLanding({
  active,
  onHoverIn,
  onHoverOut,
  onPress,
}: {
  active: ActiveSite;
  onHoverIn: HoverSite;
  onHoverOut: HoverSite;
  onPress: SitePress;
}) {
  return (
    <ScrollView contentContainerStyle={styles.fallbackContent} style={styles.fallbackScroll}>
      <View style={styles.fallbackBar}>
        <Brand logoSize={30} />
        <MissionBadge live text="NASA/JPL DATA" />
      </View>

      <View style={styles.fallbackHero}>
        <Text style={styles.eyebrow}>INTERPLANETARY SURVIVAL GUIDE</Text>
        <Text accessibilityRole="header" style={styles.fallbackTitle}>
          MARS,
        </Text>
        <Text accessibilityRole="header" style={[styles.fallbackTitle, styles.globeTitleAccent]}>
          LAYER BY LAYER
        </Text>
        <Text style={styles.fallbackLede}>{TAGLINE}</Text>
        <GlobeStats />
      </View>

      <View style={styles.fallbackSites}>
        <Text style={styles.siteRailLabel}>MISSION SITES</Text>
        {SITES.map((site, index) => (
          <SiteCard
            key={site.id}
            active={active(site)}
            index={index}
            onHoverIn={() => onHoverIn(site)}
            onHoverOut={() => onHoverOut(site)}
            onPress={(event) => onPress(site, event)}
            site={site}
            wide
          />
        ))}
        <DocsTile wide />
      </View>

      <View style={styles.fallbackLegend}>
        <CoverageLegend inline wide={false} />
        <Text style={styles.fallbackCredit}>
          Imagery from NASA/JPL Mars Trek. A NASA Space Apps Challenge 2026 project, with no
          official link to NASA.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  globeScreen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  missionBar: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    left: 0,
    right: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  barSpacer: {
    flex: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 2,
  },
  brandAccent: {
    color: Colors.mars,
  },
  missionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one - 1,
    borderRadius: Radius.small - 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  missionBadgeText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.go,
    shadowColor: Colors.go,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  vignette: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 82,
    backgroundColor: Colors.background,
    opacity: 0.78,
  },
  vignetteTopFade: {
    position: 'absolute',
    top: 82,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: Colors.background,
    opacity: 0.26,
  },
  vignetteBottomFade: {
    position: 'absolute',
    bottom: 82,
    left: 0,
    right: 0,
    height: 112,
    backgroundColor: Colors.background,
    opacity: 0.3,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: Colors.background,
    opacity: 0.86,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '18%',
    backgroundColor: Colors.background,
    opacity: 0.5,
  },
  vignetteLeftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '18%',
    width: '16%',
    backgroundColor: Colors.background,
    opacity: 0.18,
  },
  vignetteRightFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '20%',
    width: '14%',
    backgroundColor: Colors.background,
    opacity: 0.15,
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '20%',
    backgroundColor: Colors.background,
    opacity: 0.42,
  },
  globeIntro: {
    position: 'absolute',
    zIndex: 2,
  },
  globeIntroMobile: {
    top: 72,
    left: Spacing.three,
    right: Spacing.three,
  },
  globeIntroWide: {
    top: 88,
    left: Spacing.five,
    width: 460,
  },
  eyebrow: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
  },
  globeTitle: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontWeight: '400',
    letterSpacing: 0.8,
    marginTop: Spacing.two + 2,
    textTransform: 'uppercase',
  },
  globeTitleAccent: {
    color: Colors.mars,
    marginTop: 0,
  },
  lede: {
    maxWidth: 380,
    marginTop: Spacing.three - 2,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 23,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.four + 4,
    marginTop: Spacing.four + 4,
  },
  stat: {
    gap: Spacing.one + 2,
  },
  statValue: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  globeHint: {
    position: 'absolute',
    zIndex: 3,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  globeHintMobile: {
    left: Spacing.three,
    right: Spacing.three,
    bottom: 160,
  },
  globeHintWide: {
    left: Spacing.five,
    bottom: 58,
    textAlign: 'left',
  },
  siteRailFrame: {
    position: 'absolute',
    zIndex: 4,
  },
  siteRailFrameMobile: {
    left: 0,
    right: 0,
    bottom: 45,
    height: 106,
  },
  siteRailFrameWide: {
    top: 88,
    right: Spacing.five,
    bottom: 52,
    width: 300,
  },
  siteRailLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
    marginBottom: Spacing.two + 2,
  },
  siteRail: {
    flex: 1,
  },
  siteRailContent: {
    gap: Spacing.two,
  },
  siteRailContentMobile: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  siteRailContentWide: {
    paddingLeft: Spacing.one + 2,
    paddingBottom: Spacing.one,
  },
  siteCardPressable: {
    width: 230,
    minHeight: 86,
  },
  siteCardPressableWide: {
    width: '100%',
  },
  siteCard: {
    position: 'relative',
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    shadowColor: Colors.nav,
    shadowOpacity: 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  siteCardActive: {
    borderColor: Colors.nav,
    shadowOpacity: 0.28,
  },
  siteCardPressed: {
    transform: [{ translateY: 1 }],
  },
  siteCardPressedSurface: {
    backgroundColor: Colors.surfaceRaised,
  },
  docsCard: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceRaised,
  },
  docsCardEdge: {
    opacity: 1,
    backgroundColor: Colors.cyan,
  },
  siteCardSpotlight: {
    position: 'absolute',
    top: -110,
    left: -110,
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 110,
    backgroundColor: Colors.nav,
    opacity: 0.04,
    shadowColor: Colors.nav,
    shadowOpacity: 0.8,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  siteCardSpotlightActive: {
    opacity: 0.12,
  },
  siteCardSpotlightCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.nav,
    opacity: 0.35,
  },
  siteCardEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    backgroundColor: Colors.nav,
    opacity: 0,
  },
  siteCardEdgeActive: {
    opacity: 1,
  },
  siteCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three - 4,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.three - 4,
  },
  siteIndex: {
    minWidth: 24,
    color: Colors.nav,
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 22,
  },
  siteCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  siteName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  siteMission: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  siteCoords: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    marginTop: Spacing.one - 1,
  },
  docsAction: {
    color: Colors.cyan,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    marginTop: Spacing.one,
  },
  coverageLegend: {
    position: 'absolute',
    zIndex: 5,
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  coverageLegendInline: {
    position: 'relative',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderTopWidth: 0,
  },
  legendLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    flexShrink: 1,
  },
  coverageSwatch: {
    width: 12,
    height: 12,
    borderRadius: Radius.small - 4,
    backgroundColor: Colors.nav,
    shadowColor: Colors.nav,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  legendText: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  legendCredit: {
    maxWidth: 440,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  fallbackScroll: {
    flex: 1,
  },
  fallbackContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  fallbackBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  fallbackHero: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
  fallbackTitle: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 36,
    fontWeight: '400',
    letterSpacing: 1,
    lineHeight: 40,
    marginTop: Spacing.two + 2,
  },
  fallbackLede: {
    maxWidth: 440,
    marginTop: Spacing.three - 2,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 23,
  },
  fallbackSites: {
    gap: Spacing.two,
  },
  fallbackLegend: {
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  fallbackCredit: {
    marginTop: Spacing.two,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
});
