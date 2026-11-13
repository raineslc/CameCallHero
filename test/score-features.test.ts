// Phase 16 scorer parts: pulse rate (trills), raspiness (spectral flatness) and note level/length
// trend. Each is off unless its weight is set; the last block proves that every unlocked call
// scores exactly as it did before Phase 16.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type AudioClip, type Features } from '../src/audio/features';
import {
  combine,
  compare,
  partWeights,
  pulseShape,
  pulseSimilarity,
  raspDb,
  raspSimilarity,
  scoreTake,
  structureShape,
  structureSimilarity,
  trendShape,
  trendSimilarity,
  type Weights,
} from '../src/audio/score';
import { SPECIES } from '../src/calls/species';
import { readWav } from './wav';

const sr = 22050;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0.4 s of quiet noise, `body` seconds of sound from gen(t) (t in s), 0.4 s of quiet noise. */
function clip(body: number, gen: (t: number, r: () => number) => number, gain = 0.3, seed = 7): AudioClip {
  const r = rng(seed);
  const x = new Float32Array(Math.round((body + 0.8) * sr));
  for (let i = 0; i < x.length; i++) {
    const t = i / sr - 0.4;
    x[i] = gain * ((r() * 2 - 1) * 0.001 + (t >= 0 && t < body ? gen(t, r) : 0));
  }
  return { samples: x, sampleRate: sr };
}

const tone = (hz: number) => (t: number) => Math.sin(2 * Math.PI * hz * t);
/** A 700 Hz tone in pulses of `rate` per second; `floor` is the level between pulses (0 = silent gaps). */
const trill = (rate: number, floor: number) => (t: number) => {
  const phase = (t * rate) % 1;
  return (phase < 0.4 ? 1 : floor) * Math.sin(2 * Math.PI * 700 * t);
};

describe('pulse rate (trills)', () => {
  const split = extractFeatures(clip(2, trill(10, 0))); // 60 ms silent gaps: the note finder splits every pulse
  const joined = extractFeatures(clip(2, trill(10, 0.3))); // 10 dB dips: one long note
  const fast = extractFeatures(clip(2, trill(20, 0)));
  const smooth = extractFeatures(clip(2, tone(700)));

  it('measures the pulse rate whether the trill is one note or many', () => {
    expect(split.notes.length).toBeGreaterThan(15);
    expect(joined.notes.length).toBe(1);
    for (const f of [split, joined]) {
      const p = pulseShape(f);
      expect(p.rate).toBeGreaterThan(10 * 0.95);
      expect(p.rate).toBeLessThan(10 * 1.05);
      expect(p.strength).toBeGreaterThan(0.5);
    }
    expect(pulseShape(fast).rate).toBeGreaterThan(20 * 0.95);
    expect(pulseShape(fast).rate).toBeLessThan(20 * 1.05);
  });

  it('a steady tone has no pulse; no call gives none', () => {
    expect(pulseShape(smooth).strength).toBeLessThan(0.2);
    const none = extractFeatures({ samples: new Float32Array(sr), sampleRate: sr });
    expect(pulseShape(none)).toEqual({ rate: 0, strength: 0 });
  });

  it('does not depend on level', () => {
    const quiet = pulseShape(extractFeatures(clip(2, trill(10, 0.3), 0.01)));
    const loud = pulseShape(joined);
    expect(quiet.rate).toBeCloseTo(loud.rate, 6);
    expect(quiet.strength).toBeCloseTo(loud.strength, 2);
  });

  it('similarity: a split and a joined trill of one rate match better than two rates or a steady tone', () => {
    const a = pulseShape(split);
    const b = pulseShape(joined);
    expect(pulseSimilarity(a, a)).toBe(100);
    expect(pulseSimilarity(a, b)).toBeGreaterThan(pulseSimilarity(a, pulseShape(fast)));
    expect(pulseSimilarity(a, b)).toBeGreaterThan(pulseSimilarity(a, pulseShape(smooth)));
    expect(pulseSimilarity({ rate: 0, strength: 0 }, { rate: 0, strength: 0 })).toBe(100);
    expect(pulseSimilarity({ rate: NaN, strength: 0.5 }, { rate: 10, strength: NaN })).toBe(0);
  });
});

