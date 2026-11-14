import { describe, expect, it } from 'vitest';

import { imageSearchUrl, parseImageSearch } from './image-library';
import { CAMERA_NAMES, RAW_IMAGE_FEEDS, parseRawImages, rawImagesUrl } from './rover-images';
import { SITES } from './sites';
import { NASA_SOURCES, OTHER_SOURCES, SOURCES } from './sources';
import {
  CME_WINDOW,
  donkiUrls,
  marsSpaceWeather,
  parseMarsArrivals,
  parseSepEvents,
} from './space-weather';

/** A WSA-Enlil run shaped like the ones DONKI returns. */
const run = (modelTime: string, cmeId: string, impacts: { location: string; arrivalTime: string }[]) => ({
  simulationID: `WSA-ENLIL/${modelTime}`,
  modelCompletionTime: modelTime,
  cmeInputs: [{ CMEID: cmeId, speed: 600 }],
  impactList: impacts.map((impact) => ({ ...impact, isGlancingBlow: false, isMinorImpact: true })),
  link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/WSA-ENLIL/1/-1',
});

describe('donkiUrls', () => {
  it('asks for a fixed window of whole days with a key', () => {
    const urls = donkiUrls(new Date('2026-11-14T18:00:00Z'), 30, 'TEST');
    expect(urls.from).toBe('2026-10-15');
    expect(urls.to).toBe('2026-11-14');
    expect(urls.enlil).toBe(
      'https://api.nasa.gov/DONKI/WSAEnlilSimulations?startDate=2026-10-15&endDate=2026-11-14&api_key=TEST',
    );
    expect(urls.sep).toContain('/DONKI/SEP?startDate=2026-10-15');
  });

  it('gives the same addresses all day, so a visit asks once', () => {
    const morning = donkiUrls(new Date('2026-11-14T01:00:00Z'));
    const evening = donkiUrls(new Date('2026-11-14T23:00:00Z'));
    expect(evening).toEqual(morning);
  });
});

describe('parseMarsArrivals', () => {
  it('keeps only arrivals at Mars', () => {
    const arrivals = parseMarsArrivals([
      run('2026-10-23T12:09Z', 'CME-1', [
        { location: 'Mars', arrivalTime: '2026-10-27T12:00Z' },
        { location: 'Psyche', arrivalTime: '2026-10-28T09:00Z' },
        { location: 'Earth', arrivalTime: '2026-10-25T09:00Z' },
      ]),
    ]);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]).toMatchObject({
      arrivalTime: '2026-10-27T12:00Z',
      cmeIds: ['CME-1'],
      minor: true,
      glancing: false,
    });
  });

  it('keeps the latest model run of each CME', () => {
    const arrivals = parseMarsArrivals([
      run('2026-10-23T12:00Z', 'CME-1', [{ location: 'Mars', arrivalTime: '2026-10-27T12:00Z' }]),
      run('2026-10-24T06:00Z', 'CME-1', [{ location: 'Mars', arrivalTime: '2026-10-27T20:00Z' }]),
    ]);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].arrivalTime).toBe('2026-10-27T20:00Z');
  });

  it('reads anything else as no forecast', () => {
    expect(parseMarsArrivals(null)).toEqual([]);
    expect(parseMarsArrivals({ error: 'OVER_RATE_LIMIT' })).toEqual([]);
  });
});

describe('marsSpaceWeather', () => {
  const arrivals = parseMarsArrivals([
    run('2026-11-10T00:00Z', 'CME-2', [{ location: 'Mars', arrivalTime: '2026-11-14T12:00Z' }]),
  ]);

  it('is arriving inside the window ahead', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(marsSpaceWeather(arrivals, now)).toMatchObject({ level: 'arriving', hours: 24 });
  });

  it('is passing just after the arrival', () => {
    const now = new Date('2026-11-14T18:00:00Z');
    expect(marsSpaceWeather(arrivals, now)).toMatchObject({ level: 'passing', hours: -6 });
  });

  it('is quiet outside the window, and names the next arrival', () => {
    const early = new Date(Date.parse('2026-11-14T12:00:00Z') - (CME_WINDOW.aheadHours + 1) * 3_600_000);
    const quiet = marsSpaceWeather(arrivals, early);
    expect(quiet.level).toBe('quiet');
    expect(quiet.arrival?.arrivalTime).toBe('2026-11-14T12:00Z');
    expect(marsSpaceWeather(arrivals, new Date('2026-11-20T00:00:00Z'))).toEqual({
      level: 'quiet',
      arrival: null,
      hours: null,
    });
  });
});

