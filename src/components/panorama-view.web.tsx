import { memo, useEffect, useState } from 'react';

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

/** The picture is wrapped round the astronaut in this many flat strips; four degrees each. */
const STRIPS = 90;
/** Below the picture, where the mosaic has no frames: the inside of the helmet, not the ground. */
const BELOW = '#0d0907';
const FILL = 3000;
const FADE_MS = 900;

const RAD = Math.PI / 180;

/** Distance from the eye to the picture, in pixels, for a lens that suits the shape of the screen. */
function eyeDistance(size: { width: number; height: number }): number {
  // A tall phone gets a wider lens, or it would see a sliver of the horizon.
  const lens = size.width < size.height ? 82 : 58;
  return size.height / 2 / Math.tan((lens * RAD) / 2);
}

type CylinderProps = { panorama: Panorama; radius: number; wideScreen: boolean; fading: boolean };

/**
 * The photograph bent into a cylinder with the astronaut on its axis. It is built from plain
 * strips, each showing its slice of the picture, so the picture is an ordinary image: the NASA
 * library does not allow its files to be used as textures on another site.
 */
const Cylinder = memo(function Cylinder({ panorama, radius, wideScreen, fading }: CylinderProps) {
  const stripWidth = 2 * radius * Math.tan(Math.PI / STRIPS);
  const pictureWidth = stripWidth * STRIPS;
  const pictureHeight = (panorama.height / panorama.width) * pictureWidth;
  const top = (panorama.band.top - panorama.horizon) * pictureHeight;
  const bandHeight = (panorama.band.bottom - panorama.band.top) * pictureHeight;
  const url = panoramaUrl(panorama, wideScreen);
  // The fade is on each flat piece. On the element that holds the 3D strips it would flatten
  // them, and strips behind the viewer would smear across the view.
  const fade = fading ? `armstrong-fade ${FADE_MS}ms ease-out both` : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        transformStyle: 'preserve-3d',
      }}>
      {Array.from({ length: STRIPS }, (_, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: -stripWidth / 2,
            top: 0,
            // A little wider than its share, so no hairline shows where two strips meet.
            width: stripWidth + 1.5,
            transformStyle: 'preserve-3d',
            // Strip 0 starts at the left edge of the picture; they go round clockwise.
            transform: `rotateY(${-((index + 0.5) * 360) / STRIPS}deg) translateZ(${-radius}px)`,
            backfaceVisibility: 'hidden',
          }}>
          {/* The sky carries on above the frames, in the colour it has at their top edge. */}
          <div
            style={{
              position: 'absolute',
              left: -1,
              right: -1,
              top: top - FILL,
              height: FILL + 1,
              background: panorama.sky,
              animation: fade,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top,
              height: bandHeight,
              backgroundImage: `url(${url})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${pictureWidth}px ${pictureHeight}px`,
              backgroundPosition: `${-index * stripWidth}px ${-panorama.band.top * pictureHeight}px`,
              animation: fade,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: -1,
              right: -1,
              top: top + bandHeight - 1,
              height: FILL,
              background: BELOW,
              animation: fade,
            }}
          />
        </div>
      ))}
    </div>
  );
});

/**
 * A real 360-degree photograph seen from where it was taken. Turning the heading turns the view
 * all the way round. When the photograph changes, the new one fades in over the old one.
 */
export function PanoramaView({ panorama, heading, pitch, size, sway = 0 }: PanoramaViewProps) {
  const [shown, setShown] = useState<{ current: Panorama; previous: Panorama | null }>({
    current: panorama,
    previous: null,
  });
  if (shown.current.nasaId !== panorama.nasaId) {
    setShown({ current: panorama, previous: shown.current });
  }

  useEffect(() => {
    if (!shown.previous) return;
    const timer = setTimeout(
      () => setShown((layers) => ({ current: layers.current, previous: null })),
      FADE_MS + 100,
    );
    return () => clearTimeout(timer);
  }, [shown]);

  const radius = eyeDistance(size);
  const wideScreen = size.width >= 900;

  // The full picture is several megabytes. The light one is shown at once and the full one takes
  // its place when the browser has it.
  const [sharp, setSharp] = useState<string | null>(null);
  useEffect(() => {
    if (!wideScreen) return;
    let wanted = true;
    const full = new Image();
    full.src = panoramaUrl(panorama, true);
    // Wait until it is decoded, not just downloaded, or the view goes blank during the swap.
    full
      .decode()
      .then(() => {
        if (wanted) setSharp(panorama.nasaId);
      })
      .catch(() => {
        // The full picture did not arrive or is too large for this device: stay on the light one.
      });
    return () => {
      wanted = false;
    };
  }, [panorama, wideScreen]);
  const world = (picture: Panorama) =>
    `translateZ(${radius}px) rotateX(${pitch}deg) rotateY(${headingToFraction(picture, heading) * 360}deg)`;

  return (
    <div
      role="img"
      aria-label={`${panorama.caption}. A real 360-degree photograph; drag to look around.`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // What shows through the hairline between two strips: sky, where it is least noticed.
        background: panorama.sky,
        perspective: `${radius}px`,
        pointerEvents: 'none',
      }}>
      <style>{'@keyframes armstrong-fade { from { opacity: 0 } to { opacity: 1 } }'}</style>
      {[shown.previous, shown.current].map((picture, layer) =>
        picture ? (
          <div
            key={picture.nasaId}
            style={{
              position: 'absolute',
              left: size.width / 2,
              top: size.height / 2 + sway,
              transformStyle: 'preserve-3d',
              transform: world(picture),
            }}>
            <Cylinder
              panorama={picture}
              radius={radius}
              wideScreen={false}
              fading={layer === 1 && shown.previous !== null}
            />
            {/* The full picture fades in over the light one, which stays until it is painted. */}
            {wideScreen && sharp === picture.nasaId ? (
              <Cylinder panorama={picture} radius={radius} wideScreen fading />
            ) : null}
          </div>
        ) : null,
      )}
    </div>
  );
}
