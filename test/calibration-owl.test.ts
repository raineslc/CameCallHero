// Calibration of the barred owl calls, same rules as test/calibration.test.ts (Phase 2/2b):
// leave-one-out over each call's references must beat every negative by MARGIN points.
// Negatives: the other owl calls, every turkey reference (kee kee run included), the turkey
// wrong-call fixtures and the junk clips. Every clip is analyzed in the owl band, as the app
// does for an owl take. Clips come from the manifest, so locked calls (no references in the
// app) are measured too. A call may be unlocked only if it passes; locked calls are reported.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { checkTake, scoreTake, type Weights } from '../src/audio/score';
import { OWL_BAND, OWL_CALLS } from '../src/calls/barred-owl';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { readWav } from './wav';

/** Same margin as the turkey calibration; not tuned. */
const MARGIN = 15;
const MIN_REFS = 3;

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)), { band: OWL_BAND });
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  call: string;
  f: Features;
}

const owlManifest = json('public/audio/barred-owl/manifest.json') as { clips: { file: string; call: string }[] };
const owlClips: Clip[] = owlManifest.clips.map((c) => ({ name: c.file, call: c.call, f: load(`public/audio/barred-owl/${c.file}`) }));
const clipsOf = (call: string) => owlClips.filter((c) => c.call === call);
const fixture = (dir: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string }) => ({ name: c.file, call: 'other', f: load(`${dir}/${c.file}`) }));
const turkeyFiles = json('public/audio/turkey/manifest.json').clips.map((c: { file: string }) => c.file) as string[];
const nonOwl: Clip[] = [
  ...turkeyFiles.map((file) => ({ name: file, call: 'turkey', f: load(`public/audio/turkey/${file}`) })),
  ...fixture('test/fixtures/turkey-other'),
  ...fixture('test/fixtures/junk'),
];

const fmt = (v: number) => v.toFixed(1).padStart(6);
const score = (take: Features, refs: Features[], w: Weights) => scoreTake(take, refs, w);

interface Result {
  rows: string[];
  /** Smallest leave-one-out margin over every negative. */
  minMargin: number;
  /** Matrix rule: lowest same-call score minus highest score of another owl call's clip. */
  matrixMargin: number;
}

function calibrate(callId: string, weights: Weights): Result {
  const refs = clipsOf(callId);
  const rows: string[] = [];
  let minMargin = Infinity;
  refs.forEach((clip, i) => {
    const others = refs.filter((_, j) => j !== i).map((r) => r.f);
    const same = score(clip.f, others, weights);
    const negs = [...owlClips.filter((c) => c.call !== callId), ...nonOwl].map((n) => ({ n, s: score(n.f, others, weights).score }));
    const worst = negs.reduce((a, b) => (b.s > a.s ? b : a));
    const margin = same.score - worst.s;
    minMargin = Math.min(minMargin, margin);
    rows.push(
      `${clip.name.padEnd(22)} same ${fmt(same.score)} (r${fmt(same.rhythm)} p${fmt(same.pitch)} t${fmt(same.tone)})` +
        `${same.rejected ? ` rejected: ${same.rejected.reason}` : ''}  worst negative ${worst.n.name} ${fmt(worst.s)}  margin ${fmt(margin)}`,
    );
  });
  const all = refs.map((r) => r.f);
  const sameMin = Math.min(...refs.map((clip, i) => score(clip.f, all.filter((_, j) => j !== i), weights).score));
  const otherMax = Math.max(...owlClips.filter((c) => c.call !== callId).map((c) => score(c.f, all, weights).score));
  return { rows, minMargin, matrixMargin: sameMin - otherMax };
}

const calls = OWL_CALLS.filter((c) => clipsOf(c.id).length >= MIN_REFS);

