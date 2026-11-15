/**
 * A small PNG encoder, so a map overlay computed in the app (the slope classes of a terrain
 * model) can be shown as an image on the web and on phones alike, without a canvas.
 *
 * The image is indexed: one byte per pixel picks a colour from a short palette, and each colour
 * carries its own transparency. The pixel data is stored without compression (deflate "stored"
 * blocks), which is valid PNG and keeps the encoder short; the images are small.
 */

/** A palette colour: red, green, blue and alpha, each 0 to 255. */
export type PaletteColor = readonly [number, number, number, number];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** The pixel rows, each led by filter byte 0, wrapped in a zlib stream of stored blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let block = 0; block < blocks; block += 1) {
    const start = block * 65535;
    const length = Math.min(65535, raw.length - start);
    out[o++] = block === blocks - 1 ? 1 : 0;
    out[o++] = length & 0xff;
    out[o++] = length >>> 8;
    out[o++] = ~length & 0xff;
    out[o++] = (~length >>> 8) & 0xff;
    out.set(raw.subarray(start, start + length), o);
    o += length;
  }
  const checksum = adler32(raw);
  out[o++] = checksum >>> 24;
  out[o++] = (checksum >>> 16) & 0xff;
  out[o++] = (checksum >>> 8) & 0xff;
  out[o++] = checksum & 0xff;
  return out;
}

/**
 * Encodes an indexed image as PNG bytes.
 *
 * @param indices one palette index per pixel, row by row from the top
 */
export function encodeIndexedPng(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: readonly PaletteColor[],
): Uint8Array {
  const raw = new Uint8Array((width + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * (width + 1)] = 0;
    raw.set(indices.subarray(row * width, (row + 1) * width), row * (width + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 3; // indexed colour
  const chunks: [string, Uint8Array][] = [
    ['IHDR', header],
    ['PLTE', Uint8Array.from(palette.flatMap(([r, g, b]) => [r, g, b]))],
    ['tRNS', Uint8Array.from(palette.map(([, , , a]) => a))],
    ['IDAT', zlibStored(raw)],
    ['IEND', new Uint8Array(0)],
  ];
  const total = 8 + chunks.reduce((sum, [, data]) => sum + 12 + data.length, 0);
  const png = new Uint8Array(total);
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  let o = 8;
  for (const [type, data] of chunks) {
    const out = new DataView(png.buffer);
    out.setUint32(o, data.length);
    for (let i = 0; i < 4; i += 1) png[o + 4 + i] = type.charCodeAt(i);
    png.set(data, o + 8);
    out.setUint32(o + 8 + data.length, crc32(png, o + 4, o + 8 + data.length));
    o += 12 + data.length;
  }
  return png;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64[n & 63] : '=';
  }
  return out;
}

/** The image as a `data:` address an image component can show. */
export function pngDataUri(png: Uint8Array): string {
  return `data:image/png;base64,${toBase64(png)}`;
}
