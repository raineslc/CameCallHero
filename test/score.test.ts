import { describe, expect, it } from 'vitest';
import { fft } from '../src/audio/fft';
import { extractFeatures, type AudioClip } from '../src/audio/features';
import { scoreTake, checkTake, combine, compare, type Weights } from '../src/audio/score';
import { TURKEY_CALLS, callById } from '../src/calls/turkey';
import { readWav } from './wav';

// mulberry32: seeded so failures reproduce.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gobble = callById('gobble');
const load = (rel: string) => readWav(new URL(`../${rel}`, import.meta.url));
const refs = gobble.references.slice(1).map((p) => extractFeatures(load(`public/${p}`)));
const take = load(`public/${gobble.references[0]}`);
const scaled = (c: AudioClip, k: number): AudioClip => ({ ...c, samples: c.samples.map((v) => v * k) });

describe('fft', () => {
  it('matches a naive DFT', () => {
    const r = rng(1);
    const n = 64;
    const x = Float64Array.from({ length: n }, () => r() * 2 - 1);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      let sr = 0;
      let si = 0;
      for (let t = 0; t < n; t++) {
        sr += x[t] * Math.cos((-2 * Math.PI * k * t) / n);
        si += x[t] * Math.sin((-2 * Math.PI * k * t) / n);
      }
      expect(re[k]).toBeCloseTo(sr, 9);
      expect(im[k]).toBeCloseTo(si, 9);
    }
  });

  it('rejects lengths that are not a power of two', () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe('score is always finite and within 0-100', () => {
  const weightSets: Weights[] = [gobble.weights, { rhythm: 1, pitch: 1, tone: 1 }, { rhythm: 0, pitch: 0, tone: 0 }];

  it('for random input (noise, tones, bursts, NaN, odd sample rates, odd lengths)', () => {
    const r = rng(42);
    for (let trial = 0; trial < 60; trial++) {
      const sampleRate = [8000, 16000, 22050, 44100, 48000, 0, NaN, 3][Math.floor(r() * 8)];
      const length = Math.floor(r() ** 2 * 3 * 48000);
      const kind = trial % 5;
      const amp = 10 ** (-3 * r());
      const samples = Float32Array.from({ length }, (_, i) => {
        if (kind === 0) return amp * (r() * 2 - 1);
        if (kind === 1) return amp * Math.sin(i * 0.05 * (1 + r() * 0.01));
        if (kind === 2) return Math.floor(i / 2000) % 3 === 0 ? amp * (r() * 2 - 1) : 0;
        if (kind === 3) return r() < 0.01 ? NaN : r() < 0.01 ? Infinity : amp * (r() * 2 - 1);
        return r() * 4 - 2; // beyond full scale
      });
      for (const w of weightSets) {
        const s = scoreTake({ samples, sampleRate }, refs, w);
        for (const v of [s.score, s.rhythm, s.pitch, s.tone]) {
          expect(Number.isFinite(v), `trial ${trial}: ${v}`).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('for empty and constant input', () => {
    for (const samples of [new Float32Array(0), new Float32Array(1), new Float32Array(44100).fill(0.5)]) {
      const s = scoreTake({ samples, sampleRate: 44100 }, refs, gobble.weights);
      expect(s.score).toBe(0);
      expect(s.rejected).not.toBeNull();
    }
  });

  it('combine() stays in range for any weights', () => {
    expect(combine({ rhythm: 100, pitch: 100, tone: 100 }, { rhythm: 0, pitch: 0, tone: 0 })).toBe(0);
    expect(combine({ rhythm: 100, pitch: 50, tone: 0 }, { rhythm: 1, pitch: 1, tone: 1 })).toBe(50);
  });
});

describe('take gates', () => {
  it('rejects a clipped take', () => {
    const s = scoreTake(scaled(take, 10), refs, gobble.weights);
    expect(s.rejected?.reason).toBe('clipped');
    expect(s.score).toBe(0);
  });

  it('rejects a too-quiet take', () => {
    expect(scoreTake(scaled(take, 0.0005), refs, gobble.weights).rejected?.reason).toBe('too-quiet');
  });

  it('rejects a take not clearly above the noise floor measured in the count-in', () => {
    const f = extractFeatures(take);
    expect(checkTake(f)).toBeNull();
    expect(checkTake(f, f.peakDb - 5)?.reason).toBe('too-noisy');
  });

  it('returns no-reference for a locked call', () => {
    const locked = TURKEY_CALLS.filter((c) => c.locked);
    expect(locked.map((c) => c.id)).toEqual(['yelp', 'cut', 'purr', 'kee-kee-run']);
    for (const c of locked) {
      expect(c.references).toEqual([]);
      expect(scoreTake(take, [], c.weights).rejected?.reason).toBe('no-reference');
    }
  });
});

describe('invariances', () => {
  const base = scoreTake(take, refs, gobble.weights);

  it('does not score absolute loudness (same take at -20 dB scores the same within 3 points)', () => {
    const quiet = scoreTake(scaled(take, 0.1), refs, gobble.weights);
    expect(quiet.rejected).toBeNull();
    expect(Math.abs(quiet.score - base.score)).toBeLessThan(3);
  });

  it('does not depend on when the call starts (0.5 s extra lead-in)', () => {
    const lead = new Float32Array(take.samples.length + 22050);
    lead.set(take.samples.subarray(0, 22050)); // reuse the clip's own lead-in noise
    lead.set(take.samples, 22050);
    const shifted = scoreTake({ samples: lead, sampleRate: take.sampleRate }, refs, gobble.weights);
    expect(Math.abs(shifted.score - base.score)).toBeLessThan(3);
  });
});

describe('normalization does not depend on sample rate or padding', () => {
  /** A 1 kHz tone of `toneSec` with `padSec` of silence on each side, 20 ms fades. */
  const tone = (sampleRate: number, toneSec: number, padSec: number): AudioClip => {
    const pad = Math.round(padSec * sampleRate);
    const n = Math.round(toneSec * sampleRate);
    const fade = Math.round(0.02 * sampleRate);
    const samples = new Float32Array(n + 2 * pad);
    for (let i = 0; i < n; i++) samples[pad + i] = 0.3 * Math.min(1, i / fade, (n - i) / fade) * Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
    return { samples, sampleRate };
  };

  it('the same tone at 44.1, 48, 16 and 8 kHz matches on tone', () => {
    const ref = extractFeatures(tone(44100, 1, 0.5));
    for (const rate of [48000, 16000, 8000]) {
      expect(compare(extractFeatures(tone(rate, 1, 0.5)), ref).tone, `${rate} Hz`).toBeGreaterThan(90);
    }
  });

  it('a long steady note is not normalized away when there is little background', () => {
    const ref = extractFeatures(tone(44100, 1.7, 0.5));
    const s = compare(extractFeatures(tone(44100, 1.7, 0.15)), ref);
    expect(s.tone).toBeGreaterThan(90);
  });
});
