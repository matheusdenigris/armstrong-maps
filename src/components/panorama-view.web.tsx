import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { eyeDistance, headingToFraction, panoramaUrl, type Panorama } from '@/data/panoramas';
import type { PlaceView } from '@/data/place-views';

import { PICTURE_WIDTH, layoutPlace, type PlaceLayout, type SkyCell } from './place-layout';

export type PanoramaViewProps = {
  panorama: Panorama;
  /**
   * The view from the very place the astronaut is at, when a rover stopped there and looked all
   * the way round. While it is given it is shown instead of the photograph of the site.
   */
  place?: PlaceView | null;
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

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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

/** What shows between two cells of a place, should a hairline open: the tone of the ground. */
const PLACE_GROUND = '#8f7a63';
/** Cells further than this from where the astronaut looks are not drawn, in degrees of compass. */
const PLACE_EACH_SIDE = 72;
/** Each cell is a little larger than its share, so no hairline shows where two meet. */
const CELL_OVERLAP = 1.5;
/** The strip of sky is drawn with this many pixels for each column of the view. */
const SKY_PIXELS = 12;
/** The sky samples are run together over this many columns. */
const SKY_SMOOTH = 6;

const away = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const matrix3d = (numbers: readonly number[]) => `matrix3d(${numbers.join(',')})`;

/**
 * After the frames are evened out their sky would be pure white; this brings it back down.
 * A share of full brightness.
 */
const SKY_LEVEL = 0.8;

type PlacePaint = {
  /** The sky, as one strip that goes all the way round. */
  strip: HTMLCanvasElement;
  /**
   * For each frame, one pixel that evens it out against the others when it is laid over the
   * frame as a colour dodge: the brighter the camera made the sky of the frame, the less the
   * frame is lifted. Null for a frame that shows no sky to go by.
   */
  gains: (HTMLCanvasElement | null)[];
};

/**
 * What is drawn for a place besides its frames: the sky above them, and what evens the frames
 * out. Null until the frames are in.
 *
 * The camera chose its exposure frame by frame, so two neighbours can differ a great deal, and
 * side by side they would show as blocks. Each frame is lifted by how dark it made its own sky,
 * which brings every sky to the same brightness and leaves the colours as they are.
 *
 * The sky is the colour each frame has just under its top edge, run together from one frame to
 * the next.
 *
 * The browser does not let this page read the pixels of the frames, so none of this is ever
 * known as numbers: the colours are copied from picture to picture, divided by drawing one over
 * the other, and smoothed by drawing the strip small and then large again.
 */
function usePlacePaint(view: PlaceView, layout: PlaceLayout): PlacePaint | null {
  const [paint, setPaint] = useState<({ view: string } & PlacePaint) | null>(null);

  useEffect(() => {
    let wanted = true;
    const pictures = view.frames.map(
      (frame) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const picture = new Image();
          picture.onload = () => resolve(picture);
          picture.onerror = () => resolve(null);
          picture.src = frame.url;
        }),
    );
    void Promise.all(pictures).then((loaded) => {
      if (!wanted) return;

      // One pixel for each frame: white less the brightness of its sky.
      const gains = layout.levels.map((level) => {
        const picture = level ? loaded[level.frame] : null;
        if (!level || !picture) return null;
        const gain = document.createElement('canvas');
        gain.width = 1;
        gain.height = 1;
        const draw = gain.getContext('2d');
        if (!draw) return null;
        const k = picture.naturalWidth / PICTURE_WIDTH;
        draw.drawImage(picture, (level.x - 60) * k, (level.y - 8) * k, 120 * k, 16 * k, 0, 0, 1, 1);
        // A grey as bright as the patch, then what is left of white once it is taken away.
        draw.globalCompositeOperation = 'saturation';
        draw.fillStyle = '#808080';
        draw.fillRect(0, 0, 1, 1);
        draw.globalCompositeOperation = 'difference';
        draw.fillStyle = '#ffffff';
        draw.fillRect(0, 0, 1, 1);
        return gain;
      });

      const columns = layout.marks.length;
      const pad = SKY_SMOOTH;
      // One pixel for each column, with a few repeated at each end so the ring closes.
      const samples = document.createElement('canvas');
      samples.width = columns + 2 * pad;
      samples.height = 1;
      const draw = samples.getContext('2d');
      if (!draw) return;
      for (let x = 0; x < samples.width; x += 1) {
        const mark = layout.marks[(x - pad + columns) % columns];
        const picture = mark ? loaded[mark.frame] : null;
        if (!mark || !picture) continue;
        const k = picture.naturalWidth / PICTURE_WIDTH;
        draw.globalCompositeOperation = 'source-over';
        draw.drawImage(picture, (mark.x - 24) * k, (mark.y - 6) * k, 48 * k, 12 * k, x, 0, 1, 1);
        // Evened out the same way as the frame it comes from.
        const gain = gains[mark.frame];
        if (gain) {
          draw.globalCompositeOperation = 'color-dodge';
          draw.drawImage(gain, x, 0, 1, 1);
        }
      }
      draw.globalCompositeOperation = 'multiply';
      const level = Math.round(SKY_LEVEL * 255);
      draw.fillStyle = `rgb(${level},${level},${level})`;
      draw.fillRect(0, 0, samples.width, 1);

      const small = document.createElement('canvas');
      small.width = Math.round(samples.width / SKY_SMOOTH);
      small.height = 1;
      small.getContext('2d')?.drawImage(samples, 0, 0, small.width, 1);
      const strip = document.createElement('canvas');
      strip.width = samples.width * SKY_PIXELS;
      strip.height = 1;
      strip.getContext('2d')?.drawImage(small, 0, 0, strip.width, 1);
      setPaint({ view: view.id, strip, gains });
    });
    return () => {
      wanted = false;
    };
  }, [view, layout]);

  return paint && paint.view === view.id ? paint : null;
}

