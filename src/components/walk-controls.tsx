import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionHeading } from '@/components/console-parts';
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
      return `Working at waypoint ${(progress.stop ?? 0) + 1}, ${formatDuration(progress.phaseHoursLeft)} of work left, played fast.`;
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
      <SectionHeading
        title={clock === null ? 'SIMULATED WALK · READY' : 'SIMULATED WALK · IN PROGRESS'}
        color={clock === null ? Colors.textMuted : Colors.go}
      />

      {clock === null ? (
        <View style={[styles.card, { borderLeftColor: Colors.borderStrong }]}>
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
        </View>
      ) : (
        <View style={[styles.card, { borderLeftColor: over ? Colors.textMuted : Colors.go }]}>
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

          <View style={styles.rates} accessibilityRole="radiogroup">
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
        </View>
      )}

      <Link
        href={{ pathname: '/visor/[id]', params: { id: siteId } }}
        target="_blank"
        style={styles.visor}
        accessibilityRole="link"
        accessibilityLabel="Open the astronaut visor in a new tab">
        Astronaut visor {'↗'}
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surfaceRaised,
  },
  note: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  status: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  mono: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  meter: {
    height: 7,
    borderRadius: Radius.small,
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
  rates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rateLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingRight: Spacing.one,
  },
  rate: {
    flexGrow: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rateChosen: {
    borderColor: Colors.nav,
    backgroundColor: Colors.navTint,
  },
  rateText: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rateTextChosen: {
    color: Colors.text,
  },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  buttonPrimary: {
    borderColor: Colors.go,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
  },
  buttonPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  buttonTextPrimary: {
    color: Colors.go,
  },
  visor: {
    color: Colors.cyan,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Colors.cyan,
    backgroundColor: Colors.surface,
  },
});
