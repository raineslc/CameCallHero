// Practice feedback: hit detection, star bands, meter zones and quiet check, next step,
// note shapes on the lane, lock labels.
import { describe, expect, it } from 'vitest';
import { CLIP_LEVEL, extractFeatures, frameGeometry, HOP_SEC, LiveFloor, NOTE_ABOVE_FLOOR_DB } from '../src/audio/features';
import {
  HOLD_SEC,
  LevelHold,
  LOUDEST_SAFE_DB,
  MAX_QUIET_FLOOR_DB,
  meterPos,
  meterZones,
  QUIET_BAD_TEXT,
  QUIET_OK_TEXT,
  quietCheck,
  REFERENCE_CREST_DB,
  ZONE_TEXT,
  zoneFor,
} from '../src/audio/meter';
import { chunkFrameDb } from '../src/audio/monitor';
import { checkTake, GATES, scoreTake } from '../src/audio/score';
import { callById, lockInfo, LOCK_NO_RECORDINGS, TURKEY_CALLS } from '../src/calls/turkey';
import { HIT, HIT_TOLERANCE_SEC, hitWindows, HitTracker, matchNotes, MISS, PENDING, STAR_BANDS, starsFor } from '../src/practice/hits';
import { makePlan, notesOf } from '../src/practice/plan';
import { nextStep, referenceLevels, SAME_AGAIN, tipsFor } from '../src/practice/tips';
import { readWav } from './wav';

const SR = 48000;
const load = (p: string) => readWav(new URL(`../public/${p}`, import.meta.url));
const unlocked = TURKEY_CALLS.filter((c) => !c.locked);
const refClips = unlocked.flatMap((c) => c.references.map((p) => ({ path: p, clip: load(p) })));

/** Quiet background with tone bursts [start, end, hz] (seconds). */
function bursts(total: number, notes: [number, number, number][]): Float32Array {
  const x = Float32Array.from({ length: Math.round(total * SR) }, (_, i) => 0.001 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
  for (const [a, b, hz] of notes) for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) x[i] += 0.5 * Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
}
const feats = (x: Float32Array) => extractFeatures({ samples: x, sampleRate: SR });

describe('hit windows', () => {
  it('widen each note by the tolerance, but never past the middle of the gap to a neighbour', () => {
    const { lo, hi } = hitWindows([
      { start: 1, end: 2 },
      { start: 2.1, end: 2.3 },
      { start: 4, end: 4.5 },
    ]);
    expect(lo[0]).toBeCloseTo(1 - HIT_TOLERANCE_SEC, 10);
    expect(hi[0]).toBeCloseTo(2.05, 10); // gap 0.1 s: midpoint, not end + tolerance
    expect(lo[1]).toBeCloseTo(2.05, 10);
    expect(hi[1]).toBeCloseTo(2.3 + HIT_TOLERANCE_SEC, 10);
    expect(lo[2]).toBeCloseTo(4 - HIT_TOLERANCE_SEC, 10);
    expect(hi[2]).toBeCloseTo(4.5 + HIT_TOLERANCE_SEC, 10);
    for (let i = 0; i < 2; i++) expect(hi[i]).toBeLessThanOrEqual(lo[i + 1]);
  });
  it('the tolerance covers at least half a mic chunk (2048 samples at 44.1 kHz)', () => {
    expect(HIT_TOLERANCE_SEC).toBeGreaterThanOrEqual(2048 / 44100 / 2);
  });
});