describe('raspiness (spectral flatness inside notes)', () => {
  const pure = extractFeatures(clip(0.6, tone(700)));
  const harmonic = extractFeatures(clip(0.6, (t) => [1, 2, 3, 4, 5, 6].reduce((s, k) => s + Math.sin(2 * Math.PI * 300 * k * t) / k, 0)));
  const noisy = extractFeatures(clip(0.6, (_, r) => r() * 2 - 1));

  it('orders a pure tone, a harmonic tone and noise from tonal to flat', () => {
    const [a, b, c] = [raspDb(pure), raspDb(harmonic), raspDb(noisy)];
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeGreaterThan(-6); // noise: near 0 dB
    expect(a).toBeLessThan(-20);
    for (const v of [a, b, c]) expect(v).toBeLessThanOrEqual(0);
  });

  it('does not depend on level', () => {
    const quiet = raspDb(extractFeatures(clip(0.6, (_, r) => r() * 2 - 1, 0.01)));
    expect(quiet).toBeCloseTo(raspDb(noisy), 0);
  });

  it('similarity: 100 for the same value, lower the further apart, 0 when a value is missing', () => {
    expect(raspSimilarity(-10, -10)).toBe(100);
    expect(raspSimilarity(-10, -12)).toBeGreaterThan(raspSimilarity(-10, -20));
    expect(raspSimilarity(NaN, -10)).toBe(0);
    const none = extractFeatures({ samples: new Float32Array(sr), sampleRate: sr });
    expect(raspDb(none)).toBeNaN();
  });
});

describe('note level and length trend', () => {
  /** Notes of 600 Hz at `levels` (dB, relative) and `lengths` (s), 0.15 s apart. */
  function series(levels: number[], lengths: number[], gain = 0.3): Features {
    const starts: number[] = [];
    let t = 0;
    for (const len of lengths) {
      starts.push(t);
      t += len + 0.15;
    }
    return extractFeatures(
      clip(
        t,
        (s) => {
          const k = starts.findIndex((a, i) => s >= a && s < a + lengths[i]);
          return k < 0 ? 0 : 10 ** (levels[k] / 20) * Math.sin(2 * Math.PI * 600 * s);
        },
        gain,
      ),
    );
  }
  const falling = series([0, -3, -6, -9, -12], [0.3, 0.25, 0.2, 0.15, 0.1]);
  const even = series([0, 0, 0, 0, 0], [0.2, 0.2, 0.2, 0.2, 0.2]);

  it('measures falling level and length across the notes', () => {
    expect(falling.notes).toHaveLength(5);
    const tr = trendShape(falling);
    expect(tr.level).toBeCloseTo(-12, 0);
    expect(tr.length).toBeCloseTo(Math.log(0.1 / 0.3), 0);
    const flat = trendShape(even);
    expect(Math.abs(flat.level)).toBeLessThan(0.5);
    expect(Math.abs(flat.length)).toBeLessThan(0.1);
  });

  it('a single note or no call has no trend', () => {
    expect(trendShape(series([0], [0.4]))).toEqual({ level: 0, length: 0 });
    expect(trendShape(extractFeatures({ samples: new Float32Array(sr), sampleRate: sr }))).toEqual({ level: 0, length: 0 });
  });

  it('does not depend on level (relative to the call, never absolute loudness)', () => {
    const quiet = trendShape(series([0, -3, -6, -9, -12], [0.3, 0.25, 0.2, 0.15, 0.1], 0.01));
    const loud = trendShape(falling);
    expect(quiet.level).toBeCloseTo(loud.level, 1);
    expect(quiet.length).toBeCloseTo(loud.length, 6);
  });

  it('similarity: 100 for the same trend, lower for a different one, never outside 0..100', () => {
    const a = trendShape(falling);
    expect(trendSimilarity(a, a)).toBe(100);
    expect(trendSimilarity(a, trendShape(even))).toBeLessThan(30);
    expect(trendSimilarity({ level: NaN, length: 0 }, a)).toBe(0);
  });
});

