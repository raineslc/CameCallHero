// Calibration: proves the score means something before any screen is built.
// Leave-one-out over the reference clips: a real call scored against the *other*
// references of the same call must clearly beat wrong-call turkey sounds and junk.
// Thresholds were fixed before looking at results; tune features/weights, not these.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, type Features } from '../src/audio/features';
import { scoreTake, compare, combine } from '../src/audio/score';
import { TURKEY_CALLS, type CallDef } from '../src/calls/turkey';
import { readWav } from './wav';

/** Same-call (leave-one-out) must beat every wrong-call and junk take by this many points. */
const MARGIN = 15;
/** A call takes part in calibration once it has this many references. */
const MIN_REFS = 3;

const root = new URL('..', import.meta.url);
const load = (rel: string): Features => extractFeatures(readWav(new URL(rel, root)));
const manifest = (rel: string): { clips: { file: string; sourceId?: string }[] } =>
  JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

interface Clip {
  name: string;
  source: string;
  f: Features;
}

const refClips = new Map<string, Clip[]>(
  TURKEY_CALLS.map((c) => {
    const m = manifest('public/audio/turkey/manifest.json');
    return [
      c.id,
      c.references.map((path) => {
        const file = path.split('/').pop()!;
        return { name: file, source: m.clips.find((x) => x.file === file)?.sourceId ?? file, f: load(`public/${path}`) };
      }),
    ];
  }),
);
const negatives = (dir: string): Clip[] =>
  manifest(`${dir}/manifest.json`).clips.map((c) => ({ name: c.file, source: c.sourceId ?? 'synth', f: load(`${dir}/${c.file}`) }));
const wrongCall = negatives('test/fixtures/turkey-other');
const junk = negatives('test/fixtures/junk');

const calibrated = TURKEY_CALLS.filter((c) => (refClips.get(c.id)?.length ?? 0) >= MIN_REFS);
const fmt = (v: number) => v.toFixed(1).padStart(6);

/** Score of a take against a call's references, leaving out reference `skip`. */
function scoreAgainst(take: Features, call: CallDef, skip = -1) {
  const refs = refClips.get(call.id)!.filter((_, i) => i !== skip).map((c) => c.f);
  return scoreTake(take, refs, call.weights);
}

describe.each(calibrated.map((c) => [c.id, c]))('calibration: %s', (_id, call) => {
  const refs = refClips.get(call.id)!;

  it(`leave-one-out ${call.id} beats wrong-call turkey sounds and junk by >= ${MARGIN}`, () => {
    const rows: string[] = [];
    const failures: string[] = [];
    refs.forEach((clip, i) => {
      const same = scoreAgainst(clip.f, call, i);
      // Same call, other recording session only: a harder, more honest number.
      const otherSession = refs.filter((r) => r.source !== clip.source).map((r) => r.f);
      const cross = scoreTake(clip.f, otherSession, call.weights);
      const negs = [...wrongCall, ...junk].map((n) => ({ n, r: scoreAgainst(n.f, call, i) }));
      const worst = negs.reduce((a, b) => (b.r.score > a.r.score ? b : a));
      const margin = same.score - worst.r.score;
      rows.push(
        `${clip.name.padEnd(13)} same ${fmt(same.score)} (r${fmt(same.rhythm)} p${fmt(same.pitch)} t${fmt(same.tone)})` +
          `  other-session ${fmt(cross.score)}  worst negative ${worst.n.name} ${fmt(worst.r.score)}  margin ${fmt(margin)}`,
      );
      expect(same.rejected, `${clip.name} rejected: ${same.rejected?.message}`).toBeNull();
      if (margin < MARGIN) failures.push(`${clip.name}: margin ${margin.toFixed(1)} vs ${worst.n.name}`);
    });

    const negRows = [...wrongCall, ...junk].map((n) => {
      const r = scoreAgainst(n.f, call);
      // Raw similarity without the take gates, to show junk is not saved only by the gates.
      const raw = Math.max(...refs.map((c) => combine(compare(n.f, c.f), call.weights)));
      return `${n.name.padEnd(16)} score ${fmt(r.score)}  raw ${fmt(raw)}  ${r.rejected ? `rejected: ${r.rejected.reason}` : `(r${fmt(r.rhythm)} p${fmt(r.pitch)} t${fmt(r.tone)})`}`;
    });
    console.log(`\n[${call.id}] leave-one-out\n${rows.join('\n')}\n[${call.id}] negatives vs all references\n${negRows.join('\n')}`);
    expect(failures, failures.join('; ')).toEqual([]);
  });
});

describe('cross-call confusion matrix (5x5)', () => {
  const ready = calibrated.length >= 2;
  const why = `needs 2+ calls with ${MIN_REFS}+ references; have: ${calibrated.map((c) => c.id).join(', ') || 'none'}; missing: ${TURKEY_CALLS.filter((c) => !calibrated.includes(c)).map((c) => c.id).join(', ')}`;
  if (!ready) console.log(`[matrix] skipped: ${why}`);

  it.skipIf(!ready)(`each call's leave-one-out beats other calls' takes by >= ${MARGIN} (${ready ? 'active' : `skipped: ${why}`})`, () => {
    // Row = the call performed (take), column = the call it is scored as. Cell = mean score.
    const header = '        take \\ target ' + TURKEY_CALLS.map((c) => c.id.padStart(12)).join('');
    const lines = [header];
    const failures: string[] = [];
    for (const takeCall of TURKEY_CALLS) {
      const takes = refClips.get(takeCall.id)!;
      const cells = TURKEY_CALLS.map((target) => {
        if (!calibrated.includes(target) || takes.length === 0) return '         n/a';
        const scores = takes.map((t, i) => scoreAgainst(t.f, target, takeCall.id === target.id ? i : -1).score);
        return fmt(scores.reduce((a, b) => a + b, 0) / scores.length).padStart(12);
      });
      lines.push(takeCall.id.padStart(21) + cells.join(''));
    }
    console.log(`\n[matrix]\n${lines.join('\n')}`);

    for (const target of calibrated) {
      const sameMin = Math.min(...refClips.get(target.id)!.map((t, i) => scoreAgainst(t.f, target, i).score));
      for (const other of calibrated.filter((c) => c !== target)) {
        const otherMax = Math.max(...refClips.get(other.id)!.map((t) => scoreAgainst(t.f, target).score));
        if (sameMin - otherMax < MARGIN) failures.push(`${other.id} as ${target.id}: margin ${(sameMin - otherMax).toFixed(1)}`);
      }
    }
    expect(failures, failures.join('; ')).toEqual([]);
  });
});
