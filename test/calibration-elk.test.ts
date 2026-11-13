// Calibration of the elk calls, same rules as test/calibration.test.ts (Phase 2/2b) and
// test/calibration-owl.test.ts (Phase 8): leave-one-out over each call's references must beat
// every negative by MARGIN points. Negatives: the other elk calls, every turkey and barred owl
// reference (locked calls included), the turkey wrong-call fixtures and the junk clips. Every
// clip is analyzed in the elk band, as the app does for an elk take. Clips come from the manifest, so locked calls (no references in the
// app) are measured too. A call may be unlocked only if it passes; locked calls are reported.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { checkTake, scoreTake, type Weights } from '../src/audio/score';
import { ELK_BAND, ELK_CALLS } from '../src/calls/elk';
import { readWav } from './wav';

/** Same margin as the turkey calibration; not tuned. */
const MARGIN = 15;
const MIN_REFS = 3;

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)), { band: ELK_BAND });
const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  call: string;
  f: Features;
}

const elkManifest = json('public/audio/elk/manifest.json') as { clips: { file: string; call: string }[] };
const elkClips: Clip[] = elkManifest.clips.map((c) => ({ name: c.file, call: c.call, f: load(`public/audio/elk/${c.file}`) }));
const clipsOf = (call: string) => elkClips.filter((c) => c.call === call);
const fixture = (dir: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string }) => ({ name: c.file, call: 'other', f: load(`${dir}/${c.file}`) }));
const species = (dir: string): Clip[] =>
  json(`${dir}/manifest.json`).clips.map((c: { file: string }) => ({ name: `${dir.split('/').pop()}/${c.file}`, call: 'other', f: load(`${dir}/${c.file}`) }));
const nonElk: Clip[] = [
  ...species('public/audio/turkey'),
  ...species('public/audio/barred-owl'),
  ...fixture('test/fixtures/turkey-other'),
  ...fixture('test/fixtures/junk'),
];

const fmt = (v: number) => v.toFixed(1).padStart(6);
const score = (take: Features, refs: Features[], w: Weights) => scoreTake(take, refs, w);

interface Result {
  rows: string[];
  /** Smallest leave-one-out margin over every negative. */
  minMargin: number;
  /** Matrix rule: lowest same-call score minus highest score of another elk call's clip. */
  matrixMargin: number;
}

function calibrate(callId: string, weights: Weights): Result {
  const refs = clipsOf(callId);
  const rows: string[] = [];
  let minMargin = Infinity;
  refs.forEach((clip, i) => {
    const others = refs.filter((_, j) => j !== i).map((r) => r.f);
    const same = score(clip.f, others, weights);
    const negs = [...elkClips.filter((c) => c.call !== callId), ...nonElk].map((n) => ({ n, s: score(n.f, others, weights).score }));
    const worst = negs.reduce((a, b) => (b.s > a.s ? b : a));
    const margin = same.score - worst.s;
    minMargin = Math.min(minMargin, margin);
    rows.push(
      `${clip.name.padEnd(16)} same ${fmt(same.score)} (r${fmt(same.rhythm)} p${fmt(same.pitch)} t${fmt(same.tone)})` +
        `${same.rejected ? ` rejected: ${same.rejected.reason}` : ''}  worst negative ${worst.n.name} ${fmt(worst.s)}  margin ${fmt(margin)}`,
    );
  });
  const all = refs.map((r) => r.f);
  const sameMin = Math.min(...refs.map((clip, i) => score(clip.f, all.filter((_, j) => j !== i), weights).score));
  const otherMax = Math.max(...elkClips.filter((c) => c.call !== callId).map((c) => score(c.f, all, weights).score));
  return { rows, minMargin, matrixMargin: sameMin - otherMax };
}

const calls = ELK_CALLS.filter((c) => clipsOf(c.id).length >= MIN_REFS);

describe.each(calls.map((c) => [c.id, c]))('elk calibration: %s', (_id, call) => {
  it(`${call.locked ? 'locked' : 'unlocked'}; unlocked only if leave-one-out beats every negative by >= ${MARGIN}`, () => {
    const r = calibrate(call.id, call.weights);
    console.log(
      `\n[elk ${call.id}] ${call.locked ? 'LOCKED' : 'unlocked'} weights ${JSON.stringify(call.weights)}\n${r.rows.join('\n')}\n` +
        `[elk ${call.id}] min margin ${r.minMargin.toFixed(1)}, matrix margin ${r.matrixMargin.toFixed(1)}`,
    );
    if (!call.locked) {
      expect(r.minMargin, `${call.id} min margin`).toBeGreaterThanOrEqual(MARGIN);
      expect(r.matrixMargin, `${call.id} matrix margin`).toBeGreaterThanOrEqual(MARGIN);
      // The app plays and scores exactly the manifest clips of an unlocked call.
      expect(call.references).toEqual(clipsOf(call.id).map((c) => `audio/elk/${c.name}`));
    } else {
      expect(call.references).toEqual([]);
    }
  }, 120_000);
});

it('every elk call has 3+ clips, so each one was calibrated', () => {
  expect(calls.map((c) => c.id)).toEqual(ELK_CALLS.map((c) => c.id));
});

it('elk confusion matrix (mean score, take row vs target column, own row leave-one-out)', () => {
  const header = '              take \\ target' + ELK_CALLS.map((c) => c.id.padStart(17)).join('');
  const lines = [header];
  for (const take of ELK_CALLS) {
    const takes = clipsOf(take.id);
    const cells = ELK_CALLS.map((target) => {
      const refs = clipsOf(target.id);
      const scores = takes.map((t) => score(t.f, refs.filter((r) => r !== t).map((r) => r.f), target.weights).score);
      return fmt(scores.reduce((a, b) => a + b, 0) / scores.length).padStart(17);
    });
    lines.push(take.id.padStart(26) + cells.join(''));
  }
  console.log(`\n[elk matrix]\n${lines.join('\n')}`);
  expect(lines).toHaveLength(ELK_CALLS.length + 1);
}, 120_000);

describe('elk references and the take gates', () => {
  it('only the cow mews fail a gate (too noisy: a locked call)', () => {
    const rejected = elkClips.filter((c) => checkTake(c.f) !== null).map((c) => `${c.name}: ${checkTake(c.f)!.reason}`);
    expect(rejected).toEqual(['cow-mew-1.wav: too-noisy', 'cow-mew-2.wav: too-noisy', 'cow-mew-3.wav: too-noisy', 'cow-mew-4.wav: too-noisy']);
  });

  it('elk references are all served from the elk folder', () => {
    expect(ELK_CALLS.every((c) => c.references.every((p) => p.startsWith('audio/elk/')))).toBe(true);
  });
});
