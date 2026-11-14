import { Link, router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentRef,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockView } from '@/components/docs/blocks';
import { Icon } from '@/components/docs/icon';
import { Logo } from '@/components/logo';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  DOC_PAGES,
  DOC_TABS,
  docGroups,
  findDocPage,
  searchDocs,
  type DocPage,
} from '@/data/docs-pages';

const DESCRIPTION =
  'How Armstrong Maps works: every NASA API and data source it reads, what it takes from each, and what is measured, assumed or simulated.';

/** From this width the navigation sits beside the page instead of behind a menu button. */
const SIDEBAR_FROM = 960;
/** From this width the page also shows its own table of contents on the right. */
const CONTENTS_FROM = 1240;
/** From this width the title of a page takes its large size and cards go two a row. */
const ROOMY_FROM = 640;
const SIDEBAR_WIDTH = 272;
const CONTENTS_WIDTH = 232;
/** How far under the top of the view a section counts as the one being read. */
const READING_LINE = 96;

/** Styles only a browser understands: blur behind glass, gradients, transitions. */
const web = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);
const GLASS = web({
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
});
const EASE = web({ transition: 'background-color 160ms ease' });
/** The light of the planet, just off the top of the screen. */
const GLOW = web({
  backgroundImage: `radial-gradient(ellipse 60% 46% at 78% -12%, ${Colors.marsGlow}, transparent 72%)`,
});
const NO_OUTLINE = web({ outlineStyle: 'none' }) as TextStyle | null;
/** The same curve and the same two movements as the ship console. */
const CURVE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const RISE = web({ animation: `armstrong-rise 260ms ${CURVE} both` });
const SHEET_IN = web({ animation: `armstrong-sheet 300ms ${CURVE} both` });

/**
 * What the browser needs beside the styles: the two movements, and a slim scroll bar for the page
 * that stays out of the way until the pointer is on it. Phones draw their own.
 */
const PAGE_CSS = `
  @keyframes armstrong-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes armstrong-sheet { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: none; } }
  /* Firefox only: in Chrome these two properties would replace the shaped thumb below. */
  @supports (-moz-appearance: none) {
    #docs-main {
      scrollbar-width: thin;
      scrollbar-color: ${Colors.glassBorder} transparent;
    }
  }
  #docs-main::-webkit-scrollbar {
    width: 12px;
    background: transparent;
  }
  #docs-main::-webkit-scrollbar-track {
    background: transparent;
    margin: 8px 0;
  }
  #docs-main::-webkit-scrollbar-thumb {
    background: ${Colors.glassBorder};
    background-clip: padding-box;
    border: 4px solid transparent;
    border-radius: ${Radius.pill}px;
    min-height: 48px;
  }
  #docs-main::-webkit-scrollbar-thumb:hover {
    background: ${Colors.textFaint};
    background-clip: padding-box;
  }
`;

