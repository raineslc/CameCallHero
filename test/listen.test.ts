// Listen-only clips of locked calls (src/calls/listen.ts): every clip is a file in the species'
// manifest (so it has a license and attribution), belongs to that call, and is not marked uncertain.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { LISTEN_KEYS, playableClips } from '../src/calls/listen';
import { SPECIES } from '../src/calls/species';

const root = new URL('..', import.meta.url);
type Clip = { file: string; call: string; uncertain?: boolean; license: string; author: string };
const manifest = (species: string): Clip[] => JSON.parse(readFileSync(new URL(`public/audio/${species}/manifest.json`, root), 'utf8')).clips;

describe('listen-only clips', () => {
  it('every table key names a locked call', () => {
    const locked = SPECIES.flatMap((s) => s.calls.filter((c) => c.locked).map((c) => `${s.id}/${c.id}`));
    for (const key of LISTEN_KEYS) expect(locked, key).toContain(key);
  });

  for (const s of SPECIES) {
    for (const c of s.calls) {
      it(`${s.id}/${c.id}: playable clips exist, are attributed, belong to the call and are not uncertain`, () => {
        const paths = playableClips(s, c);
        if (!c.locked) return expect(paths).toBe(c.references);
        expect(new Set(paths).size).toBe(paths.length);
        const clips = manifest(s.id);
        for (const path of paths) {
          expect(existsSync(new URL(`public/${path}`, root)), path).toBe(true);
          const info = clips.find((x) => path === `audio/${s.id}/${x.file}`);
          expect(info, path).toBeDefined();
          expect(info!.call).toBe(c.id);
          expect(info!.uncertain ?? false).toBe(false);
          expect(info!.license).toMatch(/^(CC0|CC BY( |-)|CC BY-SA|CC BY-NC|Public domain)/i);
          expect(info!.license).not.toMatch(/ND/);
          expect(info!.author.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it('a locked call without listen clips plays nothing', () => {
    const cut = SPECIES[0].calls.find((c) => c.id === 'cut')!;
    expect(playableClips(SPECIES[0], cut)).toEqual([]);
  });
});