describe('weights: pulse and trend fold into rhythm, rasp into tone', () => {
  const a = extractFeatures(clip(2, trill(10, 0.3)));
  const b = extractFeatures(clip(2, trill(20, 0)));
  const base: Weights = { rhythm: 1, pitch: 1, tone: 1, structure: 1 };

  it('without the new weights (absent or 0), compare and partWeights are unchanged', () => {
    expect(compare(a, b, { ...base, pulse: 0, rasp: 0, trend: 0 })).toEqual(compare(a, b, base));
    expect(partWeights({ ...base, pulse: 0, rasp: 0, trend: 0 })).toEqual(partWeights(base));
  });

  it('with them, the total is the weighted mean of seven parts', () => {
    const w: Weights = { rhythm: 1, pitch: 2, tone: 1.5, structure: 0.5, pulse: 2, rasp: 1, trend: 3 };
    const plain = compare(a, b);
    const s = compare(a, b, w);
    const st = structureSimilarity(structureShape(a), structureShape(b));
    const pu = pulseSimilarity(pulseShape(a), pulseShape(b));
    const tr = trendSimilarity(trendShape(a), trendShape(b));
    const ra = raspSimilarity(raspDb(a), raspDb(b));
    expect(partWeights(w)).toEqual({ rhythm: 6.5, pitch: 2, tone: 2.5 });
    expect(s.rhythm).toBeCloseTo((plain.rhythm + 0.5 * st + 2 * pu + 3 * tr) / 6.5, 6);
    expect(s.tone).toBeCloseTo((1.5 * plain.tone + ra) / 2.5, 6);
    expect(s.pitch).toBe(plain.pitch);
    expect(combine(s, w)).toBeCloseTo((plain.rhythm + 0.5 * st + 2 * plain.pitch + 1.5 * plain.tone + 2 * pu + ra + 3 * tr) / 11, 6);
  });

  it('scores stay finite and in 0..100 for random input with every new weight', () => {
    const r = rng(9);
    const refs = [a, b];
    const sets: Weights[] = [
      { rhythm: 1, pitch: 1, tone: 1, pulse: 3 },
      { rhythm: 1, pitch: 1, tone: 1, rasp: 3 },
      { rhythm: 1, pitch: 1, tone: 1, trend: 3 },
      { rhythm: 0, pitch: 0, tone: 0, pulse: 1, rasp: 1, trend: 1 },
    ];
    for (let trial = 0; trial < 30; trial++) {
      const rate = [8000, 16000, 22050, 44100, 48000, 0, NaN][Math.floor(r() * 7)];
      const length = Math.floor(r() ** 2 * 2 * 48000);
      const kind = trial % 4;
      const samples = Float32Array.from({ length }, (_, i) => {
        if (kind === 0) return 0.3 * (r() * 2 - 1);
        if (kind === 1) return Math.floor(i / 700) % 2 ? 0.3 * Math.sin(i * 0.2) : 0;
        if (kind === 2) return r() < 0.01 ? NaN : 0.2 * (r() * 2 - 1);
        return r() * 4 - 2;
      });
      for (const w of sets) {
        const s = scoreTake({ samples, sampleRate: rate }, refs, w);
        for (const v of [s.score, s.rhythm, s.pitch, s.tone]) {
          expect(Number.isFinite(v), `trial ${trial}`).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('every unlocked call scores exactly as before Phase 16', () => {
  // Recorded on main before Phase 16 (commit 6920565): for each unlocked call, the leave-one-out
  // score of each reference and the score of every other clip of the species and of the turkey
  // wrong-call and junk fixtures, as [score, rhythm, pitch, tone, bestReference].
  const gold = JSON.parse(readFileSync(new URL('fixtures/unlocked-scores-phase15.json', import.meta.url), 'utf8')) as Record<string, Record<string, number[]>>;
  const root = new URL('..', import.meta.url);
  const unlocked = SPECIES.flatMap((sp) => sp.calls.filter((c) => !c.locked && c.references.length > 0).map((call) => ({ sp, call })));

  it('the recorded set covers the unlocked calls of Phase 15 (turkey, barred owl, great horned owl, elk calf)', () => {
    expect(Object.keys(gold).sort()).toEqual(
      ['barred-owl/inspection-call', 'barred-owl/two-phrase-hoot', 'elk/calf-call', 'great-horned-owl/territorial-hoot', 'turkey/gobble', 'turkey/yelp'].sort(),
    );
  });

  it.each(Object.keys(gold))('%s: byte-identical scores', (key) => {
    const entry = unlocked.find(({ sp, call }) => `${sp.id}/${call.id}` === key);
    expect(entry, key).toBeDefined();
    const { sp, call } = entry!;
    const load = (p: string) => extractFeatures(readWav(new URL(p, root)), { band: sp.band });
    const refs = call.references.map((p) => load(`public/${p}`));
    for (const [path, want] of Object.entries(gold[key])) {
      const i = call.references.indexOf(path);
      const s = i >= 0 ? scoreTake(refs[i], refs.filter((_, j) => j !== i), call.weights) : scoreTake(load(path), refs, call.weights);
      expect([s.score, s.rhythm, s.pitch, s.tone, s.bestReference], `${key} ${path}`).toEqual(want);
    }
  }, 60_000);
});

it('no call uses the Phase 16 parts yet (no locked call reached the margin with them, docs/STATUS.md)', () => {
  for (const sp of SPECIES)
    for (const c of sp.calls) for (const k of ['pulse', 'rasp', 'trend'] as const) expect(c.weights[k] ?? 0, `${sp.id}/${c.id} ${k}`).toBe(0);
});
