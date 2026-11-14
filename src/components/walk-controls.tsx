import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { CLOCK_RATES, type WalkClock } from '@/mission/clock';
import { formatDistance, formatDuration } from '@/mission/format';
import type { WalkPhase, WalkProgress } from '@/mission/progress';

type WalkControlsProps = {
  siteId: string;
  /** How many waypoints the route has; a walk needs at least one. */
  stops: number;
  /** The clock of the walk, or null before it starts. */
  clock: WalkClock | null;
  progress: WalkProgress;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onRate: (rate: number) => void;
};

function describe(phase: WalkPhase, progress: WalkProgress, over: boolean): string {
  if (over) return 'Back at the base. The walk is over.';
  switch (phase) {
    case 'walking':
      return `Walking to waypoint ${(progress.stop ?? 0) + 1}, ${formatDistance(progress.distanceToTargetM)} to go.`;
    case 'working':
      return `Working at waypoint ${(progress.stop ?? 0) + 1}, ${formatDuration(progress.phaseHoursLeft)} of work left.`;
    case 'returning':
      return `Returning to the base, ${formatDistance(progress.distanceToTargetM)} to go.`;
    case 'at-base':
      return 'At the base.';
  }
}

const rateLabel = (rate: number) => (rate === 1 ? 'Real time' : `${rate}x`);

/**
 * Starts and runs the simulated walk. The ship owns the walk: it starts, pauses and ends it, and
 * the astronaut's visor, in another tab or on another screen, follows.
 */
export function WalkControls({
  siteId,
  stops,
  clock,
  progress,
  onStart,
  onPause,
  onResume,
  onEnd,
  onRate,
}: WalkControlsProps) {
  const over = clock !== null && progress.totalHours > 0 && progress.elapsedHours >= progress.totalHours;
  const share = progress.totalHours > 0 ? progress.elapsedHours / progress.totalHours : 0;

  return (
    <View style={styles.block}>
      <Text style={styles.heading} accessibilityRole="header">
        SIMULATED WALK
      </Text>

      {clock === null ? (
        <>
          <Text style={styles.note}>
            {stops === 0
              ? 'Add a waypoint on the map, then start the walk.'
              : 'An astronaut walks the route at the assumed speed. Their position is simulated.'}
          </Text>
          <Button
            label="Start the walk"
            text="Start the walk"
            primary
            onPress={onStart}
            disabled={stops === 0}
          />
        </>
      ) : (
        <>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {describe(progress.phase, progress, over)}
          </Text>
          <View
            style={styles.meter}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Walk time: ${formatDuration(progress.elapsedHours)} of ${formatDuration(progress.totalHours)}`}>
            <View style={[styles.meterFill, { width: `${Math.min(1, share) * 100}%` }]} />
          </View>
          <Text style={styles.mono}>
            {formatDuration(progress.elapsedHours)} of {formatDuration(progress.totalHours)}
            {'  ·  '}
            {formatDistance(progress.walkedM)} walked
          </Text>

          <View style={styles.row}>
            {over ? null : clock.running ? (
              <Button label="Pause the walk" text="Pause" onPress={onPause} />
            ) : (
              <Button label="Resume the walk" text="Resume" primary onPress={onResume} />
            )}
            <Button label="End the walk and unlock the route" text="End" onPress={onEnd} />
          </View>

          <View style={styles.row} accessibilityRole="radiogroup">
            <Text style={styles.rateLabel}>Speed</Text>
            {CLOCK_RATES.map((rate) => {
              const chosen = clock.rate === rate;
              return (
                <Pressable
                  key={rate}
                  onPress={() => onRate(rate)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen }}
                  accessibilityLabel={`Walk speed: ${rateLabel(rate)}`}
                  style={[styles.rate, chosen && styles.rateChosen]}>
                  <Text style={[styles.rateText, chosen && styles.rateTextChosen]}>
                    {rateLabel(rate)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>The route is locked while the walk runs.</Text>
        </>
      )}

      <Link
        href={{ pathname: '/visor/[id]', params: { id: siteId } }}
        target="_blank"
        style={styles.visor}
        accessibilityRole="link"
        accessibilityLabel="Open the astronaut visor in a new tab">
        Open the astronaut visor {'↗'}
      </Link>
      <Text style={styles.note}>
        The visor opens in another tab and follows the walk from there.
      </Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  text: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
};

function Button({ label, text, onPress, primary, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  heading: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  note: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  status: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  mono: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  meter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: Colors.nav,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rateLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    paddingRight: Spacing.one,
  },
  rate: {
    minHeight: 36,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rateChosen: {
    borderColor: Colors.nav,
    backgroundColor: 'rgba(76, 141, 255, 0.18)',
  },
  rateText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  rateTextChosen: {
    color: Colors.text,
  },
  button: {
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  buttonPrimary: {
    borderColor: Colors.go,
    backgroundColor: 'rgba(61, 214, 140, 0.16)',
  },
  buttonPressed: {
    backgroundColor: Colors.border,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: Colors.go,
  },
  visor: {
    color: Colors.nav,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.two + Spacing.one,
    minHeight: 44,
  },
});
