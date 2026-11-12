import { describe, expect, it } from 'vitest';
import { countNotes, extractFeatures, findNotes, HOP_SEC, LiveNoteCounter, MAX_HZ, MIN_HZ, type Features } from '../src/audio/features';
import { scoreTake, type SubScores } from '../src/audio/score';
import { LivePitch } from '../src/audio/pitch';
import { callById } from '../src/calls/turkey';
import { CLICK_INTERVAL_SEC, latencyFromTaps, MATCH_WINDOW_MS } from '../src/practice/latency';
import { COUNT_IN_SEC, LEAD_SEC, TAIL_SEC, laneY, makePlan, noteTarget, notesOf, pitchRange, pitchX, spanSeconds, targetText } from '../src/practice/plan';
import { loadBest, loadLatency, saveBest, saveLatency } from '../src/practice/storage';
import { CLOSE_BAND, PART_LABELS, referenceLevels, tipsFor, verdictFor, type Verdict } from '../src/practice/tips';
import { takeNotes } from '../src/ui/overlay';
import { readWav } from './wav';

const SR = 48000;
const sine = (seconds: number, hz: number, amp = 0.5, sr = SR) =>
  Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));
/** Quiet background with tone bursts at [start, end) seconds. */
function bursts(total: number, notes: [number, number, number][]): Float32Array {
  const x = Float32Array.from({ length: Math.round(total * SR) }, (_, i) => 0.001 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
  for (const [a, b, hz] of notes) for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) x[i] += 0.5 * Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
}
const feats = (x: Float32Array) => extractFeatures({ samples: x, sampleRate: SR });

const gobble = callById('gobble');
const refs = gobble.references.map((p) => extractFeatures(readWav(new URL(`../public/${p}`, import.meta.url))));

class MemStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
const throwing = {
  getItem(): string | null {
    throw new Error('blocked');
  },
  setItem(): void {
    throw new Error('blocked');
  },
};

describe('LivePitch', () => {
  it('finds a tone within one FFT bin, at 44.1 and 48 kHz', () => {
    for (const sr of [44100, 48000]) {
      const p = new LivePitch(sr);
      const x = sine(0.1, 1200, 0.5, sr);
      for (let i = 0; i < x.length; i += 512) p.push(x.subarray(i, i + 512));
      expect(Math.abs(p.dominantHz() - 1200)).toBeLessThanOrEqual(sr / p.size);
    }
  });
  it('uses only the newest samples', () => {
    const p = new LivePitch(SR);
    p.push(sine(0.1, 500));
    p.push(sine(0.1, 3000));
    expect(Math.abs(p.dominantHz() - 3000)).toBeLessThanOrEqual(SR / p.size);
  });
  it('returns 0 before a full window, and for silence or NaN', () => {
    const p = new LivePitch(SR);
    p.push(sine(0.01, 1000));
    expect(p.dominantHz()).toBe(0);
    const q = new LivePitch(SR);
    q.push(new Float32Array(4096).fill(NaN));
    expect(q.dominantHz()).toBe(0);
  });
  it('stays in the scorer’s frequency range', () => {
    const p = new LivePitch(SR);
    p.push(sine(0.1, 60));
    const hz = p.dominantHz();
    expect(hz === 0 || (hz >= MIN_HZ && hz <= MAX_HZ)).toBe(true);
  });
});