describe('HitTracker', () => {
  const notes = [
    { start: 1, end: 1.5 },
    { start: 2, end: 2.5 },
    { start: 3, end: 3.5 },
  ];
  /** Feeds chunks every 43 ms from 0 to `end`, active where `on(t)`. */
  const run = (tr: HitTracker, on: (t: number) => boolean, end = 5) => {
    for (let t = 0; t <= end; t += 0.043) tr.update(t, on(t));
    tr.finish(end);
    return Array.from(tr.state);
  };

  it('sound inside a note is a hit, silence a miss; counts and streaks follow', () => {
    const tr = new HitTracker(notes);
    const states = run(tr, (t) => (t > 1.1 && t < 1.4) || (t > 3.1 && t < 3.3));
    expect(states).toEqual([HIT, MISS, HIT]);
    expect([tr.hits, tr.misses, tr.streak, tr.bestStreak]).toEqual([2, 1, 1, 1]);
    tr.reset();
    expect(run(tr, () => true)).toEqual([HIT, HIT, HIT]);
    expect([tr.hits, tr.streak, tr.bestStreak]).toEqual([3, 3, 3]);
  });

  it('a sound late or early by up to the tolerance still hits; beyond it, misses', () => {
    const one = [{ start: 1, end: 1.2 }];
    const late = (by: number) => new HitTracker(one).update(1.2 + by, true);
    expect(late(HIT_TOLERANCE_SEC - 0.01)).toBe(true);
    const tr = new HitTracker(one);
    tr.update(1.2 + HIT_TOLERANCE_SEC + 0.01, true);
    expect(tr.state[0]).toBe(MISS);
    const early = new HitTracker(one);
    early.update(1 - HIT_TOLERANCE_SEC + 0.01, true);
    expect(early.state[0]).toBe(HIT);
    const tooEarly = new HitTracker(one);
    tooEarly.update(1 - HIT_TOLERANCE_SEC - 0.01, true);
    expect(tooEarly.state[0]).toBe(PENDING);
  });

  it('sound between notes hits nothing; one sound never hits two notes', () => {
    expect(run(new HitTracker(notes), (t) => t > 1.75 && t < 1.8)).toEqual([MISS, MISS, MISS]);
    const close = [
      { start: 1, end: 1.1 },
      { start: 1.2, end: 1.3 },
    ];
    const tr = new HitTracker(close);
    tr.update(1.14, true); // after note 1, inside its tolerance, but nearer note 2's middle gap
    expect(Array.from(tr.state)).toEqual([HIT, PENDING]);
    tr.update(1.16, true); // past the midpoint: note 2's window
    expect(Array.from(tr.state)).toEqual([HIT, HIT]);
  });

  it('records when each note was decided; ignores non-finite times', () => {
    const tr = new HitTracker(notes);
    expect(tr.update(NaN, true)).toBe(false);
    tr.update(1.2, true);
    expect(tr.decidedAt[0]).toBe(1.2);
    expect(Number.isNaN(tr.decidedAt[1])).toBe(true);
  });

  it('a reference played back hits every one of its own notes (gobble and yelp)', () => {
    for (const c of unlocked) {
      const f = extractFeatures(load(c.references[0]));
      const plan = makePlan(f, [f]);
      const tr = new HitTracker(plan.notes);
      // Activity per 43 ms chunk at the scorer's frame grid: the clip's first note lands at plan.callAt.
      const t0 = plan.callAt - f.span!.start * HOP_SEC;
      for (let i = 0; i < f.frameCount; i += 4) {
        let loud = -Infinity;
        for (let k = i; k < Math.min(f.frameCount, i + 4); k++) loud = Math.max(loud, f.rmsDb[k]);
        tr.update(t0 + (i + 2) * HOP_SEC, loud > f.noiseFloorDb + NOTE_ABOVE_FLOOR_DB);
      }
      tr.finish(plan.end);
      expect(tr.hits, c.id).toBe(plan.notes.length);
    }
  });

  it('silence misses every note', () => {
    const f = extractFeatures(load(callById('yelp').references[0]));
    const plan = makePlan(f, [f]);
    const tr = new HitTracker(plan.notes);
    for (let t = 0; t < plan.end; t += 0.043) tr.update(t, false);
    tr.finish(plan.end);
    expect(tr.misses).toBe(plan.notes.length);
    expect(tr.hits).toBe(0);
  });
});

