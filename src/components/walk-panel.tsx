import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SURFACE_RADIATION } from '@/data/radiation';
import { CME_WINDOW, DONKI_CREDIT } from '@/data/space-weather';
import { formatDistance, formatDose, formatDuration, formatShare } from '@/mission/format';
import { formatMarsClock, localTrueSolarTime, marsTime } from '@/mission/mars-time';
import { SAND_PACE } from '@/mission/pace';
import {
  WALK_ASSUMPTIONS,
  severityOf,
  type Verdict,
  type WalkAssumptions,
  type WalkEvaluation,
  type WalkReason,
} from '@/mission/walk';

type WalkSummaryProps = {
  walk: WalkEvaluation;
  /** How many waypoints the route has. */
  stops: number;
  /** On a phone the panel is a sheet that opens; beside the map it is always open. */
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
};

type WalkDetailsProps = {
  walk: WalkEvaluation;
  stops: number;
};

type VerdictReasonsProps = {
  walk: WalkEvaluation;
  stops: number;
  /** The planned start, on Earth's clock, and the longitude of the base. */
  start: Date;
  lonEast: number;
  /** The walk is simulated in daylight: its start was moved to the next morning. */
  delayed: boolean;
  /** A walk is running, so its start cannot move. */
  locked: boolean;
  onDelay: () => void;
  onNow: () => void;
};

type RouteActionsProps = {
  stops: number;
  /** A walk is in progress: the route cannot be changed. */
  locked?: boolean;
  onUndo: () => void;
  onClear: () => void;
};

const VERDICT: Record<Verdict, { label: string; color: string; meaning: string }> = {
  go: { label: 'GO', color: Colors.go, meaning: 'The walk fits the limits.' },
  caution: { label: 'CAUTION', color: Colors.caution, meaning: 'The walk is close to a limit.' },
  'no-go': { label: 'NO-GO', color: Colors.noGo, meaning: 'The walk breaks a limit.' },
};

/** Each reason in a few words, for a title and for the line on the map. */
const REASON_LABEL: Record<WalkReason, string> = {
  'life-support-exceeded': 'Longer than the life support',
  'into-reserve': 'Into the life-support reserve',
  'beyond-walk-back-limit': 'Too far from the base',
  'near-walk-back-limit': 'Near the walk-back limit',
  'cme-at-mars': 'Solar storm forecast',
  'too-steep': 'Ground too steep',
  'steep-ground': 'Steep ground',
  'dune-field': 'Loose sand',
  'starts-in-dark': 'Night at the base',
  'into-night': 'Ends after sunset',
  'low-sun': 'Low Sun',
};

export const reasonLabel = (reason: WalkReason): string => REASON_LABEL[reason];

/**
 * The sentence for each reason code. The numbers come from the assumptions in use; the local
 * time of the start is said where the reason is the time and not the route.
 */
function explain(reason: WalkReason, a: WalkAssumptions, startTime?: string): string {
  switch (reason) {
    case 'life-support-exceeded':
      return `The walk takes longer than the ${a.lifeSupportHours} h of life support.`;
    case 'into-reserve':
      return `The walk uses part of the ${formatShare(a.reserveFraction)} life-support reserve.`;
    case 'beyond-walk-back-limit':
      return `A waypoint is more than ${a.walkBackLimitKm} km from the base, the walk-back limit.`;
    case 'near-walk-back-limit':
      return `A waypoint is past ${formatShare(a.nearLimitFraction)} of the ${a.walkBackLimitKm} km walk-back limit.`;
    case 'cme-at-mars':
      return `NASA's WSA-Enlil model forecasts a coronal mass ejection hitting Mars squarely (not minor, not glancing) within ${CME_WINDOW.aheadHours} h (or one passed in the last ${CME_WINDOW.behindHours} h). Solar particles could raise the dose above the average used here. Source: ${DONKI_CREDIT}; the window is a project assumption.`;
    case 'too-steep':
      return `The route crosses ground of ${a.noGoSlopeDeg}° or more, too steep to walk. Slope from the elevation model of the site; the limit is a project assumption.`;
    case 'steep-ground':
      return `The route crosses ground of ${a.cautionSlopeDeg}° or more. Slope from the elevation model of the site; the limit is a project assumption, and the model smooths out small steps.`;
    case 'dune-field':
      return `The route enters a mapped dune field: loose sand, where Spirit was trapped in 2009. Mars Global Digital Dune Database (USGS).`;
    case 'starts-in-dark':
      return `The Sun is below the horizon at the planned start${
        startTime ? ` (${startTime} local solar time at the base)` : ''
      }, and a walk in the dark is a no-go whatever the route. Simulate it in daylight to check the route itself.`;
    case 'into-night':
      return 'The walk would still be out when the Sun sets. Shorten the route, or simulate it in daylight, from the morning.';
    case 'low-sun':
      return `The Sun gets lower than ${a.lowSunDeg}° during the walk: long shadows hide holes and rocks. The limit is a project assumption.`;
  }
}

