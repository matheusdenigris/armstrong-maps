/**
 * The plan of the walk, stop by stop: what each waypoint is, how long the work there takes and
 * what the work is. Also the tools that act on the whole plan (a link to share it, a way round
 * steep ground) and the profile of the ground along it.
 */
import { useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDistance, formatDuration, formatHeight } from '@/mission/format';
import type { RouteProfile } from '@/mission/terrain';
import { MAX_STOP_MINUTES, WALK_ASSUMPTIONS, stopMinutes, type WalkStop } from '@/mission/walk';
import { STOP_STEP_MINUTES } from '@/state/mission';

/** What a stop is called: its own name, or its place in the walk. */
export const stopName = (stop: WalkStop, index: number) => stop.name ?? `Waypoint ${index + 1}`;

const minutesText = (minutes: number) =>
  minutes === 0 ? 'Pass through' : formatDuration(minutes / 60);

type RouteStopsProps = {
  stops: readonly WalkStop[];
  /** The route cannot change while a walk runs. */
  locked: boolean;
  /** The stop being walked to or worked at, while a walk runs. */
  current?: number | null;
  onMinutes: (index: number, minutes: number) => void;
  onTask: (index: number, task: string) => void;
  onRemove: (index: number) => void;
};

/** Every stop of the plan, with its time and its task. */
export function RouteStops({ stops, locked, current, onMinutes, onTask, onRemove }: RouteStopsProps) {
  if (stops.length === 0) return null;
  const workHours = stops.reduce((sum, stop) => sum + stopMinutes(stop), 0) / 60;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          PLAN · STOP BY STOP
        </Text>
        <Text style={styles.tally}>{formatDuration(workHours)} of work</Text>
      </View>
      {stops.map((stop, index) => {
        const minutes = stopMinutes(stop);
        const name = stopName(stop, index);
        return (
          <View
            key={`${index}:${stop.lat}:${stop.lon}`}
            style={[styles.stop, current === index && styles.stopCurrent]}>
            <View style={styles.stopTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stopName} numberOfLines={2}>
                {name}
              </Text>
              {locked ? null : (
                <Pressable
                  onPress={() => onRemove(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name} from the walk`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              )}
            </View>
            {stop.source ? <Text style={styles.source}>{stop.source}</Text> : null}

            <View style={styles.timeRow}>
              <Text style={styles.label}>Work here</Text>
              {locked ? (
                <Text style={styles.time}>{minutesText(minutes)}</Text>
              ) : (
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => onMinutes(index, minutes - STOP_STEP_MINUTES)}
                    disabled={minutes <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Less time at ${name}`}
                    style={({ pressed }) => [
                      styles.step,
                      pressed && styles.pressed,
                      minutes <= 0 && styles.disabled,
                    ]}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.time} accessibilityLiveRegion="polite">
                    {minutesText(minutes)}
                  </Text>
                  <Pressable
                    onPress={() => onMinutes(index, minutes + STOP_STEP_MINUTES)}
                    disabled={minutes >= MAX_STOP_MINUTES}
                    accessibilityRole="button"
                    accessibilityLabel={`More time at ${name}`}
                    style={({ pressed }) => [
                      styles.step,
                      pressed && styles.pressed,
                      minutes >= MAX_STOP_MINUTES && styles.disabled,
                    ]}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {locked ? (
              stop.task ? (
                <Text style={styles.task}>{stop.task}</Text>
              ) : null
            ) : (
              <TextInput
                value={stop.task ?? ''}
                onChangeText={(text) => onTask(index, text)}
                placeholder="What is done here"
                placeholderTextColor={Colors.textFaint}
                accessibilityLabel={`Task at ${name}`}
                maxLength={200}
                multiline
                style={styles.input}
              />
            )}
          </View>
        );
      })}
      <Text style={styles.note}>
        {locked
          ? 'The plan is locked while the walk runs.'
          : `A stop without a time of its own takes ${WALK_ASSUMPTIONS.minutesPerStop} min, a project assumption. Every minute counts against life support. Drag a waypoint on the map to move it.`}
      </Text>
    </View>
  );
}

type PlanToolsProps = {
  /** The address that opens this plan, or null when there is no plan to share. */
  link: string | null;
  /** Looks for a way round steep ground. Absent when the route does not cross any. */
  onReroute?: () => void;
  /** What the last search for a way round found. */
  rerouted?: string | null;
};

