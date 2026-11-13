// Calling challenge: segmentation, recognition thresholds (recomputed from the calibration
// fixtures), the score formula, ranks, next step and the leaderboard storage.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, HOP_SEC, type AudioClip, type Features } from '../src/audio/features';
import { compare, combine, scoreTake } from '../src/audio/score';
import {
  analyzeChallenge,
  challengeScore,
  isRecognized,
  nextStep,
  RANKS,
  rankFor,
  RECOGNIZE_MIN,
  SEGMENT_GAP_SEC,
  segmentNotes,
  splitTake,
  type CallRefs,
  type SegmentResult,
} from '../src/challenge/analyze';
import { breakdownLines } from '../src/challenge/card';
import { addEntry, BOARD_KEY, BOARD_SIZE, cleanName, clearBoard, loadBoard, NAME_MAX, today } from '../src/challenge/leaderboard';
import { FULL_BAND } from '../src/audio/features';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { readWav } from './wav';

const root = new URL('..', import.meta.url);
const wav = (rel: string) => readWav(new URL(rel, root));
const load = (rel: string): Features => extractFeatures(wav(rel));
const negatives = (dir: string) =>
  (JSON.parse(readFileSync(new URL(`${dir}/manifest.json`, root), 'utf8')) as { clips: { file: string }[] }).clips.map((c) => ({
    name: c.file,
    clip: wav(`${dir}/${c.file}`),
  }));

const unlocked = TURKEY_CALLS.filter((c) => !c.locked);
const refs = new Map(unlocked.map((c) => [c.id, c.references.map((p) => ({ name: p, f: load(`public/${p}`) }))]));
const callRefs: CallRefs[] = unlocked.map((call) => ({ call, refs: refs.get(call.id)!.map((r) => r.f) }));

describe('segmentNotes', () => {
  it('splits at gaps of gapFrames or more and keeps shorter gaps inside a call', () => {
    const notes = [
      { start: 0, end: 10 },
      { start: 15, end: 20 }, // gap 5
      { start: 70, end: 80 }, // gap 50
      { start: 129, end: 130 }, // gap 49
    ];
    expect(segmentNotes(notes, 50)).toEqual([
      { start: 0, end: 20 },
      { start: 70, end: 130 },
    ]);
    expect(segmentNotes(notes, 6)).toHaveLength(3);
    expect(segmentNotes(notes, 5)).toHaveLength(4);
    expect(segmentNotes([], 50)).toEqual([]);
  });

  it('does not change its input', () => {
    const notes = [
      { start: 0, end: 10 },
      { start: 12, end: 20 },
    ];
    segmentNotes(notes, 50);
    expect(notes[0]).toEqual({ start: 0, end: 10 });
  });

  it('keeps every unlocked turkey reference clip in one call (the gap threshold is above every within-call gap)', () => {
    const gapFrames = Math.round(SEGMENT_GAP_SEC / HOP_SEC);
    for (const [id, clips] of refs) {
      for (const c of clips) {
        const gaps = c.f.notes.slice(1).map((n, i) => n.start - c.f.notes[i].end);
        expect(segmentNotes(c.f.notes, gapFrames), `${id} ${c.name} gaps ${gaps.join(',')}`).toHaveLength(1);
      }
    }
  });
});

