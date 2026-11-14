import { describe, expect, it } from 'vitest';

import { PANORAMAS, headingToFraction, panoramaNear, panoramaUrl } from './panoramas';
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
