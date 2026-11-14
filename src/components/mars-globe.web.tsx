import { useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

import { startGlobe, type GlobeEngine } from './globe/engine';
import type { MarsGlobeProps } from './globe/types';

export type { GlobeHandle } from './globe/types';

export const GLOBE_AVAILABLE = true;

/**
 * Mars from orbit. Drag to turn it, pinch or use the wheel to move in, and pick a landing site.
 * The landing-site markers are the selectable regions with high-resolution mosaics.
 */
export function MarsGlobe({ sites, onOpen, onHover, ref }: MarsGlobeProps) {
  const host = useRef<ComponentRef<typeof View>>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const engine = useRef<GlobeEngine | null>(null);
  const open = useRef(onOpen);
  const hover = useRef(onHover);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    open.current = onOpen;
    hover.current = onHover;
  }, [onOpen, onHover]);

  useImperativeHandle(ref, () => ({ flyTo: (site) => engine.current?.flyTo(site) }), []);

  useEffect(() => {
    const element = host.current as unknown as HTMLElement | null;
    if (!element) return;
    let started: GlobeEngine;
    try {
      started = startGlobe(element, sites, {
        onOpen: (site) => open.current(site),
        labelOf: (id) => labels.current.get(id),
        onHover: (site) => hover.current?.(site),
      });
    } catch {
      // No WebGL here (an old browser, or the GPU is blocked): say so instead of a blank box.
      queueMicrotask(() => setFailed(true));
      return;
    }
    engine.current = started;
    return () => {
      started.stop();
      engine.current = null;
    };
  }, [sites]);

  return (
    <View
      ref={host}
      style={styles.host}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Globe of Mars. Drag to turn it and pick a landing site, or use the list of sites.">
      {failed ? (
        <Text style={styles.failed}>
          This browser cannot draw the 3D globe. Choose a landing site from the list.
        </Text>
      ) : (
        sites.map((site) => (
          <Pressable
            key={site.id}
            nativeID={`globe-label-${site.id}`}
            ref={(node) => {
              const element = node as unknown as HTMLElement | null;
              if (element) labels.current.set(site.id, element);
              else labels.current.delete(site.id);
            }}
            // The list of sites is the accessible way in; these repeat it for the pointer.
            accessible={false}
            tabIndex={-1}
            onPress={() => engine.current?.flyTo(site)}
            onHoverIn={() => onHover?.(site)}
            onHoverOut={() => onHover?.(null)}
            style={[styles.label, BLUR]}>
            <Text style={styles.labelText} numberOfLines={1}>
              {site.name}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

/** The planet shows softly through a label. */
const BLUR = {
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
} as ViewStyle;

const styles = StyleSheet.create({
  host: {
    flex: 1,
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Hidden until the first frame places it.
    opacity: 0,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassDark,
  },
  labelText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  failed: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    padding: Spacing.four,
    margin: 'auto',
    maxWidth: 320,
  },
});
