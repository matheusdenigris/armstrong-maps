import { describe, expect, it } from 'vitest';

import {
  PANORAMAS,
  SCENE_EVERY_M,
  SCENE_MIN_SECONDS,
  headingToFraction,
  panoramaNear,
  panoramaUrl,
  sceneForWalk,
  sceneStretch,
  scenesOf,
} from './panoramas';
import { SITES, findSite } from './sites';

describe('the photographs', () => {
  it('have unique NASA identifiers', () => {
    const ids = PANORAMAS.map((panorama) => panorama.nasaId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^PIA\d{5}$/);
  });

  it.each(PANORAMAS.map((panorama) => [panorama.nasaId, panorama] as const))(
    '%s is usable',
    (_id, panorama) => {
      // A picture that goes all the way round is several times wider than it is tall.
      expect(panorama.width / panorama.height).toBeGreaterThan(3);
      expect(panorama.band.top).toBeGreaterThanOrEqual(0);
      expect(panorama.band.bottom).toBeLessThanOrEqual(1);
      expect(panorama.band.top).toBeLessThan(panorama.band.bottom);
      // A patch of drawn sky starts at the top of the band and ends about the horizon at most.
      for (const gap of panorama.skyGaps ?? []) {
        expect(gap.left).toBeGreaterThanOrEqual(0);
        expect(gap.right).toBeLessThanOrEqual(1);
        expect(gap.left).toBeLessThan(gap.right);
        for (const bottom of [gap.bottomLeft, gap.bottomRight]) {
          expect(bottom).toBeGreaterThan(panorama.band.top);
          expect(bottom).toBeLessThanOrEqual(panorama.horizon + 0.01);
        }
      }
      // The horizon has to be inside the band that is shown.
      expect(panorama.horizon).toBeGreaterThan(panorama.band.top);
      expect(panorama.horizon).toBeLessThan(panorama.band.bottom);
      expect(panorama.sky).toMatch(/^#[0-9a-f]{6}$/);
      expect(panorama.caption).not.toBe('');
      expect(panorama.credit).toMatch(/^NASA\//);
      expect(findSite(panorama.site)).toBeDefined();
    },
  );

  it('come from the NASA image library, lighter on a phone', () => {
    const first = PANORAMAS[0];
    expect(panoramaUrl(first, true)).toBe(
      'https://images-assets.nasa.gov/image/PIA16101/PIA16101~orig.jpg',
    );
    expect(panoramaUrl(first, false)).toMatch(/~large\.jpg$/);
  });

  it('were taken inside the region of their site, when the place is known', () => {
    for (const panorama of PANORAMAS) {
      if (!panorama.point) continue;
      const region = findSite(panorama.site)!.region;
      expect(panorama.point.lat).toBeGreaterThan(region.south);
      expect(panorama.point.lat).toBeLessThan(region.north);
      expect(panorama.point.lon).toBeGreaterThan(region.west);
      expect(panorama.point.lon).toBeLessThan(region.east);
    }
  });
});

describe('panoramaNear', () => {
  const gale = findSite('gale')!;

  it('picks the photograph taken at the landing point for an astronaut standing there', () => {
    const chosen = panoramaNear('gale', gale.landing);
    expect(chosen.panorama.nasaId).toBe('PIA16101');
    expect(chosen.awayM).toBeCloseTo(0, 3);
    expect(chosen.borrowed).toBe(false);
  });

  it('switches to another photograph as the astronaut gets closer to where it was taken', () => {
    const murrayButtes = { lat: -4.694, lon: 137.353 };
    const chosen = panoramaNear('gale', murrayButtes);
    expect(chosen.panorama.nasaId).toBe('PIA20840');
    expect(chosen.awayM).toBeLessThan(50);
  });

  it('gives no distance when the place of the photograph is not known', () => {
    const chosen = panoramaNear('gusev', findSite('gusev')!.landing);
    expect(chosen.panorama.site).toBe('gusev');
    expect(chosen.awayM).toBeNull();
  });

  it('borrows from Gale, and says so, where a site has no photograph', () => {
    const without = SITES.filter(
      (site) => !PANORAMAS.some((panorama) => panorama.site === site.id),
    );
    expect(without.length).toBeGreaterThan(0);
    for (const site of without) {
      const chosen = panoramaNear(site.id, site.landing);
      expect(chosen.borrowed).toBe(true);
      expect(chosen.panorama.site).toBe('gale');
    }
  });
});

describe('the scenes of a walk', () => {
  const gale = findSite('gale')!;
  const scene = (walkedM: number, atBase = false) =>
    sceneForWalk('gale', gale.landing, gale.landing, walkedM, atBase);

  it('start with the photograph taken at the landing point and go outwards', () => {
    const { scenes, borrowed } = scenesOf('gale', gale.landing);
    expect(borrowed).toBe(false);
    expect(scenes.length).toBeGreaterThanOrEqual(5);
    expect(scenes[0].nasaId).toBe('PIA16101');
    // Each one was taken farther from the landing point than the one before.
    const lat = scenes.map((panorama) => panorama.point!.lat);
    expect(lat).toEqual([...lat].sort((a, b) => b - a));
  });

  it('change every stretch of walking', () => {
    expect(scene(0).index).toBe(0);
    expect(scene(SCENE_EVERY_M - 1).index).toBe(0);
    expect(scene(SCENE_EVERY_M).index).toBe(1);
    expect(scene(SCENE_EVERY_M * 2.5).index).toBe(2);
    expect(scene(SCENE_EVERY_M).panorama.nasaId).not.toBe(scene(0).panorama.nasaId);
  });

  it('go round again when the walk is longer than the photographs', () => {
    const count = scene(0).count;
    expect(scene(SCENE_EVERY_M * count).index).toBe(0);
    expect(scene(SCENE_EVERY_M * (count + 1)).index).toBe(1);
  });

  it('cover a longer stretch each when the walk is played fast', () => {
    // At 2.5 km/h, real time and ten times it stay on the walking stretch.
    expect(sceneStretch(2.5, 1)).toBe(SCENE_EVERY_M);
    expect(sceneStretch(2.5, 10)).toBe(SCENE_EVERY_M);
    // At 600 times, eight seconds on screen are more than three kilometres of walking.
    const fast = sceneStretch(2.5, 600);
    expect(fast).toBeCloseTo((2500 / 3600) * 600 * SCENE_MIN_SECONDS, 6);
    const paced = sceneForWalk('gale', gale.landing, gale.landing, SCENE_EVERY_M * 4, false, fast);
    expect(paced.index).toBe(0);
  });

  it('are the first one at the base, whatever was walked', () => {
    expect(scene(SCENE_EVERY_M * 3.2, true).index).toBe(0);
  });

  it('say how far from the astronaut each photograph was taken', () => {
    expect(scene(0).awayM).toBeCloseTo(0, 3);
    // The second scene of Gale was taken kilometres up the traverse.
    expect(scene(SCENE_EVERY_M).awayM).toBeGreaterThan(5000);
  });

  it('borrow the scenes of Gale where a site has none, and say so', () => {
    const elysium = findSite('elysium')!;
    const borrowed = sceneForWalk('elysium', elysium.landing, elysium.landing, SCENE_EVERY_M, false);
    expect(borrowed.borrowed).toBe(true);
    expect(borrowed.panorama.site).toBe('gale');
    expect(borrowed.awayM).toBeNull();
    expect(borrowed.count).toBe(scenesOf('gale', gale.landing).scenes.length);
  });

  it('stay on the only photograph of a site that has one', () => {
    const gusev = findSite('gusev')!;
    const only = sceneForWalk('gusev', gusev.landing, gusev.landing, SCENE_EVERY_M * 4, false);
    expect(only.count).toBe(1);
    expect(only.index).toBe(0);
  });
});

describe('headingToFraction', () => {
  const aligned = PANORAMAS.find((panorama) => panorama.north !== null)!;

  it('puts north where the caption of the picture says it is', () => {
    // North at both ends, south in the centre.
    expect(headingToFraction(aligned, 0)).toBeCloseTo(0, 9);
    expect(headingToFraction(aligned, 180)).toBeCloseTo(0.5, 9);
    expect(headingToFraction(aligned, 90)).toBeCloseTo(0.25, 9);
  });

  it('starts in the middle of a picture that is not lined up with the compass', () => {
    const loose = PANORAMAS.find((panorama) => panorama.north === null)!;
    expect(headingToFraction(loose, 0)).toBeCloseTo(0.5, 9);
    expect(headingToFraction(loose, 180)).toBeCloseTo(0, 9);
  });

  it('goes all the way round and wraps', () => {
    expect(headingToFraction(aligned, 360)).toBeCloseTo(0, 9);
    expect(headingToFraction(aligned, -90)).toBeCloseTo(0.75, 9);
    expect(headingToFraction(aligned, 450)).toBeCloseTo(0.25, 9);
  });
});
