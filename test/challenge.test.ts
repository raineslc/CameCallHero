// Calling challenge: segmentation, split gap and recognition thresholds per species
// (recomputed from the recordings), the score formula, ranks, next step and leaderboard storage.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { extractFeatures, HOP_SEC, type AudioClip, type Features } from '../src/audio/features';
import { compare, combine, scoreTake } from '../src/audio/score';
import { analyzeChallenge, challengeScore, isRecognized, nextStep, rankFor, segmentNotes, splitTake, type CallRefs, type SegmentResult } from '../src/challenge/analyze';
import { breakdownLines } from '../src/challenge/card';
import { addEntry, BOARD_KEY, BOARD_SIZE, boardKey, cleanName, clearBoard, loadBoard, NAME_MAX, today } from '../src/challenge/leaderboard';
import { CHALLENGE_RULES, challengeHref, challengeRules, GAP_FACTOR, scorableCalls, type ChallengeRules } from '../src/challenge/rules';
import { BARRED_OWL, SPECIES, TURKEY, type Species } from '../src/calls/species';
import { readWav } from './wav';

const root = new URL('..', import.meta.url);
const wav = (rel: string) => readWav(new URL(rel, root));
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const negatives = (dir: string) => (json(`${dir}/manifest.json`) as { clips: { file: string }[] }).clips.map((c) => ({ name: c.file, clip: wav(`${dir}/${c.file}`) }));

/** A species' unlocked calls with their references analyzed in the species band. */
function speciesRefs(sp: Species) {
  const unlocked = sp.calls.filter((c) => !c.locked && c.references.length > 0);
  const refs = new Map(unlocked.map((c) => [c.id, c.references.map((p) => ({ name: p, f: extractFeatures(wav(`public/${p}`), { band: sp.band }) }))]));
  const callRefs: CallRefs[] = unlocked.map((call) => ({ call, refs: refs.get(call.id)!.map((r) => r.f) }));
  return { unlocked, refs, callRefs };
}

/**
 * Wrong sounds for a species' challenge (rules.ts recognizeMin): the junk clips,
 * test/fixtures/<species>-other if it exists, and the recordings of the species' locked calls
 * from its manifest except `notWrong`. The other unlocked calls are added per call.
 */
function wrongSounds(sp: Species, rules: ChallengeRules) {
  const out = negatives('test/fixtures/junk');
  if (existsSync(new URL(`test/fixtures/${sp.id}-other/manifest.json`, root))) out.push(...negatives(`test/fixtures/${sp.id}-other`));
  const lockedIds = new Set(sp.calls.filter((c) => c.locked).map((c) => c.id));
  const dir = `public/audio/${sp.id}`;
  for (const c of (json(`${dir}/manifest.json`) as { clips: { file: string; call: string }[] }).clips)
    if (lockedIds.has(c.call) && !rules.notWrong?.[c.call]) out.push({ name: c.file, clip: wav(`${dir}/${c.file}`) });
  return out;
}

/** Longest pause between notes inside one reference clip of an unlocked call, seconds. */
function longestGap(refs: ReturnType<typeof speciesRefs>['refs']) {
  let max = { sec: 0, name: '' };
  for (const clips of refs.values())
    for (const c of clips)
      c.f.notes.slice(1).forEach((n, i) => {
        const sec = (n.start - c.f.notes[i].end) * HOP_SEC;
        if (sec > max.sec) max = { sec, name: c.name };
      });
  return max;
}

const challengeSpecies = SPECIES.filter((sp) => sp.calls.some((c) => !c.locked && c.references.length > 0));

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
});