/** The pixel that evens a frame out, laid over one of its cells. */
const GainPiece = memo(function GainPiece({ gain }: { gain: HTMLCanvasElement }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    canvas.current?.getContext('2d')?.drawImage(gain, 0, 0);
  }, [gain]);
  return (
    <canvas
      ref={canvas}
      width={1}
      height={1}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        mixBlendMode: 'color-dodge',
      }}
    />
  );
});

/** The part of the strip of sky that stands over one column. */
const SkyPiece = memo(function SkyPiece({
  cell,
  strip,
}: {
  cell: SkyCell;
  strip: HTMLCanvasElement | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Before the browser paints, so a piece that comes into view while turning is never blank.
  useLayoutEffect(() => {
    const draw = canvas.current?.getContext('2d');
    if (!draw || !strip) return;
    draw.drawImage(
      strip,
      (cell.column + SKY_SMOOTH) * SKY_PIXELS,
      0,
      SKY_PIXELS,
      1,
      0,
      0,
      SKY_PIXELS,
      1,
    );
  }, [cell.column, strip]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: cell.width + CELL_OVERLAP,
        height: cell.height + CELL_OVERLAP,
        transformOrigin: '0 0',
        transform: matrix3d(cell.matrix),
        backfaceVisibility: 'hidden',
      }}>
      <canvas
        ref={canvas}
        width={SKY_PIXELS}
        height={1}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
});

type PlaceProps = {
  view: PlaceView;
  radius: number;
  /** The compass direction the astronaut looks in, to the nearest column. */
  ahead: number;
};

/**
 * The frames a rover took at one stop, each standing where its camera pointed, with the
 * astronaut where the camera was. North in the view is north on the ground. The frames are
 * ordinary images, cut into small flat pieces that follow the bend of the lens.
 */