/** What acts on the whole plan: a link that reproduces it, and a way round steep ground. */
export function PlanTools({ link, onReroute, rerouted }: PlanToolsProps) {
  const [shared, setShared] = useState<'copied' | 'shown' | null>(null);
  if (!link && !onReroute && !rerouted) return null;

  const share = async () => {
    if (!link) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(link);
        setShared('copied');
      } else {
        await Share.share({ message: link });
      }
    } catch {
      // The clipboard is closed to this page: show the link so it can be copied by hand.
      setShared('shown');
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.tools}>
        {link ? (
          <Pressable
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel="Copy a link that opens this plan on another device"
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Text style={styles.toolText}>{shared === 'copied' ? 'Link copied' : 'Share the plan'}</Text>
          </Pressable>
        ) : null}
        {onReroute ? (
          <Pressable
            onPress={onReroute}
            accessibilityRole="button"
            accessibilityLabel="Look for a way round the steep ground under the route"
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Text style={styles.toolText}>Avoid steep ground</Text>
          </Pressable>
        ) : null}
      </View>
      {shared === 'shown' && link ? (
        <Text style={styles.link} selectable>
          {link}
        </Text>
      ) : null}
      {link ? (
        <Text style={styles.note}>
          The link carries the plan itself: the stops, their times and tasks. Nothing is sent to a
          server.
        </Text>
      ) : null}
      {rerouted ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {rerouted}
        </Text>
      ) : null}
    </View>
  );
}

type SharedPlanOfferProps = {
  stops: number;
  distanceM: number;
  /** A walk is running, so the plan cannot be replaced now. */
  locked: boolean;
  onLoad: () => void;
  onDismiss: () => void;
};

/** A plan that came in the link, when this device already has a different one. */
export function SharedPlanOffer({ stops, distanceM, locked, onLoad, onDismiss }: SharedPlanOfferProps) {
  return (
    <View style={styles.section}>
      <View style={styles.offer}>
        <Text style={styles.offerTitle}>This link carries a walk plan</Text>
        <Text style={styles.note}>
          {stops} {stops === 1 ? 'stop' : 'stops'}, {formatDistance(distanceM)} out and back.{' '}
          {locked
            ? 'End the walk in progress to load it.'
            : 'Loading it replaces the plan this device has for this site.'}
        </Text>
        <View style={styles.tools}>
          <Pressable
            onPress={onLoad}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Load the shared plan"
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.primaryPressed,
              locked && styles.disabled,
            ]}>
            <Text style={styles.primaryText}>Load the plan</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep the plan this device has"
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
            <Text style={styles.toolText}>Keep mine</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CHART_HEIGHT = 96;
const CHART_PAD = 6;

type ElevationProfileProps = {
  /** Null while the elevation model has not answered. */
  profile: RouteProfile | null;
  /** False when the model failed: there is no profile to wait for. */
  pending: boolean;
  /** How far along the route each stop is, in metres. */
  stopsAtM: readonly number[];
  /** The elevation models the heights were read from. */
  models: string;
};

