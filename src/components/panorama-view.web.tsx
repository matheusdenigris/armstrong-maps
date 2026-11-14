import { memo, useEffect, useRef, useState } from 'react';

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
  /**
   * How far through this scene's stretch of walking the astronaut is, 0 to 1. The view moves
   * that far into the photograph, which gives the walk its depth.
   */
  advance?: number;
};

/** The picture is wrapped round the astronaut in this many flat strips; four degrees each. */
const STRIPS = 90;
/**
 * Only the strips this far to each side of where the astronaut looks are drawn: 64 degrees, more
 * than any screen shows. A strip seen almost edge-on projects to an enormous rectangle, and
 * drawing those made the picture slow to appear.
 */
const STRIPS_EACH_SIDE = 16;
/** Below the picture, where the mosaic has no frames: the inside of the helmet, not the ground. */
const BELOW = '#0d0907';
const FILL = 3000;
const FADE_MS = 900;

/**
 * The cut from one scene to the next: the astronaut strides forward into a gust of dust, and it
 * clears on the next place. It stands for the ground covered between two photographs, which no
 * camera filmed. The dust is drawn.
 */
const CUT_MS = 2200;
const DUST = '#b9987a';
/**
 * How far into the photograph the view has moved by the end of a scene, as a share of the
 * distance to the picture. At 0.36 what is straight ahead is a little over one and a half times
 * larger than at the start. It is a move into a still picture, not over the ground: nothing in
 * the photograph shifts against anything else.
 */
const DEPTH = 0.36;
/** How far the view pushes into the scene it leaves, and how far back it starts in the next. */
const PUSH_OUT = 0.26;
const PUSH_IN = 0.12;
/** Extra lift of the strides during the cut, in pixels, and how many of them. */
const STRIDE = 9;
const STRIDES = 4;

const RAD = Math.PI / 180;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Distance from the eye to the picture, in pixels, for a lens that suits the shape of the screen. */
function eyeDistance(size: { width: number; height: number }): number {
  // A tall phone gets a wider lens, or it would see a sliver of the horizon.
  const lens = size.width < size.height ? 82 : 58;
  return size.height / 2 / Math.tan((lens * RAD) / 2);
}

type CylinderProps = {
  panorama: Panorama;
  radius: number;
  wideScreen: boolean;
  fading: boolean;
  /** The strip straight ahead of the astronaut. */
  ahead: number;
};

/**
 * The photograph bent into a cylinder with the astronaut on its axis. It is built from plain
 * strips, each showing its slice of the picture, so the picture is an ordinary image: the NASA
 * library does not allow its files to be used as textures on another site.
 */
const Cylinder = memo(function Cylinder({
  panorama,
  radius,
  wideScreen,
  fading,
  ahead,
}: CylinderProps) {
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
    <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>
      {Array.from({ length: STRIPS }, (_, index) => {
        // How many strips away from straight ahead, going the short way round.
        const away = Math.abs(((index - ahead + STRIPS * 1.5) % STRIPS) - STRIPS / 2);
        if (away > STRIPS_EACH_SIDE) return null;
        return (
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
        );
      })}
    </div>
  );
});

/**
 * A real 360-degree photograph seen from where it was taken. Turning the heading turns the view
 * all the way round. When the walk moves on to another photograph, a short cut carries the
 * astronaut there.
 */
