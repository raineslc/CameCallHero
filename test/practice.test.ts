import { describe, expect, it } from 'vitest';
import { extractFeatures, HOP_SEC, MAX_HZ, MIN_HZ, type Features } from '../src/audio/features';
import { LivePitch } from '../src/audio/pitch';
import { callById } from '../src/calls/turkey';
import { CLICK_INTERVAL_SEC, latencyFromTaps, MATCH_WINDOW_MS } from '../src/practice/latency';
import { COUNT_IN_SEC, LEAD_SEC, TAIL_SEC, laneY, makePlan, notesOf, pitchRange, pitchX, spanSeconds } from '../src/practice/plan';
import { loadBest, loadLatency, saveBest, saveLatency } from '../src/practice/storage';
import { tipFor, weakestPart } from '../src/practice/tips';
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

describe('tips', () => {
  const take1 = feats(bursts(3, [[0.5, 0.8, 800]]));
  const ref1 = feats(bursts(3, [[0.5, 0.8, 800]]));
  it('picks the lowest sub-score, ties in rhythm, pitch, tone order', () => {
    expect(weakestPart({ rhythm: 50, pitch: 40, tone: 60 })).toBe('pitch');
    expect(weakestPart({ rhythm: 50, pitch: 50, tone: 50 })).toBe('rhythm');
    expect(weakestPart({ rhythm: 90, pitch: 70, tone: 20 })).toBe('tone');
  });
  it('rhythm tip states measured lengths and asks for a shorter or longer call', () => {
    const long = feats(bursts(4, [[0.5, 2.0, 800]]));
    const t = tipFor({ rhythm: 10, pitch: 90, tone: 90 }, long, ref1);
    expect(t.part).toBe('rhythm');
    expect(t.text).toMatch(/Yours: 1 note over 1\.5\d s/);
    expect(t.text).toMatch(/Closest reference: 1 note over 0\.3\d s/);
    expect(t.text).toContain('shorter');
    expect(tipFor({ rhythm: 10, pitch: 90, tone: 90 }, ref1, long).text).toContain('longer');
    const two = feats(bursts(3, [[0.5, 0.62, 800], [0.68, 0.8, 800]]));
    expect(tipFor({ rhythm: 10, pitch: 90, tone: 90 }, two, ref1).text).toContain('number of notes');
  });
  it('pitch tip gives the direction when the call is off by 2+ semitones', () => {
    const high = feats(bursts(3, [[0.5, 0.8, 1600]]));
    const t = tipFor({ rhythm: 90, pitch: 10, tone: 90 }, high, ref1);
    expect(t.text).toContain('12 semitones higher');
    expect(t.text).toContain('aim lower');
    expect(tipFor({ rhythm: 90, pitch: 10, tone: 90 }, take1, ref1).text).toContain('rises and falls');
  });
  it('tone tip', () => {
    expect(tipFor({ rhythm: 90, pitch: 90, tone: 10 }, take1, ref1).part).toBe('tone');
  });
});
