// The five wild turkey calls. Reference files live in public/audio/turkey/
// (licenses in manifest.json and ATTRIBUTION.md). A call with no references is
// locked: the app shows it but cannot score it.

import type { Weights } from '../audio/score';

export type TurkeyCallId = 'yelp' | 'cut' | 'purr' | 'gobble' | 'kee-kee-run';

export interface CallDef {
  id: TurkeyCallId;
  name: string;
  /** True while there are no reference recordings to score against. */
  locked: boolean;
  /** Paths relative to public/ (and to the site base URL). */
  references: string[];
  weights: Weights;
  /** Filled in Phase 4 (library screen), from cited sources. */
  description: { meaning: string; when: string };
}

/** shortcut: uncalibrated equal weights for calls without references; tune each once it has 3+ clips. */
const UNCALIBRATED: Weights = { rhythm: 1, pitch: 1, tone: 1 };

const refs = (call: TurkeyCallId, count: number) =>
  Array.from({ length: count }, (_, i) => `audio/turkey/${call}-${i + 1}.wav`);

const empty = { meaning: '', when: '' };

export const TURKEY_CALLS: CallDef[] = [
  { id: 'yelp', name: 'Yelp', locked: true, references: [], weights: UNCALIBRATED, description: empty },
  { id: 'cut', name: 'Cut', locked: true, references: [], weights: UNCALIBRATED, description: empty },
  { id: 'purr', name: 'Purr', locked: true, references: [], weights: UNCALIBRATED, description: empty },
  {
    id: 'gobble',
    name: 'Gobble',
    locked: false,
    references: refs('gobble', 6),
    // From test/calibration.test.ts: the dominant-frequency track does not separate gobbles
    // from putts or the tone sweep (gobble is a burst of broadband pulses), tone does.
    // Equal weights passed with min margin 18.1; these give 28.1 (numbers in docs/STATUS.md).
    weights: { rhythm: 1, pitch: 0.5, tone: 1.5 },
    description: empty,
  },
  { id: 'kee-kee-run', name: 'Kee kee run', locked: true, references: [], weights: UNCALIBRATED, description: empty },
];

export const callById = (id: TurkeyCallId): CallDef => {
  const c = TURKEY_CALLS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown call ${id}`);
  return c;
};