/** The verdict and the two numbers that matter most, on one line. */
export function WalkSummary({ walk, stops, collapsible, expanded, onToggle }: WalkSummaryProps) {
  const verdict = VERDICT[walk.verdict];
  const empty = stops === 0;

  return (
    <View style={styles.summary}>
      <View
        style={[styles.chip, { borderColor: verdict.color, borderLeftColor: verdict.color }]}
        accessible
        accessibilityLabel={`Verdict: ${verdict.label}. ${verdict.meaning}`}>
        <View style={[styles.chipDot, { backgroundColor: verdict.color }]} />
        <View>
          <Text style={[styles.chipText, { color: verdict.color }]}>{verdict.label}</Text>
        </View>
      </View>
      <Text style={styles.headline} numberOfLines={2}>
        {empty
          ? 'Tap the map to add a waypoint.'
          : `${formatDistance(walk.totalM)}  ·  ${formatDuration(walk.durationHours)}`}
      </Text>
      {collapsible ? (
        <PanelButton
          label={expanded ? 'Hide the details' : 'Show the walk and the layers'}
          text={expanded ? 'Less' : 'More'}
          onPress={onToggle}
        />
      ) : null}
    </View>
  );
}

/**
 * Why the verdict is not a go, right under it: one card a reason, in plain words. The hour never
 * stops anyone from trying a route: a walk refused for the dark can be simulated in daylight,
 * which moves its start to the next morning, and the panel says so while that holds.
 */
