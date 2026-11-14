import { Image } from 'expo-image';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { tileUrl, type MapLayer } from '@/data/layers';
import {
  nearestInReach,
  project,
  unproject,
  limitsForSurfaceFrame,
  visibleBounds,
  type MapView,
  type Pixel,
  type ScaleLimits,
  type Size,
} from '@/mission/camera';
import { METRES_PER_DEGREE, type LatLon } from '@/mission/geo';
import { tileBounds, tilesFor, type TileAddress } from '@/mission/tiles';

import { MapController, ZOOM_STEP, openingCamera } from './map-controller';

export type MapMarker = {
  id: string;
  point: LatLon;
  label: string;
  color?: string;
};

/** A line through places on the map: a planned route, a rover traverse. */
export type MapPath = {
  id: string;
  points: readonly LatLon[];
  color: string;
  width?: number;
  dashed?: boolean;
};

/** A circle of a given radius on the ground around a place. */
export type MapRing = {
  id: string;
  centre: LatLon;
  radiusM: number;
  color: string;
};

/**
 * A small mark at a published place, such as a sample site. A press on it reports its id
 * instead of a press on the ground.
 */
export type MapPoint = {
  id: string;
  point: LatLon;
  color: string;
  /** Its name, shown under a mouse pointer. */
  label: string;
};

/** A card held beside a place on the map, which follows it as the map moves. */
export type MapCard = {
  point: LatLon;
  content: ReactNode;
};

/** How close to a mark, in pixels, a press or a pointer counts as on it. */
const POINT_REACH = 18;
const CARD_WIDTH = 264;
const CARD_GAP = 14;
const CARD_MARGIN = 8;

/**
 * What a press on the map would add, shown under the pointer before the press: a line from
 * `from` to the pointer, and two lines of text about the place under it.
 */
export type MapPreview = {
  from: LatLon;
  color: string;
  describe: (to: LatLon) => { title: string; detail: string };
};

type SurfaceMapProps = {
  /** Drawn from the bottom up. */
  layers: readonly MapLayer[];
  /** Opacity of a layer, by id. A layer that is not listed is opaque. */
  opacity?: Readonly<Record<string, number>>;
  /** Where the map opens, and where the recentre button returns to. */
  home: MapView;
  limits: ScaleLimits;
  markers?: readonly MapMarker[];
  paths?: readonly MapPath[];
  rings?: readonly MapRing[];
  /** Published places, drawn as small marks under the markers. */
  points?: readonly MapPoint[];
  /** The mark that is chosen, ringed on the map. */
  chosenPoint?: string | null;
  /** A press on a mark. Without it, a press on a mark is a press on the ground. */
  onPointPress?: (id: string) => void;
  /** What is shown beside the chosen mark. */
  card?: MapCard | null;
  /** Called with the current view, at most once per frame. */
  onViewChange?: (view: MapView) => void;
  /** A single tap on the map (not a drag, not a double tap). */
  onPress?: (point: LatLon) => void;
  /** Shown under a mouse pointer, where there is one. Null when a press would add nothing. */
  preview?: MapPreview | null;
  accessibilityLabel: string;
  /** Room to leave under the zoom buttons, for whatever the screen puts at the bottom. */
  controlsBottom?: number;
  children?: ReactNode;
};

const NO_POINTS: readonly MapPoint[] = [];
const webOnly = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);
const LAYER_REVEAL_MS = 160;

const sameView = (left: MapView, right: MapView) =>
  left.lat === right.lat &&
  left.lon === right.lon &&
  left.pixelsPerDegree === right.pixelsPerDegree;

const sameCamera = (
  left: { view: MapView; base: MapView },
  right: { view: MapView; base: MapView },
) => sameView(left.view, right.view) && sameView(left.base, right.base);

/**
 * A map of Mars that is dragged with one finger and pinched with two. On the web the mouse drags
 * and the wheel zooms. Tiles are equirectangular, so the map is too.
 */