describe('practice plan', () => {
  it('lays a two-note call on the timeline after the count-in', () => {
    const f = feats(bursts(3, [[0.5, 0.8, 800], [1.0, 1.2, 1600]]));
    expect(f.notes).toHaveLength(2);
    const plan = makePlan(f, [f]);
    expect(plan.performStart).toBe(COUNT_IN_SEC);
    expect(plan.callAt).toBe(COUNT_IN_SEC + LEAD_SEC);
    expect(plan.notes).toHaveLength(2);
    expect(plan.notes[0].start).toBeCloseTo(plan.callAt, 5);
    expect(plan.notes[1].end - plan.notes[0].start).toBeCloseTo(spanSeconds(f), 5);
    expect(Math.abs(plan.notes[0].hz - 800)).toBeLessThan(50);
    expect(Math.abs(plan.notes[1].hz - 1600)).toBeLessThan(50);
    expect(plan.end).toBeCloseTo(plan.callAt + spanSeconds(f) + TAIL_SEC, 5);
    expect(pitchX(plan.notes[0].hz, plan.loHz, plan.hiHz)).toBeLessThan(pitchX(plan.notes[1].hz, plan.loHz, plan.hiHz));
  });
  it('gobble references (1–2 notes): every note on the lane, take long enough for the longest reference', () => {
    const plan = makePlan(refs[0], refs);
    expect(plan.notes.length).toBe(refs[0].notes.length);
    const longest = Math.max(...refs.map(spanSeconds));
    expect(plan.end).toBeCloseTo(plan.callAt + longest + TAIL_SEC, 5);
    for (const n of plan.notes) {
      expect(n.end).toBeGreaterThan(n.start);
      expect(n.hz).toBeGreaterThan(0);
      const x = pitchX(n.hz, plan.loHz, plan.hiHz);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
    expect(plan.loHz).toBeGreaterThanOrEqual(MIN_HZ);
    expect(plan.hiHz).toBeLessThanOrEqual(MAX_HZ);
  });
  it('pitch axis falls back to the full range without pitched notes', () => {
    expect(pitchRange([feats(new Float32Array(SR))])).toEqual([MIN_HZ, MAX_HZ]);
    expect(notesOf(feats(new Float32Array(SR)))).toEqual([]);
  });
  it('pitchX is clamped and finite for any input', () => {
    expect(pitchX(100, 200, 4000)).toBe(0);
    expect(pitchX(9000, 200, 4000)).toBe(1);
    expect(pitchX(0, 200, 4000)).toBe(0.5);
    expect(pitchX(NaN, 200, 4000)).toBe(0.5);
    expect(pitchX(1000, 4000, 200)).toBe(0.5);
  });
  it('laneY puts `now` on the hit line and the future above it', () => {
    expect(laneY(5, 5, 300, 100)).toBe(300);
    expect(laneY(6, 5, 300, 100)).toBe(200);
    expect(laneY(4, 5, 300, 100)).toBe(400);
  });
  it('take notes are shifted by the count-in and back by the latency', () => {
    const f = feats(bursts(2, [[0.5, 0.8, 800]]));
    const plan = makePlan(f, [f]);
    const [n] = takeNotes(f, plan, 0.1);
    expect(n.start).toBeCloseTo(plan.performStart + f.notes[0].start * HOP_SEC - 0.1, 5);
  });
});

describe('latencyFromTaps', () => {
  const clicks = [0, 1, 2, 3].map((k) => 800 + k * CLICK_INTERVAL_SEC * 1000);
  const at = (offsets: number[]) => offsets.map((o, k) => clicks[k] + o);
  it('median delay of the taps that match a click', () => {
    expect(latencyFromTaps(clicks, at([100, 150, 100, 100]))).toBe(100);
    expect(latencyFromTaps(clicks, at([100, 100, 120]))).toBe(100);
  });
  it('early taps count as 0', () => {
    expect(latencyFromTaps(clicks, at([-50, -50, -50, -50]))).toBe(0);
  });
  it('null when too few taps line up', () => {
    expect(CLICK_INTERVAL_SEC * 1000).toBeGreaterThan(2 * MATCH_WINDOW_MS);
    expect(latencyFromTaps(clicks, [])).toBeNull();
    expect(latencyFromTaps(clicks, at([100, 100]))).toBeNull();
    // Off-beat: halfway between clicks.
    expect(latencyFromTaps(clicks, at([1, 1, 1, 1].map(() => (CLICK_INTERVAL_SEC * 1000) / 2)))).toBeNull();
  });
  it('one tap does not count for two clicks', () => {
    expect(latencyFromTaps(clicks, [clicks[0] + 10, clicks[0] + 11, clicks[0] + 12])).toBeNull();
  });
});

describe('storage', () => {
  it('keeps the best rounded score per call', () => {
    const s = new MemStore();
    expect(loadBest('gobble', s)).toBeNull();
    expect(saveBest('gobble', 61.4, s)).toBe(true);
    expect(loadBest('gobble', s)).toBe(61);
    expect(saveBest('gobble', 61.2, s)).toBe(false); // shown as 61 too: not a new best
    expect(saveBest('gobble', 50, s)).toBe(false);
    expect(saveBest('gobble', 80, s)).toBe(true);
    expect(loadBest('gobble', s)).toBe(80);
    expect(loadBest('yelp', s)).toBeNull();
  });
  it('ignores invalid scores and stored junk', () => {
    const s = new MemStore();
    for (const v of [NaN, -1, 101, Infinity]) expect(saveBest('gobble', v, s)).toBe(false);
    s.setItem('camecallhero.best.gobble', 'abc');
    expect(loadBest('gobble', s)).toBeNull();
    s.setItem('camecallhero.best.gobble', '250');
    expect(loadBest('gobble', s)).toBeNull();
  });
  it('survives storage that throws or is missing', () => {
    expect(loadBest('gobble', throwing)).toBeNull();
    expect(saveBest('gobble', 50, throwing)).toBe(false);
    expect(loadLatency(throwing)).toBeNull();
    expect(saveLatency(100, throwing)).toBe(false);
    expect(loadBest('gobble', null)).toBeNull();
    expect(saveLatency(100, null)).toBe(false);
  });
  it('stores a plausible latency only', () => {
    const s = new MemStore();
    expect(saveLatency(123.4, s)).toBe(true);
    expect(loadLatency(s)).toBe(123);
    expect(saveLatency(-5, s)).toBe(false);
    expect(saveLatency(10_000, s)).toBe(false);
    s.setItem('camecallhero.latencyMs', '9999');
    expect(loadLatency(s)).toBeNull();
  });
});

/** Quiet background with gliding tone bursts [start, end, fromHz, toHz] (seconds, Hz). */
function glides(total: number, notes: [number, number, number, number][]): Float32Array {
  const x = bursts(total, []);
  for (const [a, b, f0, f1] of notes) {
    let phase = 0;
    for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) {
      const k = (i / SR - a) / (b - a);
      phase += (2 * Math.PI * (f0 + (f1 - f0) * k)) / SR;
      x[i] += 0.5 * Math.sin(phase);
    }
  }
  return x;
}
const phoneYelp = extractFeatures(readWav(new URL('./fixtures/phone/yelp-mouth-1.wav', import.meta.url)));
const yelp = callById('yelp');
const yelpRefs = yelp.references.map((p) => extractFeatures(readWav(new URL(`../public/${p}`, import.meta.url))));
const levels: SubScores = { rhythm: 50, pitch: 50, tone: 50 };
const at = (v: Verdict): SubScores => {
  const x = v === 'Good' ? 60 : v === 'Close' ? 40 : 10;
  return { rhythm: x, pitch: x, tone: x };
};
const line = (t: ReturnType<typeof tipsFor>, part: 'rhythm' | 'pitch' | 'tone') => t.find((x) => x.part === part)!;

