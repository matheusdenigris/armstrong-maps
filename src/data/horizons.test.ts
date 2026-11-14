import { afterEach, describe, expect, it, vi } from 'vitest';

import { HORIZONS_API, horizonsSunUrl, parseHorizonsSun } from './horizons';

/** Part of a real answer: the Sun seen from Bradbury Landing, 2026-11-14, every 30 minutes. */
const ANSWER = {
  result: [
    '*******************************************************************************',
    ' Date__(UT)__HR:MN, , ,Azi_(a-app), Elev_(a-app),',
    '$$SOE',
    ' 2026-Nov-14 18:00,*, , 284.703361,    35.648734,',
    ' 2026-Nov-14 18:30,*, , 283.026715,    28.581339,',
    ' 2026-Nov-14 20:30,*, , 279.194711,    -0.009022,',
    ' 2026-Nov-14 21:00, ,s, 278.684929,    -7.198878,',
    '$$EOE',
    '*******************************************************************************',
  ].join('\n'),
};

describe('Horizons', () => {
  it('asks for the Sun seen from a point on Mars, east longitude as negative', () => {
    const url = decodeURIComponent(horizonsSunUrl(-4.589467, 137.441633, new Date('2026-11-14T18:00:00Z'), false));
    expect(url.startsWith(`${HORIZONS_API}?`)).toBe(true);
    expect(url).toContain("COMMAND='10'");
    expect(url).toContain("CENTER='coord@499'");
    expect(url).toContain("SITE_COORD='-137.441633,-4.589467,0'");
    expect(url).toContain("START_TIME='2026-11-14'");
    expect(url).toContain("STOP_TIME='2026-11-17'");
  });

  it('goes through the forwarder on the web', () => {
    expect(horizonsSunUrl(-4.589467, 137.441633, new Date('2026-11-14T18:00:00Z'), true)).toBe(
      '/api/horizons?lat=-4.589467&lon=137.441633&start=2026-11-14',
    );
  });

  it('reads the table in UT', () => {
    const table = parseHorizonsSun(ANSWER);
    expect(table.times[0]).toBe(Date.UTC(2026, 10, 14, 18, 0));
    expect(table.elevations).toEqual([35.648734, 28.581339, -0.009022, -7.198878]);
  });

  it('refuses an answer without a table', () => {
    expect(() => parseHorizonsSun({ result: 'No ephemeris for target' })).toThrow();
    expect(() => parseHorizonsSun({ error: 'bad' })).toThrow();
  });
});

describe('the forwarder for the web', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Calls the Vercel function with a fake request and response. */
  async function call(path: string) {
    const { default: handler } = await import('../../api/horizons.js');
    const response = { statusCode: 0, headers: {} as Record<string, string>, body: '' };
    await handler(
      { url: path },
      {
        set statusCode(code: number) {
          response.statusCode = code;
        },
        setHeader: (name: string, value: string) => {
          response.headers[name] = value;
        },
        end: (body: string) => {
          response.body = body;
        },
      },
    );
    return response;
  }

  it('builds the same query as the phone apps', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ANSWER), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await call('/api/horizons?lat=-4.589467&lon=137.441633&start=2026-11-14');
    expect(fetchMock).toHaveBeenCalledWith(
      horizonsSunUrl(-4.589467, 137.441633, new Date('2026-11-14T00:00:00Z'), false),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toContain('s-maxage');
    expect(parseHorizonsSun(JSON.parse(response.body)).elevations).toHaveLength(4);
  });

  it('refuses anything but three checked numbers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await call('/api/horizons?lat=500&lon=0&start=2026-11-14')).statusCode).toBe(400);
    expect((await call('/api/horizons?lat=0&lon=0&start=tomorrow')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