describe('matchNotes (results)', () => {
  it('marks reference notes hit by overlapping take notes, and take notes that hit', () => {
    const ref = [
      { start: 1, end: 1.5 },
      { start: 2, end: 2.5 },
    ];
    const take = [
      { start: 1.55, end: 1.6 }, // inside note 1's tolerance
      { start: 3, end: 3.2 }, // extra
    ];
    expect(matchNotes(ref, take)).toEqual({ refHit: [true, false], takeHit: [true, false] });
    expect(matchNotes(ref, [])).toEqual({ refHit: [false, false], takeHit: [] });
  });
});

describe('stars', () => {
  it('bands: 1 below 20, then one more star every 20 points', () => {
    expect(STAR_BANDS).toEqual([0, 20, 40, 60, 80]);
    const cases: [number, number][] = [
      [0, 1],
      [19.9, 1],
      [20, 2],
      [39.9, 2],
      [40, 3],
      [60, 4],
      [79.9, 4],
      [80, 5],
      [100, 5],
    ];
    for (const [score, stars] of cases) expect(starsFor(score), String(score)).toBe(stars);
  });
  it('never outside 1..5, even for NaN or out-of-range scores', () => {
    for (const v of [NaN, Infinity, -Infinity, -5, 150]) {
      const s = starsFor(v);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });
});

describe('meter zones and quiet check (scorer thresholds)', () => {
  it('REFERENCE_CREST_DB is the smallest crest of the gobble and yelp references, rounded down to 0.1 dB', () => {
    const crests = refClips.map(({ clip }) => {
      const f = extractFeatures(clip);
      return 20 * Math.log10(f.peakSample) - f.peakDb;
    });
    const min = Math.min(...crests);
    expect(REFERENCE_CREST_DB).toBeLessThanOrEqual(min);
    expect(REFERENCE_CREST_DB).toBeGreaterThan(min - 0.1);
    expect(LOUDEST_SAFE_DB).toBeCloseTo(20 * Math.log10(CLIP_LEVEL) - REFERENCE_CREST_DB, 10);
    expect(MAX_QUIET_FLOOR_DB).toBeCloseTo(LOUDEST_SAFE_DB - GATES.minSnrDb, 10);
  });

  it('zones come from the gates: quiet below max(minPeakDb, floor + minSnrDb), loud from the clip-safe level', () => {
    expect(meterZones(null)).toEqual({ quietTop: GATES.minPeakDb, loudBottom: LOUDEST_SAFE_DB });
    expect(meterZones(-80).quietTop).toBe(GATES.minPeakDb);
    expect(meterZones(-40).quietTop).toBe(-40 + GATES.minSnrDb);
    // A floor too high for any call: no good zone left, never inverted.
    const z = meterZones(-10);
    expect(z.quietTop).toBe(z.loudBottom);
    const zones = meterZones(-60);
    expect(zoneFor(-50, 0.1, zones)).toBe('quiet');
    expect(zoneFor(-45, 0.1, zones)).toBe('good');
    expect(zoneFor(-20, 0.5, zones)).toBe('good');
    expect(zoneFor(LOUDEST_SAFE_DB, 0.5, zones)).toBe('loud');
    expect(zoneFor(-30, CLIP_LEVEL, zones)).toBe('loud'); // a clipped sample is loud at any level
    expect(zoneFor(NaN, 0, zones)).toBe('quiet');
    expect(ZONE_TEXT).toEqual({ quiet: 'Move closer', good: 'Good', loud: 'Back off' });
  });

  it('a level in the good zone passes the scorer’s loudness gates; one in the quiet zone does not', () => {
    for (const floor of [-70, -55, -40, -30]) {
      const z = meterZones(floor);
      const passes = (peakDb: number) => peakDb >= GATES.minPeakDb && peakDb - floor >= GATES.minSnrDb;
      if (z.quietTop < z.loudBottom) expect(passes(z.quietTop)).toBe(true);
      expect(passes(z.quietTop - 0.01)).toBe(false);
    }
  });

  it('quiet light agrees with the scorer: green exactly when a reference call can pass at that floor without clipping', () => {
    // Each reference scaled as loud as it can go without clipping.
    const loudest = refClips.map(({ clip }) => {
      const f0 = extractFeatures(clip);
      const g = (CLIP_LEVEL * 0.999) / f0.peakSample;
      return extractFeatures({ samples: clip.samples.map((v) => v * g), sampleRate: clip.sampleRate });
    });
    for (let floor = -40; floor <= -15; floor += 0.25) {
      if (Math.abs(floor - MAX_QUIET_FLOOR_DB) < 0.15) continue; // within the 0.1 dB crest rounding (+ the 0.999 margin)
      const anyPasses = loudest.some((f) => checkTake(f, floor) === null);
      expect(quietCheck(floor).ok, `floor ${floor}`).toBe(anyPasses);
    }
    expect(quietCheck(-60)).toEqual({ ok: true, text: QUIET_OK_TEXT });
    expect(quietCheck(-10)).toEqual({ ok: false, text: QUIET_BAD_TEXT });
    expect(quietCheck(NaN).ok).toBe(false);
  });

  it('meterPos is clamped to 0..1', () => {
    expect(meterPos(-100)).toBe(0);
    expect(meterPos(10)).toBe(1);
    expect(meterPos(-30)).toBeCloseTo(0.5, 10);
    expect(meterPos(NaN)).toBe(0);
  });

  it('LevelHold keeps the highest level for HOLD_SEC, then follows the input', () => {
    const h = new LevelHold();
    h.push(-20, 0.5, 0);
    expect(h.push(-50, 0.01, HOLD_SEC / 2)).toBe(-20);
    expect(h.peakSample).toBe(0.5);
    expect(h.push(-50, 0.01, HOLD_SEC + 0.01)).toBe(-50);
    expect(h.peakSample).toBe(0.01);
  });
});

describe('live measures match the scorer', () => {
  it('LiveFloor over the count-in equals extractFeatures(countIn).noiseFloorDb, fed in mic-sized chunks', () => {
    for (const { clip } of refClips.slice(0, 3)) {
      const n = Math.min(clip.samples.length, Math.round(3 * clip.sampleRate));
      const lf = new LiveFloor(clip.sampleRate, n);
      expect(lf.value()).toBeNull();
      for (let end = 2048; end < clip.samples.length + 2048; end += 2048) lf.update(clip.samples, Math.min(end, clip.samples.length));
      expect(lf.value()).toBe(extractFeatures({ samples: clip.samples.subarray(0, n), sampleRate: clip.sampleRate }).noiseFloorDb);
    }
  });

  it('chunkFrameDb is the loudest scorer frame inside the chunk', () => {
    const x = bursts(0.2, [[0.05, 0.1, 900]]);
    for (const len of [2048, 4096]) {
      const chunk = x.subarray(1000, 1000 + len);
      expect(chunkFrameDb(chunk, SR)).toBeCloseTo(extractFeatures({ samples: chunk, sampleRate: SR }).peakDb, 4); // the scorer stores float32
    }
    expect(chunkFrameDb(new Float32Array(0), SR)).toBe(-120);
    expect(chunkFrameDb(new Float32Array(frameGeometry(SR).fftSize / 2), SR)).toBe(-120);
  });
});

describe('next step', () => {
  const one = feats(bursts(3, [[0.5, 0.8, 800]]));
  const notes = (n: number) => feats(bursts(3 + n * 0.2, Array.from({ length: n }, (_, k) => [0.5 + k * 0.2, 0.6 + k * 0.2, 800] as [number, number, number])));

  it('names the measured note count: "Make 6 notes instead of 12"', () => {
    const take = notes(12);
    const ref = notes(6);
    const scores = { rhythm: 20, pitch: 60, tone: 60 };
    const levels = { rhythm: 50, pitch: 50, tone: 50 };
    const tips = tipsFor(scores, take, ref, levels);
    expect(nextStep(tips, scores, levels, { rhythm: 1, pitch: 1, tone: 1 })).toBe('Make 6 notes instead of 12');
  });

  it('picks the part that costs the total score most (weight x gap to the reference level)', () => {
    const scores = { rhythm: 40, pitch: 45, tone: 30 };
    const levels = { rhythm: 50, pitch: 50, tone: 50 };
    const tips = tipsFor(scores, one, one, levels);
    expect(nextStep(tips, scores, levels, { rhythm: 1, pitch: 1, tone: 1 })).toBe('Copy the sound of the turkey, not just the timing');
    // Rhythm weighted 3 (yelp): 3 x 10 > 1 x 20.
    expect(nextStep(tips, scores, levels, { rhythm: 3, pitch: 0.5, tone: 1 })).toBe('Copy when each note starts and how long it lasts');
    // Structure is part of rhythm on screen, so its weight counts for rhythm: (1 + 2) x 10 > 1 x 20.
    expect(nextStep(tips, scores, levels, { rhythm: 1, pitch: 1, tone: 1, structure: 2 })).toBe('Copy when each note starts and how long it lasts');
  });

  it('without reference levels, uses the gap to 100', () => {
    const scores = { rhythm: 90, pitch: 20, tone: 90 };
    const tips = tipsFor(scores, one, one, null);
    expect(nextStep(tips, scores, null, { rhythm: 1, pitch: 1, tone: 1 })).toBe("Follow where the turkey's call goes higher and lower");
  });

  it('all parts Good with nothing measured to change: do it again the same way', () => {
    const scores = { rhythm: 80, pitch: 80, tone: 80 };
    const levels = { rhythm: 50, pitch: 50, tone: 50 };
    expect(nextStep(tipsFor(scores, one, one, levels), scores, levels, { rhythm: 1, pitch: 1, tone: 1 })).toBe(SAME_AGAIN);
  });

  it('on real takes: a reference against the others always gives a non-empty step', () => {
    for (const c of unlocked) {
      const refs = c.references.map((p) => extractFeatures(load(p)));
      const levels = referenceLevels(refs, c.weights);
      refs.forEach((f, i) => {
        const others = refs.filter((_, j) => j !== i);
        const r = scoreTake(f, others, c.weights);
        const step = nextStep(tipsFor(r, f, others[r.bestReference], levels), r, levels, c.weights);
        expect(step.length).toBeGreaterThan(0);
      });
    }
  });
});

describe('note shapes on the lane', () => {
  it('start and end frequency are the medians of the first and last third (the scorer’s note-break thirds)', () => {
    // A falling glide note: 3000 Hz to 800 Hz over 0.3 s.
    const x = Float32Array.from({ length: SR * 2 }, (_, i) => 0.001 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
    let phase = 0;
    for (let i = Math.round(0.5 * SR); i < Math.round(0.8 * SR); i++) {
      const hz = 3000 + ((800 - 3000) * (i - 0.5 * SR)) / (0.3 * SR);
      phase += (2 * Math.PI * hz) / SR;
      x[i] += 0.5 * Math.sin(phase);
    }
    const [n] = notesOf(feats(x));
    expect(n.hzStart).toBeGreaterThan(2000);
    expect(n.hzEnd).toBeLessThan(1500);
    const [flat] = notesOf(feats(bursts(2, [[0.5, 0.8, 800]])));
    expect(Math.abs(flat.hzStart - 800)).toBeLessThan(50);
    expect(Math.abs(flat.hzEnd - 800)).toBeLessThan(50);
  });

  it('most yelp reference notes slant downward (the yelp break is visible on the lane)', () => {
    const all = callById('yelp').references.flatMap((p) => notesOf(extractFeatures(load(p))));
    const down = all.filter((n) => n.hzEnd < n.hzStart).length;
    expect(down / all.length).toBeGreaterThan(0.5);
  });
});

describe('lock labels', () => {
  it('kee kee run is "Coming soon" with a reason; calls without recordings say "Recordings needed"', () => {
    const kkr = lockInfo(callById('kee-kee-run'));
    expect(kkr.label).toBe('Coming soon');
    expect(kkr.reason).toContain('cannot yet tell it apart from a yelp');
    for (const id of ['cut', 'purr'] as const) expect(lockInfo(callById(id))).toEqual(LOCK_NO_RECORDINGS);
  });
});
