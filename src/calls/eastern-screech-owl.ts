// The eastern screech-owl calls from Phase 15. Reference files live in public/audio/eastern-screech-owl/
// (licenses in manifest.json and ATTRIBUTION.md; call definitions with sources in the manifest's
// callDefinitions). Only calls that pass test/calibration-eastern-screech-owl.test.ts are unlocked;
// none does yet (Phase 15, docs/STATUS.md).

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

export const EASTERN_SCREECH_OWL_CALLS: CallDef[] = [
  {
    id: 'monotone-trill',
    name: 'Monotone trill',
    locked: true,
    // 10 clips (monotone-trill-1..10.wav) from 8 recordings by 6 recordists. No weights or band
    // separated them from the other owls' calls by the calibration margin (best 10.0; docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 10 recordings of this call, but the scorer cannot yet tell it apart from other owl calls, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the grid search with OWL_BAND (worst-case margin 10.0, below 15); not used while locked.
    // shortcut: the note finder splits some trills into their pulses and keeps others whole, so the
    // rhythm part compares unlike things; a trill-rate feature is the next thing to try.
    weights: { rhythm: 1.5, pitch: 0.5, tone: 0.5, structure: 0 },
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
    locked: true,
    // 10 clips (whinny-1..10.wav, -3 uncertain) from 6 recordings by 4 recordists. No weights or
    // band separated them from turkey gobbles by the calibration margin (best -0.4; docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 10 recordings of this call, but the scorer cannot yet tell it apart from other calls and sounds, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the grid search with OWL_BAND (worst-case margin -9.1, below 15); not used while locked.
    weights: { rhythm: 0.5, pitch: 1, tone: 3, structure: 2 },
    // AAB: a shrill, descending whinny. BOW: the first part rises slightly in pitch, the latter
    // part falls gradually; in territorial adults it is given particularly to dispersing young.
    description: {
      meaning: 'A shrill whinny that rises slightly, then falls in pitch.',
      when: 'To defend a territory, especially when young owls disperse.',
    },
    sources: [AAB, BOW, MDC],
  },
];