describe('recognition thresholds', () => {
  const wrong = [...negatives('test/fixtures/turkey-other'), ...negatives('test/fixtures/junk')];

  it('every unlocked turkey call has a threshold, and each is just above the worst wrong sound', () => {
    const rows: string[] = [];
    for (const call of unlocked) {
      const own = refs.get(call.id)!.map((r) => r.f);
      const others = unlocked.filter((o) => o !== call).flatMap((o) => refs.get(o.id)!.map((r) => ({ name: r.name, clip: wav(`public/${r.name}`) })));
      const sounds = [...wrong.map((n) => ({ name: n.name, clip: n.clip })), ...others];
      const scores = sounds.map(({ name, clip }) => {
        const f = extractFeatures(clip);
        // As a whole clip (the calibration test's measure), with and without the take gates.
        const gated = scoreTake(f, own, call.weights).score;
        const raw = f.span ? Math.max(...own.map((r) => combine(compare(f, r, call.weights), call.weights))) : 0;
        // As the challenge sees it: split into calls, each scored on its own, with the clip's
        // own background as the count-in floor. A putt series can split into single putts.
        const floor = f.noiseFloorDb;
        const parts = splitTake(clip, floor, FULL_BAND).parts.map((p) => scoreTake(p.features, own, call.weights, { noiseFloorDb: floor }).score);
        return { name, score: Math.max(gated, raw, ...parts) };
      });
      const worst = scores.reduce((a, b) => (b.score > a.score ? b : a));
      const sameMin = Math.min(...refs.get(call.id)!.map((r, i) => scoreTake(r.f, own.filter((_, j) => j !== i), call.weights).score));
      rows.push(`${call.id}: worst ${worst.name} ${worst.score.toFixed(1)}, threshold ${RECOGNIZE_MIN[call.id]}, lowest leave-one-out ${sameMin.toFixed(1)}`);
      expect(RECOGNIZE_MIN[call.id], call.id).toBe(Math.floor(worst.score) + 1);
      // A real call of that kind must still pass: the threshold stays under every leave-one-out score.
      expect(RECOGNIZE_MIN[call.id], call.id).toBeLessThan(sameMin);
    }
    console.log(`[challenge thresholds]\n${rows.join('\n')}`);
  });

  it('every reference clip, scored against all references of its call, is recognized as that call', () => {
    for (const call of unlocked)
      for (const r of refs.get(call.id)!) {
        const best = callRefs
          .map((c) => ({ id: c.call.id, score: scoreTake(r.f, c.refs, c.call.weights).score }))
          .reduce((a, b) => (b.score > a.score ? b : a));
        expect(best.id, r.name).toBe(call.id);
        expect(isRecognized(best.id, best.score), r.name).toBe(true);
      }
  });

  it('rejects unknown calls and non-finite scores', () => {
    expect(isRecognized('yelp', RECOGNIZE_MIN.yelp)).toBe(true);
    expect(isRecognized('yelp', RECOGNIZE_MIN.yelp - 0.01)).toBe(false);
    expect(isRecognized('cut', 100)).toBe(false);
    expect(isRecognized('yelp', NaN)).toBe(false);
    expect(isRecognized('yelp', Infinity)).toBe(false);
  });
});

const seg = (start: number, end: number, score: number, recognized: boolean) => ({ start, end, score, recognized });