/** False on the page rendered ahead of time, which does not know the size of the window. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** True when the person has asked the system for less movement: then nothing here animates. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduced(on));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

type Hoverable = { pressed: boolean; hovered?: boolean };
const over = (state: { pressed: boolean }) => (state as Hoverable).hovered || state.pressed;

/** The docs: the two subjects as one control, a pane of pages, and the page itself. */
export default function DocsScreen() {
  const { page: pageId } = useLocalSearchParams<{ page?: string }>();
  const page = findDocPage(pageId);
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const calm = useReducedMotion();
  const withSidebar = hydrated && width >= SIDEBAR_FROM;
  const withContents = hydrated && width >= CONTENTS_FROM;
  const roomy = hydrated && width >= ROOMY_FROM;

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const articleTop = useRef(0);
  const sectionTops = useRef<Record<string, number>>({});

  const open = (id: string) => {
    setMenuOpen(false);
    setReading(null);
    router.setParams({ page: id });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  // Previous and next in reading order, within the tab.
  const { previous, next } = useMemo(() => {
    const inTab = DOC_PAGES.filter((item) => item.tab === page.tab);
    const index = inTab.indexOf(page);
    return { previous: inTab[index - 1], next: inTab[index + 1] };
  }, [page]);

  const topOf = (sectionId: string) => articleTop.current + (sectionTops.current[sectionId] ?? 0);

  /** The last section whose title has passed the reading line is the one being read. */
  const follow = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const line = event.nativeEvent.contentOffset.y + READING_LINE;
    let current: string | null = null;
    for (const section of page.sections) {
      if (section.id in sectionTops.current && topOf(section.id) <= line) current = section.id;
    }
    setReading(current);
  };
  const read = page.sections.some((section) => section.id === reading)
    ? reading
    : page.sections[0]?.id;

  const navigation = <Navigation current={page} query={query} onQuery={setQuery} onOpen={open} />;
  const tabs = <Tabs current={page} onOpen={open} stretch={!withSidebar} />;

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>{`${page.title} | Armstrong Maps docs`}</title>
        <meta name="description" content={DESCRIPTION} />
        <style>{PAGE_CSS}</style>
      </Head>

      <View pointerEvents="none" style={[styles.fill, GLOW]} />

      <View style={[styles.bar, !withSidebar && styles.barTight]}>
        <View style={[styles.barSide, !withSidebar && styles.barTight]}>
          {!withSidebar ? (
            <Pressable
              onPress={() => setMenuOpen((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? 'Close the list of pages' : 'Open the list of pages'}
              accessibilityState={{ expanded: menuOpen }}
              style={(state) => [styles.roundButton, GLASS, EASE, over(state) && styles.glassOver]}>
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} color={Colors.text} />
            </Pressable>
          ) : null}
          <Link href="/" accessibilityRole="link" accessibilityLabel="Armstrong Maps, back to the globe">
            <View style={styles.brand}>
              <Logo size={withSidebar ? 28 : 24} />
              <Text style={[styles.brandName, !withSidebar && styles.brandNameTight]} numberOfLines={1}>
                ARMSTRONG <Text style={styles.brandAccent}>MAPS</Text>
              </Text>
              {withSidebar ? <Text style={styles.brandPlace}>Docs</Text> : null}
            </View>
          </Link>
        </View>

        {withSidebar ? tabs : null}

        <View style={[styles.barSide, styles.barEnd, !withSidebar && styles.barEndTight]}>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Open the map">
              {(state) => (
                <View style={[styles.chip, GLASS, EASE, over(state) && styles.glassOver]}>
                  <Text style={styles.chipText}>{withSidebar ? 'Open the map' : 'Map'}</Text>
                </View>
              )}
            </Pressable>
          </Link>
        </View>
      </View>

      {!withSidebar ? <View style={styles.tabsRow}>{tabs}</View> : null}

      <View style={styles.body}>
        {withSidebar ? <View style={[styles.sidebar, GLASS]}>{navigation}</View> : null}

        <ScrollView
          ref={scroll}
          nativeID="docs-main"
          style={styles.main}
          contentContainerStyle={[styles.mainContent, withContents && styles.mainBesideContents]}
          onScroll={withContents ? follow : undefined}
          scrollEventThrottle={64}>
          {/* A new page rises into place, like the content of a tab in the console. */}
          <View
            key={page.id}
            style={[styles.article, calm ? null : RISE]}
            onLayout={(event) => {
              articleTop.current = event.nativeEvent.layout.y;
            }}>
            <View style={styles.header}>
              <View style={styles.eyebrow}>
                {page.nasa ? <View style={styles.eyebrowDot} /> : null}
                <Text style={styles.eyebrowText}>{page.nasa ? 'NASA source' : page.group}</Text>
              </View>
              <Text style={[styles.title, roomy && styles.titleRoomy]} accessibilityRole="header">
                {page.title}
              </Text>
              <Text style={[styles.lead, roomy && styles.leadRoomy]}>{page.lead}</Text>
            </View>

            {page.sections.map((section) => (
              <View
                key={section.id}
                style={styles.section}
                onLayout={(event) => {
                  sectionTops.current[section.id] = event.nativeEvent.layout.y;
                }}>
                <Text style={styles.h2} accessibilityRole="header">
                  {section.title}
                </Text>
                {section.blocks.map((block, index) => (
                  <BlockView key={index} block={block} onOpen={open} wide={roomy} />
                ))}
              </View>
            ))}

            <View style={styles.pager}>
              {previous ? (
                <PagerLink label="Previous" page={previous} onOpen={open} />
              ) : (
                <View style={styles.pagerSpacer} />
              )}
              {next ? (
                <PagerLink label="Next" page={next} onOpen={open} forward />
              ) : (
                <View style={styles.pagerSpacer} />
              )}
            </View>

            <Text style={styles.footer}>
              Armstrong Maps is a NASA Space Apps Challenge 2026 project with no official link to
              NASA. The data belongs to its sources.
            </Text>
          </View>
        </ScrollView>

        {withContents ? (
          <View style={styles.contents}>
            <Text style={styles.caption}>On this page</Text>
            {page.sections.map((section) => {
              const current = section.id === read;
              return (
                <Pressable
                  key={section.id}
                  onPress={() =>
                    scroll.current?.scrollTo({
                      y: Math.max(0, topOf(section.id) - Spacing.four),
                      animated: !calm,
                    })
                  }
                  accessibilityRole="link"
                  accessibilityState={{ selected: current }}
                  style={(state) => [
                    styles.contentsItem,
                    EASE,
                    current && styles.contentsItemCurrent,
                    over(state) && styles.glassOver,
                  ]}>
                  <Text
                    style={[styles.contentsText, current && styles.contentsTextCurrent]}
                    numberOfLines={2}>
                    {section.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!withSidebar && menuOpen ? (
          <View style={[styles.menuSheet, GLASS, calm ? null : SHEET_IN]}>{navigation}</View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type TabsProps = {
  current: DocPage;
  onOpen: (id: string) => void;
  /** On a phone the control fills the width and its halves are tall enough for a thumb. */
  stretch: boolean;
};

/** The two subjects of the docs, as one rounded control. */
function Tabs({ current, onOpen, stretch }: TabsProps) {
  return (
    <View style={[styles.tabs, GLASS, stretch && styles.tabsStretch]} accessibilityRole="tablist">
      {DOC_TABS.map((tab) => {
        const selected = current.tab === tab.id;
        const first = DOC_PAGES.find((item) => item.tab === tab.id)!;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onOpen(first.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={(state) => [
              styles.tab,
              EASE,
              stretch && styles.tabStretch,
              !selected && over(state) && styles.glassOver,
              selected && styles.chosen,
            ]}>
            <Text style={[styles.tabText, selected && styles.chosenText]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type NavigationProps = {
  current: DocPage;
  query: string;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
};

/** The pages of the current tab by group, or every page that matches the search. */
function Navigation({ current, query, onQuery, onOpen }: NavigationProps) {
  const [searching, setSearching] = useState(false);
  // A search looks through everything the pages say, in both tabs.
  const groups = query.trim()
    ? [{ group: 'Results', pages: searchDocs(query) }]
    : docGroups(current.tab);

  return (
    <ScrollView contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.searchBox, EASE, searching && styles.glassOver]}>
        <Icon name="search" size={16} color={Colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          onFocus={() => setSearching(true)}
          onBlur={() => setSearching(false)}
          placeholder="Search the docs"
          placeholderTextColor={Colors.textFaint}
          style={[styles.searchInput, NO_OUTLINE]}
          accessibilityLabel="Search the docs"
        />
      </View>
      {groups.map(({ group, pages }) => (
        <View key={group} style={styles.navGroup}>
          <Text style={[styles.caption, styles.navGroupTitle]}>{group}</Text>
          {pages.length === 0 ? <Text style={styles.navEmpty}>No page matches.</Text> : null}
          {pages.map((page) => {
            const selected = page.id === current.id;
            return (
              <Pressable
                key={page.id}
                onPress={() => onOpen(page.id)}
                accessibilityRole="link"
                accessibilityState={{ selected }}
                style={(state) => [
                  styles.navItem,
                  EASE,
                  !selected && over(state) && styles.glassOver,
                  selected && styles.chosen,
                ]}>
                <Icon
                  name={page.icon}
                  size={16}
                  color={selected ? Colors.background : Colors.textFaint}
                />
                <Text style={[styles.navText, selected && styles.chosenText]} numberOfLines={1}>
                  {page.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

type PagerLinkProps = {
  label: string;
  page: DocPage;
  onOpen: (id: string) => void;
  /** The next page: its arrow points on, and it sits at the right. */
  forward?: boolean;
};

function PagerLink({ label, page, onOpen, forward }: PagerLinkProps) {
  const arrow = (
    <View style={forward ? null : styles.turned}>
      <Icon name="chevron" size={18} color={Colors.textFaint} />
    </View>
  );
  return (
    <Pressable
      onPress={() => onOpen(page.id)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${page.title}`}
      style={(state) => [styles.pagerLink, EASE, over(state) && styles.glassOver]}>
      {forward ? null : arrow}
      <View style={styles.pagerCopy}>
        <Text style={[styles.pagerLabel, forward && styles.alignRight]}>{label}</Text>
        <Text style={[styles.pagerTitle, forward && styles.alignRight]} numberOfLines={2}>
          {page.title}
        </Text>
      </View>
      {forward ? arrow : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  barSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  /** On a phone the bar holds a button, the name and a chip in 375 points. */
  barTight: {
    gap: Spacing.two,
  },
  barEnd: {
    justifyContent: 'flex-end',
  },
  /** On a phone the name of the app gets the room. */
  barEndTight: {
    flexGrow: 0,
    flexBasis: 'auto',
  },
  roundButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  glassOver: {
    backgroundColor: Colors.glassHover,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    minHeight: 44,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  brandNameTight: {
    fontSize: 11,
    letterSpacing: 1,
  },
  brandAccent: {
    color: Colors.mars,
  },
  brandPlace: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 14,
    paddingLeft: Spacing.one,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  chipText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  tabs: {
    flexDirection: 'row',
    gap: Spacing.half,
    padding: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  tabsStretch: {
    alignSelf: 'stretch',
  },
  tabsRow: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two + Spacing.one,
  },
  tab: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.one,
    borderRadius: Radius.pill,
  },
  tabStretch: {
    flex: 1,
    minHeight: 44,
  },
  tabText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  /** A chosen option, wherever it is: the light pill with dark text. */
  chosen: {
    backgroundColor: Colors.text,
  },
  chosenText: {
    color: Colors.background,
  },

  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    marginLeft: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radius.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  navContent: {
    padding: Spacing.two + Spacing.one,
    gap: Spacing.four,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    paddingVertical: Spacing.two,
  },
  caption: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  navGroup: {
    gap: Spacing.half,
  },
  navGroupTitle: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one + Spacing.half,
  },
  navEmpty: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  navText: {
    flex: 1,
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  main: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  /** The contents float over the right of the page, so the scroll bar stays at the edge. */
  mainBesideContents: {
    paddingRight: CONTENTS_WIDTH + Spacing.four,
  },
  article: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: Spacing.five + Spacing.three,
    paddingTop: Spacing.four,
  },
  header: {
    gap: Spacing.three,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.nasa,
  },
  eyebrowText: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.9,
  },
  titleRoomy: {
    fontSize: 48,
    lineHeight: 51,
    letterSpacing: -1.4,
  },
  lead: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  leadRoomy: {
    fontSize: 18,
    lineHeight: 27,
    maxWidth: 600,
  },
  section: {
    gap: Spacing.three,
  },
  h2: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },

  pager: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
  },
  pagerSpacer: {
    flex: 1,
  },
  pagerLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 76,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  pagerCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  pagerLabel: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  pagerTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  turned: {
    transform: [{ rotate: '180deg' }],
  },
  alignRight: {
    textAlign: 'right',
  },
  footer: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },

  contents: {
    position: 'absolute',
    top: Spacing.four + Spacing.one,
    right: Spacing.four,
    width: CONTENTS_WIDTH - Spacing.four,
    gap: Spacing.half,
  },
  contentsItem: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    marginLeft: -(Spacing.two + Spacing.one),
    borderRadius: Radius.medium,
  },
  contentsItemCurrent: {
    backgroundColor: Colors.glassLight,
  },
  contentsText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  contentsTextCurrent: {
    color: Colors.text,
  },

  menuSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: Colors.glassStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glassBorder,
    borderTopLeftRadius: Radius.pane,
    borderTopRightRadius: Radius.pane,
  },
});