export function PanoramaView({
  panorama,
  heading,
  pitch,
  size,
  sway = 0,
  advance = 0,
}: PanoramaViewProps) {
  // The scene on screen, which lags the one asked for by half a cut.
  const [scene, setScene] = useState(panorama);
  // How far into the scene on screen the view is. It follows the walk while the walk is in that
  // scene; when the walk has moved on and the cut is still leaving, it holds where it was, so the
  // view does not spring back before the dust covers it.
  const [depth, setDepth] = useState({ id: panorama.nasaId, advance });
  if (
    scene.nasaId === panorama.nasaId &&
    (depth.id !== panorama.nasaId || depth.advance !== advance)
  ) {
    setDepth({ id: panorama.nasaId, advance });
  }
  // How far through the cut, 0 to 1, or null when standing in a scene.
  const [cut, setCut] = useState<number | null>(null);
  // The scene the walk last asked for, so one request starts one cut.
  const asked = useRef(panorama.nasaId);

  useEffect(() => {
    if (asked.current === panorama.nasaId) return;
    asked.current = panorama.nasaId;
    // Fetch the next picture while the dust is still rising.
    const next = new Image();
    next.src = panoramaUrl(panorama, false);

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let frame = 0;
    let swapped = false;
    const step = (time: number) => {
      const t = calm ? 1 : Math.min(1, (time - started) / CUT_MS);
      if (!swapped && t >= 0.5) {
        swapped = true;
        setScene(panorama);
      }
      setCut(t < 1 ? t : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [panorama]);

  const radius = eyeDistance(size);
  const wideScreen = size.width >= 900;

  // The full picture is several megabytes. The light one is shown at once and the full one takes
  // its place when the browser has it.
  const [sharp, setSharp] = useState<string | null>(null);
  useEffect(() => {
    if (!wideScreen) return;
    let wanted = true;
    const full = new Image();
    full.src = panoramaUrl(scene, true);
    // Wait until it is decoded, not just downloaded, or the view goes blank during the swap.
    full
      .decode()
      .then(() => {
        if (wanted) setSharp(scene.nasaId);
      })
      .catch(() => {
        // The full picture did not arrive or is too large for this device: stay on the light one.
      });
    return () => {
      wanted = false;
    };
  }, [scene, wideScreen]);

  // Leaving: stride into the scene while the dust rises. Arriving: settle as it clears.
  const leaving = cut !== null && cut < 0.5;
  const part = cut === null ? 0 : leaving ? cut / 0.5 : (cut - 0.5) / 0.5;
  const stridePush =
    cut === null ? 0 : leaving ? ease(part) * PUSH_OUT : -(1 - ease(part)) * PUSH_IN;
  const push = Math.min(1, Math.max(0, depth.advance)) * DEPTH + stridePush;
  const dust = cut === null ? 0 : leaving ? part ** 1.4 : (1 - part) ** 1.4;
  const stride = cut === null ? 0 : Math.abs(Math.sin(cut * Math.PI * STRIDES)) * STRIDE;

  const ahead = Math.floor(headingToFraction(scene, heading) * STRIPS) % STRIPS;

  return (
    <div
      role="img"
      aria-label={`${scene.caption}. A real 360-degree photograph; drag to look around.`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // What shows through the hairline between two strips: sky, where it is least noticed.
        background: scene.sky,
        perspective: `${radius}px`,
        pointerEvents: 'none',
      }}>
      <style>{'@keyframes armstrong-fade { from { opacity: 0 } to { opacity: 1 } }'}</style>
      <div
        key={scene.nasaId}
        style={{
          position: 'absolute',
          left: size.width / 2,
          top: size.height / 2 + sway + stride,
          transformStyle: 'preserve-3d',
          transform: `translateZ(${radius * (1 + push)}px) rotateX(${pitch}deg) rotateY(${
            headingToFraction(scene, heading) * 360
          }deg)`,
        }}>
        <Cylinder
          panorama={scene}
          radius={radius}
          wideScreen={false}
          fading={false}
          ahead={ahead}
        />
        {/* The full picture fades in over the light one, which stays until it is painted. */}
        {wideScreen && sharp === scene.nasaId ? (
          <Cylinder panorama={scene} radius={radius} wideScreen fading ahead={ahead} />
        ) : null}
      </div>

      {/* The gust of dust that covers the change of scene. */}
      {cut !== null ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: dust,
            background: `radial-gradient(ellipse at 50% 58%, ${DUST} 0%, ${DUST} 45%, #8f7258 100%)`,
          }}
        />
      ) : null}
    </div>
  );
}