describe.each(challengeSpecies.map((sp) => [sp.id, sp] as const))('challenge rules: %s', (id, sp) => {
  const { unlocked, refs, callRefs } = speciesRefs(sp);
  const rules = challengeRules(sp);
  const gap = longestGap(refs);

  it('has challenge rules (src/challenge/rules.ts) with five rank titles', () => {
    expect(rules, `add CHALLENGE_RULES['${id}']; measured split gap ${gap.sec.toFixed(2)} s x ${GAP_FACTOR}`).toBeDefined();
    expect(rules!.ranks).toHaveLength(5);
    for (const t of rules!.ranks) expect(t.trim()).not.toBe('');
  });

  it(`split gap = longest within-call gap x ${GAP_FACTOR}, and every reference clip stays one call`, () => {
    const want = Math.round(gap.sec * GAP_FACTOR * 10) / 10;
    console.log(`[challenge gap] ${id}: longest within-call gap ${gap.sec.toFixed(2)} s (${gap.name}) -> ${want} s`);
    expect(rules?.gapSec, id).toBe(want);
    const gapFrames = Math.round(want / HOP_SEC);
    for (const [call, clips] of refs) for (const c of clips) expect(segmentNotes(c.f.notes, gapFrames), `${call} ${c.name}`).toHaveLength(1);
  });

  it('every unlocked call has a threshold just above the worst wrong sound and below every leave-one-out score', () => {
    const wrong = wrongSounds(sp, rules ?? { gapSec: 0, recognizeMin: {}, ranks: ['', '', '', '', ''] });
    const gapSec = rules?.gapSec ?? Math.round(gap.sec * GAP_FACTOR * 10) / 10;
    const rows: string[] = [];
    const fails: string[] = [];
    for (const call of unlocked) {
      const own = refs.get(call.id)!.map((r) => r.f);
      const others = unlocked.filter((o) => o !== call).flatMap((o) => o.references.map((p) => ({ name: p, clip: wav(`public/${p}`) })));
      const scores = [...wrong, ...others].map(({ name, clip }) => {
        const f = extractFeatures(clip, { band: sp.band });
        // As a whole clip (the calibration test's measure), with and without the take gates.
        const gated = scoreTake(f, own, call.weights).score;
        const raw = f.span ? Math.max(...own.map((r) => combine(compare(f, r, call.weights), call.weights))) : 0;
        // As the challenge sees it: split into calls, each scored on its own, with the clip's
        // own background as the count-in floor. A series can split into single notes.
        const floor = f.noiseFloorDb;
        const parts = splitTake(clip, floor, sp.band, gapSec).parts.map((p) => scoreTake(p.features, own, call.weights, { noiseFloorDb: floor }).score);
        return { name, score: Math.max(gated, raw, ...parts) };
      });
      const worst = scores.reduce((a, b) => (b.score > a.score ? b : a));
      const want = Math.floor(worst.score) + 1;
      const sameMin = Math.min(...refs.get(call.id)!.map((r, i) => scoreTake(r.f, own.filter((_, j) => j !== i), call.weights).score));
      rows.push(`${id} ${call.id}: worst ${worst.name} ${worst.score.toFixed(1)} -> ${want} (rules: ${rules?.recognizeMin[call.id]}), lowest leave-one-out ${sameMin.toFixed(1)}`);
      if (rules?.recognizeMin[call.id] !== want) fails.push(`${call.id} should be ${want}`);
      // A real call of that kind must still pass: the threshold stays under every leave-one-out score.
      expect(want, call.id).toBeLessThan(sameMin);
    }
    console.log(`[challenge thresholds]\n${rows.join('\n')}`);
    expect(fails, `CHALLENGE_RULES['${id}'].recognizeMin`).toEqual([]);
    // No thresholds for calls that are not unlocked.
    expect(Object.keys(rules?.recognizeMin ?? {}).sort()).toEqual(unlocked.map((c) => c.id).sort());
  }, 60_000);

  it('every reference clip, scored against all references of its species, is recognized as its own call', () => {
    for (const call of unlocked)
      for (const r of refs.get(call.id)!) {
        const best = callRefs.map((c) => ({ id: c.call.id, score: scoreTake(r.f, c.refs, c.call.weights).score })).reduce((a, b) => (b.score > a.score ? b : a));
        expect(best.id, r.name).toBe(call.id);
        expect(isRecognized(rules!, best.id, best.score), r.name).toBe(true);
      }
  });

  it('the challenge offers exactly the unlocked calls', () => {
    expect(scorableCalls(sp).map((c) => c.id)).toEqual(unlocked.map((c) => c.id));
  });
});

