// The great horned owl calls from Phase 13. Reference files live in public/audio/great-horned-owl/
// (licenses in manifest.json and ATTRIBUTION.md; call definition with sources in the manifest's
// callDefinitions). Only calls that pass test/calibration-great-horned-owl.test.ts are unlocked.

import { type CallDef, type Source } from './call';

// shortcut: both sources were read only through web-search excerpts (this build environment's
// network blocks both hosts; see readVia in the manifest). Every line below stays within those
// excerpts; re-read both pages directly when next editing this text.
const BOW: Source = {
  title: 'Birds of the World (Cornell Lab of Ornithology), Great Horned Owl, Sounds and Vocal Behavior',
  url: 'https://birdsoftheworld.org/bow/species/grhowl/cur/sounds',
};
const AAB: Source = {
  title: 'All About Birds (Cornell Lab of Ornithology), Great Horned Owl, Sounds',
  url: 'https://www.allaboutbirds.org/guide/Great_Horned_Owl/sounds',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/great-horned-owl/${call}-${i + 1}.wav`);

export const GREAT_HORNED_OWL_CALLS: CallDef[] = [
  {
    id: 'territorial-hoot',
    name: 'Territorial hoot',
    locked: false,
    // 12 clips: 7 male (territorial-hoot-1..7) and 5 female (-8..12) by the recordists' sex
    // labels (manifest "sex"), from 10 recordings by 3 recordists. Male and female were first
    // calibrated as two calls: no weights or band separated them (best margins 0.2 and -3.6).
    references: refs('territorial-hoot', 12),
    // Grid search over rhythm/pitch/tone 0.5..3 and structure 0..3 (step 0.5) with OWL_BAND:
    // best worst-case margin 17.8 (test/calibration-great-horned-owl.test.ts, docs/STATUS.md).
    // shortcut: 33 of 1512 weight sets reach 15, fitted to 12 clips from 10 recordings; re-tune
    // with more clips and real takes (a person hooting, a hunter's owl call).
    weights: { rhythm: 3, pitch: 0.5, tone: 0.5, structure: 2.5 },
    // AAB: deep, soft hoots with a stuttering rhythm; the female's voice is recognizably higher
    // in pitch than the male's. BOW: female higher because of the smaller syrinx in the larger
    // sex; most territorial defense by the male, the female frequently assists in hooting
    // contests with neighbors or intruders, even during incubation.
    description: {
      meaning: 'Deep, soft hoots with a stuttering rhythm. Both sexes give it; the female sounds higher than the male.',
      when: 'To hold a territory. Mostly the male; the female often joins hooting contests with neighbours or intruders.',
    },
    sources: [AAB, BOW],
  },
];