export function SurfaceMap({
  layers,
  opacity,
  home,
  limits,
  markers = [],
  paths = [],
  rings = [],
  points = NO_POINTS,
  chosenPoint = null,
  onPointPress,
  card = null,
  onViewChange,
  onPress,
  preview = null,
  accessibilityLabel,
  controlsBottom = Spacing.three,
  children,
}: SurfaceMapProps) {
  const [size, setSize] = useState<Size | null>(null);
  const [camera, setCamera] = useState(() => openingCamera(home, limits));
  const [reduceMotion, setReduceMotion] = useState(false);

  const node = useRef<ComponentRef<typeof View>>(null);
  const controller = useRef<MapController | null>(null);
  const origin = useRef<Pixel>({ x: 0, y: 0 });
  const frameLimits = useMemo(
    () => (size ? limitsForSurfaceFrame(limits, size) : limits),
    [limits, size],
  );

  // A press on a mark goes to the mark; any other press is a press on the ground.
  const press = useCallback(
    (place: LatLon) => {
      const view = controller.current?.currentCamera().view;
      if (onPointPress && view && size && points.length > 0) {
        const hit = nearestInReach(view, size, points, project(view, size, place), POINT_REACH);
        if (hit) {
          onPointPress(hit.id);
          return;
        }
      }
      onPress?.(place);
    },
    [onPointPress, onPress, points, size],
  );

  useEffect(() => {
    const options = {
      home,
      limits: frameLimits,
      reduceMotion,
      onCamera: setCamera,
      onViewChange,
      onPress: press,
    };
    if (controller.current) controller.current.configure(options);
    else controller.current = new MapController(options);
    if (size) controller.current.setSize(size);
  }, [frameLimits, home, reduceMotion, onViewChange, press, size]);

  // Keep the React copy of the camera in step when a resize raises the zoom-out floor.
  useEffect(() => {
    const next = controller.current?.currentCamera();
    if (!next) return;
    setCamera((previous) =>
      sameCamera(previous, next) ? previous : { view: next.view, base: next.base },
    );
  }, [frameLimits]);

  useEffect(() => () => controller.current?.dispose(), []);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  // The wheel zooms on the web, around the pointer.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = node.current as unknown as HTMLElement | null;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const pixels = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
      controller.current?.wheel(pixels, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  /** Finds where the map is in the window, to turn touch positions into map positions. */
  function locate() {
    const current = node.current;
    if (!current) return;
    if (Platform.OS === 'web') {
      const box = (current as unknown as HTMLElement).getBoundingClientRect();
      origin.current = { x: box.left, y: box.top };
    } else {
      current.measureInWindow((x, y) => {
        origin.current = { x, y };
      });
    }
  }

  const touchesOf = (event: GestureResponderEvent): Pixel[] =>
    event.nativeEvent.touches.map((touch) => ({
      x: touch.pageX - origin.current.x,
      y: touch.pageY - origin.current.y,
    }));

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    controller.current?.setSize({ width, height });
    setSize((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
    locate();
  }

  const { view, base } = camera;
  const atClosestZoom = view.pixelsPerDegree >= frameLimits.max;
  const atWidestZoom = view.pixelsPerDegree <= frameLimits.min;
  const zoom = view.pixelsPerDegree / base.pixelsPerDegree;
  // Maps the tile plane, laid out for `base`, onto the current view.
  const planeStyle: ViewStyle | null = size && {
    transformOrigin: 'left top',
    transform: [
      { translateX: (size.width / 2) * (1 - zoom) + (base.lon - view.lon) * view.pixelsPerDegree },
      { translateY: (size.height / 2) * (1 - zoom) - (base.lat - view.lat) * view.pixelsPerDegree },
      { scale: zoom },
    ],
  };

  return (
    <View
      ref={node}
      style={[
        styles.map,
        // Cross hairs say that a press marks a point; an arrow that it does not.
        webOnly({
          touchAction: 'none',
          userSelect: 'none',
          cursor: preview ? 'crosshair' : 'default',
        }),
      ]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        locate();
        controller.current?.begin(touchesOf(event));
      }}
      onResponderMove={(event) => controller.current?.move(touchesOf(event))}
      onResponderRelease={() => controller.current?.end()}
      onResponderTerminate={() => controller.current?.end()}>
      {size && planeStyle && (
        <View style={[StyleSheet.absoluteFill, planeStyle]} pointerEvents="none">
          <TilePlane
            layers={layers}
            opacity={opacity}
            base={base}
            size={size}
            reduceMotion={reduceMotion}
          />
        </View>
      )}


      {size && (paths.length > 0 || rings.length > 0 || points.length > 0) && (
        <Svg width={size.width} height={size.height} style={styles.overlay} pointerEvents="none">
          {rings.map((ring) => {
            const at = project(view, size, ring.centre);
            const degrees = ring.radiusM / METRES_PER_DEGREE;
            // A degree of longitude is shorter than a degree of latitude away from the equator,
            // and the map gives both the same pixels, so a circle on the ground is drawn wider.
            const stretch = 1 / Math.cos((ring.centre.lat * Math.PI) / 180);
            return (
              <Ellipse
                key={ring.id}
                cx={at.x}
                cy={at.y}
                rx={degrees * stretch * view.pixelsPerDegree}
                ry={degrees * view.pixelsPerDegree}
                fill="none"
                stroke={ring.color}
                strokeWidth={1.5}
                strokeDasharray="6 6"
                opacity={0.9}
              />
            );
          })}
          {paths.map((path) => (
            <Polyline
              key={path.id}
              points={path.points
                .map((point) => {
                  const at = project(view, size, point);
                  return `${at.x.toFixed(1)},${at.y.toFixed(1)}`;
                })
                .join(' ')}
              fill="none"
              stroke={path.color}
              strokeWidth={path.width ?? 3}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={path.dashed ? '8 8' : undefined}
            />
          ))}
          {points.map((point) => {
            const at = project(view, size, point.point);
            // Marks off the screen are not drawn.
            if (at.x < -12 || at.y < -12 || at.x > size.width + 12 || at.y > size.height + 12) {
              return null;
            }
            const chosen = point.id === chosenPoint;
            return (
              <Circle
                key={point.id}
                cx={at.x}
                cy={at.y}
                r={chosen ? 7 : 5}
                fill={point.color}
                stroke={chosen ? Colors.white : Colors.background}
                strokeWidth={chosen ? 2.5 : 1.5}
              />
            );
          })}
        </Svg>
      )}

      {size &&
        markers.map((marker) => {
          const at = project(view, size, marker.point);
          return (
            <View
              key={marker.id}
              pointerEvents="none"
              style={[styles.marker, { left: at.x, top: at.y }]}>
              <View style={[styles.markerDot, { backgroundColor: marker.color ?? Colors.nav }]} />
              <Text style={styles.markerLabel} numberOfLines={1}>
                {marker.label}
              </Text>
            </View>
          );
        })}

      {size && preview && Platform.OS === 'web' ? (
        <PointerPreview
          host={node}
          view={view}
          size={size}
          preview={preview}
          points={onPointPress ? points : NO_POINTS}
        />
      ) : null}

      {children}

      <View style={[styles.controls, { bottom: controlsBottom }]}>
        <MapButton
          label="Zoom in"
          glyph="plus"
          onPress={() => controller.current?.zoomBy(ZOOM_STEP)}
          disabled={atClosestZoom}
        />
        <MapButton
          label="Zoom out"
          glyph="minus"
          onPress={() => controller.current?.zoomBy(1 / ZOOM_STEP)}
          disabled={atWidestZoom}
        />
        <MapButton
          label="Back to the landing site"
          glyph="target"
          onPress={() => controller.current?.recentre()}
          last
        />
      </View>

      {/* Last, so it lies over the readouts and the buttons that sit on the map. */}
      {size && card ? <CardAt view={view} size={size} card={card} /> : null}
    </View>
  );
}

type TilePlaneProps = {
  layers: readonly MapLayer[];
  opacity?: Readonly<Record<string, number>>;
  base: MapView;
  size: Size;
  reduceMotion?: boolean;
};

/**
 * Every layer in two passes: a coarse one over a wide area, so something is there while panning
 * and while sharp tiles load, and a sharp one over the screen.
 */
export const TilePlane = memo(function TilePlane({
  layers,
  opacity,
  base,
  size,
  reduceMotion = false,
}: TilePlaneProps) {
  // Phones pack two or three device pixels in a point; ask for a deeper level so tiles stay crisp.
  const density = Math.min(PixelRatio.get(), 2);
  const sharpArea = visibleBounds(base, size, 0.25);
  const wideArea = visibleBounds(base, size, 1);

  const place = (tile: TileAddress) => {
    const bounds = tileBounds(tile);
    const topLeft = project(base, size, { lat: bounds.north, lon: bounds.west });
    const bottomRight = project(base, size, { lat: bounds.south, lon: bounds.east });
    // Whole pixels, so neighbouring tiles share an edge instead of leaving a seam.
    const left = Math.round(topLeft.x);
    const top = Math.round(topLeft.y);
    return {
      left,
      top,
      width: Math.round(bottomRight.x) - left,
      height: Math.round(bottomRight.y) - top,
    };
  };

  return (
    <>
      {layers.map((layer) => {
        const sharp = tilesFor({
          maxLevel: layer.maxLevel,
          coverage: layer.coverage,
          view: sharpArea,
          pixelsPerDegree: base.pixelsPerDegree * density,
          limit: 60,
        });
        const sharpLevel = sharp[0]?.level ?? 0;
        const coarse = tilesFor({
          maxLevel: Math.max(0, sharpLevel - 2),
          coverage: layer.coverage,
          view: wideArea,
          pixelsPerDegree: base.pixelsPerDegree / 4,
          limit: 24,
        }).filter((tile) => tile.level < sharpLevel);
        return (
          <LayerTiles
            key={layer.id}
            layer={layer}
            tiles={[...coarse, ...sharp]}
            sharpLevel={sharpLevel}
            place={place}
            opacity={opacity?.[layer.id] ?? 1}
            animateIn={opacity?.[layer.id] !== undefined}
            reduceMotion={reduceMotion}
          />
        );
      })}
    </>
  );
});

const keyOf = (tile: TileAddress) => `${tile.level}/${tile.row}/${tile.col}`;

/** How long the tiles of the last view may stay under the new ones that have not all arrived. */
const HOLD_MS = 2500;
/** How many tiles of earlier views are kept at most. */
const HELD_AT_MOST = 120;

type LayerTilesProps = {
  layer: MapLayer;
  /** The tiles for the view as it is now, coarse ones first. */
  tiles: readonly TileAddress[];
  sharpLevel: number;
  opacity: number;
  place: (tile: TileAddress) => { left: number; top: number; width: number; height: number };
  animateIn: boolean;
  reduceMotion: boolean;
};

/**
 * The tiles of one layer. When the scale changes, the tiles of the scale before stay underneath
 * until the new sharp ones have arrived: the map goes from one sharpness to the next without
 * falling back to a blur, or to nothing, in between.
 */
function LayerTiles({
  layer,
  tiles,
  sharpLevel,
  opacity,
  place,
  animateIn,
  reduceMotion,
}: LayerTilesProps) {
  const signature = tiles.map(keyOf).join(' ');
  const [shown, setShown] = useState({ signature, tiles });
  const [held, setHeld] = useState<readonly TileAddress[]>([]);
  const [shownOpacity] = useState(
    () => new Animated.Value(animateIn && !reduceMotion ? 0 : opacity),
  );
  const hasEntered = useRef(!animateIn || reduceMotion);
  if (shown.signature !== signature) {
    // The view asked for other tiles: what was on screen is held, less what is asked for again.
    const coming = new Set(tiles.map(keyOf));
    const kept = new Map<string, TileAddress>();
    for (const tile of [...held, ...shown.tiles]) {
      if (!coming.has(keyOf(tile))) kept.set(keyOf(tile), tile);
    }
    setHeld([...kept.values()].slice(-HELD_AT_MOST));
    setShown({ signature, tiles });
  }

  // Which tiles have been drawn at least once; a tile that stays on screen does not report again.
  const arrived = useRef(new Set<string>());

  // Held tiles go in any case after a while: a tile that never answers must not pin them.
  useEffect(() => {
    if (held.length === 0) return;
    const timer = setTimeout(() => setHeld([]), HOLD_MS);
    return () => clearTimeout(timer);
  }, [held]);

  useEffect(() => {
    if (reduceMotion || !animateIn) {
      shownOpacity.stopAnimation();
      shownOpacity.setValue(opacity);
      hasEntered.current = true;
      return;
    }
    // The fade belongs to turning a layer on. Slider adjustments must follow the thumb directly.
    if (hasEntered.current) {
      shownOpacity.stopAnimation();
      shownOpacity.setValue(opacity);
      return;
    }
    hasEntered.current = true;
    const transition = Animated.timing(shownOpacity, {
      toValue: opacity,
      duration: LAYER_REVEAL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [animateIn, opacity, reduceMotion, shownOpacity]);

  const settle = (key: string) => {
    const seen = arrived.current;
    seen.add(key);
    const complete = tiles.every((tile) => tile.level !== sharpLevel || seen.has(keyOf(tile)));
    if (!complete) return;
    setHeld((previous) => (previous.length === 0 ? previous : []));
    if (seen.size > 600) {
      const drawn = new Set(tiles.map(keyOf));
      for (const entry of seen) if (!drawn.has(entry)) seen.delete(entry);
    }
  };

  // Finer tiles go over coarser ones, whichever view they came from.
  const drawn = [...held, ...tiles].sort((one, other) => one.level - other.level);

  // The layer fades as one sheet, so the coarse pass does not show through the sharp one.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: shownOpacity }]}>
      {drawn.map((tile) => {
        const key = keyOf(tile);
        return (
          <Image
            key={key}
            source={{ uri: tileUrl(layer, tile) }}
            style={[styles.tile, place(tile)]}
            contentFit="fill"
            cachePolicy="memory-disk"
            // A new tile comes in over the one under it, without a jump.
            transition={140}
            onLoad={() => settle(key)}
            onError={() => settle(key)}
            accessible={false}
          />
        );
      })}
    </Animated.View>
  );
}

type Glyph = 'plus' | 'minus' | 'target';
type PointerPreviewProps = {
  host: RefObject<ComponentRef<typeof View> | null>;
  view: MapView;
  size: Size;
  preview: MapPreview;
  /** Marks that answer a press: over one of them the preview names it instead. */
  points: readonly MapPoint[];
};

type CardAtProps = { view: MapView; size: Size; card: MapCard };

/**
 * A card beside its place: to the right of it and below where there is room, otherwise to the
 * left and above, and never past the edge of the map. It takes its own presses, so that a press
 * on the card is not a press on the ground under it.
 */
function CardAt({ view, size, card }: CardAtProps) {
  const at = project(view, size, card.point);
  // The card leaves with its place.
  if (at.x < 0 || at.y < 0 || at.x > size.width || at.y > size.height) return null;
  const width = Math.min(CARD_WIDTH, size.width - 2 * CARD_MARGIN);
  const furthestLeft = size.width - width - CARD_MARGIN;
  const right = at.x + CARD_GAP;
  const left = at.x - CARD_GAP - width;
  const x =
    right <= furthestLeft
      ? right
      : left >= CARD_MARGIN
        ? left
        : Math.min(furthestLeft, Math.max(CARD_MARGIN, at.x - width / 2));
  // The foot of the map is the busier end, so the card goes up from a little above the middle.
  const above = at.y > size.height * 0.4;
  return (
    <View
      role="dialog"
      onStartShouldSetResponder={() => true}
      style={[
        styles.card,
        { left: x, width },
        above ? { bottom: size.height - at.y + CARD_GAP } : { top: at.y + CARD_GAP },
        webOnly({ cursor: 'default' }),
      ]}>
      {card.content}
    </View>
  );
}

/**
 * The leg a press would add, drawn under the mouse pointer. It keeps the pointer's position to
 * itself, so that moving the mouse does not draw the whole map again.
 */
function PointerPreview({ host, view, size, preview, points }: PointerPreviewProps) {
  const [at, setAt] = useState<Pixel | null>(null);

  useEffect(() => {
    const element = host.current as unknown as HTMLElement | null;
    if (!element) return;
    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // Not while the map is being dragged, and not over a button that sits on the map.
      if (
        event.buttons !== 0 ||
        target?.closest('button, a, [role="button"], [role="dialog"]')
      ) {
        setAt(null);
        return;
      }
      const box = element.getBoundingClientRect();
      setAt({ x: event.clientX - box.left, y: event.clientY - box.top });
    };
    const onLeave = () => setAt(null);
    element.addEventListener('mousemove', onMove);
    element.addEventListener('mouseleave', onLeave);
    return () => {
      element.removeEventListener('mousemove', onMove);
      element.removeEventListener('mouseleave', onLeave);
    };
  }, [host]);

  if (!at) return null;
  const from = project(view, size, preview.from);
  // Over a mark, a press opens it: no leg is drawn, and the note names the mark.
  const mark = nearestInReach(view, size, points, at, POINT_REACH);
  const { title, detail } = mark
    ? { title: mark.label, detail: 'Click to see what NASA published here' }
    : preview.describe(unproject(view, size, at));
  // The text stays inside the map: left of the pointer near the right edge, above it near the foot.
  const left = at.x > size.width - 240;
  const above = at.y > size.height - 90;
  return (
    <>
      <Svg width={size.width} height={size.height} style={styles.overlay} pointerEvents="none">
        {mark ? null : (
          <Line
            x1={from.x}
            y1={from.y}
            x2={at.x}
            y2={at.y}
            stroke={preview.color}
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
            opacity={0.9}
          />
        )}
        <Circle
          cx={at.x}
          cy={at.y}
          r={7}
          fill={mark ? mark.color : preview.color}
          fillOpacity={0.35}
          stroke={Colors.white}
          strokeWidth={1.5}
        />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.previewNote,
          { left: at.x, top: at.y },
          {
            transform: [
              { translateX: left ? -Spacing.three : Spacing.three },
              { translateY: above ? -Spacing.three : Spacing.three },
            ],
          },
          left && styles.previewNoteLeft,
          above && styles.previewNoteAbove,
        ]}>
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.previewDetail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
    </>
  );
}

