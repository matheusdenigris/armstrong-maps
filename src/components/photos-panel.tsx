import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PanelHeading, SectionHeading, StatusNote } from '@/components/console-parts';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LibraryImage } from '@/data/image-library';
import { CAMERA_NAMES, type RoverImage } from '@/data/rover-images';
import type { Feed } from '@/state/use-feed';

type PhotosPanelProps = {
  siteName: string;
  /** The newest raw images of the site's rover, when it has one. */
  rover: { name: string; gallery: string; images: Feed<RoverImage[]> } | null;
  library: Feed<LibraryImage[]>;
};

/** Real pictures of the place: the rover's newest frames and NASA's archive. */
export function PhotosPanel({ siteName, rover, library }: PhotosPanelProps) {
  return (
    <View style={styles.panel}>
      <PanelHeading title="Site photos" />
      {rover ? (
        <>
          <SectionHeading
            title={`NEWEST RAW IMAGES · ${rover.name.toUpperCase()}`}
            color={Colors.mars}
          />
          <FeedState
            feed={rover.images}
            waiting="Asking the rover's raw-image feed."
            failed="The raw-image feed did not answer. No pictures to show."
            empty="The raw-image feed answered without any full frame."
          />
          {rover.images.status === 'ready' && rover.images.data.length > 0 ? (
            <View style={styles.grid}>
              {rover.images.data.map((frame) => (
                <Photo
                  key={frame.id}
                  uri={frame.image}
                  url={frame.link ?? rover.gallery}
                  title={`${CAMERA_NAMES[frame.camera] ?? frame.camera} · sol ${frame.sol}`}
                  detail={frame.takenUtc ? `${frame.takenUtc.slice(0, 10)} UTC` : ''}
                  label={`${CAMERA_NAMES[frame.camera] ?? frame.camera} image from sol ${frame.sol}. Opens its page on mars.nasa.gov.`}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.source}>
            Raw, unprocessed frames from NASA/JPL-Caltech on mars.nasa.gov. Real pictures; where on
            the map each was taken is not shown.
          </Text>
        </>
      ) : null}

      <SectionHeading
        title={`NASA IMAGE LIBRARY · ${siteName.toUpperCase()}`}
        color={Colors.nav}
      />
      <FeedState
        feed={library}
        waiting="Searching the NASA Image and Video Library."
        failed="The NASA Image and Video Library did not answer. No pictures to show."
        empty="The library has no pictures for this site."
      />
      {library.status === 'ready' && library.data.length > 0 ? (
        <View style={styles.grid}>
          {library.data.map((picture) => (
            <Photo
              key={picture.nasaId}
              uri={picture.thumbnail}
              url={picture.page}
              title={picture.title}
              detail={[picture.centre, picture.dateCreated].filter(Boolean).join(' · ')}
              label={`${picture.title}. Opens its page on images.nasa.gov.`}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.source}>
        Archive pictures from images.nasa.gov, ranked by the library&apos;s search. Each one links to
        its page with the full credit.
      </Text>
    </View>
  );
}

type FeedStateProps = {
  feed: Feed<unknown[]>;
  waiting: string;
  failed: string;
  empty: string;
};

/** The sentence for a feed that has nothing to show yet, or nothing at all. */
function FeedState({ feed, waiting, failed, empty }: FeedStateProps) {
  if (feed.status === 'idle' || feed.status === 'loading') {
    return <StatusNote text={waiting} color={Colors.nav} />;
  }
  if (feed.status === 'failed') return <StatusNote text={failed} color={Colors.noGo} />;
  if (feed.data.length === 0) return <StatusNote text={empty} color={Colors.caution} />;
  return null;
}

type PhotoProps = { uri: string; url: string; title: string; detail: string; label: string };

function Photo({ uri, url, title, detail, label }: PhotoProps) {
  return (
    <Link href={url as Href} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable
        style={({ pressed }) => [styles.photo, pressed && styles.photoPressed]}
        accessibilityRole="link"
        accessibilityLabel={label}>
        <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
        <View style={styles.caption}>
          <Text style={styles.photoTitle} numberOfLines={2}>
            {title}
          </Text>
          {detail ? (
            <Text style={styles.photoDetail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  photo: {
    width: '48.5%',
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  photoPressed: {
    backgroundColor: Colors.glassHover,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: Colors.surfaceRaised,
  },
  caption: {
    gap: Spacing.one,
    padding: Spacing.two,
  },
  photoTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  photoDetail: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  source: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
});
