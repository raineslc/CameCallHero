import { describe, expect, it } from 'vitest';
import { fft } from '../src/audio/fft';
import { extractFeatures, type AudioClip } from '../src/audio/features';
import {
  scoreTake,
  checkTake,
  combine,
  compare,
  compareNotes,
  noteShapes,
  partWeights,
  structureShape,
  structureSimilarity,
  type Weights,
} from '../src/audio/score';
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
  const weightSets: Weights[] = [
    gobble.weights,
    { rhythm: 1, pitch: 1, tone: 1 },
    { rhythm: 0, pitch: 0, tone: 0 },
    { rhythm: 3, pitch: 0.5, tone: 2, structure: 3 },
    { rhythm: 0, pitch: 0, tone: 0, structure: 1 },
  ];

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

  it('rejects a high note clipped in short flattened peaks (no 3-sample run)', () => {
    const sr = 44100;
    const samples = new Float32Array(3 * sr);
    for (let i = 0; i < sr; i++) samples[sr + i] = Math.max(-1, Math.min(1, 1.1 * Math.sin((2 * Math.PI * 4000 * i) / sr)));
    const f = extractFeatures({ samples, sampleRate: sr });
    expect(f.longestClipRun).toBeLessThan(3);
    expect(scoreTake({ samples, sampleRate: sr }, refs, gobble.weights).rejected?.reason).toBe('clipped');
  });

  it('accepts a sustained call with almost no background when the count-in floor is given', () => {
    const sr = 44100;
    const pad = Math.round(0.05 * sr);
    const samples = new Float32Array(sr + 2 * pad);
    for (let i = 0; i < sr; i++) samples[pad + i] = 0.3 * Math.sin((2 * Math.PI * 1000 * i) / sr);
    const s = scoreTake({ samples, sampleRate: sr }, refs, gobble.weights, { noiseFloorDb: -90 });
    expect(s.rejected).toBeNull();
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
    expect(locked.map((c) => c.id)).toEqual(['cut', 'purr', 'kee-kee-run']);
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

describe('per-note rhythm and break', () => {
  const sr = 44100;
  /** Notes of `len` s at onsets `at` (s); each glides from f0 to f1 Hz. Quiet noise in between. */
  function notes(at: number[], len: number, f0: number, f1: number): AudioClip {
    const r = rng(7);
    const total = at[at.length - 1] + len + 0.5;
    const x = new Float32Array(Math.round(total * sr));
    for (let i = 0; i < x.length; i++) x[i] = (r() * 2 - 1) * 0.001;
    for (const t0 of at) {
      let ph = 0;
      const n = Math.round(len * sr);
      for (let i = 0; i < n; i++) {
        const f = f0 + ((f1 - f0) * i) / n;
        ph += (2 * Math.PI * f) / sr;
        const env = Math.sin((Math.PI * i) / n);
        x[Math.round(t0 * sr) + i] += 0.3 * env * Math.sin(ph);
      }
    }
    return { samples: x, sampleRate: sr };
  }
  const even = extractFeatures(notes([0.5, 0.8, 1.1, 1.4], 0.12, 2200, 1200));
  // Same note count, length and total span, but uneven spacing: the case the old rhythm missed.
  const uneven = extractFeatures(notes([0.5, 0.68, 1.22, 1.4], 0.12, 2200, 1200));
  const flat = extractFeatures(notes([0.5, 0.8, 1.1, 1.4], 0.12, 1600, 1600));

  it('finds the notes', () => {
    expect(even.notes.length).toBe(4);
    expect(uneven.notes.length).toBe(4);
  });

  it('a downward glide has a positive break, a steady note about none', () => {
    for (const n of noteShapes(even)) expect(n.fall).toBeGreaterThan(2);
    for (const n of noteShapes(flat)) expect(Math.abs(n.fall)).toBeLessThan(1);
  });

  it('identical note sequences match exactly', () => {
    expect(compareNotes(noteShapes(even), noteShapes(even))).toEqual({ timing: 0, fall: 0 });
  });

  it('uneven spacing lowers rhythm; a missing break lowers pitch', () => {
    const self = compare(even, even);
    expect(compare(uneven, even).rhythm).toBeLessThan(self.rhythm - 10);
    expect(compare(flat, even).pitch).toBeLessThan(self.pitch - 10);
  });

  it('is finite and in 0..100 for an empty note list', () => {
    expect(compareNotes([], noteShapes(even))).toEqual({ timing: Infinity, fall: Infinity });
    const s = compare(extractFeatures({ samples: new Float32Array(sr), sampleRate: sr }), even);
    for (const v of [s.rhythm, s.pitch, s.tone]) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('structure (envelope autocorrelation, owl hoots)', () => {
  const sr = 22050;
  /** Steady 500 Hz notes [start, end] (s) over quiet noise. */
  function notes(spans: [number, number][], gain = 0.3): AudioClip {
    const r = rng(11);
    const total = spans[spans.length - 1][1] + 0.5;
    const x = new Float32Array(Math.round(total * sr));
    for (let i = 0; i < x.length; i++) x[i] = (r() * 2 - 1) * 0.001 * gain;
    for (const [a, b] of spans)
      for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) x[i] += gain * Math.sin((2 * Math.PI * 500 * i) / sr);
    return { samples: x, sampleRate: sr };
  }
  // Two identical phrases of four uneven notes, the second starting 1.7 s after the first.
  const phrase = (t: number): [number, number][] => [[t, t + 0.12], [t + 0.4, t + 0.52], [t + 0.8, t + 0.9], [t + 1.0, t + 1.3]];
  const twoPhrase = extractFeatures(notes([...phrase(0.4), ...phrase(2.1)]));
  // Four evenly spaced notes 0.35 s apart: shorter than the phrase window.
  const even = extractFeatures(notes([0, 1, 2, 3].map((k) => [0.4 + 0.35 * k, 0.52 + 0.35 * k] as [number, number])));
  const single = extractFeatures(notes([[0.4, 1.2]]));

  it('a repeated phrase scores high on phrase; evenly spaced notes high on notes', () => {
    const a = structureShape(twoPhrase);
    const b = structureShape(even);
    // At a 1.7 s lag only the last 1.2 s of the 2.9 s call overlaps itself, so ~0.4 is the most a
    // perfect repeat can reach here.
    expect(a.phrase).toBeGreaterThan(0.35);
    expect(a.phrase).toBeGreaterThan(a.notes);
    expect(b.notes).toBeGreaterThan(0.5);
    expect(b.phrase).toBe(0); // the call is shorter than the phrase window
    expect(a.notes).toBeLessThan(b.notes);
  });

  it('a single note and no call give no structure, and every value stays in [0, 1]', () => {
    expect(structureShape(single).phrase).toBe(0);
    const none = extractFeatures({ samples: new Float32Array(sr), sampleRate: sr });
    expect(none.span).toBeNull();
    expect(structureShape(none)).toEqual({ notes: 0, phrase: 0 });
    for (const f of [twoPhrase, even, single]) {
      const s = structureShape(f);
      for (const v of [s.notes, s.phrase]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not depend on level', () => {
    const loud = structureShape(twoPhrase);
    const quiet = structureShape(extractFeatures(notes([...phrase(0.4), ...phrase(2.1)], 0.01)));
    expect(quiet.notes).toBeCloseTo(loud.notes, 2);
    expect(quiet.phrase).toBeCloseTo(loud.phrase, 2);
  });

  it('similarity: 100 for the same shape, lower the more they differ, never outside 0..100', () => {
    const a = structureShape(twoPhrase);
    const b = structureShape(even);
    expect(structureSimilarity(a, a)).toBe(100);
    expect(structureSimilarity(a, b)).toBeLessThan(50);
    expect(structureSimilarity({ notes: 0, phrase: 0 }, { notes: 0.1, phrase: 0 })).toBeGreaterThan(
      structureSimilarity({ notes: 0, phrase: 0 }, { notes: 0.5, phrase: 0 }),
    );
    expect(structureSimilarity({ notes: NaN, phrase: 0 }, { notes: 0, phrase: 0 })).toBe(0);
  });

  it('without a structure weight, compare and combine are unchanged (turkey calls)', () => {
    const w = { rhythm: 2, pitch: 1, tone: 1 };
    expect(compare(twoPhrase, even, w)).toEqual(compare(twoPhrase, even));
    expect(compare(twoPhrase, even, { ...w, structure: 0 })).toEqual(compare(twoPhrase, even));
    expect(partWeights(w)).toEqual(w);
    const s = { rhythm: 80, pitch: 40, tone: 60 };
    expect(combine(s, w)).toBeCloseTo((2 * 80 + 40 + 60) / 4, 10);
  });

  it('with a structure weight, rhythm blends in structure and the total equals four weighted parts', () => {
    const w = { rhythm: 1, pitch: 1, tone: 1, structure: 3 };
    const plain = compare(twoPhrase, even);
    const withS = compare(twoPhrase, even, w);
    const sim = structureSimilarity(structureShape(twoPhrase), structureShape(even));
    expect(withS.rhythm).toBeCloseTo(0.25 * plain.rhythm + 0.75 * sim, 6);
    expect(withS.pitch).toBe(plain.pitch);
    expect(withS.tone).toBe(plain.tone);
    expect(partWeights(w)).toEqual({ rhythm: 4, pitch: 1, tone: 1 });
    expect(combine(withS, w)).toBeCloseTo((plain.rhythm + 3 * sim + plain.pitch + plain.tone) / 6, 6);
    // The same call scores higher against itself than against a different structure.
    expect(compare(twoPhrase, twoPhrase, w).rhythm).toBeGreaterThan(withS.rhythm);
  });
});
