import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { isReading, lookSince, type PhoneAngles } from '@/mission/phone-look';

/** With no reading this long after switching on, the device has no sensors to follow. */
const NO_SENSOR_MS = 2000;

type Permission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Nothing about the device changes while the page is open. */
const never = () => () => {};
const hasSensors = () =>
  'DeviceOrientationEvent' in window && navigator.maxTouchPoints > 0;

/**
 * Follows how the phone is held, and reports how far it has turned and tilted since it was
 * switched on. It is offered only on a device with a touch screen and motion sensors, and it
 * starts from a press: some phones ask the person for permission, and only a press may ask.
 */
export function usePhoneLook(onLook: (change: { yaw: number; pitch: number }) => void) {
  // Known only in the browser: the page is also drawn on a server, where there is no device.
  const available = useSyncExternalStore(never, hasSensors, () => false);
  const [on, setOn] = useState(false);
  // Why it is not following: the person or the browser said no, or no reading ever came.
  const [failed, setFailed] = useState<'blocked' | 'no-sensor' | null>(null);
  const report = useRef(onLook);
  useEffect(() => {
    report.current = onLook;
  }, [onLook]);

  useEffect(() => {
    if (!on) return;
    let zero: PhoneAngles | null = null;
    let yaw = 0;
    let latest: PhoneAngles | null = null;
    let frame = 0;
    const draw = () => {
      frame = 0;
      if (!zero || !latest) return;
      const change = lookSince(zero, latest, yaw);
      yaw = change.yaw;
      report.current(change);
    };
    const follow = (event: DeviceOrientationEvent) => {
      const angles = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
      if (!isReading(angles)) return;
      zero ??= angles;
      latest = angles;
      // The sensors report faster than the screen draws.
      if (frame === 0) frame = requestAnimationFrame(draw);
    };
    window.addEventListener('deviceorientation', follow);
    const giveUp = setTimeout(() => {
      if (zero) return;
      setFailed('no-sensor');
      setOn(false);
    }, NO_SENSOR_MS);
    return () => {
      window.removeEventListener('deviceorientation', follow);
      clearTimeout(giveUp);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [on]);

  const toggle = useCallback(async () => {
    if (on) {
      setOn(false);
      return;
    }
    try {
      const ask = (window.DeviceOrientationEvent as unknown as Permission).requestPermission;
      if (typeof ask === 'function' && (await ask()) !== 'granted') {
        setFailed('blocked');
        return;
      }
      setFailed(null);
      setOn(true);
    } catch {
      setFailed('blocked');
    }
  }, [on]);

  return { available, on, failed, toggle };
}