describe('challenge rules: general', () => {
  it('only refer to known species', () => {
    for (const id of Object.keys(CHALLENGE_RULES)) expect(SPECIES.map((s) => s.id)).toContain(id);
  });

  it('a species with no unlocked call has no challenge (shown as Coming soon)', () => {
    const locked: Species = { ...BARRED_OWL, id: 'test-species', calls: BARRED_OWL.calls.map((c) => ({ ...c, locked: true, references: [] })) };
    expect(scorableCalls(locked)).toEqual([]);
    expect(scorableCalls({ ...BARRED_OWL, calls: locked.calls })).toEqual([]);
  });

  it('turkey keeps #/challenge; other species carry their id', () => {
    expect(challengeHref(TURKEY)).toBe('#/challenge');
    expect(challengeHref(BARRED_OWL)).toBe('#/barred-owl/challenge');
  });

  it('rejects unknown calls and non-finite scores', () => {
    const r = CHALLENGE_RULES.turkey;
    expect(isRecognized(r, 'yelp', r.recognizeMin.yelp)).toBe(true);
    expect(isRecognized(r, 'yelp', r.recognizeMin.yelp - 0.01)).toBe(false);
    expect(isRecognized(r, 'cut', 100)).toBe(false);
    expect(isRecognized(r, 'yelp', NaN)).toBe(false);
    expect(isRecognized(r, 'yelp', Infinity)).toBe(false);
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
  it('follows the star bands with the species titles; turkey keeps the Phase 9 titles', () => {
    const ranks = CHALLENGE_RULES.turkey.ranks;
    expect(ranks).toEqual(['Poult', 'Jake', 'Gobbler', 'Longbeard', 'Boss gobbler']);
    expect(rankFor(ranks, 0)).toBe('Poult');
    expect(rankFor(ranks, 19.9)).toBe('Poult');
    expect(rankFor(ranks, 20)).toBe('Jake');
    expect(rankFor(ranks, 59.9)).toBe('Gobbler');
    expect(rankFor(ranks, 60)).toBe('Longbeard');
    expect(rankFor(ranks, 80)).toBe('Boss gobbler');
    expect(rankFor(ranks, 100)).toBe('Boss gobbler');
    expect(rankFor(ranks, NaN)).toBe('Poult');
    const owl = CHALLENGE_RULES['barred-owl'].ranks;
    expect(rankFor(owl, 0)).toBe(owl[0]);
    expect(rankFor(owl, 100)).toBe(owl[4]);
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

describe('analyzeChallenge: turkey', () => {
  const { callRefs } = speciesRefs(TURKEY);
  const rules = CHALLENGE_RULES.turkey;
  const FULL_BAND = TURKEY.band;
  const yelp = wav('public/audio/turkey/yelp-1.wav');
  const gobble = wav('public/audio/turkey/gobble-1.wav');
  const sr = yelp.sampleRate;
  const floor = extractFeatures(yelp).noiseFloorDb;

  it('splits a yelp, a pause and a gobble into two recognized calls', () => {
    expect(gobble.sampleRate).toBe(sr);
    const take: AudioClip = { samples: concat([yelp.samples, noise(1, sr, floor), gobble.samples]), sampleRate: sr };
    const r = analyzeChallenge(take, callRefs, floor, FULL_BAND, rules);
    console.log(`[challenge] yelp + gobble: ${r.segments.map((s) => `${s.call?.id} ${s.score.toFixed(1)} ${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(' | ')} -> ${r.score.toFixed(1)} ${r.rank}`);
    expect(r.rejected).toBeNull();
    expect(r.segments.map((s) => [s.call?.id, s.recognized])).toEqual([
      ['yelp', true],
      ['gobble', true],
    ]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.rank).toBe(rankFor(rules.ranks, r.score));
  });

  it('marks a putt between the calls as not recognized and lowers the score', () => {
    const putt = wav('test/fixtures/turkey-other/putt-2.wav');
    expect(putt.sampleRate).toBe(sr);
    // The count-in hears the loudest background of the three recordings (the putt's), as a
    // count-in in the same place would.
    const loudFloor = Math.max(floor, extractFeatures(gobble).noiseFloorDb, extractFeatures(putt).noiseFloorDb);
    const pause = noise(1, sr, loudFloor);
    const plain = analyzeChallenge({ samples: concat([yelp.samples, pause, gobble.samples]), sampleRate: sr }, callRefs, loudFloor, FULL_BAND, rules);
    const r = analyzeChallenge({ samples: concat([yelp.samples, pause, putt.samples, pause, gobble.samples]), sampleRate: sr }, callRefs, loudFloor, FULL_BAND, rules);
    console.log(`[challenge] yelp + putt + gobble: ${r.segments.map((s) => `${s.call?.id ?? '-'} ${s.score.toFixed(1)} ${s.recognized}`).join(' | ')} -> ${r.score.toFixed(1)}`);
    expect(r.segments.map((s) => s.recognized)).toContain(false);
    expect(r.segments.filter((s) => s.recognized).map((s) => s.call?.id)).toEqual(['yelp', 'gobble']);
    expect(r.score).toBeLessThan(plain.score);
  });

  it('rejects silence and steady noise with the scorer gates', () => {
    const silent = analyzeChallenge({ samples: new Float32Array(5 * sr), sampleRate: sr }, callRefs, undefined, FULL_BAND, rules);
    expect(silent.rejected?.reason).toBe('too-quiet');
    expect(silent.segments).toEqual([]);
    expect(silent.score).toBe(0);
    const loud = noise(5, sr, -25);
    const noisy = analyzeChallenge({ samples: loud, sampleRate: sr }, callRefs, extractFeatures({ samples: loud, sampleRate: sr }).noiseFloorDb, FULL_BAND, rules);
    expect(noisy.rejected?.reason).toBe('too-noisy');
  });

  it('analyzes the whole take beyond the 15 s practice cap', () => {
    const take: AudioClip = { samples: concat([noise(16, sr, floor), yelp.samples]), sampleRate: sr };
    const r = analyzeChallenge(take, callRefs, floor, FULL_BAND, rules);
    expect(r.segments.map((s) => s.call?.id)).toEqual(['yelp']);
    expect(r.segments[0].start).toBeGreaterThan(16);
  });
});

const turkeyUnlocked = speciesRefs(TURKEY).unlocked;

describe('analyzeChallenge: barred owl', () => {
  const { callRefs } = speciesRefs(BARRED_OWL);
  const rules = CHALLENGE_RULES['barred-owl'];
  const hoot = wav('public/audio/barred-owl/two-phrase-hoot-1.wav');
  const hooWah = wav('public/audio/barred-owl/inspection-call-1.wav');
  const sr = hoot.sampleRate;
  const floor = Math.max(extractFeatures(hoot, { band: BARRED_OWL.band }).noiseFloorDb, extractFeatures(hooWah, { band: BARRED_OWL.band }).noiseFloorDb);

  it('splits a two-phrase hoot, a 2 s pause and a hoo-wah into two recognized calls', () => {
    expect(hooWah.sampleRate).toBe(sr);
    const take: AudioClip = { samples: concat([hoot.samples, noise(2, sr, floor), hooWah.samples]), sampleRate: sr };
    const r = analyzeChallenge(take, callRefs, floor, BARRED_OWL.band, rules);
    console.log(`[challenge] owl hoot + hoo-wah: ${r.segments.map((s) => `${s.call?.id} ${s.score.toFixed(1)} ${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(' | ')} -> ${r.score.toFixed(1)} ${r.rank}`);
    expect(r.rejected).toBeNull();
    expect(r.segments.map((s) => [s.call?.id, s.recognized])).toEqual([
      ['two-phrase-hoot', true],
      ['inspection-call', true],
    ]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(rules.ranks).toContain(r.rank);
  });

  it('marks an ascending hoot (locked) between the calls as not recognized and lowers the score', () => {
    const asc = wav('public/audio/barred-owl/ascending-hoot-5.wav');
    expect(asc.sampleRate).toBe(sr);
    const loud = Math.max(floor, extractFeatures(asc, { band: BARRED_OWL.band }).noiseFloorDb);
    const pause = noise(2, sr, loud);
    const plain = analyzeChallenge({ samples: concat([hoot.samples, pause, hooWah.samples]), sampleRate: sr }, callRefs, loud, BARRED_OWL.band, rules);
    const r = analyzeChallenge({ samples: concat([hoot.samples, pause, asc.samples, pause, hooWah.samples]), sampleRate: sr }, callRefs, loud, BARRED_OWL.band, rules);
    console.log(`[challenge] owl hoot + ascending + hoo-wah: ${r.segments.map((s) => `${s.call?.id ?? '-'} ${s.score.toFixed(1)} ${s.recognized}`).join(' | ')} -> ${r.score.toFixed(1)}`);
    expect(r.segments.map((s) => s.recognized)).toContain(false);
    expect(r.segments.filter((s) => s.recognized).map((s) => s.call?.id)).toEqual(['two-phrase-hoot', 'inspection-call']);
    expect(r.score).toBeLessThan(plain.score);
  });
});

describe('nextStep', () => {
  const unlocked = turkeyUnlocked;
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
    const yelpCall = turkeyUnlocked.find((c) => c.id === 'yelp')!;
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

  it('keeps one board per species; turkey keeps the Phase 9 key', () => {
    expect(boardKey(TURKEY)).toBe(BOARD_KEY);
    expect(BOARD_KEY).toBe('camecallhero.challenge.board');
    expect(boardKey(BARRED_OWL)).toBe('camecallhero.challenge.board.barred-owl');
    const store = memStore({ [BOARD_KEY]: JSON.stringify([{ name: 'Old Tom', score: 61, date: '2026-11-12' }]) });
    addEntry('Hooter', 70, '2026-11-13', store, boardKey(BARRED_OWL));
    expect(loadBoard(store, boardKey(TURKEY))).toEqual([{ name: 'Old Tom', score: 61, date: '2026-11-12' }]);
    expect(loadBoard(store, boardKey(BARRED_OWL)).map((e) => e.name)).toEqual(['Hooter']);
    clearBoard(store, boardKey(BARRED_OWL));
    expect(loadBoard(store, boardKey(BARRED_OWL))).toEqual([]);
    expect(loadBoard(store)).toHaveLength(1);
  });

  it('formats the local date', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
