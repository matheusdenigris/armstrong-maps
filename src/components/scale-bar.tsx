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
      <View style={[styles.bar, { width: length / metresPerPixel }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  bar: {
    height: 6,
    borderColor: Colors.text,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  label: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
});
