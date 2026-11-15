import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionHeading } from '@/components/console-parts';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { CLOCK_RATES, type WalkClock } from '@/mission/clock';
import { formatDistance, formatDuration } from '@/mission/format';
import type { WalkPhase, WalkProgress } from '@/mission/progress';
import { VISOR_READY_KEY } from '@/state/mission';

/** How long the console waits for the visor to load before it starts the walk anyway. */
const VISOR_WAIT_MS = 12_000;

type WalkControlsProps = {
  siteId: string;
  /** How many waypoints the route has; a walk needs at least one. */
  stops: number;
  /** The clock of the walk, or null before it starts. */
  clock: WalkClock | null;
  progress: WalkProgress;
  /** How the walk is started, shared with the verdict pills that start it too. */
  start: WalkStart;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onRate: (rate: number) => void;
  /** The stops of the walk, for the name of the one being walked to or worked at. */
  plan: readonly { name?: string }[];
  /** The walk was turned for the base before its plan was done. */
  turnedBack?: boolean;
  /** Replaces the rest of the walk with the shortest way back. */
  onReturn?: () => void;
};

function describe(
  phase: WalkPhase,
  progress: WalkProgress,
  over: boolean,
  place: string,
  turnedBack: boolean,
): string {
  if (over) return 'Back at the base. The walk is over.';
  switch (phase) {
    case 'walking':
      return `Walking to ${place}, ${formatDistance(progress.distanceToTargetM)} to go.`;
    case 'working':
      return `Working at ${place}, ${formatDuration(progress.phaseHoursLeft)} of work left, played fast.`;
    case 'returning':
      return turnedBack
        ? `Turned back: returning to the base by the shortest way, ${formatDistance(progress.distanceToTargetM)} to go. The rest of the plan was dropped.`
        : `Returning to the base, ${formatDistance(progress.distanceToTargetM)} to go.`;
    case 'at-base':
      return 'At the base.';
  }
}

const rateLabel = (rate: number) => (rate === 1 ? 'Real time' : `${rate}x`);

export type WalkStart = {
  /** The visor tab was asked for and the walk waits for it to load. */
  waiting: boolean;
  /** Opens the visor and starts the walk when it has loaded. */
  begin: () => void;
  /** Starts the walk at once, without waiting for the visor. */
  beginNow: () => void;
};

/**
 * Starting the walk also opens the visor, in its own tab: it is the other half of the walk, and
 * easy to miss as a link. The walk itself begins when that tab has loaded and said so, so that
 * nobody misses the first steps. A browser may refuse the tab: then the walk starts here at
 * once, and the link in the walk panel stays as the way in.
 *
 * One start serves every control that starts the walk: the button of the walk panel and the
 * verdict pills, which read GO and are pressed as if they were the button.
 */
export function useWalkStart(siteId: string, onStart: () => void): WalkStart {
  const [waiting, setWaiting] = useState(false);
  const start = useRef(onStart);
  useEffect(() => {
    start.current = onStart;
  }, [onStart]);

  const begin = () => {
    if (waiting) return;
    if (Platform.OS !== 'web') {
      onStart();
      return;
    }
    const visor = window.open(`/visor/${siteId}`, '_blank');
    if (visor) setWaiting(true);
    else onStart();
  };
  const beginNow = () => {
    setWaiting(false);
    onStart();
  };

  useEffect(() => {
    if (!waiting) return;
    const go = () => {
      setWaiting(false);
      start.current();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== VISOR_READY_KEY || !event.newValue) return;
      try {
        if ((JSON.parse(event.newValue) as { site?: string }).site === siteId) go();
      } catch {
        // Not a message from the visor.
      }
    };
    window.addEventListener('storage', onStorage);
    // A visor that never answers must not hold the walk for ever.
    const timer = setTimeout(go, VISOR_WAIT_MS);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearTimeout(timer);
    };
  }, [waiting, siteId]);

  return { waiting, begin, beginNow };
}

/**
 * Starts and runs the simulated walk. The ship owns the walk: it starts, pauses and ends it, and
 * the astronaut's visor, in another tab or on another screen, follows.
 */