/** The height of the ground along the route, out and back, with how much it climbs. */
export function ElevationProfile({ profile, pending, stopsAtM, models }: ElevationProfileProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const known = profile && profile.lowestM !== null && profile.highestM !== null;

  let line = '';
  let area = '';
  if (profile && known && width > 0 && profile.totalM > 0) {
    const low = profile.lowestM as number;
    // A flat route still gets a line: a metre of range keeps the division safe.
    const range = Math.max(1, (profile.highestM as number) - low);
    const x = (distanceM: number) => (distanceM / profile.totalM) * width;
    const y = (heightM: number) =>
      CHART_HEIGHT - CHART_PAD - ((heightM - low) / range) * (CHART_HEIGHT - CHART_PAD * 2);
    let open = false;
    let startX = 0;
    let lastX = 0;
    for (const sample of profile.samples) {
      if (sample.heightM === null) {
        // A gap in the model is a gap in the line, never a guess.
        if (open) area += `L${lastX.toFixed(1)},${CHART_HEIGHT} L${startX.toFixed(1)},${CHART_HEIGHT} Z `;
        open = false;
        continue;
      }
      const px = x(sample.distanceM);
      const py = y(sample.heightM);
      if (!open) {
        line += `M${px.toFixed(1)},${py.toFixed(1)} `;
        area += `M${px.toFixed(1)},${py.toFixed(1)} `;
        startX = px;
        open = true;
      } else {
        line += `L${px.toFixed(1)},${py.toFixed(1)} `;
        area += `L${px.toFixed(1)},${py.toFixed(1)} `;
      }
      lastX = px;
    }
    if (open) area += `L${lastX.toFixed(1)},${CHART_HEIGHT} L${startX.toFixed(1)},${CHART_HEIGHT} Z`;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          ELEVATION PROFILE
        </Text>
        <Text style={styles.tally}>
          {profile ? formatDistance(profile.totalM) : pending ? 'Reading the ground' : 'No model'}
        </Text>
      </View>
      {!profile || !known ? (
        <Text style={styles.note}>
          {pending
            ? 'Waiting for the elevation model.'
            : 'The elevation model has no height under this route, so there is no profile to show.'}
        </Text>
      ) : (
        <>
          <View
            style={styles.chart}
            onLayout={onLayout}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Elevation along the route: ${formatHeight(profile.lowestM as number)} to ${formatHeight(profile.highestM as number)}, ${Math.round(profile.ascentM ?? 0)} metres of climb.`}>
            {width > 0 ? (
              <Svg width={width} height={CHART_HEIGHT}>
                <Path d={area} fill={Colors.nav} fillOpacity={0.22} />
                <Path d={line} stroke={Colors.nav} strokeWidth={2} fill="none" />
                {stopsAtM.map((at, index) => {
                  const px = profile.totalM > 0 ? (at / profile.totalM) * width : 0;
                  return (
                    <Line
                      key={index}
                      x1={px}
                      x2={px}
                      y1={0}
                      y2={CHART_HEIGHT}
                      stroke={Colors.glassBorder}
                      strokeWidth={1}
                    />
                  );
                })}
              </Svg>
            ) : null}
          </View>
          <View style={styles.ends}>
            <Text style={styles.end}>Base</Text>
            <Text style={styles.end}>
              {stopsAtM.length} {stopsAtM.length === 1 ? 'stop' : 'stops'} marked
            </Text>
            <Text style={styles.end}>Base</Text>
          </View>
          <View style={styles.figures}>
            <Figure label="Climb" value={`${Math.round(profile.ascentM ?? 0)} m`} />
            <Figure label="Descent" value={`${Math.round(profile.descentM ?? 0)} m`} />
            <Figure label="Lowest" value={formatHeight(profile.lowestM as number)} />
            <Figure label="Highest" value={formatHeight(profile.highestM as number)} />
          </View>
          <Text style={styles.note}>
            {models}.{' '}
            {profile.cellM !== null
              ? `Heights are read every ${formatDistance(profile.cellM)} or less, so a rise smaller than that does not show and the real climb is at least this. `
              : ''}
            {profile.covered < 0.995
              ? `The model has no height under ${Math.round((1 - profile.covered) * 100)}% of the route: the line breaks there. `
              : ''}
            The climb does not slow the simulated walk.
          </Text>
        </>
      )}
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heading: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  tally: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  stop: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    backgroundColor: Colors.glassLight,
  },
  stopCurrent: {
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassHover,
  },
  stopTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.nav,
  },
  badgeText: {
    color: Colors.white,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  stopName: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    marginVertical: -Spacing.two,
    marginRight: -Spacing.two,
  },
  removeText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 20,
  },
  source: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  step: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  stepText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 24,
  },
  time: {
    minWidth: 92,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    textAlign: 'center',
  },
  task: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: Colors.glassLight,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tool: {
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  toolText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  primary: {
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryText: {
    color: Colors.background,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  pressed: {
    backgroundColor: Colors.glassHover,
  },
  disabled: {
    opacity: 0.4,
  },
  link: {
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: Colors.glassLight,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  offer: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.cautionTint,
  },
  offerTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  chart: {
    height: CHART_HEIGHT,
    borderRadius: Radius.medium,
    backgroundColor: Colors.glassLight,
    overflow: 'hidden',
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  end: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  figure: {
    width: '48.6%',
    gap: Spacing.one,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.medium,
    backgroundColor: Colors.glassLight,
  },
  figureValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
});
