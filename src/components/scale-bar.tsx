import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatDistance, roundLength } from '@/mission/format';
import { METRES_PER_DEGREE } from '@/mission/geo';

type ScaleBarProps = {
  pixelsPerDegree: number;
  /** The bar is the longest round length that fits in this width. */
  maxWidth?: number;
};

/** A scale bar measured on Mars: a degree here is 59.16 km, not the 111 km it is on Earth. */
export function ScaleBar({ pixelsPerDegree, maxWidth = 96 }: ScaleBarProps) {
  const metresPerPixel = METRES_PER_DEGREE / pixelsPerDegree;
  const length = roundLength(maxWidth * metresPerPixel);
  if (length === 0) return null;
  const label = formatDistance(length);
  return (
    <View accessible accessibilityLabel={`Scale: this bar is ${label}`} style={styles.wrap}>
      <Text style={styles.label}>
        <Text style={styles.caption}>Scale · </Text>
        {label}
      </Text>
      <View style={[styles.bar, { width: length / metresPerPixel }]}>
        <View style={styles.leftTick} />
        <View style={styles.rightTick} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  caption: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  bar: {
    position: 'relative',
    height: 8,
    borderColor: Colors.text,
    borderTopWidth: 2,
  },
  leftTick: {
    position: 'absolute',
    left: -2,
    top: -2,
    height: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.text,
  },
  rightTick: {
    position: 'absolute',
    right: -2,
    top: -2,
    height: 8,
    borderRightWidth: 2,
    borderRightColor: Colors.text,
  },
  label: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
