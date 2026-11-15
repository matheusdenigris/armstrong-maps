/**
 * Writes `public/globe/relief.bin`: the height of the whole planet on a coarse grid, which the
 * globe uses to raise its surface.
 *
 *   node scripts/build-globe-relief.mjs
 *
 * The heights are asked from the image service of the MOLA and HRSC blended elevation model on
 * NASA's Mars Trek, the same model the app reads for slopes. The service takes about a minute to
 * resample the whole planet, which is why the grid is kept as a file instead of being asked for
 * on every visit.
 *
 * The file is 512 by 256 heights in metres above the MOLA areoid, as little-endian 16-bit
 * integers, rows from north to south and columns from 180 W to 180 E.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WIDTH = 512;
const HEIGHT = 256;
const SERVICE =
  'https://trek.nasa.gov/mars/trekarcgis/rest/services/' +
  'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer/exportImage';
const QUERY = [
  'bbox=-180,-90,180,90',
  'bboxSR=104905',
  'imageSR=104905',
  `size=${WIDTH},${HEIGHT}`,
  'format=bsq',
  'pixelType=S16',
  'interpolation=RSP_BilinearInterpolation',
  'f=image',
].join('&');

/** The lowest and highest ground on Mars, with room: anything outside is not a height. */
const LOWEST_M = -9000;
const HIGHEST_M = 22000;

const response = await fetch(`${SERVICE}?${QUERY}`);
if (!response.ok) throw new Error(`The elevation service answered ${response.status}`);
const sent = Buffer.from(await response.arrayBuffer());
const wanted = WIDTH * HEIGHT * 2;
// The service pads the grid with rows below the south pole; the planet is the first 256 rows.
if (sent.length < wanted) throw new Error(`The service sent ${sent.length} bytes of ${wanted}`);
const grid = sent.subarray(0, wanted);

let lowest = Infinity;
let highest = -Infinity;
for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
  const metres = grid.readInt16LE(index * 2);
  if (metres < LOWEST_M || metres > HIGHEST_M) {
    throw new Error(`Height ${metres} m at cell ${index} is not a height of Mars`);
  }
  lowest = Math.min(lowest, metres);
  highest = Math.max(highest, metres);
}

const folder = fileURLToPath(new URL('../public/globe/', import.meta.url));
mkdirSync(folder, { recursive: true });
writeFileSync(`${folder}relief.bin`, grid);
console.log(`Wrote ${WIDTH} x ${HEIGHT} heights, from ${lowest} m to ${highest} m`);
