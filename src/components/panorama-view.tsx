import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { headingToFraction, panoramaUrl, type Panorama } from '@/data/panoramas';

export type PanoramaViewProps = {
  panorama: Panorama;
  /** The compass heading the astronaut is looking at, in degrees. */
  heading: number;
  /** How far up (positive) or down the astronaut is looking, in degrees. */
  pitch: number;
  size: { width: number; height: number };
  /** How far through this scene's stretch of walking the astronaut is, 0 to 1. */
  advance?: number;
  /** The person asked the system for less movement: the picture does not grow. */
  still?: boolean;
};

/**
 * The same real photograph on Android and iOS, where the view that wraps it round the astronaut
 * (`panorama-view.web.tsx`) does not run yet: the picture slides sideways with the heading, shown
 * twice in a row so it can go all the way round.
 */
export function PanoramaView({
  panorama,
  heading,
  size,
  advance = 0,
  still = false,
}: PanoramaViewProps) {
  const bandHeight = (panorama.band.bottom - panorama.band.top) * panorama.height;
  // The picture grows a little as the astronaut covers the stretch, as on the web.
  const grown = still ? 0 : Math.min(1, Math.max(0, advance));
  const scale = (size.height / bandHeight) * (1 + grown * 0.5);
  const width = panorama.width * scale;
  const height = panorama.height * scale;
  const left = size.width / 2 - headingToFraction(panorama, heading) * width;
  const top = -panorama.band.top * height;

  return (
    <View style={[StyleSheet.absoluteFill, styles.frame]} pointerEvents="none">
      {[-1, 0, 1].map((copy) => (
        <Image
          key={copy}
          source={{ uri: panoramaUrl(panorama, false) }}
          style={{ position: 'absolute', left: left + copy * width, top, width, height }}
          contentFit="fill"
          cachePolicy="memory-disk"
          accessible={copy === 0}
          accessibilityLabel={panorama.caption}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#0d0907',
  },
});
