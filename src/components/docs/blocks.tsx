import { Link, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/** One block of a docs page. */
export function BlockView({ block, onOpen, wide }: BlockViewProps) {
  switch (block.kind) {
    case 'text':
      return <Text style={styles.text}>{block.text}</Text>;

    case 'steps':
      return (
        <View style={styles.steps}>
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
            const body = (state: { pressed: boolean; hovered?: boolean }) => (
              <View
                style={[
                  styles.card,
                  wide && styles.cardHalf,
                  item.page && state.hovered ? styles.cardHovered : null,
                  item.page && state.pressed ? styles.cardPressed : null,
                ]}>
                <IconTile
                  name={item.icon}
                  color={item.nasa ? Colors.nasa : Colors.nav}
                  background={item.nasa ? Colors.nasaTint : Colors.navTint}
                />
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
                {(state) => body(state as { pressed: boolean; hovered?: boolean })}
              </Pressable>
            ) : (
              <View key={item.title} style={wide ? styles.cardSlotHalf : styles.cardSlot}>
                {body({ pressed: false })}
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
              <View style={styles.flowBox}>
                <Text style={styles.flowText}>{item}</Text>
              </View>
              {index < block.items.length - 1 ? (
                <Icon name="chevron" size={16} color={Colors.textMuted} />
              ) : null}
            </Fragment>
          ))}
        </View>
      );

    case 'callout': {
      const color =
        block.tone === 'warning' ? Colors.caution : block.tone === 'nasa' ? Colors.nasa : Colors.nav;
      return (
        <View style={[styles.callout, { borderLeftColor: color }]}>
          <Text style={[styles.calloutTitle, { color }]}>{block.title}</Text>
          <Text style={styles.calloutText}>{block.text}</Text>
        </View>
      );
    }

    case 'code':
      return (
        <View style={styles.code}>
          <View style={styles.codeBar}>
            <Text style={styles.codeLabel}>{block.label}</Text>
          </View>
          <Text style={styles.codeText} selectable>
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
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>
      );

    case 'link':
      return (
        <Link
          href={block.url as Href}
          target="_blank"
          rel="noopener noreferrer"
          accessibilityRole="link"
          style={styles.link}>
          {block.label} {'↗'}
        </Link>
      );
  }
}

const styles = StyleSheet.create({
  text: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 25,
  },
  steps: {
    gap: 0,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  stepNumberText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    width: 1,
    minHeight: 12,
    backgroundColor: Colors.border,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.one,
  },
  stepTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  stepText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.one - Spacing.half,
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
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardHalf: {
    flexGrow: 1,
    minHeight: 150,
  },
  cardHovered: {
    borderColor: Colors.nav,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  cardText: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  flowBox: {
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  flowText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  callout: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    backgroundColor: Colors.surface,
  },
  calloutTitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  calloutText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  code: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  codeBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  codeLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  codeText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 20,
    padding: Spacing.three,
  },
  table: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: Spacing.half,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowLabel: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLabelWide: {
    width: 170,
  },
  rowValue: {
    flex: 1,
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  link: {
    alignSelf: 'flex-start',
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
    minHeight: 44,
  },
});
