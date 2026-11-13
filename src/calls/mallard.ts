// The mallard calls from Phase 11. Reference files live in public/audio/mallard/ (licenses in
// manifest.json and ATTRIBUTION.md; call definitions with sources in the manifest's
// callDefinitions). Only calls that pass test/calibration-mallard.test.ts (and the
// calling challenge's rules in test/challenge.test.ts) are unlocked; none does yet (Phase 11).

import type { Band } from '../audio/features';
import { type CallDef, type Source } from './call';

/**
 * Analysis band for mallard calls: mel bands and dominant-frequency search over 1000-4000 Hz.
 * Measured dominant frequencies of the references are 1.4-2.6 kHz (manifest notes), and Birds of
 * the World gives 1.0-4.0 kHz for the drake's slow raehb. Tried on the calibration set (best
 * practice-calibration margin of the hen quack; weight sets of 864 reaching 15): 150-8000 Hz 37.5 (115),
 * 300-6000 37.9 (107), 500-5000 37.0 (99), 1000-4000 39.4 (145); also 150-4000, 300-4000 and
 * 200-3000 before quack-5 was replaced (it failed the noise gate). Chosen as the band where most weight sets pass
 * (as for OWL_BAND). No band brought the hail call or the drake raeb near 15. Numbers in
 * docs/STATUS.md. Loudness, gates and note segmentation do not use the band.
 */
export const MALLARD_BAND: Band = { minHz: 1000, maxHz: 4000 };

// shortcut: Birds of the World and the Ducks Unlimited pages were read only through web-search
// excerpts (this build environment's network blocks birdsoftheworld.org and ducks.org; see readVia
// in the manifest). Every line below stays within those excerpts; re-read the pages directly
// when next editing them.
const BOW: Source = {
  title: 'Birds of the World (Cornell Lab of Ornithology), Mallard, Sounds and Vocal Behavior',
  url: 'https://birdsoftheworld.org/bow/species/mallar3/cur/sounds',
};
const DU_SCIENCE: Source = {
  title: 'Ducks Unlimited, Understanding Waterfowl: Science and Duck Calling',
  url: 'https://www.ducks.org/conservation/waterfowl-research-science/understanding-waterfowl-science-and-duck-calling',
};
const DU_VOCALIZATIONS: Source = {
  title: 'Ducks Unlimited, Waterfowl Vocalizations',
  url: 'https://www.ducks.org/conservation/waterfowl-research-science/waterfowl-vocalizations',
};
const DU_8_CALLS: Source = {
  title: 'Ducks Unlimited, 8 Duck Calls Every Duck Hunter Must Master',
  url: 'https://www.ducks.org/hunting/duck-calling/8-duck-calls-every-duck-hunter-must-master',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/mallard/${call}-${i + 1}.wav`);

export const MALLARD_CALLS: CallDef[] = [
  {
    id: 'quack',
    name: 'Hen quack',
    locked: true,
    // 6 clips (quack-1..6.wav) from 5 recordings by 5 recordists. They pass the practice
    // calibration (worst-case margin 39.4, matrix 53.5), but the scorer cannot tell one hen quack
    // from one note of a drake's raeb: split as the calling challenge splits a take, single drake
    // notes score up to 95 as a quack, above every quack's leave-one-out score (lowest 83.4).
    // No band or weights fixed that (best margin -4.3 over 4 bands x 342 weight sets;
    // docs/STATUS.md). Unlocking it for practice only is an owner decision (docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 6 recordings of this call, but the scorer cannot yet tell a hen\u2019s quack from one note of a drake\u2019s call, so it cannot be practiced yet.',
    },
    references: [],
    // Grid search over rhythm/pitch/tone 0.5..3 (step 0.5) and structure 0..3 with MALLARD_BAND:
    // best practice-calibration margin 39.4 (145 of 864 weight sets reach 15). Rhythm (one note of
    // quack length) carries most of it, which is also why single drake notes score as high.
    // Not used while locked.
    weights: { rhythm: 3, pitch: 0.5, tone: 0.5 },
    // DU 8 Duck Calls: the basic quack, the first call hunters should learn. BOW: the quack is the
    // female's call; the male's rab is quieter than female quacks. The excerpts did not say when
    // hens give a single quack, so the app says so instead of guessing.
    description: {
      meaning: 'One quack. Quacking is the hen\u2019s call; the drake\u2019s call is a quieter, rasping "rab". Hunters learn this basic quack first.',
      when: 'The sources used here do not say when hens give a single quack.',
    },
    sources: [DU_8_CALLS, BOW],
  },
  {
    id: 'hail-call',
    name: 'Hail call',
    locked: true,
    // 9 clips (hail-call-1..9.wav, -9 uncertain) from 8 recordings; no weights or band separated
    // them from the other calls by the calibration margin (best 1.3; docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 9 recordings of this call, but the scorer cannot yet tell it apart from other calls and sounds, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the grid search with MALLARD_BAND (worst-case margin 1.3, below 15); not used while locked.
    weights: { rhythm: 0.5, pitch: 2, tone: 0.5, structure: 1 },
    // BOW: the female's Decrescendo Call or "hail call", her most common call, 2-10 notes; contagious
    // among females; elicited by the mate's slow raehb and the sight of mallards in the air.
    // DU (Understanding Waterfowl): typically 5-6 notes, one or two loud quacks then shorter, softer
    // ones; Hochbaum named it the hail call because hens appear to greet ducks flying overhead.
    description: {
      meaning: 'The hen’s decrescendo: usually five or six quacks, one or two loud ones, then shorter, softer ones.',
      when: 'Hens appear to use it to greet ducks flying overhead. One calling hen usually sets others off; the drake’s slow raeb and the sight of flying mallards also start it.',
    },
    sources: [BOW, DU_SCIENCE],
  },
  {
    id: 'drake-raeb',
    name: 'Drake raeb',
    locked: true,
    // 8 clips (drake-raeb-1..8.wav, -8 uncertain) from 6 recordings; far below the margin (best -3.8).
    lock: {
      label: 'Coming soon',
      reason: 'We have 8 recordings of this call, but the scorer cannot yet tell it apart from other duck calls, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the grid search with MALLARD_BAND (worst-case margin -3.8, below 15); not used while locked.
    weights: { rhythm: 1, pitch: 3, tone: 0.5, structure: 1 },
    // BOW: the male's most common call is a rasping rab, quieter than female quacks; the slow
    // Raehb is one note or a series of evenly spaced notes. DU (Waterfowl Vocalizations): males
    // answer the female's decrescendo with a slow raehb.
    description: {
      meaning: 'The drake’s call: a quiet, rasping "raeb", one note or a few evenly spaced notes.',
      when: 'Drakes answer the hen’s hail call with a slow raeb.',
    },
    sources: [BOW, DU_VOCALIZATIONS],
  },
];