describe('challengeScore', () => {
  it('weights recognized calls by length; calls not recognized count as 0', () => {
    expect(challengeScore([seg(0, 3, 80, true), seg(4, 5, 30, false)])).toBeCloseTo(60, 10);
    expect(challengeScore([seg(0, 1, 60, true), seg(2, 4, 90, true)])).toBeCloseTo(80, 10);
    expect(challengeScore([seg(0, 2, 70, true)])).toBeCloseTo(70, 10);
  });

  it('is 0 with no calls, no recognized calls or zero length', () => {
    expect(challengeScore([])).toBe(0);
    expect(challengeScore([seg(0, 2, 90, false)])).toBe(0);
    expect(challengeScore([seg(1, 1, 90, true)])).toBe(0);
  });

  it('stays in 0-100 and never NaN for any input', () => {
    let seed = 3;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const odd = [NaN, Infinity, -Infinity, -50, 250];
    for (let k = 0; k < 500; k++) {
      const segs = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => {
        const a = rnd() * 20;
        const b = rnd() < 0.1 ? odd[Math.floor(rnd() * odd.length)] : a + rnd() * 3 - 0.5;
        const s = rnd() < 0.1 ? odd[Math.floor(rnd() * odd.length)] : rnd() * 100;
        return seg(a, b, s, rnd() < 0.7);
      });
      const v = challengeScore(segs);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('rankFor', () => {
  it('follows the star bands', () => {
    expect(rankFor(0)).toBe(RANKS[0]);
    expect(rankFor(19.9)).toBe('Poult');
    expect(rankFor(20)).toBe('Jake');
    expect(rankFor(59.9)).toBe('Gobbler');
    expect(rankFor(60)).toBe('Longbeard');
    expect(rankFor(80)).toBe('Boss gobbler');
    expect(rankFor(100)).toBe('Boss gobbler');
    expect(rankFor(NaN)).toBe('Poult');
  });
});

/** Uniform noise at `rmsDb` dBFS. */
function noise(seconds: number, sr: number, rmsDb: number, seed = 5): Float32Array {
  const amp = 10 ** (rmsDb / 20) * Math.sqrt(3);
  return Float32Array.from({ length: Math.round(seconds * sr) }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return amp * (2 * (seed / 0x7fffffff) - 1);
  });
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe('analyzeChallenge', () => {
  const yelp = wav('public/audio/turkey/yelp-1.wav');
  const gobble = wav('public/audio/turkey/gobble-1.wav');
  const sr = yelp.sampleRate;
  const floor = extractFeatures(yelp).noiseFloorDb;

  it('splits a yelp, a pause and a gobble into two recognized calls', () => {
    expect(gobble.sampleRate).toBe(sr);
    const take: AudioClip = { samples: concat([yelp.samples, noise(1, sr, floor), gobble.samples]), sampleRate: sr };
    const r = analyzeChallenge(take, callRefs, floor, FULL_BAND);
    console.log(`[challenge] yelp + gobble: ${r.segments.map((s) => `${s.call?.id} ${s.score.toFixed(1)} ${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(' | ')} -> ${r.score.toFixed(1)} ${r.rank}`);
    expect(r.rejected).toBeNull();
    expect(r.segments.map((s) => [s.call?.id, s.recognized])).toEqual([
      ['yelp', true],
      ['gobble', true],
    ]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.rank).toBe(rankFor(r.score));
  });

  it('marks a putt between the calls as not recognized and lowers the score', () => {
    const putt = wav('test/fixtures/turkey-other/putt-2.wav');
    expect(putt.sampleRate).toBe(sr);
    // The count-in hears the loudest background of the three recordings (the putt's), as a
    // count-in in the same place would.
    const loudFloor = Math.max(floor, extractFeatures(gobble).noiseFloorDb, extractFeatures(putt).noiseFloorDb);
    const pause = noise(1, sr, loudFloor);
    const plain = analyzeChallenge({ samples: concat([yelp.samples, pause, gobble.samples]), sampleRate: sr }, callRefs, loudFloor, FULL_BAND);
    const r = analyzeChallenge({ samples: concat([yelp.samples, pause, putt.samples, pause, gobble.samples]), sampleRate: sr }, callRefs, loudFloor, FULL_BAND);
    console.log(`[challenge] yelp + putt + gobble: ${r.segments.map((s) => `${s.call?.id ?? '-'} ${s.score.toFixed(1)} ${s.recognized}`).join(' | ')} -> ${r.score.toFixed(1)}`);
    expect(r.segments.map((s) => s.recognized)).toContain(false);
    expect(r.segments.filter((s) => s.recognized).map((s) => s.call?.id)).toEqual(['yelp', 'gobble']);
    expect(r.score).toBeLessThan(plain.score);
  });

  it('rejects silence and steady noise with the scorer gates', () => {
    const silent = analyzeChallenge({ samples: new Float32Array(5 * sr), sampleRate: sr }, callRefs, undefined, FULL_BAND);
    expect(silent.rejected?.reason).toBe('too-quiet');
    expect(silent.segments).toEqual([]);
    expect(silent.score).toBe(0);
    const loud = noise(5, sr, -25);
    const noisy = analyzeChallenge({ samples: loud, sampleRate: sr }, callRefs, extractFeatures({ samples: loud, sampleRate: sr }).noiseFloorDb, FULL_BAND);
    expect(noisy.rejected?.reason).toBe('too-noisy');
  });

  it('analyzes the whole take beyond the 15 s practice cap', () => {
    const take: AudioClip = { samples: concat([noise(16, sr, floor), yelp.samples]), sampleRate: sr };
    const r = analyzeChallenge(take, callRefs, floor, FULL_BAND);
    expect(r.segments.map((s) => s.call?.id)).toEqual(['yelp']);
    expect(r.segments[0].start).toBeGreaterThan(16);
  });
});

describe('nextStep', () => {
  const [yelpCall, gobbleCall] = [unlocked.find((c) => c.id === 'yelp')!, unlocked.find((c) => c.id === 'gobble')!];
  const s = (start: number, end: number, score: number, recognized: boolean, call = yelpCall): SegmentResult => ({
    start,
    end,
    score,
    recognized,
    call,
    bestReference: 0,
  });

  it('points at the recognizable calls when nothing was recognized', () => {
    expect(nextStep({ segments: [s(0, 1, 20, false)] }, 'yelp and gobble')).toEqual({
      text: 'Start with the calls the app can recognize so far: yelp and gobble.',
      practice: null,
    });
  });

  it('names the part that cost the most points', () => {
    // Not recognized: 2 s x 100 = 200; yelp 3 s x 40 = 120.
    expect(nextStep({ segments: [s(0, 3, 60, true), s(4, 6, 10, false)] }, 'x').practice).toBeNull();
    // Gobble 1 s x 50 = 50 beats yelp 3 s x 10 = 30 and nothing missed.
    const r = nextStep({ segments: [s(0, 3, 90, true), s(4, 5, 50, true, gobbleCall)] }, 'x');
    expect(r.practice?.id).toBe('gobble');
    expect(r.text).toContain('gobble cost the most points (50)');
  });
});

describe('breakdownLines', () => {
  it('lists each call and shortens long lists', () => {
    const yelpCall = unlocked.find((c) => c.id === 'yelp')!;
    const one = { start: 0, end: 1, score: 77.6, recognized: true, call: yelpCall, bestReference: 0 };
    const miss = { ...one, recognized: false };
    expect(breakdownLines([one, miss])).toEqual(['Yelp 78', 'Not recognized']);
    expect(breakdownLines(Array(7).fill(one), 5)).toEqual(['Yelp 78', 'Yelp 78', 'Yelp 78', 'Yelp 78', '+3 more']);
  });
});

/** An in-memory Storage with optional failures. */
function memStore(init: Record<string, string> = {}, fail: { get?: boolean; set?: boolean } = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => {
      if (fail.get) throw new Error('blocked');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (fail.set) throw new Error('quota');
      data.set(k, v);
    },
    removeItem: (k: string) => {
      if (fail.set) throw new Error('blocked');
      data.delete(k);
    },
  };
}

describe('leaderboard', () => {
  const ch = (code: number) => String.fromCharCode(code);

  it('cleans names: control and bidi characters out, spaces collapsed, length limited, HTML kept as text', () => {
    expect(cleanName('  Big   Tom  ')).toBe('Big Tom');
    expect(cleanName(`A${ch(0)}B${ch(0x1b)}C${ch(0x202e)}D${ch(0x200b)}E`)).toBe('ABCDE');
    expect(cleanName(`line${ch(10)}break`)).toBe('line break');
    expect(cleanName('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=a');
    expect(Array.from(cleanName('🦃'.repeat(30)))).toHaveLength(NAME_MAX);
    expect(cleanName('')).toBe('');
    expect(cleanName(undefined)).toBe('');
    expect(cleanName(42)).toBe('42');
  });

  it('saves, sorts by score (earlier entry first on ties) and keeps the top 10', () => {
    const store = memStore();
    for (let k = 0; k < 12; k++) addEntry(`P${k}`, k * 5, '2026-11-13', store);
    const tie = addEntry('Tie', 50, '2026-11-13', store)!;
    expect(tie.saved).toBe(true);
    const board = loadBoard(store);
    expect(board).toHaveLength(BOARD_SIZE);
    expect(board[0]).toEqual({ name: 'P11', score: 55, date: '2026-11-13' });
    expect(board.map((e) => e.name).slice(0, 3)).toEqual(['P11', 'P10', 'Tie']);
    expect(tie.place).toBe(2);
    const low = addEntry('Low', 1, '2026-11-13', store)!;
    expect(low.place).toBe(-1);
    expect(loadBoard(store).some((e) => e.name === 'Low')).toBe(false);
  });

  it('rounds scores, refuses empty names and scores outside 0-100', () => {
    const store = memStore();
    expect(addEntry('A', 77.6, '2026-11-13', store)!.board[0].score).toBe(78);
    expect(addEntry('   ', 50, '2026-11-13', store)).toBeNull();
    expect(addEntry('B', NaN, '2026-11-13', store)).toBeNull();
    expect(addEntry('B', 101, '2026-11-13', store)).toBeNull();
    expect(addEntry('B', -1, '2026-11-13', store)).toBeNull();
    expect(loadBoard(store)).toHaveLength(1);
  });

  it('reads bad or corrupt storage as an empty board, keeping only valid entries', () => {
    expect(loadBoard(memStore({ [BOARD_KEY]: '{not json' }))).toEqual([]);
    expect(loadBoard(memStore({ [BOARD_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadBoard(memStore({ [BOARD_KEY]: 'null' }))).toEqual([]);
    const mixed = JSON.stringify([
      { name: 'Good', score: 70, date: '2026-11-12' },
      { name: '', score: 90, date: '2026-11-12' },
      { name: 'Bad score', score: 'x', date: '2026-11-12' },
      { name: 'Too high', score: 1e9, date: '2026-11-12' },
      { name: 'Bad date', score: 50, date: '<b>' },
      null,
      7,
      { name: `Spoof${ch(0x202e)}ed${ch(0)}`, score: 80, date: '2026-11-11' },
    ]);
    expect(loadBoard(memStore({ [BOARD_KEY]: mixed }))).toEqual([
      { name: 'Spoofed', score: 80, date: '2026-11-11' },
      { name: 'Good', score: 70, date: '2026-11-12' },
    ]);
  });

  it('survives storage that throws or is missing', () => {
    expect(loadBoard(memStore({}, { get: true }))).toEqual([]);
    const r = addEntry('A', 50, '2026-11-13', memStore({}, { set: true }))!;
    expect(r.saved).toBe(false);
    expect(r.board).toHaveLength(1);
    expect(loadBoard(null)).toEqual([]);
    expect(addEntry('A', 50, '2026-11-13', null)!.saved).toBe(false);
    expect(clearBoard(null)).toBe(false);
    expect(clearBoard(memStore({}, { set: true }))).toBe(false);
  });

  it('clears the board', () => {
    const store = memStore();
    addEntry('A', 50, '2026-11-13', store);
    expect(clearBoard(store)).toBe(true);
    expect(loadBoard(store)).toEqual([]);
  });

  it('formats the local date', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
