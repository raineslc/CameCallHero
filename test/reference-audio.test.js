// Checks the reference-audio manifests: every WAV is listed, every entry has an
// allowed license and proof URL, files are mono 44.1 kHz 16-bit, total size < 15 MB.
// Plain JS (not TS): the project has no @types/node and this test needs node:fs.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Allowed: CC0, CC BY, CC BY-SA, US-government public domain. Never NC or ND.
const ALLOWED = [
  { name: /^CC0 1\.0$/, url: /^https:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/$/ },
  { name: /^CC BY [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by\/[0-9.]+\/$/ },
  { name: /^CC BY-SA [0-9.]+$/, url: /^https:\/\/creativecommons\.org\/licenses\/by-sa\/[0-9.]+\/$/ },
  { name: /^Public domain \(US government work\)$/, url: /^https?:\/\/.+/ },
];

const sets = [
  { dir: 'public/audio/turkey', needsCall: true },
  { dir: 'test/fixtures/junk', needsCall: false },
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

for (const { dir, needsCall } of sets) {
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
      expect(`${c.license} ${c.licenseUrl}`).not.toMatch(/\bnc\b|\bnd\b|-nc|-nd|noncommercial|noderiv/i);
      expect(c.author).toBeTruthy();
      expect(c.sourceUrl).toBeTruthy();
      expect(c.notes).toBeTruthy();
      if (needsCall) {
        expect(manifest.calls).toContain(c.call);
        expect(c.file).toMatch(new RegExp(`^${c.call}-\\d+\\.wav$`));
        expect(c.sourceUrl).toMatch(/^https:\/\//);
        expect(c.trimStartSec).toBeGreaterThanOrEqual(0);
        expect(c.trimEndSec).toBeGreaterThan(c.trimStartSec);
      }
    });

    it.each(wavs)('%s is mono 44.1 kHz 16-bit PCM', (f) => {
      expect(wavFormat(join(abs, f))).toEqual({
        riff: 'RIFFWAVE',
        format: 1,
        channels: 1,
        sampleRate: 44100,
        bits: 16,
      });
    });
  });
}

it('total reference audio is under 15 MB', () => {
  const dir = join(root, 'public/audio/turkey');
  const total = readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
  expect(total).toBeLessThan(15 * 1024 * 1024);
});
