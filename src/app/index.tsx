import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState, useSyncExternalStore } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { GLOBE_AVAILABLE, MarsGlobe, type GlobeHandle } from '@/components/mars-globe';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SITES, type Site } from '@/data/sites';
import { formatLatLon } from '@/mission/format';
import { RELIEF_EXAGGERATION } from '@/mission/relief';

/** From this width the headline sits beside the globe instead of over its top. */
const WIDE_LAYOUT = 900;
/** A phone on its side: there is room for the globe and the sites, not for the headline's text. */
const SHORT_VIEWPORT = 520;

const TAGLINE = 'A layered map of Mars for planning and following walks on the surface.';
const IMAGE_CREDIT = 'Image: NASA/JPL/USGS, Viking MDIM 2.1';
const PROJECT_CREDIT = 'Hackathon project, not affiliated with NASA';
const CREDIT = `${IMAGE_CREDIT} · ${PROJECT_CREDIT}`;

/**
 * What the globe shows and where each part comes from. The relief is named only once the globe
 * has raised its surface: until the heights arrive, and if they never do, it is a smooth sphere.
 */
function globeCredit(relief: boolean): string {
  return [
    IMAGE_CREDIT,
    'Day and night: the Sun over Mars now (Mars24, NASA GISS)',
    relief ? `Relief: MOLA and HRSC, drawn ${RELIEF_EXAGGERATION}× taller` : null,
    'Pale patches: regional mosaics on NASA Mars Trek',
    PROJECT_CREDIT,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A press on the web is a mouse event and on a phone a touch; both can be cancelled. */
type Cancellable = { preventDefault: () => void };
type SitePress = (site: Site, event: Cancellable) => void;

/** Styles only a browser understands: blur behind glass, gradients, transitions. */
const web = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);
const GLASS = web({
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
});
const EASE = web({ transition: 'background-color 160ms ease, border-color 160ms ease' });
const FADE = web({ transition: 'opacity 220ms ease' });

/**
 * False while the page is still the HTML rendered ahead of time, which does not know the window
 * size. The first browser render must agree with that HTML before the globe appears.
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
  const [pickedSite, setPickedSite] = useState<string | null>(null);
  // The site under the pointer, on the globe or in the dock. The last one stays in the brief
  // while it fades out.
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [briefed, setBriefed] = useState<Site | null>(null);
  const [relief, setRelief] = useState(false);
  const hover = (site: Site | null) => {
    setHoveredSite(site ? site.id : null);
    if (site) setBriefed(site);
  };

  const showGlobe = GLOBE_AVAILABLE && hydrated;
  const short = height <= SHORT_VIEWPORT;
  const wide = width >= WIDE_LAYOUT && !short;
  const titleSize = wide ? Math.min(64, Math.max(40, Math.round(width * 0.042))) : short ? 24 : 34;
  const picked = SITES.find((site) => site.id === pickedSite);

  const open = (site: Site) => router.push({ pathname: '/site/[id]', params: { id: site.id } });

  /** With a globe on screen, a site first flies there and the map opens on arrival. */
  const choose: SitePress = (site, event) => {
    setPickedSite(site.id);
    setBriefed(site);
    if (!globe.current) return;
    event.preventDefault();
    globe.current.flyTo(site);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>Armstrong Maps</title>
        <meta name="description" content={TAGLINE} />
      </Head>

      {showGlobe ? (
        <View style={styles.stage}>
          <MarsGlobe
            ref={globe}
            sites={SITES}
            onOpen={open}
            onHover={hover}
            onRelief={() => setRelief(true)}
          />
          {/* The edges of the screen fall off into space, so the text reads over the stars. */}
          <View
            pointerEvents="none"
            style={[
              styles.fill,
              web({
                backgroundImage:
                  'radial-gradient(ellipse at 50% 48%, rgba(4,6,10,0) 46%, rgba(4,6,10,0.7) 100%)',
              }),
            ]}
          />

          <TopBar />
          <Headline size={titleSize} wide={wide} short={short} />
          {wide && briefed ? (
            <SiteBrief site={briefed} shown={hoveredSite !== null || pickedSite !== null} />
          ) : null}

          <View pointerEvents="box-none" style={styles.bottom}>
            {short ? null : (
              <Text pointerEvents="none" style={styles.hint}>
                {picked ? `Descending to ${picked.name}…` : 'Drag to turn the planet · pick a site'}
              </Text>
            )}
            <SiteDock picked={pickedSite} onPress={choose} onHover={hover} wide={wide} />
            <Text pointerEvents="none" style={styles.credit}>
              {globeCredit(relief)}
            </Text>
          </View>
        </View>
      ) : (
        <SiteList onPress={choose} />
      )}
    </SafeAreaView>
  );
}

