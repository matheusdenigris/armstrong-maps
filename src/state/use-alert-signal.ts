import type { SafetyAlert } from '@/mission/safety';

/**
 * The tone and the vibration of an alert play in the browser (`use-alert-signal.web.ts`). The
 * Android and iOS apps have no audio or haptics module wired in yet, so there the display alone
 * carries an alert.
 */
export const ALERT_SIGNAL_AVAILABLE = false;

export function useAlertSignal(_alerts: readonly SafetyAlert[], _enabled: boolean) {
  return { arm: () => {} };
}
