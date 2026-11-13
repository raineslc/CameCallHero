// Calibration of the mallard calls (Phase 11), same rules as test/calibration-owl.test.ts:
// leave-one-out over each call's references must beat every negative by MARGIN points, and the
// matrix rule (lowest same-call score minus highest score of another mallard call's clip) must
// also reach MARGIN. Negatives: the other mallard calls, every turkey and barred owl reference
// (locked calls included), the turkey wrong-call fixtures and the junk clips. Every clip is
// analyzed in the mallard band, as the app does for a mallard take. Clips come from the
// manifest, so locked calls (no references in the app) are measured too.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { checkTake, scoreTake, type Weights } from '../src/audio/score';
import { MALLARD_BAND, MALLARD_CALLS } from '../src/calls/mallard';
import { readWav } from './wav';

/** Same margin as the turkey and owl calibration; not tuned. */
const MARGIN = 15;
const MIN_REFS = 3;

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)), { band: MALLARD_BAND });
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  call: string;
  f: Features;
}

const manifest = json('public/audio/mallard/manifest.json') as { clips: { file: string; call: string }[] };
const duckClips: Clip[] = manifest.clips.map((c) => ({ name: c.file, call: c.call, f: load(`public/audio/mallard/${c.file}`) }));
const clipsOf = (call: string) => duckClips.filter((c) => c.call === call);
const species = (dir: string, call: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string }) => ({ name: c.file, call, f: load(`${dir}/${c.file}`) }));
const nonDuck: Clip[] = [
  ...species('public/audio/turkey', 'turkey'),
  ...species('public/audio/barred-owl', 'owl'),
  ...species('test/fixtures/turkey-other', 'other'),
  ...species('test/fixtures/junk', 'other'),
];

const fmt = (v: number) => v.toFixed(1).padStart(6);
const score = (take: Features, refs: Features[], w: Weights) => scoreTake(take, refs, w);

function calibrate(callId: string, weights: Weights) {
  const refs = clipsOf(callId);
  const rows: string[] = [];
  let minMargin = Infinity;
  refs.forEach((clip, i) => {
    const others = refs.filter((_, j) => j !== i).map((r) => r.f);
    const same = score(clip.f, others, weights);
    const negs = [...duckClips.filter((c) => c.call !== callId), ...nonDuck].map((n) => ({ n, s: score(n.f, others, weights).score }));
    const worst = negs.reduce((a, b) => (b.s > a.s ? b : a));
    const margin = same.score - worst.s;
    minMargin = Math.min(minMargin, margin);
    rows.push(
      `${clip.name.padEnd(18)} same ${fmt(same.score)} (r${fmt(same.rhythm)} p${fmt(same.pitch)} t${fmt(same.tone)})` +
        `${same.rejected ? ` rejected: ${same.rejected.reason}` : ''}  worst negative ${worst.n.name} ${fmt(worst.s)}  margin ${fmt(margin)}`,
    );
  });
  const all = refs.map((r) => r.f);
  const sameMin = Math.min(...refs.map((clip, i) => score(clip.f, all.filter((_, j) => j !== i), weights).score));
  const otherMax = Math.max(...duckClips.filter((c) => c.call !== callId).map((c) => score(c.f, all, weights).score));
  return { rows, minMargin, matrixMargin: sameMin - otherMax };
}

const calls = MALLARD_CALLS.filter((c) => clipsOf(c.id).length >= MIN_REFS);

describe.each(calls.map((c) => [c.id, c]))('mallard calibration: %s', (_id, call) => {
  it(`${call.locked ? 'locked' : 'unlocked'}; unlocked only if leave-one-out beats every negative by >= ${MARGIN}`, () => {
    const r = calibrate(call.id, call.weights);
    console.log(
      `\n[mallard ${call.id}] ${call.locked ? 'LOCKED' : 'unlocked'} weights ${JSON.stringify(call.weights)}\n${r.rows.join('\n')}\n` +
        `[mallard ${call.id}] min margin ${r.minMargin.toFixed(1)}, matrix margin ${r.matrixMargin.toFixed(1)}`,
    );
    if (!call.locked) {
      expect(r.minMargin, `${call.id} min margin`).toBeGreaterThanOrEqual(MARGIN);
      expect(r.matrixMargin, `${call.id} matrix margin`).toBeGreaterThanOrEqual(MARGIN);
      // The app plays and scores exactly the manifest clips of an unlocked call.
      expect(call.references).toEqual(clipsOf(call.id).map((c) => `audio/mallard/${c.name}`));
    } else {
      expect(call.references).toEqual([]);
    }
  }, 120_000);
});

it('every mallard call has 3+ clips, so each one was calibrated', () => {
  expect(calls.map((c) => c.id)).toEqual(MALLARD_CALLS.map((c) => c.id));
});

it('mallard confusion matrix (mean score, take row vs target column, own row leave-one-out)', () => {
  const lines = ['        take \\ target' + MALLARD_CALLS.map((c) => c.id.padStart(12)).join('')];
  for (const take of MALLARD_CALLS) {
    const takes = clipsOf(take.id);
    const cells = MALLARD_CALLS.map((target) => {
      const refs = clipsOf(target.id);
      const scores = takes.map((t) => score(t.f, refs.filter((r) => r !== t).map((r) => r.f), target.weights).score);
      return fmt(scores.reduce((a, b) => a + b, 0) / scores.length).padStart(12);
    });
    lines.push(take.id.padStart(21) + cells.join(''));
  }
  console.log(`\n[mallard matrix]\n${lines.join('\n')}`);
  expect(lines).toHaveLength(MALLARD_CALLS.length + 1);
}, 120_000);

it('every mallard reference passes the take gates', () => {
  expect(duckClips.filter((c) => checkTake(c.f) !== null).map((c) => `${c.name}: ${checkTake(c.f)!.reason}`)).toEqual([]);
});