const Place = memo(function Place({ view, radius, ahead }: PlaceProps) {
  const layout = useMemo(() => layoutPlace(view, radius), [view, radius]);
  const paint = usePlacePaint(view, layout);
  const near = <T extends { azimuth: number }>(cells: readonly T[]) =>
    cells.filter((cell) => away(cell.azimuth, ahead) <= PLACE_EACH_SIDE);

  return (
    <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>
      {near(layout.sky).map((cell) => (
        <SkyPiece key={cell.key} cell={cell} strip={paint?.strip ?? null} />
      ))}
      {near(layout.below).map((cell) => (
        <div
          key={cell.key}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cell.width + CELL_OVERLAP,
            height: cell.height + CELL_OVERLAP,
            transformOrigin: '0 0',
            transform: matrix3d(cell.matrix),
            backfaceVisibility: 'hidden',
            background: BELOW,
          }}
        />
      ))}
      {/* The frames wait for what evens them out, or they would change brightness on screen. */}
      {(paint ? near(layout.cells) : []).map((cell) => {
        const gain = paint?.gains[cell.frame] ?? null;
        // A cell near a join lets the frame under it through, more towards its own edge; the
        // topmost cell of a column fades into the sky behind it.
        const masks = [
          cell.side
            ? `linear-gradient(to right, rgba(0,0,0,${cell.side[0]}), rgba(0,0,0,${cell.side[1]}))`
            : null,
          cell.fades ? 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))' : null,
        ].filter((mask) => mask !== null);
        const mask = masks.length > 0 ? masks.join(', ') : undefined;
        return (
          <div
            key={cell.key}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: cell.width + CELL_OVERLAP,
              height: cell.height + CELL_OVERLAP,
              overflow: 'hidden',
              transformOrigin: '0 0',
              transform: matrix3d(cell.matrix),
              backfaceVisibility: 'hidden',
              // Lifted by the pixel laid over it, the frame is brought back down to the level
              // the sky is drawn at.
              filter: gain ? `brightness(${SKY_LEVEL})` : undefined,
              maskImage: mask,
              WebkitMaskImage: mask,
              maskComposite: masks.length > 1 ? 'intersect' : undefined,
              WebkitMaskComposite: masks.length > 1 ? 'source-in' : undefined,
            }}>
            <img
              src={view.frames[cell.frame].url}
              alt=""
              draggable={false}
              width={PICTURE_WIDTH}
              height={layout.pictureHeights[cell.frame]}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                maxWidth: 'none',
                transformOrigin: '0 0',
                transform: `matrix(${cell.picture.join(',')})`,
              }}
            />
            {gain ? <GainPiece gain={gain} /> : null}
          </div>
        );
      })}
    </div>
  );
});

/** What the astronaut stands in: a photograph of the site, or the frames of this very place. */
type Scene = { id: string; panorama: Panorama; place: PlaceView | null };

/**
 * A real 360-degree photograph seen from where it was taken. Turning the heading turns the view
 * all the way round. When the walk moves on to another photograph, a short cut carries the
 * astronaut there.
 *
 * With `place`, the view is the one a rover had from where the astronaut stands now, built from
 * its frames and lined up with the compass. It takes the stage while it is given.
 */
