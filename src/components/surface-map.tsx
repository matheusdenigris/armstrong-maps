import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
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
import Svg, { Circle, Ellipse, Path, Polyline } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { tileUrl, type MapLayer } from '@/data/layers';
import {
  project,
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
  /** Called with the current view, at most once per frame. */
  onViewChange?: (view: MapView) => void;
  /** A single tap on the map (not a drag, not a double tap). */
  onPress?: (point: LatLon) => void;
  accessibilityLabel: string;
  /** Room to leave under the zoom buttons, for whatever the screen puts at the bottom. */
  controlsBottom?: number;
  children?: ReactNode;
};

const webOnly = (style: object) => (Platform.OS === 'web' ? (style as ViewStyle) : null);

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
  onViewChange,
  onPress,
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

  useEffect(() => {
    const options = {
      home,
      limits: frameLimits,
      reduceMotion,
      onCamera: setCamera,
      onViewChange,
      onPress,
    };
    if (controller.current) controller.current.configure(options);
    else controller.current = new MapController(options);
    if (size) controller.current.setSize(size);
  }, [frameLimits, home, reduceMotion, onViewChange, onPress, size]);

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
      style={[styles.map, webOnly({ touchAction: 'none', userSelect: 'none', cursor: 'default' })]}
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
          <TilePlane layers={layers} opacity={opacity} base={base} size={size} />
        </View>
      )}


      {size && (paths.length > 0 || rings.length > 0) && (
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
    </View>
  );
}

type TilePlaneProps = {
  layers: readonly MapLayer[];
  opacity?: Readonly<Record<string, number>>;
  base: MapView;
  size: Size;
};

/**
 * Every layer in two passes: a coarse one over a wide area, so something is there while panning
 * and while sharp tiles load, and a sharp one over the screen.
 */
export const TilePlane = memo(function TilePlane({ layers, opacity, base, size }: TilePlaneProps) {
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
        // The layer fades as one sheet, so the coarse pass does not show through the sharp one.
        return (
          <View
            key={layer.id}
            style={[StyleSheet.absoluteFill, { opacity: opacity?.[layer.id] ?? 1 }]}>
            {[...coarse, ...sharp].map((tile) => (
              <Image
                key={`${tile.level}/${tile.row}/${tile.col}`}
                source={{ uri: tileUrl(layer, tile) }}
                style={[styles.tile, place(tile)]}
                contentFit="fill"
                cachePolicy="memory-disk"
                transition={0}
                accessible={false}
              />
            ))}
          </View>
        );
      })}
    </>
  );
});

type Glyph = 'plus' | 'minus' | 'target';
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
