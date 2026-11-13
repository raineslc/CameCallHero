// Library data: every call has a cited description, references match the manifest, and the
// "how many notes / how long" line is measured from the reference clips.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFeatures, HOP_SEC } from '../src/audio/features';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { callSeconds, clipInfo, describeMeasure, measure, playheadFraction, type ClipInfo } from '../src/library/references';
import { backHref, matchRoute } from '../src/router';
import { readWav } from './wav';

const root = new URL('..', import.meta.url);
const manifest: ClipInfo[] = JSON.parse(readFileSync(new URL('public/audio/turkey/manifest.json', root), 'utf8')).clips;

describe('call descriptions', () => {
  for (const c of TURKEY_CALLS) {
    it(`${c.name}: meaning, when and at least one https source`, () => {
      expect(c.description.meaning.length).toBeGreaterThan(10);
      expect(c.description.when.length).toBeGreaterThan(10);
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url).toMatch(/^https:\/\//);
    });
    it(`${c.name}: locked exactly when it has no references, each reference in the manifest`, () => {
      expect(c.locked).toBe(c.references.length === 0);
      for (const path of c.references) {
        const info = clipInfo(manifest, path);
        expect(info, path).toBeDefined();
        expect(info!.call).toBe(c.id);
      }
    });
  }
});

describe('measure', () => {
  it('gobble references: the line is computed from the clips', () => {
    const gobble = TURKEY_CALLS.find((c) => c.id === 'gobble')!;
    const fs = gobble.references.map((p) => extractFeatures(readWav(new URL(`public/${p}`, root))));
    const m = measure(fs)!;
    expect(m.clips).toBe(6);
    // The manifest notes say each clip holds one ~0.95 s burst. The scorer's note segmentation
    // gives 1-2 notes and 0.63-1.15 s (shortest gobble-2, gobble-3 split in two); the
    // library shows the scorer's numbers because Practice scores against those.
    for (const f of fs) {
      expect(f.notes.length).toBeGreaterThanOrEqual(1);
      expect(callSeconds(f)).toBeGreaterThan(0.5);
      expect(callSeconds(f)).toBeLessThan(1.6);
    }
    expect(m.notes[0]).toBe(Math.min(...fs.map((f) => f.notes.length)));
    expect(describeMeasure(m)).toMatch(/^\d+(–\d+)? notes?, \d\.\d\d(–\d\.\d\d)? s long \(as the scorer measures 6 reference clips\)$/);
  });

  it('no clips gives null; ranges collapse when equal', () => {
    expect(measure([])).toBeNull();
    expect(describeMeasure({ clips: 1, notes: [1, 1], seconds: [0.5, 0.5] })).toBe('1 note, 0.50 s long (as the scorer measures 1 reference clip)');
    expect(describeMeasure({ clips: 2, notes: [2, 3], seconds: [0.5, 0.75] })).toBe('2–3 notes, 0.50–0.75 s long (as the scorer measures 2 reference clips)');
  });
});

describe('playheadFraction', () => {
  const f = extractFeatures(readWav(new URL('public/audio/turkey/gobble-1.wav', root)));
  it('stays in 0..1 and is 0 for bad input', () => {
    expect(playheadFraction(0, f)).toBe(0);
    expect(playheadFraction(-1, f)).toBe(0);
    expect(playheadFraction(NaN, f)).toBe(0);
    expect(playheadFraction(1e9, f)).toBe(1);
    expect(playheadFraction(f.frameCount * HOP_SEC * 0.5, f)).toBeCloseTo(0.5);
  });
});

describe('matchRoute', () => {
  const routes = { '/': 1, '/mic': 1, '/call': 1 };
  it('splits the first segment from the parameter', () => {
    expect(matchRoute('/', routes, '/')).toEqual(['/', '']);
    expect(matchRoute('/mic', routes, '/')).toEqual(['/mic', '']);
    expect(matchRoute('/call/gobble', routes, '/')).toEqual(['/call', 'gobble']);
    expect(matchRoute('/nope/x', routes, '/')).toEqual(['/', '']);
  });
});

describe('backHref', () => {
  it('practice goes back to its call, other inner screens to home, home has none', () => {
    expect(backHref('/', '')).toBeNull();
    expect(backHref('/mic', '')).toBe('#/');
    expect(backHref('/call', 'gobble')).toBe('#/');
    expect(backHref('/practice', 'gobble')).toBe('#/call/gobble');
    expect(backHref('/practice', '')).toBe('#/');
  });
});

describe('challenge routes (Phase 10)', () => {
  const routes = { '/': 1, '/challenge': 1 };
  it('#/challenge is turkey, #/<species>/challenge carries the species; back goes to that species home', () => {
    expect(matchRoute('/challenge', routes, '/', ['barred-owl'])).toEqual(['/challenge', '']);
    expect(matchRoute('/barred-owl/challenge', routes, '/', ['barred-owl'])).toEqual(['/challenge', 'barred-owl']);
    expect(backHref('/challenge', '')).toBe('#/');
    expect(backHref('/challenge', 'barred-owl')).toBe('#/barred-owl');
  });
});