export function PanoramaView({
  panorama,
  place = null,
  heading,
  pitch,
  size,
  advance = 0,
  still = false,
}: PanoramaViewProps) {
  const wantedId = place ? place.id : panorama.nasaId;
  // The scene on screen, which lags the one asked for by half a cut.
  const [scene, setScene] = useState<Scene>({ id: wantedId, panorama, place });
  // How far into the scene on screen the view is. It follows the walk while the walk is in that
  // scene; when the walk has moved on and the cut is still leaving, it holds where it was, so the
  // view does not spring back before the dust covers it.
  const [depth, setDepth] = useState({ id: wantedId, advance });
  if (scene.id === wantedId && (depth.id !== wantedId || depth.advance !== advance)) {
    setDepth({ id: wantedId, advance });
  }
  // How far through the cut, 0 to 1, or null when standing in a scene.
  const [cut, setCut] = useState<number | null>(null);
  // The scene the walk last asked for, so one request starts one cut.
  const asked = useRef(wantedId);

  useEffect(() => {
    const id = place ? place.id : panorama.nasaId;
    if (asked.current === id) return;
    asked.current = id;
    // Fetch the next picture while the dust is still rising. The frames of a place are already
    // in the browser when the place is handed over.
    if (!place) {
      const next = new Image();
      next.src = panoramaUrl(panorama, false);
    }

    const started = performance.now();
    let frame = 0;
    let swapped = false;
    const step = (time: number) => {
      // The first frame can carry a time from before the cut was asked for.
      const t = Math.min(1, Math.max(0, (time - started) / CUT_MS));
      if (!swapped && t >= 0.5) {
        swapped = true;
        setScene({ id, panorama, place });
      }
      setCut(t < 1 ? t : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [panorama, place]);

  const radius = eyeDistance(size);
  const wideScreen = size.width >= 900;
  const mosaic = scene.place ? null : scene.panorama;

  // The full picture is several megabytes. The light one is shown at once and the full one takes
  // its place when the browser has it.
  const [sharp, setSharp] = useState<string | null>(null);
  useEffect(() => {
    if (!wideScreen || !mosaic) return;
    let wanted = true;
    const full = new Image();
    full.src = panoramaUrl(mosaic, true);
    // Wait until it is decoded, not just downloaded, or the view goes blank during the swap.
    full
      .decode()
      .then(() => {
        if (wanted) setSharp(mosaic.nasaId);
      })
      .catch(() => {
        // The full picture did not arrive or is too large for this device: stay on the light one.
      });
    return () => {
      wanted = false;
    };
  }, [mosaic, wideScreen]);

  // The sky drawn in the gaps of a mosaic waits for the light picture, or it would show on its
  // own, as a patch in an empty view, while the picture loads.
  const [arrived, setArrived] = useState<string | null>(null);
  const gapped = (mosaic?.skyGaps ?? []).length > 0;
  useEffect(() => {
    if (!gapped || !mosaic) return;
    let wanted = true;
    const light = new Image();
    light.src = panoramaUrl(mosaic, false);
    light
      .decode()
      .then(() => {
        if (wanted) setArrived(mosaic.nasaId);
      })
      .catch(() => {
        // No picture, so nothing to patch.
      });
    return () => {
      wanted = false;
    };
  }, [mosaic, gapped]);

  // Leaving: drift on into the scene while the dust rises. Arriving: settle as it clears.
  const leaving = cut !== null && cut < 0.5;
  const part = cut === null ? 0 : leaving ? cut / 0.5 : (cut - 0.5) / 0.5;
  const cutPush =
    cut === null ? 0 : leaving ? ease(part) * PUSH_OUT : -(1 - ease(part)) * PUSH_IN;
  // Held still, the picture stays where it is and only the dust fades over it and away.
  const push = still ? 0 : Math.min(1, Math.max(0, depth.advance)) * DEPTH + cutPush;
  const dust = cut === null ? 0 : leaving ? part ** 1.4 : (1 - part) ** 1.4;

  // A place is lined up with the compass: turning to a heading shows what lies that way.
  const turned = mosaic ? headingToFraction(mosaic, heading) * 360 : heading;
  const ahead = mosaic ? Math.floor(headingToFraction(mosaic, heading) * STRIPS) % STRIPS : 0;
  // To the nearest twelve degrees, so the pieces of a place are picked again only now and then.
  const facing = (Math.round(heading / 12) * 12) % 360;

  return (
    <div
      role="img"
      aria-label={
        scene.place
          ? `The view from the rover stop nearest to here: frames taken by the navigation camera of the rover on sol ${scene.place.stop.sol}. Real photographs, lined up with the compass; drag to look around.`
          : `${scene.panorama.caption}. A real 360-degree photograph; drag to look around.`
      }
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // What shows through the hairline between two strips: sky, where it is least noticed.
        background: scene.place ? PLACE_GROUND : scene.panorama.sky,
        perspective: `${radius}px`,
        pointerEvents: 'none',
      }}>
      <style>{'@keyframes armstrong-fade { from { opacity: 0 } to { opacity: 1 } }'}</style>
      <div
        key={scene.id}
        style={{
          position: 'absolute',
          left: size.width / 2,
          top: size.height / 2,
          transformStyle: 'preserve-3d',
          transform: `translateZ(${radius * (1 + push)}px) rotateX(${pitch}deg) rotateY(${turned}deg)`,
        }}>
        {scene.place ? (
          <Place view={scene.place} radius={radius} ahead={facing} />
        ) : (
          <>
            <Cylinder
              panorama={scene.panorama}
              radius={radius}
              wideScreen={false}
              fading={false}
              ahead={ahead}
              patched={arrived === scene.panorama.nasaId}
            />
            {/* The full picture fades in over the light one, which stays until it is painted. */}
            {wideScreen && sharp === scene.panorama.nasaId ? (
              <Cylinder
                panorama={scene.panorama}
                radius={radius}
                wideScreen
                fading
                ahead={ahead}
                patched
              />
            ) : null}
          </>
        )}
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