describe('parseSepEvents', () => {
  it('reads the events newest first with their instruments', () => {
    const events = parseSepEvents([
      { sepID: 'SEP-1', eventTime: '2026-10-01T10:00Z', instruments: [{ displayName: 'GOES-P: SEISS >10 MeV' }] },
      { sepID: 'SEP-2', eventTime: '2026-10-20T03:00Z', instruments: [] },
      { sepID: '', eventTime: '2026-10-21T03:00Z' },
    ]);
    expect(events.map((event) => event.id)).toEqual(['SEP-2', 'SEP-1']);
    expect(events[1].instruments).toEqual(['GOES-P: SEISS >10 MeV']);
  });
});

/** A raw image shaped like the ones the feed returns. */
const frame = (id: string, camera: string, sol: number, sample = 'Full') => ({
  imageid: id,
  sol,
  sample_type: sample,
  date_taken_utc: '2026-11-13T10:00:00.000',
  camera: { instrument: camera },
  image_files: {
    small: `http://mars.nasa.gov/raw/${id}_320.jpg`,
    medium: `http://mars.nasa.gov/raw/${id}_800.jpg`,
  },
  link: `https://mars.nasa.gov/mars2020/multimedia/raw-images/${id}`,
  credit: 'NASA/JPL-Caltech/ASU',
});

describe('rover raw images', () => {
  it('asks for the chosen cameras of each rover', () => {
    const url = rawImagesUrl('perseverance', 10);
    expect(url).toContain('category=mars2020');
    expect(url).toContain('num=10');
    expect(decodeURIComponent(url)).toContain('|NAVCAM_LEFT|MCZ_LEFT|FRONT_HAZCAM_LEFT_A');
  });

  it('names every camera it asks for', () => {
    for (const feed of Object.values(RAW_IMAGE_FEEDS)) {
      for (const camera of feed.cameras) expect(CAMERA_NAMES[camera]).toBeTruthy();
    }
  });

  it('keeps full frames over https, and prefers a mix of cameras', () => {
    const images = parseRawImages(
      {
        images: [
          frame('a', 'MCZ_LEFT', 10),
          frame('b', 'MCZ_LEFT', 10),
          frame('c', 'MCZ_LEFT', 10),
          frame('t', 'NAVCAM_LEFT', 10, 'Thumbnail'),
          frame('d', 'NAVCAM_LEFT', 9),
        ],
      },
      3,
      2,
    );
    expect(images.map((image) => image.id)).toEqual(['a', 'b', 'd']);
    expect(images[0].image).toBe('https://mars.nasa.gov/raw/a_800.jpg');
  });

  it('fills the free places with the newest frames when one camera is all there is', () => {
    const images = parseRawImages(
      { images: ['a', 'b', 'c', 'd'].map((id) => frame(id, 'MCZ_LEFT', 10)) },
      4,
      2,
    );
    expect(images).toHaveLength(4);
  });
});

describe('NASA Image and Video Library', () => {
  it('searches images only', () => {
    expect(imageSearchUrl('Gale crater')).toBe(
      'https://images-api.nasa.gov/search?q=Gale%20crater&media_type=image',
    );
  });

  it('reads the items and links to their pages', () => {
    const found = parseImageSearch({
      collection: {
        items: [
          {
            data: [{ nasa_id: 'PIA 1', title: 'Mount Sharp', media_type: 'image', date_created: '2014-09-11T00:00:00Z', center: 'JPL' }],
            links: [{ href: 'http://images-assets.nasa.gov/image/PIA 1/PIA 1~thumb.jpg' }],
          },
          { data: [{ nasa_id: 'V1', media_type: 'video' }], links: [{ href: 'https://x' }] },
        ],
      },
    });
    expect(found).toEqual([
      {
        nasaId: 'PIA 1',
        title: 'Mount Sharp',
        dateCreated: '2014-09-11',
        centre: 'JPL',
        thumbnail: 'https://images-assets.nasa.gov/image/PIA%201/PIA%201~thumb.jpg',
        page: 'https://images.nasa.gov/details/PIA%201',
      },
    ]);
  });

  it('has a search for every site', () => {
    for (const site of SITES) expect(site.photoQuery.length).toBeGreaterThan(3);
  });
});

describe('sources', () => {
  it('lists the NASA sources first', () => {
    expect(SOURCES.slice(0, NASA_SOURCES.length).every((source) => source.nasa)).toBe(true);
    expect(OTHER_SOURCES.length).toBeGreaterThan(0);
  });

  it('gives every source an id, a reference and an endpoint', () => {
    const ids = new Set(SOURCES.map((source) => source.id));
    expect(ids.size).toBe(SOURCES.length);
    for (const source of SOURCES) {
      expect(source.reference).toMatch(/^https:\/\//);
      expect(source.endpoint.length).toBeGreaterThan(0);
    }
  });
});
