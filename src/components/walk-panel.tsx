import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { SURFACE_RADIATION } from '@/data/radiation';
import { formatDistance, formatDose, formatDuration, formatShare } from '@/mission/format';
import {
  WALK_ASSUMPTIONS,
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
  onUndo: () => void;
  onClear: () => void;
};

const VERDICT: Record<Verdict, { label: string; color: string; meaning: string }> = {
  go: { label: 'GO', color: Colors.go, meaning: 'The walk fits the limits.' },
  caution: { label: 'CAUTION', color: Colors.caution, meaning: 'The walk is close to a limit.' },
  'no-go': { label: 'NO-GO', color: Colors.noGo, meaning: 'The walk breaks a limit.' },
};

/** The sentence for each reason code. The numbers come from the assumptions in use. */
function explain(reason: WalkReason, a: WalkAssumptions): string {
  switch (reason) {
    case 'life-support-exceeded':
      return `The walk takes longer than the ${a.lifeSupportHours} h of life support.`;
    case 'into-reserve':
      return `The walk uses part of the ${formatShare(a.reserveFraction)} life-support reserve.`;
    case 'beyond-walk-back-limit':
      return `A waypoint is more than ${a.walkBackLimitKm} km from the base, the walk-back limit.`;
    case 'near-walk-back-limit':
      return `A waypoint is past ${formatShare(a.nearLimitFraction)} of the ${a.walkBackLimitKm} km walk-back limit.`;
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
          <Text style={styles.chipCaption}>WALK STATUS</Text>
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

/** Why the verdict is what it is, the numbers behind it, and what was assumed. */
export function WalkDetails({ walk, stops, onUndo, onClear }: WalkDetailsProps) {
  const verdict = VERDICT[walk.verdict];
  const a = WALK_ASSUMPTIONS;
  const empty = stops === 0;
  const used = Math.min(1, walk.lifeSupportUsed);

  return (
    <View style={styles.details}>
      <PanelHeading number="01" title="WALK PLAN" />

      <View
        style={[styles.verdict, { borderLeftColor: verdict.color }]}
        accessible
        accessibilityLabel={`Walk verdict: ${verdict.label}. ${verdict.meaning}`}>
        <View style={styles.verdictLine}>
          <View style={[styles.verdictDot, { backgroundColor: verdict.color }]} />
          <Text style={[styles.verdictLabel, { color: verdict.color }]}>{verdict.label}</Text>
          <Text style={styles.simulated}>SIMULATED</Text>
        </View>
        <Text style={styles.verdictMeaning}>{verdict.meaning}</Text>
      </View>

      {walk.reasons.map((reason) => (
        <View key={reason} style={[styles.reasonCard, { borderLeftColor: verdict.color }]}>
          <Text style={styles.reason}>{explain(reason, a)}</Text>
        </View>
      ))}

      <View style={styles.stats}>
        <Stat label="Out and back" value={formatDistance(walk.totalM)} />
        <Stat label="Farthest from base" value={formatDistance(walk.farthestM)} />
        <Stat
          label="Time outside"
          value={formatDuration(walk.durationHours)}
          note={`${formatDuration(walk.walkingHours)} walking, ${formatDuration(walk.stopHours)} at ${stops} ${stops === 1 ? 'stop' : 'stops'}`}
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

      <View style={styles.actions}>
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

      <Text style={styles.assumptions}>
        Project assumptions, not NASA rules: {a.walkingSpeedKmh} km/h on foot, {a.minutesPerStop}{' '}
        min at each stop, {a.lifeSupportHours} h of life support with a{' '}
        {formatShare(a.reserveFraction)} reserve, and a {a.walkBackLimitKm} km walk-back limit (the
        dashed ring). The return is a straight line to the base. {SURFACE_RADIATION.caveat}
      </Text>
    </View>
  );
}

function PanelHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.panelHeading} accessible accessibilityRole="header">
      <Text style={styles.panelNumber}>{number}</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.panelRule} />
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
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 82,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderLeftWidth: 3,
    backgroundColor: Colors.surfaceRaised,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.small,
  },
  chipCaption: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.9,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headline: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  details: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  panelNumber: {
    color: Colors.mars,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelTitle: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  panelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  verdict: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surfaceRaised,
  },
  verdictLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  verdictDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.small,
  },
  verdictLabel: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  simulated: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  verdictMeaning: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonCard: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surface,
  },
  reason: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: StyleSheet.hairlineWidth,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  stat: {
    width: '49.7%',
    minHeight: 78,
    gap: Spacing.one,
    padding: Spacing.two + Spacing.half,
    backgroundColor: Colors.surface,
  },
  statLabel: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  statValue: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 15,
    fontWeight: '500',
  },
  statNote: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  meterCard: {
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.small,
    backgroundColor: Colors.surfaceRaised,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
  },
  meter: {
    height: 7,
    borderRadius: Radius.small,
    backgroundColor: Colors.border,
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
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
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
  assumptions: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
