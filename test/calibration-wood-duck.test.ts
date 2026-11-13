// Calibration of the wood duck calls (Phase 14), same rules as test/calibration-mallard.test.ts:
// leave-one-out over each call's references must beat every negative by MARGIN points, and the
// matrix rule (lowest same-call score minus highest score of another wood duck call's clip) must
// also reach MARGIN. Negatives: the other wood duck calls, every turkey, barred owl, elk and mallard
// reference (locked calls included), the turkey wrong-call fixtures and the junk clips. Every clip
// is analyzed in the wood duck band, as the app does for a wood duck take. Clips come from the
// manifest, so locked calls (no references in the app) are measured too.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { checkTake, scoreTake, type Weights } from '../src/audio/score';
import { WOOD_DUCK_BAND, WOOD_DUCK_CALLS } from '../src/calls/wood-duck';
import { readWav } from './wav';

/** Same margin as the turkey, owl, elk and mallard calibration; not tuned. */
const MARGIN = 15;
const MIN_REFS = 3;

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)), { band: WOOD_DUCK_BAND });
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  call: string;
  f: Features;
  /** Source recording (one bird or group); empty for other species. */
  rec?: string;
}

const manifest = json('public/audio/wood-duck/manifest.json') as { clips: { file: string; call: string; sourceId: string }[] };
const woodDuckClips: Clip[] = manifest.clips.map((c) => ({ name: c.file, call: c.call, rec: c.sourceId, f: load(`public/audio/wood-duck/${c.file}`) }));
const clipsOf = (call: string) => woodDuckClips.filter((c) => c.call === call);
const species = (dir: string, call: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string }) => ({ name: c.file, call, f: load(`${dir}/${c.file}`) }));
const otherSpecies: Clip[] = [
  ...species('public/audio/turkey', 'turkey'),
  ...species('public/audio/barred-owl', 'owl'),
  ...species('public/audio/elk', 'elk'),
  ...species('public/audio/mallard', 'mallard'),
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
    const negs = [...woodDuckClips.filter((c) => c.call !== callId), ...otherSpecies].map((n) => ({ n, s: score(n.f, others, weights).score }));
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
  const otherMax = Math.max(...woodDuckClips.filter((c) => c.call !== callId).map((c) => score(c.f, all, weights).score));
  return { rows, minMargin, matrixMargin: sameMin - otherMax };
}

const calls = WOOD_DUCK_CALLS.filter((c) => clipsOf(c.id).length >= MIN_REFS);

describe.each(calls.map((c) => [c.id, c]))('wood duck calibration: %s', (_id, call) => {
  it(`${call.locked ? 'locked' : 'unlocked'}; unlocked only if leave-one-out beats every negative by >= ${MARGIN}`, () => {
    const r = calibrate(call.id, call.weights);
    console.log(
      `\n[wood duck ${call.id}] ${call.locked ? 'LOCKED' : 'unlocked'} weights ${JSON.stringify(call.weights)}\n${r.rows.join('\n')}\n` +
        `[wood duck ${call.id}] min margin ${r.minMargin.toFixed(1)}, matrix margin ${r.matrixMargin.toFixed(1)}`,
    );
    if (!call.locked) {
      expect(r.minMargin, `${call.id} min margin`).toBeGreaterThanOrEqual(MARGIN);
      expect(r.matrixMargin, `${call.id} matrix margin`).toBeGreaterThanOrEqual(MARGIN);
      // The app plays and scores exactly the manifest clips of an unlocked call.
      expect(call.references).toEqual(clipsOf(call.id).map((c) => `audio/wood-duck/${c.name}`));
    } else {
      expect(call.references).toEqual([]);
    }
  }, 120_000);
});

// Stricter than the other species' tests: the drake whistle has two clips from each of two birds,
// so leave-one-out can match a clip with its sibling from the same recording. Leaving out the
// whole recording, each clip must still beat every negative by MARGIN.
describe.each(calls.filter((c) => !c.locked).map((c) => [c.id, c]))('wood duck leave-one-recording-out: %s', (_id, call) => {
  it(`each clip scored against the other recordings' clips beats every negative by >= ${MARGIN}`, () => {
    const own = clipsOf(call.id);
    const rows = own.map((clip) => {
      const refs = own.filter((r) => r.rec !== clip.rec).map((r) => r.f);
      const same = score(clip.f, refs, call.weights).score;
      const worst = [...woodDuckClips.filter((c) => c.call !== call.id), ...otherSpecies]
        .map((n) => ({ n, s: score(n.f, refs, call.weights).score }))
        .reduce((a, b) => (b.s > a.s ? b : a));
      return { name: clip.name, rec: clip.rec, same, worst: worst.n.name, margin: same - worst.s };
    });
    console.log(
      `\n[wood duck ${call.id} leave-one-recording-out]\n` +
        rows.map((r) => `${r.name.padEnd(20)} (${r.rec}) same ${fmt(r.same)}  worst negative ${r.worst}  margin ${fmt(r.margin)}`).join('\n'),
    );
    expect(new Set(own.map((c) => c.rec)).size, 'recordings').toBeGreaterThanOrEqual(2);
    for (const r of rows) expect(r.margin, r.name).toBeGreaterThanOrEqual(MARGIN);
  }, 120_000);
});

it('every wood duck call has 3+ clips, so each one was calibrated', () => {
  expect(calls.map((c) => c.id)).toEqual(WOOD_DUCK_CALLS.map((c) => c.id));
});

it('wood duck confusion matrix (mean score, take row vs target column, own row leave-one-out)', () => {
  const lines = ['        take \\ target' + WOOD_DUCK_CALLS.map((c) => c.id.padStart(15)).join('')];
  for (const take of WOOD_DUCK_CALLS) {
    const takes = clipsOf(take.id);
    const cells = WOOD_DUCK_CALLS.map((target) => {
      const refs = clipsOf(target.id);
      const scores = takes.map((t) => score(t.f, refs.filter((r) => r !== t).map((r) => r.f), target.weights).score);
      return fmt(scores.reduce((a, b) => a + b, 0) / scores.length).padStart(15);
    });
    lines.push(take.id.padStart(21) + cells.join(''));
  }
  console.log(`\n[wood duck matrix]\n${lines.join('\n')}`);
  expect(lines).toHaveLength(WOOD_DUCK_CALLS.length + 1);
}, 120_000);

it('every wood duck reference passes the take gates', () => {
  expect(woodDuckClips.filter((c) => checkTake(c.f) !== null).map((c) => `${c.name}: ${checkTake(c.f)!.reason}`)).toEqual([]);
});
