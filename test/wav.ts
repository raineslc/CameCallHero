// WAV helpers for tests; the parser itself lives in src/audio/wav.ts (the app reads references with it).
import { readFileSync } from 'node:fs';
import type { AudioClip } from '../src/audio/features';
import { parseWav } from '../src/audio/wav';

export { parseWav };
export const readWav = (path: string | URL): AudioClip => parseWav(readFileSync(path));