/** The name of the app and the way to the documentation, floating over the globe. */
function TopBar() {
  return (
    <View pointerEvents="box-none" style={styles.bar}>
      <Brand />
      <View style={styles.spacer} pointerEvents="none" />
      <DocsLink />
    </View>
  );
}

function Brand() {
  return (
    <View style={styles.brand} pointerEvents="none">
      <Logo size={28} />
      <Text style={styles.brandName}>
        ARMSTRONG <Text style={styles.brandAccent}>MAPS</Text>
      </Text>
    </View>
  );
}

function DocsLink() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href="/docs" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open the documentation"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}>
        {({ pressed }) => (
          <View style={[styles.chip, GLASS, EASE, (hovered || pressed) && styles.chipHover]}>
            <Text style={styles.chipText}>Docs</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function Headline({ size, wide, short }: { size: number; wide: boolean; short: boolean }) {
  const line = { fontSize: size, lineHeight: Math.round(size * 1.06) };
  return (
    <View
      pointerEvents="none"
      style={[styles.headline, wide ? styles.headlineWide : styles.headlineNarrow]}>
      <View accessibilityRole="header">
        <Text style={[styles.title, line]}>Mars,</Text>
        <Text style={[styles.title, styles.titleSoft, line]}>layer by layer.</Text>
      </View>
      {short ? null : (
        <Text style={[styles.lede, wide && styles.ledeWide]}>
          Pick a landing site to go down to the surface and plan a walk there.
        </Text>
      )}
    </View>
  );
}

/**
 * What a site is, beside the globe, while the pointer is on it. It takes no clicks: the site
 * itself is what is pressed.
 */
function SiteBrief({ site, shown }: { site: Site; shown: boolean }) {
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.brief, FADE, { opacity: shown ? 1 : 0 }]}>
      <Text style={styles.briefCaption}>Landing site</Text>
      <Text style={styles.briefName}>{site.name}</Text>
      <Text style={styles.briefMission}>{site.mission}</Text>
      <Text style={styles.briefScience}>{site.science}</Text>
      <View style={styles.briefFacts}>
        <Fact label="Base" value={site.landing.name} />
        <Fact label="Coordinates" value={formatLatLon(site.landing, 2)} mono />
        <Fact
          label="Close-up imagery"
          value={`${site.layers.length} ${site.layers.length === 1 ? 'mosaic' : 'mosaics'}`}
        />
      </View>
    </View>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, mono && styles.factMono]}>{value}</Text>
    </View>
  );
}

/** The landing sites as one rounded bar of glass: the accessible way in beside the globe. */
function SiteDock({
  picked,
  onPress,
  onHover,
  wide,
}: {
  picked: string | null;
  onPress: SitePress;
  onHover: (site: Site | null) => void;
  wide: boolean;
}) {
  const pills = SITES.map((site) => (
    <SitePill
      key={site.id}
      site={site}
      active={site.id === picked}
      onPress={(event) => onPress(site, event)}
      onHover={(over) => onHover(over ? site : null)}
    />
  ));
  return (
    <View
      style={[styles.dock, GLASS, !wide && styles.dockNarrow]}
      accessibilityRole="menu"
      accessibilityLabel="Landing sites">
      {wide ? (
        <View style={styles.dockRow}>{pills}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dockRow}>
          {pills}
        </ScrollView>
      )}
    </View>
  );
}

type SitePillProps = {
  site: Site;
  active: boolean;
  onPress: (event: Cancellable) => void;
  onHover: (over: boolean) => void;
};

