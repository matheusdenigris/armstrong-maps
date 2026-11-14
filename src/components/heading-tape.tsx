import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type HeadingTapeProps = {
  /** The way the astronaut faces, in degrees from north. */
  heading: number;
  /** The bearing of the next point to walk to, or null when there is none. */
  target: number | null;
  width: number;
};

/** Degrees of the horizon the tape shows from edge to edge. */
const SPAN = 100;
const STEP = 15;
const NAMES: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
};

/** How far `to` is from `from` going the short way round, in -180..180. */
export const turnTo = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * A strip of compass that slides as the astronaut turns. The caret in the middle is where they
 * face; the blue mark is where the next waypoint is.
 */
export function HeadingTape({ heading, target, width }: HeadingTapeProps) {
  const perDegree = width / SPAN;
  const first = Math.ceil((heading - SPAN / 2) / STEP) * STEP;
  const ticks: number[] = [];
  for (let angle = first; angle <= heading + SPAN / 2; angle += STEP) ticks.push(angle);

  const offTarget = target === null ? null : turnTo(heading, target);
  const visible = offTarget !== null && Math.abs(offTarget) <= SPAN / 2 - 4;

  return (
    <View
      style={[styles.tape, { width }]}
      accessible
      accessibilityLabel={`Heading ${Math.round(((heading % 360) + 360) % 360)} degrees`}>
      {ticks.map((angle) => {
        const compass = ((angle % 360) + 360) % 360;
        const name = NAMES[compass];
        return (
          <View
            key={angle}
            style={[styles.tick, { left: width / 2 + (angle - heading) * perDegree - 20 }]}>
            <View style={[styles.line, name ? styles.lineMajor : null]} />
            <Text style={[styles.label, name ? styles.labelMajor : null]}>
              {name ?? String(compass).padStart(3, '0')}
            </Text>
          </View>
        );
      })}

      {offTarget !== null && visible ? (
        <View style={[styles.target, { left: width / 2 + offTarget * perDegree - 7 }]} />
      ) : null}
      {offTarget !== null && !visible ? (
        <Text style={[styles.away, offTarget < 0 ? styles.awayLeft : styles.awayRight]}>
          {offTarget < 0 ? '◀' : '▶'}
        </Text>
      ) : null}

      <View style={[styles.caret, { left: width / 2 - 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    height: 42,
    overflow: 'hidden',
    backgroundColor: Colors.glassDark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  tick: {
    position: 'absolute',
    top: 0,
    width: 40,
    alignItems: 'center',
  },
  line: {
    width: 1,
    height: 7,
    backgroundColor: Colors.textFaint,
  },
  lineMajor: {
    width: 1,
    height: 11,
    backgroundColor: Colors.text,
  },
  label: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
    paddingTop: 4,
  },
  labelMajor: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    paddingTop: 2,
  },
  caret: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.mars,
  },
  target: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.nav,
  },
  away: {
    position: 'absolute',
    bottom: 2,
    color: Colors.nav,
    fontSize: 14,
  },
  awayLeft: {
    left: 6,
  },
  awayRight: {
    right: 6,
  },
});