describe('tips', () => {
  const one = feats(bursts(3, [[0.5, 0.8, 800]]));
  const long = feats(bursts(4, [[0.5, 2.0, 800]]));
  const two = feats(bursts(3, [[0.5, 0.62, 800], [0.68, 0.8, 800]]));
  const high = feats(bursts(3, [[0.5, 0.8, 1600]]));
  const low = feats(bursts(3, [[0.5, 0.8, 400]]));
  const falling = feats(glides(3, [[0.5, 0.8, 3000, 800], [1.1, 1.4, 3000, 800]]));
  const level = feats(glides(3, [[0.5, 0.8, 1500, 1500], [1.1, 1.4, 1500, 1500]]));

  it('verdicts: Good at the reference level, Close within CLOSE_BAND below, Needs work under that', () => {
    expect(verdictFor(50, 50)).toBe('Good');
    expect(verdictFor(80, 50)).toBe('Good');
    expect(verdictFor(49.9, 50)).toBe('Close');
    expect(verdictFor(50 - CLOSE_BAND, 50)).toBe('Close');
    expect(verdictFor(50 - CLOSE_BAND - 0.1, 50)).toBe('Needs work');
  });

  it('reference levels are the lowest leave-one-out sub-scores; null with one reference', () => {
    const lv = referenceLevels(yelpRefs, yelp.weights)!;
    const loo = yelpRefs.map((f, i) => scoreTake(f, yelpRefs.filter((_, j) => j !== i), yelp.weights));
    for (const p of ['rhythm', 'pitch', 'tone'] as const) expect(lv[p]).toBeCloseTo(Math.min(...loo.map((r) => r[p])), 10);
    expect(referenceLevels(yelpRefs.slice(0, 1), yelp.weights)).toBeNull();
  });

  it('one line per part with plain labels, in order', () => {
    const t = tipsFor(at('Close'), one, one, levels);
    expect(t.map((x) => x.label)).toEqual(['Timing & notes', 'High/low', 'Sound']);
    expect(PART_LABELS).toEqual({ rhythm: 'Timing & notes', pitch: 'High/low', tone: 'Sound' });
    for (const v of ['Good', 'Close', 'Needs work'] as const) expect(tipsFor(at(v), one, one, levels).map((x) => x.verdict)).toEqual([v, v, v]);
    expect(tipsFor(at('Good'), one, one, null).map((x) => x.verdict)).toEqual([null, null, null]);
  });

  it('timing: states measured note counts and lengths, then what to change', () => {
    let t = line(tipsFor(at('Needs work'), long, one, levels), 'rhythm').text;
    expect(t).toMatch(/^You made 1 note lasting 1\.5 seconds\. The closest turkey recording has 1 note lasting 0\.3 seconds\./);
    expect(t).toContain('Make the whole call shorter.');
    expect(line(tipsFor(at('Needs work'), one, long, levels), 'rhythm').text).toContain('Make the whole call longer.');
    t = line(tipsFor(at('Close'), two, one, levels), 'rhythm').text;
    expect(t).toContain('You made 2 notes in 0.3 seconds');
    expect(t).toContain('Make 1 fewer note.');
    expect(line(tipsFor(at('Close'), one, two, levels), 'rhythm').text).toContain('Make 1 more note.');
    expect(line(tipsFor(at('Close'), one, one, levels), 'rhythm').text).toContain('copy when each note starts');
    expect(line(tipsFor(at('Good'), one, one, levels), 'rhythm').text).toContain('Keep it up.');
    expect(line(tipsFor(at('Good'), two, one, levels), 'rhythm').text).toContain('To get even closer: make 1 fewer note.');
  });

  it('high/low: says higher or deeper only when measured 2+ semitones apart', () => {
    expect(line(tipsFor(at('Close'), high, one, levels), 'pitch').text).toContain("Your call was higher than the turkey's. Make it deeper.");
    expect(line(tipsFor(at('Close'), low, one, levels), 'pitch').text).toContain("Your call was deeper than the turkey's. Make it higher.");
    expect(line(tipsFor(at('Close'), one, one, levels), 'pitch').text).toBe("Listen again and follow where the turkey's call goes higher and lower.");
    expect(line(tipsFor(at('Good'), one, one, levels), 'pitch').text).toBe('Keep it up.');
  });

  it('high/low: per-note drop from high to low, both directions', () => {
    expect(line(tipsFor(at('Close'), level, falling, levels), 'pitch').text).toContain(
      'Each turkey note starts high and drops lower. Yours did not drop. Let each note break downward.',
    );
    expect(line(tipsFor(at('Close'), falling, level, levels), 'pitch').text).toContain("Your notes drop from high to low more than the turkey's.");
    // Owner's phone yelp (mouth call) against the closest yelp reference: measured flat, references break downward.
    const r = scoreTake(phoneYelp, yelpRefs, yelp.weights);
    const t = line(tipsFor(r, phoneYelp, yelpRefs[r.bestReference], referenceLevels(yelpRefs, yelp.weights)), 'pitch').text;
    expect(t).toContain('Each turkey note starts high and drops lower. Yours did not drop.');
  });

  it('sound: no direction is claimed (the measure has none)', () => {
    expect(line(tipsFor(at('Needs work'), one, one, levels), 'tone').text).toBe('Listen again and copy the sound of the turkey, not just the timing.');
    expect(line(tipsFor(at('Good'), one, one, levels), 'tone').text).toBe('Keep it up.');
  });

  it('no jargon in any tip', () => {
    const takes = [one, long, two, high, low, falling, level, phoneYelp, ...yelpRefs, ...refs];
    const texts: string[] = [];
    for (const take of takes)
      for (const ref of [one, falling, level, ...yelpRefs, refs[0]])
        for (const v of ['Good', 'Close', 'Needs work'] as const)
          for (const lv of [levels, null]) for (const t of tipsFor(at(v), take, ref, lv)) texts.push(`${t.label} ${t.text}`);
    for (const text of texts) {
      expect(text).not.toMatch(/semitone|spectral|centroid/i);
      expect(text).not.toMatch(/pitch|tone\b|rhythm|frequenc|\bhz\b|dominant|\bmel\b|decibel|\bdb\b/i);
    }
  });
});