export function WalkControls({
  siteId,
  stops,
  clock,
  progress,
  start,
  onPause,
  onResume,
  onEnd,
  onRate,
  plan,
  turnedBack = false,
  onReturn,
}: WalkControlsProps) {
  const over = clock !== null && progress.totalHours > 0 && progress.elapsedHours >= progress.totalHours;
  const share = progress.totalHours > 0 ? progress.elapsedHours / progress.totalHours : 0;
  // What the stop in hand is called inside a sentence: its name, or its place in the walk.
  const at = progress.stop;
  const place = at === null || !plan[at] ? 'the base' : (plan[at].name ?? `waypoint ${at + 1}`);

  const { waiting, begin, beginNow } = start;

  return (
    <View style={styles.block}>
      <SectionHeading
        title={clock === null ? 'SIMULATED WALK · READY' : 'SIMULATED WALK · IN PROGRESS'}
        color={clock === null ? Colors.textFaint : over ? Colors.textSoft : Colors.go}
      />

      {clock === null ? (
        <View style={styles.card}>
          <View style={styles.steps} accessibilityRole="list">
            <Step
              number={1}
              state={stops === 0 ? 'now' : 'done'}
              text={
                stops === 0
                  ? 'Mark waypoints on the map'
                  : `${stops} ${stops === 1 ? 'waypoint' : 'waypoints'} marked on the map`
              }
            />
            <Step number={2} state={stops === 0 ? 'later' : 'now'} text="Start the walk" />
            <Step number={3} state="later" text="Follow it in the astronaut visor" />
          </View>
          <Text style={styles.note}>
            {stops === 0
              ? 'Click or tap the map to mark the first point of the route.'
              : 'An astronaut walks the route at the assumed speed. Their position is simulated. The astronaut visor opens in a new tab.'}
          </Text>
          {waiting ? (
            <>
              <Text style={styles.status} accessibilityLiveRegion="polite">
                Opening the astronaut visor…
              </Text>
              <Text style={styles.note}>
                The walk starts as soon as the visor has loaded in its tab.
              </Text>
              <Button label="Start the walk without waiting" text="Start now" onPress={beginNow} />
            </>
          ) : (
            <Button
              label="Start the walk"
              text="Start the walk"
              primary
              onPress={begin}
              disabled={stops === 0}
            />
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {describe(progress.phase, progress, over, place, turnedBack)}
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
          {over || progress.phase === 'returning' || progress.phase === 'at-base' || !onReturn ? null : (
            <View style={styles.row}>
              <Button
                label="Return to base now: replace the rest of the walk with the shortest way back"
                text="Return to base"
                onPress={onReturn}
              />
            </View>
          )}

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
        style={[styles.visor, clock !== null && styles.visorLive]}
        accessibilityRole="link"
        accessibilityLabel="Open the astronaut visor in a new tab">
        {clock === null ? 'Astronaut visor' : 'Open the astronaut visor'} {'↗'}
      </Link>
      <Text style={styles.note}>
        {clock === null
          ? 'The walk seen from inside the helmet. It opens in another tab and follows the walk.'
          : 'See this walk from inside the helmet: the visor follows it from another tab.'}
      </Text>
    </View>
  );
}

type StepProps = { number: number; state: 'done' | 'now' | 'later'; text: string };

/** One of the three things a first walk takes, with where the user is among them. */
function Step({ number, state, text }: StepProps) {
  return (
    <View
      style={styles.step}
      accessible
      accessibilityLabel={`Step ${number}${state === 'done' ? ', done' : state === 'now' ? ', next' : ''}: ${text}`}>
      <View
        style={[
          styles.stepMark,
          state === 'done' && styles.stepMarkDone,
          state === 'now' && styles.stepMarkNow,
        ]}>
        <Text style={[styles.stepNumber, state !== 'later' && styles.stepNumberOn]}>
          {state === 'done' ? '✓' : number}
        </Text>
      </View>
      <Text style={[styles.stepText, state === 'later' && styles.stepTextLater]}>{text}</Text>
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
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  steps: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
  },
  stepMark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassHover,
  },
  stepMarkDone: {
    backgroundColor: Colors.go,
  },
  stepMarkNow: {
    backgroundColor: Colors.text,
  },
  stepNumber: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  stepNumberOn: {
    color: Colors.background,
  },
  stepText: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
  },
  stepTextLater: {
    color: Colors.textSoft,
  },
  note: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  status: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 21,
  },
  mono: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  meter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.glassBorder,
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
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    paddingRight: Spacing.one,
  },
  rate: {
    flexGrow: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  rateChosen: {
    backgroundColor: Colors.text,
  },
  rateText: {
    color: Colors.textSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  rateTextChosen: {
    color: Colors.background,
  },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassLight,
  },
  buttonPrimary: {
    backgroundColor: Colors.text,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  buttonTextPrimary: {
    color: Colors.background,
  },
  visorLive: {
    color: Colors.background,
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  visor: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.three - Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassLight,
  },
});
