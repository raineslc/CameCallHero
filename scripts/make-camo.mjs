// Draws the woodland camo tile for the header band and writes public/camo.png.
// Run: node scripts/make-camo.mjs
//
// Our own pattern (no third-party camo is copied): three seeded noise fields, each made of
// periodic value noise, so the tile repeats without seams. Each field is cut at a threshold
// into hard-edged shapes and the shapes are layered over the base colour, like printed
// woodland camo: olive base, then brown blobs, dark-green blobs, and thin black strands.
// Domain warping and fine octaves give the edges their ragged, organic look; the noise is
// stretched sideways so the shapes lie roughly horizontal. Colours come from the theme
// tokens --camo-1..4. Output is a 4-colour indexed PNG (a few kB), so the browser does no
// filter work at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 512; // px; shown at 256 CSS px (sharp on 2x screens)
const SEED = 20261112;

const css = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, 'i'))[1];
// Palette index: 0 olive (base), 1 brown, 2 dark green, 3 black.
const palette = ['camo-2', 'camo-3', 'camo-1', 'camo-4'].map((t) => Buffer.from(token(t), 'hex'));

/** mulberry32: small seeded PRNG, so the tile is the same on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise with cx x cy lattice cells per tile, wrapping at the tile edge. u, v in tile units (0..1). */
function periodicNoise(random, cx, cy) {
  const grid = Float64Array.from({ length: cx * cy }, random);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const mod = (n, m) => ((n % m) + m) % m;
  return (u, v) => {
    const x = u * cx;
    const y = v * cy;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const g = (i, j) => grid[mod(y0 + j, cy) * cx + mod(x0 + i, cx)];
    const top = g(0, 0) + (g(1, 0) - g(0, 0)) * fx;
    const bottom = g(0, 1) + (g(1, 1) - g(0, 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

/** Fractal sum of periodic octaves; cell counts are integers, so every octave tiles. */
function fbm(random, cx, cy, octaves, gain) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push([periodicNoise(random, cx << o, cy << o), gain ** o]);
  const total = layers.reduce((s, [, w]) => s + w, 0);
  return (u, v) => layers.reduce((s, [n, w]) => s + n(u, v) * w, 0) / total;
}

const random = rng(SEED);
// Sideways stretch: fewer cells across than down.
const warpU = fbm(random, 3, 4, 3, 0.5);
const warpV = fbm(random, 3, 4, 3, 0.5);
const fields = [fbm(random, 3, 5, 5, 0.55), fbm(random, 4, 6, 5, 0.55), fbm(random, 3, 5, 4, 0.4)];
const WARP = 0.09; // tile units

const values = fields.map(() => new Float64Array(SIZE * SIZE));
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE;
    const v = y / SIZE;
    const wu = u + (warpU(u, v) - 0.5) * WARP * 2;
    const wv = v + (warpV(u, v) - 0.5) * WARP * 2;
    fields.forEach((f, k) => (values[k][y * SIZE + x] = f(wu, wv)));
  }
}

/** Value below which the given fraction of the field lies. */
const quantile = (arr, q) => Float64Array.from(arr).sort()[Math.floor(q * (arr.length - 1))];
const brownCut = quantile(values[0], 1 - 0.42); // top 42 % of field 0
const greenCut = quantile(values[1], 1 - 0.34); // top 34 % of field 1
// Black: a thin band around the median of field 2 gives winding strands, not blobs.
const blackLo = quantile(values[2], 0.5 - 0.09);
const blackHi = quantile(values[2], 0.5 + 0.09);
// ...broken into separate pieces where field 0 is low, as on printed woodland camo.
const blackMask = quantile(values[0], 0.3);

const pixels = new Uint8Array(SIZE * SIZE);
for (let i = 0; i < pixels.length; i++) {
  let c = 0;
  if (values[0][i] > brownCut) c = 1;
  if (values[1][i] > greenCut) c = 2;
  if (values[2][i] > blackLo && values[2][i] < blackHi && values[0][i] > blackMask) c = 3;
  pixels[i] = c;
}

// Seam check: colour changes across the wrap edge should be about as common as between any
// two neighbouring columns / rows inside the tile. A seam shows up as a spike at the edge.
function changes(a, b) {
  let n = 0;
  for (let k = 0; k < SIZE; k++) if (pixels[a(k)] !== pixels[b(k)]) n++;
  return n;
}
let inner = 0;
for (let x = 0; x < SIZE - 1; x++) inner += changes((k) => k * SIZE + x, (k) => k * SIZE + x + 1);
for (let y = 0; y < SIZE - 1; y++) inner += changes((k) => y * SIZE + k, (k) => (y + 1) * SIZE + k);
const innerMean = inner / (2 * (SIZE - 1));
const edgeX = changes((k) => k * SIZE + SIZE - 1, (k) => k * SIZE);
const edgeY = changes((k) => (SIZE - 1) * SIZE + k, (k) => k);
if (Math.max(edgeX, edgeY) > 3 * innerMean + 4) {
  throw new Error(`seam: edge changes ${edgeX}/${edgeY} vs mean ${innerMean.toFixed(1)}`);
}

// Indexed PNG (colour type 3, 8 bit), filter 0 on every row.
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.set([8, 3, 0, 0, 0], 8);
const raw = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) raw.set(pixels.subarray(y * SIZE, (y + 1) * SIZE), y * (SIZE + 1) + 1);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('PLTE', Buffer.concat(palette)),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(new URL('../public/camo.png', import.meta.url), png);

const share = [0, 1, 2, 3].map((c) => ((pixels.filter((p) => p === c).length / pixels.length) * 100).toFixed(0));
console.log(`public/camo.png ${SIZE}x${SIZE}, ${png.length} bytes; olive/brown/green/black % ${share.join('/')}; seam ${edgeX}/${edgeY} vs ${innerMean.toFixed(1)}`);
