import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * The Armstrong Maps symbol: the disc of Mars with a compass needle cut out of it. The needle is
 * a stencil A (an apex and two legs) pointing north. The cut-outs are holes, so the background
 * shows through them.
 *
 * The same drawing lives in `assets/brand/symbol.svg` and in the app icons under `assets/images`;
 * change them together.
 */
const SYMBOL =
  'M16 128a112 112 0 1 0 224 0a112 112 0 1 0 -224 0z' +
  'M128 44L161.38 128L94.62 128z' +
  'M167.74 144L190 200L137.74 144z' +
  'M88.26 144L118.26 144L66 200z';

type LogoProps = {
  /** Width and height, in points. */
  size?: number;
  color?: string;
};

export function Logo({ size = 48, color = Colors.mars }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      accessibilityRole="image"
      accessibilityLabel="Armstrong Maps">
      <Path d={SYMBOL} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
