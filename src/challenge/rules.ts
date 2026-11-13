// Per-species data for the calling challenge. Adding a species to the challenge is a data
// change only: an entry here (split gap, recognition threshold per unlocked call, rank titles).
// test/challenge.test.ts recomputes every number from the species' recordings and fails, with
// the measured values, when an entry is missing or a value drifts. A species without an entry,
// or without an unlocked call that has a threshold, shows the challenge as "Coming soon".

import { DEFAULT_SPECIES, type Species } from '../calls/species';
import type { CallDef } from '../calls/call';

export interface ChallengeRules {
  /**
   * A pause of at least this many seconds between two notes starts a new call. Rule (checked
   * in the test): the longest pause between notes inside any reference clip of an unlocked call
   * (scorer's note finder, species band) times GAP_FACTOR, rounded to 0.1 s.
   */
  gapSec: number;
  /**
   * Lowest score that counts as each unlocked call: the highest score any wrong sound reached
   * as that call, rounded down, plus 1. Wrong sounds: the junk clips, test/fixtures/<species>-other
   * (if any), the recordings of the species' locked calls (except `notWrong`) and the other
   * unlocked calls' references; each scored as a whole clip and through the challenge split.
   */
  recognizeMin: Readonly<Record<string, number>>;
  /** Rank titles for 1-5 stars. Names only. */
  ranks: readonly [string, string, string, string, string];
  /** Locked calls whose recordings are not used as wrong sounds, with the reason. */
  notWrong?: Readonly<Record<string, string>>;
  /** Extra line shown under the locked calls on the results screen. */
  note?: string;
}

/** Room for a caller slower than the slowest reference (Phase 9: 0.5 s over a 0.28 s yelp gap). */
export const GAP_FACTOR = 1.8;

export const CHALLENGE_RULES: Readonly<Record<string, ChallengeRules>> = {
  // Phase 9 values. Within-call gaps: yelp 0.08-0.28 s (yelp-3), gobble 0.04 s.
  // 0.28 x 1.8 = 0.50. yelp: worst wrong sound putt-2 39.6; gobble: putt-4 52.8 (one putt of
  // the series, split off by its 0.7 s pauses). Lowest leave-one-out: yelp 62.2, gobble 67.7.
  turkey: {
    gapSec: 0.5,
    recognizeMin: { yelp: 40, gobble: 53 },
    // Hunting terms used as rank names only.
    ranks: ['Poult', 'Jake', 'Gobbler', 'Longbeard', 'Boss gobbler'],
    notWrong: { 'kee-kee-run': 'the call ends in a yelp (SC DNR); kee kee runs score 50-66 as a yelp' },
    note: 'A kee kee run may show as a yelp.',
  },
  // Within-call gaps (OWL_BAND): two-phrase hoot up to 0.70 s (two-phrase-hoot-7, the pause
  // between the two phrases; 0.55 s in -2), hoo-wah one note. 0.70 x 1.8 = 1.26 -> 1.3 s.
  // Two owl calls closer than 1.3 s are scored as one. Wrong sounds: junk, the ascending hoot
  // and caterwaul recordings (locked), the other unlocked call. two-phrase hoot: worst
  // ascending-hoot-5 47.0; hoo-wah: worst two-phrase-hoot-2 51.2. Lowest leave-one-out:
  // two-phrase hoot 62.8, hoo-wah 69.4.
  'barred-owl': {
    gapSec: 1.3,
    recognizeMin: { 'two-phrase-hoot': 48, 'inspection-call': 52 },
    // Made-up fun titles, not owl terms or facts.
    ranks: ['Night listener', 'Hoot rookie', 'Night caller', 'Moon hooter', 'Who-cooker supreme'],
  },
  // Phase 12. Only the calf call is unlocked, and each calf call reference is one note, so the
  // longest within-call gap is 0 s and the rule gives a 0 s split gap: any pause the note finder
  // keeps starts a new call. Wrong sounds: junk and the bugle, glug and cow mew recordings
  // (locked). calf call: worst bugle-7 54.2. Lowest leave-one-out 77.2.
  // shortcut: a 0 s gap splits a calf call with a break in it; revisit with real takes or more calf clips.
  elk: {
    gapSec: 0,
    recognizeMin: { 'calf-call': 55 },
    // Made-up fun titles, not elk terms or facts.
    ranks: ['Meadow walker', 'Trail listener', 'Ridge caller', 'Valley echo', 'Mountain voice'],
  },
};

export const challengeRules = (s: Species): ChallengeRules | undefined => CHALLENGE_RULES[s.id];

/** Calls the challenge can recognize: unlocked, with references and a threshold. */
export function scorableCalls(s: Species): CallDef[] {
  const rules = challengeRules(s);
  return rules ? s.calls.filter((c) => !c.locked && c.references.length > 0 && rules.recognizeMin[c.id] !== undefined) : [];
}

/** The challenge link of a species; turkey keeps #/challenge (Phase 9 links). */
export const challengeHref = (s: Species): string => (s === DEFAULT_SPECIES ? '#/challenge' : `#/${s.id}/challenge`);
