// Fake-mic input files for the practice e2e test. Chromium's fake mic loops a WAV from the
// moment the mic opens, so each file is: background noise for the 3 s count-in (at the clip's
// own noise floor), then the clip, then more background, long enough that the loop does not
// restart inside the take. Built from the repo's clips at test time; nothing is committed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractFeatures } from '../src/audio/features';
import { encodeWav } from '../src/audio/wav';
import { readWav } from '../test/wav';

/** Background before the clip. The clip's own first note starts ~0.5 s in, so the call lands
 *  ~0.5–1 s after the count-in ends, inside the take even if the app drops the first few
 *  hundred ms the fake device plays before the AudioWorklet is connected. */
const LEAD_SEC = 3.2;
const TAIL_SEC = 4;

const root = new URL('..', import.meta.url);
const outDir = new URL('e2e/.fake-mic/', root);

export function paddedClip(source: string, name: string): string {
  const clip = readWav(new URL(source, root));
  const sr = clip.sampleRate;
  const rms = 10 ** (extractFeatures(clip).noiseFloorDb / 20);
  const amp = rms * Math.sqrt(3); // uniform noise in [-a, a] has RMS a / sqrt(3)
  let seed = 1;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return amp * (2 * (seed / 0x7fffffff) - 1);
  };
  const lead = Math.round(LEAD_SEC * sr);
  const out = new Float32Array(lead + clip.samples.length + Math.round(TAIL_SEC * sr));
  for (let i = 0; i < out.length; i++) out[i] = i >= lead && i < lead + clip.samples.length ? clip.samples[i - lead] : noise();
  mkdirSync(outDir, { recursive: true });
  const file = new URL(name, outDir);
  writeFileSync(file, encodeWav(out, sr));
  return fileURLToPath(file);
}

/**
 * A calling sequence: background for the count-in, then each clip with `pauseSec` of
 * background between them, then background up to `totalSec` (so the loop does not restart
 * inside a 20 s challenge take). Background is at the first clip's noise floor.
 */
export function sequenceClip(sources: string[], name: string, pauseSec = 1, totalSec = 28): string {
  const clips = sources.map((s) => readWav(new URL(s, root)));
  const sr = clips[0].sampleRate;
  if (clips.some((c) => c.sampleRate !== sr)) throw new Error('clips differ in sample rate');
  const amp = 10 ** (extractFeatures(clips[0]).noiseFloorDb / 20) * Math.sqrt(3);
  let seed = 1;
  const out = Float32Array.from({ length: Math.round(totalSec * sr) }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return amp * (2 * (seed / 0x7fffffff) - 1);
  });
  let at = Math.round(LEAD_SEC * sr);
  for (const c of clips) {
    out.set(c.samples, at);
    at += c.samples.length + Math.round(pauseSec * sr);
  }
  if (at > out.length) throw new Error('sequence longer than totalSec');
  mkdirSync(outDir, { recursive: true });
  const file = new URL(name, outDir);
  writeFileSync(file, encodeWav(out, sr));
  return fileURLToPath(file);
}

/** Steady uniform noise at `rmsDb` dBFS, `seconds` long (a mic in a noisy place). */
export function noiseClip(name: string, rmsDb: number, seconds = 12, sr = 48000): string {
  const amp = 10 ** (rmsDb / 20) * Math.sqrt(3);
  let seed = 7;
  const out = Float32Array.from({ length: Math.round(seconds * sr) }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return amp * (2 * (seed / 0x7fffffff) - 1);
  });
  mkdirSync(outDir, { recursive: true });
  const file = new URL(name, outDir);
  writeFileSync(file, encodeWav(out, sr));
  return fileURLToPath(file);
}

export const fakeMicArgs = (wavPath: string) => [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${wavPath}`,
];
