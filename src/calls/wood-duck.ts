// The wood duck calls from Phase 14. Reference files live in public/audio/wood-duck/ (licenses in
// manifest.json and ATTRIBUTION.md; call definitions with sources in the manifest's
// callDefinitions). Only calls that pass test/calibration-wood-duck.test.ts and the calling
// challenge's rules (test/challenge.test.ts) are unlocked.

import type { Band } from '../audio/features';
import { type CallDef, type Source } from './call';

/**
 * Analysis band for wood duck calls: mel bands and dominant-frequency search over 300-10000 Hz.
 * Measured on the references (manifest notes): the hen's flush call has its fundamental at
 * 1.3-1.7 kHz with harmonics to ~7 kHz; the drake's whistle sweeps from ~4.5 kHz up to 6.4-9.0 kHz.
 * Tried on the calibration set (drake whistle worst-case margin; weight sets of 192 reaching 15):
 * 300-10000 Hz 40.7 (46), 500-10000 39.1 (42), 800-10000 38.4 (40), 500-12000 38.0 (40),
 * 500-8000 34.1 (42), 1000-9000 34.7 (28), 2000-9000 27.1 (12), 1000-4000 6.1 (0). The hen flush
 * call stayed between -11.5 and -7.1 in every band (docs/STATUS.md). Chosen as the band with the
 * best drake margin and the most passing weight sets (as for OWL_BAND). Loudness, gates and note
 * segmentation do not use the band.
 */
export const WOOD_DUCK_BAND: Band = { minHz: 300, maxHz: 10000 };

// shortcut: All About Birds and Birds of the World were read only through web-search excerpts
// (this build environment's network blocks allaboutbirds.org and birdsoftheworld.org; see readVia
// in the manifest). Every line below stays within those excerpts; re-read the pages directly
// when next editing them.
const AAB: Source = {
  title: 'All About Birds (Cornell Lab of Ornithology), Wood Duck Sounds',
  url: 'https://www.allaboutbirds.org/guide/Wood_Duck/sounds',
};
const BOW: Source = {
  title: 'Birds of the World (Cornell Lab of Ornithology), Wood Duck, Sounds and Vocal Behavior',
  url: 'https://birdsoftheworld.org/bow/species/wooduc/cur/sounds',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/wood-duck/${call}-${i + 1}.wav`);

export const WOOD_DUCK_CALLS: CallDef[] = [
  {
    id: 'hen-flush',
    name: 'Hen flush call',
    locked: true,
    // 9 clips (hen-flush-1..9.wav) from 7 recordings by 5 recordists; no weights or band separated
    // them from the other sounds by the calibration margin (best -9.0; docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 9 recordings of this call, but the scorer cannot yet tell it apart from other duck calls, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the grid search with WOOD_DUCK_BAND (worst-case margin -9.0, below 15); not used while locked.
    weights: { rhythm: 0.5, pitch: 2, tone: 3, structure: 1 },
    // AAB: the female gives a loud "oo-eek, oo-eek" when disturbed and taking flight. BOW: the
    // female's loud call is also used to find the mate after separation and to keep contact in flight.
    description: {
      meaning: 'The hen’s loud, rising "oo-eek", repeated.',
      when: 'When a hen is disturbed and takes flight. Hens also use it to find their mate after they are separated and to keep in touch in flight.',
    },
    sources: [AAB, BOW],
  },
  {
    id: 'drake-whistle',
    name: 'Drake whistle',
    locked: false,
    // 4 clips (drake-whistle-1..4.wav) from 2 recordings (Massachusetts 2012, California 2018),
    // both by one recordist: no other usable recording was found (docs/STATUS.md).
    references: refs('drake-whistle', 4),
    // Grid search over rhythm/pitch/tone 0.5..3 and structure 0..2 with WOOD_DUCK_BAND: best
    // worst-case margin (test/calibration-wood-duck.test.ts, docs/STATUS.md). Tone (the high,
    // thin sweep) carries it.
    // shortcut: 2 clips per bird flatter the leave-one-out margin (each clip's sibling from the
    // same bird stays in the references); re-tune with other drakes' recordings and real takes.
    weights: { rhythm: 0.5, pitch: 0.5, tone: 3 },
    // AAB: the male has a thin, rising and falling, zeeting whistle. The excerpts did not say when
    // drakes give it, so the app says so instead of guessing.
    description: {
      meaning: 'The drake’s thin whistle that rises and then falls in pitch.',
      when: 'The sources used here do not say when drakes give this whistle.',
    },
    sources: [AAB],
  },
];