type MapButtonProps = {
  label: string;
  glyph: Glyph;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
};

function MapButton({ label, glyph, onPress, last = false, disabled = false }: MapButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        last && styles.buttonLast,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      <Svg
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        stroke={Colors.text}
        strokeWidth={2}
        strokeLinecap="round">
        {glyph !== 'target' && <Path d="M4 10h12" />}
        {glyph === 'plus' && <Path d="M10 4v12" />}
        {glyph === 'target' && (
          <>
            <Circle cx={10} cy={10} r={5} />
            <Path d="M10 1v4M10 15v4M1 10h4M15 10h4" />
          </>
        )}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.mapBackground,
  },
  tile: {
    position: 'absolute',
  },
  // The drawing needs its size as numbers; a style that fills the parent is not enough on the web.
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  marker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // The dot, not the corner of the row, sits on the point.
    marginLeft: -7,
    marginTop: -7,
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  markerLabel: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 12,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
    overflow: 'hidden',
  },
  // A point of no size at the pointer; the card hangs from one of its corners.
  previewNote: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  previewNoteLeft: {
    alignItems: 'flex-end',
  },
  previewNoteAbove: {
    justifyContent: 'flex-end',
  },
  card: {
    position: 'absolute',
  },
  previewCard: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  previewTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  previewDetail: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  controls: {
    position: 'absolute',
    right: Spacing.three,
    gap: 0,
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassStrong,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  buttonLast: {
    borderBottomWidth: 0,
  },
  buttonPressed: {
    backgroundColor: Colors.glassHover,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
});
