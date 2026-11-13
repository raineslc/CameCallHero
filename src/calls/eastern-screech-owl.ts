// The eastern screech-owl calls from Phase 15. Reference files live in public/audio/eastern-screech-owl/
// (licenses in manifest.json and ATTRIBUTION.md; call definitions with sources in the manifest's
// callDefinitions). Only calls that pass test/calibration-eastern-screech-owl.test.ts are unlocked.

import { type CallDef, type Source } from './call';

// shortcut: all sources were read only through web-search excerpts (this build environment's
// network blocks every host below; see readVia in the manifest). Every line below stays within
// those excerpts; re-read the pages directly when next editing this text.
const AAB: Source = {
  title: 'All About Birds (Cornell Lab of Ornithology), Eastern Screech-Owl, Sounds',
  url: 'https://www.allaboutbirds.org/guide/Eastern_Screech-Owl/sounds',
};
const BOW: Source = {
  title: 'Birds of the World (Cornell Lab of Ornithology), Eastern Screech-Owl, Sounds and Vocal Behavior',
  url: 'https://birdsoftheworld.org/bow/species/easowl1/cur/sounds',
};
const MDC: Source = {
  title: 'Missouri Department of Conservation, Field Guide: Eastern Screech-Owl',
  url: 'https://mdc.mo.gov/discover-nature/field-guide/eastern-screech-owl',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/eastern-screech-owl/${call}-${i + 1}.wav`);

export const EASTERN_SCREECH_OWL_CALLS: CallDef[] = [
  {
    id: 'monotone-trill',
    name: 'Monotone trill',
    locked: false,
    // 10 clips from 8 recordings by 7 recordists (manifest notes).
    references: refs('monotone-trill', 10),
    // WEIGHTS-TRILL
    weights: { rhythm: 1, pitch: 1, tone: 1, structure: 0 },
    // AAB: an even-pitched trill, often called a "bounce song" or tremolo; used by pairs or
    // families to keep in touch, 3-6 seconds long. MDC: trilling, an even-pitched sound.
    description: {
      meaning: 'An even-pitched trill on one note, often called the "bounce song" or tremolo. Among the most common screech-owl sounds.',
      when: 'Pairs and families use it to keep in touch.',
    },
    sources: [AAB, BOW, MDC],
  },
  {
    id: 'whinny',
    name: 'Descending whinny',
    locked: false,
    // 9 clips from 7 recordings by 5 recordists (manifest notes; whinny-2 marked uncertain).
    references: refs('whinny', 9),
    // WEIGHTS-WHINNY
    weights: { rhythm: 1, pitch: 1, tone: 1, structure: 0 },
    // AAB: a shrill, descending whinny. BOW: the first part rises slightly in pitch, the latter
    // part falls gradually; in territorial adults it is given particularly to dispersing young.
    description: {
      meaning: 'A shrill whinny that rises slightly, then falls in pitch.',
      when: 'To defend a territory, especially when young owls disperse.',
    },
    sources: [AAB, BOW, MDC],
  },
];