export function VerdictReasons({
  walk,
  stops,
  start,
  lonEast,
  delayed,
  locked,
  onDelay,
  onNow,
}: VerdictReasonsProps) {
  if (stops === 0 || (walk.reasons.length === 0 && !delayed)) return null;
  const canDelay = !delayed && !locked;
  const a = WALK_ASSUMPTIONS;
  const startTime = formatMarsClock(localTrueSolarTime(marsTime(start), lonEast));

  return (
    <View style={styles.reasons}>
      {delayed ? (
        <View style={styles.daylight}>
          <Text style={styles.daylightText}>
            Simulated in daylight: the walk starts the next morning, at {startTime} local solar
            time.
          </Text>
          {locked ? null : (
            <Pressable
              onPress={onNow}
              accessibilityRole="button"
              accessibilityLabel="Use the time now at the base instead"
              style={({ pressed }) => [styles.delay, pressed && styles.delayPressed]}>
              <Text style={styles.delayText}>Use the time now</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {walk.reasons.map((reason) => {
        const dark = reason === 'starts-in-dark' || reason === 'into-night';
        const sentence = explain(reason, a, startTime);
        return (
          <View key={reason} style={styles.reasonCard}>
            <View
              style={styles.reasonBody}
              accessible
              accessibilityLabel={`${VERDICT[severityOf(reason)].label}: ${REASON_LABEL[reason]}. ${sentence}`}>
              <View style={styles.reasonHead}>
                <View
                  style={[styles.verdictDot, { backgroundColor: VERDICT[severityOf(reason)].color }]}
                />
                <Text style={styles.reasonTitle}>{REASON_LABEL[reason]}</Text>
              </View>
              <Text style={styles.reason}>{sentence}</Text>
            </View>
            {dark && canDelay ? (
              <Pressable
                onPress={onDelay}
                accessibilityRole="button"
                accessibilityLabel="Simulate the walk in daylight, starting the next morning"
                style={({ pressed }) => [styles.delay, pressed && styles.delayPressed]}>
                <Text style={styles.delayText}>Simulate in daylight</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Takes the last waypoint off the route, or all of them. It comes first in the panel: a tap in
 * the wrong place on the map is the commonest thing to put right.
 */
export function RouteActions({ stops, locked, onUndo, onClear }: RouteActionsProps) {
  const empty = stops === 0 || locked === true;
  return (
    <View style={styles.routeActions}>
      <PanelButton
        label="Remove the last waypoint"
        text="Undo"
        onPress={onUndo}
        disabled={empty}
      />
      <PanelButton
        label="Remove every waypoint"
        text="Clear"
        onPress={onClear}
        disabled={empty}
      />
    </View>
  );
}

/** Why the verdict is what it is, the numbers behind it, and what was assumed. */
export function WalkDetails({ walk, stops }: WalkDetailsProps) {
  const verdict = VERDICT[walk.verdict];
  const a = WALK_ASSUMPTIONS;
  const used = Math.min(1, walk.lifeSupportUsed);

  return (
    <View style={styles.details}>
      <PanelHeading title="Walk plan" />

      <View
        style={[styles.verdict, { borderLeftColor: verdict.color }]}
        accessible
        accessibilityLabel={`Walk verdict: ${verdict.label}. ${verdict.meaning}`}>
        <View style={styles.verdictLine}>
          <View style={[styles.verdictDot, { backgroundColor: verdict.color }]} />
          <Text style={[styles.verdictLabel, { color: verdict.color }]}>{verdict.label}</Text>
          <Text style={styles.simulated}>Simulated</Text>
        </View>
        <Text style={styles.verdictMeaning}>{verdict.meaning}</Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Out and back" value={formatDistance(walk.totalM)} />
        <Stat label="Farthest from base" value={formatDistance(walk.farthestM)} />
        <Stat
          label="Time outside"
          value={formatDuration(walk.durationHours)}
          note={`${formatDuration(walk.walkingHours)} walking${
            walk.slowedHours >= 1 / 60
              ? ` (${formatDuration(walk.slowedHours)} of it added by slope and sand)`
              : ''
          }, ${formatDuration(walk.stopHours)} at ${stops} ${stops === 1 ? 'stop' : 'stops'}`}
        />
        <Stat
          label="Radiation dose"
          value={formatDose(walk.doseMsv)}
          note={`At ${SURFACE_RADIATION.msvPerDay} mSv a day. ${SURFACE_RADIATION.source}`}
        />
      </View>

      <View style={styles.meterCard}>
        <View style={styles.meterRow}>
          <Text style={styles.statLabel}>Life support used</Text>
          <Text style={styles.statValue}>{formatShare(walk.lifeSupportUsed)}</Text>
        </View>
        <View
          style={styles.meter}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Life support used: ${formatShare(walk.lifeSupportUsed)}`}>
          <View
            style={[styles.meterFill, { width: `${used * 100}%`, backgroundColor: verdict.color }]}
          />
          {/* Where the reserve starts. */}
          <View style={[styles.meterMark, { left: `${(1 - a.reserveFraction) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.assumptions}>
        <Text style={styles.assumptionsParagraph}>Project assumptions, not NASA rules:</Text>
        <Text style={styles.assumptionsParagraph}>
          • Walking speed on foot: {a.walkingSpeedKmh} km/h on flat, firm ground
        </Text>
        <Text style={styles.assumptionsParagraph}>
          • Slower on a slope, in the shape of Tobler&apos;s hiking function (measured on Earth,
          without a suit), and at {Math.round(SAND_PACE * 100)}% of the speed in a mapped dune
          field
        </Text>
        <Text style={styles.assumptionsParagraph}>• {a.minutesPerStop} min at each stop</Text>
        <Text style={styles.assumptionsParagraph}>
          • {a.lifeSupportHours} h of life support with a {formatShare(a.reserveFraction)} reserve
        </Text>
        <Text style={styles.assumptionsParagraph}>
          • {a.walkBackLimitKm} km walk-back limit (the dashed ring).
        </Text>
        <Text style={styles.assumptionsParagraph}>
          • Ground of {a.cautionSlopeDeg}° or more earns a caution, {a.noGoSlopeDeg}° or more a
          no-go.
        </Text>
        <Text style={styles.assumptionsParagraph}>
          • The Sun lower than {a.lowSunDeg}° earns a caution; a walk in the dark is a no-go.
        </Text>
      </View>
    </View>
  );
}

function PanelHeading({ title }: { title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

type PanelButtonProps = { label: string; text: string; onPress: () => void; disabled?: boolean };

function PanelButton({ label, text, onPress, disabled }: PanelButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 64,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: Colors.glassLight,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  headline: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  details: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  panelHeading: {
    paddingTop: Spacing.one,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  verdict: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  verdictLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  verdictDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verdictLabel: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    letterSpacing: 0.4,
  },
  simulated: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  verdictMeaning: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  reasons: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  reasonCard: {
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  daylight: {
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  daylightText: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  reasonBody: {
    gap: Spacing.one,
  },
  reasonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reasonTitle: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
  },
  delay: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glassHover,
  },
  delayPressed: {
    opacity: 0.76,
  },
  delayText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  reason: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  stat: {
    width: '48.6%',
    minHeight: 84,
    gap: Spacing.one,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  statLabel: {
    color: Colors.textSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  statValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 17,
  },
  statNote: {
    color: Colors.textFaint,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  meterCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    backgroundColor: Colors.glassLight,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
  },
  meter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
  },
  meterMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.text,
  },
  routeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
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
  buttonPressed: {
    backgroundColor: Colors.glassHover,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  assumptions: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  assumptionsParagraph: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
});