function SitePill({ site, active, onPress, onHover }: SitePillProps) {
  const [hovered, setHoveredState] = useState(false);
  const setHovered = (over: boolean) => {
    setHoveredState(over);
    onHover(over);
  };
  return (
    <Link href={{ pathname: '/site/[id]', params: { id: site.id } }} onPress={onPress} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open the map of ${site.name}`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}>
        {({ pressed }) => (
          <View
            style={[
              styles.pill,
              EASE,
              (hovered || pressed) && styles.pillHover,
              active && styles.pillActive,
            ]}>
            <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
              {site.name}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/**
 * Where there is no globe (Android, iOS, and the page before the browser takes over): the same
 * sites as a plain list.
 */
function SiteList({ onPress }: { onPress: SitePress }) {
  return (
    <ScrollView contentContainerStyle={styles.list} style={styles.listScroll}>
      <View style={styles.listBar}>
        <Brand />
        <View style={styles.spacer} />
        <DocsLink />
      </View>

      <View style={styles.listHero}>
        <View accessibilityRole="header">
          <Text style={[styles.title, styles.listTitle]}>Mars,</Text>
          <Text style={[styles.title, styles.titleSoft, styles.listTitle]}>layer by layer.</Text>
        </View>
        <Text style={styles.lede}>{TAGLINE}</Text>
      </View>

      <View style={styles.rows}>
        {SITES.map((site) => (
          <SiteRow key={site.id} site={site} onPress={(event) => onPress(site, event)} />
        ))}
      </View>

      <Text style={styles.credit}>{CREDIT}</Text>
    </ScrollView>
  );
}

function SiteRow({ site, onPress }: { site: Site; onPress: (event: Cancellable) => void }) {
  return (
    <Link href={{ pathname: '/site/[id]', params: { id: site.id } }} onPress={onPress} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open the map of ${site.name}`}>
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.rowPressed]}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowName} numberOfLines={1}>
                {site.name}
              </Text>
              <Text style={styles.rowMission} numberOfLines={1}>
                {site.mission}
              </Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
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
  stage: {
    flex: 1,
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  spacer: {
    flex: 1,
  },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  brandAccent: {
    color: Colors.mars,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  chipHover: {
    backgroundColor: Colors.glassHover,
  },
  chipText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  headline: {
    position: 'absolute',
    gap: Spacing.three,
  },
  headlineWide: {
    left: Spacing.six - Spacing.three,
    top: 0,
    bottom: 0,
    maxWidth: 560,
    justifyContent: 'center',
  },
  headlineNarrow: {
    left: Spacing.four,
    right: Spacing.four,
    top: 72,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    letterSpacing: -1.2,
  },
  titleSoft: {
    color: Colors.textSoft,
  },
  lede: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  ledeWide: {
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 360,
  },

  brief: {
    position: 'absolute',
    right: Spacing.six - Spacing.three,
    top: 0,
    bottom: 0,
    width: 320,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  briefCaption: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  briefName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  briefMission: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  briefScience: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    paddingTop: Spacing.two,
  },
  briefFacts: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  factLabel: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  factValue: {
    flexShrink: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'right',
  },
  factMono: {
    fontFamily: Fonts.mono,
  },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  hint: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    textAlign: 'center',
  },
  dock: {
    maxWidth: '100%',
    padding: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  dockNarrow: {
    alignSelf: 'stretch',
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
  },
  pillHover: {
    backgroundColor: Colors.glassHover,
  },
  pillActive: {
    backgroundColor: Colors.text,
  },
  pillText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  pillTextActive: {
    color: Colors.background,
  },
  credit: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },

  listScroll: {
    flex: 1,
  },
  list: {
    gap: Spacing.five,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  listBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listHero: {
    gap: Spacing.three,
  },
  listTitle: {
    fontSize: 40,
    lineHeight: 43,
  },
  rows: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingVertical: Spacing.two + Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  rowPressed: {
    backgroundColor: Colors.glassHover,
  },
  rowCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  rowName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  rowMission: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  rowChevron: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 22,
  },
});
