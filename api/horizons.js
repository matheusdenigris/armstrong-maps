/**
 * Forwards one kind of request to NASA/JPL Horizons for the web app: the Sun's elevation seen
 * from a point on Mars. Horizons sends no CORS header, so a browser cannot call it directly.
 *
 * It only builds the query itself from three checked numbers (latitude, east longitude, start
 * day), so it cannot be used to reach anything else. Answers are cached by the CDN for a day.
 * Runs as a Vercel function; the phone apps call Horizons directly.
 */
const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const DAYS = 3;
const STEP_MIN = 10;

function bad(res, message) {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const start = url.searchParams.get('start') ?? '';
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return bad(res, 'lat must be -90..90');
  if (!Number.isFinite(lon) || lon < -180 || lon > 360) return bad(res, 'lon must be -180..360');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) {
    return bad(res, 'start must be YYYY-MM-DD');
  }
  const stop = new Date(Date.parse(`${start}T00:00:00Z`) + DAYS * 86400000).toISOString().slice(0, 10);

  // The same query as src/data/horizons.ts. Mars counts longitude westwards; Horizons takes an
  // east longitude as a negative number on such a body.
  const params = {
    format: 'json',
    COMMAND: "'10'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@499'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${(-lon).toFixed(6)},${lat.toFixed(6)},0'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${STEP_MIN} m'`,
    QUANTITIES: "'4'",
    CSV_FORMAT: "'YES'",
  };
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  try {
    const answer = await fetch(`${HORIZONS_API}?${query}`);
    const body = await answer.text();
    res.statusCode = answer.status;
    res.setHeader('Content-Type', 'application/json');
    if (answer.ok) res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    res.end(body);
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Horizons did not answer' }));
  }
};
