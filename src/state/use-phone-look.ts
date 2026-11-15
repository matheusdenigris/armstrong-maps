/**
 * Looking around by turning the phone runs in the browser (`use-phone-look.web.ts`). The Android
 * and iOS apps have no motion module wired in yet, so there it is not offered.
 */
export function usePhoneLook(_onLook: (change: { yaw: number; pitch: number }) => void) {
  const failed: 'blocked' | 'no-sensor' | null = null;
  return { available: false, on: false, failed, toggle: async () => {} };
}
