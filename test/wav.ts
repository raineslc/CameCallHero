// Tiny WAV reader for tests: 16-bit PCM, any channel count (mixed to mono).
import { readFileSync } from 'node:fs';
import type { AudioClip } from '../src/audio/features';

export function parseWav(bytes: Uint8Array): AudioClip {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  for (let o = 12; o + 8 <= bytes.length; ) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') {
      if (v.getUint16(body, true) !== 1) throw new Error('only PCM WAV is supported');
      channels = v.getUint16(body + 2, true);
      sampleRate = v.getUint32(body + 4, true);
      bits = v.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (bits !== 16 || channels < 1) throw new Error('only 16-bit PCM WAV is supported');
      const frames = Math.floor(Math.min(size, bytes.length - body) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += v.getInt16(body + 2 * (i * channels + c), true);
        samples[i] = sum / channels / 32768;
      }
      return { samples, sampleRate };
    }
    o = body + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}

export const readWav = (path: string | URL): AudioClip => parseWav(readFileSync(path));
