import { memo, useEffect, useRef, useState } from 'react';

import { headingToFraction, panoramaUrl, type Panorama } from '@/data/panoramas';

export type PanoramaViewProps = {
  panorama: Panorama;
  /** The compass heading the astronaut is looking at, in degrees. */
  heading: number;
  /** How far up (positive) or down the astronaut is looking, in degrees. */
  pitch: number;
  size: { width: number; height: number };
  /**
   * How far through this scene's stretch of walking the astronaut is, 0 to 1. The view moves
   * that far into the photograph, which gives the walk its depth.
   */
  advance?: number;
  /**
   * The person asked the system for less movement: the view does not move into the photograph,
   * and a change of scene is a plain fade through the dust.
   */
  still?: boolean;
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
 * The cut from one scene to the next: a gust of dust rises over the view and clears on the next
 * place. It stands for the ground covered between two photographs, which no camera filmed. The
 * dust is drawn.
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
/**
 * How far the view drifts on into the scene it leaves, and how far back it starts in the next.
 * Small on purpose: the cut carries on the slow move of the scene, it does not lunge. The view
 * never rises and falls with the steps either, which reads as shaking.
 */
const PUSH_OUT = 0.04;
const PUSH_IN = 0.02;

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
  /** Whether to draw the sky in the gaps of the mosaic: only once the picture itself is there. */
  patched: boolean;
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
  patched,
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
        // The sky gaps that cross this strip, measured from its left edge and the top of the band.
        const stripLeft = index * stripWidth;
        const shown = stripWidth + 1.5;
        const holes = (panorama.skyGaps ?? [])
          .map((gap) => {
            const gapLeft = gap.left * pictureWidth - stripLeft;
            const gapRight = gap.right * pictureWidth - stripLeft;
            // The lower edge of a gap is a straight line from one side to the other.
            const reach = (x: number) =>
              (gap.bottomLeft +
                ((gap.bottomRight - gap.bottomLeft) * (x - gapLeft)) / (gapRight - gapLeft) -
                panorama.band.top) *
              pictureHeight;
            const left = Math.max(0, gapLeft);
            const right = Math.min(shown, gapRight);
            return { gap, gapLeft, gapRight, left, right, down: [reach(left), reach(right)] };
          })
          .filter((hole) => hole.right > hole.left)
          .sort((one, other) => one.left - other.left);
        // The photograph with those gaps cut out of its top edge. Painting over them instead
        // leaves a dark line at every join, where the black of the picture shows at the edge.
        const outline =
          holes.length === 0
            ? undefined
            : `polygon(0px 0px, ${holes
                .map(
                  ({ left, right, down }) =>
                    `${left}px 0px, ${left}px ${down[0]}px, ${right}px ${down[1]}px, ${right}px 0px`,
                )
                .join(', ')}, ${shown}px 0px, ${shown}px ${bandHeight}px, 0px ${bandHeight}px)`;
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
            {/* Sky the mosaic has no frame for, drawn in the colours it has on either side. */}
            {(patched ? holes : []).map((hole) => (
              <div
                key={hole.gap.left}
                style={{
                  position: 'absolute',
                  left: hole.left,
                  width: hole.right - hole.left,
                  top,
                  height: Math.max(...hole.down) + 1,
                  backgroundImage: `linear-gradient(90deg, ${hole.gap.sky[0]}, ${hole.gap.sky[1]})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${hole.gapRight - hole.gapLeft}px 100%`,
                  backgroundPosition: `${hole.gapLeft - hole.left}px 0px`,
                  animation: fade,
                }}
              />
            ))}
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
                clipPath: outline,
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
  advance = 0,
  still = false,
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

    const started = performance.now();
    let frame = 0;
    let swapped = false;
    const step = (time: number) => {
      // The first frame can carry a time from before the cut was asked for.
      const t = Math.min(1, Math.max(0, (time - started) / CUT_MS));
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

  // The sky drawn in the gaps of a mosaic waits for the light picture, or it would show on its
  // own, as a patch in an empty view, while the picture loads.
  const [arrived, setArrived] = useState<string | null>(null);
  const gapped = (scene.skyGaps ?? []).length > 0;
  useEffect(() => {
    if (!gapped) return;
    let wanted = true;
    const light = new Image();
    light.src = panoramaUrl(scene, false);
    light
      .decode()
      .then(() => {
        if (wanted) setArrived(scene.nasaId);
      })
      .catch(() => {
        // No picture, so nothing to patch.
      });
    return () => {
      wanted = false;
    };
  }, [scene, gapped]);

  // Leaving: drift on into the scene while the dust rises. Arriving: settle as it clears.
  const leaving = cut !== null && cut < 0.5;
  const part = cut === null ? 0 : leaving ? cut / 0.5 : (cut - 0.5) / 0.5;
  const cutPush =
    cut === null ? 0 : leaving ? ease(part) * PUSH_OUT : -(1 - ease(part)) * PUSH_IN;
  // Held still, the picture stays where it is and only the dust fades over it and away.
  const push = still ? 0 : Math.min(1, Math.max(0, depth.advance)) * DEPTH + cutPush;
  const dust = cut === null ? 0 : leaving ? part ** 1.4 : (1 - part) ** 1.4;

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
          top: size.height / 2,
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
          patched={arrived === scene.nasaId}
        />
        {/* The full picture fades in over the light one, which stays until it is painted. */}
        {wideScreen && sharp === scene.nasaId ? (
          <Cylinder panorama={scene} radius={radius} wideScreen fading ahead={ahead} patched />
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
