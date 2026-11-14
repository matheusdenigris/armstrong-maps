import { Link, router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockView } from '@/components/docs/blocks';
import { Icon, IconTile } from '@/components/docs/icon';
import { Logo } from '@/components/logo';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  DOC_PAGES,
  DOC_TABS,
  docGroups,
  findDocPage,
  type DocPage,
} from '@/data/docs-pages';

const DESCRIPTION =
  'How Armstrong Maps works: every NASA API and data source it reads, what it takes from each, and what is measured, assumed or simulated.';

/** From this width the navigation sits beside the page instead of behind a menu button. */
const SIDEBAR_FROM = 960;
/** From this width the page also shows its own table of contents on the right. */
const CONTENTS_FROM = 1240;
const SIDEBAR_WIDTH = 272;
const CONTENTS_WIDTH = 220;

/**
 * Scroll bars on the web in the style of the landing page: a Mars-coloured thumb on a clear track,
 * slimmer here because the docs have two scrolling columns. The thumb sits inside a margin so it
 * never touches the edge, and brightens while the pointer is over it. Phones draw their own.
 */
const SCROLLBAR_CSS = `
  /* Firefox only: in Chrome these two properties would replace the shaped thumb below. */
  @supports (-moz-appearance: none) {
    #docs-main, #docs-nav {
      scrollbar-width: thin;
      scrollbar-color: ${Colors.mars} transparent;
    }
  }
  #docs-main::-webkit-scrollbar, #docs-nav::-webkit-scrollbar {
    width: 10px;
    background: transparent;
  }
  #docs-main::-webkit-scrollbar-track, #docs-nav::-webkit-scrollbar-track {
    background: transparent;
    margin: 6px 0;
  }
  #docs-main::-webkit-scrollbar-thumb, #docs-nav::-webkit-scrollbar-thumb {
    background: ${Colors.mars};
    border: 3px solid ${Colors.background};
    border-radius: ${Radius.large}px;
    min-height: 48px;
  }
  #docs-main::-webkit-scrollbar-thumb:hover, #docs-nav::-webkit-scrollbar-thumb:hover {
    background: ${Colors.marsLight};
    border-width: 2px;
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

/** The docs, laid out like a documentation site: tabs, a grouped navigation and the page. */
export default function DocsScreen() {
  const { page: pageId } = useLocalSearchParams<{ page?: string }>();
  const page = findDocPage(pageId);
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const withSidebar = hydrated && width >= SIDEBAR_FROM;
  const withContents = hydrated && width >= CONTENTS_FROM;

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionTops = useRef<Record<string, number>>({});

  const open = (id: string) => {
    setMenuOpen(false);
    router.setParams({ page: id });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  // Previous and next in reading order, within the tab.
  const { previous, next } = useMemo(() => {
    const inTab = DOC_PAGES.filter((item) => item.tab === page.tab);
    const index = inTab.indexOf(page);
    return { previous: inTab[index - 1], next: inTab[index + 1] };
  }, [page]);

  const navigation = (
    <Navigation
      current={page}
      query={query}
      onQuery={setQuery}
      onOpen={open}
    />
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Head>
        <title>{`${page.title} | Armstrong Maps docs`}</title>
        <meta name="description" content={DESCRIPTION} />
        <style>{SCROLLBAR_CSS}</style>
      </Head>

      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          {!withSidebar ? (
            <Pressable
              onPress={() => setMenuOpen((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? 'Close the menu' : 'Open the menu'}
              style={styles.iconButton}>
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} color={Colors.text} />
            </Pressable>
          ) : null}
          <Link href="/" accessibilityRole="link" accessibilityLabel="Armstrong Maps, back to the sites">
            <View style={styles.brand}>
              <Logo size={26} />
              <Text style={styles.brandName}>ARMSTRONG MAPS</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DOCS</Text>
              </View>
            </View>
          </Link>
        </View>
        <Link
          href="/"
          style={styles.openMap}
          accessibilityRole="link"
          accessibilityLabel="Open the map">
          {withSidebar ? 'Open the map' : 'Map'}
        </Link>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {DOC_TABS.map((tab) => {
          const selected = page.tab === tab.id;
          const first = DOC_PAGES.find((item) => item.tab === tab.id)!;
          return (
            <Pressable
              key={tab.id}
              onPress={() => open(first.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected && styles.tabSelected]}>
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {withSidebar ? <View style={styles.sidebar}>{navigation}</View> : null}

        <ScrollView
          ref={scroll}
          nativeID="docs-main"
          style={styles.main}
          contentContainerStyle={styles.mainContent}>
          {!withSidebar ? (
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbText}>{page.group}</Text>
              <Icon name="chevron" size={14} color={Colors.textMuted} />
              <Text style={[styles.breadcrumbText, styles.breadcrumbCurrent]} numberOfLines={1}>
                {page.title}
              </Text>
            </View>
          ) : null}

          <View style={styles.article}>
            <View style={styles.header}>
              <Text style={[styles.eyebrow, { color: page.nasa ? Colors.nasa : Colors.nav }]}>
                {page.nasa ? 'NASA source' : page.group}
              </Text>
              <Text style={styles.title} accessibilityRole="header">
                {page.title}
              </Text>
              <Text style={styles.lead}>{page.lead}</Text>
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
                  <BlockView key={index} block={block} onOpen={open} wide={hydrated && width >= 640} />
                ))}
              </View>
            ))}

            <View style={styles.pager}>
              {previous ? (
                <PagerLink label="Previous" page={previous} onOpen={open} />
              ) : (
                <View style={styles.pagerSpacer} />
              )}
              {next ? <PagerLink label="Next" page={next} onOpen={open} alignEnd /> : null}
            </View>

            <Text style={styles.footer}>
              Armstrong Maps is a NASA Space Apps Challenge 2026 project with no official link to
              NASA. The data belongs to its sources.
            </Text>
          </View>
        </ScrollView>

        {withContents ? (
          <View style={styles.contents}>
            <Text style={styles.contentsTitle}>On this page</Text>
            {page.sections.map((section) => (
              <Pressable
                key={section.id}
                onPress={() =>
                  scroll.current?.scrollTo({ y: sectionTops.current[section.id] ?? 0, animated: true })
                }
                accessibilityRole="link"
                style={styles.contentsItem}>
                <Text style={styles.contentsText}>{section.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!withSidebar && menuOpen ? <View style={styles.menuSheet}>{navigation}</View> : null}
      </View>
    </SafeAreaView>
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
  const search = query.trim().toLowerCase();
  const groups = search
    ? [
        {
          group: 'Results',
          pages: DOC_PAGES.filter((page) =>
            `${page.title} ${page.lead} ${page.group}`.toLowerCase().includes(search),
          ),
        },
      ]
    : docGroups(current.tab);

  return (
    <ScrollView nativeID="docs-nav" contentContainerStyle={styles.navContent}>
      <View style={styles.searchBox}>
        <Icon name="search" size={16} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search the docs"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Search the docs"
        />
      </View>
      {groups.map(({ group, pages }) => (
        <View key={group} style={styles.navGroup}>
          <Text style={styles.navGroupTitle}>{group}</Text>
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
                  (state as { hovered?: boolean }).hovered && styles.navItemHovered,
                  selected && (page.nasa ? styles.navItemNasa : styles.navItemSelected),
                ]}>
                <Icon
                  name={page.icon}
                  size={16}
                  color={selected ? (page.nasa ? Colors.nasa : Colors.nav) : Colors.textMuted}
                />
                <Text
                  style={[styles.navText, selected && styles.navTextSelected]}
                  numberOfLines={1}>
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

type PagerLinkProps = { label: string; page: DocPage; onOpen: (id: string) => void; alignEnd?: boolean };

function PagerLink({ label, page, onOpen, alignEnd }: PagerLinkProps) {
  return (
    <Pressable
      onPress={() => onOpen(page.id)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${page.title}`}
      style={(state) => [
        styles.pagerLink,
        alignEnd && styles.pagerEnd,
        (state as { hovered?: boolean }).hovered && styles.pagerHovered,
      ]}>
      <Text style={[styles.pagerLabel, alignEnd && styles.alignRight]}>{label}</Text>
      <View style={[styles.pagerRow, alignEnd && styles.pagerRowEnd]}>
        {!alignEnd ? <IconTile name={page.icon} color={Colors.nav} background={Colors.navTint} /> : null}
        <Text style={[styles.pagerTitle, alignEnd && styles.alignRight]} numberOfLines={2}>
          {page.title}
        </Text>
        {alignEnd ? <IconTile name={page.icon} color={Colors.nav} background={Colors.navTint} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandName: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  badge: {
    paddingHorizontal: Spacing.two - Spacing.half,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
    backgroundColor: Colors.navTint,
  },
  badgeText: {
    color: Colors.nav,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  openMap: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: Colors.text,
  },
  tabText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextSelected: {
    color: Colors.text,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  navContent: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two + Spacing.one,
    minHeight: 40,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    paddingVertical: Spacing.two,
  },
  navGroup: {
    gap: Spacing.half,
  },
  navGroupTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  navEmpty: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    paddingHorizontal: Spacing.two,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
  },
  navItemHovered: {
    backgroundColor: Colors.surface,
  },
  navItemSelected: {
    backgroundColor: Colors.navTint,
  },
  navItemNasa: {
    backgroundColor: Colors.nasaTint,
  },
  navText: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  navTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  breadcrumbText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  breadcrumbCurrent: {
    flexShrink: 1,
    color: Colors.text,
    fontWeight: '600',
  },
  article: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: Spacing.five,
    paddingTop: Spacing.five,
  },
  header: {
    gap: Spacing.two,
  },
  eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
  },
  lead: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 27,
  },
  section: {
    gap: Spacing.three,
  },
  h2: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
  },
  pager: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pagerSpacer: {
    flex: 1,
  },
  pagerLink: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pagerEnd: {
    alignItems: 'flex-end',
  },
  pagerHovered: {
    borderColor: Colors.nav,
  },
  pagerLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pagerRowEnd: {
    justifyContent: 'flex-end',
  },
  pagerTitle: {
    flexShrink: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  alignRight: {
    textAlign: 'right',
  },
  footer: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  contents: {
    width: CONTENTS_WIDTH,
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  contentsTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: Spacing.two,
  },
  contentsItem: {
    paddingVertical: Spacing.one + Spacing.half,
  },
  contentsText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  menuSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
  },
});
