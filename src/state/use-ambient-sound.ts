/**
 * The recording plays in the browser (`use-ambient-sound.web.ts`). The Android and iOS apps have
 * no audio player wired in yet, so screens check this and leave the sound button out.
 */
export const AMBIENT_SOUND_AVAILABLE = false;

export function useAmbientSound(_url: string) {
  return { playing: false, failed: false, toggle: async () => {} };
}
