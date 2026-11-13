// The barred owl calls from Phase 7. Reference files live in public/audio/barred-owl/
// (licenses in manifest.json and ATTRIBUTION.md; call definitions with sources in the
// manifest's callDefinitions). Only calls that pass test/calibration-owl.test.ts are unlocked.

import type { Band } from '../audio/features';
import { type CallDef, type Source } from './call';

/**
 * Analysis band for owl calls: mel bands and dominant-frequency search over 200-1500 Hz
 * instead of the turkey's 150-8000 Hz. Measured owl hoots sit at ~0.35-0.75 kHz and the
 * caterwaul's high notes at ~1.0-1.4 kHz (manifest notes); above that the clips hold other
 * birds (thrushes, chickadees). Loudness, gates and note segmentation do not use the band.
 * Tried on the calibration set: 150-8000, 150-2000, 200-1500 and 250-3000 Hz; 200-1500 Hz
 * gave the inspection call the largest margin (18.3; 15.3 at 150-8000 Hz). No band separated
 * the two hoot series (best margins 4-7). Numbers in docs/STATUS.md.
 */
export const OWL_BAND: Band = { minHz: 200, maxHz: 1500 };

// shortcut: both sources were read only through web-search excerpts (this build environment's
// network blocks both hosts; see readVia in the manifest). Every line below stays within those
// excerpts; re-read the paper and the Birds of the World page directly when next editing them.
const ODOM_MENNILL: Source = {
  title: 'Odom & Mennill (2010), A quantitative description of the vocalizations and vocal activity of the Barred Owl, The Condor 112: 549-560',
  url: 'https://doi.org/10.1525/cond.2010.090163',
};
const BOW: Source = {
  title: 'Birds of the World (Cornell Lab of Ornithology), Barred Owl, Sounds and Vocal Behavior',
  url: 'https://birdsoftheworld.org/bow/species/brdowl/cur/sounds',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/barred-owl/${call}-${i + 1}.wav`);

export const OWL_CALLS: CallDef[] = [
  {
    id: 'two-phrase-hoot',
    name: 'Who cooks for you',
    locked: true,
    // 7 clips (public/audio/barred-owl/two-phrase-hoot-1..7.wav) from 4 recordings; no weights
    // separated them from the ascending hoot by the calibration margin (docs/STATUS.md).
    lock: {
      label: 'Coming soon',
      reason: 'We have 7 recordings of this call, but the scorer cannot yet tell it apart from the ascending hoot, so it cannot be practiced yet.',
    },
    references: [],
    // Best of the same grid search as the hoo-wah (worst-case margin 4.1, below 15); not used while locked.
    weights: { rhythm: 2, pitch: 0.5, tone: 2.5 },
    // Odom & Mennill: two sets of four syncopated notes, three short and one long; given often
    // in spontaneous calling bouts and when confronting other Barred Owls. BOW: the familiar
    // "Who cooks for you? Who cooks for you-all?".
    description: {
      meaning: 'Two sets of four notes, three short and one long: "Who cooks for you? Who cooks for you-all?"',
      when: 'Often in spontaneous calling bouts, and when an owl confronts other barred owls.',
    },
    sources: [ODOM_MENNILL, BOW],
  },
  {
    id: 'ascending-hoot',
    name: 'Ascending hoot',
    locked: true,
    // 6 clips (ascending-hoot-1..6.wav, label of -5 uncertain) from 4 recordings; no weights
    // separated them from the two-phrase hoot by the calibration margin.
    lock: {
      label: 'Coming soon',
      reason: 'We have 6 recordings of this call, but the scorer cannot yet tell it apart from "Who cooks for you", so it cannot be practiced yet.',
    },
    references: [],
    // Best of the same grid search as the hoo-wah (worst-case margin 4.0, below 15); not used while locked.
    weights: { rhythm: 2.5, pitch: 2, tone: 2.5 },
    // BOW: 6-9 regularly spaced, evenly accentuated, ascending syllables, followed by a
    // downwardly inflected "hoo-aw". Odom & Mennill name it as its own call type. Neither
    // excerpt said when owls use it, so the app says so instead of guessing.
    description: {
      meaning: 'Six to nine evenly spaced notes that rise, then a "hoo-aw" that falls.',
      when: 'The sources used here do not say when owls give this call.',
    },
    sources: [BOW, ODOM_MENNILL],
  },
  {
    id: 'inspection-call',
    name: 'Hoo-wah',
    locked: false,
    references: refs('inspection-call', 3),
    // Grid search over rhythm/pitch/tone in 0.5..3 (each >= 0.5 so no part is ignored) with
    // OWL_BAND: best worst-case margin 18.3 (test/calibration-owl.test.ts, docs/STATUS.md).
    // shortcut: fitted to 3 clips from 3 recordists; re-tune with more clips and real takes.
    weights: { rhythm: 1, pitch: 2.5, tone: 1.5 },
    // BOW: a single-syllable call that rises and then falls in pitch, "hooooahh", also known
    // as the hoo-wah; given by both sexes; considered a contact call; among the most frequent
    // Barred Owl calls, given throughout the night. Odom & Mennill call it the inspection call.
    description: {
      meaning: 'One note that rises and then falls: "hooooahh". Also called the inspection call.',
      when: 'Made by both sexes and thought to be a contact call. One of the most frequent barred owl calls, given throughout the night.',
    },
    sources: [BOW, ODOM_MENNILL],
  },
  {
    id: 'caterwaul',
    name: 'Caterwaul',
    locked: true,
    // 3 clips (caterwaul-1..3.wav), all marked uncertain; a duet of two birds. Far below the
    // calibration margin, and caterwaul-2 fails the scorer's noise gate.
    lock: {
      label: 'Not practicable',
      reason: 'A duet of two owls: one person cannot make both parts, and the scorer cannot tell our 3 recordings apart from the other calls.',
    },
    references: [],
    // Best of the same grid search as the hoo-wah (worst-case margin -39.2, below 15); not used while locked.
    weights: { rhythm: 0.5, pitch: 0.5, tone: 3 },
    // Odom & Mennill (citing Mazur & James 2000): caterwaul bouts, a male and female calling
    // in alternation. BOW: monkey-like cackles, screams, wails and caterwauling duets.
    description: {
      meaning: 'A male and a female calling in alternation, with cackles, screams and wails.',
      when: 'Duets between the two owls of a pair.',
    },
    sources: [ODOM_MENNILL, BOW],
  },
];
