// The elk (Cervus canadensis) calls from Phase 12. Reference files live in public/audio/elk/
// (all from National Park Service sound libraries, public domain; licenses in manifest.json and
// ATTRIBUTION.md; call definitions with sources in the manifest's callDefinitions). Only calls
// that pass test/calibration-elk.test.ts are unlocked.

import type { Band } from '../audio/features';
import { type CallDef, type Source, UNCALIBRATED } from './call';

/**
 * Analysis band for elk calls: mel bands and dominant-frequency search over 300-6000 Hz.
 * Measured on the references (manifest notes): the lowest elk sounds are the glug pulses and the
 * bugles' low onsets at ~0.45-0.6 kHz; bugle whistles reach ~2.0-2.8 kHz and the mews ~3.1 kHz,
 * with harmonics to ~5.5 kHz. Tried on the calibration set: 150-8000, 300-6000, 400-5000,
 * 250-4000 and 500-3000 Hz. The calf call passed in all (margins 26.2-28.5); 300-6000 Hz is kept
 * because it holds the measured range including the first harmonics of whistles and mews
 * (250-4000 Hz gave 27.8 but cuts them). No band let the bugle, glug or mew pass. Numbers in
 * docs/STATUS.md.
 */
export const ELK_BAND: Band = { minHz: 300, maxHz: 6000 };

const ELK_BOOK: Source = {
  title: 'White, Stahler, Smith, MacNulty & Garrott, Northern Yellowstone Elk (National Park Service), p. 16',
  url: 'https://www.nps.gov/yell/learn/nature/upload/ELK-BOOK-FOR-WEB_accessible.pdf',
};
const NPS_ROMO_ELK: Source = {
  title: 'National Park Service, Rocky Mountain National Park: Elk',
  url: 'https://www.nps.gov/romo/learn/nature/elk.htm',
};
const NPS_YELL_ELK: Source = {
  title: 'National Park Service, Yellowstone National Park: Elk',
  url: 'https://www.nps.gov/yell/learn/nature/elk.htm',
};
const NPS_ROMO_SOUNDS: Source = {
  title: 'National Park Service, Rocky Mountain National Park: Wildlife Sounds and Soundscapes',
  url: 'https://www.nps.gov/romo/learn/photosmultimedia/sounds-wildlife-soundscapes.htm',
};
const NPS_YELL_SOUNDS: Source = {
  title: 'National Park Service, Yellowstone National Park: Sound Library - Elk',
  url: 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-elk.htm',
};

const refs = (call: string, count: number) => Array.from({ length: count }, (_, i) => `audio/elk/${call}-${i + 1}.wav`);

export const ELK_CALLS: CallDef[] = [
  {
    id: 'bugle',
    name: 'Bugle',
    locked: true,
    // 7 clips (bugle-1..7.wav) from 4 recordings (3 recordists, 2 parks). Bugles of different
    // bulls differ a lot (clip-to-clip scores 28-72 with equal weights); no band or weights reached the margin.
    lock: {
      label: 'Coming soon',
      reason: 'We have 7 recordings of this call, but bugles differ so much from bull to bull that the scorer cannot yet tell them apart from other calls.',
    },
    references: [],
    // Best of the grid search (rhythm/pitch/tone 0.5..3, structure 0..3) with ELK_BAND:
    // worst-case margin -12.0, below 15; not used while locked.
    weights: { rhythm: 1.5, pitch: 1.5, tone: 3 },
    // Elk book (citing Feighny et al. 2006): a gradual rise in frequency and volume to an extended
    // squeal or whistle that ends abruptly, often followed by grunts or yelps; mature bulls bugle to
    // attract mates and warn other bulls (citing Bowyer & Kitchen 1987). NPS Yellowstone: rut from
    // early September to mid-October. NPS Rocky Mountain: cows and younger bulls may also bugle,
    // but cannot match older bulls' strength or range.
    description: {
      meaning: 'A tone that rises to a long, high squeal or whistle, ends abruptly, and is often followed by grunts.',
      when: 'Mature bulls in the rut (early September to mid-October), to attract cows and warn other bulls off their harem. Cows and younger bulls may bugle too, more weakly.',
    },
    sources: [ELK_BOOK, NPS_YELL_ELK, NPS_ROMO_ELK],
  },
  {
    id: 'glug',
    name: 'Glug',
    locked: true,
    // 3 clips (glug-1..3.wav), windows of one recording's pulse series, under background bugles.
    lock: {
      label: 'Coming soon',
      reason: 'We have 3 recordings of this call, all from one bull with other elk bugling behind it, and the scorer cannot tell them apart from other calls yet.',
    },
    references: [],
    // Best of the same grid search (with structure 0.5): worst-case margin 3.3; not used while locked.
    weights: { rhythm: 2.5, pitch: 1, tone: 0.5, structure: 0.5 },
    // NPS Rocky Mountain sound library: a bull making the "glug" sound as he herds a harem of cows
    // during the rut. Elk book: grunts are among male vocalizations (citing Geist 2002).
    description: {
      meaning: 'Short, low "glug" sounds made by a bull.',
      when: 'While a bull herds his harem of cows during the rut.',
    },
    sources: [NPS_ROMO_SOUNDS, ELK_BOOK],
  },
  {
    id: 'cow-mew',
    name: 'Cow mew',
    locked: true,
    // 4 clips (cow-mew-1..4.wav), classified by elimination, all below the scorer's noise gate.
    lock: {
      label: 'Recordings needed',
      reason: 'Our 4 recordings of this call are too faint above the background for the scorer, so it cannot be practiced yet.',
    },
    references: [],
    // shortcut: no clip passes the take gates, so there was nothing to calibrate; retune with clearer clips.
    weights: UNCALIBRATED,
    // Elk book (citing Geist 2002): chirps, mews and whines are female vocalizations. Neither
    // source read says when cows mew, so the app says so instead of guessing.
    description: {
      meaning: 'One of the calls of cow (female) elk, along with chirps and whines.',
      when: 'The sources used here do not say when cows give this call.',
    },
    sources: [ELK_BOOK, NPS_ROMO_SOUNDS],
  },
  {
    id: 'calf-call',
    name: 'Calf call',
    locked: false,
    references: refs('calf-call', 3),
    // Grid search over rhythm/pitch/tone 0.5..3 (structure 0..3) with ELK_BAND: best worst-case
    // margin 26.2 (test/calibration-elk.test.ts, docs/STATUS.md).
    // shortcut: all 3 clips are one calf in one recording, which flatters the leave-one-out margin;
    // re-tune with recordings of other calves and real takes.
    weights: { rhythm: 3, pitch: 0.5, tone: 2.5 },
    // NPS Yellowstone sound library: "An elk calf calls out." No source read says when calves call.
    description: {
      meaning: 'The call of an elk calf.',
      when: 'The sources used here do not say when calves give this call.',
    },
    sources: [NPS_YELL_SOUNDS],
  },
];
