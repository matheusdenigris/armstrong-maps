import { Link, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Block } from '@/data/docs-pages';

import { Icon, IconTile } from './icon';

type BlockViewProps = {
  block: Block;
  /** Opens another page of the docs. */
  onOpen: (pageId: string) => void;
  /** Two cards a row from this width of the content column. */
  wide: boolean;
};

/** Styles only a browser understands. */
const web = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);
const EASE = web({ transition: 'background-color 160ms ease' });
/** An address has no spaces to break at: let it break anywhere before it leaves the card. */
const BREAK_ANYWHERE = web({ overflowWrap: 'anywhere' }) as TextStyle | null;

type Hoverable = { pressed: boolean; hovered?: boolean };
const over = (state: { pressed: boolean }) => (state as Hoverable).hovered || state.pressed;

/** A link that leaves the app opens in a new tab; `asChild` does not pass this on by itself. */
const NEW_TAB =
  Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : null;

const TONES = { note: Colors.nav, warning: Colors.caution, nasa: Colors.nasa } as const;

/** One block of a docs page. */
export function BlockView({ block, onOpen, wide }: BlockViewProps) {
  switch (block.kind) {
    case 'text':
      return <Text style={styles.text}>{block.text}</Text>;

    case 'steps':
      return (
        <View>
          {block.items.map((item, index) => (
            <View key={item.title} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                {index < block.items.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      );

    case 'cards':
      return (
        <View style={styles.cards}>
          {block.items.map((item) => {
            const body = (lit: boolean) => (
              <View style={[styles.card, EASE, wide && styles.cardHalf, lit && styles.cardOver]}>
                <View style={styles.cardTop}>
                  <IconTile
                    name={item.icon}
                    color={item.nasa ? Colors.nasa : Colors.text}
                    background={item.nasa ? Colors.nasaTint : Colors.glassHover}
                  />
                  {item.page ? <Icon name="chevron" size={16} color={Colors.textFaint} /> : null}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardText} numberOfLines={4}>
                  {item.text}
                </Text>
              </View>
            );
            return item.page ? (
              <Pressable
                key={item.title}
                onPress={() => onOpen(item.page!)}
                accessibilityRole="link"
                accessibilityLabel={`${item.title}. ${item.text}`}
                style={wide ? styles.cardSlotHalf : styles.cardSlot}>
                {(state) => body(Boolean(over(state)))}
              </Pressable>
            ) : (
              <View key={item.title} style={wide ? styles.cardSlotHalf : styles.cardSlot}>
                {body(false)}
              </View>
            );
          })}
        </View>
      );

    case 'flow':
      return (
        <View style={styles.flow} accessible accessibilityLabel={block.items.join(', then ')}>
          {block.items.map((item, index) => (
            <Fragment key={item}>
              <View style={styles.flowStop}>
                <Text style={styles.flowText}>{item}</Text>
              </View>
              {index < block.items.length - 1 ? (
                <Icon name="chevron" size={14} color={Colors.textFaint} />
              ) : null}
            </Fragment>
          ))}
        </View>
      );

    case 'callout':
      return (
        <View style={[styles.callout, block.tone === 'warning' && styles.calloutWarning]}>
          <View style={styles.calloutHead}>
            <View style={[styles.calloutDot, { backgroundColor: TONES[block.tone] }]} />
            <Text style={styles.calloutTitle}>{block.title}</Text>
          </View>
          <Text style={styles.calloutText}>{block.text}</Text>
        </View>
      );

    case 'code':
      return (
        <View style={styles.code}>
          <Text style={styles.codeLabel}>{block.label}</Text>
          <Text style={[styles.codeText, BREAK_ANYWHERE]} selectable>
            {block.text}
          </Text>
        </View>
      );

    case 'table':
      return (
        <View style={styles.table}>
          {block.rows.map(([label, value], index) => (
            <View
              key={`${label}-${index}`}
              style={[styles.row, index > 0 && styles.rowDivider, !wide && styles.rowStacked]}>
              <Text style={[styles.rowLabel, wide && styles.rowLabelWide]}>{label}</Text>
              <Text style={[styles.rowValue, wide && styles.rowValueWide, BREAK_ANYWHERE]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      );

    case 'link':
      return (
        <Link href={block.url as Href} asChild>
          <Pressable accessibilityRole="link" style={styles.linkSlot} {...NEW_TAB}>
            {(state) => (
              <View style={[styles.link, EASE, over(state) && styles.cardOver]}>
                <Text style={styles.linkText}>{block.label}</Text>
                <Icon name="external" size={14} color={Colors.textSoft} />
              </View>
            )}
          </Pressable>
        </Link>
      );
  }
}

const styles = StyleSheet.create({
  text: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 26,
  },

  step: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stepRail: {
    alignItems: 'center',
    width: 28,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassHover,
  },
  stepNumberText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  stepLine: {
    flex: 1,
    width: StyleSheet.hairlineWidth,
    minHeight: 12,
    marginVertical: Spacing.one,
    backgroundColor: Colors.glassBorder,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
    paddingBottom: Spacing.three + Spacing.one,
    paddingTop: Spacing.one,
  },
  stepTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
  },
  stepText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },

  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -(Spacing.one + Spacing.half),
  },
  cardSlot: {
    width: '100%',
    padding: Spacing.one + Spacing.half,
  },
  cardSlotHalf: {
    width: '50%',
    padding: Spacing.one + Spacing.half,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  cardHalf: {
    flexGrow: 1,
    minHeight: 164,
  },
  cardOver: {
    backgroundColor: Colors.glassHover,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  cardText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },

  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flowStop: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  flowText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },

  callout: {
    gap: Spacing.one + Spacing.half,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  calloutWarning: {
    backgroundColor: Colors.cautionTint,
  },
  calloutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  calloutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calloutTitle: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  calloutText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },

  code: {
    gap: Spacing.two,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  codeLabel: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  codeText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 20,
  },

  table: {
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingVertical: Spacing.two + Spacing.one,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: Spacing.half,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.glassBorder,
  },
  rowLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  rowLabelWide: {
    width: 170,
  },
  rowValue: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  rowValueWide: {
    flex: 1,
  },

  linkSlot: {
    alignSelf: 'flex-start',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
  linkText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
