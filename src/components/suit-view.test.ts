import { describe, expect, it, vi } from 'vitest';

import { PANORAMAS, depressionOf, eyeDistance } from '@/data/panoramas';

// The drawing itself needs a screen; where it starts is plain arithmetic.
vi.mock('react-native-svg', () => ({}));
vi.mock('@/constants/theme', () => ({ Colors: {} }));

const { suitEdge } = await import('./suit-view');

// Each screen with the height of the rim of the helmet at its foot, as the visor sets it.
const desktop = { width: 1280, height: 720, rim: 214 };
const phone = { width: 375, height: 812, rim: 318 };
const RAD = Math.PI / 180;

describe('where the suit starts on the screen', () => {
  it('is under the rim of the helmet while the astronaut looks ahead', () => {
    for (const size of [desktop, phone]) {
      const eye = eyeDistance(size);
      for (const panorama of PANORAMAS) {
        const ends = depressionOf(panorama, panorama.band.bottom);
        // The resting tilt of the head is four degrees down.
        expect(suitEdge(size, eye, -4, ends), panorama.nasaId).toBeGreaterThan(
          size.height - size.rim,
        );
      }
    }
  });

  it('rises into view as the astronaut looks down', () => {
    const eye = eyeDistance(desktop);
    const ends = 38;
    const ahead = suitEdge(desktop, eye, -4, ends);
    const down = suitEdge(desktop, eye, -30, ends);
    const boots = suitEdge(desktop, eye, -46, ends);
    expect(down).toBeLessThan(ahead);
    expect(boots).toBeLessThan(down);
    expect(boots).toBeLessThan(desktop.height / 2);
  });

  it('always starts above the last row of ground, so no edge shows between them', () => {
    for (const size of [desktop, phone]) {
      const eye = eyeDistance(size);
      for (const panorama of PANORAMAS) {
        const ends = depressionOf(panorama, panorama.band.bottom);
        for (const pitch of [-46, -30, -14, 0, 22]) {
          // Where the last row of ground is, straight ahead: the highest point of that edge.
          const below = ends + pitch;
          if (below >= 80) continue;
          const ground = size.height / 2 + eye * Math.tan(below * RAD);
          expect(suitEdge(size, eye, pitch, ends), `${panorama.nasaId} at ${pitch}`).toBeLessThan(
            ground,
          );
        }
      }
    }
  });

  it('stays a number when the view is almost straight down', () => {
    const eye = eyeDistance(phone);
    expect(Number.isFinite(suitEdge(phone, eye, 40, 60))).toBe(true);
  });
});