describe('note target', () => {
  it('states the shown reference note count and length', () => {
    const t = noteTarget(yelpRefs[0]);
    expect(t.notes).toBe(yelpRefs[0].notes.length);
    expect(t.seconds).toBeCloseTo(spanSeconds(yelpRefs[0]), 10);
    expect(targetText({ notes: 10, seconds: 3.004 })).toBe('Make 10 notes in about 3.0 seconds.');
    expect(targetText({ notes: 1, seconds: 0.95 })).toMatch(/^Make 1 note lasting about (0\.9|1\.0) seconds\.$/);
  });
});

describe('live note count', () => {
  const clips = [
    ...gobble.references.map((p) => readWav(new URL(`../public/${p}`, import.meta.url))),
    ...yelp.references.map((p) => readWav(new URL(`../public/${p}`, import.meta.url))),
    readWav(new URL('./fixtures/phone/yelp-mouth-1.wav', import.meta.url)),
    ...['claps', 'tone-sweep', 'white-noise', 'silence'].map((n) => readWav(new URL(`./fixtures/junk/${n}.wav`, import.meta.url))),
  ];

  it('countNotes matches findNotes on every prefix', () => {
    for (const c of clips) {
      const f = extractFeatures(c);
      for (let n = 0; n <= f.frameCount; n += 7) {
        const prefix = f.rmsDb.subarray(0, n);
        const peak = n ? Math.max(...prefix) : -120;
        expect(countNotes(f.rmsDb, n, f.noiseFloorDb, peak)).toBe(findNotes(prefix, f.noiseFloorDb, peak).length);
      }
    }
  });

  it('after the last chunk, equals the note count the scorer sees (same floor, same take start)', () => {
    for (const c of clips)
      for (const chunk of [128, 2048]) {
        const floor = extractFeatures(c).noiseFloorDb + 3;
        const lead = 4321; // samples before the take (the count-in), not counted
        const buf = new Float32Array(lead + c.samples.length);
        buf.set(c.samples, lead);
        const counter = new LiveNoteCounter(c.sampleRate, c.samples.length, floor);
        let n = 0;
        for (let end = lead; end < buf.length; ) {
          end = Math.min(buf.length, end + chunk);
          n = counter.update(buf, lead, end);
        }
        expect(n).toBe(extractFeatures({ samples: buf.slice(lead), sampleRate: c.sampleRate }, { noiseFloorDb: floor }).notes.length);
      }
  });
});
