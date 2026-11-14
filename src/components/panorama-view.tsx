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
  /** Vertical sway of a step, in pixels. Zero when standing still. */
  sway?: number;
};

/**
 * The same real photograph on Android and iOS, where the view that wraps it round the astronaut
 * (`panorama-view.web.tsx`) does not run yet: the picture slides sideways with the heading, shown
 * twice in a row so it can go all the way round.
 */
export function PanoramaView({ panorama, heading, size, sway = 0 }: PanoramaViewProps) {
  const bandHeight = (panorama.band.bottom - panorama.band.top) * panorama.height;
  const scale = size.height / bandHeight;
  const width = panorama.width * scale;
  const height = panorama.height * scale;
  const left = size.width / 2 - headingToFraction(panorama, heading) * width;
  const top = -panorama.band.top * height + sway;

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