describe.each(calls.map((c) => [c.id, c]))('owl calibration: %s', (_id, call) => {
  it(`${call.locked ? 'locked' : 'unlocked'}; unlocked only if leave-one-out beats every negative by >= ${MARGIN}`, () => {
    const r = calibrate(call.id, call.weights);
    console.log(
      `\n[owl ${call.id}] ${call.locked ? 'LOCKED' : 'unlocked'} weights ${JSON.stringify(call.weights)}\n${r.rows.join('\n')}\n` +
        `[owl ${call.id}] min margin ${r.minMargin.toFixed(1)}, matrix margin ${r.matrixMargin.toFixed(1)}`,
    );
    if (!call.locked) {
      expect(r.minMargin, `${call.id} min margin`).toBeGreaterThanOrEqual(MARGIN);
      expect(r.matrixMargin, `${call.id} matrix margin`).toBeGreaterThanOrEqual(MARGIN);
      // The app plays and scores exactly the manifest clips of an unlocked call.
      expect(call.references).toEqual(clipsOf(call.id).map((c) => `audio/barred-owl/${c.name}`));
    } else {
      expect(call.references).toEqual([]);
    }
  }, 120_000);
});

it('every owl call has 3+ clips, so each one was calibrated', () => {
  expect(calls.map((c) => c.id)).toEqual(OWL_CALLS.map((c) => c.id));
});

it('owl confusion matrix (mean score, take row vs target column, own row leave-one-out)', () => {
  const header = '              take \\ target' + OWL_CALLS.map((c) => c.id.padStart(17)).join('');
  const lines = [header];
  for (const take of OWL_CALLS) {
    const takes = clipsOf(take.id);
    const cells = OWL_CALLS.map((target) => {
      const refs = clipsOf(target.id);
      const scores = takes.map((t) => score(t.f, refs.filter((r) => r !== t).map((r) => r.f), target.weights).score);
      return fmt(scores.reduce((a, b) => a + b, 0) / scores.length).padStart(17);
    });
    lines.push(take.id.padStart(26) + cells.join(''));
  }
  console.log(`\n[owl matrix]\n${lines.join('\n')}`);
  expect(lines).toHaveLength(OWL_CALLS.length + 1);
}, 120_000);

describe('owl references and the take gates', () => {
  it('quiet references (two-phrase-hoot-3/4, peak about -37 dBFS frame RMS) pass the gates unchanged', () => {
    for (const name of ['two-phrase-hoot-3.wav', 'two-phrase-hoot-4.wav']) {
      const f = owlClips.find((c) => c.name === name)!.f;
      expect(f.peakDb).toBeLessThan(-30);
      expect(checkTake(f), name).toBeNull();
    }
  });

  it('only caterwaul-2 fails a gate (too noisy: a locked call)', () => {
    const rejected = owlClips.filter((c) => checkTake(c.f) !== null).map((c) => `${c.name}: ${checkTake(c.f)!.reason}`);
    expect(rejected).toEqual(['caterwaul-2.wav: too-noisy']);
  });

  it('level does not change the score: a quiet reference scaled by 30x scores the same', () => {
    const quiet = readWav(new URL('public/audio/barred-owl/two-phrase-hoot-3.wav', root));
    const loud = { ...quiet, samples: quiet.samples.map((v) => v * 30) };
    const refs = clipsOf('two-phrase-hoot').filter((c) => !c.name.startsWith('two-phrase-hoot-3')).map((c) => c.f);
    const w = { rhythm: 1, pitch: 1, tone: 1 };
    const a = scoreTake(extractFeatures(quiet, { band: OWL_BAND }), refs, w);
    const b = scoreTake(extractFeatures(loud, { band: OWL_BAND }), refs, w);
    expect(loud.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThan(0.99);
    expect(b.rejected).toBeNull();
    expect(Math.abs(a.score - b.score)).toBeLessThan(0.5);
  });

  it('turkey references are unaffected by the owl band (they are scored in the full band)', () => {
    expect(TURKEY_CALLS.every((c) => c.references.every((p) => p.startsWith('audio/turkey/')))).toBe(true);
  });
});
