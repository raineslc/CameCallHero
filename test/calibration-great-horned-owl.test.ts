// Calibration of the great horned owl calls, same rules as test/calibration-owl.test.ts
// (Phase 8/8b): leave-one-out over each call's references must beat every negative by MARGIN
// points, and the matrix rule over the great horned owl calls. Negatives: the other great horned
// owl calls (none while it has one call), every barred owl clip (other-species negatives), every
// turkey reference, the turkey wrong-call fixtures and the junk clips. Every clip is analyzed in
// the owl band, as the app does for an owl take. A call may be unlocked only if it passes.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { checkTake, scoreTake, type Weights } from '../src/audio/score';
import { OWL_BAND } from '../src/calls/barred-owl';
import { GREAT_HORNED_OWL_CALLS } from '../src/calls/great-horned-owl';
import { GREAT_HORNED_OWL } from '../src/calls/species';
import { readWav } from './wav';

/** Same margin as the turkey and barred owl calibrations; not tuned. */
const MARGIN = 15;
const MIN_REFS = 3;
const DIR = 'public/audio/great-horned-owl';

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)), { band: OWL_BAND });
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  call: string;
  f: Features;
}

const fromManifest = (dir: string, call?: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string; call?: string }) => ({ name: c.file, call: call ?? c.call ?? 'other', f: load(`${dir}/${c.file}`) }));

const ghClips = fromManifest(DIR);
const clipsOf = (call: string) => ghClips.filter((c) => c.call === call);
const negativesFor = (call: string): Clip[] => [
  ...ghClips.filter((c) => c.call !== call),
  ...fromManifest('public/audio/barred-owl', 'barred-owl'),
  ...fromManifest('public/audio/turkey', 'turkey'),
  ...fromManifest('test/fixtures/turkey-other', 'other'),
  ...fromManifest('test/fixtures/junk', 'other'),
];

const fmt = (v: number) => v.toFixed(1).padStart(6);

function calibrate(callId: string, weights: Weights) {
  const refs = clipsOf(callId);
  const negs = negativesFor(callId);
  const rows: string[] = [];
  let minMargin = Infinity;
  refs.forEach((clip, i) => {
    const others = refs.filter((_, j) => j !== i).map((r) => r.f);
    const same = scoreTake(clip.f, others, weights);
    const worst = negs.map((n) => ({ n, s: scoreTake(n.f, others, weights).score })).reduce((a, b) => (b.s > a.s ? b : a));
    const margin = same.score - worst.s;
    minMargin = Math.min(minMargin, margin);
    rows.push(
      `${clip.name.padEnd(24)} same ${fmt(same.score)} (r${fmt(same.rhythm)} p${fmt(same.pitch)} t${fmt(same.tone)})` +
        `${same.rejected ? ` rejected: ${same.rejected.reason}` : ''}  worst negative ${worst.n.name} (${worst.n.call}) ${fmt(worst.s)}  margin ${fmt(margin)}`,
    );
  });
  const all = refs.map((r) => r.f);
  const sameMin = Math.min(...refs.map((clip, i) => scoreTake(clip.f, all.filter((_, j) => j !== i), weights).score));
  const otherCalls = ghClips.filter((c) => c.call !== callId);
  // Matrix rule over the species' own calls; with a single call there is nothing to confuse it with.
  const matrixMargin = otherCalls.length ? sameMin - Math.max(...otherCalls.map((c) => scoreTake(c.f, all, weights).score)) : Infinity;
  return { rows, minMargin, matrixMargin, sameMin };
}

const calls = GREAT_HORNED_OWL_CALLS.filter((c) => clipsOf(c.id).length >= MIN_REFS);

describe.each(calls.map((c) => [c.id, c]))('great horned owl calibration: %s', (_id, call) => {
  it(`${call.locked ? 'locked' : 'unlocked'}; unlocked only if leave-one-out beats every negative by >= ${MARGIN}`, () => {
    const r = calibrate(call.id, call.weights);
    console.log(
      `\n[great-horned-owl ${call.id}] ${call.locked ? 'LOCKED' : 'unlocked'} weights ${JSON.stringify(call.weights)}\n${r.rows.join('\n')}\n` +
        `[great-horned-owl ${call.id}] min margin ${r.minMargin.toFixed(1)}, matrix margin ${r.matrixMargin.toFixed(1)}, lowest leave-one-out ${r.sameMin.toFixed(1)}`,
    );
    if (!call.locked) {
      expect(r.minMargin, `${call.id} min margin`).toBeGreaterThanOrEqual(MARGIN);
      expect(r.matrixMargin, `${call.id} matrix margin`).toBeGreaterThanOrEqual(MARGIN);
      // The app plays and scores exactly the manifest clips of an unlocked call.
      expect(call.references).toEqual(clipsOf(call.id).map((c) => `audio/great-horned-owl/${c.name}`));
    } else {
      expect(call.references).toEqual([]);
    }
  }, 120_000);
});

it('every great horned owl call has 3+ clips, so each one was calibrated', () => {
  expect(calls.map((c) => c.id)).toEqual(GREAT_HORNED_OWL_CALLS.map((c) => c.id));
});

it('the species uses the owl band and its own reference folder', () => {
  expect(GREAT_HORNED_OWL.band).toEqual(OWL_BAND);
  for (const c of GREAT_HORNED_OWL_CALLS) for (const p of c.references) expect(p).toMatch(/^audio\/great-horned-owl\//);
});

describe('great horned owl references and the take gates', () => {
  it('every reference passes the take gates unchanged', () => {
    expect(ghClips.filter((c) => checkTake(c.f) !== null).map((c) => c.name)).toEqual([]);
  });

  it('level does not change the score: a reference scaled by 0.1 scores the same', () => {
    const clip = readWav(new URL(`${DIR}/territorial-hoot-1.wav`, root));
    const quiet = { ...clip, samples: clip.samples.map((v) => v * 0.1) };
    const refs = clipsOf('territorial-hoot').slice(1).map((c) => c.f);
    const w = GREAT_HORNED_OWL_CALLS[0].weights;
    const a = scoreTake(extractFeatures(clip, { band: OWL_BAND }), refs, w);
    const b = scoreTake(extractFeatures(quiet, { band: OWL_BAND }), refs, w);
    expect(b.rejected).toBeNull();
    expect(Math.abs(a.score - b.score)).toBeLessThan(0.5);
  });

  it('manifest tags every clip with the recordist-labelled sex (kept for a later male/female split)', () => {
    const m = json(`${DIR}/manifest.json`) as { clips: { sex: string }[] };
    expect(m.clips.every((c) => c.sex === 'male' || c.sex === 'female')).toBe(true);
    expect(m.clips.filter((c) => c.sex === 'male')).toHaveLength(7);
    expect(m.clips.filter((c) => c.sex === 'female')).toHaveLength(5);
  });
});
