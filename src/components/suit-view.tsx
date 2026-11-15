/**
 * The astronaut's own suit, seen from inside the helmet when they look down: the boots, the
 * legs and the chest pack.
 *
 * It is drawn, and the visor says so. It stands where a body would stand: below the lowest row a
 * photograph has ground for, where the camera's own rover was and where the view used to end in
 * a dark edge. It is a plain suit of no maker: no badge, no flag, no lettering, and nothing of
 * the NASA insignia.
 */
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export type SuitViewProps = {
  size: { width: number; height: number };
  /** Distance from the eye to the picture, in pixels: the lens of the view. */
  eye: number;
  /** How far up (positive) or down the astronaut is looking, in degrees. */
  pitch: number;
  /** How far below the horizon the photograph stops having ground, in degrees. */
  groundEndsDeg: number;
  /** The height of the rim of the helmet at the foot of the view, in pixels. */
  rim: number;
};

const RAD = Math.PI / 180;
/** The suit starts this many degrees above where the ground ends, so no edge shows between them. */
const OVERLAP_DEG = 4;
/** How far the boots reach above the edge of the body, into the ground of the photograph. */
const RISE = 300;

/**
 * Where on the screen the body starts, from the top, in pixels: the row of the picture where the
 * ground ends, a little higher, for the way the view is tilted.
 */
export function suitEdge(
  size: { height: number },
  eye: number,
  pitch: number,
  groundEndsDeg: number,
): number {
  // The angle below the middle of the view. Close to straight down it would run off to infinity.
  const below = Math.min(80, groundEndsDeg - OVERLAP_DEG + pitch);
  return size.height / 2 + eye * Math.tan(below * RAD);
}

