import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { MapLayer } from '@/data/layers';
import { project, type MapView } from '@/mission/camera';
import type { LatLon } from '@/mission/geo';

import { TilePlane } from './surface-map';

type MiniMapProps = {
  layers: readonly MapLayer[];
  /** Where the astronaut is: the centre of the map. */
  centre: LatLon;
  /** The way the astronaut faces, in degrees from north. It is up on the map. */
  heading: number;
  pixelsPerDegree: number;
  diameter: number;
  /** The planned route, from the base and back to it. */
  route: readonly LatLon[];
  base: LatLon;
};

/**
 * A round map centred on the astronaut and turned so that what is ahead is at the top. The tiles
 * are plain images in a rotated view, so they stay visible at any angle.
 */
export function MiniMap({
  layers,
  centre,
  heading,
  pixelsPerDegree,
  diameter,
  route,
  base,
}: MiniMapProps) {
  // The square that is rotated has to cover the circle at every angle.
  const side = Math.ceil(diameter * Math.SQRT2) + 2;
  const size = { width: side, height: side };
  const view: MapView = { ...centre, pixelsPerDegree };
  const inset = (diameter - side) / 2;
  const points = route
    .map((point) => {
      const at = project(view, size, point);
      return `${at.x.toFixed(1)},${at.y.toFixed(1)}`;
    })
    .join(' ');
  const home = project(view, size, base);
  const middle = diameter / 2;

  return (
    <View
      style={[styles.frame, { width: diameter, height: diameter, borderRadius: middle }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Map around you, turned so that ahead is up">
      <View
        style={[
          styles.turning,
          { left: inset, top: inset, width: side, height: side },
          { transform: [{ rotate: `${-heading}deg` }] },
        ]}>
        <TilePlane layers={layers} base={view} size={size} />
        <Svg width={side} height={side} style={styles.overlay}>
          {route.length > 1 ? (
            <Polyline
              points={points}
              fill="none"
              stroke={Colors.nav}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          <Circle cx={home.x} cy={home.y} r={6} fill={Colors.mars} stroke={Colors.text} strokeWidth={2} />
        </Svg>
      </View>

      {/* The astronaut: always in the middle, always pointing up. */}
      <Svg width={diameter} height={diameter} style={styles.overlay}>
        <Path
          d={`M${middle} ${middle - 11}L${middle + 8} ${middle + 9}L${middle} ${middle + 4}L${middle - 8} ${middle + 9}z`}
          fill={Colors.go}
          stroke={Colors.background}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.background,
  },
  turning: {
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
