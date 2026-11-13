// Checks the reference-audio manifests: every WAV is listed, every entry has an
// allowed license and proof URL, files are mono 44.1 kHz 16-bit, each species folder < 15 MB, and
// every owl, elk, mallard and wood duck call definition cites a source.
// Plain JS (not TS): the project has no @types/node and this test needs node:fs.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Allowed: CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, US-government public domain.
// NonCommercial is allowed only because the app stays free (AGENTS.md "Hard rules").
// Never ND (NoDerivatives): every clip is trimmed, which ND forbids.
const ALLOWED = [
  { name: /^CC0 1\.0$/, url: /^https:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/$/ },
  { name: /^CC BY [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by\/[0-9.]+\/$/ },
  { name: /^CC BY-SA [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by-sa\/[0-9.]+\/$/ },
  { name: /^CC BY-NC [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by-nc\/[0-9.]+\/$/ },
  { name: /^CC BY-NC-SA [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by-nc-sa\/[0-9.]+\/$/ },
  { name: /^Public domain \(US government work\)$/, url: /^https?:\/\/.+/ },
];

const sets = [
  { dir: 'public/audio/turkey', needsCall: true, trimmed: true },
  // Wild birds only: every barred owl entry must say the recording used no playback.
  { dir: 'public/audio/barred-owl', needsCall: true, trimmed: true, noPlayback: true },
  // Wild elk only: no page states playback, so playbackUsed is null ("not stated"); true is rejected.
  { dir: 'public/audio/elk', needsCall: true, trimmed: true, wildOnly: true },
  { dir: 'public/audio/mallard', needsCall: true, trimmed: true, noPlayback: true },
  // Same for the great horned owl (Phase 13).
  { dir: 'public/audio/great-horned-owl', needsCall: true, trimmed: true, noPlayback: true },
  // And the eastern screech-owl (Phase 15).
  { dir: 'public/audio/eastern-screech-owl', needsCall: true, trimmed: true, noPlayback: true },
  { dir: 'public/audio/wood-duck', needsCall: true, trimmed: true, noPlayback: true },
  { dir: 'test/fixtures/junk', needsCall: false, trimmed: false },
  { dir: 'test/fixtures/turkey-other', needsCall: false, trimmed: true },
  // Real phone takes stay at the phone's own rate (48 kHz), unconverted.
  { dir: 'test/fixtures/phone', needsCall: false, trimmed: false, sampleRate: 48000 },
];

function wavFormat(path) {
  const b = readFileSync(path);
  return {
    riff: b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12),
    format: b.readUInt16LE(20),
    channels: b.readUInt16LE(22),
    sampleRate: b.readUInt32LE(24),
    bits: b.readUInt16LE(34),
  };
}

for (const { dir, needsCall, trimmed, noPlayback = false, wildOnly = false, sampleRate = 44100 } of sets) {
  describe(`${dir}/manifest.json`, () => {
    const abs = join(root, dir);
    const manifest = JSON.parse(readFileSync(join(abs, 'manifest.json'), 'utf8'));
    const wavs = readdirSync(abs).filter((f) => f.endsWith('.wav')).sort();
    const listed = manifest.clips.map((c) => c.file).sort();

    it('lists every WAV in the folder, and only those', () => {
      expect(listed).toEqual(wavs);
      expect(new Set(listed).size).toBe(listed.length);
    });

    it.each(manifest.clips.map((c) => [c.file, c]))('%s has an allowed license and attribution', (_f, c) => {
      const lic = ALLOWED.find((a) => a.name.test(c.license));
      expect(lic, `license "${c.license}" not allowed`).toBeDefined();
      expect(c.licenseUrl).toMatch(lic.url);
      expect(`${c.license} ${c.licenseUrl}`).not.toMatch(/\bnd\b|-nd|noderiv/i);
      expect(c.author).toBeTruthy();
      expect(c.sourceUrl).toBeTruthy();
      expect(c.notes).toBeTruthy();
      if (needsCall) {
        expect(manifest.calls).toContain(c.call);
        expect(c.file).toMatch(new RegExp(`^${c.call}-\\d+\\.wav$`));
      }
      if (noPlayback) expect(c.playbackUsed).toBe(false);
      if (wildOnly) {
        expect(c.wild).toBe(true);
        expect([false, null]).toContain(c.playbackUsed);
        expect(c.playbackNote).toBeTruthy();
      }
      if (trimmed) {
        expect(c.sourceUrl).toMatch(/^https:\/\//);
        expect(c.trimStartSec).toBeGreaterThanOrEqual(0);
        expect(c.trimEndSec).toBeGreaterThan(c.trimStartSec);
      }
    });

    it.each(wavs)(`%s is mono ${sampleRate / 1000} kHz 16-bit PCM`, (f) => {
      expect(wavFormat(join(abs, f))).toEqual({
        riff: 'RIFFWAVE',
        format: 1,
        channels: 1,
        sampleRate,
        bits: 16,
      });
    });
  });
}

it.each(['public/audio/turkey', 'public/audio/barred-owl', 'public/audio/elk', 'public/audio/mallard', 'public/audio/great-horned-owl', 'public/audio/eastern-screech-owl', 'public/audio/wood-duck'])('%s is under 15 MB', (d) => {
  const dir = join(root, d);
  const total = readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
  expect(total).toBeLessThan(15 * 1024 * 1024);
});

describe.each(['public/audio/barred-owl', 'public/audio/elk', 'public/audio/mallard', 'public/audio/great-horned-owl', 'public/audio/eastern-screech-owl', 'public/audio/wood-duck'])('%s call definitions', (dir) => {
  const m = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8'));
  const defs = m.callDefinitions;

  it('defines exactly the listed calls', () => {
    expect(defs.calls.map((c) => c.id).sort()).toEqual([...m.calls].sort());
  });

  it.each(defs.calls.map((c) => [c.id, c]))('%s cites at least one known source', (_id, c) => {
    expect(c.definition).toBeTruthy();
    expect(c.sources.length).toBeGreaterThan(0);
    for (const s of c.sources) expect(defs.sources[s]?.url).toMatch(/^https:\/\//);
  });
});

// Mallards hybridise with domestic ducks; wood ducks are kept in waterfowl collections and have
// escaped and feral birds outside their native range. Every clip records why it counts as a wild bird.
describe.each(['public/audio/mallard', 'public/audio/wood-duck'])('%s wild birds', (dir) => {
  const m = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8'));
  it.each(m.clips.map((c) => [c.file, c]))('%s says it is a wild bird', (_f, c) => {
    expect(c.wildBird).toBeTruthy();
    // The notes quote the recording page (place, remarks): none may mention a kept or park bird.
    expect(c.notes).not.toMatch(/\b(domestic|farm|captive|tame|feral|escaped|park|zoo|bread|collection)\b/i);
  });
});

describe('public/audio/wood-duck native range', () => {
  const m = JSON.parse(readFileSync(join(root, 'public/audio/wood-duck/manifest.json'), 'utf8'));
  // Recordings from Europe are of escaped or feral birds (their pages say so): only North American
  // recordings are used (the countries below are the ones checked; add others only with a source).
  it.each(m.clips.map((c) => [c.file, c]))('%s was recorded in the native range', (_f, c) => {
    expect(c.wildBird).toMatch(/^native range \((United States|Canada)\)/);
  });
});

describe('public/audio/eastern-screech-owl not a playback response', () => {
  const m = JSON.parse(readFileSync(join(root, 'public/audio/eastern-screech-owl/manifest.json'), 'utf8'));
  // Screech-owls are often recorded answering playback or a whistled imitation, even on pages
  // that say "Playback used: no". The notes quote each page's remarks: none may describe that.
  it.each(m.clips.map((c) => [c.file, c]))('%s page describes no response to playback or imitation', (_f, c) => {
    expect(c.notes).toMatch(/Playback used: no\./);
    expect(c.notes).not.toMatch(/\b(imitation|imitated|respon(d|ded|se|ding)|elicited|coerced|whistled)\b/i);
  });
});