export function SuitView({ size, eye, pitch, groundEndsDeg, rim }: SuitViewProps) {
  const { width, height } = size;
  const edge = suitEdge(size, eye, pitch, groundEndsDeg);
  // Looking ahead, the body is below the rim of the helmet: nothing to draw.
  if (edge >= height - rim) return null;

  // Everything is measured in `u`, which grows with the lens, so the suit keeps its proportions.
  const u = eye / 650;
  const mid = width / 2;
  const rise = RISE * u;
  const top = edge - rise;
  // Coordinates inside the drawing: y is 0 at the edge of the body, negative towards the boots.
  const y = (value: number) => rise + value * u;
  const x = (value: number) => mid + value * u;
  const foot = height - top;

  // A leg seen from above: wide at the thigh, close to the eye, narrow at the ankle. `side` is
  // -1 for the left one and 1 for the right.
  const leg = (side: number) =>
    `M${x(side * 26)} ${y(60)} ` +
    `C${x(side * 30)} ${y(-30)}, ${x(side * 44)} ${y(-120)}, ${x(side * 50)} ${y(-178)} ` +
    `L${x(side * 132)} ${y(-178)} ` +
    `C${x(side * 150)} ${y(-120)}, ${x(side * 210)} ${y(-30)}, ${x(side * 262)} ${y(60)} Z`;
  const knee = (side: number) =>
    `M${x(side * 52)} ${y(-96)} ` +
    `C${x(side * 70)} ${y(-112)}, ${x(side * 130)} ${y(-112)}, ${x(side * 156)} ${y(-96)} ` +
    `C${x(side * 168)} ${y(-64)}, ${x(side * 176)} ${y(-44)}, ${x(side * 186)} ${y(-24)} ` +
    `C${x(side * 140)} ${y(-38)}, ${x(side * 86)} ${y(-38)}, ${x(side * 44)} ${y(-24)} ` +
    `C${x(side * 44)} ${y(-50)}, ${x(side * 48)} ${y(-74)}, ${x(side * 52)} ${y(-96)} Z`;
  const boot = (side: number) =>
    `M${x(side * 40)} ${y(-168)} ` +
    `C${x(side * 34)} ${y(-230)}, ${x(side * 44)} ${y(-292)}, ${x(side * 92)} ${y(-298)} ` +
    `C${x(side * 142)} ${y(-292)}, ${x(side * 152)} ${y(-230)}, ${x(side * 144)} ${y(-168)} Z`;
  const toe = (side: number) =>
    `M${x(side * 42)} ${y(-244)} ` +
    `C${x(side * 48)} ${y(-286)}, ${x(side * 70)} ${y(-298)}, ${x(side * 92)} ${y(-298)} ` +
    `C${x(side * 116)} ${y(-298)}, ${x(side * 138)} ${y(-286)}, ${x(side * 146)} ${y(-244)} ` +
    `C${x(side * 116)} ${y(-258)}, ${x(side * 70)} ${y(-258)}, ${x(side * 42)} ${y(-244)} Z`;
  // The body across the whole view: it never leaves a gap for what is behind it to show. Its
  // edge is highest at the sides, where the shoulders are nearer the eye.
  const body =
    `M0 ${y(-34)} ` +
    `C${width * 0.18} ${y(-30)}, ${width * 0.34} ${y(-6)}, ${mid} ${y(-2)} ` +
    `C${width * 0.66} ${y(-6)}, ${width * 0.82} ${y(-30)}, ${width} ${y(-34)} ` +
    `L${width} ${foot} L0 ${foot} Z`;
  const seam = 1.5 * u;

  return (
    <Svg
      width={width}
      height={foot}
      style={{ position: 'absolute', left: 0, top }}
      pointerEvents="none"
      accessibilityLabel="The astronaut's own suit and boots, drawn">
      <Defs>
        <LinearGradient id="suit-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={Colors.suitShadow} stopOpacity={0} />
          <Stop offset="1" stopColor={Colors.suitShadow} stopOpacity={0.7} />
        </LinearGradient>
        {/* The body is lit from above: darkest where the legs leave it and under the rim. */}
        <LinearGradient
          id="suit-body"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={y(-34)}
          x2={0}
          y2={y(360)}>
          <Stop offset="0" stopColor={Colors.suitDeep} />
          <Stop offset="0.22" stopColor={Colors.suitShade} />
          <Stop offset="0.5" stopColor={Colors.suit} />
          <Stop offset="1" stopColor={Colors.suitDeep} />
        </LinearGradient>
        {/* Round forms: lit along the middle, in shade at both edges. */}
        <LinearGradient id="suit-round" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={Colors.suitDeep} />
          <Stop offset="0.3" stopColor={Colors.suit} />
          <Stop offset="0.62" stopColor={Colors.suit} />
          <Stop offset="1" stopColor={Colors.suitDeep} />
        </LinearGradient>
        <LinearGradient id="suit-boot" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={Colors.suitSeam} />
          <Stop offset="0.35" stopColor={Colors.suitBoot} />
          <Stop offset="0.65" stopColor={Colors.suitBoot} />
          <Stop offset="1" stopColor={Colors.suitSeam} />
        </LinearGradient>
      </Defs>

      {/* The shade the astronaut casts on the ground just ahead, and under each boot. */}
      <Rect x={0} y={y(-110)} width={width} height={110 * u} fill="url(#suit-shade)" />
      {[-1, 1].map((side) => (
        <Ellipse
          key={`shade${side}`}
          cx={x(side * 96)}
          cy={y(-282)}
          rx={78 * u}
          ry={30 * u}
          fill={Colors.suitShadow}
          opacity={0.42}
        />
      ))}

      <Path d={body} fill="url(#suit-body)" />

      {[-1, 1].map((side) => (
        <Path
          key={`leg${side}`}
          d={leg(side)}
          fill="url(#suit-round)"
          stroke={Colors.suitSeam}
          strokeWidth={seam}
        />
      ))}
      {/* The pad over each knee, and the fold of the cloth above it. */}
      {[-1, 1].map((side) => (
        <Path
          key={`knee${side}`}
          d={knee(side)}
          fill={Colors.suitShade}
          stroke={Colors.suitSeam}
          strokeWidth={seam}
          opacity={0.9}
        />
      ))}
      {[-1, 1].map((side) => (
        <Path
          key={`fold${side}`}
          d={`M${x(side * 56)} ${y(-132)} C${x(side * 80)} ${y(-142)}, ${x(side * 110)} ${y(-142)}, ${x(side * 138)} ${y(-132)}`}
          stroke={Colors.suitSeam}
          strokeWidth={2 * u}
          fill="none"
          opacity={0.7}
        />
      ))}
      {[-1, 1].map((side) => (
        <Path
          key={`boot${side}`}
          d={boot(side)}
          fill="url(#suit-boot)"
          stroke={Colors.suitSeam}
          strokeWidth={seam}
        />
      ))}
      {/* The ring where the boot locks to the leg, and the dust of Mars on the toe. */}
      {[-1, 1].map((side) => (
        <Path
          key={`cuff${side}`}
          d={`M${x(side * 44)} ${y(-176)} C${x(side * 70)} ${y(-166)}, ${x(side * 112)} ${y(-166)}, ${x(side * 140)} ${y(-176)}`}
          stroke={Colors.suitSeam}
          strokeWidth={9 * u}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {[-1, 1].map((side) => (
        <Path key={`toe${side}`} d={toe(side)} fill={Colors.suitDust} opacity={0.6} />
      ))}

      {/* The chest pack: a plain box with its controls, and no lettering. */}
      <Rect
        x={x(-150)}
        y={y(96)}
        width={300 * u}
        height={170 * u}
        rx={20 * u}
        fill={Colors.suitDeep}
        stroke={Colors.suitSeam}
        strokeWidth={seam}
      />
      <Rect x={x(-124)} y={y(118)} width={140 * u} height={38 * u} rx={8 * u} fill={Colors.suitSeam} />
      {[52, 96].map((at) => (
        <Circle
          key={at}
          cx={x(at)}
          cy={y(137)}
          r={15 * u}
          fill={Colors.suitShade}
          stroke={Colors.suitSeam}
          strokeWidth={seam}
        />
      ))}
    </Svg>
  );
}
