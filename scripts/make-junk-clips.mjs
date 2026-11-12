// Generates the synthetic junk clips used by the calibration test (Phase 2):
// silence, white noise, wind-like noise, hand-clap-like bursts, pink noise and a tone sweep.
// All are made from code here, so they carry no third-party license (CC0, this repo).
// Deterministic: a seeded PRNG gives byte-identical files on every run.
// Usage: node scripts/make-junk-clips.mjs
// shortcut: no real speech clip (no allowed-license speech found/fetched); add a CC0 speech
// recording if the calibration test needs one.
import { mkdirSync, writeFileSync } from 'node:fs';

const SR = 44100;
const OUT = new URL('../test/fixtures/junk/', import.meta.url);

let seed = 12345;
const rand = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rand() * 2 - 1;

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

const len = (sec) => Math.round(sec * SR);

const silence = new Float32Array(len(2));

const white = Float32Array.from({ length: len(2) }, () => 0.1 * noise());

// Wind: one-pole low-pass noise with slow gusts.
let lp = 0;
const wind = Float32Array.from({ length: len(3) }, (_, i) => {
  lp += 0.02 * (noise() - lp);
  const gust = 0.5 + 0.5 * Math.sin((2 * Math.PI * 0.4 * i) / SR) ** 2;
  return 3 * lp * gust;
});

// Claps: three short noise bursts with ~8 ms exponential decay, 0.5 s apart, after 0.5 s quiet.
const claps = new Float32Array(len(2));
for (const at of [0.5, 1.0, 1.5]) {
  const start = len(at);
  for (let i = 0; i < len(0.08); i++) claps[start + i] += 0.6 * noise() * Math.exp(-i / len(0.008));
}

// Pink noise (Paul Kellet's economy filter on white noise), steady level.
// Generated after the clips above so their PRNG sequence, and bytes, stay unchanged.
let b0 = 0, b1 = 0, b2 = 0;
const pink = Float32Array.from({ length: len(2) }, () => {
  const w = noise();
  b0 = 0.99765 * b0 + w * 0.099046;
  b1 = 0.963 * b1 + w * 0.2965164;
  b2 = 0.57 * b2 + w * 1.0526913;
  return 0.05 * (b0 + b1 + b2 + w * 0.1848);
});

// Tone sweep: 0.5 s quiet, then a 1.2 s exponential sine sweep 300 Hz -> 3 kHz, 20 ms fades.
const sweep = new Float32Array(len(2));
{
  const start = len(0.5), n = len(1.2), f0 = 300, f1 = 3000, k = Math.log(f1 / f0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, T = n / SR;
    const phase = (2 * Math.PI * f0 * T * (Math.exp((t / T) * k) - 1)) / k;
    const fade = Math.min(1, i / len(0.02), (n - i) / len(0.02));
    sweep[start + i] = 0.3 * fade * Math.sin(phase);
  }
}

mkdirSync(OUT, { recursive: true });
for (const [name, s] of Object.entries({ silence, 'white-noise': white, wind, claps, 'pink-noise': pink, 'tone-sweep': sweep })) {
  writeFileSync(new URL(`${name}.wav`, OUT), wav(s));
  console.log(`wrote test/fixtures/junk/${name}.wav`);
}
